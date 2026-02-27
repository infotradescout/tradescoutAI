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
    expect(source).toContain("buildAutoSeoMeta");
    expect(source).toContain("seoMeta: effectiveSeoMeta");
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
