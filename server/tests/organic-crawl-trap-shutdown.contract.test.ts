import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("organic crawl trap shutdown contracts", () => {
  it("hard-prunes confirmed-empty trade and city scopes", () => {
    const trade = read("server/publicTradeHtml.ts");
    const tradeCity = read("server/publicTradeCityHtml.ts");
    const city = read("server/publicCityHtml.ts");
    const serverIndex = read("server/index.ts");

    expect(trade).toContain("let stateScopeQueryFailed = false;");
    expect(trade).toContain(
      "if (!stateScopeQueryFailed && activeStates.length === 0) return null;"
    );
    expect(trade).toContain("let countyScopeQueryFailed = false;");
    expect(trade).toContain(
      "if (!countyScopeQueryFailed && activeCounties.length === 0) return null;"
    );
    expect(trade).toContain("let listingQueryDegraded = !includePublicDiscoveryEnabled;");
    expect(trade).toContain(
      "if (!listingQueryDegraded && items.length === 0) return null;"
    );
    expect(tradeCity).toContain("if (rows.length === 0) return null;");
    expect(city).toContain("if (rows.length === 0) return null;");
    expect(serverIndex.match(/res\.status\(404\)\.send\("Trade page not found"\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("preserves degraded noindex fallbacks instead of issuing false 404s", () => {
    const trade = read("server/publicTradeHtml.ts");

    expect(trade).toContain("stateScopeQueryFailed = true;");
    expect(trade).toContain("countyScopeQueryFailed = true;");
    expect(trade.match(/listingQueryDegraded = true;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(trade).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it("does not generate signed social cards for noindex fallback pages", () => {
    const previews = read("server/publicSocialPreviewHtml.ts");

    expect(previews).toContain(
      'if (/\\bnoindex\\b/i.test(metaContent(html, "name", "robots"))) return html;'
    );
  });
});
