import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { JW_STONE_PRICING_DRIVE_FILE_ID, JW_STONE_PRICING_DRIVE_FOLDER_ID } from "@shared/jwStoneMemberPricing";
const databaseBridge = vi.hoisted(() => ({ query: vi.fn() }));
const inventoryFixture = vi.hoisted(() => ({ publicId: `stone_${"a".repeat(32)}` }));
vi.mock("../db", () => ({ pool: databaseBridge, db: {} }));
vi.mock("../auth", () => ({ isAuthenticated: (req: any, res: any, next: any) => req.user ? next() : res.status(401).json({ message: "Authentication required" }) }));
vi.mock("../schemaPreflight", () => ({ requireCriticalSchema: () => (_req: any, _res: any, next: any) => next() }));
vi.mock("../routes/jw-stone-receiving", () => ({ registerJwStoneReceivingRoutes() {} }));
vi.mock("../routes/profiles", () => ({ getPublicProfileTrustContext: async () => ({ businessId: "jw-business", profileSlug: "jw-stone" }) }));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async () => ({ profileId: "jw-profile", profileSlug: "jw-stone", profileStatus: "published", ownerUserId: "jw-owner", businessId: "jw-business", businessOwnerUserId: "jw-owner" }),
  hasStoneInventoryCapability: async () => false,
}));
import { registerJwStoneMemberPricingRoutes } from "../routes/jw-stone-member-pricing";
import { resetJwStoneDrivePricingCacheForTests } from "../services/jwStoneDrivePricing";

describe("JW Stone private pricing HTTP path", () => {
  const database = new PGlite();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { const id = req.get("x-fixture-viewer"); if (id) req.user = { id, role: id === "admin" ? "super_admin" : "business_owner" } as any; next(); });
  registerJwStoneMemberPricingRoutes(app);
  beforeAll(async () => {
    databaseBridge.query.mockImplementation((sql, args) => database.query(sql, args));
    await database.exec(`
      CREATE TABLE profiles (id text, slug text, business_id text);
      CREATE TABLE user_profiles (id text, user_id text, user_intent text, verification_status text);
      CREATE TABLE profile_accounts (id text, owner_user_id text, target_profile_id text, target_business_id text, business_profile_id text, identity_kind text, status text, verification_status text);
      CREATE TABLE profile_account_entitlements (profile_account_id text, product_key text, status text);
      INSERT INTO profiles VALUES ('jw-profile', 'jw-stone', 'jw-business');
      INSERT INTO user_profiles VALUES ('member-business', 'member', 'business', 'pending');
      INSERT INTO profile_accounts VALUES ('membership', 'member', 'jw-profile', 'jw-business', 'member-business', 'business', 'active', 'pending');
      INSERT INTO profile_account_entitlements VALUES ('membership', 'jw_stone_member_pricing', 'pending_verification');
      CREATE TABLE stone_materials (id text PRIMARY KEY, slug text, canonical_name text);
      CREATE TABLE stone_asset_passports (id text PRIMARY KEY, public_id text, material_id text REFERENCES stone_materials(id), source_asset_ref text, asset_kind text, passport_status text, dimensions_json jsonb, condition_json jsonb);
      CREATE TABLE stone_inventory_positions (asset_passport_id text REFERENCES stone_asset_passports(id), holder_business_id text, quantity numeric, held_quantity numeric, unit text, lifecycle_status text, public_availability_status text, published_at timestamptz, publication_evidence jsonb);
      INSERT INTO stone_materials VALUES ('material', 'test-stone', 'Test Stone');
      INSERT INTO stone_asset_passports VALUES ('passport', '${inventoryFixture.publicId}', 'material', 'private-source-ref', 'slab', 'verified', '{"length":120,"height":60,"thickness":1.25,"unit":"in"}', jsonb_build_object('lastConfirmedAt', NOW(), 'confirmationExpiresAt', NOW() + interval '7 days', 'ownerConfirmedName', 'Test Stone', 'privateNote', 'warehouse cost memo'));
      INSERT INTO stone_inventory_positions VALUES ('passport', 'jw-business', 3, 0, 'slabs', 'available', 'published_current', NOW(), '{"privateApproval":"approved"}');
    `);
    vi.stubEnv("JW_STONE_PRICING_SOURCE", "approved_import");
    vi.stubEnv("JW_STONE_PRICING_APPROVED_IMPORT", JSON.stringify({ schemaVersion: 1, fileId: JW_STONE_PRICING_DRIVE_FILE_ID, folderId: JW_STONE_PRICING_DRIVE_FOLDER_ID, sourceUpdatedAt: "2026-09-05T02:50:50.000Z", sourceRetrievedAt: "2026-09-06T03:00:00.000Z", prices: [{ stoneName: "Test Stone", stoneKey: "test stone", landedCostCents: 100, slabPriceCents: 300, bundlePriceCents: 200, bundleMinSlabs: 2 }] }));
    resetJwStoneDrivePricingCacheForTests();
  });
  afterAll(async () => { vi.unstubAllEnvs(); resetJwStoneDrivePricingCacheForTests(); await database.close(); });
  it("returns no prices to a guest", async () => { const response = await request(app).get("/api/u/jw-stone/member-pricing"); expect(response.status).toBe(401); expect(response.body.prices).toBeUndefined(); });
  it("returns no prices to a signed-in business without a JW membership", async () => { const response = await request(app).get("/api/u/jw-stone/member-pricing").set("x-fixture-viewer", "nonmember"); expect(response.status).toBe(403); expect(response.body.prices).toBeUndefined(); });
  it("delivers exact stone rates on membership creation and excludes internal cost and source IDs", async () => {
    const response = await request(app).get("/api/u/jw-stone/member-pricing").set("x-fixture-viewer", "member");
    expect(response.status).toBe(200); expect(response.body.access).toBe("member");
    expect(response.body.prices).toEqual([{ stoneName: "Test Stone", stoneKey: "test stone", slabPriceCents: 300, bundlePriceCents: 200, bundleMinSlabs: 2 }]);
    expect(JSON.stringify(response.body)).not.toMatch(/landed|fileId|folderId|sourceRetrievedAt/);
    expect(response.headers["cache-control"]).toBe("private, no-store"); expect(response.headers.vary).toContain("Cookie");
  });
  it.each(["admin", "jw-owner"])("preserves internal pricing for %s", async viewer => { const response = await request(app).get("/api/u/jw-stone/member-pricing").set("x-fixture-viewer", viewer); expect(response.status).toBe(200); expect(response.body.access).toBe("internal"); expect(response.body.prices[0].landedCostCents).toBe(100); });
  it("rejects cart review for guests and nonmembers", async () => {
    const body = { lines: [{ inventoryPublicId: inventoryFixture.publicId, quantity: 1 }] };
    expect((await request(app).post("/api/u/jw-stone/member-pricing/cart-review").send(body)).status).toBe(401);
    expect((await request(app).post("/api/u/jw-stone/member-pricing/cart-review").set("x-fixture-viewer", "nonmember").send(body)).status).toBe(403);
  });
  it("rechecks physical stock and slab pricing without promising checkout", async () => {
    const response = await request(app).post("/api/u/jw-stone/member-pricing/cart-review").set("x-fixture-viewer", "member").send({ lines: [{ inventoryPublicId: inventoryFixture.publicId, quantity: 1 }] });
    expect(response.status).toBe(200); expect(response.body.readyForRequest).toBe(true); expect(response.body.readyForCheckout).toBe(false); expect(response.body.reservationCreated).toBe(false); expect(response.body.subtotalCents).toBe(15000);
    expect(response.body.lines[0]).toMatchObject({ inventoryPublicId: inventoryFixture.publicId, requestedQuantity: 1, availableQuantity: 3, pricingTier: "slab", unitRateCents: 300, lineTotalCents: 15000, status: "ready" });
    expect(JSON.stringify(response.body)).not.toMatch(/landed|private-position|private-passport|warehouse|source-ref|privateApproval/i);
  });
  it("uses the bundle rate only after the configured slab threshold", async () => {
    const response = await request(app).post("/api/u/jw-stone/member-pricing/cart-review").set("x-fixture-viewer", "member").send({ lines: [{ inventoryPublicId: inventoryFixture.publicId, quantity: 2 }] });
    expect(response.status).toBe(200); expect(response.body.readyForRequest).toBe(true); expect(response.body.readyForCheckout).toBe(false); expect(response.body.subtotalCents).toBe(20000); expect(response.body.lines[0]).toMatchObject({ pricingTier: "bundle", unitRateCents: 200 });
  });
  it("fails closed when requested quantity exceeds current physical stock", async () => {
    const response = await request(app).post("/api/u/jw-stone/member-pricing/cart-review").set("x-fixture-viewer", "member").send({ lines: [{ inventoryPublicId: inventoryFixture.publicId, quantity: 4 }] });
    expect(response.status).toBe(200); expect(response.body.readyForCheckout).toBe(false); expect(response.body.subtotalCents).toBeNull(); expect(response.body.lines[0]).toMatchObject({ status: "insufficient_quantity", availableQuantity: 3 });
  });
  it("subtracts existing holds before reviewing another request", async () => {
    await database.exec("UPDATE stone_inventory_positions SET held_quantity = 1");
    try {
      const response = await request(app).post("/api/u/jw-stone/member-pricing/cart-review").set("x-fixture-viewer", "member").send({ lines: [{ inventoryPublicId: inventoryFixture.publicId, quantity: 3 }] });
      expect(response.status).toBe(200); expect(response.body.subtotalCents).toBeNull(); expect(response.body.lines[0]).toMatchObject({ status: "insufficient_quantity", availableQuantity: 2 });
    } finally { await database.exec("UPDATE stone_inventory_positions SET held_quantity = 0"); }
  });
  it("rejects duplicate lot IDs instead of counting stock twice", async () => {
    const line = { inventoryPublicId: inventoryFixture.publicId, quantity: 2 };
    const response = await request(app).post("/api/u/jw-stone/member-pricing/cart-review").set("x-fixture-viewer", "member").send({ lines: [line, line] });
    expect(response.status).toBe(400);
  });
  it("exposes buyer cart access separately from employee authority", async () => {
    const member = await request(app).get("/api/u/jw-stone/member-pricing/cart-access").set("x-fixture-viewer", "member");
    const admin = await request(app).get("/api/u/jw-stone/member-pricing/cart-access").set("x-fixture-viewer", "admin");
    expect(member.body.allowed).toBe(true); expect(admin.body.allowed).toBe(false); expect(member.headers["cache-control"]).toBe("private, no-store");
  });
  it("stops returning prices immediately after membership is suspended", async () => {
    await database.exec("UPDATE profile_accounts SET status = 'suspended'");
    const response = await request(app).get("/api/u/jw-stone/member-pricing").set("x-fixture-viewer", "member");
    expect(response.status).toBe(403); expect(response.body.prices).toBeUndefined();
    const access = await request(app).get("/api/u/jw-stone/member-pricing/cart-access").set("x-fixture-viewer", "member"); expect(access.body.allowed).toBe(false);
  });
});
