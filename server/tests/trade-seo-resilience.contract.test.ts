import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("trade seo resilience contracts", () => {
  it("trade directory city/county pages preserve SSR robots until authoritative success", () => {
    const countyPage = read("client/src/pages/trade/TradeCountyPage.tsx");
    const cityPage = read("client/src/pages/trade/TradeCityPage.tsx");

    expect(countyPage).toContain("getDiscoveryScopeRobotsDecision");
    expect(countyPage).toContain("preserveRobots={robotsDecision.preserveRobots}");
    expect(cityPage).toContain("getDiscoveryScopeRobotsDecision");
    expect(cityPage).toContain("preserveRobots={robotsDecision.preserveRobots}");
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

  it("sitemap routes fail retryably to XML 503 rather than authoritative empty", () => {
    const profilesRoutes = read("server/routes/profiles.ts");
    expect(profilesRoutes).toContain("function sendSitemapFallback");
    expect(profilesRoutes).toContain('sendSitemapFallback(res, "index")');
    expect(profilesRoutes).toContain("sendSitemapFallback(res);");
    expect(profilesRoutes).not.toContain('status(500).send("Failed to generate sitemap")');
  });
});
