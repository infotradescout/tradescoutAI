import type { Request, Response } from "express";
import { storage } from "../storage";

// List promotions for admin
export async function listPromotionsHandler(req: Request, res: Response) {
  try {
    const { status, countyFips, tier, limit } = req.query as any;
    const rows = await storage.listPromotions({
      status: status as string | undefined,
      countyFips: countyFips as string | undefined,
      tier: tier as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(rows);
  } catch (error) {
    console.error("Error listing promotions:", error);
    res.status(500).json({ message: "Failed to list promotions" });
  }
}

// Create promotion
export async function createPromotionHandler(req: Request, res: Response) {
  try {
    const body = { ...(req.body ?? {}) } as Record<string, any>;
    const type = String(body.type || "").trim();
    if (!type) {
      return res.status(400).json({ message: "type is required" });
    }
    if (!String(body.title || "").trim()) {
      return res.status(400).json({ message: "title is required" });
    }
    if (!String(body.shortDescription || "").trim()) {
      return res.status(400).json({ message: "shortDescription is required" });
    }
    body.title = String(body.title || "").trim();
    body.shortDescription = String(body.shortDescription || "").trim();
    if (typeof body.ctaLabel === "string") body.ctaLabel = body.ctaLabel.trim();
    if (typeof body.ctaUrl === "string") body.ctaUrl = body.ctaUrl.trim();

    if (typeof body.countyFips === "string") {
      body.countyFips = body.countyFips
        .split(",")
        .map((value: string) => value.trim())
        .filter(Boolean);
    }
    if (Array.isArray(body.countyFips)) {
      body.countyFips = body.countyFips
        .map((value: unknown) => String(value || "").trim())
        .filter((value: string) => /^\d{5}$/.test(value));
    }

    // Enforce tier placement rules: free_directory cannot enable any placements
    const tier =
      body.tier === "free_directory" || body.tier === "paid_campaign"
        ? body.tier
        : type === "trade_deal"
          ? "paid_campaign"
          : "free_directory";
    body.tier = tier;
    if (tier === "free_directory") {
      body.placementCommunitySnapshot = false;
      body.placementCommunityFeed = false;
      body.placementScout = false;
      body.placementMarketplace = false;
    }

    // Enforce required snapshot constraints server-side
    if (type === "trade_deal" && body.placementCommunitySnapshot) {
      if (!Array.isArray(body.countyFips) || body.countyFips.length === 0) {
        return res.status(400).json({ message: "county_fips is required for snapshot TradeDeals" });
      }
      if (body.exclusive !== true) {
        return res
          .status(400)
          .json({ message: "exclusive=true is required for snapshot TradeDeals" });
      }
    }

    const created = await storage.createPromotion(body as any);
    res.status(201).json(created);
  } catch (error: any) {
    console.error("Error creating promotion:", error);
    const dbMessage =
      typeof error?.message === "string" && error.message.trim().length > 0
        ? error.message
        : undefined;
    res.status(500).json({ message: dbMessage || "Failed to create promotion" });
  }
}

// Update promotion
export async function updatePromotionHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const body = req.body ?? {};

    // Enforce tier placement rules: free_directory cannot enable any placements
    const tier = body.tier ?? "free_directory";
    if (tier === "free_directory") {
      body.placementCommunitySnapshot = false;
      body.placementCommunityFeed = false;
      body.placementScout = false;
      body.placementMarketplace = false;
    }

    if (body.type === "trade_deal" && body.placementCommunitySnapshot) {
      if (!Array.isArray(body.countyFips) || body.countyFips.length === 0) {
        return res.status(400).json({ message: "county_fips is required for snapshot TradeDeals" });
      }
      if (body.exclusive !== true) {
        return res
          .status(400)
          .json({ message: "exclusive=true is required for snapshot TradeDeals" });
      }
    }

    const updated = await storage.updatePromotion(id, body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating promotion:", error);
    res.status(500).json({ message: "Failed to update promotion" });
  }
}

// Delete promotion
export async function deletePromotionHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await storage.deletePromotion(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting promotion:", error);
    res.status(500).json({ message: "Failed to delete promotion" });
  }
}
