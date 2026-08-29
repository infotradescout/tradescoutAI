import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { getStripeClient } from "../services/stripeClient";

const router = Router();

const checkoutSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  mode: z.enum(["one_time", "subscription"]),
  originatingProfileId: z.string().min(1).optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

router.get("/ledger", async (req: Request, res: Response) => {
  try {
    const originatingProfileId =
      typeof req.query.originatingProfileId === "string"
        ? req.query.originatingProfileId
        : undefined;
    const limit = req.query.limit ? Math.max(1, Math.min(200, Number(req.query.limit))) : 100;

    const entries = await storage.getPlatformSupportLedgerEntries({ originatingProfileId, limit });
    res.json(entries.map((e) => ({ ...e, amount: Number((e as any).amount ?? 0) })));
  } catch (error) {
    console.error("Error fetching platform support ledger:", error);
    res.status(500).json({ error: "Failed to fetch platform support ledger" });
  }
});

router.post("/checkout-session", async (req: Request, res: Response) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) return res.status(400).json({ error: "Stripe not configured" });

    const parsed = checkoutSchema.parse(req.body);
    const amountNum = typeof parsed.amount === "string" ? Number(parsed.amount) : parsed.amount;

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    const metadata: Record<string, string> = {
      type: "platform_support",
      mode: parsed.mode,
      amount: amountNum.toFixed(2),
    };

    if (parsed.originatingProfileId) metadata.originatingProfileId = parsed.originatingProfileId;

    const isSubscription = parsed.mode === "subscription";

    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      success_url: parsed.successUrl,
      cancel_url: parsed.cancelUrl,
      currency: "usd",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: isSubscription ? "Platform Support (Monthly)" : "Platform Support (One-time)",
              description: parsed.originatingProfileId
                ? "Support the platform + split 50/50 back to the originating community vault"
                : "Support the platform",
            },
            unit_amount: Math.round(amountNum * 100),
            ...(isSubscription
              ? {
                  recurring: {
                    interval: "month",
                  },
                }
              : {}),
          },
          quantity: 1,
        },
      ],
      metadata,
      ...(isSubscription
        ? {
            subscription_data: {
              metadata,
            },
          }
        : {}),
    });

    res.json({ url: session.url, id: session.id });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Error creating platform support checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;
