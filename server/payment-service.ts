import Stripe from "stripe";
import { storage } from "./storage";
import { grantCommunityBuilderBadge } from "./communityBuilderBadgeService";
import {
  type ContractorPayment,
  type MarketplaceTransaction,
  type PaymentConfiguration,
  type ProfileBookingRequest,
} from "@shared/schema";
import { TRADESCOUT_TRANSACTION_FEE_USD } from "@shared/platformRevenue";
import { getStripeClient, type StripeClientProvider } from "./services/stripeClient";

type PaymentType = "marketplace_transaction" | "contractor_service" | "premium_subscription";
type ProcessingMethod = "card" | "ach";
const TRADESCOUT_FLAT_PLATFORM_TRANSACTION_FEE = TRADESCOUT_TRANSACTION_FEE_USD;

function getAchIncentiveConfig() {
  const threshold = Number(process.env.ACH_DEFAULT_THRESHOLD_USD ?? 1000);
  const safeThreshold = Number.isFinite(threshold) ? Math.max(0, threshold) : 1000;
  return { thresholdUsd: safeThreshold };
}

// Payment service for handling platform transactions
export class PaymentService {
  private readonly stripeProvider: StripeClientProvider;

  constructor(stripeClientOrProvider?: Stripe | null | StripeClientProvider) {
    this.stripeProvider =
      typeof stripeClientOrProvider === "function"
        ? stripeClientOrProvider
        : stripeClientOrProvider !== undefined
          ? () => stripeClientOrProvider
          : getStripeClient;
  }

  private async getMatchingProfileBookingRequest(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<ProfileBookingRequest | null> {
    const metadata = paymentIntent.metadata;
    const bookingRequestId = metadata.bookingRequestId;
    const ownerUserId = metadata.ownerUserId;
    const buyerUserId = metadata.buyerUserId;

    if (!bookingRequestId || !ownerUserId || !buyerUserId) {
      return null;
    }

    const bookingRequest = await storage.getProfileBookingRequestById(bookingRequestId);
    if (!bookingRequest) {
      return null;
    }

    if (
      bookingRequest.paymentIntentId !== paymentIntent.id ||
      bookingRequest.ownerUserId !== ownerUserId ||
      bookingRequest.requesterUserId !== buyerUserId
    ) {
      return null;
    }

    return bookingRequest;
  }

  private async refundTerminalProfileBookingDeposit(
    bookingRequest: ProfileBookingRequest,
    paymentIntent: Stripe.PaymentIntent
  ): Promise<void> {
    if (bookingRequest.paymentStatus === "refunded") {
      return;
    }
    const stripe = this.stripeProvider();
    if (!stripe) {
      throw new Error(
        `Cannot refund captured deposit for terminal booking ${bookingRequest.id}: Stripe is not configured`
      );
    }

    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntent.id,
        metadata: {
          type: "profile_booking_terminal_refund",
          bookingRequestId: bookingRequest.id,
        },
      },
      {
        idempotencyKey: `profile-booking:${bookingRequest.id}:terminal-refund:${paymentIntent.id}`,
      }
    );
    if (refund.status !== "succeeded") {
      throw new Error(
        `Stripe refund did not succeed for terminal booking ${bookingRequest.id} (${refund.status || "unknown"})`
      );
    }

    await storage.updateProfileBookingRequest(bookingRequest.id, {
      paymentStatus: "refunded",
    } as any);
  }

  // Apply the 5/5/5 impact model for a completed, fee-generating transaction.
  // This routes 5% of platform fees to county community vaults and 5% to
  // education causes (scholarships) via the foundation layer.
  private async applyFiveFiveFiveImpact(args: {
    payerUserId: string;
    affiliateUserId: string;
    platformFee: number;
    paymentType: PaymentType;
    referenceId: string;
  }) {
    const { payerUserId, platformFee, paymentType, referenceId } = args;

    try {
      if (!platformFee || platformFee <= 0) return;

      const communityShare = Number((platformFee * 0.05).toFixed(2));
      const scholarshipShare = Number((platformFee * 0.05).toFixed(2));

      if (communityShare <= 0 && scholarshipShare <= 0) return;

      // Resolve the payer to derive county context for local impact.
      const [payer] = await storage.getUsersByIds([payerUserId]);
      if (!payer) return;

      let countyId: string | undefined;

      try {
        if (payer.county && payer.state) {
          const countySnapshot = await storage.getCountyVaultSnapshot({
            countyName: payer.county,
            stateCode: payer.state,
          });

          if (countySnapshot && countySnapshot.county && countySnapshot.county.id) {
            countyId = countySnapshot.county.id;
          }
        }
      } catch (countyErr) {
        console.error("Error resolving county for 5/5/5 impact:", countyErr);
      }

      // 5% to county vaults (if we can resolve a county).
      if (communityShare > 0 && countyId) {
        try {
          await storage.recordVaultLedgerEntry({
            countyId,
            amount: communityShare,
            sourceType: "affiliate_community_share",
            sourceId: referenceId,
            memo: `5% community share from ${paymentType} platform fees`,
          });
        } catch (vaultErr) {
          console.error("Error recording county vault 5/5/5 share:", vaultErr);
        }
      }

      // 5% to trade school scholarships via a national education cause.
      if (scholarshipShare > 0) {
        try {
          // National effort: pick an active education cause, preferring ones
          // that are not tied to a specific county (countyId is null).
          const causes = await storage.getFoundationCauses({
            category: "education",
            isActive: true,
          });

          if (!causes || causes.length === 0) return;

          const targetCause = causes.find((c: any) => !c.countyId) || causes[0];
          if (!targetCause) return;

          await storage.createFoundationDonation({
            causeId: targetCause.id,
            userId: payerUserId,
            amount: scholarshipShare.toFixed(2),
            status: "completed",
            type: "roundup",
            isRoundupDonation: true,
            originalAmount: platformFee.toFixed(2),
            relatedTransactionId: referenceId,
            relatedTransactionType:
              paymentType === "contractor_service"
                ? "contractor_payment"
                : "marketplace_transaction",
            paymentMethod: "platform_5_5_5",
            taxDeductible: true,
          });
        } catch (foundationErr) {
          console.error("Error creating foundation 5/5/5 scholarship donation:", foundationErr);
        }
      }
    } catch (err) {
      console.error("Error applying 5/5/5 impact:", err);
    }
  }

  // Calculate fees based on payment configuration
  async calculatePaymentFees(
    amount: number,
    paymentType: PaymentType,
    opts?: { processingMethod?: ProcessingMethod }
  ) {
    const config = await storage.getPaymentConfiguration(paymentType);
    const processingMethod: ProcessingMethod = opts?.processingMethod === "ach" ? "ach" : "card";

    if (!config) {
      // TradeScout monetizes on a flat transaction fee, not lead sales, paid access, or percentage take rates.
      const platformFee = TRADESCOUT_FLAT_PLATFORM_TRANSACTION_FEE;
      const stripeFee =
        processingMethod === "ach"
          ? Math.min(5, amount * 0.008) // ACH debit is typically lower (capped)
          : amount * 0.029 + 0.3; // Card (baseline)

      return {
        platformFee: Number(platformFee.toFixed(2)),
        stripeFee: Number(stripeFee.toFixed(2)),
        totalFees: Number((platformFee + stripeFee).toFixed(2)),
      };
    }

    // Ignore legacy percentage configurations for new on-platform transactions.
    const platformFee = TRADESCOUT_FLAT_PLATFORM_TRANSACTION_FEE;

    const stripeFee =
      processingMethod === "ach" ? Math.min(5, amount * 0.008) : amount * 0.029 + 0.3;

    return {
      platformFee: Number(platformFee.toFixed(2)),
      stripeFee: Number(stripeFee.toFixed(2)),
      totalFees: Number((platformFee + stripeFee).toFixed(2)),
    };
  }

  // Track affiliate commission when payment is processed
  async trackAffiliateCommission(
    userId: string,
    amount: number,
    paymentType: PaymentType,
    referenceId: string
  ) {
    try {
      // Check if user was referred by looking for referrals where this user is the referred user
      const referralRecord = await storage.getReferralByReferredUserId(userId);
      if (!referralRecord) return null;

      // Referral stores the affiliate account ID; resolve the actual affiliate program/account
      const affiliateProgram = await storage.getAffiliateProgramByAccountId(
        referralRecord.affiliateId
      );
      if (!affiliateProgram || affiliateProgram.status === "inactive") return null;

      // Calculate commission based on platform fees
      const fees = await this.calculatePaymentFees(amount, paymentType);

      // 5/5/5 model:
      // - 5% of platform fees to the affiliate (by default)
      // - 5% to community vaults (county vaults, kept local to the payer)
      // - 5% to trade school scholarships (education causes via the foundation layer)
      // Some affiliates may have a custom commission rate (e.g. 7% of platform fees).
      const defaultAffiliateRate = 0.05;
      const customRateValue = (affiliateProgram as any).commissionRate;
      const customRate =
        typeof customRateValue === "string"
          ? parseFloat(customRateValue)
          : typeof customRateValue === "number"
            ? customRateValue
            : undefined;

      const affiliateRate =
        typeof customRate === "number" && customRate > 0 ? customRate : defaultAffiliateRate;

      const affiliateCommissionAmount = Number((fees.platformFee * affiliateRate).toFixed(2));

      // Create commission record for the affiliate portion only
      const commission = await storage.createCommission({
        affiliateProgramId: affiliateProgram.id,
        referralId: referralRecord.id,
        transactionId: referenceId,
        revenueAmount: amount.toString(),
        commissionAmount: affiliateCommissionAmount.toString(),
        status: "pending",
        description: `5% affiliate commission from ${paymentType} payment (with additional 5% to community vaults and 5% to trade school scholarships)`,
        createdAt: new Date(),
      });

      // Credit the affiliate's on-platform wallet balance so they can spend earnings
      try {
        if (affiliateCommissionAmount > 0) {
          await storage.creditWallet(affiliateProgram.affiliateId, affiliateCommissionAmount, {
            type: "affiliate_commission",
            referenceType: "payment",
            referenceId,
            memo: `Affiliate commission from ${paymentType} payment`,
          });

          // Keep affiliateAccounts lifetimeEarned/available in sync for dashboards
          await storage.incrementAffiliateEarnings(affiliateProgram.id, affiliateCommissionAmount);
        }
      } catch (walletError) {
        console.error("Error crediting affiliate wallet or earnings:", walletError);
      }

      // Award the Community Builder badge to the affiliate who drove this paid conversion.
      try {
        await grantCommunityBuilderBadge(affiliateProgram.affiliateId, "affiliate_conversion");
      } catch (err) {
        console.error("Error granting Community Builder badge for affiliate conversion:", err);
      }

      // Apply the remaining 5/5 impact (community vault + scholarships).
      try {
        if (fees.platformFee > 0) {
          await this.applyFiveFiveFiveImpact({
            payerUserId: userId,
            affiliateUserId: affiliateProgram.affiliateId,
            platformFee: fees.platformFee,
            paymentType,
            referenceId,
          });
        }
      } catch (impactError) {
        console.error("Error applying 5/5/5 impact for affiliate referral:", impactError);
      }

      return commission;
    } catch (error) {
      console.error("Error tracking affiliate commission:", error);
      return null;
    }
  }

  // Create Stripe payment intent for contractor payments
  async createContractorPaymentIntent(payment: ContractorPayment) {
    const stripe = this.stripeProvider();
    if (!stripe || payment.isOffPlatform) {
      throw new Error("Stripe not available or payment is off-platform");
    }

    const fees = await this.calculatePaymentFees(Number(payment.totalAmount), "contractor_service");

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(payment.totalAmount) * 100), // Convert to cents
      currency: payment.currency || "usd",
      metadata: {
        paymentId: payment.id,
        contractorId: payment.contractorId,
        homeownerId: payment.homeownerId,
        type: "contractor_payment",
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      fees,
    };
  }

  // Create Stripe payment intent for marketplace transactions
  async createMarketplacePaymentIntent(
    transaction: MarketplaceTransaction,
    opts?: {
      processingMethod?: ProcessingMethod;
    }
  ) {
    const stripe = this.stripeProvider();
    if (!stripe || transaction.isOffPlatform) {
      throw new Error("Stripe not available or payment is off-platform");
    }

    const baseTotal = Number(transaction.totalAmount);
    const { thresholdUsd } = getAchIncentiveConfig();
    const desiredMethod: ProcessingMethod =
      opts?.processingMethod === "ach"
        ? "ach"
        : opts?.processingMethod === "card"
          ? "card"
          : baseTotal >= thresholdUsd
            ? "ach"
            : "card";

    const effectiveTotal = Number.isFinite(baseTotal)
      ? Math.max(0.5, Number(baseTotal.toFixed(2)))
      : 0;

    const fees = await this.calculatePaymentFees(effectiveTotal, "marketplace_transaction", {
      processingMethod: desiredMethod,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(effectiveTotal * 100), // Convert to cents
      currency: "usd",
      payment_method_types: desiredMethod === "ach" ? ["us_bank_account"] : ["card"],
      metadata: {
        transactionId: transaction.id,
        listingId: transaction.listingId,
        buyerId: transaction.buyerId,
        sellerId: transaction.sellerId,
        type: "marketplace_transaction",
        processingMethod: desiredMethod,
        baseTotalAmount: Number.isFinite(baseTotal) ? baseTotal.toFixed(2) : "",
        discountApplied: "0.00",
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      fees,
      processingMethod: desiredMethod,
      effectiveTotalAmount: effectiveTotal,
      discountApplied: 0,
    };
  }

  // Process off-platform payment confirmation
  async confirmOffPlatformPayment(
    paymentId: string,
    paymentType: "contractor" | "marketplace",
    confirmationData: {
      method: string;
      notes: string;
      confirmedBy: string;
    }
  ) {
    if (paymentType === "contractor") {
      const payment = await storage.updateContractorPayment(paymentId, {
        status: "completed",
        offPlatformMethod: confirmationData.method,
        offPlatformNotes: confirmationData.notes,
        completedAt: new Date(),
      });

      try {
        if (payment?.homeownerId && payment.totalAmount) {
          await this.trackAffiliateCommission(
            payment.homeownerId,
            Number(payment.totalAmount),
            "contractor_service",
            payment.id
          );
        }
      } catch (e) {
        console.error(
          "Error tracking affiliate commission for contractor payment (off-platform):",
          e
        );
      }

      return payment;
    } else {
      const transaction = await storage.updateMarketplaceTransactionPayment(paymentId, {
        paymentMethod: "off_platform_direct",
        isOffPlatform: true,
        status: "completed",
        offPlatformMethod: confirmationData.method,
        offPlatformNotes: confirmationData.notes,
      });

      try {
        if (transaction?.buyerId && transaction.totalAmount) {
          await this.trackAffiliateCommission(
            transaction.buyerId,
            Number(transaction.totalAmount),
            "marketplace_transaction",
            transaction.id
          );
        }
      } catch (e) {
        console.error(
          "Error tracking affiliate commission for marketplace transaction (off-platform):",
          e
        );
      }

      return transaction;
    }
  }

  // Handle Stripe webhook events
  async handleStripeWebhook(event: Stripe.Event) {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata;

        if (metadata.type === "contractor_payment") {
          const payment = await storage.updateContractorPayment(metadata.paymentId, {
            status: "completed",
            stripePaymentIntentId: paymentIntent.id,
            completedAt: new Date(),
          });

          try {
            if (payment?.homeownerId && payment.totalAmount) {
              await this.trackAffiliateCommission(
                payment.homeownerId,
                Number(payment.totalAmount),
                "contractor_service",
                payment.id
              );
            }
          } catch (e) {
            console.error(
              "Error tracking affiliate commission for contractor payment (Stripe):",
              e
            );
          }
        } else if (metadata.type === "marketplace_transaction") {
          const transaction = await storage.updateMarketplaceTransactionPayment(
            metadata.transactionId,
            {
              paymentMethod: "on_platform_stripe",
              isOffPlatform: false,
              status: "completed",
              stripePaymentIntentId: paymentIntent.id,
            }
          );

          // If this transaction is associated with a listing boost, activate it
          try {
            await storage.applyListingBoostForTransaction(metadata.transactionId);
          } catch (err) {
            console.error(
              "Error applying listing boost for transaction",
              metadata.transactionId,
              err
            );
          }

          try {
            const amountFromIntent =
              typeof (paymentIntent as any).amount_received === "number" &&
              (paymentIntent as any).amount_received > 0
                ? (paymentIntent as any).amount_received
                : typeof (paymentIntent as any).amount === "number"
                  ? (paymentIntent as any).amount
                  : null;
            const effectiveAmount =
              amountFromIntent != null
                ? Number((amountFromIntent / 100).toFixed(2))
                : Number(transaction.totalAmount);

            if (transaction?.buyerId && Number.isFinite(effectiveAmount) && effectiveAmount > 0) {
              await this.trackAffiliateCommission(
                transaction.buyerId,
                effectiveAmount,
                "marketplace_transaction",
                transaction.id
              );
            }
          } catch (e) {
            console.error(
              "Error tracking affiliate commission for marketplace transaction (Stripe):",
              e
            );
          }
        } else if (metadata.type === "profile_booking") {
          const bookingRequest = await this.getMatchingProfileBookingRequest(paymentIntent);
          if (!bookingRequest) break;

          const bookingStatus = String(bookingRequest.status || "").toLowerCase();
          if (new Set(["declined", "cancelled", "completed"]).has(bookingStatus)) {
            await this.refundTerminalProfileBookingDeposit(bookingRequest, paymentIntent);
            break;
          }

          // Capturing the optional deposit satisfies only the payment gate.
          // The business still explicitly accepts the booking request.
          if (
            bookingRequest.paymentStatus === "paid" ||
            bookingRequest.paymentStatus === "refunded"
          ) {
            break;
          }

          await storage.updateProfileBookingRequest(bookingRequest.id, {
            paymentStatus: "paid",
          } as any);
          const refreshedBooking = await storage.getProfileBookingRequestById(bookingRequest.id);
          if (
            refreshedBooking &&
            new Set(["declined", "cancelled", "completed"]).has(
              String(refreshedBooking.status || "").toLowerCase()
            )
          ) {
            await this.refundTerminalProfileBookingDeposit(refreshedBooking, paymentIntent);
          }
        }
        break;
      }

      case "payment_intent.payment_failed":
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        const failedMetadata = failedIntent.metadata;

        if (failedMetadata.type === "contractor_payment") {
          await storage.updateContractorPayment(failedMetadata.paymentId, {
            status: "failed",
          });
        } else if (failedMetadata.type === "marketplace_transaction") {
          await storage.updateMarketplaceTransactionPayment(failedMetadata.transactionId, {
            paymentMethod: "on_platform_stripe",
            isOffPlatform: false,
            status: "failed",
          });
        } else if (failedMetadata.type === "profile_booking") {
          const bookingRequest = await this.getMatchingProfileBookingRequest(failedIntent);
          if (!bookingRequest) break;

          // Failure delivery can be delayed or duplicated. It must not undo a
          // captured/refunded payment, and the intent match above prevents an
          // old failure from overwriting a replacement intent.
          if (
            bookingRequest.paymentStatus === "paid" ||
            bookingRequest.paymentStatus === "refunded" ||
            bookingRequest.paymentStatus === "failed"
          ) {
            break;
          }

          await storage.updateProfileBookingRequest(bookingRequest.id, {
            paymentStatus: "failed",
          } as any);
        }
        break;
    }
  }

  // Get payment methods available for user
  getAvailablePaymentMethods(
    isOffPlatformAllowed = true,
    ctx?: { amount?: number; paymentType?: PaymentType }
  ) {
    const amount = Number(ctx?.amount ?? 0);
    const { thresholdUsd } = getAchIncentiveConfig();
    const isHighTicket = Number.isFinite(amount) && amount >= thresholdUsd;

    const methods = [
      {
        id: "on_platform_stripe_ach",
        name: "Bank transfer (ACH)",
        description: "Pay with a bank account through Stripe (lower processing costs)",
        fees: "Lower processing fees vs card",
        recommended: isHighTicket,
      },
      {
        id: "on_platform_stripe_card",
        name: "Pay with Card (Secure)",
        description: "Credit/debit card processed securely through our platform",
        fees: "Small platform fee applies",
        recommended: !isHighTicket,
      },
    ];

    if (isOffPlatformAllowed) {
      methods.push(
        {
          id: "off_platform_cash",
          name: "Cash Payment",
          description: "Pay directly with cash",
          fees: "No platform fees",
          recommended: false,
        },
        {
          id: "off_platform_check",
          name: "Check Payment",
          description: "Pay by personal or business check",
          fees: "No platform fees",
          recommended: false,
        },
        {
          id: "off_platform_venmo",
          name: "Venmo/PayPal",
          description: "Pay using Venmo, PayPal, or similar service",
          fees: "No platform fees",
          recommended: false,
        },
        {
          id: "off_platform_bank_transfer",
          name: "Bank Transfer",
          description: "Direct bank-to-bank transfer",
          fees: "No platform fees",
          recommended: false,
        }
      );
    }

    return methods;
  }
}

export const paymentService = new PaymentService();
