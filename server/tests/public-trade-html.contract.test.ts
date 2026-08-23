import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("public trade SEO fallback contracts", () => {
  it("trade county html propagates listing failures instead of publishing 200/noindex crawl truth", () => {
    const source = read("server/publicTradeHtml.ts");
    expect(source).toContain(
      "Trade county listing query failed; preserving prior crawl truth via 5xx"
    );
    expect(source).toContain("throw error;");
    expect(source).not.toContain("runQuery(false)");
  });

  it("recent html serves fallback content when activity query fails", () => {
    const source = read("server/publicRecentHtml.ts");
    expect(source).toContain("Recent activity query failed; serving fallback page without items");
    expect(source).toContain("rows = []");
  });

  it("county and best county html fail closed when discovery consent cannot be queried", () => {
    const countySource = read("server/publicCountyHtml.ts");
    const bestSource = read("server/publicBestHtml.ts");
    expect(countySource).toContain("eq(businesses.publicDiscoveryEnabled, true as any)");
    expect(countySource).not.toContain("runCountyQuery(false)");
    expect(bestSource).toContain(
      "Best trade county query failed; preserving prior crawl truth via 5xx"
    );
    expect(bestSource).not.toContain("runCountyQuery(false)");
  });

  it("trade directory pages expose AI-readable discovery and contact-gating context", () => {
    const tradeSource = read("server/publicTradeHtml.ts");
    const citySource = read("server/publicTradeCityHtml.ts");

    expect(tradeSource).toContain("buildTradeDiscoveryNote");
    expect(tradeSource).toContain("Visibility never grants direct contact access");
    expect(tradeSource).toContain("Local discovery context");
    expect(tradeSource).toContain("protected Direct Connect paths");

    expect(citySource).toContain("buildTradeCityDiscoveryNote");
    expect(citySource).toContain("Visibility does not grant contact access");
    expect(citySource).toContain("protected Direct Connect paths");
  });

  it("does not present multi-county sums as distinct business totals on trade hubs", () => {
    const serverSource = read("server/publicTradeHtml.ts");
    const directoryClient = read("client/src/pages/trade/TradeDirectoryPage.tsx");
    const overviewClient = read("client/src/pages/trade/TradeOverviewPage.tsx");

    expect(serverSource).not.toContain("s.businessCount.toLocaleString()");
    expect(serverSource).not.toContain("t.businessCount.toLocaleString()");
    expect(directoryClient).not.toContain("trade.businessCount.toLocaleString()");
    expect(overviewClient).not.toContain("state.businessCount.toLocaleString()");
  });

  it("keeps unsupported legacy best routes noindex,nofollow and out of the crawl graph", () => {
    const bestSource = read("server/publicBestHtml.ts");
    const countyClient = read("client/src/pages/best/BestTradeCountyPage.tsx");
    const cityClient = read("client/src/pages/best/BestTradeCityPage.tsx");

    expect(bestSource).toContain('content="noindex,nofollow"');
    expect(bestSource.match(/indexable: false/g)).toHaveLength(2);
    expect(countyClient).toContain("noIndex");
    expect(cityClient).toContain("noIndex");
  });
});
