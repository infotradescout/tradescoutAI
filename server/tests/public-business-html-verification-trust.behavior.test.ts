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
    expect(html).toContain("Travis County");
    expect(html).not.toContain("private-onboarding.example");
  });

  it("emits an external website only after explicit public-link consent and verification", async () => {
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

    expect(html).toContain("private-onboarding.example");
    expect(html).toContain('"sameAs"');
  });
});
