import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JW_STONE_PRICING_DRIVE_FILE_ID,
  JW_STONE_PRICING_DRIVE_FOLDER_ID,
} from "@shared/jwStoneMemberPricing";
import { JW_STONE_CART_REVIEW_PATH, parseJwStoneCartReview } from "@shared/jwStoneCart";
import { jwStoneReceiptPublicId } from "@shared/jwStoneReceiving";

const databaseBridge = vi.hoisted(() => ({ query: vi.fn() }));
const inventoryFixture = vi.hoisted(() => ({
  publicId: `stone_${"a".repeat(32)}`,
  overrides: {} as Record<string, unknown>,
  exists: true,
}));
vi.mock("../db", () => ({ pool: databaseBridge, db: {} }));
vi.mock("../auth", () => ({
  isAuthenticated: (req: any, res: any, next: any) =>
    req.user ? next() : res.status(401).json({ message: "Authentication required" }),
}));
vi.mock("../schemaPreflight", () => ({
  requireCriticalSchema: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../routes/jw-stone-receiving", () => ({ registerJwStoneReceivingRoutes: () => {} }));
vi.mock("../routes/profiles", () => ({
  getPublicProfileTrustContext: async () => ({ businessId: "jw-business" }),
}));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async () => ({
    profileId: "jw-profile",
    profileSlug: "jw-stone",
    profileStatus: "published",
    ownerUserId: "jw-owner",
    businessId: "jw-business",
    businessOwnerUserId: "jw-owner",
  }),
  hasStoneInventoryCapability: async () => false,
}));
import { registerJwStoneMemberPricingRoutes } from "../routes/jw-stone-member-pricing";
import { resetJwStoneDrivePricingCacheForTests } from "../services/jwStoneDrivePricing";

describe("JW Stone private pricing HTTP path", () => {
  const database = new PGlite();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = req.get("x-fixture-viewer");
    if (id) req.user = { id, role: id === "admin" ? "super_admin" : "business_owner" } as any;
    next();
  });
  registerJwStoneMemberPricingRoutes(app);
  const bodyFor = (quantity: number) => ({
    lines: [{ inventoryPublicId: inventoryFixture.publicId, quantity }],
  });
  async function review(body: unknown, viewer = "member") {
    await database.exec(
      "DELETE FROM stone_inventory_positions; DELETE FROM stone_asset_passports;"
    );
    if (inventoryFixture.exists) {
      const item = {
        assetKind: "slab",
        sourceAssetRef: "private-source-ref",
        quantity: 3,
        heldQuantity: 0,
        unit: "slabs",
        dimensions: { length: 120, height: 60, thickness: 1.25, unit: "in" },
        isSaleReady: true,
        holderBusinessId: "jw-business",
        jwReceiving: undefined,
        ...inventoryFixture.overrides,
      };
      await database.query(
        `INSERT INTO stone_asset_passports VALUES ('private-passport', $1, $2, $3, 'verified', $4, $5, 'material')`,
        [
          inventoryFixture.publicId,
          item.sourceAssetRef,
          item.assetKind,
          JSON.stringify(item.dimensions),
          JSON.stringify({
            ownerConfirmedName: "Test Stone",
            locationLabel: "Private warehouse label",
            lastConfirmedAt: "2026-09-11T12:00:00.000Z",
            confirmationExpiresAt: "2099-09-20T12:00:00.000Z",
            jwReceiving: item.jwReceiving,
          }),
        ]
      );
      await database.query(
        `INSERT INTO stone_inventory_positions VALUES ($1, 'private-passport', $2, $3, $4, 'available', $5, '2026-09-11T12:00:00Z', '{"confirmed":true}')`,
        [
          item.holderBusinessId,
          item.quantity,
          item.heldQuantity,
          item.unit,
          item.isSaleReady ? "published_current" : "unpublished",
        ]
      );
    }
    return request(app).post(JW_STONE_CART_REVIEW_PATH).set("x-fixture-viewer", viewer).send(body);
  }
  beforeAll(async () => {
    databaseBridge.query.mockImplementation((sql, args) => database.query(sql, args));
    await database.exec(`
      CREATE TABLE profiles (id text, slug text, business_id text);
      CREATE TABLE user_profiles (id text, user_id text, user_intent text, verification_status text);
      CREATE TABLE profile_accounts (id text, owner_user_id text, target_profile_id text, target_business_id text,
        business_profile_id text, identity_kind text, status text, verification_status text);
      CREATE TABLE profile_account_entitlements (profile_account_id text, product_key text, status text);
      CREATE TABLE stone_materials (id text, slug text, canonical_name text);
      CREATE TABLE stone_asset_passports (id text, public_id text, source_asset_ref text, asset_kind text,
        passport_status text, dimensions_json jsonb, condition_json jsonb, material_id text);
      CREATE TABLE stone_inventory_positions (holder_business_id text, asset_passport_id text, quantity numeric,
        held_quantity numeric, unit text, lifecycle_status text, public_availability_status text, published_at timestamptz, publication_evidence jsonb);
      INSERT INTO stone_materials VALUES ('material', 'test-stone', 'Test Stone');
      INSERT INTO profiles VALUES ('jw-profile', 'jw-stone', 'jw-business');
      INSERT INTO user_profiles VALUES ('member-business', 'member', 'business', 'pending');
      INSERT INTO profile_accounts VALUES ('membership', 'member', 'jw-profile', 'jw-business', 'member-business', 'business', 'active', 'pending');
      INSERT INTO profile_account_entitlements VALUES ('membership', 'jw_stone_member_pricing', 'pending_verification');
    `);
    vi.stubEnv("JW_STONE_PRICING_SOURCE", "approved_import");
    vi.stubEnv(
      "JW_STONE_PRICING_APPROVED_IMPORT",
      JSON.stringify({
        schemaVersion: 1,
        fileId: JW_STONE_PRICING_DRIVE_FILE_ID,
        folderId: JW_STONE_PRICING_DRIVE_FOLDER_ID,
        sourceUpdatedAt: "2026-09-05T02:50:50.000Z",
        sourceRetrievedAt: "2026-09-06T03:00:00.000Z",
        prices: [
          {
            stoneName: "Test Stone",
            stoneKey: "test stone",
            landedCostCents: 100,
            slabPriceCents: 300,
            bundlePriceCents: 200,
            bundleMinSlabs: 2,
          },
        ],
      })
    );
    resetJwStoneDrivePricingCacheForTests();
  });
  beforeEach(async () => {
    inventoryFixture.overrides = {};
    inventoryFixture.exists = true;
    inventoryFixture.publicId = `stone_${"a".repeat(32)}`;
    await database.exec(
      "UPDATE profile_accounts SET status='active', identity_kind='business'; UPDATE profile_account_entitlements SET status='pending_verification'; UPDATE user_profiles SET verification_status='pending'; UPDATE profiles SET slug='jw-stone';"
    );
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    resetJwStoneDrivePricingCacheForTests();
    await database.close();
  });
  it("returns no prices to a guest", async () => {
    const response = await request(app).get("/api/u/jw-stone/member-pricing");
    expect(response.status).toBe(401);
    expect(response.body.prices).toBeUndefined();
  });
  it("returns no prices to a signed-in business without a JW membership", async () => {
    const response = await request(app)
      .get("/api/u/jw-stone/member-pricing")
      .set("x-fixture-viewer", "nonmember");
    expect(response.status).toBe(403);
    expect(response.body.prices).toBeUndefined();
  });
  it("delivers exact stone rates on membership creation and excludes internal cost and source IDs", async () => {
    const response = await request(app)
      .get("/api/u/jw-stone/member-pricing")
      .set("x-fixture-viewer", "member");
    expect(response.status).toBe(200);
    expect(response.body.access).toBe("member");
    expect(response.body.prices).toEqual([
      {
        stoneName: "Test Stone",
        stoneKey: "test stone",
        slabPriceCents: 300,
        bundlePriceCents: 200,
        bundleMinSlabs: 2,
      },
    ]);
    expect(JSON.stringify(response.body)).not.toMatch(/landed|fileId|folderId|sourceRetrievedAt/);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers.vary).toContain("Cookie");
  });
  it.each(["admin", "jw-owner"])(
    "preserves internal pricing without buyer-cart authority for %s",
    async (viewer) => {
      const response = await request(app)
        .get("/api/u/jw-stone/member-pricing")
        .set("x-fixture-viewer", viewer);
      expect(response.status).toBe(200);
      expect(response.body.access).toBe("internal");
      expect(response.body.prices[0].landedCostCents).toBe(100);
      expect((await review(bodyFor(1), viewer)).status).toBe(403);
    }
  );
  it("rejects cart review for guests and nonmembers", async () => {
    expect((await request(app).post(JW_STONE_CART_REVIEW_PATH).send(bodyFor(1))).status).toBe(401);
    expect((await review(bodyFor(1), "nonmember")).status).toBe(403);
  });
  it("rechecks physical stock and slab pricing without claiming checkout or reservation", async () => {
    const response = await review(bodyFor(1));
    expect(response.status).toBe(200);
    expect(response.body.materialReady).toBe(true);
    expect(response.body.readyForCheckout).toBe(false);
    expect(response.body.inventoryReserved).toBe(false);
    expect(response.body.subtotalCents).toBe(15000);
    expect(response.body.lines[0]).toMatchObject({
      inventoryPublicId: inventoryFixture.publicId,
      requestedQuantity: 1,
      availableQuantity: 3,
      pricingTier: "slab",
      unitRateCents: 300,
      lineTotalCents: 15000,
      status: "ready",
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /landed|private-position|private-passport|warehouse|source-ref/i
    );
    expect(() => parseJwStoneCartReview(response.body, "member", bodyFor(1))).not.toThrow();
  });
  it("uses the bundle rate only after the configured slab threshold", async () => {
    const response = await review(bodyFor(2));
    expect(response.status).toBe(200);
    expect(response.body.materialReady).toBe(true);
    expect(response.body.readyForCheckout).toBe(false);
    expect(response.body.subtotalCents).toBe(20000);
    expect(response.body.lines[0]).toMatchObject({ pricingTier: "bundle", unitRateCents: 200 });
  });
  it("fails closed when requested quantity exceeds current physical stock", async () => {
    const response = await review(bodyFor(4));
    expect(response.status).toBe(200);
    expect(response.body.materialReady).toBe(false);
    expect(response.body.readyForCheckout).toBe(false);
    expect(response.body.subtotalCents).toBeNull();
    expect(response.body.lines[0]).toMatchObject({
      status: "insufficient_quantity",
      availableQuantity: 3,
    });
  });
  it("subtracts held slabs in the actual inventory query", async () => {
    inventoryFixture.overrides = { heldQuantity: 2 };
    const response = await review(bodyFor(2));
    expect(response.body.lines[0]).toMatchObject({
      status: "insufficient_quantity",
      availableQuantity: 1,
    });
    expect(response.body.subtotalCents).toBeNull();
  });
  it("does not expose another seller's stock even with a known public ID", async () => {
    inventoryFixture.overrides = { holderBusinessId: "other-business" };
    expect((await review(bodyFor(1))).body.lines[0]).toEqual({
      inventoryPublicId: inventoryFixture.publicId,
      requestedQuantity: 1,
      status: "unavailable",
    });
  });
  it("reviews a received per-slab price during a catalog workbook outage without leaking receipt costs", async () => {
    const receipt = {
      receiptId: "11111111-1111-4111-8111-111111111111",
      materialName: "Test Stone",
      materialFamily: "Granite",
      materialClass: "natural_stone",
      lotLabel: "FIXTURE",
      quantity: 3,
      length: 120,
      height: 60,
      dimensionUnit: "in",
      thicknessMm: 30,
      finish: "polished",
      locationLabel: "PRIVATE RACK",
      priceUnit: "slab",
      sellPriceCents: 125000,
      bundlePriceCents: 110000,
      bundleMinSlabs: 2,
      landedCostCents: 123,
      notes: "PRIVATE NOTES",
    };
    inventoryFixture.publicId = jwStoneReceiptPublicId(receipt.receiptId);
    inventoryFixture.overrides = {
      sourceAssetRef: `jw-receiving:${receipt.receiptId}`,
      jwReceiving: { state: "published", receipt, receivedAt: "2026-09-10T12:00:00.000Z" },
    };
    const original = process.env.JW_STONE_PRICING_APPROVED_IMPORT;
    vi.stubEnv("JW_STONE_PRICING_APPROVED_IMPORT", "invalid");
    resetJwStoneDrivePricingCacheForTests();
    try {
      const access = await request(app)
        .get("/api/u/jw-stone/member-pricing/cart-access")
        .set("x-fixture-viewer", "member");
      expect(access.body).toEqual({ viewerId: "member", allowed: true });
      const body = {
        ...bodyFor(2),
        fulfillment: { method: "delivery" as const, postalCode: "70401" },
      };
      const response = await review(body);
      expect(response.status).toBe(200);
      expect(response.body.subtotalCents).toBe(220000);
      expect(response.body.lines[0]).toMatchObject({
        priceUnit: "slab",
        oneSlabTotalCents: 110000,
      });
      expect(response.body.sourceUpdatedAt).toBe("2026-09-10T12:00:00.000Z");
      expect(() => parseJwStoneCartReview(response.body, "member", body)).not.toThrow();
      expect(JSON.stringify(response.body)).not.toMatch(/PRIVATE|landed|receiptId|source_asset/);
      inventoryFixture.overrides = {
        ...inventoryFixture.overrides,
        jwReceiving: { state: "published", receipt: { ...receipt, sellPriceCents: -1 } },
      };
      expect((await review(bodyFor(1))).body.lines[0].status).toBe("price_unavailable");
    } finally {
      vi.stubEnv("JW_STONE_PRICING_APPROVED_IMPORT", original!);
      resetJwStoneDrivePricingCacheForTests();
    }
  });
  it("combines duplicate stock rows before checking availability", async () => {
    const response = await review({ lines: [...bodyFor(2).lines, ...bodyFor(2).lines] });
    expect(response.status).toBe(200);
    expect(response.body.lines).toHaveLength(1);
    expect(response.body.lines[0]).toMatchObject({
      requestedQuantity: 4,
      status: "insufficient_quantity",
    });
    expect(response.body.subtotalCents).toBeNull();
  });
  it("applies a configured quantity rate to the combined selection of the same stock", async () => {
    const body = { lines: [...bodyFor(1).lines, ...bodyFor(1).lines] };
    const response = await review(body);
    expect(response.body.lines).toHaveLength(1);
    expect(response.body.subtotalCents).toBe(20000);
    expect(response.body.lines[0].pricingTier).toBe("bundle");
    expect(() => parseJwStoneCartReview(response.body, "member", body)).not.toThrow();
  });
  it.each([0, -1, 1.5, 1000, "2"])("rejects an invalid requested quantity %s", async (quantity) => {
    expect(
      (await review({ lines: [{ inventoryPublicId: inventoryFixture.publicId, quantity }] })).status
    ).toBe(400);
  });
  it("rejects client prices, totals, private IDs, and combined quantities above the bound", async () => {
    expect((await review({ ...bodyFor(1), subtotalCents: 1 })).status).toBe(400);
    expect((await review({ lines: [{ ...bodyFor(1).lines[0], unitRateCents: 1 }] })).status).toBe(
      400
    );
    expect(
      (await review({ lines: [{ inventoryPublicId: "private-position-id", quantity: 1 }] })).status
    ).toBe(400);
    expect((await review({ lines: [...bodyFor(600).lines, ...bodyFor(600).lines] })).status).toBe(
      400
    );
  });
  it.each([{ assetKind: "container" }, { unit: "bundles" }, { quantity: 2.5 }])(
    "does not treat non-slab units as slab quantities: %j",
    async (overrides) => {
      inventoryFixture.overrides = overrides;
      const response = await review(bodyFor(1));
      expect(response.body.materialReady).toBe(false);
      expect(response.body.subtotalCents).toBeNull();
      expect(response.body.lines[0].status).toBe("slab_quantity_required");
    }
  );
  it.each([null, { length: 120, height: 60, unit: null }])(
    "requires dimensions with explicit units: %j",
    async (dimensions) => {
      inventoryFixture.overrides = { dimensions };
      const response = await review(bodyFor(1));
      expect(response.body.lines[0].status).toBe("dimensions_required");
      expect(response.body.subtotalCents).toBeNull();
    }
  );
  it("converts millimeters without changing the verified material total", async () => {
    inventoryFixture.overrides = { dimensions: { length: 3048, height: 1524, unit: "mm" } };
    expect((await review(bodyFor(1))).body.subtotalCents).toBe(15000);
  });
  it("does not project unpublished or missing stock", async () => {
    inventoryFixture.overrides = { isSaleReady: false };
    let response = await review(bodyFor(1));
    expect(response.body.lines[0]).toEqual({
      inventoryPublicId: inventoryFixture.publicId,
      requestedQuantity: 1,
      status: "unavailable",
    });
    inventoryFixture.exists = false;
    response = await review(bodyFor(1));
    expect(response.body.lines[0].status).toBe("unavailable");
    expect(response.body.subtotalCents).toBeNull();
  });
  it("keeps unknown delivery cost and timing null, not free or promised", async () => {
    const body = {
      ...bodyFor(1),
      fulfillment: { method: "delivery" as const, postalCode: "70401" },
    };
    const response = await review(body);
    expect(response.body.fulfillment).toEqual(body.fulfillment);
    expect(response.body.deliveryFeeCents).toBeNull();
    expect(response.body.estimatedDeliveryDate).toBeNull();
    expect(response.body.readyForCheckout).toBe(false);
    expect(() => parseJwStoneCartReview(response.body, "member", body)).not.toThrow();
    expect(
      (await review({ ...bodyFor(1), fulfillment: { method: "delivery", postalCode: "bad" } }))
        .status
    ).toBe(400);
  });
  it.each([
    "UPDATE profile_accounts SET status='suspended'",
    "UPDATE profile_account_entitlements SET status='revoked'",
    "UPDATE user_profiles SET verification_status='rejected'",
    "UPDATE profile_accounts SET identity_kind='user'",
    "UPDATE profiles SET slug='another-stone'",
  ])("blocks cart access after membership authority changes: %s", async (sql) => {
    await database.exec(sql);
    expect((await review(bodyFor(1))).status).toBe(403);
  });
  it("stops returning prices immediately after membership is suspended", async () => {
    await database.exec("UPDATE profile_accounts SET status='suspended'");
    const response = await request(app)
      .get("/api/u/jw-stone/member-pricing")
      .set("x-fixture-viewer", "member");
    expect(response.status).toBe(403);
    expect(response.body.prices).toBeUndefined();
  });
});
