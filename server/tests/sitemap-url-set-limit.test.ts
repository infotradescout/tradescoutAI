import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareSitemapUrlSetEntries, SITEMAP_URLSET_MAX_URLS } from "../sitemapUrlSet";

describe("sitemap URL-set protocol limit", () => {
  it("deterministically deduplicates and caps an oversized URL set at 50,000", () => {
    const entries = Array.from({ length: 55_005 }, (_, index) => ({
      loc: `https://www.thetradescout.com/exchange/tools/${String(index).padStart(6, "0")}`,
      lastmod: index <= 50_000 ? "2026-07-22" : "2026-07-21",
    }));
    entries.push({ ...entries[0] }, { ...entries[25_000] }, { ...entries[55_004] });

    const prepared = prepareSitemapUrlSetEntries(entries);
    const preparedFromReverseOrder = prepareSitemapUrlSetEntries([...entries].reverse());

    expect(prepared).toHaveLength(SITEMAP_URLSET_MAX_URLS);
    expect(new Set(prepared.map((entry) => entry.loc)).size).toBe(SITEMAP_URLSET_MAX_URLS);
    expect(prepared.map((entry) => entry.loc)).toEqual(
      preparedFromReverseOrder.map((entry) => entry.loc)
    );
    expect(prepared[0]?.loc).toBe("https://www.thetradescout.com/exchange/tools/000000");
    expect(prepared.at(-1)?.loc).toBe("https://www.thetradescout.com/exchange/tools/049999");
  });

  it("enforces the cap in the shared renderer used by every platform URL set", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/profiles.ts"),
      "utf8"
    );
    const builderStart = source.indexOf("function buildUrlSet(");
    const builderEnd = source.indexOf("function sendSitemapFallback", builderStart);
    const builder = source.slice(builderStart, builderEnd);

    expect(builderStart).toBeGreaterThan(-1);
    expect(builder).toContain("prepareSitemapUrlSetEntries(urlEntries)");
    expect(builder).toContain("preparedEntries");
    expect(builder).not.toContain("${urlEntries");
  });
});
