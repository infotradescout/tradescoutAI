import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  business: null as any,
  countyIds: ["county-1"] as string[],
  countyRows: [] as any[],
  ownerRows: [] as any[],
  getBusinessBySlugPublic: vi.fn(),
  getBusinessCountyIds: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getBusinessBySlugPublic: mocks.getBusinessBySlugPublic,
    getBusinessCountyIds: mocks.getBusinessCountyIds,
  },
}));

vi.mock("../db", () => ({
  db: {
    select: (selection: Record<string, unknown>) => {
      const rows = Object.prototype.hasOwnProperty.call(selection, "verificationStatus")
        ? mocks.ownerRows
        : mocks.countyRows;
      const query: any = {};
      query.from = () => query;
      query.where = () => query;
      query.limit = async () => rows;
      query.then = (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject);
      return query;
    },
  },
}));

vi.mock("../auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../routes/plugin-api", () => ({
  pluginApiRouter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../routes/plugin-oauth", () => ({
  pluginOAuthRouter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../publicationRules", () => ({
  getPublicationRules: vi.fn(async () => ({
    listingStaleDaysUnclaimed: 365,
    listingStaleDaysClaimedUnverified: 180,
    listingStaleDaysVerified: 730,
    requestPublicSummaryTtlHours: 72,
    categoryPageRecencyWindowDays: 90,
    proofMediaTtlDays: null,
  })),
}));

import { businessesRouter } from "../routes/businesses";

function publicBusiness(overrides: Record<string, unknown> = {}) {
  return {
    id: "business-1",
    ownerUserId: null,
    name: "Gulf Roofing 850-555-0199 owner@private.example roof.example",
    slug: "gulf-roofing",
    type: "contractor",
    roleContext: "business_owner",
    status: "active",
    claimStatus: "unclaimed",
    publicDiscoveryEnabled: true,
    updatedAt: new Date("2026-08-23T12:00:00.000Z"),
    profileData: {
      tagline: "Roof help 850-555-0199",
      description: "Email owner@private.example or visit roof.example/contact",
      category: "Roofing",
      services: ["Roofing", "Call 850-555-0199"],
      city: "Pensacola",
      stateCode: "FL",
      address: "123 Private Street",
      zipCode: "32501",
      phone: "850-555-0199",
      email: "owner@private.example",
      website: "https://roof.example",
      importExtras: {
        average_rating: "4.8",
        review_count: "17",
        google_maps_url: "https://maps.example/private",
        review_url: "https://reviews.example/private",
      },
    },
    ...overrides,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(businessesRouter);
  return app;
}

describe("actual business hydration route parity", () => {
  beforeEach(() => {
    mocks.business = publicBusiness();
    mocks.getBusinessBySlugPublic.mockReset().mockImplementation(async () => mocks.business);
    mocks.getBusinessCountyIds.mockReset().mockResolvedValue(["county-1"]);
    mocks.countyRows = [
      { id: "county-1", name: "Escambia County", stateCode: "FL", fips: "12033" },
    ];
    mocks.ownerRows = [];
  });

  it("returns the governed crawlable projection without raw contact/location vectors", async () => {
    const response = await request(buildApp()).get("/api/public/businesses/gulf-roofing");

    expect(response.status).toBe(200);
    expect(response.body.publication).toEqual({
      crawlable: true,
      reason: null,
      tier: "unclaimed",
    });
    expect(response.body.name).toBe("Gulf Roofing");
    expect(response.body.profile.importExtras).toMatchObject({
      averageRating: 4.8,
      reviewCount: 17,
      source: "google_import",
    });
    expect(response.text).not.toMatch(
      /850-555-0199|owner@private\.example|roof\.example|123 Private Street|32501|maps\.example|reviews\.example/
    );
  });

  it("returns bounded verified trust truth and rejects malformed publication time", async () => {
    mocks.business = publicBusiness({
      ownerUserId: "owner-1",
      claimStatus: "claimed",
      name: "Verified Gulf Roofing",
    });
    mocks.ownerRows = [{ verificationStatus: "approved", addressVerified: true }];
    const verified = await request(buildApp()).get("/api/public/businesses/gulf-roofing");
    expect(verified.status).toBe(200);
    expect(verified.body.publication.tier).toBe("verified");

    mocks.business = publicBusiness({ updatedAt: "malformed" });
    mocks.ownerRows = [];
    const malformed = await request(buildApp()).get("/api/public/businesses/gulf-roofing");
    expect(malformed.status).toBe(410);
    expect(malformed.text).not.toContain("Roof help");
  });

  it("uses stable governed geography and only keeps an imported city in the matching primary state", async () => {
    mocks.countyRows = [
      { id: "county-la", name: "Orleans Parish", stateCode: "LA", fips: "22071" },
      { id: "county-fl-2", name: "Santa Rosa County", stateCode: "FL", fips: "12113" },
      { id: "county-al", name: "Baldwin County", stateCode: "AL", fips: "01003" },
      { id: "county-fl-1", name: "Escambia County", stateCode: "FL", fips: "12033" },
    ];
    mocks.getBusinessCountyIds.mockResolvedValue([
      "county-la",
      "county-fl-2",
      "county-al",
      "county-fl-1",
    ]);

    const matching = await request(buildApp()).get("/api/public/businesses/gulf-roofing");
    expect(matching.status).toBe(200);
    expect(matching.body.counties.map((row: any) => row.id)).toEqual([
      "county-fl-1",
      "county-fl-2",
      "county-al",
      "county-la",
    ]);
    expect(matching.body.profile).toMatchObject({ city: "Pensacola", stateCode: "FL" });

    mocks.countyRows = [
      { id: "county-al", name: "Baldwin County", stateCode: "AL", fips: "01003" },
    ];
    mocks.getBusinessCountyIds.mockResolvedValue(["county-al"]);
    const mismatched = await request(buildApp()).get("/api/public/businesses/gulf-roofing");
    expect(mismatched.status).toBe(200);
    expect(mismatched.body.profile.stateCode).toBe("AL");
    expect(mismatched.body.profile).not.toHaveProperty("city");
    expect(mismatched.text).not.toContain("Pensacola");
  });

  it("hydrates crawl and trust labels from publication truth and only offers claims when unclaimed", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/BusinessProfileView.tsx"),
      "utf8"
    );
    expect(source).toContain('directoryData?.publication?.tier === "verified"');
    expect(source).toContain('directoryTier === "verified" ? "approved" : "pending"');
    expect(source).toContain('addressVerified: (directoryTier === "verified")');
    expect(source).toContain("directoryData?.publication || null");
    expect(source).toContain('directoryClaimStatus === "unclaimed"');
    expect(source).toContain("stateCode: primaryStateCode || publicProfileStateCode || null");
    expect(source).toContain("publicProfileStateCode === primaryStateCode");
  });
});
