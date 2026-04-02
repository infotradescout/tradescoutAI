import type { Request, Response } from "express";
import { storage } from "../storage";

function normalizeCountyFipsInput(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => /^\d{5}$/.test(entry));
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter((entry) => /^\d{5}$/.test(entry));
  }
  return [];
}

function normalizeAudienceScope(value: unknown): "global" | "county" {
  return String(value || "")
    .trim()
    .toLowerCase() === "global"
    ? "global"
    : "county";
}

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
    const audienceScope = normalizeAudienceScope(body.audienceScope);
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
    body.countyFips = normalizeCountyFipsInput(body.countyFips);
    if (audienceScope === "global") {
      body.countyFips = [];
    }

    delete body.audienceScope;

    if (type === "trade_deal" && audienceScope !== "global") {
      if (!Array.isArray(body.countyFips) || body.countyFips.length === 0) {
        return res
          .status(400)
          .json({ message: "county_fips is required for county-scoped TradeDeals" });
      }
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
      if (
        audienceScope !== "global" &&
        (!Array.isArray(body.countyFips) || body.countyFips.length === 0)
      ) {
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
    const body = { ...(req.body ?? {}) } as Record<string, any>;
    const existing = await storage.getPromotion(id);
    if (!existing) {
      return res.status(404).json({ message: "Promotion not found" });
    }

    if (typeof body.countyFips !== "undefined") {
      body.countyFips = normalizeCountyFipsInput(body.countyFips);
    }
    const audienceScope =
      typeof body.audienceScope !== "undefined"
        ? normalizeAudienceScope(body.audienceScope)
        : existing.countyFips.length === 0
          ? "global"
          : "county";
    if (audienceScope === "global") {
      body.countyFips = [];
    }
    delete body.audienceScope;

    // Enforce tier placement rules: free_directory cannot enable any placements
    const tier = body.tier ?? "free_directory";
    if (tier === "free_directory") {
      body.placementCommunitySnapshot = false;
      body.placementCommunityFeed = false;
      body.placementScout = false;
      body.placementMarketplace = false;
    }

    const effectiveType = String(body.type || existing.type || "").trim();
    const effectiveExclusive =
      typeof body.exclusive === "boolean" ? body.exclusive : existing.exclusive === true;
    const effectivePlacementSnapshot =
      typeof body.placementCommunitySnapshot === "boolean"
        ? body.placementCommunitySnapshot
        : existing.placementCommunitySnapshot === true;
    const effectiveCountyFips = Array.isArray(body.countyFips)
      ? body.countyFips
      : Array.isArray(existing.countyFips)
        ? existing.countyFips
        : [];

    if (
      effectiveType === "trade_deal" &&
      audienceScope !== "global" &&
      effectiveCountyFips.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "county_fips is required for county-scoped TradeDeals" });
    }

    if (effectiveType === "trade_deal" && effectivePlacementSnapshot) {
      if (audienceScope !== "global" && effectiveCountyFips.length === 0) {
        return res.status(400).json({ message: "county_fips is required for snapshot TradeDeals" });
      }
      if (effectiveExclusive !== true) {
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
