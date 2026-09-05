import type { Express, Request, Response } from "express";
import type {
  JwStoneInternalPricingResponse,
  JwStoneMemberPricingResponse,
  JwStonePricingAccess,
} from "@shared/jwStoneMemberPricing";
import { JW_STONE_PRICING_PROFILE_SLUG } from "@shared/jwStoneMemberPricing";
import { isAuthenticated } from "../auth";
import { requireCriticalSchema } from "../schemaPreflight";
import {
  getJwStonePricingSnapshot,
  type JwStonePricingSnapshot,
} from "../services/jwStoneDrivePricing";
import { resolveJwStonePricingAccess } from "../services/jwStonePricingAccess";

function requestUserId(req: Request): string {
  const user = req.user as { id?: unknown; claims?: { sub?: unknown } } | undefined;
  return String(user?.id || user?.claims?.sub || "").trim();
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
}
