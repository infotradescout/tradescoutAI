import { storage } from './storage';
import Stripe from 'stripe';

let stripe: Stripe | null = null;

function getStripe(): Stripe {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    throw new Error('STRIPE_SECRET_KEY is missing');
  }

  if (!stripe) {
    stripe = new Stripe(stripeSecret, {
      apiVersion: '2024-04-10' as any,
    });
  }

  return stripe;
}

export class CommunityBuilderPaymentService {
  /**
   * Process a verified contribution to the county vault
   */
  async recordContributionToVault(
    contributionId: string,
    actualValue: string,
    payoutToVault: boolean = true
  ): Promise<void> {
    const contribution = await storage.getContribution(contributionId);
    if (!contribution) throw new Error('Contribution not found');

    if (payoutToVault) {
      // Record entry to county vault
      const builder = await storage.getBuilderById(contribution.builderId);
      if (!builder) throw new Error('Builder not found');

      // Add to vault ledger
      const numValue = parseFloat(actualValue);
      await storage.recordVaultLedgerEntry({
        countyId: builder.countyId,
        sourceType: 'other', // vault_source_type enum-safe
        sourceId: contributionId,
        amount: numValue,
        memo: `Community Builder contribution: ${contribution.title}`,
      });
    }

    // Mark contribution as paid out
    await storage.updateContributionStatus(contributionId, 'verified', {
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
    const contributionsList = [];

    for (const contrib of contributions) {
      const value = parseFloat(contrib.actualValue || contrib.estimatedValue || '0');
      
      if (contrib.status === 'verified' && contrib.isPaidOut) {
        totalPaidOut += value;
      } else if (contrib.status === 'verified') {
        pendingPayout += value;
      }
      
      if (contrib.status === 'verified') {
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
    payoutType: string = 'contribution_earnings',
    relatedContributionIds?: string[]
  ): Promise<any> {
    const builder = await storage.getBuilderById(builderId);
    if (!builder) throw new Error('Builder not found');

    // Validate payout
    if (!builder.payoutEmail && !builder.bankAccountId) {
      throw new Error('Builder has no payout method configured');
    }

    // Create payout record
    const payout = await storage.recordPayout({
      builderId,
      countyId: builder.countyId,
      amount,
      payoutType,
      relatedContributionIds: relatedContributionIds ?? [],
      status: 'pending',
    } as any);

    // If Stripe Connect is configured, initiate payout
    if (builder.bankAccountId && process.env.STRIPE_CONNECTED_ACCOUNT_ID) {
      try {
        // Create a transfer to the connected account
        const transfer = await getStripe().transfers.create(
          {
            amount: Math.round(parseFloat(amount) * 100), // Convert to cents
            currency: 'usd',
            destination: builder.bankAccountId,
            description: `Community Builder payout: ${payoutType}`,
            metadata: {
              payoutId: payout.id,
              builderId,
              contributionIds: relatedContributionIds?.join(',') ?? '',
            },
          },
          {
            stripeAccount: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
          }
        );

        // Update payout with Stripe details
        await storage.updateBuilderPayoutStatus(payout.id, 'processing', {
          externalPaymentId: transfer.id,
          transactionId: transfer.id,
        } as any);
      } catch (error) {
        console.error('Stripe payout failed:', error);
        await storage.updateBuilderPayoutStatus(payout.id, 'failed', {
          failureReason: `Stripe error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    status: 'pending' | 'processing' | 'completed' | 'failed',
    details?: {
      transactionId?: string;
      failureReason?: string;
    }
  ): Promise<any> {
    const updates: any = {};
    if (details?.transactionId) updates.transactionId = details.transactionId;
    if (details?.failureReason) updates.failureReason = details.failureReason;
    if (status === 'completed') updates.processedAt = new Date();

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
      // This would require storage methods to fetch pending payouts
      // For now, returning placeholder
      console.log('Processing scheduled payouts...');
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
      case 'transfer.created':
        console.log('Transfer created:', event.data.object.id);
        break;
      
      case 'transfer.updated':
        const transfer = event.data.object;
        if (transfer.metadata?.payoutId) {
          const status = transfer.status === 'paid' ? 'completed' : 'failed';
          await this.updatePayoutStatus(transfer.metadata.payoutId, status as any, {
            transactionId: transfer.id,
            failureReason: transfer.failure_reason,
          });
        }
        break;

      case 'charge.dispute.created':
        console.log('Dispute created:', event.data.object.id);
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
    let bonusType = '';

    switch (builder.currentRank) {
      case 'silver':
        bonusAmount = totalValue * 0.02; // 2% bonus
        bonusType = 'silver_rank_bonus';
        break;
      case 'gold':
        bonusAmount = totalValue * 0.05; // 5% bonus
        bonusType = 'gold_rank_bonus';
        break;
      case 'platinum':
        bonusAmount = totalValue * 0.1; // 10% bonus
        bonusType = 'platinum_rank_bonus';
        break;
      case 'diamond':
        bonusAmount = totalValue * 0.15; // 15% bonus
        bonusType = 'diamond_rank_bonus';
        break;
    }

    if (bonusAmount > 0) {
      await this.createBuilderPayout(
        builderId,
        bonusAmount.toFixed(2),
        bonusType
      );
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
      console.warn('[stripe] Missing metadata (contributionId/builderId/countyId); skipping vault update');
      return;
    }

    const amount = session.amount_total != null
      ? (session.amount_total / 100).toFixed(2)
      : metadata.amount;

    if (!amount) {
      console.warn('[stripe] Missing amount on checkout.session.completed; skipping vault update');
      return;
    }

    const payoutToVault = metadata.payoutToVault !== 'false';

    // Record into vault and mark contribution verified/paid
    const contribution = await storage.getContribution(contributionId);
    if (!contribution) {
      console.warn(`[stripe] Contribution ${contributionId} not found; skipping`);
      return;
    }

    // Idempotency guard: if already verified/paid, skip.
    if (contribution.verifiedAt || contribution.isPaidOut) {
      console.log(`[stripe] Contribution ${contributionId} already finalized; skipping duplicate event ${session.id}`);
      return;
    }

    await storage.recordVaultLedgerEntry({
      countyId,
      sourceType: 'other',
      sourceId: contributionId,
      amount: parseFloat(amount),
      memo: `Stripe checkout for contribution ${contribution.title}`,
    });

    await storage.updateContributionStatus(contributionId, 'verified', {
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
