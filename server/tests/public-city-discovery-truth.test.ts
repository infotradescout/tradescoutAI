import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPublicCityHtml,
  isCanonicalPublicCitySlug,
  normalizePublicCitySlug,
} from "../publicCityHtml";
import { buildPublicTradeCityHtml } from "../publicTradeCityHtml";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public city discovery truth", () => {
  it("normalizes names after lowercasing and rejects corrupted route slugs", () => {
    expect(normalizePublicCitySlug("Pensacola")).toBe("pensacola");
    expect(normalizePublicCitySlug("  St. Louis  ")).toBe("st-louis");
    expect(isCanonicalPublicCitySlug("pensacola")).toBe(true);
    expect(isCanonicalPublicCitySlug("-ensacola")).toBe(false);
    expect(isCanonicalPublicCitySlug("fort--walton-beach")).toBe(false);
  });

  it("rejects malformed city pages before any data lookup", async () => {
    const templateHtml = '<html><head></head><body><div id="root"></div></body></html>';

    await expect(
      buildPublicCityHtml({
        origin: "https://www.thetradescout.com",
        templateHtml,
        stateCode: "FL",
        citySlug: "-ensacola",
      })
    ).resolves.toBeNull();

    await expect(
      buildPublicTradeCityHtml({
        origin: "https://www.thetradescout.com",
        templateHtml,
        tradeSlug: "electrical",
        stateCode: "MA",
        citySlug: "fort--walton-beach",
      })
    ).resolves.toBeNull();
  });

  it("requires explicit business state agreement across city HTML, APIs, snapshots, and sitemaps", () => {
    const sources = [
      read("server/publicCityHtml.ts"),
      read("server/publicTradeCityHtml.ts"),
      read("server/publicBestHtml.ts"),
      read("server/routes/city-public.ts"),
      read("server/routes/business-directory-public.ts"),
      read("server/repositories/sitemapRepository.ts"),
    ];

    for (const source of sources) {
      expect(source).toContain("publicBusinessStateCodeSql");
      expect(source).toContain("publicBusinessCitySlugSql");
    }

    const snapshot = read("server/services/seoDirectoryScopeSnapshotJob.ts");
    expect(snapshot).toContain("businessStateCode === stateCode");
  });
});
