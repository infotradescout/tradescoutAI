import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("organic growth truth ledger contracts", () => {
  it("records public profile searches after the trusted result set is built", () => {
    const repository = read("server/repositories/profileRepository.ts");
    const search = repository.slice(
      repository.indexOf("async searchProfilesPublic"),
      repository.indexOf("async createProfileForOwner")
    );

    expect(repository).toContain("searchAnalytics");
    expect(search).toContain("const results = await db");
    expect(search).toContain(".insert(searchAnalytics)");
    expect(search).toContain('searchType: "public_profiles"');
    expect(search).toContain("resultsCount: results.length");
    expect(search.indexOf("const results = await db")).toBeLessThan(
      search.indexOf(".insert(searchAnalytics)")
    );
    expect(search).toContain("return results;");
  });

  it("counts distinct referred users instead of anonymous page-view rows", () => {
    const service = read("server/services/affiliateService.ts");
    const stats = service.slice(
      service.indexOf("export async function getAffiliateStats"),
      service.indexOf("export async function getAffiliateReferrals")
    );
    const monthly = service.slice(
      service.indexOf("export async function getMonthlyStats"),
      service.length
    );

    expect(stats).toContain("COUNT(DISTINCT ${affiliateReferrals.referredUserId})");
    expect(stats).not.toContain("COUNT(*)");
    expect(monthly).toContain("const referredUsers = new Set(");
    expect(monthly).toContain("referrals: referredUsers.size");
    expect(monthly).toContain("conversions: referredUsers.size");
  });

  it("separates nationwide page-view attribution from true referrals", () => {
    const nationwide = read("server/routes/nationwide.ts");
    const performance = nationwide.slice(
      nationwide.indexOf("export async function getAffiliatePerformance"),
      nationwide.length
    );

    expect(performance).toContain(
      "count(distinct ${affiliateReferrals.referredUserId})"
    );
    expect(performance).toContain("attributedPageViews");
    expect(performance).toContain("referrals: trueReferrals");
    expect(performance).toContain("conversionRateAvailable: false");
    expect(performance).not.toContain("totalReferrals: sql<number>`count(*)`");
  });
});
