import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBusinessProfileBySlug: vi.fn(),
  getBusinessBySlugPublic: vi.fn(),
  getBusinessCountyIds: vi.fn(),
  countyRows: [] as any[],
  ownerRows: [] as any[],
}));

vi.mock("../storage", () => ({
  storage: {
    getBusinessProfileBySlug: mocks.getBusinessProfileBySlug,
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

import { buildPublicBusinessHtml } from "../publicBusinessHtml";

const templateHtml = `<!doctype html><html><head>
<title>TradeScout</title>
<meta name="description" content="TradeScout" />
<meta name="keywords" content="TradeScout" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="TradeScout" />
<meta property="og:description" content="TradeScout" />
<meta property="og:url" content="https://www.thetradescout.com" />
<meta property="og:image" content="/tradescout-social-preview.png" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="TradeScout" />
<meta name="twitter:description" content="TradeScout" />
<meta name="twitter:image" content="/tradescout-social-preview.png" />
<link rel="canonical" href="https://www.thetradescout.com" />
</head><body><div id="root"></div></body></html>`;

const pendingBusiness = {
  id: "business-1",
  ownerUserId: "owner-1",
  name: "Pending Business",
  slug: "pending-business",
  status: "active",
  claimStatus: "claimed",
  publicDiscoveryEnabled: true,
  updatedAt: new Date(),
  profileData: {
    tagline: "PRIVATE ONBOARDING TAGLINE",
    description: "PRIVATE ONBOARDING DESCRIPTION",
    category: "electrician",
    services: ["PRIVATE ONBOARDING SERVICE"],
    city: "PRIVATE ONBOARDING CITY",
    website: "https://private-onboarding.example",
  },
};

describe("public business HTML verification trust", () => {
  beforeEach(() => {
    mocks.getBusinessProfileBySlug.mockReset().mockResolvedValue(undefined);
    mocks.getBusinessBySlugPublic.mockReset().mockResolvedValue({ ...pendingBusiness });
    mocks.getBusinessCountyIds.mockReset().mockResolvedValue(["county-1"]);
    mocks.countyRows = [{ name: "Travis County", stateCode: "TX" }];
    mocks.ownerRows = [{ verificationStatus: "pending", addressVerified: false }];
  });

  it("renders only a neutral noindex shell for claimed-unverified onboarding evidence", async () => {
    const html = await buildPublicBusinessHtml({
      slug: "pending-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('data-seo-business="stale"');
    expect(html).toContain('content="noindex,nofollow"');
    expect(html).toContain("Pending Business");
    expect(html).not.toContain("PRIVATE ONBOARDING");
    expect(html).not.toContain("private-onboarding.example");
    expect(html).not.toContain("electrician");
    expect(html).not.toContain("Travis County");
    expect(html).not.toContain('type="application/ld+json"');
    expect(html).not.toContain('"sameAs"');
    expect(html).not.toContain('"category"');
    expect(html).not.toContain('"areaServed"');
    expect(html).not.toContain('"hasCredential"');
    expect(html).not.toContain('name="tradescout-business-slug"');
    expect(html).not.toContain('name="tradescout-discovery-route"');
  });

  it("does not render an unverified legacy profile draft", async () => {
    mocks.getBusinessProfileBySlug.mockResolvedValue({
      userId: "owner-1",
      slug: "pending-business",
      name: "PRIVATE LEGACY NAME",
      visibility: "public",
      verificationStatus: "pending",
      verifiedBadge: false,
      description: "PRIVATE LEGACY DESCRIPTION",
    });

    const html = await buildPublicBusinessHtml({
      slug: "pending-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).not.toContain("PRIVATE LEGACY");
    expect(html).toContain('data-seo-business="stale"');
  });

  it("renders the public-safe evidence after the existing verification tier passes", async () => {
    mocks.ownerRows = [{ verificationStatus: "approved", addressVerified: true }];

    const html = await buildPublicBusinessHtml({
      slug: "pending-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('data-seo-business="true"');
    expect(html).toContain("PRIVATE ONBOARDING DESCRIPTION");
    expect(html).toContain("electrician");
    expect(html).toContain("PRIVATE ONBOARDING SERVICE");
    expect(html).toContain("Travis County");
    expect(html).not.toContain("private-onboarding.example");
    expect(html).toContain('<meta name="tradescout-business-slug" content="pending-business" />');
    expect(html).toContain(
      '<meta name="tradescout-business-entity-type" content="business_profile" />'
    );
    expect(html).toContain(
      '<meta name="tradescout-discovery-route" content="/business/pending-business" />'
    );
  });

  it("renders a substantive fact-bearing service-only directory record without PII", async () => {
    mocks.ownerRows = [{ verificationStatus: "approved", addressVerified: true }];
    mocks.getBusinessBySlugPublic.mockResolvedValue({
      ...pendingBusiness,
      name: "Gulf Coast Roof Response",
      slug: "gulf-coast-roof-response",
      profileData: {
        services: [
          "Roofing",
          "Emergency roof leak repair",
          "Storm-damaged shingle replacement",
          "Residential roof inspection",
        ],
        city: "Austin",
        stateCode: "TX",
        address: "123 Private Street",
        zipCode: "78701",
        phone: "512-555-0199",
        email: "roof@example.test",
        website: "https://roof.example.test",
      },
    });

    const html = await buildPublicBusinessHtml({
      slug: "gulf-coast-roof-response",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('data-seo-business="true"');
    expect(html).toContain("Emergency roof leak repair");
    expect(html).toContain('"@type":"Service"');
    expect(html).toContain("/trade/roofing/tx/travis");
    expect(html).not.toMatch(
      /123 Private Street|78701|512-555-0199|roof@example\.test|roof\.example\.test/
    );
    const visibleText = String(html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    expect(visibleText.length).toBeGreaterThanOrEqual(180);
  });

  it("prefers a governed directory record over a colliding verified legacy draft", async () => {
    mocks.ownerRows = [{ verificationStatus: "approved", addressVerified: true }];
    mocks.getBusinessProfileBySlug.mockResolvedValue({
      userId: "legacy-owner",
      slug: "pending-business",
      name: "LEGACY COLLISION NAME",
      visibility: "public",
      verificationStatus: "approved",
      verifiedBadge: true,
      description: "LEGACY COLLISION DESCRIPTION",
    });

    const html = await buildPublicBusinessHtml({
      slug: "pending-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('data-seo-business="true"');
    expect(html).toContain('content="index, follow');
    expect(html).toContain("Pending Business");
    expect(html).not.toContain("LEGACY COLLISION");
  });

  it("keeps an ineligible directory collision noindex instead of widening through legacy", async () => {
    mocks.getBusinessProfileBySlug.mockResolvedValue({
      userId: "legacy-owner",
      slug: "pending-business",
      name: "LEGACY COLLISION NAME",
      visibility: "public",
      verificationStatus: "approved",
      verifiedBadge: true,
      description: "LEGACY COLLISION DESCRIPTION",
    });

    const html = await buildPublicBusinessHtml({
      slug: "pending-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('data-seo-business="stale"');
    expect(html).toContain('content="noindex,nofollow"');
    expect(html).not.toContain("LEGACY COLLISION");
  });

  it("does not replace malformed publication timestamps with now", async () => {
    mocks.ownerRows = [{ verificationStatus: "approved", addressVerified: true }];
    mocks.getBusinessBySlugPublic.mockResolvedValue({
      ...pendingBusiness,
      updatedAt: "not-a-date",
    });

    const html = await buildPublicBusinessHtml({
      slug: "pending-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('data-seo-business="stale"');
    expect(html).toContain('content="noindex,nofollow"');
    expect(html).not.toContain('name="tradescout-business-slug"');
  });

  it("keeps external websites out of governed directory SSR even when source flags are true", async () => {
    mocks.ownerRows = [{ verificationStatus: "approved", addressVerified: true }];
    mocks.getBusinessBySlugPublic.mockResolvedValue({
      ...pendingBusiness,
      profileData: {
        ...pendingBusiness.profileData,
        publicWebsiteEnabled: true,
      },
    });

    const html = await buildPublicBusinessHtml({
      slug: "pending-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).not.toContain("private-onboarding.example");
    expect(html).not.toContain('"sameAs"');
  });

  it("uses the governed primary state and omits a foreign imported city link", async () => {
    mocks.ownerRows = [{ verificationStatus: "approved", addressVerified: true }];
    mocks.countyRows = [
      { id: "county-al", name: "Baldwin County", stateCode: "AL", fips: "01003" },
    ];
    mocks.getBusinessBySlugPublic.mockResolvedValue({
      ...pendingBusiness,
      profileData: {
        ...pendingBusiness.profileData,
        city: "Pensacola",
        stateCode: "FL",
      },
    });

    const html = await buildPublicBusinessHtml({
      slug: "pending-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('data-seo-business="true"');
    expect(html).toContain("Baldwin County");
    expect(html).toContain("/county/al/baldwin");
    expect(html).not.toContain("/city/al/pensacola");
    expect(html).not.toContain("Browse Pensacola");
  });

  it("does not render imported street, ZIP, contact, maps, review, or arbitrary extras", async () => {
    mocks.ownerRows = [{ verificationStatus: "approved", addressVerified: true }];
    mocks.getBusinessBySlugPublic.mockResolvedValue({
      ...pendingBusiness,
      profileData: {
        ...pendingBusiness.profileData,
        tagline: "Call 850-555-0199",
        description: "Email owner@private.example or visit private.example/contact",
        address: "123 Private Street",
        zipCode: "32501",
        phone: "850-555-0199",
        email: "owner@private.example",
        publicLocationEnabled: null,
        publicWebsiteEnabled: true,
        importExtras: {
          google_maps_url: "https://maps.example/private",
          review_url: "https://reviews.example/private",
          secret: "DO NOT PUBLISH",
        },
      },
    });

    const html = await buildPublicBusinessHtml({
      slug: "pending-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('data-seo-business="true"');
    expect(html).toContain("Continue through TradeScout");
    expect(html).not.toMatch(
      /123 Private Street|32501|850-555-0199|owner@private\.example|private\.example|maps\.example|reviews\.example|DO NOT PUBLISH/
    );
    expect(html).not.toContain('"sameAs"');
  });
});
