import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// Back-compat endpoint that persists marketplace transactions.
router.post("/create", async (req: any, res) => {
  try {
    const buyerId = req.user?.id || req.user?.claims?.sub || req.body?.buyerId;
    const { listingId, sellerId, amount, paymentMethod } = req.body || {};

    if (!buyerId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!listingId || !sellerId || amount == null) {
      return res.status(400).json({ message: "listingId, sellerId, and amount are required" });
    }

    const normalizedMethod =
      typeof paymentMethod === "string" && paymentMethod.trim()
        ? paymentMethod
        : "off_platform_other";

    const tx = await storage.createMarketplaceTransaction({
      listingId: String(listingId),
      buyerId: String(buyerId),
      sellerId: String(sellerId),
      totalAmount: String(amount),
      sellerAmount: String(amount),
      paymentMethod: normalizedMethod as any,
      status: "pending",
    });

    return res.status(201).json(tx);
  } catch (error: any) {
    console.error("Error creating transaction:", error);
    return res.status(500).json({ message: "Failed to create transaction" });
  }
});

export default router;
