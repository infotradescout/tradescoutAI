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
    expect(source).toContain("runProductionAcceptanceReport");
    expect(source).toContain("router.use(isAuthenticated)");
    expect(source).toContain("Super admin access required");
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

  it("does not query county TradeDeals fields unless the schema supplies them", () => {
    const source = read("server/services/tradeDealsAggregationJob.ts");
    expect(source).toContain('columns.has("county_fips")');
    expect(source).toContain("County aggregation skipped");
    expect(source).toContain("information_schema.columns");
  });
});
