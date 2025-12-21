import Stripe from 'stripe';
import { storage } from './storage';
import { grantCommunityBuilderBadge } from './communityBuilderBadgeService';
import { 
  type ContractorPayment, 
  type MarketplaceTransaction,
  type PaymentConfiguration,
} from '@shared/schema';

type PaymentType = 'marketplace_transaction' | 'contractor_service' | 'premium_subscription';

// Payment service for handling platform transactions
export class PaymentService {
  private stripe: Stripe | null = null;

  constructor() {
    // Initialize Stripe only if API key is available
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2020-08-27" as any,
      });
    }
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
      const payer = await storage.getUserById(payerUserId);
      if (!payer) return;

      let countyId: string | undefined;

      try {
        if (payer.county && payer.state) {
          const countySnapshot = await storage.getCountyVaultSnapshot({
            countyName: payer.county,
            stateCode: payer.state,
          });

          if (countySnapshot && countySnapshot.countyId) {
            countyId = countySnapshot.countyId;
          }
        }
      } catch (countyErr) {
        console.error('Error resolving county for 5/5/5 impact:', countyErr);
      }

      // 5% to county vaults (if we can resolve a county).
      if (communityShare > 0 && countyId) {
        try {
          await storage.recordVaultLedgerEntry({
            countyId,
            amount: communityShare,
            sourceType: 'affiliate_community_share',
            sourceId: referenceId,
            memo: `5% community share from ${paymentType} platform fees`,
          });
        } catch (vaultErr) {
          console.error('Error recording county vault 5/5/5 share:', vaultErr);
        }
      }

      // 5% to trade school scholarships via a national education cause.
      if (scholarshipShare > 0) {
        try {
          // National effort: pick an active education cause, preferring ones
          // that are not tied to a specific county (countyId is null).
          const causes = await storage.getFoundationCauses({
            category: 'education',
            isActive: true,
          });

          if (!causes || causes.length === 0) return;

          const targetCause =
            causes.find((c: any) => !c.countyId) || causes[0];
          if (!targetCause) return;

          await storage.createFoundationDonation({
            causeId: targetCause.id,
            userId: payerUserId,
            amount: scholarshipShare,
            status: 'completed',
            type: 'roundup',
            isRoundupDonation: true,
            originalAmount: platformFee,
            relatedTransactionId: referenceId,
            relatedTransactionType:
              paymentType === 'contractor_service'
                ? 'contractor_payment'
                : 'marketplace_transaction',
            paymentMethod: 'platform_5_5_5',
            taxDeductible: true,
          });
        } catch (foundationErr) {
          console.error('Error creating foundation 5/5/5 scholarship donation:', foundationErr);
        }
      }
    } catch (err) {
      console.error('Error applying 5/5/5 impact:', err);
    }
  }

  // Calculate fees based on payment configuration
  async calculatePaymentFees(amount: number, paymentType: PaymentType) {
    const config = await storage.getPaymentConfiguration(paymentType);

    if (!config) {
      // Default configuration
      const platformFee = Math.max(0.50, amount * 0.025); // 2.5% with $0.50 minimum
      const stripeFee = (amount * 0.029) + 0.30; // Standard Stripe fee

      return {
        platformFee: Number(platformFee.toFixed(2)),
        stripeFee: Number(stripeFee.toFixed(2)),
        totalFees: Number((platformFee + stripeFee).toFixed(2))
      };
    }

    // Calculate based on configuration
    let platformFee = 0;
    if (config.platformFeeType === 'percentage') {
      platformFee = amount * Number(config.platformFeeValue);
      if (config.platformFeeMin) {
        platformFee = Math.max(platformFee, Number(config.platformFeeMin));
      }
      if (config.platformFeeMax) {
        platformFee = Math.min(platformFee, Number(config.platformFeeMax));
      }
    } else if (config.platformFeeType === 'fixed') {
      platformFee = Number(config.platformFeeValue);
    }

    const stripeFee = (amount * 0.029) + 0.30; // Standard Stripe fee

    return {
      platformFee: Number(platformFee.toFixed(2)),
      stripeFee: Number(stripeFee.toFixed(2)),
      totalFees: Number((platformFee + stripeFee).toFixed(2))
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
      const affiliateProgram = await storage.getAffiliateProgramByAccountId(referralRecord.affiliateId);
      if (!affiliateProgram || affiliateProgram.status === 'inactive') return null;

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
        typeof customRateValue === 'string'
          ? parseFloat(customRateValue)
          : typeof customRateValue === 'number'
          ? customRateValue
          : undefined;

      const affiliateRate =
        typeof customRate === 'number' && customRate > 0
          ? customRate
          : defaultAffiliateRate;

      const affiliateCommissionAmount = Number((fees.platformFee * affiliateRate).toFixed(2));

      // Create commission record for the affiliate portion only
      const commission = await storage.createCommission({
        affiliateProgramId: affiliateProgram.id,
        referralId: referralRecord.id,
        transactionId: referenceId,
        revenueAmount: amount.toString(),
        commissionAmount: affiliateCommissionAmount.toString(),
        status: 'pending',
        description: `5% affiliate commission from ${paymentType} payment (with additional 5% to community vaults and 5% to trade school scholarships)`,
        createdAt: new Date(),
      });

      // Credit the affiliate's on-platform wallet balance so they can spend earnings
      try {
        if (affiliateCommissionAmount > 0) {
          await storage.creditWallet(affiliateProgram.affiliateId, affiliateCommissionAmount, {
            type: 'affiliate_commission',
            referenceType: 'payment',
            referenceId,
            memo: `Affiliate commission from ${paymentType} payment`,
          });

          // Keep affiliateAccounts lifetimeEarned/available in sync for dashboards
          await storage.incrementAffiliateEarnings(affiliateProgram.id, affiliateCommissionAmount);
        }
      } catch (walletError) {
        console.error('Error crediting affiliate wallet or earnings:', walletError);
      }

      // Award the Community Builder badge to the affiliate who drove this paid conversion.
      try {
        await grantCommunityBuilderBadge(affiliateProgram.affiliateId, 'affiliate_conversion');
      } catch (err) {
        console.error('Error granting Community Builder badge for affiliate conversion:', err);
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
        console.error('Error applying 5/5/5 impact for affiliate referral:', impactError);
      }

      return commission;
    } catch (error) {
      console.error('Error tracking affiliate commission:', error);
      return null;
    }
  }

  // Create Stripe payment intent for contractor payments
  async createContractorPaymentIntent(payment: ContractorPayment) {
    if (!this.stripe || payment.isOffPlatform) {
      throw new Error('Stripe not available or payment is off-platform');
    }

    const fees = await this.calculatePaymentFees(
      Number(payment.totalAmount), 
      'contractor_service'
    );

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(Number(payment.totalAmount) * 100), // Convert to cents
      currency: payment.currency || 'usd',
      metadata: {
        paymentId: payment.id,
        contractorId: payment.contractorId,
        homeownerId: payment.homeownerId,
        type: 'contractor_payment'
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      fees
    };
  }

  // Create Stripe payment intent for marketplace transactions  
  async createMarketplacePaymentIntent(transaction: MarketplaceTransaction) {
    if (!this.stripe || transaction.isOffPlatform) {
      throw new Error('Stripe not available or payment is off-platform');
    }

    const fees = await this.calculatePaymentFees(
      Number(transaction.totalAmount), 
      'marketplace_transaction'
    );

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(Number(transaction.totalAmount) * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        transactionId: transaction.id,
        listingId: transaction.listingId,
        buyerId: transaction.buyerId,
        sellerId: transaction.sellerId,
        type: 'marketplace_transaction'
      }
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      fees
    };
  }

  // Process off-platform payment confirmation
  async confirmOffPlatformPayment(
    paymentId: string, 
    paymentType: 'contractor' | 'marketplace',
    confirmationData: {
      method: string;
      notes: string;
      confirmedBy: string;
    }
  ) {
    if (paymentType === 'contractor') {
      const payment = await storage.updateContractorPayment(paymentId, {
        status: 'completed',
        offPlatformMethod: confirmationData.method,
        offPlatformNotes: confirmationData.notes,
        completedAt: new Date(),
      });

      try {
        if (payment?.homeownerId && payment.totalAmount) {
          await this.trackAffiliateCommission(
            payment.homeownerId,
            Number(payment.totalAmount),
            'contractor_service',
            payment.id,
          );
        }
      } catch (e) {
        console.error('Error tracking affiliate commission for contractor payment (off-platform):', e);
      }

      return payment;
    } else {
      const transaction = await storage.updateMarketplaceTransactionPayment(paymentId, {
        paymentMethod: 'off_platform_direct',
        isOffPlatform: true,
        status: 'completed',
        offPlatformMethod: confirmationData.method,
        offPlatformNotes: confirmationData.notes,
      });

      try {
        if (transaction?.buyerId && transaction.totalAmount) {
          await this.trackAffiliateCommission(
            transaction.buyerId,
            Number(transaction.totalAmount),
            'marketplace_transaction',
            transaction.id,
          );
        }
      } catch (e) {
        console.error('Error tracking affiliate commission for marketplace transaction (off-platform):', e);
      }

      return transaction;
    }
  }

  // Handle Stripe webhook events
  async handleStripeWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata;

        if (metadata.type === 'contractor_payment') {
          const payment = await storage.updateContractorPayment(metadata.paymentId, {
            status: 'completed',
            stripePaymentIntentId: paymentIntent.id,
            completedAt: new Date(),
          });

          try {
            if (payment?.homeownerId && payment.totalAmount) {
              await this.trackAffiliateCommission(
                payment.homeownerId,
                Number(payment.totalAmount),
                'contractor_service',
                payment.id,
              );
            }
          } catch (e) {
            console.error('Error tracking affiliate commission for contractor payment (Stripe):', e);
          }
        } else if (metadata.type === 'marketplace_transaction') {
          const transaction = await storage.updateMarketplaceTransactionPayment(metadata.transactionId, {
            paymentMethod: 'on_platform_stripe',
            isOffPlatform: false,
            status: 'completed',
            stripePaymentIntentId: paymentIntent.id,
          });

          // If this transaction is associated with a listing boost, activate it
          try {
            await storage.applyListingBoostForTransaction(metadata.transactionId);
          } catch (err) {
            console.error('Error applying listing boost for transaction', metadata.transactionId, err);
          }

          try {
            if (transaction?.buyerId && transaction.totalAmount) {
              await this.trackAffiliateCommission(
                transaction.buyerId,
                Number(transaction.totalAmount),
                'marketplace_transaction',
                transaction.id,
              );
            }
          } catch (e) {
            console.error('Error tracking affiliate commission for marketplace transaction (Stripe):', e);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        const failedMetadata = failedIntent.metadata;

        if (failedMetadata.type === 'contractor_payment') {
          await storage.updateContractorPayment(failedMetadata.paymentId, {
            status: 'failed'
          });
        } else if (failedMetadata.type === 'marketplace_transaction') {
          await storage.updateMarketplaceTransactionPayment(failedMetadata.transactionId, {
            paymentMethod: 'on_platform_stripe',
            isOffPlatform: false,
            status: 'failed'
          });
        }
        break;
    }
  }

  // Get payment methods available for user
  getAvailablePaymentMethods(isOffPlatformAllowed = true) {
    const methods = [
      {
        id: 'on_platform_stripe',
        name: 'Pay with Card (Secure)',
        description: 'Credit/debit card processed securely through our platform',
        fees: 'Small platform fee applies',
        recommended: true
      }
    ];

    if (isOffPlatformAllowed) {
      methods.push(
        {
          id: 'off_platform_cash',
          name: 'Cash Payment',
          description: 'Pay directly with cash',
          fees: 'No platform fees',
          recommended: false
        },
        {
          id: 'off_platform_check', 
          name: 'Check Payment',
          description: 'Pay by personal or business check',
          fees: 'No platform fees',
          recommended: false
        },
        {
          id: 'off_platform_venmo',
          name: 'Venmo/PayPal',
          description: 'Pay using Venmo, PayPal, or similar service',
          fees: 'No platform fees',
          recommended: false
        },
        {
          id: 'off_platform_bank_transfer',
          name: 'Bank Transfer',
          description: 'Direct bank-to-bank transfer',
          fees: 'No platform fees',
          recommended: false
        }
      );
    }

    return methods;
  }
}

export const paymentService = new PaymentService();