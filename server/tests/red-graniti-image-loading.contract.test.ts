import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RED_GRANITI_QUARRY_MEDIA } from "@shared/redGranitiProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("R.E.D. Graniti profile image delivery", () => {
  it("serves all canonical quarry imagery from TradeScout-owned paths", () => {
    const localImages = Object.values(RED_GRANITI_QUARRY_MEDIA).map((entry) => entry.imageUrl);

    expect(localImages).toEqual([
      "/images/businesses/red-graniti/source/lemurian-blue.svg",
      "/images/businesses/red-graniti/source/nero-africa.svg",
      "/images/businesses/red-graniti/source/eureka-danby.svg",
    ]);
    expect(localImages.every((imageUrl) => imageUrl.startsWith("/images/"))).toBe(true);
    expect(localImages.some((imageUrl) => /^https?:\/\//i.test(imageUrl))).toBe(false);
  });

  it("pins homepage, business, quarry, and project imagery to server storage before Vite builds", () => {
    const sitemapBuild = read("scripts/generate-sitemap.mjs");
    const sitemapCore = read("scripts/generate-sitemap-core.mjs");
    const migrationScript = read("scripts/migrate-red-graniti-public-media.mjs");
    const route = read("server/routes/red-graniti-public-media.ts");
    const profile = read("client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx");
    const profileMetadata = read("shared/redGranitiProfile.ts");
    const manifest = JSON.parse(read("scripts/data/red-graniti-public-media-manifest.json")) as {
      expected: { files: number; bytes: number };
      target: { storage: string; keyPrefix: string; legacyUrlPrefix: string };
      assets: Array<{ relativePath: string }>;
    };

    expect(sitemapBuild).toContain("verify-red-graniti-public-media.mjs");
    expect(sitemapCore).not.toContain("cache-red-graniti-assets.mjs");
    expect(fs.existsSync(path.resolve(process.cwd(), "scripts/cache-red-graniti-assets.mjs"))).toBe(
      false
    );
    expect(manifest.expected).toMatchObject({ files: 11, bytes: 2433960 });
    expect(manifest.target).toEqual({
      storage: "server-object-storage",
      keyPrefix: "public-media/images/businesses/red-graniti/source/",
      legacyUrlPrefix: "/images/businesses/red-graniti/source/",
    });
    expect(migrationScript).toContain("requireServerObjectStorageConfiguration");
    expect(migrationScript).toContain("source digest did not match the pinned manifest");
    expect(route).toContain("resolveRedGranitiPublicMediaObjectKey");

    const expectedFiles = [
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
    ];
    expect(manifest.assets.map((asset) => asset.relativePath)).toEqual(expectedFiles);
    for (const outputFile of expectedFiles) {
      expect(`${profile}\n${profileMetadata}`).toContain(outputFile);
    }
  });

  it("keeps canonical quarry cards tied to official R.E.D. Graniti pages", () => {
    for (const entry of Object.values(RED_GRANITI_QUARRY_MEDIA)) {
      expect(entry.sourceUrl).toMatch(/^https:\/\/www\.redgraniti\.com\/en\/portfolio\//);
    }
    expect(RED_GRANITI_QUARRY_MEDIA.vermont.sourceUrl).toContain("eureka-danbycalacatta-danby");
  });
});
