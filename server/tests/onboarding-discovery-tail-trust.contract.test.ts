import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("onboarding business discovery tail trust", () => {
  it("gates related community suggestions before limit and uses a business route", () => {
    const source = read("server/services/relatedBusinessSuggestions.ts");

    expect(source.match(/publicBusinessDetailExposureSqlPredicate\(\)/g)).toHaveLength(2);
    expect(source.match(/eq\(businesses\.publicDiscoveryEnabled, true\)/g)).toHaveLength(2);
    expect(source).toContain("profileUrl: `/business/${row.slug}`");
    expect(source).not.toContain("profileUrl: `/u/${row.slug}`");
    expect(source.indexOf("publicBusinessDetailExposureSqlPredicate()")).toBeLessThan(
      source.indexOf(".limit(limit)")
    );
  });

  it("gates every supplier knowledge query, including the global fallback", () => {
    const source = read("server/services/knowledgeService.ts");
    const supplierBranch = source.slice(
      source.indexOf("// Directory businesses: awareness-only."),
      source.indexOf('category: "businesses"')
    );

    expect(supplierBranch.match(/publicBusinessDetailExposureSqlPredicate\(\)/g)).toHaveLength(3);
    expect(supplierBranch.match(/eq\(businesses\.publicDiscoveryEnabled, true\)/g)).toHaveLength(3);
    expect(supplierBranch.indexOf("publicBusinessDetailExposureSqlPredicate()")).toBeLessThan(
      supplierBranch.indexOf(".limit(15)")
    );
  });

  it("gates SEO scope rows before the overflow detector and again before aggregation", () => {
    const source = read("server/services/seoDirectoryScopeSnapshotJob.ts");
    const sqlGate = source.indexOf("publicBusinessDetailExposureSqlPredicate()");

    expect(sqlGate).toBeGreaterThan(-1);
    expect(sqlGate).toBeLessThan(source.indexOf(".limit(SEO_DIRECTORY_SCOPE_SOURCE_ROW_CAP + 1)"));
    expect(source).toContain("canServePublicBusinessDetail({ publication: pub, tier })");
    expect(source).toContain("assertSeoDirectoryScopeSourceCapacity(rows.length)");
  });
});
