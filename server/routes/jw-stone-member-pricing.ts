import type { Express, Request, Response } from "express";
import type {
  JwStoneInternalPricingResponse,
  JwStoneMemberPricingResponse,
  JwStonePricingAccess,
} from "@shared/jwStoneMemberPricing";
import { JW_STONE_PRICING_PROFILE_SLUG, jwStonePriceKey } from "@shared/jwStoneMemberPricing";
import { combineJwStoneCartLines, jwStoneCartReviewRequestSchema } from "@shared/jwStoneCart";
import { isAuthenticated } from "../auth";
import { requireCriticalSchema } from "../schemaPreflight";
import { getJwStonePricingSnapshot, type JwStonePricingSnapshot } from "../services/jwStoneDrivePricing";
import { resolveJwStonePricingAccess } from "../services/jwStonePricingAccess";
import { getStoneInventoryProfileTarget, listSellerStoneInventory } from "../services/stoneInventoryService";

function requestUserId(req: Request): string {
  const user = req.user as { id?: unknown; claims?: { sub?: unknown } } | undefined;
  return String(user?.id || user?.claims?.sub || "").trim();
}

function centsForSlabFace(
  rateCents: number,
  dimensions: { length?: number | null; height?: number | null; unit?: "in" | "mm" | null } | null
): number | null {
  if (!dimensions || !Number.isSafeInteger(rateCents) || rateCents <= 0) return null;
  const length = Number(dimensions.length);
  const height = Number(dimensions.height);
  if (!Number.isFinite(length) || !Number.isFinite(height) || length <= 0 || height <= 0) return null;
  const inchesPerUnit = dimensions.unit === "mm" ? 1 / 25.4 : dimensions.unit === "in" ? 1 : null;
  if (!inchesPerUnit) return null;
  const total = Math.round((length * inchesPerUnit * height * inchesPerUnit * rateCents) / 144);
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

export function projectJwStonePricingResponse(args: {
  snapshot: JwStonePricingSnapshot;
  access: JwStonePricingAccess;
  viewerId: string;
}): JwStoneMemberPricingResponse | JwStoneInternalPricingResponse {
  const base = {
    profileSlug: JW_STONE_PRICING_PROFILE_SLUG,
    viewerId: args.viewerId,
    currency: "USD" as const,
    unit: "square_foot" as const,
    sourceUpdatedAt: args.snapshot.sourceUpdatedAt,
  };
  if (args.access === "internal") {
    return Object.freeze({ ...base, access: "internal" as const,
      prices: Object.freeze(args.snapshot.prices.map((price) => Object.freeze({
        stoneName: price.stoneName, stoneKey: price.stoneKey,
        slabPriceCents: price.slabPriceCents, bundlePriceCents: price.bundlePriceCents,
        ...(price.bundleMinSlabs == null ? {} : { bundleMinSlabs: price.bundleMinSlabs }),
        landedCostCents: price.landedCostCents,
      }))),
    });
  }
  return Object.freeze({ ...base, access: "member" as const,
    prices: Object.freeze(args.snapshot.prices.map((price) => Object.freeze({
      stoneName: price.stoneName, stoneKey: price.stoneKey,
      slabPriceCents: price.slabPriceCents, bundlePriceCents: price.bundlePriceCents,
      ...(price.bundleMinSlabs == null ? {} : { bundleMinSlabs: price.bundleMinSlabs }),
    }))),
  });
}

function privateResponse(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Cookie");
  res.vary("Authorization");
}

export function registerJwStoneMemberPricingRoutes(app: Express): void {
  app.use("/api/u/jw-stone/member-pricing", requireCriticalSchema("profile_accounts"));
  app.get("/api/u/jw-stone/member-pricing", isAuthenticated, async (req: Request, res: Response): Promise<void> => {
    privateResponse(res);
    try {
      const viewerId = requestUserId(req);
      if (!viewerId) { res.status(401).json({ message: "Authentication required" }); return; }
      const access = await resolveJwStonePricingAccess({ userId: viewerId, user: req.user });
      if (access === "none") {
        res.status(403).json({ message: "An active JW Stone business membership is required to view pricing." });
        return;
      }
      const snapshot = await getJwStonePricingSnapshot();
      res.status(200).json(projectJwStonePricingResponse({ snapshot, access, viewerId }));
    } catch (error) {
      console.error("[jw-stone-member-pricing] private price source unavailable", {
        message: error instanceof Error ? error.message : "Unknown pricing source error",
      });
      res.status(503).json({ message: "JW Stone member pricing is temporarily unavailable." });
    }
  });

  app.post("/api/u/jw-stone/member-pricing/cart-review", isAuthenticated,
    requireCriticalSchema("stone_inventory"), async (req: Request, res: Response): Promise<void> => {
      privateResponse(res);
      try {
        const viewerId = requestUserId(req);
        if (!viewerId) { res.status(401).json({ message: "Authentication required" }); return; }
        const access = await resolveJwStonePricingAccess({ userId: viewerId, user: req.user });
        if (access !== "member") {
          res.status(403).json({ message: "An active JW Stone business membership is required to review an order." });
          return;
        }
        const parsed = jwStoneCartReviewRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid cart" });
          return;
        }
        const target = await getStoneInventoryProfileTarget("jw-stone");
        if (!target) { res.status(503).json({ message: "JW Stone inventory is temporarily unavailable." }); return; }
        const [inventory, snapshot] = await Promise.all([
          listSellerStoneInventory(target),
          getJwStonePricingSnapshot({ forceRefresh: true }),
        ]);
        const inventoryByPublicId = new Map(inventory.map((item) => [item.id, item]));
        const priceByStoneKey = new Map(snapshot.prices.map((price) => [price.stoneKey, price]));
        let subtotalCents = 0;
        const lines = combineJwStoneCartLines(parsed.data.lines).map((requested) => {
          const base = { inventoryPublicId: requested.inventoryPublicId, requestedQuantity: requested.quantity };
          const item = inventoryByPublicId.get(requested.inventoryPublicId);
          if (!item || !item.isSaleReady) return { ...base, status: "unavailable" as const };
          const availableQuantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
          const known = { ...base, availableQuantity, materialName: item.materialName };
          // A container, block, or a count expressed in bundles is not a count of slabs.
          if ((item.assetKind !== "slab" && item.assetKind !== "bundle") ||
              !/^slabs?$/i.test(item.unit.trim()) || !Number.isSafeInteger(Number(item.quantity))) {
            return { ...known, status: "slab_quantity_required" as const };
          }
          if (requested.quantity > availableQuantity) return { ...known, status: "insufficient_quantity" as const };
          const price = priceByStoneKey.get(jwStonePriceKey(item.materialName));
          if (!price) return { ...known, status: "price_unavailable" as const };
          const useBundleRate = price.bundleMinSlabs != null && requested.quantity >= price.bundleMinSlabs;
          const unitRateCents = useBundleRate ? price.bundlePriceCents : price.slabPriceCents;
          const oneSlabTotalCents = centsForSlabFace(unitRateCents, item.dimensions);
          if (oneSlabTotalCents == null) return { ...known, status: "dimensions_required" as const };
          const lineTotalCents = oneSlabTotalCents * requested.quantity;
          if (!Number.isSafeInteger(lineTotalCents) || !Number.isSafeInteger(subtotalCents + lineTotalCents)) {
            throw new Error("Cart amount exceeds supported precision");
          }
          subtotalCents += lineTotalCents;
          return { ...known, materialSlug: item.materialSlug, assetKind: item.assetKind,
            dimensions: item.dimensions, pricingTier: useBundleRate ? ("bundle" as const) : ("slab" as const),
            unitRateCents, oneSlabTotalCents, lineTotalCents, status: "ready" as const };
        });
        const materialReady = lines.every((line) => line.status === "ready");
        res.status(200).json({
          profileSlug: "jw-stone", viewerId, currency: "USD", sourceUpdatedAt: snapshot.sourceUpdatedAt,
          reviewedAt: new Date().toISOString(), materialReady,
          // This read-only review neither holds stock nor enables a payment/order path.
          readyForCheckout: false, inventoryReserved: false,
          subtotalCents: materialReady ? subtotalCents : null, lines,
          fulfillment: parsed.data.fulfillment || { method: "pickup" },
          deliveryFeeCents: null, estimatedDeliveryDate: null,
        });
      } catch (error) {
        console.error("[jw-stone-member-pricing] cart review unavailable", {
          message: error instanceof Error ? error.message : "Unknown cart review error",
        });
        res.status(503).json({ message: "JW Stone order review is temporarily unavailable." });
      }
    });
}
