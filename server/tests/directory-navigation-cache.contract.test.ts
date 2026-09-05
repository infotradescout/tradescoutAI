import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listActiveTradeScopes: vi.fn(async () => [{ tradeSlug: "electrician", businessCount: 12 }]),
  readRows: vi.fn(),
}));

vi.mock("../db", () => {
  const query: any = {};
  for (const method of [
    "select",
    "from",
    "leftJoin",
    "innerJoin",
    "where",
    "orderBy",
    "limit",
    "offset",
  ]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: any, reject: any) => mocks.readRows().then(resolve, reject);
  return { db: query };
});
vi.mock("../storage", () => ({ storage: {} }));
vi.mock("../auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../publicationRules", () => ({
  getPublicationRules: vi.fn(async () => ({
    listingStaleDaysUnclaimed: 365,
    listingStaleDaysClaimedUnverified: 180,
    listingStaleDaysVerified: 730,
    requestPublicSummaryTtlHours: 72,
    categoryPageRecencyWindowDays: 90,
  })),
}));
vi.mock("../services/seoDirectoryNavigationService", () => ({
  listActiveTradeScopes: mocks.listActiveTradeScopes,
  listActiveTradeStateScopes: vi.fn(async () => []),
  listActiveTradeCountyScopes: vi.fn(async () => []),
  listActiveCountyTradeScopes: vi.fn(async () => []),
}));

import { businessDirectoryPublicRouter } from "../routes/business-directory-public";

function buildApp() {
  const app = express();
  app.use(businessDirectoryPublicRouter);
  return app;
}

describe("directory navigation response cache", () => {
  beforeEach(() => {
    mocks.readRows.mockReset();
    mocks.readRows.mockResolvedValue([]);
  });

  it("responds to every request while reusing the cached plain payload", async () => {
    const app = buildApp();
    const first = await request(app)
      .get("/api/public/seo/directory-navigation")
      .timeout({ response: 500, deadline: 1_000 });
    const second = await request(app)
      .get("/api/public/seo/directory-navigation")
      .timeout({ response: 500, deadline: 1_000 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual({
      scope: "trades",
      trades: [{ tradeSlug: "electrician", businessCount: 12 }],
    });
    expect(second.body).toEqual(first.body);
    expect(mocks.listActiveTradeScopes).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["business search", "/api/businesses?countyFips=12005&trade=electrical&claimed=any"],
    [
      "verified county listings",
      "/api/public/seo/best/trade-county?tradeSlug=electrical&stateCode=FL&countySlug=bay",
    ],
  ])("responds to repeat %s requests with the same public payload", async (_name, url) => {
    mocks.readRows.mockResolvedValue([
      {
        id: "verified-business",
        name: "Verified Electrician",
        slug: "verified-electrician",
        type: "contractor",
        roleContext: "business_owner",
        status: "active",
        claimStatus: "claimed",
        ownerUserId: "verified-owner",
        ownerVerificationStatus: "approved",
        ownerAddressVerified: true,
        publicDiscoveryEnabled: true,
        updatedAt: new Date(),
        profileData: { category: "Electrical Contractor", phone: "PRIVATE-CONTACT" },
        county: { fips: "12005", stateCode: "FL", name: "Bay County" },
      },
      {
        id: "private-business",
        name: "PRIVATE-LISTING",
        slug: "private-listing",
        publicDiscoveryEnabled: false,
        updatedAt: new Date(),
      },
    ]);
    const app = buildApp();
    const first = await request(app).get(url).timeout({ response: 500, deadline: 1_000 });
    const second = await request(app).get(url).timeout({ response: 500, deadline: 1_000 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].slug).toBe("verified-electrician");
    expect(second.text).not.toContain("PRIVATE-CONTACT");
    expect(second.text).not.toContain("PRIVATE-LISTING");
    expect(mocks.readRows).toHaveBeenCalledTimes(1);
  });

  it.each([
    "/api/businesses?countyFips=12005&q=no-results",
    "/api/public/seo/best/trade-county?tradeSlug=plumbing&stateCode=FL&countySlug=bay",
  ])("returns a truthful empty result again for %s", async (url) => {
    const app = buildApp();
    for (let visit = 0; visit < 2; visit += 1) {
      const response = await request(app).get(url).timeout({ response: 500, deadline: 1_000 });
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    }
    expect(mocks.readRows).toHaveBeenCalledTimes(1);
  });

  it.each(["/api/businesses", "/api/public/seo/best/trade-county?tradeSlug=invalid-trade"])(
    "ends every invalid-scope response for %s",
    async (url) => {
      const app = buildApp();
      for (let visit = 0; visit < 2; visit += 1) {
        const response = await request(app).get(url).timeout({ response: 500, deadline: 1_000 });
        expect(response.status).toBe(400);
        expect(response.body.message).toEqual(expect.any(String));
      }
      expect(mocks.readRows).not.toHaveBeenCalled();
    }
  );

  it.each([
    "/api/businesses?countyFips=12005&q=transient-failure",
    "/api/public/seo/best/trade-county?tradeSlug=roofing&stateCode=FL&countySlug=bay",
  ])("allows recovery after a temporary database failure for %s", async (url) => {
    mocks.readRows.mockRejectedValueOnce(new Error("temporary database failure"));
    const app = buildApp();
    const first = await request(app).get(url).timeout({ response: 500, deadline: 1_000 });
    const second = await request(app).get(url).timeout({ response: 500, deadline: 1_000 });

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(second.body.items).toEqual([]);
    expect(mocks.readRows).toHaveBeenCalledTimes(2);
  });
});
