import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin production acceptance", () => {
  it("exposes the authenticated Super Admin report endpoint", () => {
    const source = read("server/routes/admin-tool-discovery.ts");
    expect(source).toContain('router.get("/production-acceptance"');
    expect(source).toContain('router.post("/production-acceptance/write-canary"');
    expect(source).toContain("runWriteCanary: true");
    expect(source).toContain("runProductionAcceptanceReport");
    expect(source).toMatch(
      /router\.use\(\s*\["\/production-acceptance", "\/ecosystem-truth", "\/tool-blueprints"\],\s*isAuthenticated,\s*isSuperAdmin\s*\)/
    );
    expect(source).not.toContain('role === "super_admin"');
  });

  it("checks the eight required operating lanes", () => {
    const source = read("server/services/adminProductionAcceptance.ts");
    for (const lane of [
      'id: "requests"',
      'id: "partner_operations"',
      'id: "county_coverage"',
      'id: "commercial_work"',
      'id: "procurement"',
      'id: "sales_pipeline"',
      'id: "system_status"',
      'id: "finance"',
    ]) {
      expect(source).toContain(lane);
    }
  });

  it("uses a temporary transaction canary and rolls it back", () => {
    const source = read("server/services/adminProductionAcceptance.ts");
    expect(source).toContain("CREATE TEMP TABLE admin_production_acceptance_canary");
    expect(source).toContain('await client.query("BEGIN")');
    expect(source).toContain('await client.query("ROLLBACK")');
    expect(source).toContain("options.runWriteCanary");
    expect(source).toContain("writeCanaryNotRun");
    expect(source).not.toContain("INSERT INTO businesses");
    expect(source).not.toContain("INSERT INTO work_requests");
    expect(source).not.toContain("INSERT INTO wallet_transactions");
  });

  it("uses the live users schema rather than removed legacy columns", () => {
    const source = read("server/services/usersAggregationJob.ts");
    expect(source).toContain("u.verification_status::text = 'approved'");
    expect(source).toContain("COALESCE(u.verified_badge, false)");
    expect(source).toContain("u.role::text = 'contractor'");
    expect(source).toContain("u.active_role = 'homeowner'");
    expect(source).not.toContain("u.verified_at");
    expect(source).not.toContain("u.user_role");
  });

  it("resolves affiliate county through the affiliate user", () => {
    const source = read("server/services/affiliatesAggregationJob.ts");
    expect(source).toContain("INNER JOIN users u ON u.id = a.affiliate_id");
    expect(source).toContain("u.county_fips");
    expect(source).not.toContain("a.county_fips");
  });

  it("uses the canonical runtime health audit for managed partner acceptance", () => {
    const source = read("server/services/adminProductionAcceptance.ts");
    const intake = read("server/services/managedPartnerIntake.ts");
    expect(source).toContain("getRuntimeManagedPartnerProfileHealth");
    expect(source).toContain("profileHealth.summary.blocked");
    expect(source).toContain("profileHealth.summary.attention");
    expect(source).toContain("profileHealth.summary.ready");
    expect(source).not.toContain("ILIKE '%tradescout%'");
    expect(source).not.toContain("ownership_mismatches");
    expect(intake).not.toContain("ensureManagedPartnerOpsTables");
    expect(intake).not.toMatch(/CREATE\s+(?:TABLE|INDEX)/i);
  });

  it("returns unsupported TradeDeals aggregation explicitly and keeps County Coverage unavailable", () => {
    const aggregation = read("server/services/tradeDealsAggregationJob.ts");
    const acceptance = read("server/services/adminProductionAcceptance.ts");
    const validation = read("server/services/phase2bValidation.ts");
    expect(aggregation).toContain('columns.has("county_fips")');
    expect(aggregation).toContain("information_schema.columns");
    expect(aggregation).toContain('availability: "unsupported"');
    expect(aggregation).toContain("unavailableReason");
    expect(aggregation).toContain("isValid: null");
    expect(validation).toContain('validation.availability === "unsupported"');
    expect(acceptance).toContain("trade_deals_has_county");
    expect(acceptance).toContain("tradeDealsHaveCounty &&");
    expect(acceptance).toContain("status: !tradeDealsHaveCounty");
    expect(acceptance).toContain("this lane remains unavailable");
  });

  it("blocks System Status on stale bot evidence, server failures, or degraded sources", () => {
    const source = read("server/services/adminProductionAcceptance.ts");
    expect(source).toContain("bot_age_seconds");
    expect(source).toContain("botAge > 30 * 60");
    expect(source).toContain("crawler5xx > 0");
    expect(source).toContain("bot5xx > 0");
    expect(source).toContain("degradedSources > 0");
  });
});
