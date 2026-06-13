import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

const expectedSitemapLocs = [
  "https://www.thetradescout.com/sitemap-core.xml",
  "https://www.thetradescout.com/sitemap-profiles.xml",
  "https://www.thetradescout.com/sitemap-homescout-counties.xml",
  "https://www.thetradescout.com/sitemap-homescout-listings.xml",
  "https://www.thetradescout.com/sitemap-tradepartners.xml",
  "https://www.thetradescout.com/sitemap-directory-counties.xml",
  "https://www.thetradescout.com/sitemap-directory-trade-navigation.xml",
  "https://www.thetradescout.com/sitemap-directory-trades.xml",
  "https://www.thetradescout.com/sitemap-directory-cities.xml",
  "https://www.thetradescout.com/sitemap-directory-trade-cities.xml",
  "https://www.thetradescout.com/sitemap-best-pages.xml",
  "https://www.thetradescout.com/sitemap-recent-activity.xml",
  "https://www.thetradescout.com/sitemap-exchange-listings.xml",
];

const expectedStaticPublicRoutes = [
  "https://www.thetradescout.com/",
  "https://www.thetradescout.com/landing",
  "https://www.thetradescout.com/direct-connect",
  "https://www.thetradescout.com/community",
  "https://www.thetradescout.com/how-it-works",
  "https://www.thetradescout.com/trade-up-for-trade-schools",
  "https://www.thetradescout.com/trust-model",
  "https://www.thetradescout.com/direct-connect-info",
  "https://www.thetradescout.com/compare",
  "https://www.thetradescout.com/compare/home-services",
  "https://www.thetradescout.com/compare/real-estate",
  "https://www.thetradescout.com/compare/community",
  "https://www.thetradescout.com/compare/local-business",
  "https://www.thetradescout.com/compare/coordination",
  "https://www.thetradescout.com/compare/lead-generation",
  "https://www.thetradescout.com/privacy",
  "https://www.thetradescout.com/compliance",
];

describe("sitemap contracts", () => {
  it("dynamic sitemap index includes the crawler-facing directory, best, and recent feeds", () => {
    const source = read("server/routes/profiles.ts");

    for (const loc of expectedSitemapLocs) {
      expect(source).toContain(loc.replace("https://www.thetradescout.com", "${baseUrl}"));
    }
  });

  it("static sitemap.xml remains a conservative canonical urlset", () => {
    const source = read("client/public/sitemap.xml");

    expect(source).toContain("<urlset");
    expect(source).not.toContain("<sitemapindex");
    for (const loc of expectedStaticPublicRoutes) {
      expect(source).toContain(`<loc>${loc}</loc>`);
    }
  });

  it("static sitemap-index.xml mirrors the submitted sitemap index targets", () => {
    const source = read("client/public/sitemap-index.xml");

    expect(source).toContain("<sitemapindex");
    expect(source).not.toContain("sitemap-contractors.xml");
    expect(source).not.toContain("sitemap-community.xml");
    for (const loc of expectedSitemapLocs) {
      expect(source).toContain(`<loc>${loc}</loc>`);
    }
  });

  it("trade navigation sitemap is driven by indexed snapshot coverage, not every trade/state combo", () => {
    const source = read("server/routes/profiles.ts");

    expect(source).toContain("ensureSeoDirectoryScopeSnapshotTables()");
    expect(source).toContain("with trade_state_pairs as (");
    expect(source).toContain("from ts_seo_trade_county_pages");
    expect(source).toContain("from ts_seo_trade_city_pages");
    expect(source).toContain(
      "activeTradeSlugs.length > 0 ? activeTradeSlugs : PRIMARY_TRADE_SLUGS"
    );
    expect(source).not.toContain("PRIMARY_TRADE_SLUGS.flatMap");
  });
});
