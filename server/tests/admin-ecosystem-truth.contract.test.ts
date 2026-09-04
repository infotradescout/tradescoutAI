import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin Ecosystem Truth", () => {
  it("exposes one authenticated Super Admin read endpoint", () => {
    const route = read("server/routes/admin-tool-discovery.ts");

    expect(route).toContain('router.get("/ecosystem-truth"');
    expect(route).toContain("runAdminEcosystemTruthReport");
    expect(route).toContain("router.use(isAuthenticated, isSuperAdmin)");
    expect(route).toContain('res.setHeader("Cache-Control", "no-store")');
    expect(route).not.toContain('router.post("/ecosystem-truth"');
    expect(route).not.toContain('router.put("/ecosystem-truth"');
    expect(route).not.toContain('router.patch("/ecosystem-truth"');
    expect(route).not.toContain('router.delete("/ecosystem-truth"');
  });

  it("reads existing owners without creating a competing write authority", () => {
    const service = read("server/services/adminEcosystemTruth.ts");

    for (const source of [
      "profile_accounts",
      "work_requests",
      "direct_connect_dispatch_requests",
      "managed_partner_intakes",
      "realtor_profiles",
      "car_salesman_profiles",
      "procurement_orders",
      "stone_materials",
      "stone_inventory_positions",
      "professional_partnerships",
      "affiliate_attribution_conversions",
      "wallet_transactions",
      "scout_outcome_events",
    ]) {
      expect(service).toContain(source);
    }

    for (const writePattern of [
      "INSERT INTO",
      "UPDATE professional_",
      "UPDATE work_",
      "DELETE FROM",
      "CREATE TABLE",
      "ALTER TABLE",
      "DROP TABLE",
    ]) {
      expect(service).not.toContain(writePattern);
    }

    expect(service).not.toContain("ensureStoneCoreTables");
    expect(service).not.toContain("ensureDirectConnectDispatchLedgerTables");
    expect(service).toContain('mode: "read_only"');
    expect(service).toContain('mode: "index_only"');
    expect(service).toContain('mode: "projection_only"');
  });

  it("keeps missing evidence and broken links visible", () => {
    const service = read("server/services/adminEcosystemTruth.ts");

    expect(service).toContain("No fallback value was invented");
    expect(service).toContain("No written referral terms are attached to this record");
    expect(service).toContain("not treated as signed agreement proof");
    expect(service).toContain("No historical event is manufactured");
    expect(service).toContain("unsupported_inventory_claims");
    expect(service).toContain("unlinkedOutcomeEvents");
    expect(service).toContain("recordCount: null");
    expect(service).toContain("linkedCount: null");
    expect(service).toContain("unlinkedCount: null");
    expect(service).toContain("Neither professional vertical is retired, disabled, or treated as abandoned");
  });
});
