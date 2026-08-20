import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Admin OS production acceptance", () => {
  it("covers all eight required operating lanes", () => {
    const source = read("server/services/adminProductionAcceptance.ts");
    for (const lane of [
      '"requests"',
      '"partners"',
      '"county_coverage"',
      '"commercial_work"',
      '"procurement"',
      '"sales_pipeline"',
      '"system_status"',
      '"finance"',
    ]) {
      expect(source).toContain(lane);
    }
    expect(source).toContain('"working" | "empty" | "unavailable" | "blocked"');
  });

  it("uses the established partner health and intake services", () => {
    const source = read("server/services/adminProductionAcceptance.ts");
    expect(source).toContain("getRuntimeManagedPartnerProfileHealth");
    expect(source).toContain("listManagedPartnerIntakes");
  });

  it("keeps the acceptance routes authenticated and admin-only", () => {
    const routes = read("server/routes/professional-partnerships.ts");
    expect(routes).toContain('"/api/admin/production-acceptance"');
    expect(routes).toContain('"/api/admin/production-acceptance/run"');
    expect(routes).toContain('"/admin/production-acceptance"');
    expect(routes).toContain('"/admin/production-acceptance/run"');
    expect(routes).toContain("isAuthenticated");
    expect(routes).toContain("requireAdmin");
    expect(routes).toContain("scheduleProductionAcceptanceAudit");
  });

  it("uses a rollback-only temporary write proof", () => {
    const source = read("server/services/adminProductionAcceptance.ts");
    expect(source).toContain("CREATE TEMP TABLE admin_acceptance_write_probe");
    expect(source).toContain("ON COMMIT DROP");
    expect(source).toContain("ROLLBACK");
    expect(source).toContain("no production business record persisted");
    expect(source).not.toContain("INSERT INTO businesses");
    expect(source).not.toContain("INSERT INTO profiles");
    expect(source).not.toContain("INSERT INTO procurement_orders");
    expect(source).not.toContain("INSERT INTO wallet_transactions");
  });

  it("does not create a new public acceptance endpoint", () => {
    const routes = read("server/routes/professional-partnerships.ts");
    expect(routes).not.toContain("/api/public/production-acceptance");
    expect(routes).not.toContain("/public/production-acceptance");
  });

  it("records unavailable sources instead of successful zeroes", () => {
    const source = read("server/services/adminProductionAcceptance.ts");
    expect(source).toContain('status: "unavailable"');
    expect(source).toContain("The production source could not complete its acceptance query");
    expect(source).toContain("No canonical request table was found");
    expect(source).toContain("No canonical wallet or finance-ledger transaction source was found");
  });
});
