import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("trade seo resilience contracts", () => {
  it("trade directory city/county pages noindex thin or error states", () => {
    const countyPage = read("client/src/pages/trade/TradeCountyPage.tsx");
    const cityPage = read("client/src/pages/trade/TradeCityPage.tsx");

    expect(countyPage).toContain(
      "const shouldNoIndex = !isLoading && (isError || items.length === 0)"
    );
    expect(countyPage).toContain("noIndex={shouldNoIndex}");
    expect(cityPage).toContain(
      "const shouldNoIndex = !isLoading && (isError || counties.length === 0)"
    );
    expect(cityPage).toContain("noIndex={shouldNoIndex}");
  });

  it("trade seo title conventions match acquisition templates", () => {
    const statePage = read("client/src/pages/trade/TradeStatePage.tsx");
    const countyPage = read("client/src/pages/trade/TradeCountyPage.tsx");
    const cityPage = read("client/src/pages/trade/TradeCityPage.tsx");

    expect(statePage).toContain(
      "const title = `${trade.name} Contractors in ${state.name} | TradeScout`;"
    );
    expect(countyPage).toContain(
      "const title = `Find ${trade.name} Contractors in ${marketLabel} | TradeScout`;"
    );
    expect(cityPage).toContain(
      "const title = `${trade.name} in ${displayCity}, ${state} | TradeScout`;"
    );
  });

  it("sitemap routes fail open to xml fallback rather than 500", () => {
    const profilesRoutes = read("server/routes/profiles.ts");
    expect(profilesRoutes).toContain("function sendSitemapFallback");
    expect(profilesRoutes).toContain('sendSitemapFallback(res, "index")');
    expect(profilesRoutes).toContain("sendSitemapFallback(res);");
    expect(profilesRoutes).not.toContain('status(500).send("Failed to generate sitemap")');
  });
});

describe("Phase C indexability contract — trade/geo SSR/CSR parity", () => {
  it("CSR noindexes empty trade county shells (baseline — must stay passing)", () => {
    const countyPage = read("client/src/pages/trade/TradeCountyPage.tsx");

    expect(countyPage).toContain(
      "const shouldNoIndex = !isLoading && (isError || items.length === 0)"
    );
    expect(countyPage).toContain("noIndex={shouldNoIndex}");
  });

  it("SSR trade HTML robots match CSR empty-state noindex policy", () => {
    const tradeSsr = read("server/publicTradeHtml.ts");
    const countySsr = read("server/publicCountyHtml.ts");
    const citySsr = read("server/publicCityHtml.ts");
    const bestSsr = read("server/publicBestHtml.ts");

    for (const source of [tradeSsr, countySsr, citySsr, bestSsr]) {
      expect(source).toMatch(
        /shouldNoIndex|resolveDirectoryIndexability|noindex.*items\.length === 0|noindex.*qualifyingListings/
      );
    }
  });

  it("empty directory shells must not be sitemap-listed without qualifying listings", () => {
    const profilesSource = read("server/routes/profiles.ts");

    expect(profilesSource).toMatch(
      /listing_count\s*>\s*0|qualifyingListings|hasQualifyingDirectoryListings|substantiveListings/
    );
    expect(profilesSource).toContain("assertSitemapUrlIsIndexEligible");
  });

  it("documents Phase B empty-shell samples in contract fixtures", async () => {
    const fixtures = await import("./fixtures/phase-c-indexability-contract.fixtures");

    expect(fixtures.PHASE_C_EMPTY_DIRECTORY_SHELL_SAMPLES).toContain("/trade/electrical/fl/bay");
    expect(fixtures.PHASE_C_EMPTY_DIRECTORY_SHELL_SAMPLES).toContain("/county/al/baldwin");
    expect(fixtures.PHASE_C_STALE_BUSINESS_SITEMAP_SAMPLES).toContain(
      "2h-v-construction-services-llc-2"
    );
  });
});
