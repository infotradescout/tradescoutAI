import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION,
  STONE_CURRENT_INVENTORY_FRESHNESS_DAYS,
} from "@shared/stoneInventory";
import { isAuthenticated } from "../auth";
import { requireCriticalSchema } from "../schemaPreflight";
import { getPublicProfileTrustContext } from "./profiles";
import { importJwStoneConfirmedStock } from "../services/jwStoneConfirmedStock";
import {
  canBidRockViewerMutateStoneInventory,
  getBidRockViewerContext,
  syncBidRockStoneInventory,
} from "../services/bidrockService";
import {
  defaultStoneInventoryConfirmationWindow,
  getStoneInventoryProfileTarget,
  hasStoneInventoryCapability,
  listPublicCurrentStoneInventory,
  listSellerStoneInventory,
  retireStoneInventory,
  setStoneInventorySaleReady,
  upsertCurrentStoneInventory,
  type StoneInventoryProfileTarget,
} from "../services/stoneInventoryService";
import type { StoneInventoryCapability } from "@shared/stoneInventory";

const stonePublicIdSchema = z.string().regex(/^stone_[a-f0-9]{32}$/);
const inventoryMutationSchema = z
  .object({
    publicId: stonePublicIdSchema.optional(),
    materialSlug: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    materialName: z.string().trim().min(2).max(160),
    materialFamily: z.string().trim().min(2).max(80),
    assetKind: z.enum(["slab", "bundle", "block", "container", "a_frame", "piece"]),
    quantity: z.number().positive().max(100_000),
    unit: z.string().trim().min(1).max(40),
    dimensions: z
      .object({
        length: z.number().positive().max(10_000).nullable().optional(),
        height: z.number().positive().max(10_000).nullable().optional(),
        thickness: z.number().positive().max(1_000).nullable().optional(),
        unit: z.enum(["in", "mm"]).nullable().optional(),
      })
      .strict(),
    finishQuantities: z
      .array(
        z
          .object({
            finish: z.string().trim().min(1).max(80),
            slabCount: z.number().positive().max(100_000),
          })
          .strict()
      )
      .max(12)
      .default([]),
    locationLabel: z.string().trim().max(160).nullable().optional(),
    imageUrls: z.array(z.string().trim().min(1).max(2_000)).max(12).default([]),
    lastConfirmedAt: z.string().datetime().optional(),
    confirmationExpiresAt: z.string().datetime().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const knownFinishCount = value.finishQuantities.reduce(
      (total, finish) => total + finish.slabCount,
      0
    );
    if (knownFinishCount > value.quantity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["finishQuantities"],
        message: "Known finish quantities cannot exceed the physical quantity",
      });
    }
    if (Boolean(value.lastConfirmedAt) !== Boolean(value.confirmationExpiresAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmationExpiresAt"],
        message: "Confirmation dates must be supplied together",
      });
    }
    if (value.lastConfirmedAt && value.confirmationExpiresAt) {
      const confirmed = new Date(value.lastConfirmedAt).getTime();
      const expires = new Date(value.confirmationExpiresAt).getTime();
      if (expires <= confirmed || expires > confirmed + 90 * 24 * 60 * 60 * 1000) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirmationExpiresAt"],
          message: "Confirmation expiry must be after confirmation and no more than 90 days later",
        });
      }
    }
  });

function userId(req: Request): string {
  const user = req.user as any;
  return String(user?.id || user?.claims?.sub || "").trim();
}

function isSuperAdmin(req: Request): boolean {
  const user = req.user as any;
  const roles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])].map((role) =>
    String(role || "")
      .trim()
      .toLowerCase()
  );
  return (
    user?.isSuperAdmin === true || roles.includes("super_admin") || roles.includes("head_admin")
  );
}

async function canManageTarget(
  req: Request,
  target: StoneInventoryProfileTarget,
  capability: StoneInventoryCapability
): Promise<boolean> {
  const viewerId = userId(req);
  if (!viewerId) return false;
  if (isSuperAdmin(req)) return true;
  return hasStoneInventoryCapability({ userId: viewerId, target, capability });
}

async function managedTarget(
  req: Request,
  res: Response,
  capability: StoneInventoryCapability
): Promise<StoneInventoryProfileTarget | null> {
  const target = await getStoneInventoryProfileTarget(String(req.params.slug || ""));
  if (!target) {
    res.status(404).json({ message: "Profile with a linked business was not found" });
    return null;
  }
  if (!(await canManageTarget(req, target, capability))) {
    res.status(403).json({ message: "Seller inventory ownership is required" });
    return null;
  }
  return target;
}

async function managedMutationTarget(
  req: Request,
  res: Response,
  capability: "inventory_write" | "inventory_publish"
): Promise<StoneInventoryProfileTarget | null> {
  const target = await getStoneInventoryProfileTarget(String(req.params.slug || ""));
  if (!target) {
    res.status(404).json({ message: "Profile with a linked business was not found" });
    return null;
  }
  const viewerId = userId(req);
  const viewer = await getBidRockViewerContext(viewerId);
  if (!canBidRockViewerMutateStoneInventory(viewer, target.businessId, capability)) {
    res.status(403).json({
      message:
        "Active verified BidRock seller entitlement and exact inventory authority are required",
    });
    return null;
  }
  return target;
}

function inventoryResponse(profileSlug: string, items: unknown) {
  return {
    profileSlug,
    freshnessDays: STONE_CURRENT_INVENTORY_FRESHNESS_DAYS,
    generatedAt: new Date().toISOString(),
    items,
  };
}

export function registerStoneInventoryRoutes(app: Express): void {
  app.use("/api/u/:slug/stone-inventory", requireCriticalSchema("stone_inventory"));
  app.get("/api/u/:slug/stone-inventory/current", async (req, res) => {
    try {
      const publicContext = await getPublicProfileTrustContext(String(req.params.slug || ""));
      if (!publicContext?.businessId) {
        res.status(404).json({ message: "Profile not found" });
        return;
      }
      const target = await getStoneInventoryProfileTarget(publicContext.profileSlug);
      if (!target || target.businessId !== publicContext.businessId) {
        res.status(404).json({ message: "Profile not found" });
        return;
      }
      const items = await listPublicCurrentStoneInventory(target);
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      res.json(inventoryResponse(target.profileSlug, items));
    } catch (error) {
      console.error("[stone-inventory] public list failed", error);
      res.status(500).json({ message: "Current inventory is temporarily unavailable" });
    }
  });

  app.get(
    "/api/u/:slug/stone-inventory/manage",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const target = await managedTarget(req, res, "inventory_read");
        if (!target) return;
        const items = await listSellerStoneInventory(target);
        res.setHeader("Cache-Control", "private, no-store");
        res.json(inventoryResponse(target.profileSlug, items));
      } catch (error) {
        console.error("[stone-inventory] seller list failed", error);
        res.status(500).json({ message: "Seller inventory is temporarily unavailable" });
      }
    }
  );

  app.post(
    "/api/u/:slug/stone-inventory/current",
    requireCriticalSchema("bidrock"),
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const target = await managedMutationTarget(req, res, "inventory_write");
        if (!target) return;
        const parsed = inventoryMutationSchema.safeParse(req.body);
        if (!parsed.success) {
          res
            .status(400)
            .json({ message: parsed.error.issues[0]?.message || "Invalid stock details" });
          return;
        }
        const defaultWindow = defaultStoneInventoryConfirmationWindow();
        const item = await upsertCurrentStoneInventory(target, {
          ...parsed.data,
          lastConfirmedAt: parsed.data.lastConfirmedAt ?? defaultWindow.lastConfirmedAt,
          confirmationExpiresAt:
            parsed.data.confirmationExpiresAt ?? defaultWindow.confirmationExpiresAt,
        });
        res.setHeader("Cache-Control", "private, no-store");
        res.status(parsed.data.publicId ? 200 : 201).json({
          item,
          buyerVisible: false,
          publicationRequired: !item.isSaleReady,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Current stock could not be saved";
        const status = /not found|this seller/i.test(message) ? 404 : 500;
        if (status === 500) console.error("[stone-inventory] confirmation failed", error);
        res.status(status).json({ message });
      }
    }
  );

  app.patch(
    "/api/u/:slug/stone-inventory/current/:publicId/publication",
    requireCriticalSchema("bidrock"),
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const target = await managedMutationTarget(req, res, "inventory_publish");
        if (!target) return;
        const publicId = stonePublicIdSchema.safeParse(req.params.publicId);
        const payload = z.object({ saleReady: z.boolean() }).strict().safeParse(req.body);
        if (!publicId.success || !payload.success) {
          res.status(400).json({
            message: "A valid inventory identifier and explicit sale-ready choice are required",
          });
          return;
        }
        const item = await setStoneInventorySaleReady({
          target,
          publicId: publicId.data,
          saleReady: payload.data.saleReady,
          actorUserId: userId(req),
        });
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ item });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Publication state could not be saved";
        const status = /not found/i.test(message) ? 404 : /re-confirmed/i.test(message) ? 409 : 500;
        if (status === 500) console.error("[stone-inventory] publication failed", error);
        res.status(status).json({ message });
      }
    }
  );

  app.delete(
    "/api/u/:slug/stone-inventory/current/:publicId",
    requireCriticalSchema("bidrock"),
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const target = await managedMutationTarget(req, res, "inventory_write");
        if (!target) return;
        const publicId = stonePublicIdSchema.safeParse(req.params.publicId);
        if (!publicId.success) {
          res.status(400).json({ message: "A valid inventory identifier is required" });
          return;
        }
        const retired = await retireStoneInventory({ target, publicId: publicId.data });
        if (!retired) {
          res.status(404).json({ message: "Inventory position not found for this seller" });
          return;
        }
        res.status(204).end();
      } catch (error) {
        console.error("[stone-inventory] retire failed", error);
        res.status(500).json({ message: "Inventory position could not be retired" });
      }
    }
  );

  app.post(
    "/api/admin/bidrock/jw-stone/import-confirmed-stock",
    requireCriticalSchema("bidrock"),
    isAuthenticated,
    async (req: Request, res: Response) => {
      if (!isSuperAdmin(req)) {
        res.status(403).json({ message: "Super-admin authorization is required" });
        return;
      }
      const parsed = z
        .object({ fixtureVersion: z.literal(JW_STONE_CONFIRMED_STOCK_FIXTURE_VERSION) })
        .strict()
        .safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ message: "The canonical confirmed-stock fixture version is required" });
        return;
      }
      try {
        const result = await importJwStoneConfirmedStock();
        const projectedListings = await syncBidRockStoneInventory();
        res.status(result.createdInventoryPositions > 0 ? 201 : 200).json({
          ...result,
          projectedListings,
        });
      } catch (error) {
        console.error("[stone-inventory] confirmed-stock import failed", error);
        res.status(500).json({ message: "Confirmed stock could not be imported" });
      }
    }
  );
}
