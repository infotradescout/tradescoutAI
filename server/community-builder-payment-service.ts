import { storage } from "./storage";
import Stripe from "stripe";
import { db } from "./db";
import { builderPayouts } from "@shared/schema";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import {
  getStripeClient,
  requireStripeClient,
  type StripeClientProvider,
} from "./services/stripeClient";

export class CommunityBuilderPaymentService {
  constructor(private readonly stripeProvider: StripeClientProvider = getStripeClient) {}

  /**
   * Process a verified contribution to the county vault
   */
  async recordContributionToVault(
    contributionId: string,
    actualValue: string,
    payoutToVault: boolean = true
  ): Promise<void> {
    const contribution = await storage.getContribution(contributionId);
    if (!contribution) throw new Error("Contribution not found");

    if (payoutToVault) {
      // Record entry to county vault
      const builder = await storage.getBuilderById(contribution.builderId);
      if (!builder) throw new Error("Builder not found");

      // Add to vault ledger
      const numValue = parseFloat(actualValue);
      await storage.recordVaultLedgerEntry({
        countyId: builder.countyId,
        sourceType: "other", // vault_source_type enum-safe
        sourceId: contributionId,
        amount: numValue,
        memo: `Community Builder contribution: ${contribution.title}`,
      });
    }

    // Mark contribution as paid out
    await storage.updateContributionStatus(contributionId, "verified", {
      isPaidOut: true,
      paidOutAmount: actualValue,
      paidOutAt: new Date(),
      paidOutToVault: payoutToVault,
    } as any);
  }

  /**
   * Calculate total earnings for a builder
   */
  async calculateBuilderEarnings(builderId: string): Promise<{
    totalEarnings: string;
    pendingPayout: string;
    totalPaidOut: string;
    contributions: {
      id: string;
      value: string;
      status: string;
    }[];
  }> {
    const contributions = await storage.getBuilderContributions(builderId);

    let totalEarnings = 0;
    let pendingPayout = 0;
    let totalPaidOut = 0;
    const contributionsList: Array<{ id: string; value: string; status: string }> = [];

    for (const contrib of contributions) {
      const value = parseFloat(contrib.actualValue || contrib.estimatedValue || "0");

      if (contrib.status === "verified" && contrib.isPaidOut) {
        totalPaidOut += value;
      } else if (contrib.status === "verified") {
        pendingPayout += value;
      }

      if (contrib.status === "verified") {
        totalEarnings += value;
        contributionsList.push({
          id: contrib.id,
          value: value.toFixed(2),
          status: contrib.status,
        });
      }
    }

    return {
      totalEarnings: totalEarnings.toFixed(2),
      pendingPayout: pendingPayout.toFixed(2),
      totalPaidOut: totalPaidOut.toFixed(2),
      contributions: contributionsList,
    };
  }

  /**
   * Create and process a payout for a builder
   */
  async createBuilderPayout(
    builderId: string,
    amount: string,
    payoutType: string = "contribution_earnings",
    relatedContributionIds?: string[]
  ): Promise<any> {
    const builder = await storage.getBuilderById(builderId);
    if (!builder) throw new Error("Builder not found");

    // Validate payout
    if (!builder.payoutEmail && !builder.bankAccountId) {
      throw new Error("Builder has no payout method configured");
    }

    // Create payout record
    const payout = await storage.recordPayout({
      builderId,
      countyId: builder.countyId,
      amount,
      payoutType,
      relatedContributionIds: relatedContributionIds ?? [],
      status: "pending",
    } as any);

    // If Stripe Connect is configured, initiate payout
    if (builder.bankAccountId && process.env.STRIPE_CONNECTED_ACCOUNT_ID) {
      try {
        // Create a transfer to the connected account
        const transfer = await requireStripeClient(this.stripeProvider).transfers.create(
          {
            amount: Math.round(parseFloat(amount) * 100), // Convert to cents
            currency: "usd",
            destination: builder.bankAccountId,
            description: `Community Builder payout: ${payoutType}`,
            metadata: {
              payoutId: payout.id,
              builderId,
              contributionIds: relatedContributionIds?.join(",") ?? "",
            },
          },
          {
            stripeAccount: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
          }
        );

        // Update payout with Stripe details
        await storage.updateBuilderPayoutStatus(payout.id, "processing", {
          externalPaymentId: transfer.id,
          transactionId: transfer.id,
        } as any);
      } catch (error) {
        console.error("Stripe payout failed:", error);
        await storage.updateBuilderPayoutStatus(payout.id, "failed", {
          failureReason: `Stripe error: ${error instanceof Error ? error.message : "Unknown error"}`,
        } as any);
        throw error;
      }
    }

    return payout;
  }

  /**
   * Update payout status
   */
  async updatePayoutStatus(
    payoutId: string,
    status: "pending" | "processing" | "completed" | "failed",
    details?: {
      transactionId?: string;
      failureReason?: string;
    }
  ): Promise<any> {
    const updates: any = {};
    if (details?.transactionId) updates.transactionId = details.transactionId;
    if (details?.failureReason) updates.failureReason = details.failureReason;
    if (status === "completed") updates.processedAt = new Date();

    return storage.updateBuilderPayoutStatus(payoutId, status, updates);
  }

  /**
   * Process scheduled payouts (typically run on a schedule)
   */
  async processScheduledPayouts(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    errors: any[];
  }> {
    const result = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as any[],
    };

    try {
      const now = new Date();
      const safetyDelayMinutes = Number(process.env.CB_PAYOUT_SAFETY_DELAY_MINUTES || 10);
      const cutoff = new Date(now.getTime() - Math.max(safetyDelayMinutes, 0) * 60 * 1000);

      const pendingPayouts = await db
        .select()
        .from(builderPayouts)
        .where(
          and(
            eq(builderPayouts.status, "pending"),
            lte(builderPayouts.createdAt, cutoff),
            or(isNull(builderPayouts.scheduledFor), lte(builderPayouts.scheduledFor, now))
          )
        );

      for (const payout of pendingPayouts) {
        result.processed += 1;

        try {
          // Idempotency: do not submit a second external payment if already linked.
          if (payout.externalPaymentId) {
            await storage.updateBuilderPayoutStatus(payout.id, "processing");
            result.succeeded += 1;
            continue;
          }

          const builder = await storage.getBuilderById(payout.builderId);
          if (!builder) {
            await storage.updateBuilderPayoutStatus(payout.id, "failed", {
              failureReason: "Builder not found for payout",
            } as any);
            result.failed += 1;
            result.errors.push({ payoutId: payout.id, message: "Builder not found" });
            continue;
          }

          if (!builder.bankAccountId) {
            await storage.updateBuilderPayoutStatus(payout.id, "failed", {
              failureReason: "Builder has no connected payout account",
            } as any);
            result.failed += 1;
            result.errors.push({
              payoutId: payout.id,
              message: "Builder has no connected payout account",
            });
            continue;
          }

          if (!process.env.STRIPE_CONNECTED_ACCOUNT_ID) {
            await storage.updateBuilderPayoutStatus(payout.id, "failed", {
              failureReason: "STRIPE_CONNECTED_ACCOUNT_ID is not configured",
            } as any);
            result.failed += 1;
            result.errors.push({
              payoutId: payout.id,
              message: "STRIPE_CONNECTED_ACCOUNT_ID is not configured",
            });
            continue;
          }

          const amountNumber = Number(payout.amount);
          if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
            await storage.updateBuilderPayoutStatus(payout.id, "failed", {
              failureReason: `Invalid payout amount: ${String(payout.amount)}`,
            } as any);
            result.failed += 1;
            result.errors.push({
              payoutId: payout.id,
              message: `Invalid payout amount: ${String(payout.amount)}`,
            });
            continue;
          }

          await storage.updateBuilderPayoutStatus(payout.id, "processing", {
            processingMethod: "stripe",
          } as any);

          const transfer = await requireStripeClient(this.stripeProvider).transfers.create(
            {
              amount: Math.round(amountNumber * 100),
              currency: "usd",
              destination: builder.bankAccountId,
              description: `Scheduled Community Builder payout (${payout.payoutType})`,
              metadata: {
                payoutId: payout.id,
                builderId: builder.id,
              },
            },
            {
              stripeAccount: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
            }
          );

          const transferStatus = String((transfer as any)?.status || "").toLowerCase();
          const nextStatus = transferStatus === "paid" ? "completed" : "processing";

          await storage.updateBuilderPayoutStatus(payout.id, nextStatus, {
            externalPaymentId: transfer.id,
            transactionId: transfer.id,
          } as any);

          result.succeeded += 1;
        } catch (error) {
          result.failed += 1;
          const message =
            error instanceof Error ? error.message : "Unknown payout processing error";
          result.errors.push({ payoutId: payout.id, message });

          try {
            await storage.updateBuilderPayoutStatus(payout.id, "failed", {
              failureReason: message,
            } as any);
          } catch (statusError) {
            result.errors.push({
              payoutId: payout.id,
              message: "Failed to mark payout as failed",
              detail: statusError instanceof Error ? statusError.message : String(statusError),
            });
          }
        }
      }
    } catch (error) {
      result.errors.push(error);
    }

    return result;
  }

  /**
   * Handle Stripe webhook for payout status updates
   */
  async handleStripeWebhook(event: any): Promise<void> {
    switch (event.type) {
      case "transfer.created":
        console.log("Transfer created:", event.data.object.id);
        break;

      case "transfer.updated":
        const transfer = event.data.object;
        if (transfer.metadata?.payoutId) {
          const status = transfer.status === "paid" ? "completed" : "failed";
          await this.updatePayoutStatus(transfer.metadata.payoutId, status as any, {
            transactionId: transfer.id,
            failureReason: transfer.failure_reason,
          });
        }
        break;

      case "charge.dispute.created":
        console.log("Dispute created:", event.data.object.id);
        // Handle dispute
        break;
    }
  }

  /**
   * Apply rank bonuses or penalties
   */
  async applyRankBonus(builderId: string): Promise<void> {
    const builder = await storage.getBuilderById(builderId);
    if (!builder) return;

    const earnings = await this.calculateBuilderEarnings(builderId);
    const totalValue = parseFloat(earnings.totalEarnings);

    // Determine bonus tier based on rank
    let bonusAmount = 0;
    let bonusType = "";

    switch (builder.currentRank) {
      case "silver":
        bonusAmount = totalValue * 0.02; // 2% bonus
        bonusType = "silver_rank_bonus";
        break;
      case "gold":
        bonusAmount = totalValue * 0.05; // 5% bonus
        bonusType = "gold_rank_bonus";
        break;
      case "platinum":
        bonusAmount = totalValue * 0.1; // 10% bonus
        bonusType = "platinum_rank_bonus";
        break;
      case "diamond":
        bonusAmount = totalValue * 0.15; // 15% bonus
        bonusType = "diamond_rank_bonus";
        break;
    }

    if (bonusAmount > 0) {
      await this.createBuilderPayout(builderId, bonusAmount.toFixed(2), bonusType);
    }
  }

  /**
   * Handle checkout.session.completed from Stripe.
   * Expects metadata: contributionId, builderId, countyId, payoutToVault (optional), amount (optional fallback).
   */
  async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const metadata = session.metadata || {};
    const contributionId = metadata.contributionId;
    const builderId = metadata.builderId;
    const countyId = metadata.countyId;

    if (!contributionId || !builderId || !countyId) {
      console.warn(
        "[stripe] Missing metadata (contributionId/builderId/countyId); skipping vault update"
      );
      return;
    }

    const amount =
      session.amount_total != null ? (session.amount_total / 100).toFixed(2) : metadata.amount;

    if (!amount) {
      console.warn("[stripe] Missing amount on checkout.session.completed; skipping vault update");
      return;
    }

    const payoutToVault = metadata.payoutToVault !== "false";

    // Record into vault and mark contribution verified/paid
    const contribution = await storage.getContribution(contributionId);
    if (!contribution) {
      console.warn(`[stripe] Contribution ${contributionId} not found; skipping`);
      return;
    }

    // Idempotency guard: if already verified/paid, skip.
    if (contribution.verifiedAt || contribution.isPaidOut) {
      console.log(
        `[stripe] Contribution ${contributionId} already finalized; skipping duplicate event ${session.id}`
      );
      return;
    }

    await storage.recordVaultLedgerEntry({
      countyId,
      sourceType: "other",
      sourceId: contributionId,
      amount: parseFloat(amount),
      memo: `Stripe checkout for contribution ${contribution.title}`,
    });

    await storage.updateContributionStatus(contributionId, "verified", {
      actualValue: amount,
      isPaidOut: true,
      paidOutAmount: amount,
      paidOutToVault: payoutToVault,
      paidOutAt: new Date(),
      verifiedAt: new Date(),
    } as any);
  }
}

export const communityBuilderPaymentService = new CommunityBuilderPaymentService();
