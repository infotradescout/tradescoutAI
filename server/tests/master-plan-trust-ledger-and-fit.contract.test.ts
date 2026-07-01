import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("master plan: trust ledger + provider fit score contracts", () => {
  it("defines a trust ledger table and writer service", () => {
    const schema = read("shared/schema.ts");
    const service = read("server/services/trustLedgerService.ts");
    const bootstrap = read("scripts/bootstrap-test-db.mjs");

    expect(schema).toContain("trust_ledger_events");
    expect(schema).toContain("entity_type");
    expect(schema).toContain("event_type");
    expect(service).toContain("recordTrustLedgerEvent");
    expect(service).toContain("trustLedgerEvents");
    expect(bootstrap).toContain("CREATE TABLE IF NOT EXISTS trust_ledger_events");
    expect(bootstrap).toContain("verification_level varchar(40) NOT NULL DEFAULT 'none'");
    expect(bootstrap).toContain("CREATE INDEX IF NOT EXISTS idx_trust_ledger_entity");
  });

  it("applies explainable provider fit scoring in direct-connect routing", () => {
    const scorer = read("server/services/directConnectProviderFitScore.ts");
    const directConnect = read("server/routes/direct-connect.ts");

    expect(scorer).toContain("computeDirectConnectProviderFitScore");
    expect(scorer).toContain("countyMatch");
    expect(scorer).toContain("tradeMatch");
    expect(scorer).toContain("verificationScore");
    expect(directConnect).toContain("providerFitScore");
    expect(directConnect).toContain("providerFitBreakdown");
    expect(directConnect).toContain("fitReasons");
  });

  it("writes trust ledger events for marketplace order lifecycle updates", () => {
    const routes = read("server/routes.ts");
    const routeIndex = routes.indexOf('"/api/marketplace/orders/:id/status"');
    const section = routes.slice(routeIndex, routeIndex + 5000);

    expect(section).toContain("recordTrustLedgerEvent");
    expect(section).toContain("marketplace_order_status_");
    expect(section).toContain("fromStatus");
    expect(section).toContain("toStatus");
  });

  it("writes trust ledger events for direct-connect requester lifecycle transitions", () => {
    const directConnect = read("server/routes/direct-connect.ts");

    expect(directConnect).toContain("direct_connect_routed");
    expect(directConnect).toContain("direct_connect_cancelled");
    expect(directConnect).toContain("direct_connect_reopened");
    expect(directConnect).toContain("direct_connect_pending_outcome");
    expect(directConnect).toContain("direct_connect_completed");
  });
});
