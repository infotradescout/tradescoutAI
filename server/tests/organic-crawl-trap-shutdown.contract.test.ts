import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("organic crawl trap shutdown contracts", () => {
  it("hard-prunes inactive trade, state, county, and city scopes", () => {
    const trade = read("server/publicTradeHtml.ts");
    const tradeCity = read("server/publicTradeCityHtml.ts");
    const city = read("server/publicCityHtml.ts");
    const serverIndex = read("server/index.ts");

    expect(trade).toContain("if (activeStates.length === 0) return null;");
    expect(trade).toContain("if (activeCounties.length === 0) return null;");
    expect(trade).toContain(
      "if (!(await hasActiveTradeCountyScope(canonicalSlug, stateCode, countySlug))) return null;"
    );
    expect(trade).toContain("if (items.length === 0) return null;");
    expect(tradeCity).toContain("if (rows.length === 0) return null;");
    expect(city).toContain("if (rows.length === 0) return null;");
    expect(serverIndex.match(/res\.status\(404\)\.send\("Trade page not found"\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("does not convert snapshot or listing failures into empty successful pages", () => {
    const trade = read("server/publicTradeHtml.ts");
    const navigation = read("server/services/seoDirectoryNavigationService.ts");

    expect(trade).not.toContain("stateScopeQueryFailed");
    expect(trade).not.toContain("countyScopeQueryFailed");
    expect(trade).not.toContain("listingQueryDegraded");
    expect(trade).not.toContain("serving fallback page without listings");
    expect(navigation).toContain(
      "[SEO] Active directory snapshot refresh failed; using the last known public scope set"
    );
    expect(trade).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it("does not generate signed social cards for noindex fallback pages", () => {
    const previews = read("server/publicSocialPreviewHtml.ts");

    expect(previews).toContain(
      'if (/\\bnoindex\\b/i.test(metaContent(html, "name", "robots"))) return html;'
    );
  });
});
