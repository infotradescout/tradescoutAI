import type { Express, Request, RequestHandler, Response } from "express";
import { JW_STONE_CART_HOLD_PATH, JwStoneCartHoldError } from "@shared/jwStoneCartHolds";
import type { JwStonePricingAccess } from "@shared/jwStoneMemberPricing";
import type { JwStonePricingSnapshot } from "../services/jwStoneDrivePricing";
import type { JwStoneCartHolds } from "../services/jwStoneCartHolds";

export type JwStoneCartHoldRouteDependencies = Readonly<{
  holds: JwStoneCartHolds;
  // Mandatory: the composition root must supply the real auth, schema, origin/CSRF and rate-limit guards.
  authenticate: RequestHandler;
  requireSchema: RequestHandler;
  requireWriteIntent: RequestHandler;
  mutationLimiter: RequestHandler;
  target: () => Promise<{ businessId: string } | null>;
  access: (req: Request) => Promise<JwStonePricingAccess>;
  pricing: () => Promise<JwStonePricingSnapshot>;
}>;
const buyerId = (req: Request) => {
  const user = req.user as { id?: string; claims?: { sub?: string } } | undefined;
  return String(user?.id || user?.claims?.sub || "").trim();
};
function errorResponse(res: Response, error: unknown) {
  if (error instanceof JwStoneCartHoldError) {
    res.status(error.status).json({ code: error.code, message: error.message });
  } else {
    console.error("[jw-stone-cart-holds] request failed", { name: error instanceof Error ? error.name : "UnknownError" });
    res.status(503).json({ code: "hold_unavailable", message: "Reservations are temporarily unavailable. Your cart is unchanged." });
  }
}

/** Deliberately not mounted until canonical schema, expiry worker and browser integration are release-verified. */
export function registerJwStoneCartHoldRoutes(app: Express, deps: JwStoneCartHoldRouteDependencies): void {
  const root = JW_STONE_CART_HOLD_PATH;
  app.use(root, (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store"); res.vary("Cookie"); res.vary("Authorization"); next();
  }, deps.authenticate, deps.requireSchema);
  app.post(root, deps.requireWriteIntent, deps.mutationLimiter, async (req, res) => {
    try {
      const buyerUserId = buyerId(req);
      if (!buyerUserId) { res.status(401).json({ message: "Authentication required" }); return; }
      if (await deps.access(req) !== "member") throw new JwStoneCartHoldError(403, "jw_membership_required", "An active JW Stone business membership is required.");
      const target = await deps.target();
      if (!target) throw new JwStoneCartHoldError(503, "hold_unavailable", "JW Stone inventory is temporarily unavailable.");
      const receipt = await deps.holds.reserve({ buyerUserId, sellerBusinessId: target.businessId, request: req.body, snapshot: await deps.pricing() });
      res.status(200).json(receipt);
    } catch (error) { errorResponse(res, error); }
  });
  app.get(`${root}/:reservationId`, async (req, res) => {
    try {
      const buyerUserId = buyerId(req);
      if (!buyerUserId) { res.status(401).json({ message: "Authentication required" }); return; }
      if (await deps.access(req) !== "member") throw new JwStoneCartHoldError(403, "jw_membership_required", "An active JW Stone business membership is required.");
      const target = await deps.target();
      if (!target) throw new JwStoneCartHoldError(503, "hold_unavailable", "JW Stone inventory is temporarily unavailable.");
      res.json(await deps.holds.get({ buyerUserId, sellerBusinessId: target.businessId, reservationId: req.params.reservationId }));
    } catch (error) { errorResponse(res, error); }
  });
  app.post(`${root}/:reservationId/release`, deps.requireWriteIntent, deps.mutationLimiter, async (req, res) => {
    try {
      const buyerUserId = buyerId(req);
      if (!buyerUserId) { res.status(401).json({ message: "Authentication required" }); return; }
      if (req.body && (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length)) {
        throw new JwStoneCartHoldError(400, "invalid_release", "Release does not accept replacement stock or quantities.");
      }
      const target = await deps.target();
      if (!target) throw new JwStoneCartHoldError(503, "hold_unavailable", "JW Stone inventory is temporarily unavailable.");
      // No member-price response here: the original owner can give stock back after revocation.
      res.json(await deps.holds.release({ buyerUserId, sellerBusinessId: target.businessId, reservationId: req.params.reservationId }));
    } catch (error) { errorResponse(res, error); }
  });
}
