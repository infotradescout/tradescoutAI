import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as any[],
}));

vi.mock("../db", () => {
  const query: any = {};
  query.select = vi.fn(() => query);
  query.from = vi.fn(() => query);
  query.leftJoin = vi.fn(() => query);
  query.innerJoin = vi.fn(() => query);
  query.where = vi.fn(() => query);
  query.orderBy = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.offset = vi.fn(() => query);
  query.then = (resolve: any, reject: any) => Promise.resolve(mocks.rows).then(resolve, reject);
  return { db: query };
});

vi.mock("../storage", () => ({ storage: {} }));
vi.mock("../auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
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

import { businessDirectoryPublicRouter } from "../routes/business-directory-public";
import { canServePublicBusinessDetail } from "../publicationBusiness";

function onboardingBusinessRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "business-onboarding-1",
    ownerUserId: "owner-1",
    name: "Pending Onboarding Business",
    slug: "pending-onboarding-business",
    type: "contractor",
    roleContext: "business_owner",
    status: "active",
    claimStatus: "claimed",
    profileData: {
      category: "Electrical Contractor",
      services: ["Electrical repair"],
      city: "Austin",
      description: "PRIVATE ONBOARDING BUSINESS EVIDENCE",
      phone: "512-555-0199",
      email: "private@example.com",
    },
    updatedAt: new Date(),
    publicDiscoveryEnabled: true,
    businessSources: ["selective_intelligence_onboarding"],
    ownerVerificationStatus: "pending",
    ownerAddressVerified: false,
    county: {
      fips: "48453",
      stateCode: "TX",
      name: "Travis County",
    },
    ...overrides,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(businessDirectoryPublicRouter);
  return app;
}

describe("onboarding business public-detail trust boundary", () => {
  beforeEach(() => {
    mocks.rows = [onboardingBusinessRow()];
  });

  it("rejects pending onboarding evidence from the public detail-by-id route", async () => {
    const response = await request(buildApp()).get("/api/businesses/business-onboarding-1");

    expect(response.status).toBe(410);
    expect(response.text).not.toContain("PRIVATE ONBOARDING BUSINESS EVIDENCE");
    expect(response.text).not.toContain("512-555-0199");
    expect(response.text).not.toContain("private@example.com");
  });

  it("rejects pending onboarding evidence from the public detail-by-slug route", async () => {
    const response = await request(buildApp()).get(
      "/api/public/businesses/pending-onboarding-business"
    );

    expect(response.status).toBe(410);
    expect(response.text).not.toContain("PRIVATE ONBOARDING BUSINESS EVIDENCE");
    expect(response.text).not.toContain("512-555-0199");
    expect(response.text).not.toContain("private@example.com");
  });

  it("omits a claimed-unverified onboarding business from public directory search", async () => {
    const response = await request(buildApp()).get(
      "/api/businesses?stateCode=TX&q=Pending%20Onboarding"
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.text).not.toContain("PRIVATE ONBOARDING BUSINESS EVIDENCE");
  });

  it("keeps verified onboarding businesses behind the existing public-safe projection", async () => {
    mocks.rows = [
      onboardingBusinessRow({
        ownerVerificationStatus: "approved",
        ownerAddressVerified: true,
      }),
    ];

    const response = await request(buildApp()).get(
      "/api/public/businesses/pending-onboarding-business"
    );

    expect(response.status).toBe(200);
    expect(response.body.profile.description).toBe("PRIVATE ONBOARDING BUSINESS EVIDENCE");
    expect(response.text).not.toContain("512-555-0199");
    expect(response.text).not.toContain("private@example.com");
  });

  it.each(["HVAC contractor", "Air conditioning contractor"])(
    "serves an eligible imported %s detail through the public-safe projection",
    async (category) => {
      mocks.rows = [
        onboardingBusinessRow({
          ownerVerificationStatus: "approved",
          ownerAddressVerified: true,
          profileData: { category, services: [category], phone: "512-555-0199" },
        }),
      ];
      const response = await request(buildApp()).get(
        "/api/public/businesses/pending-onboarding-business"
      );
      expect(response.status).toBe(200);
      expect(response.body.profile.category).toBe(category);
      expect(response.text).not.toContain("512-555-0199");
    }
  );

  it("preserves public-record reads while verification-gating owned business evidence", () => {
    expect(
      canServePublicBusinessDetail({
        publication: { ok: true },
        tier: "unclaimed",
      })
    ).toBe(true);
    expect(
      canServePublicBusinessDetail({
        publication: { ok: true },
        tier: "claimed_unverified",
      })
    ).toBe(false);
    expect(
      canServePublicBusinessDetail({
        publication: { ok: true },
        tier: "verified",
      })
    ).toBe(true);
    expect(
      canServePublicBusinessDetail({
        publication: { ok: false, reason: "missing_geography" },
        tier: "verified",
      })
    ).toBe(false);
  });

  it("gates the duplicate public slug implementation with the same policy", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/businesses.ts"),
      "utf8"
    );
    const publicSlugRoute = source.slice(
      source.indexOf("// Public profile read (no auth, indexable)"),
      source.indexOf("export { router as businessesRouter }")
    );

    expect(publicSlugRoute).toContain("canServePublicBusinessDetail({");
    expect(publicSlugRoute).toContain("publication: pub");
    expect(publicSlugRoute).toContain("tier,");
    expect(publicSlugRoute.indexOf("canServePublicBusinessDetail({")).toBeLessThan(
      publicSlugRoute.indexOf("const publicProfile =")
    );
  });
});
