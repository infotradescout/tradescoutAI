import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_PRICING_DRIVE_FILE_ID, JW_STONE_PRICING_DRIVE_FOLDER_ID } from "@shared/jwStoneMemberPricing";
import { JW_STONE_CART_REVIEW_PATH, parseJwStoneCartReview } from "@shared/jwStoneCart";

const databaseBridge = vi.hoisted(() => ({ query: vi.fn() }));
const inventoryFixture = vi.hoisted(() => ({ publicId: `stone_${"a".repeat(32)}`, overrides: {} as Record<string, unknown>, exists: true }));
vi.mock("../db", () => ({ pool: databaseBridge, db: {} }));
vi.mock("../auth", () => ({ isAuthenticated: (req: any, res: any, next: any) => req.user ? next() : res.status(401).json({ message: "Authentication required" }) }));
vi.mock("../schemaPreflight", () => ({ requireCriticalSchema: () => (_req: any, _res: any, next: any) => next() }));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async () => ({ profileId: "jw-profile", profileSlug: "jw-stone", profileStatus: "published", ownerUserId: "jw-owner", businessId: "jw-business", businessOwnerUserId: "jw-owner" }),
  hasStoneInventoryCapability: async () => false,
  listSellerStoneInventory: async () => inventoryFixture.exists ? [{
    id: inventoryFixture.publicId, inventoryPositionId: "private-position-id", passportCode: "private-passport",
    materialSlug: "test-stone", materialName: "Test Stone", materialClass: "natural_stone", materialFamily: "Granite",
    assetKind: "slab", sourceAssetRef: "private-source-ref", quantity: 3, unit: "slabs",
    dimensions: { length: 120, height: 60, thickness: 1.25, unit: "in" }, finishQuantities: [],
    locationLabel: "Private warehouse label", imageUrls: [], lastConfirmedAt: "2026-09-11T12:00:00.000Z",
    confirmationExpiresAt: "2099-09-20T12:00:00.000Z", publicAvailabilityStatus: "published", isSaleReady: true,
    ...inventoryFixture.overrides,
  }] : [],
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
  const bodyFor = (quantity: number) => ({ lines: [{ inventoryPublicId: inventoryFixture.publicId, quantity }] });
  const review = (body: unknown, viewer = "member") => request(app).post(JW_STONE_CART_REVIEW_PATH).set("x-fixture-viewer", viewer).send(body);
  beforeAll(async () => {
    await database.exec(`
      CREATE TABLE profiles (id text, slug text, business_id text);
      CREATE TABLE user_profiles (id text, user_id text, user_intent text, verification_status text);
      CREATE TABLE profile_accounts (id text, owner_user_id text, target_profile_id text, target_business_id text,
        business_profile_id text, identity_kind text, status text, verification_status text);
      CREATE TABLE profile_account_entitlements (profile_account_id text, product_key text, status text);
      CREATE TABLE stone_asset_passports (id text, public_id text, passport_status text, condition_json jsonb);
      CREATE TABLE stone_inventory_positions (id text, asset_passport_id text, holder_business_id text,
        quantity numeric, held_quantity numeric, unit text, lifecycle_status text,
        public_availability_status text, published_at timestamptz, publication_evidence jsonb);
      INSERT INTO profiles VALUES ('jw-profile', 'jw-stone', 'jw-business');
      INSERT INTO user_profiles VALUES ('member-business', 'member', 'business', 'pending');
      INSERT INTO profile_accounts VALUES ('membership', 'member', 'jw-profile', 'jw-business', 'member-business', 'business', 'active', 'pending');
      INSERT INTO profile_account_entitlements VALUES ('membership', 'jw_stone_member_pricing', 'pending_verification');
    `);
    vi.stubEnv("JW_STONE_PRICING_SOURCE", "approved_import");
    vi.stubEnv("JW_STONE_PRICING_APPROVED_IMPORT", JSON.stringify({
      schemaVersion: 1, fileId: JW_STONE_PRICING_DRIVE_FILE_ID, folderId: JW_STONE_PRICING_DRIVE_FOLDER_ID,
      sourceUpdatedAt: "2026-09-05T02:50:50.000Z", sourceRetrievedAt: "2026-09-06T03:00:00.000Z",
      prices: [{ stoneName: "Test Stone", stoneKey: "test stone", landedCostCents: 100, slabPriceCents: 300, bundlePriceCents: 200, bundleMinSlabs: 2 }],
    }));
    resetJwStoneDrivePricingCacheForTests();
  });
  beforeEach(async () => {
    databaseBridge.query.mockImplementation((sql, args) => database.query(sql, args));
    databaseBridge.query.mockClear();
    inventoryFixture.overrides = {}; inventoryFixture.exists = true;
    await database.exec("UPDATE profile_accounts SET status='active', identity_kind='business'; UPDATE profile_account_entitlements SET status='pending_verification'; UPDATE user_profiles SET verification_status='pending'; UPDATE profiles SET slug='jw-stone'; DELETE FROM stone_inventory_positions; DELETE FROM stone_asset_passports;");
    await database.query("INSERT INTO stone_asset_passports VALUES ('fixture-passport',$1,'verified',$2::jsonb)", [
      inventoryFixture.publicId,
      JSON.stringify({ lastConfirmedAt: new Date(Date.now() - 60000).toISOString(), confirmationExpiresAt: new Date(Date.now() + 86400000).toISOString() }),
    ]);
    await database.exec("INSERT INTO stone_inventory_positions VALUES ('private-position-id','fixture-passport','jw-business',3,0,'slabs','available','published_current',NOW(),'{\"actor\":\"fixture-owner\"}')");
  });
  afterAll(async () => { vi.unstubAllEnvs(); resetJwStoneDrivePricingCacheForTests(); await database.close(); });
  it("returns no prices to a guest", async () => {
    const response = await request(app).get("/api/u/jw-stone/member-pricing");
    expect(response.status).toBe(401); expect(response.body.prices).toBeUndefined();
  });
  it("returns no prices to a signed-in business without a JW membership", async () => {
    const response = await request(app).get("/api/u/jw-stone/member-pricing").set("x-fixture-viewer", "nonmember");
    expect(response.status).toBe(403); expect(response.body.prices).toBeUndefined();
  });
  it("delivers exact stone rates on membership creation and excludes internal cost and source IDs", async () => {
    const response = await request(app).get("/api/u/jw-stone/member-pricing").set("x-fixture-viewer", "member");
    expect(response.status).toBe(200); expect(response.body.access).toBe("member");
    expect(response.body.prices).toEqual([{ stoneName: "Test Stone", stoneKey: "test stone", slabPriceCents: 300, bundlePriceCents: 200, bundleMinSlabs: 2 }]);
    expect(JSON.stringify(response.body)).not.toMatch(/landed|fileId|folderId|sourceRetrievedAt/);
    expect(response.headers["cache-control"]).toBe("private, no-store"); expect(response.headers.vary).toContain("Cookie");
  });
  it.each(["admin", "jw-owner"])("preserves internal pricing without buyer-cart authority for %s", async (viewer) => {
    const response = await request(app).get("/api/u/jw-stone/member-pricing").set("x-fixture-viewer", viewer);
    expect(response.status).toBe(200); expect(response.body.access).toBe("internal"); expect(response.body.prices[0].landedCostCents).toBe(100);
    expect((await review(bodyFor(1), viewer)).status).toBe(403);
  });
  it("rejects cart review for guests and nonmembers", async () => {
    expect((await request(app).post(JW_STONE_CART_REVIEW_PATH).send(bodyFor(1))).status).toBe(401);
    expect((await review(bodyFor(1), "nonmember")).status).toBe(403);
  });
  it("rechecks physical stock and slab pricing without claiming checkout or reservation", async () => {
    const response = await review(bodyFor(1));
    expect(response.status).toBe(200); expect(response.body.materialReady).toBe(true);
    expect(response.body.readyForCheckout).toBe(false); expect(response.body.inventoryReserved).toBe(false);
    expect(response.body.subtotalCents).toBe(15000);
    expect(response.body.lines[0]).toMatchObject({ inventoryPublicId: inventoryFixture.publicId, requestedQuantity: 1,
      availableQuantity: 3, pricingTier: "slab", unitRateCents: 300, lineTotalCents: 15000, status: "ready" });
    expect(JSON.stringify(response.body)).not.toMatch(/landed|private-position|private-passport|warehouse|source-ref/i);
    expect(() => parseJwStoneCartReview(response.body, "member", bodyFor(1))).not.toThrow();
  });
  it("uses the bundle rate only after the configured slab threshold", async () => {
    const response = await review(bodyFor(2));
    expect(response.status).toBe(200); expect(response.body.materialReady).toBe(true);
    expect(response.body.readyForCheckout).toBe(false); expect(response.body.subtotalCents).toBe(20000);
    expect(response.body.lines[0]).toMatchObject({ pricingTier: "bundle", unitRateCents: 200 });
  });
  it("fails closed when requested quantity exceeds current physical stock", async () => {
    const response = await review(bodyFor(4));
    expect(response.status).toBe(200); expect(response.body.materialReady).toBe(false);
    expect(response.body.readyForCheckout).toBe(false); expect(response.body.subtotalCents).toBeNull();
    expect(response.body.lines[0]).toMatchObject({ status: "insufficient_quantity", availableQuantity: 3 });
  });
  it("combines duplicate stock rows before checking availability", async () => {
    const response = await review({ lines: [...bodyFor(2).lines, ...bodyFor(2).lines] });
    expect(response.status).toBe(200); expect(response.body.lines).toHaveLength(1);
    expect(response.body.lines[0]).toMatchObject({ requestedQuantity: 4, status: "insufficient_quantity" });
    expect(response.body.subtotalCents).toBeNull();
  });
  it("applies a configured quantity rate to the combined selection of the same stock", async () => {
    const body = { lines: [...bodyFor(1).lines, ...bodyFor(1).lines] };
    const response = await review(body);
    expect(response.body.lines).toHaveLength(1); expect(response.body.subtotalCents).toBe(20000);
    expect(response.body.lines[0].pricingTier).toBe("bundle");
    expect(() => parseJwStoneCartReview(response.body, "member", body)).not.toThrow();
  });
  it.each([0, -1, 1.5, 1000, "2"])("rejects an invalid requested quantity %s", async (quantity) => {
    expect((await review({ lines: [{ inventoryPublicId: inventoryFixture.publicId, quantity }] })).status).toBe(400);
  });
  it("rejects client prices, totals, private IDs, and combined quantities above the bound", async () => {
    expect((await review({ ...bodyFor(1), subtotalCents: 1 })).status).toBe(400);
    expect((await review({ lines: [{ ...bodyFor(1).lines[0], unitRateCents: 1 }] })).status).toBe(400);
    expect((await review({ lines: [{ inventoryPublicId: "private-position-id", quantity: 1 }] })).status).toBe(400);
    expect((await review({ lines: [...bodyFor(600).lines, ...bodyFor(600).lines] })).status).toBe(400);
    expect((await review({ lines: [{ ...bodyFor(1).lines[0], heldQuantity: 0 }] })).status).toBe(400);
  });
  it.each([{ assetKind: "container" }, { unit: "bundles" }, { quantity: 2.5 }])("does not treat non-slab units as slab quantities: %j", async (overrides) => {
    inventoryFixture.overrides = overrides;
    const response = await review(bodyFor(1));
    expect(response.body.materialReady).toBe(false); expect(response.body.subtotalCents).toBeNull();
    expect(response.body.lines[0].status).toBe("slab_quantity_required");
  });
  it.each([null, { length: 120, height: 60, unit: null }])("requires dimensions with explicit units: %j", async (dimensions) => {
    inventoryFixture.overrides = { dimensions };
    const response = await review(bodyFor(1));
    expect(response.body.lines[0].status).toBe("dimensions_required"); expect(response.body.subtotalCents).toBeNull();
  });
  it("converts millimeters without changing the verified material total", async () => {
    inventoryFixture.overrides = { dimensions: { length: 3048, height: 1524, unit: "mm" } };
    expect((await review(bodyFor(1))).body.subtotalCents).toBe(15000);
  });
  it("does not project unpublished or missing stock", async () => {
    inventoryFixture.overrides = { isSaleReady: false };
    let response = await review(bodyFor(1));
    expect(response.body.lines[0]).toEqual({ inventoryPublicId: inventoryFixture.publicId, requestedQuantity: 1, status: "unavailable" });
    inventoryFixture.exists = false; response = await review(bodyFor(1));
    expect(response.body.lines[0].status).toBe("unavailable"); expect(response.body.subtotalCents).toBeNull();
  });
  it("keeps unknown delivery cost and timing null, not free or promised", async () => {
    const body = { ...bodyFor(1), fulfillment: { method: "delivery" as const, postalCode: "70401" } };
    const response = await review(body);
    expect(response.body.fulfillment).toEqual(body.fulfillment);
    expect(response.body.deliveryFeeCents).toBeNull(); expect(response.body.estimatedDeliveryDate).toBeNull();
    expect(response.body.readyForCheckout).toBe(false);
    expect(() => parseJwStoneCartReview(response.body, "member", body)).not.toThrow();
    expect((await review({ ...bodyFor(1), fulfillment: { method: "delivery", postalCode: "bad" } })).status).toBe(400);
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
    const response = await request(app).get("/api/u/jw-stone/member-pricing").set("x-fixture-viewer", "member");
    expect(response.status).toBe(403); expect(response.body.prices).toBeUndefined();
  });

  it("excludes already held slabs before approving a material total", async () => {
    await database.exec("UPDATE stone_inventory_positions SET held_quantity=2");
    const response = await review(bodyFor(2));
    expect(response.status).toBe(200);
    expect(response.body.materialReady).toBe(false);
    expect(response.body.subtotalCents).toBeNull();
    expect(response.body.lines[0]).toMatchObject({ availableQuantity: 1, requestedQuantity: 2, status: "insufficient_quantity" });
    expect(response.body.lines[0].pricingTier).toBeUndefined();
  });
  it("prices only the remaining slab when other slabs are already held", async () => {
    await database.exec("UPDATE stone_inventory_positions SET held_quantity=2");
    const response = await review(bodyFor(1));
    expect(response.status).toBe(200);
    expect(response.body.lines[0]).toMatchObject({ availableQuantity: 1, pricingTier: "slab", status: "ready" });
    expect(response.body.subtotalCents).toBe(15000);
    expect(() => parseJwStoneCartReview(response.body, "member", bodyFor(1))).not.toThrow();
    expect(JSON.stringify(response.body)).not.toMatch(/heldQuantity|held_quantity|position_id|private-position|allocation|buyer_user/i);
  });
  it("does not let duplicate cart rows reuse the same remaining unheld slab", async () => {
    await database.exec("UPDATE stone_inventory_positions SET held_quantity=2");
    const response = await review({ lines: [...bodyFor(1).lines, ...bodyFor(1).lines] });
    expect(response.body.lines).toHaveLength(1);
    expect(response.body.lines[0]).toMatchObject({ availableQuantity: 1, requestedQuantity: 2, status: "insufficient_quantity" });
    expect(response.body.subtotalCents).toBeNull();
  });
  it("reports zero available when the entire lot is already held", async () => {
    await database.exec("UPDATE stone_inventory_positions SET held_quantity=3");
    const response = await review(bodyFor(1));
    expect(response.body.lines[0]).toMatchObject({ availableQuantity: 0, status: "insufficient_quantity" });
    expect(response.body.subtotalCents).toBeNull();
  });
  it.each([null, "NaN", "Infinity", "-1", "0.5", "4"])("does not invent availability from an invalid held counter: %s", async (held) => {
    await database.query("UPDATE stone_inventory_positions SET held_quantity=$1::numeric", [held]);
    const response = await review(bodyFor(1));
    expect(response.status).toBe(200); expect(response.body.lines[0].status).toBe("unavailable");
    expect(response.body.subtotalCents).toBeNull();
  });
  it.each([
    "UPDATE stone_inventory_positions SET holder_business_id='other-supplier'",
    "UPDATE stone_inventory_positions SET lifecycle_status='sold'",
    "UPDATE stone_inventory_positions SET public_availability_status='not_published'",
    "UPDATE stone_inventory_positions SET published_at=NULL",
    "UPDATE stone_inventory_positions SET publication_evidence='{}'::jsonb",
    "UPDATE stone_inventory_positions SET publication_evidence='[]'::jsonb",
    "UPDATE stone_asset_passports SET passport_status='draft'",
    "UPDATE stone_asset_passports SET condition_json='{}'::jsonb",
    "UPDATE stone_asset_passports SET condition_json='{\"lastConfirmedAt\":\"2000-01-01T00:00:00Z\",\"confirmationExpiresAt\":\"2000-01-02T00:00:00Z\"}'::jsonb",
    "UPDATE stone_inventory_positions SET id='different-position'",
    "UPDATE stone_inventory_positions SET quantity=2",
    "UPDATE stone_inventory_positions SET unit='bundles'",
    "DELETE FROM stone_inventory_positions",
  ])("denies changed or unprovable current stock rather than using a stale seller snapshot: %s", async (sql) => {
    await database.exec(sql);
    const response = await review(bodyFor(1));
    expect(response.status).toBe(200); expect(response.body.lines[0].status).toBe("unavailable");
    expect(response.body.subtotalCents).toBeNull();
  });
  it("rejects ambiguous public-stock positions for the same seller", async () => {
    await database.exec("INSERT INTO stone_inventory_positions SELECT 'duplicate-position',asset_passport_id,holder_business_id,quantity,held_quantity,unit,lifecycle_status,public_availability_status,published_at,publication_evidence FROM stone_inventory_positions");
    const response = await review(bodyFor(1));
    expect(response.body.lines[0].status).toBe("unavailable"); expect(response.body.subtotalCents).toBeNull();
  });
  it("rechecks released stock without changing any allocation or creating an order", async () => {
    await database.exec("UPDATE stone_inventory_positions SET held_quantity=2");
    expect((await review(bodyFor(2))).body.materialReady).toBe(false);
    expect((await database.query("SELECT held_quantity FROM stone_inventory_positions")).rows[0].held_quantity).toBe("2");
    await database.exec("UPDATE stone_inventory_positions SET held_quantity=0");
    const response = await review(bodyFor(2));
    expect(response.body.lines[0]).toMatchObject({ availableQuantity: 3, pricingTier: "bundle" });
    expect(response.body.subtotalCents).toBe(20000);
    expect(response.body.inventoryReserved).toBe(false); expect(response.body.readyForCheckout).toBe(false);
    expect(databaseBridge.query.mock.calls.every(([sql]) => /^\s*SELECT\b/i.test(sql))).toBe(true);
  });
  it("does not fall back to full stock when the allocation query fails", async () => {
    databaseBridge.query.mockImplementation((sql, args) => {
      if (String(sql).includes("position.held_quantity")) throw new Error("Private allocation connection failed");
      return database.query(sql, args);
    });
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await review(bodyFor(1));
      expect(response.status).toBe(503); expect(response.body.subtotalCents).toBeUndefined();
      expect(response.body.message).toBe("JW Stone order review is temporarily unavailable.");
      expect(JSON.stringify(response.body)).not.toMatch(/Private allocation|connection/);
    } finally { logger.mockRestore(); }
  });
});
