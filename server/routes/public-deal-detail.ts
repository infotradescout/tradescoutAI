import type { Request, Response } from "express";
import { storage } from "../storage";
import { isEligibleScoutDeal, toScoutDealPublicView } from "../scout/scoutDealDiscovery";

const PROMOTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTY_FIPS = /^\d{5}$/;

export async function getPublicScoutDealDetail(req: Request, res: Response): Promise<Response> {
  res.set("Cache-Control", "no-store");

  const id = String(req.params.id || "");
  const rawCounty = req.query.county;
  if (
    !PROMOTION_ID.test(id) ||
    (rawCounty !== undefined && (typeof rawCounty !== "string" || !COUNTY_FIPS.test(rawCounty)))
  ) {
    return res.status(404).json({ message: "TradeDeal unavailable" });
  }

  try {
    const promotion = await storage.getPromotion(id);
    if (!promotion || !isEligibleScoutDeal(promotion, rawCounty)) {
      return res.status(404).json({ message: "TradeDeal unavailable" });
    }

    return res.json({ deal: toScoutDealPublicView(promotion) });
  } catch (error) {
    console.error("[TradeDeals] Public deal detail unavailable", error);
    return res.status(503).json({ message: "TradeDeal temporarily unavailable" });
  }
}
