import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

const expectedSitemapLocs = [
  "https://www.thetradescout.com/sitemap-core.xml",
  "https://www.thetradescout.com/sitemap-profiles.xml",
  "https://www.thetradescout.com/sitemap-homescout-counties.xml",
  "https://www.thetradescout.com/sitemap-homescout-listings.xml",
  "https://www.thetradescout.com/sitemap-tradepartners.xml",
  "https://www.thetradescout.com/sitemap-directory-counties.xml",
  "https://www.thetradescout.com/sitemap-directory-trade-navigation.xml",
  "https://www.thetradescout.com/sitemap-directory-trades.xml",
  "https://www.thetradescout.com/sitemap-directory-cities.xml",
  "https://www.thetradescout.com/sitemap-directory-trade-cities.xml",
  "https://www.thetradescout.com/sitemap-best-pages.xml",
  "https://www.thetradescout.com/sitemap-recent-activity.xml",
];

describe("sitemap contracts", () => {
  it("dynamic sitemap index includes the crawler-facing directory, best, and recent feeds", () => {
    const source = read("server/routes/profiles.ts");

    for (const loc of expectedSitemapLocs) {
      expect(source).toContain(loc.replace("https://www.thetradescout.com", "${baseUrl}"));
    }
  });

  it("static sitemap.xml mirrors the submitted sitemap index targets", () => {
    const source = read("client/public/sitemap.xml");

    expect(source).toContain("<sitemapindex");
    expect(source).not.toContain("<urlset");
    for (const loc of expectedSitemapLocs) {
      expect(source).toContain(`<loc>${loc}</loc>`);
    }
  });

  it("static sitemap-index.xml mirrors the submitted sitemap index targets", () => {
    const source = read("client/public/sitemap-index.xml");

    expect(source).toContain("<sitemapindex");
    expect(source).not.toContain("sitemap-contractors.xml");
    expect(source).not.toContain("sitemap-community.xml");
    for (const loc of expectedSitemapLocs) {
      expect(source).toContain(`<loc>${loc}</loc>`);
    }
  });
});
