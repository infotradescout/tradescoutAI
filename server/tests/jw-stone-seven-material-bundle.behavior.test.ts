import express from "express";
import request from "supertest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CART_REVIEW_PATH, parseJwStoneCartReview } from "@shared/jwStoneCart";
import { JwStoneBundleBuilder } from "../../client/src/features/jw-stone/JwStoneBundleBuilder";

const fx = vi.hoisted(() => ({
  stock: [] as Array<{
    id: string;
    inventoryPositionId: string;
    materialName: string;
    materialSlug: string;
    assetKind: string;
    quantity: number;
    unit: string;
    isSaleReady: boolean;
    dimensions: { length: number; height: number; unit: string };
  }>,
  prices: [] as Array<{
    stoneName: string;
    stoneKey: string;
    slabPriceCents: number;
    bundlePriceCents: number;
    bundleMinSlabs: number;
  }>,
}));

// The real cart registrar, pricing calculation, response parser and rendered panel
// are exercised. Authentication, source prices and stock are isolated fixtures.
vi.mock("../auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  isSuperAdmin: (_req: unknown, res: express.Response) =>
    res.status(403).json({ message: "Administrator required" }),
}));
vi.mock("../schemaPreflight", () => ({
  requireCriticalSchema: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../services/jwStoneFeatureStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/jwStoneFeatureStore")>()),
  createJwStoneFeatureStore: () => ({
    read: async () => ({ profileSlug: "jw-stone", enabled: true, revision: 1, configured: true }),
  }),
}));
vi.mock("../services/jwStonePricingAccess", () => ({
  resolveJwStonePricingAccess: async () => "member",
}));
vi.mock("../services/jwStoneDrivePricing", () => ({
  getJwStonePricingSnapshot: async () => ({
    sourceUpdatedAt: "2026-09-20T00:00:00.000Z",
    prices: fx.prices,
  }),
}));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async () => ({ businessId: "seven-material-fixture" }),
  listSellerStoneInventory: async () => fx.stock,
}));
vi.mock("../services/jwStoneCartAvailability", () => ({
  loadJwStoneCartAvailability: async () => new Map(fx.stock.map((stock) => [
    stock.id,
    { inventoryPositionId: stock.inventoryPositionId, physicalQuantity: 1, availableQuantity: 1, unit: "slabs" },
  ])),
}));

import { registerJwStoneMemberPricingRoutes } from "../routes/jw-stone-member-pricing";
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: "seven-material-member" } as Express.User;
  next();
});
registerJwStoneMemberPricingRoutes(app);

const input = (count: number) => ({
  lines: fx.stock.slice(0, count).map((stock) => ({ inventoryPublicId: stock.id, quantity: 1 })),
});
async function checked(selection: ReturnType<typeof input>) {
  const response = await request(app).post(JW_STONE_CART_REVIEW_PATH).send(selection);
  expect(response.status).toBe(200);
  return parseJwStoneCartReview(response.body, "seven-material-member", selection);
}
function render(review: Awaited<ReturnType<typeof checked>>) {
  return renderToStaticMarkup(createElement(JwStoneBundleBuilder, {
    review, empty: false, checking: false, onBrowse: () => {},
  }));
}

beforeEach(() => {
  // Eight different known stones, one physical slab per stock row. Every material's
  // ordinary bundle minimum is seven; no line individually meets that minimum.
  fx.stock = Array.from({ length: 8 }, (_, index) => ({
    id: "stone_" + (index + 1).toString(16).padStart(32, "0"),
    inventoryPositionId: "seven-position-" + index,
    materialName: "Fixture Stone " + (index + 1),
    materialSlug: "fixture-stone-" + (index + 1),
    assetKind: "slab",
    quantity: 1,
    unit: "slabs",
    isSaleReady: true,
    dimensions: { length: 120, height: 60, unit: "in" },
  }));
  fx.prices = fx.stock.map((stock, index) => ({
    stoneName: stock.materialName,
    stoneKey: stock.materialName.toLowerCase(),
    slabPriceCents: 300 + 75 * index,
    bundlePriceCents: 200 + 50 * index,
    bundleMinSlabs: 7,
  }));
});

describe("one slab each of seven different JW Stone materials", () => {
  it("shows one more needed at six distinct slabs without discounting early", async () => {
    const review = await checked(input(6));
    expect(review.bundle).toMatchObject({ eligibleSlabs: 6, remainingSlabs: 1, unlocked: false, savingsCents: 0 });
    expect(review.lines.map((line) => line.status === "ready" && line.pricingTier)).toEqual(Array(6).fill("slab"));
    expect(render(review)).toContain("Add 1 more eligible slab to unlock bundle pricing.");
  });

  it("gives all seven distinct one-slab lines their own bundle rates", async () => {
    const review = await checked(input(7));
    expect(new Set(review.lines.map((line) => line.status === "ready" && line.materialName)).size).toBe(7);
    expect(review.bundle).toEqual({
      requiredSlabs: 7, eligibleSlabs: 7, remainingSlabs: 0, completeBundles: 1,
      unlocked: true, regularSubtotalCents: 183750, savingsCents: 61250,
    });
    expect(review.subtotalCents).toBe(122500);
    review.lines.forEach((line, index) => {
      expect(line.status).toBe("ready");
      if (line.status !== "ready") throw new Error("Expected checked fixture stock");
      expect(line.requestedQuantity).toBe(1);
      expect(line.availableQuantity).toBe(1);
      expect(line.bundlePricing?.minimumSlabs).toBe(7);
      expect(line.pricingTier).toBe("bundle");
      expect(line.unitRateCents).toBe(fx.prices[index].bundlePriceCents);
      expect(line.lineTotalCents).toBe(fx.prices[index].bundlePriceCents * 50);
    });
    expect(review.inventoryReserved).toBe(false);
    expect(review.readyForCheckout).toBe(false);
    expect(render(review)).toContain("Bundle pricing unlocked");
    expect(render(review)).toContain('aria-valuenow="7"');
  });

  it("preserves each stone's own rate when selection order changes", async () => {
    const selection = input(7);
    selection.lines.reverse();
    const review = await checked(selection);
    expect(review.subtotalCents).toBe(122500);
    for (const line of review.lines) {
      if (line.status !== "ready") throw new Error("Expected checked fixture stock");
      const index = fx.stock.findIndex((stock) => stock.id === line.inventoryPublicId);
      expect(line.unitRateCents).toBe(fx.prices[index].bundlePriceCents);
    }
  });

  it("rechecks seven, removes the discount at six, and restores it when the seventh returns", async () => {
    expect((await checked(input(7))).subtotalCents).toBe(122500);
    expect((await checked(input(7))).subtotalCents).toBe(122500);
    const six = await checked(input(6));
    expect(six.bundle).toMatchObject({ unlocked: false, savingsCents: 0, remainingSlabs: 1 });
    expect(six.lines.map((line) => line.status === "ready" && line.pricingTier)).toEqual(Array(6).fill("slab"));
    expect((await checked(input(7))).bundle).toMatchObject({ unlocked: true, savingsCents: 61250 });
  });

  it("also prices an eighth different stone at that stone's bundle rate", async () => {
    const review = await checked(input(8));
    expect(review.bundle).toMatchObject({ eligibleSlabs: 8, unlocked: true, completeBundles: 1 });
    expect(review.lines.map((line) => line.status === "ready" && line.pricingTier)).toEqual(Array(8).fill("bundle"));
    expect(review.subtotalCents).toBe(150000);
  });

  it("rejects a response that substitutes another stone's bundle rate", async () => {
    const selection = input(7);
    const review = await checked(selection);
    const changed = structuredClone(review);
    const last = changed.lines[6];
    if (last.status !== "ready") throw new Error("Expected checked fixture stock");
    last.unitRateCents = fx.prices[0].bundlePriceCents;
    expect(() => parseJwStoneCartReview(changed, "seven-material-member", selection)).toThrow();
  });
});
