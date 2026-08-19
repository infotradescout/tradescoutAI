import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RED_GRANITI_QUARRY_MEDIA } from "@shared/redGranitiProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti profile image delivery", () => {
  it("serves all canonical quarry imagery from TradeScout-owned paths", () => {
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

  it("caches the official homepage, business, quarry, and project imagery before Vite builds", () => {
    const sitemapBuild = read("scripts/generate-sitemap.mjs");
    const cacheScript = read("scripts/cache-red-graniti-assets.mjs");
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");

    expect(sitemapBuild).toContain("import './cache-red-graniti-assets.mjs';");
    expect(cacheScript).toContain(
      "client/public/images/businesses/red-graniti/source"
    );

    for (const outputFile of [
      "home-hero.svg",
      "business-blocks.svg",
      "business-slabs.svg",
      "business-distribution.svg",
      "lemurian-blue.svg",
      "nero-africa.svg",
      "eureka-danby.svg",
      "project-arkansas-office.svg",
      "project-colorado-bank.svg",
      "project-lincoln-memorial.svg",
      "project-mansion-dubai.svg",
    ]) {
      expect(cacheScript).toContain(outputFile);
      expect(profile).toContain(outputFile);
    }

    expect(cacheScript).toContain("https://www.redgraniti.com/wp-content/uploads/");
    expect(cacheScript).toContain("blocchi-grezzi.png");
    expect(cacheScript).toContain("commercializzazione.png");
    expect(cacheScript).toContain("LincolnMemorialWashington.jpg");
    expect(cacheScript).toContain("fallbackSourceSvg");
    expect(cacheScript).toContain("official image unavailable");
  });

  it("keeps canonical quarry cards tied to official R.E.D. Graniti pages", () => {
    for (const entry of Object.values(RED_GRANITI_QUARRY_MEDIA)) {
      expect(entry.sourceUrl).toMatch(/^https:\/\/www\.redgraniti\.com\/en\/portfolio\//);
    }
    expect(RED_GRANITI_QUARRY_MEDIA.vermont.sourceUrl).toContain(
      "eureka-danbycalacatta-danby"
    );
  });
});
