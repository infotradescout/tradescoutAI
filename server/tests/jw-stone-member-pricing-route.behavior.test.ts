import express from "express";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  JW_STONE_PRICING_DRIVE_FILE_ID,
  JW_STONE_PRICING_DRIVE_FOLDER_ID,
} from "@shared/jwStoneMemberPricing";

const databaseBridge = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../db", () => ({ pool: databaseBridge, db: {} }));
vi.mock("../auth", () => ({
  isAuthenticated: (req: any, res: any, next: any) =>
    req.user ? next() : res.status(401).json({ message: "Authentication required" }),
}));
vi.mock("../schemaPreflight", () => ({
  requireCriticalSchema: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async () => ({
    ownerUserId: "jw-owner",
    businessOwnerUserId: "jw-owner",
  }),
  hasStoneInventoryCapability: async () => false,
}));
import { registerJwStoneMemberPricingRoutes } from "../routes/jw-stone-member-pricing";
import { resetJwStoneDrivePricingCacheForTests } from "../services/jwStoneDrivePricing";

describe("JW Stone private pricing HTTP path", () => {
  const database = new PGlite();
  const app = express();
  app.use((req, _res, next) => {
    const id = req.get("x-fixture-viewer");
    if (id) req.user = { id, role: id === "admin" ? "super_admin" : "business_owner" } as any;
    next();
  });
  registerJwStoneMemberPricingRoutes(app);

  beforeAll(async () => {
    databaseBridge.query.mockImplementation((sql, args) => database.query(sql, args));
    await database.exec(`
      CREATE TABLE profiles (id text, slug text, business_id text);
      CREATE TABLE user_profiles (id text, user_id text, user_intent text, verification_status text);
      CREATE TABLE profile_accounts (
        id text, owner_user_id text, target_profile_id text, target_business_id text,
        business_profile_id text, identity_kind text, status text, verification_status text
      );
      CREATE TABLE profile_account_entitlements (profile_account_id text, product_key text, status text);
      INSERT INTO profiles VALUES ('jw-profile', 'jw-stone', 'jw-business');
      INSERT INTO user_profiles VALUES ('member-business', 'member', 'business', 'pending');
      INSERT INTO profile_accounts VALUES ('membership', 'member', 'jw-profile', 'jw-business',
        'member-business', 'business', 'active', 'pending');
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
  it.each(["admin", "jw-owner"])("preserves internal pricing for %s", async (viewer) => {
    const response = await request(app)
      .get("/api/u/jw-stone/member-pricing")
      .set("x-fixture-viewer", viewer);
    expect(response.status).toBe(200);
    expect(response.body.access).toBe("internal");
    expect(response.body.prices[0].landedCostCents).toBe(100);
  });
  it("stops returning prices immediately after membership is suspended", async () => {
    await database.exec("UPDATE profile_accounts SET status = 'suspended'");
    const response = await request(app)
      .get("/api/u/jw-stone/member-pricing")
      .set("x-fixture-viewer", "member");
    expect(response.status).toBe(403);
    expect(response.body.prices).toBeUndefined();
  });
});
