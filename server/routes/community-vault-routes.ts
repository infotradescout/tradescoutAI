import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { getStripeClient } from "../services/stripeClient";

const router = Router();

const createCheckoutSchema = z.object({
  profileId: z.string().min(1),
  amount: z.union([z.number(), z.string()]),
  causeId: z.string().min(1).optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

router.get("/profile/:profileId/vault", async (req: Request, res: Response) => {
  try {
    const profileId = String(req.params.profileId);
    const snapshot = await storage.getCommunityVaultSnapshot({ profileId, limit: 0 });

    return res.json({
      profile: snapshot.profile,
      vault: snapshot.vault
        ? {
            ...snapshot.vault,
            currentBalance: Number(snapshot.vault.currentBalance ?? 0),
            lifetimeInflow: Number(snapshot.vault.lifetimeInflow ?? 0),
            lifetimeOutflow: Number(snapshot.vault.lifetimeOutflow ?? 0),
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching community vault:", error);
    res.status(500).json({ error: "Failed to fetch community vault" });
  }
});

router.get("/profile/:profileId/ledger", async (req: Request, res: Response) => {
  try {
    const profileId = String(req.params.profileId);
    const limit = req.query.limit ? Math.max(1, Math.min(200, Number(req.query.limit))) : 50;

    const snapshot = await storage.getCommunityVaultSnapshot({ profileId, limit });
    if (!snapshot.profile) return res.status(404).json({ error: "Profile not found" });

    return res.json({
      profile: snapshot.profile,
      vault: snapshot.vault
        ? {
            ...snapshot.vault,
            currentBalance: Number(snapshot.vault.currentBalance ?? 0),
            lifetimeInflow: Number(snapshot.vault.lifetimeInflow ?? 0),
            lifetimeOutflow: Number(snapshot.vault.lifetimeOutflow ?? 0),
          }
        : null,
      ledger: (snapshot.ledger ?? []).map((e) => ({
        ...e,
        amount: Number((e as any).amount ?? 0),
      })),
    });
  } catch (error) {
    console.error("Error fetching community vault ledger:", error);
    res.status(500).json({ error: "Failed to fetch community vault ledger" });
  }
});

// Donate directly into a community vault (real money in; no withdrawals/payouts)
router.post("/checkout-session", async (req: Request, res: Response) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) return res.status(400).json({ error: "Stripe not configured" });

    const parsed = createCheckoutSchema.parse(req.body);
    const amountNum = typeof parsed.amount === "string" ? Number(parsed.amount) : parsed.amount;

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    // Ensure profile exists (also initializes vault)
    const snapshot = await storage.getCommunityVaultSnapshot({
      profileId: parsed.profileId,
      limit: 0,
    });
    if (!snapshot.profile) return res.status(404).json({ error: "Profile not found" });

    const metadata: Record<string, string> = {
      type: "community_vault_donation",
      profileId: parsed.profileId,
      amount: amountNum.toFixed(2),
    };

    if (parsed.causeId) metadata.causeId = parsed.causeId;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: parsed.successUrl,
      cancel_url: parsed.cancelUrl,
      currency: "usd",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Donate to ${snapshot.profile.displayName} vault`,
              description: "Community vault donation (no withdrawals/payouts during beta)",
            },
            unit_amount: Math.round(amountNum * 100),
          },
          quantity: 1,
        },
      ],
      metadata,
    });

    res.json({ url: session.url, id: session.id });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("Error creating community vault checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;
