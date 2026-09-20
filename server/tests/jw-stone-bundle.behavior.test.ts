import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CART_REVIEW_PATH, parseJwStoneCartReview } from "@shared/jwStoneCart";
import { getJwStoneBundleProgress, priceJwStoneBundleLine } from "@shared/jwStoneBundle";
const fx = vi.hoisted(() => ({
  access: "member",
  stock: [] as any[],
  prices: [] as any[],
  held: 0,
}));
vi.mock("../auth", () => ({ isAuthenticated: (_req: any, _res: any, next: any) => next() }));
vi.mock("../schemaPreflight", () => ({
  requireCriticalSchema: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../services/jwStonePricingAccess", () => ({
  resolveJwStonePricingAccess: async () => fx.access,
}));
vi.mock("../services/jwStoneDrivePricing", () => ({
  getJwStonePricingSnapshot: async () => ({
    sourceUpdatedAt: "2026-09-16T00:00:00.000Z",
    prices: fx.prices,
  }),
}));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async () => ({ businessId: "jw-fixture" }),
  listSellerStoneInventory: async () => fx.stock,
}));
vi.mock("../services/jwStoneCartAvailability", () => ({
  loadJwStoneCartAvailability: async () =>
    new Map(
      fx.stock.map((s) => [
        s.id,
        {
          inventoryPositionId: s.inventoryPositionId,
          physicalQuantity: s.quantity,
          availableQuantity: s.quantity - fx.held,
          unit: "slabs",
        },
      ])
    ),
}));
import { registerJwStoneMemberPricingRoutes } from "../routes/jw-stone-member-pricing";
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: "member" } as any;
  next();
});
registerJwStoneMemberPricingRoutes(app);
const id = (n: number) => "stone_" + n.toString(16).padStart(32, "0");
const body = (...quantities: number[]) => ({
  lines: quantities.map((quantity, index) => ({ inventoryPublicId: id(index + 1), quantity })),
});
const review = (input: unknown) => request(app).post(JW_STONE_CART_REVIEW_PATH).send(input);
beforeEach(() => {
  fx.access = "member";
  fx.held = 0;
  fx.stock = ["Stone A", "Stone B", "Stone C"].map((materialName, index) => ({
    id: id(index + 1),
    inventoryPositionId: "position-" + index,
    materialName,
    materialSlug: materialName.toLowerCase().replace(" ", "-"),
    assetKind: "slab",
    quantity: 20,
    unit: "slabs",
    isSaleReady: true,
    dimensions: { length: 120, height: 60, unit: "in" },
  }));
  fx.prices = [
    { stoneName: "Stone A", stoneKey: "stone a", slabPriceCents: 300, bundlePriceCents: 200 },
    { stoneName: "Stone B", stoneKey: "stone b", slabPriceCents: 400, bundlePriceCents: 250 },
    { stoneName: "Stone C", stoneKey: "stone c", slabPriceCents: 400, bundlePriceCents: 250 },
  ];
});
describe("JW Stone seven-slab bundle HTTP contract", () => {
  it("shows quantity progress at six without applying an unpublished discount", async () => {
    const r = await review(body(3, 3));
    expect(r.status).toBe(200);
    expect(r.body.bundle).toMatchObject({
      requiredSlabs: 7,
      eligibleSlabs: 6,
      remainingSlabs: 1,
      unlocked: false,
      savingsCents: 0,
    });
    expect(r.body.lines.map((l: any) => l.pricingTier)).toEqual(["slab", "slab"]);
    expect(r.body.subtotalCents).toBe(105000);
  });
  it("does not pool two materials at seven without an approved mixed-material policy", async () => {
    const input = body(3, 4);
    const r = await review(input);
    expect(r.status).toBe(200);
    expect(r.body.subtotalCents).toBe(125000);
    expect(r.body.lines.map((l: any) => l.unitRateCents)).toEqual([300, 400]);
    expect(r.body.bundle).toEqual({
      requiredSlabs: 7,
      eligibleSlabs: 7,
      remainingSlabs: 0,
      completeBundles: 0,
      unlocked: false,
      regularSubtotalCents: 125000,
      savingsCents: 0,
    });
    expect(() => parseJwStoneCartReview(r.body, "member", input)).not.toThrow();
    expect(r.body.inventoryReserved).toBe(false);
    expect(r.body.readyForCheckout).toBe(false);
  });
  it.each([7, 8, 13, 14, 20])(
    "keeps each qualified single-material slab at its source bundle rate for %i slabs",
    async (n) => {
      const input = body(n);
      const r = await review(input);
      expect(r.body.subtotalCents).toBe(n * 10000);
      expect(r.body.bundle).toMatchObject({
        eligibleSlabs: n,
        remainingSlabs: 0,
        completeBundles: Math.floor(n / 7),
        unlocked: true,
        savingsCents: n * 5000,
      });
      expect(() => parseJwStoneCartReview(r.body, "member", input)).not.toThrow();
    }
  );
  it("removes the bundle rate again when a single-material cart drops to six", async () => {
    expect((await review(body(7))).body.bundle.unlocked).toBe(true);
    const r = await review(body(6));
    expect(r.body.bundle.unlocked).toBe(false);
    expect(r.body.bundle.savingsCents).toBe(0);
  });
  it("combines checked lots of the same canonical material without mixing different stones", async () => {
    fx.stock[1].materialName = "STONE-A";
    const input = body(3, 4);
    const r = await review(input);
    expect(r.body.subtotalCents).toBe(70000);
    expect(r.body.lines.map((l: any) => l.pricingTier)).toEqual(["bundle", "bundle"]);
    expect(r.body.bundle).toMatchObject({ unlocked: true, completeBundles: 1 });
    expect(() => parseJwStoneCartReview(r.body, "member", input)).not.toThrow();
  });
  it("does not extend one material's published quantity rate to another material", async () => {
    const input = body(7, 1);
    const r = await review(input);
    expect(r.body.bundle.unlocked).toBe(false);
    expect(r.body.lines.map((l: any) => l.unitRateCents)).toEqual([200, 400]);
    expect(r.body.subtotalCents).toBe(90000);
    expect(() => parseJwStoneCartReview(r.body, "member", input)).not.toThrow();
  });
  it("does not grant pooled pricing when material identity is absent", () => {
    const bundlePricing = { slabRateCents: 300, bundleRateCents: 200, minimumSlabs: 7, regularOneSlabCents: 15000, bundleOneSlabCents: 10000 };
    const progress = getJwStoneBundleProgress([
      { status: "ready", requestedQuantity: 3, materialName: "Stone A", bundlePricing },
      { status: "ready", requestedQuantity: 4, bundlePricing },
    ]);
    expect(progress).toMatchObject({ unlocked: false, completeBundles: 0 });
  });
  it("preserves lower published per-stock quantity tiers", async () => {
    fx.prices[0].bundleMinSlabs = 2;
    const r = await review(body(2));
    expect(r.body.bundle.unlocked).toBe(false);
    expect(r.body.lines[0].pricingTier).toBe("bundle");
    expect(r.body.subtotalCents).toBe(20000);
  });
  it("does not override a higher material-specific minimum", async () => {
    fx.prices[0].bundleMinSlabs = 10;
    const r = await review(body(3, 7));
    expect(r.body.bundle.eligibleSlabs).toBe(7);
    expect(r.body.lines.map((l: any) => l.pricingTier)).toEqual(["slab", "bundle"]);
    expect((await review(body(10))).body.lines[0].pricingTier).toBe("bundle");
  });
  it.each([300, 500])(
    "does not count or apply a non-discounted bundle rate of %i",
    async (rate) => {
      fx.prices[0].bundlePriceCents = rate;
      const r = await review(body(7));
      expect(r.body.bundle.eligibleSlabs).toBe(0);
      expect(r.body.bundle.savingsCents).toBe(0);
      expect(r.body.lines[0].unitRateCents).toBe(300);
    }
  );
  it("combines duplicate selections without reusing stock", async () => {
    const input = { lines: [...body(3).lines, ...body(4).lines] };
    const r = await review(input);
    expect(r.body.lines).toHaveLength(1);
    expect(r.body.bundle.eligibleSlabs).toBe(7);
    expect(() => parseJwStoneCartReview(r.body, "member", input)).not.toThrow();
    fx.held = 15;
    const blocked = await review(input);
    expect(blocked.body.lines[0].status).toBe("insufficient_quantity");
    expect(blocked.body.bundle.eligibleSlabs).toBe(0);
  });
  it.each(["held", "unpublished", "unpriced", "dimensions", "non-slab"])(
    "excludes %s stock and suppresses savings on an incomplete cart",
    async (kind) => {
      if (kind === "held") fx.held = 17;
      if (kind === "unpublished") fx.stock[1].isSaleReady = false;
      if (kind === "unpriced") fx.prices = fx.prices.filter((p) => p.stoneKey !== "stone b");
      if (kind === "dimensions") fx.stock[1].dimensions = null;
      if (kind === "non-slab") fx.stock[1].unit = "bundles";
      const input = body(3, 4);
      const r = await review(input);
      expect(r.body.materialReady).toBe(false);
      expect(r.body.subtotalCents).toBeNull();
      expect(r.body.bundle).toMatchObject({
        unlocked: false,
        eligibleSlabs: 3,
        remainingSlabs: 4,
        savingsCents: null,
      });
      expect(() => parseJwStoneCartReview(r.body, "member", input)).not.toThrow();
    }
  );
  it("does not claim an unlocked bundle until every selected row can be checked", async () => {
    fx.stock[2].isSaleReady = false;
    const r = await review(body(3, 4, 1));
    expect(r.body.bundle).toMatchObject({
      eligibleSlabs: 7,
      remainingSlabs: 0,
      unlocked: false,
      savingsCents: null,
    });
    expect(r.body.lines[0].pricingTier).toBe("slab");
  });
  it.each(["none", "internal"])("does not expose bundle rates to access %s", async (access) => {
    fx.access = access;
    const r = await review(body(7));
    expect(r.status).toBe(403);
    expect(r.body.bundle).toBeUndefined();
  });
  it("rejects buyer-supplied discount authority", async () => {
    expect((await review({ ...body(7), bundle: { unlocked: true } })).status).toBe(400);
  });
  it("rejects inconsistent returned progress, savings, rates and missing pricing metadata", async () => {
    const input = body(3, 4);
    const r = await review(input);
    for (const mutate of [
      (v: any) => { v.bundle.eligibleSlabs++; },
      (v: any) => { v.bundle.remainingSlabs++; },
      (v: any) => { v.bundle.savingsCents++; },
      (v: any) => { v.bundle.unlocked = !v.bundle.unlocked; },
      (v: any) => { v.lines[0].unitRateCents++; },
      (v: any) => { delete v.lines[0].bundlePricing; },
    ]) {
      const v = structuredClone(r.body);
      mutate(v);
      expect(() => parseJwStoneCartReview(v, "member", input)).toThrow();
    }
  });
  it("rejects unsafe money arithmetic and invalid slab counts", () => {
    const p = {
      slabRateCents: 300,
      bundleRateCents: 200,
      regularOneSlabCents: Number.MAX_SAFE_INTEGER,
      bundleOneSlabCents: 10000,
      minimumSlabs: 7,
    };
    expect(() => priceJwStoneBundleLine(p, 7, true)).toThrow();
    expect(() => priceJwStoneBundleLine(p, 1.5, true)).toThrow();
  });
});
