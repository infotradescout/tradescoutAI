import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("public trade SEO fallback contracts", () => {
  it("trade county html fails closed when no eligible listing survives", () => {
    const source = read("server/publicTradeHtml.ts");
    expect(source).toContain(
      "Trade county listing query failed; serving fallback page without listings"
    );
    expect(source).toContain("rows = []");
    expect(source).toContain("if (!items.length) return null");
  });

  it("recent html serves fallback content when activity query fails", () => {
    const source = read("server/publicRecentHtml.ts");
    expect(source).toContain("Recent activity query failed; serving fallback page without items");
    expect(source).toContain("rows = []");
  });

  it("county and best county html fail closed after defensive query handling", () => {
    const countySource = read("server/publicCountyHtml.ts");
    const bestSource = read("server/publicBestHtml.ts");
    expect(countySource).toContain("County directory query failed; serving page without listings");
    expect(countySource).toContain('isMissingColumnError(error, "public_discovery_enabled")');
    expect(countySource).toContain("if (!sampleBusinesses.length) return null");
    expect(bestSource).toContain("Best trade county query failed; serving page without listings");
    expect(bestSource).toContain('isMissingColumnError(error, "public_discovery_enabled")');
    expect(bestSource.match(/if \(!items\.length\) return null/g)).toHaveLength(2);
  });

  it("links only trade coverage present in the SEO scope snapshot", () => {
    const source = read("server/publicTradeHtml.ts");

    expect(source).toContain("listActiveTradeSlugs");
    expect(source).toContain("listActiveTradeStates");
    expect(source).toContain("listActiveTradeCountySlugs");
    expect(source).toContain("FROM ts_seo_trade_county_pages");
    expect(source).not.toContain("US_STATES_COUNTIES.map");
    expect(source).not.toContain("state.counties\n        .map");
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
});
