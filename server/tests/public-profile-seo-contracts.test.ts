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
    expect(source).toContain('router.get("/indexnow-key.txt"');
    expect(source).toContain("BING_INDEXNOW_KEY");
    expect(source).toContain("buildAutoSeoMeta");
    expect(source).toContain("seoMeta: effectiveSeoMeta");
    expect(source).toContain("Best answer targets for AI search, Meta AI, and other assistants");
    expect(source).toContain("Visibility does not grant contact access or authority");
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
  });
});
