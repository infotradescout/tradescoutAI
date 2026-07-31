import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("onboarding business Direct Connect trust boundary", () => {
  it("gates public county business search before its limit", () => {
    const repository = read("server/repositories/businessRepository.ts");
    const method = repository.slice(
      repository.indexOf("async getProvidersByCountyAndCategory"),
      repository.indexOf("async getActiveBusinessForUser")
    );

    expect(method).toContain("eq(businesses.publicDiscoveryEnabled, true)");
    expect(method).toContain("publicBusinessDetailExposureSqlPredicate()");
    expect(method).toContain(".leftJoin(users, eq(businesses.ownerUserId, users.id))");
    expect(method.indexOf("publicBusinessDetailExposureSqlPredicate()")).toBeLessThan(
      method.indexOf(".limit(limit)")
    );
  });

  it("rechecks raw business ids before automatic or direct assignment", () => {
    const route = read("server/routes/direct-connect.ts");
    const eligibility = route.slice(
      route.indexOf("async function filterBusinessesEligibleForRequest"),
      route.indexOf("async function canResponderUserAccessRequest")
    );

    expect(eligibility).toContain("eq(businesses.publicDiscoveryEnabled, true)");
    expect(eligibility).toContain("publicBusinessDetailExposureSqlPredicate()");
    expect(eligibility).toContain('reason: "business_not_publicly_eligible"');
    expect(route.match(/filterBusinessesEligibleForRequest\(/g)?.length).toBeGreaterThan(4);
    expect(route).toContain("storage.getProvidersByCountyAndCategory({");
  });

  it("requires canonical public profile authority for automatic and selected contractors", () => {
    const route = read("server/routes/direct-connect.ts");
    const trustFilter = route.slice(
      route.indexOf("async function filterContractorsByPublicProfileTrust"),
      route.indexOf("async function filterContractorsEligibleForRequest")
    );
    const automatic = route.slice(
      route.indexOf("let usedExpandedFallback"),
      route.indexOf("// Universal business routing")
    );

    expect(trustFilter).toContain("loadCanonicalPublicMapProfileUrls(userIds)");
    expect(trustFilter).toContain('reason: "contractor_profile_not_publicly_eligible"');
    expect(automatic).toContain("filterContractorsByPublicProfileTrust(baseContractors)");
    expect(route).toContain("filterContractorsEligibleForRequest(");
  });
});
