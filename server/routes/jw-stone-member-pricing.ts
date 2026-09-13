import type { Express, Request, Response } from "express";
import { registerJwStoneReceivingRoutes } from "./jw-stone-receiving";
import type { JwStoneInternalPricingResponse, JwStoneMemberPricingResponse, JwStonePricingAccess } from "@shared/jwStoneMemberPricing";
import { JW_STONE_PRICING_PROFILE_SLUG } from "@shared/jwStoneMemberPricing";
import { parseJwStoneCartRequest, JwStoneCartInputError } from "@shared/jwStoneCart";
import { isAuthenticated } from "../auth";
import { requireCriticalSchema } from "../schemaPreflight";
import { getJwStonePricingSnapshot, type JwStonePricingSnapshot } from "../services/jwStoneDrivePricing";
import { resolveJwStonePricingAccess } from "../services/jwStonePricingAccess";
import { getJwStoneCartReview } from "../services/jwStoneCartService";

function requestUserId(req: Request): string {
  const user = req.user as { id?: unknown; claims?: { sub?: unknown } } | undefined;
  return String(user?.id || user?.claims?.sub || "").trim();
}
function privateResponse(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Cookie"); res.vary("Authorization");
}
export function projectJwStonePricingResponse(args: { snapshot: JwStonePricingSnapshot; access: JwStonePricingAccess; viewerId: string }): JwStoneMemberPricingResponse | JwStoneInternalPricingResponse {
  const base = { profileSlug: JW_STONE_PRICING_PROFILE_SLUG, viewerId: args.viewerId, currency: "USD" as const, unit: "square_foot" as const, sourceUpdatedAt: args.snapshot.sourceUpdatedAt };
  const prices = args.snapshot.prices.map(price => Object.freeze({ stoneName: price.stoneName, stoneKey: price.stoneKey, slabPriceCents: price.slabPriceCents, bundlePriceCents: price.bundlePriceCents, ...(price.bundleMinSlabs == null ? {} : { bundleMinSlabs: price.bundleMinSlabs }) }));
  if (args.access === "internal") return Object.freeze({ ...base, access: "internal", prices: Object.freeze(prices.map((price, index) => Object.freeze({ ...price, landedCostCents: args.snapshot.prices[index].landedCostCents }))) });
  return Object.freeze({ ...base, access: "member", prices: Object.freeze(prices) });
}
export function registerJwStoneMemberPricingRoutes(app: Express): void {
  registerJwStoneReceivingRoutes(app);
  const base = "/api/u/jw-stone/member-pricing";
  app.use(base, requireCriticalSchema("profile_accounts"));
  app.get(base, isAuthenticated, async (req: Request, res: Response): Promise<void> => {
    privateResponse(res);
    try {
      const viewerId = requestUserId(req);
      if (!viewerId) { res.status(401).json({ message: "Authentication required" }); return; }
      const access = await resolveJwStonePricingAccess({ userId: viewerId, user: req.user });
      if (access === "none") { res.status(403).json({ message: "An active JW Stone business membership is required to view pricing." }); return; }
      const snapshot = await getJwStonePricingSnapshot();
      res.status(200).json(projectJwStonePricingResponse({ snapshot, access, viewerId }));
    } catch (error) {
      console.error("[jw-stone-member-pricing] private price source unavailable", { message: error instanceof Error ? error.message : "Unknown pricing source error" });
      res.status(503).json({ message: "JW Stone member pricing is temporarily unavailable." });
    }
  });
  // Cart permission must not depend on a separate catalog workbook being online.
  app.get(`${base}/cart-access`, isAuthenticated, async (req: Request, res: Response): Promise<void> => {
    privateResponse(res);
    try {
      const viewerId = requestUserId(req);
      if (!viewerId) { res.status(401).json({ message: "Authentication required" }); return; }
      const access = await resolveJwStonePricingAccess({ userId: viewerId, user: req.user });
      res.json({ viewerId, allowed: access === "member" });
    } catch { res.status(503).json({ message: "JW Stone cart access is temporarily unavailable." }); }
  });
  app.post(`${base}/cart-review`, isAuthenticated, requireCriticalSchema("stone_inventory"), async (req: Request, res: Response): Promise<void> => {
    privateResponse(res);
    try {
      const viewerId = requestUserId(req);
      if (!viewerId) { res.status(401).json({ message: "Authentication required" }); return; }
      const access = await resolveJwStonePricingAccess({ userId: viewerId, user: req.user });
      if (access !== "member") { res.status(403).json({ message: "An active JW Stone business membership is required to review an order." }); return; }
      const lines = parseJwStoneCartRequest(req.body);
      res.json(await getJwStoneCartReview(viewerId, lines));
    } catch (error) {
      if (error instanceof JwStoneCartInputError) { res.status(400).json({ message: error.message }); return; }
      console.error("[jw-stone-member-pricing] cart review unavailable", { message: error instanceof Error ? error.message : "Unknown cart review error" });
      res.status(503).json({ message: "JW Stone order review is temporarily unavailable." });
    }
  });
}
