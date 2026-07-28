import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");

function functionSource(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("custom-domain item observability", () => {
  it("canonicalizes legacy item and category selectors before recording a page visit", () => {
    const handler = functionSource(
      "async function serveCustomDomainProfilePath(",
      "app.use(async (req, res, next) => {"
    );

    const itemStart = handler.indexOf('if (itemRequest.kind === "item")');
    const categoryStart = handler.indexOf('if (categoryRequest.kind === "category")');
    const rootStart = handler.indexOf('if (path === "/" || path === "")');
    const itemBranch = handler.slice(itemStart, categoryStart);
    const categoryBranch = handler.slice(categoryStart, rootStart);

    expect(itemBranch.indexOf('itemRequest.source === "legacy-query"')).toBeLessThan(
      itemBranch.indexOf('attributeProfileVisit("custom_domain_item")')
    );
    expect(categoryBranch.indexOf('categoryRequest.source === "legacy-query"')).toBeLessThan(
      categoryBranch.indexOf('attributeProfileVisit("custom_domain_category")')
    );
    expect(itemBranch).toContain(
      "customDomainCanonicalRedirectTarget(req, host, itemRequest.canonicalPath)"
    );
    expect(categoryBranch).toContain(
      "customDomainCanonicalRedirectTarget(req, host, categoryRequest.canonicalPath)"
    );
  });

  it("keeps explicit referral context on the one canonical request that gets attributed", () => {
    const redirectHelper = functionSource(
      "function customDomainCanonicalRedirectTarget(",
      "function profileItemPathSuffix("
    );

    expect(redirectHelper).toContain("target.searchParams.set(\"ref\", referralCode)");
  });

  it("records crawlers against the exact scoped item or category route", () => {
    const renderer = functionSource(
      "async function renderProfileOnCustomDomain(",
      "async function serveCustomDomainProfilePath("
    );

    expect(renderer).toContain(
      '`${canonicalProfilePath}${profileItemPathSuffix(itemRequest, "/")}`'
    );
    expect(renderer).toContain(
      '`${canonicalProfilePath}${profileCategoryPathSuffix(categoryRequest, "/")}`'
    );
    expect(renderer).toContain("getLandingIntentContractForPath(canonicalProfilePath)");
    expect(renderer).toContain("pathOverride: crawlerPathOverride");
  });
});
