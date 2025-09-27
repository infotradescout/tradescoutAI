
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { transactions, escrow } from '../../shared/schema';
import { stripe } from '../payment-service';

const router = Router();

const createTransactionSchema = z.object({
  listingId: z.string().uuid(),
  buyerId: z.string().uuid(),
  amount: z.number().min(1),
  paymentMethod: z.enum(['stripe', 'external'])
});

router.post('/create', async (req, res) => {
  try {
    const { listingId, buyerId, amount, paymentMethod } = createTransactionSchema.parse(req.body);
    
    if (paymentMethod === 'stripe') {
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          listingId,
          buyerId
        }
      });
      
      // Store in escrow
      const [transaction] = await db.insert(transactions).values({
        listingId,
        buyerId,
        amount,
        status: 'pending',
        stripePaymentIntentId: paymentIntent.id
      }).returning();
      
      res.json({ 
        transactionId: transaction.id,
        clientSecret: paymentIntent.client_secret 
      });
    } else {
      // External payment - create transaction record
      const [transaction] = await db.insert(transactions).values({
        listingId,
        buyerId,
        amount,
        status: 'external_pending'
      }).returning();
      
      res.json({ transactionId: transaction.id });
    }
  } catch (error) {
    console.error('Transaction creation failed:', error);
    res.status(500).json({ error: 'Transaction creation failed' });
  }
});

export default router;
