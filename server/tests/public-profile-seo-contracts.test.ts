import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("public profile SEO contracts", () => {
  it("profiles router exposes llms guidance and auto SEO fallback metadata", () => {
    const source = read("server/routes/profiles.ts");
    expect(source).toContain('router.get("/llms.txt"');
    expect(source).toContain('"/indexnow-key.txt"');
    expect(source).toContain("/804ab104bac2473e8396bcc4d1112c2d.txt");
    expect(source).toContain("BING_INDEXNOW_KEY");
    expect(source).toContain("buildAutoSeoMeta");
    expect(source).toContain("seoMeta: effectiveSeoMeta");
    expect(source).toContain("Current eligible same-host public profiles");
    expect(source).toContain("listPublishedProfileSitemapTargets()");
    expect(source).toContain("canonicalPublishedProfileSitemapLoc(baseUrl, target)");
    expect(source).toContain(
      "does not guarantee inclusion, ranking, or citation by a search engine or AI system"
    );
    expect(source).toContain("Visibility does not grant contact access or authority");
    expect(source).not.toContain("ISSA Build translucent onyx:");
    expect(source).not.toContain("`${baseUrl}/u/{slug}`");
  });

  it("publishes human service-area names instead of internal county identifiers", () => {
    const repository = read("server/repositories/businessRepository.ts");
    const methodStart = repository.indexOf("async getBusinessPublicById");
    const methodEnd = repository.indexOf("async getBusinessCountyIds", methodStart);
    const method = repository.slice(methodStart, methodEnd);

    expect(method).toContain("countyName: counties.name");
    expect(method).toContain("stateCode: counties.stateCode");
    expect(method).toContain(".innerJoin(counties, eq(counties.id, businessCounties.countyId))");
    expect(method).toContain('.join(", ")');
    expect(method).not.toContain("serviceAreas: countyRows.map((r) => r.countyId)");
  });

  it("projects the real profile update timestamp for host-local sitemap lastmod", () => {
    const repository = read("server/repositories/profileRepository.ts");
    expect(repository).toContain("updatedAt: profiles.updatedAt");
    expect(repository).toContain("updatedAt: Date | null");
  });

  it("robots guidance includes discovery crawler user agents without exposing private routes", () => {
    const dynamicSource = read("server/routes/profiles.ts");
    const staticRobots = read("client/public/robots.txt");
    const crawlerAgents = [
      "facebookexternalhit",
      "Facebot",
      "meta-externalagent",
      "meta-externalfetcher",
      "bingbot",
      "msnbot",
      "DuckDuckBot",
      "DuckAssistBot",
      "Applebot",
      "Applebot-Extended",
      "YandexBot",
      "Slurp",
      "OAI-SearchBot",
      "GPTBot",
      "ChatGPT-User",
      "PerplexityBot",
    ];

    for (const source of [dynamicSource, staticRobots]) {
      for (const crawlerAgent of crawlerAgents) {
        expect(source).toContain(crawlerAgent);
      }
      expect(source).toContain("/llms.txt");
    }
    expect(staticRobots).toContain("Allow: /llms.txt");
    expect(staticRobots).toContain("Disallow: /api/");
    expect(staticRobots).toContain("Disallow: /messages/");
    expect(dynamicSource).toContain("/api/");
    expect(dynamicSource).toContain("/messages/");
  });

  it("SSR profile html injects crawlable profile summary and robust robots directives", () => {
    const source = read("server/publicProfileHtml.ts");
    expect(source).toContain('data-seo-profile="true"');
    expect(source).toContain("max-snippet:-1");
    expect(source).toContain('<meta name="keywords"');
  });

  it("profile site view uses seoMeta and structured data defaults", () => {
    const source = read("client/src/pages/ProfileSiteView.tsx");
    expect(source).toContain("seoTitle");
    expect(source).toContain("seoDescription");
    expect(source).toContain("structuredData={structuredData}");
    expect(source).toContain('"@id": `${profileCanonicalBase}#identity`');
  });
});
