import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RED_GRANITI_QUARRY_MEDIA } from "@shared/redGranitiProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti profile image delivery", () => {
  it("serves all profile imagery from TradeScout-owned paths", () => {
    const localImages = Object.values(RED_GRANITI_QUARRY_MEDIA).map(
      (entry) => entry.imageUrl
    );

    expect(localImages).toEqual([
      "/images/businesses/red-graniti/source/lemurian-blue.svg",
      "/images/businesses/red-graniti/source/nero-africa.svg",
      "/images/businesses/red-graniti/source/eureka-danby.svg",
    ]);
    expect(localImages.every((imageUrl) => imageUrl.startsWith("/images/"))).toBe(true);
    expect(localImages.some((imageUrl) => /^https?:\/\//i.test(imageUrl))).toBe(false);
  });

  it("caches official source imagery before Vite builds the profile", () => {
    const sitemapBuild = read("scripts/generate-sitemap.mjs");
    const cacheScript = read("scripts/cache-red-graniti-assets.mjs");

    expect(sitemapBuild).toContain("import './cache-red-graniti-assets.mjs';");
    expect(cacheScript).toContain(
      "client/public/images/businesses/red-graniti/source"
    );
    expect(cacheScript).toContain("lemurian-blue.svg");
    expect(cacheScript).toContain("nero-africa.svg");
    expect(cacheScript).toContain("eureka-danby.svg");
    expect(cacheScript).toContain("https://www.redgraniti.com/wp-content/uploads/");
    expect(cacheScript).toContain("fallbackSourceSvg");
    expect(cacheScript).toContain("official image unavailable");
  });

  it("keeps every cached image tied to an official R.E.D. Graniti page", () => {
    for (const entry of Object.values(RED_GRANITI_QUARRY_MEDIA)) {
      expect(entry.sourceUrl).toMatch(/^https:\/\/www\.redgraniti\.com\/en\/portfolio\//);
    }
    expect(RED_GRANITI_QUARRY_MEDIA.vermont.sourceUrl).toContain(
      "eureka-danbycalacatta-danby"
    );
  });
});
