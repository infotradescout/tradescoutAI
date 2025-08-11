import Stripe from 'stripe';
import { storage } from './storage';
import { 
  type ContractorPayment, 
  type MarketplaceTransaction,
  type PaymentConfiguration,
  contractorPayments,
  marketplaceTransactions,
  paymentConfigurations
} from '@shared/schema';

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

  // Calculate fees based on payment configuration
  async calculatePaymentFees(amount: number, paymentType: string) {
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
    paymentType: string,
    referenceId: string
  ) {
    try {
      // Check if user was referred by looking for referrals where this user is the referred user
      const referralRecord = await storage.getReferralByReferredUserId(userId);
      if (!referralRecord) return null;

      const affiliateProgram = await storage.getAffiliateProgram(referralRecord.affiliateProgramId);
      if (!affiliateProgram || !affiliateProgram.isActive) return null;

      // Calculate commission (25% of platform fees)
      const fees = await this.calculatePaymentFees(amount, paymentType);
      const commissionRate = 0.25; // 25%
      const commissionAmount = fees.platformFee * commissionRate;

      // Create commission record
      const commission = await storage.createCommission({
        affiliateProgramId: affiliateProgram.id,
        referralId: referralRecord.id,
        revenueSource: paymentType,
        sourceTransactionId: referenceId,
        originalAmount: amount.toString(),
        commissionRate: commissionRate.toString(),
        commissionAmount: commissionAmount.toString(),
        status: 'pending',
        description: `Commission from ${paymentType} payment`,
        createdAt: new Date(),
        updatedAt: new Date()
      });

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
      return await storage.updateContractorPayment(paymentId, {
        status: 'completed',
        offPlatformMethod: confirmationData.method,
        offPlatformNotes: confirmationData.notes,
        completedAt: new Date()
      });
    } else {
      return await storage.updateMarketplaceTransactionPayment(paymentId, {
        paymentMethod: 'off_platform_direct',
        isOffPlatform: true,
        status: 'completed',
        offPlatformMethod: confirmationData.method,
        offPlatformNotes: confirmationData.notes
      });
    }
  }

  // Handle Stripe webhook events
  async handleStripeWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata;
        
        if (metadata.type === 'contractor_payment') {
          await storage.updateContractorPayment(metadata.paymentId, {
            status: 'completed',
            stripePaymentIntentId: paymentIntent.id,
            completedAt: new Date()
          });
        } else if (metadata.type === 'marketplace_transaction') {
          await storage.updateMarketplaceTransactionPayment(metadata.transactionId, {
            paymentMethod: 'on_platform_stripe',
            isOffPlatform: false,
            status: 'completed',
            stripePaymentIntentId: paymentIntent.id
          });
        }
        break;

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