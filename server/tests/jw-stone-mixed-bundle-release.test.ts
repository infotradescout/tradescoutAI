import express from "express";
import request from "supertest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CART_REVIEW_PATH, parseJwStoneCartReview } from "@shared/jwStoneCart";
import { JwStoneBundleBuilder } from "../../client/src/features/jw-stone/JwStoneBundleBuilder";

const fx = vi.hoisted(() => ({ stock: [] as any[], prices: [] as any[] }));
vi.mock("../auth", () => ({
  isAuthenticated: (_q: unknown, _s: unknown, next: () => void) => next(),
  isSuperAdmin: (_q: unknown, _s: unknown, next: () => void) => next(),
}));
vi.mock("../schemaPreflight", () => ({
  requireCriticalSchema: () => (_q: unknown, _s: unknown, next: () => void) => next(),
}));
vi.mock("../services/jwStoneFeatureStore", () => ({
  createJwStoneFeatureStore: () => ({ read: async () => ({ enabled: true, revision: 1 }) }),
}));
vi.mock("../services/jwStonePricingAccess", () => ({
  resolveJwStonePricingAccess: async () => "member",
}));
vi.mock("../services/jwStoneDrivePricing", () => ({
  getJwStonePricingSnapshot: async () => ({
    sourceUpdatedAt: "2026-09-22T00:00:00.000Z",
    prices: fx.prices,
  }),
}));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async () => ({ businessId: "mixed-bundle-fixture" }),
  listSellerStoneInventory: async () => fx.stock,
}));
vi.mock("../services/jwStoneCartAvailability", () => ({
  loadJwStoneCartAvailability: async () =>
    new Map(
      fx.stock.map((item) => [
        item.id,
        {
          inventoryPositionId: item.inventoryPositionId,
          physicalQuantity: 1,
          availableQuantity: 1,
          unit: "slabs",
        },
      ])
    ),
}));
import { registerJwStoneMemberPricingRoutes } from "../routes/jw-stone-member-pricing";
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: "mixed-bundle-member" } as Express.User;
  next();
});
registerJwStoneMemberPricingRoutes(app);
const selection = (count: number) => ({
  lines: fx.stock.slice(0, count).map((item) => ({ inventoryPublicId: item.id, quantity: 1 })),
});
async function reviewed(count: number) {
  const input = selection(count);
  const response = await request(app).post(JW_STONE_CART_REVIEW_PATH).send(input);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return parseJwStoneCartReview(response.body, "mixed-bundle-member", input);
}
beforeEach(() => {
  fx.stock = Array.from({ length: 8 }, (_, i) => ({
    id: "stone_" + (i + 1).toString(16).padStart(32, "0"),
    inventoryPositionId: "mixed-position-" + i,
    materialName: "Fixture Stone " + (i + 1),
    materialSlug: "fixture-stone-" + (i + 1),
    assetKind: "slab",
    quantity: 1,
    unit: "slabs",
    isSaleReady: true,
    dimensions: { length: 120, height: 60, unit: "in" },
  }));
  fx.prices = fx.stock.map((item, i) => ({
    stoneName: item.materialName,
    stoneKey: item.materialName.toLowerCase(),
    slabPriceCents: 300 + 75 * i,
    bundlePriceCents: 200 + 50 * i,
    bundleMinSlabs: 7,
  }));
});

describe("released mixed-material bundle pricing", () => {
  it("keeps six distinct slabs at their own regular rates", async () => {
    const cart = await reviewed(6);
    expect(cart.bundle).toMatchObject({
      eligibleSlabs: 6,
      remainingSlabs: 1,
      unlocked: false,
      savingsCents: 0,
    });
    expect(cart.lines.map((line) => line.status === "ready" && line.pricingTier)).toEqual(
      Array(6).fill("slab")
    );
  });
  it("prices seven different stones at seven respective bundle rates", async () => {
    const cart = await reviewed(7);
    expect(cart.subtotalCents).toBe(122500);
    expect(cart.bundle).toMatchObject({
      eligibleSlabs: 7,
      remainingSlabs: 0,
      unlocked: true,
      regularSubtotalCents: 183750,
      savingsCents: 61250,
    });
    cart.lines.forEach((line, i) => {
      expect(line.status).toBe("ready");
      if (line.status !== "ready") throw new Error("Expected ready stock");
      expect(line.pricingTier).toBe("bundle");
      expect(line.unitRateCents).toBe(fx.prices[i].bundlePriceCents);
      expect(line.lineTotalCents).toBe(fx.prices[i].bundlePriceCents * 50);
    });
    expect(cart.inventoryReserved).toBe(false);
    expect(cart.readyForCheckout).toBe(false);
    const html = renderToStaticMarkup(
      createElement(JwStoneBundleBuilder, {
        review: cart,
        empty: false,
        checking: false,
        onBrowse: () => {},
      })
    );
    expect(html).toContain("Bundle pricing unlocked");
    expect(html).toContain("Choose more slabs");
    expect(html).not.toContain("jw-purchase-open");
  });
  it("removes the pooled discount at six and restores it at seven", async () => {
    expect((await reviewed(7)).bundle?.unlocked).toBe(true);
    expect((await reviewed(6)).bundle).toMatchObject({ unlocked: false, savingsCents: 0 });
    expect((await reviewed(7)).subtotalCents).toBe(122500);
  });
  it("uses the eighth stone's own bundle rate without inventing a second tier", async () => {
    const cart = await reviewed(8);
    expect(cart.subtotalCents).toBe(150000);
    expect(cart.bundle).toMatchObject({ eligibleSlabs: 8, completeBundles: 1, unlocked: true });
  });
  it("does not let unavailable stock unlock a bundle", async () => {
    fx.stock[6].isSaleReady = false;
    const cart = await reviewed(7);
    expect(cart.materialReady).toBe(false);
    expect(cart.subtotalCents).toBeNull();
    expect(cart.bundle?.unlocked).toBe(false);
  });
  it("rejects another stone's rate in a returned cart", async () => {
    const cart = structuredClone(await reviewed(7));
    const line = cart.lines[6];
    if (line.status !== "ready") throw new Error("Expected ready stock");
    line.unitRateCents = fx.prices[0].bundlePriceCents;
    expect(() => parseJwStoneCartReview(cart, "mixed-bundle-member", selection(7))).toThrow();
  });
});
