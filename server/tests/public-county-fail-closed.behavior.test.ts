import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listActiveCountyTradeScopes: vi.fn(),
  getPublicationRules: vi.fn(),
  select: vi.fn(),
}));

vi.mock("../services/seoDirectoryNavigationService", () => ({
  listActiveCountyTradeScopes: (...args: unknown[]) =>
    mocks.listActiveCountyTradeScopes(...args),
}));

vi.mock("../publicationRules", () => ({
  getPublicationRules: (...args: unknown[]) => mocks.getPublicationRules(...args),
}));

vi.mock("../db", () => ({
  db: {
    select: (...args: unknown[]) => mocks.select(...args),
  },
}));

vi.mock("@shared/publication", () => ({
  isPublicAndCrawlableBusiness: vi.fn(() => ({ indexable: true })),
}));

vi.mock("../publicationBusiness", () => ({
  buildPublicBusinessSignals: vi.fn((value: unknown) => value),
  canServePublicBusinessDetail: vi.fn(() => true),
  derivePublicationTier: vi.fn(() => "verified"),
  deriveTradeSlugFromProfileData: vi.fn(() => "plumbing"),
  publicBusinessDetailExposureSqlPredicate: vi.fn(() => undefined),
}));

import { buildPublicCountyHtml } from "../publicCountyHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="keywords" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

function mockCountyRows(rows: unknown[]) {
  const chain: Record<string, any> = {};
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(async () => rows);
  mocks.select.mockReturnValue(chain);
  return chain;
}

describe("snapshot-backed public county pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicationRules.mockResolvedValue({ categoryPageRecencyWindowDays: 365 });
  });

  it("returns not found before publication or listing work when the county has no active scope", async () => {
    mocks.listActiveCountyTradeScopes.mockResolvedValue([]);

    const html = await buildPublicCountyHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      stateCode: "FL",
      countySlug: "bay",
    });

    expect(html).toBeNull();
    expect(mocks.listActiveCountyTradeScopes).toHaveBeenCalledWith("FL", "bay");
    expect(mocks.getPublicationRules).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("uses the active snapshot as the county's exact trade-link set", async () => {
    mocks.listActiveCountyTradeScopes.mockResolvedValue([
      { tradeSlug: "plumbing", businessCount: 2 },
      { tradeSlug: "electrical", businessCount: 1 },
    ]);
    mockCountyRows([
      {
        id: "business-1",
        slug: "bay-county-plumbing",
        name: "Bay County Plumbing",
        claimStatus: "claimed",
        ownerUserId: "owner-1",
        updatedAt: new Date("2026-08-25T12:00:00.000Z"),
        publicDiscoveryEnabled: true,
        profileData: { category: "Plumbing" },
        ownerVerificationStatus: "approved",
        ownerAddressVerified: true,
      },
    ]);

    const html = await buildPublicCountyHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      stateCode: "FL",
      countySlug: "bay",
    });

    expect(html).toContain('meta name="robots" content="index, follow');
    expect(html).toContain('href="/trade/plumbing/fl/bay"');
    expect(html).toContain('href="/trade/electrical/fl/bay"');
    expect(html).toContain("(2)");
    expect(html).toContain("(1)");
    expect(html).toContain('href="/business/bay-county-plumbing"');
    expect(html).not.toContain("No recent public directory listings found");
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});
