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

  it("sitemap routes fail open to xml fallback rather than 500", () => {
    const profilesRoutes = read("server/routes/profiles.ts");
    expect(profilesRoutes).toContain("function sendSitemapFallback");
    expect(profilesRoutes).toContain('sendSitemapFallback(res, "index")');
    expect(profilesRoutes).toContain("sendSitemapFallback(res);");
    expect(profilesRoutes).not.toContain('status(500).send("Failed to generate sitemap")');
  });
});
