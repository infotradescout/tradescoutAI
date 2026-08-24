import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { slugifyDirectoryCityName } from "../seoDirectoryCitySlug";
import { deriveTradeSlugsFromProfileData } from "../publicationBusiness";
import { detectActorFromUserAgent } from "../utils/requestActor";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("organic growth recovery contracts", () => {
  it("uses one canonical city slug algorithm without dropping uppercase initials", () => {
    expect(slugifyDirectoryCityName("Pensacola")).toBe("pensacola");
    expect(slugifyDirectoryCityName(" St. Louis ")).toBe("st-louis");
    expect(slugifyDirectoryCityName("Coeur d'Alene")).toBe("coeur-d-alene");

    const helper = read("server/seoDirectoryCitySlug.ts");
    const sitemap = read("server/repositories/sitemapRepository.ts");
    expect(helper).toContain("regexp_replace(lower(coalesce(");
    expect(helper).not.toContain("lower(regexp_replace(coalesce(");
    expect(sitemap).toContain("sqlDirectoryCitySlugExpr()");
  });

  it("limits crawl navigation to active snapshot-backed scopes", () => {
    const service = read("server/services/seoDirectoryNavigationService.ts");
    const route = read("server/routes/business-directory-public.ts");
    const tradeDirectory = read("client/src/pages/trade/TradeDirectoryPage.tsx");
    const tradeOverview = read("client/src/pages/trade/TradeOverviewPage.tsx");
    const tradeState = read("client/src/pages/trade/TradeStatePage.tsx");
    const county = read("client/src/pages/county/CountyPage.tsx");

    expect(service).toContain("from ts_seo_trade_county_pages");
    expect(service.match(/business_count > 0/g)?.length).toBeGreaterThanOrEqual(4);
    expect(route).toContain('router.get("/api/public/seo/directory-navigation"');
    expect(route).toContain("listActiveTradeScopes()");
    expect(route).toContain("listActiveTradeStateScopes(tradeSlug)");
    expect(route).toContain("listActiveTradeCountyScopes(tradeSlug, stateCode)");
    expect(route).toContain("listActiveCountyTradeScopes(stateCode, countySlug)");

    for (const page of [tradeDirectory, tradeOverview, tradeState, county]) {
      expect(page).toContain("/api/public/seo/directory-navigation");
      expect(page).toContain("noIndex={shouldNoIndex}");
    }
  });

  it("keeps every served trade for multi-service profiles in discovery snapshots", () => {
    const tradeSlugs = deriveTradeSlugsFromProfileData({
      category: "Plumbing Contractor",
      services: ["Electrical Contractor", "Drain Cleaning Specialist"],
    });
    expect(tradeSlugs).toEqual(
      expect.arrayContaining(["plumbing", "electrical", "drain-cleaning"])
    );
    expect(new Set(tradeSlugs).size).toBe(tradeSlugs.length);

    const snapshotJob = read("server/services/seoDirectoryScopeSnapshotJob.ts");
    expect(snapshotJob).toContain("deriveTradeSlugsFromProfileData(profileData)");
    expect(snapshotJob).toContain("for (const tradeSlug of tradeSlugs)");
  });

  it("noindexes server and client empty directory states", () => {
    const serverSources = [
      "server/publicTradeHtml.ts",
      "server/publicCityHtml.ts",
      "server/publicTradeCityHtml.ts",
      "server/publicCountyHtml.ts",
      "server/publicBestHtml.ts",
    ].map(read);
    for (const source of serverSources) {
      expect(source).toContain('<meta name="robots" content="noindex, follow" />');
      expect(source).toContain("indexable:");
    }

    const clientSources = [
      "client/src/pages/trade/TradeDirectoryPage.tsx",
      "client/src/pages/trade/TradeOverviewPage.tsx",
      "client/src/pages/trade/TradeStatePage.tsx",
      "client/src/pages/trade/TradeCountyPage.tsx",
      "client/src/pages/trade/TradeCityPage.tsx",
      "client/src/pages/city/CityPage.tsx",
      "client/src/pages/county/CountyPage.tsx",
      "client/src/pages/best/BestTradeCountyPage.tsx",
      "client/src/pages/best/BestTradeCityPage.tsx",
    ].map(read);
    for (const source of clientSources) {
      expect(source).toContain("noIndex={shouldNoIndex}");
    }
  });

  it("counts only attributable human discovery traffic", () => {
    const chrome =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
    const disguisedCrawler =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/605.1.15";

    expect(detectActorFromUserAgent(chrome).actorType).toBe("human");
    expect(detectActorFromUserAgent(disguisedCrawler)).toMatchObject({
      actorType: "bot",
      botName: "MalformedChrome",
    });
    expect(detectActorFromUserAgent("HeadlessChrome/139.0.0.0").actorType).toBe("bot");
    expect(detectActorFromUserAgent("").actorType).toBe("unknown");

    const landing = read("client/src/lib/discoveryLanding.ts");
    const analytics = read("server/routes/analytics-routes.ts");
    const profiles = read("server/routes/profiles.ts");
    const profileClient = read("client/src/pages/ProfileSiteView.tsx");

    expect(landing).toContain("tradescout:discovery-session:v1");
    expect(landing).toContain('"X-Anonymous-Session-Id"');
    expect(analytics).toContain('if (actor.actorType !== "human") return;');
    expect(profiles).toContain('if (actorType !== "human") return;');
    expect(profiles).toContain("30 * 60 * 1000");
    expect(profiles).toContain("if (req && !viewerCanManage) recordProfileView");
    expect(profiles).toContain('metric: "estimated_unique_visitors"');
    expect(profileClient).toContain("trackDiscoveryLandingOnce");
    expect(profileClient).toContain("data.viewerCanManage");
  });

  it("serves the JW Stone crawler surface and preserves gated request intent", () => {
    const serverIndex = read("server/index.ts");
    const routing = read("server/publicProfileItemRouting.ts");

    expect(serverIndex).toContain("buildPublicJwStoneMarketplaceHtml({");
    expect(serverIndex).toContain("marketplaceDomainSurface: true");
    expect(serverIndex.match(/request: req\.query\.request/g)?.length).toBeGreaterThanOrEqual(5);
    expect(routing).toContain('requestIntent === "stone" || requestIntent === "collection"');
    expect(routing).toContain('target.searchParams.set("request", requestIntent)');
  });
});
