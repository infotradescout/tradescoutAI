import type { Express, Request, Response } from "express";
import { z } from "zod";
import type {
  JwStoneInternalPricingResponse,
  JwStoneMemberPricingResponse,
  JwStonePricingAccess,
} from "@shared/jwStoneMemberPricing";
import {
  JW_STONE_PRICING_PROFILE_SLUG,
  jwStonePriceKey,
} from "@shared/jwStoneMemberPricing";
import { isAuthenticated } from "../auth";
import { requireCriticalSchema } from "../schemaPreflight";
import {
  getJwStonePricingSnapshot,
  type JwStonePricingSnapshot,
} from "../services/jwStoneDrivePricing";
import { resolveJwStonePricingAccess } from "../services/jwStonePricingAccess";
import {
  getStoneInventoryProfileTarget,
  listSellerStoneInventory,
} from "../services/stoneInventoryService";
import { reserveJwStoneMemberCart } from "../services/jwStoneBidRockReservation";

const cartLineSchema = z
  .object({
    inventoryPublicId: z.string().regex(/^stone_[a-f0-9]{32}$/),
    quantity: z.number().int().min(1).max(999),
  })
  .strict();

const cartReviewSchema = z
  .object({
    lines: z.array(cartLineSchema).min(1).max(50),
  })
  .strict();

const fulfillmentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("pickup") }).strict(),
  z
    .object({
      method: z.literal("delivery"),
      postalCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/),
      destinationType: z.enum(["business", "jobsite"]),
    })
    .strict(),
]);

const cartReservationSchema = z
  .object({
    lines: z.array(cartLineSchema).min(1).max(20),
    fulfillment: fulfillmentSchema,
    reservationKey: z.string().trim().min(8).max(120),
  })
  .strict();

function requestUserId(req: Request): string {
  const user = req.user as { id?: unknown; claims?: { sub?: unknown } } | undefined;
  return String(user?.id || user?.claims?.sub || "").trim();
}

function centsForSlabFace(
  rateCents: number,
  dimensions: { length?: number | null; height?: number | null; unit?: "in" | "mm" | null } | null
): number | null {
  if (!dimensions) return null;
  const length = Number(dimensions.length);
  const height = Number(dimensions.height);
  if (!Number.isFinite(length) || !Number.isFinite(height) || length <= 0 || height <= 0) {
    return null;
  }
  const inchesPerUnit = dimensions.unit === "mm" ? 1 / 25.4 : dimensions.unit === "in" ? 1 : null;
  if (!inchesPerUnit) return null;
  const squareFeet = (length * inchesPerUnit * height * inchesPerUnit) / 144;
  const total = Math.round(squareFeet * rateCents);
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
    return Object.freeze({
      ...base,
      access: "internal" as const,
      prices: Object.freeze(
        args.snapshot.prices.map((price) =>
          Object.freeze({
            stoneName: price.stoneName,
            stoneKey: price.stoneKey,
            slabPriceCents: price.slabPriceCents,
            bundlePriceCents: price.bundlePriceCents,
            ...(price.bundleMinSlabs == null ? {} : { bundleMinSlabs: price.bundleMinSlabs }),
            landedCostCents: price.landedCostCents,
          })
        )
      ),
    });
  }

  return Object.freeze({
    ...base,
    access: "member" as const,
    prices: Object.freeze(
      args.snapshot.prices.map((price) =>
        Object.freeze({
          stoneName: price.stoneName,
          stoneKey: price.stoneKey,
          slabPriceCents: price.slabPriceCents,
          bundlePriceCents: price.bundlePriceCents,
          ...(price.bundleMinSlabs == null ? {} : { bundleMinSlabs: price.bundleMinSlabs }),
        })
      )
    ),
  });
}

export function registerJwStoneMemberPricingRoutes(app: Express): void {
  app.use("/api/u/jw-stone/member-pricing", requireCriticalSchema("profile_accounts"));
  app.get(
    "/api/u/jw-stone/member-pricing",
    isAuthenticated,
    async (req: Request, res: Response): Promise<void> => {
      res.setHeader("Cache-Control", "private, no-store");
      res.vary("Cookie");
      res.vary("Authorization");

      try {
        const viewerId = requestUserId(req);
        if (!viewerId) {
          res.status(401).json({ message: "Authentication required" });
          return;
        }
        const access = await resolveJwStonePricingAccess({
          userId: viewerId,
          user: req.user,
        });
        if (access === "none") {
          res.status(403).json({
            message: "An active JW Stone business membership is required to view pricing.",
          });
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
    }
  );

  app.post(
    "/api/u/jw-stone/member-pricing/cart-review",
    isAuthenticated,
    async (req: Request, res: Response): Promise<void> => {
      res.setHeader("Cache-Control", "private, no-store");
      res.vary("Cookie");
      res.vary("Authorization");

      try {
        const viewerId = requestUserId(req);
        if (!viewerId) {
          res.status(401).json({ message: "Authentication required" });
          return;
        }
        const access = await resolveJwStonePricingAccess({ userId: viewerId, user: req.user });
        if (access !== "member") {
          res.status(403).json({
            message: "An active JW Stone business membership is required to review an order.",
          });
          return;
        }
        const parsed = cartReviewSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid cart" });
          return;
        }

        const target = await getStoneInventoryProfileTarget("jw-stone");
        if (!target) {
          res.status(503).json({ message: "JW Stone inventory is temporarily unavailable." });
          return;
        }
        const [inventory, snapshot] = await Promise.all([
          listSellerStoneInventory(target),
          getJwStonePricingSnapshot(),
        ]);
        const inventoryByPublicId = new Map(inventory.map((item) => [item.id, item]));
        const priceByStoneKey = new Map(snapshot.prices.map((price) => [price.stoneKey, price]));
        let subtotalCents = 0;
        const lines = parsed.data.lines.map((requested) => {
          const item = inventoryByPublicId.get(requested.inventoryPublicId);
          if (!item || !item.isSaleReady) {
            return {
              inventoryPublicId: requested.inventoryPublicId,
              requestedQuantity: requested.quantity,
              status: "unavailable" as const,
            };
          }
          const availableQuantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
          if (requested.quantity > availableQuantity) {
            return {
              inventoryPublicId: requested.inventoryPublicId,
              requestedQuantity: requested.quantity,
              availableQuantity,
              materialName: item.materialName,
              status: "insufficient_quantity" as const,
            };
          }
          const price = priceByStoneKey.get(jwStonePriceKey(item.materialName));
          if (!price) {
            return {
              inventoryPublicId: requested.inventoryPublicId,
              requestedQuantity: requested.quantity,
              availableQuantity,
              materialName: item.materialName,
              status: "price_unavailable" as const,
            };
          }
          const useBundleRate =
            price.bundleMinSlabs != null && requested.quantity >= price.bundleMinSlabs;
          const unitRateCents = useBundleRate ? price.bundlePriceCents : price.slabPriceCents;
          const oneSlabTotalCents = centsForSlabFace(unitRateCents, item.dimensions);
          if (oneSlabTotalCents == null) {
            return {
              inventoryPublicId: requested.inventoryPublicId,
              requestedQuantity: requested.quantity,
              availableQuantity,
              materialName: item.materialName,
              status: "dimensions_required" as const,
            };
          }
          const lineTotalCents = oneSlabTotalCents * requested.quantity;
          subtotalCents += lineTotalCents;
          return {
            inventoryPublicId: requested.inventoryPublicId,
            requestedQuantity: requested.quantity,
            availableQuantity,
            materialName: item.materialName,
            materialSlug: item.materialSlug,
            assetKind: item.assetKind,
            dimensions: item.dimensions,
            pricingTier: useBundleRate ? ("bundle" as const) : ("slab" as const),
            unitRateCents,
            oneSlabTotalCents,
            lineTotalCents,
            status: "ready" as const,
          };
        });
        const readyForCheckout = lines.every((line) => line.status === "ready");
        res.status(200).json({
          profileSlug: "jw-stone",
          viewerId,
          currency: "USD",
          sourceUpdatedAt: snapshot.sourceUpdatedAt,
          reviewedAt: new Date().toISOString(),
          readyForCheckout,
          subtotalCents: readyForCheckout ? subtotalCents : null,
          lines,
        });
      } catch (error) {
        console.error("[jw-stone-member-pricing] cart review unavailable", {
          message: error instanceof Error ? error.message : "Unknown cart review error",
        });
        res.status(503).json({ message: "JW Stone order review is temporarily unavailable." });
      }
    }
  );

  app.post(
    "/api/u/jw-stone/member-pricing/cart-reservations",
    requireCriticalSchema("bidrock"),
    isAuthenticated,
    async (req: Request, res: Response): Promise<void> => {
      res.setHeader("Cache-Control", "private, no-store");
      res.vary("Cookie");
      res.vary("Authorization");
      try {
        const viewerId = requestUserId(req);
        if (!viewerId) {
          res.status(401).json({ message: "Authentication required" });
          return;
        }
        const parsed = cartReservationSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid reservation request" });
          return;
        }
        const access = await resolveJwStonePricingAccess({ userId: viewerId, user: req.user });
        if (access !== "member") {
          res.status(403).json({
            message: "An active JW Stone business membership is required to reserve inventory.",
          });
          return;
        }
        const target = await getStoneInventoryProfileTarget("jw-stone");
        if (!target) {
          res.status(503).json({ message: "JW Stone inventory is temporarily unavailable." });
          return;
        }
        const pricingSnapshot = await getJwStonePricingSnapshot();
        const reservation = await reserveJwStoneMemberCart({
          buyerUserId: viewerId,
          sellerBusinessId: target.businessId,
          lines: parsed.data.lines,
          fulfillment: parsed.data.fulfillment,
          reservationKey: parsed.data.reservationKey,
          pricingSnapshot,
        });
        res.status(201).json({
          ...reservation,
          checkoutStatus: "inventory_reserved",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Reservation failed";
        const status = /membership/i.test(message)
          ? 403
          : /reservation key|whole-slab|physical lot|appear only once|different JW Stone cart|replay/i.test(message)
            ? 400
            : /unavailable|reserved|remain available|changed while reserving|auction|pricing|dimensions|sale-ready/i.test(message)
              ? 409
              : 503;
        if (status === 503) {
          console.error("[jw-stone-member-pricing] cart reservation unavailable", { message });
        }
        res.status(status).json({ message });
      }
    }
  );
}
