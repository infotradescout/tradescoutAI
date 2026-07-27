import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect dispatch ledger contracts", () => {
  it("persists finalized canonical direct connect requests", () => {
    const routeSource = read("server/routes/direct-connect.ts");
    expect(routeSource).toContain("persistFinalizedDispatchRequest");
    expect(routeSource).toContain("CanonicalDirectConnectRequest");
  });

  it("creates candidate snapshots for route-ready requests and eligibility outcomes", () => {
    const routeSource = read("server/routes/direct-connect.ts");
    expect(routeSource).toContain("snapshotDispatchCandidate");
    expect(routeSource).toContain("candidate_eligible");
  });

  it("writes dispatch audit lifecycle events", () => {
    const routeSource = read("server/routes/direct-connect.ts");
    expect(routeSource).toContain("request_finalized");
    expect(routeSource).toContain("request_route_ready");
    expect(routeSource).toContain("request_route_blocked");
    expect(routeSource).toContain("request_shared");
    expect(routeSource).toContain("contact_requested");
    expect(routeSource).toContain("contact_released");
    expect(routeSource).toContain("contractor_responded");
  });

  it("keeps contact locked by default and prevents release without explicit approval", () => {
    const migration = read("migrations/0115_direct_connect_ledger_foundation.sql");
    const serviceSource = read("server/services/directConnectDispatchLedgerService.ts");
    expect(migration).toContain("contact_gate_state text NOT NULL DEFAULT 'locked'");
    expect(serviceSource).toContain("CONTACT_RELEASE_REQUIRES_APPROVAL");
    expect(serviceSource).toContain("AND contact_gate_state IN ('user_approved', 'released')");
    expect(serviceSource).toContain("AND contact_gate_assignment_id = ${normalized.assignmentId}");
    expect(serviceSource).toContain("AND contact_gate_provider_key = ${normalized.providerKey}");
  });

  it("stores contractor response contract in structured table", () => {
    const migration = read("migrations/0115_direct_connect_ledger_foundation.sql");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS direct_connect_contractor_responses");
    expect(migration).toContain("response_type text NOT NULL");
    expect(migration).toContain("contact_request_state text NOT NULL DEFAULT 'locked'");
  });

  it("owns ledger schema through migration instead of fire-and-forget route startup DDL", () => {
    const routeSource = read("server/routes/direct-connect.ts");
    const serviceSource = read("server/services/directConnectDispatchLedgerService.ts");
    const migration = read("migrations/0115_direct_connect_ledger_foundation.sql");
    const schemaGuard = read("scripts/check-required-production-schema.mjs");
    const requiredTables = [
      "direct_connect_dispatch_requests",
      "direct_connect_dispatch_candidates",
      "direct_connect_dispatch_events",
      "direct_connect_contractor_responses",
      "direct_connect_lifecycle_notifications",
      "direct_connect_job_workspaces",
      "direct_connect_notifications",
      "job_estimates",
      "job_estimate_line_items",
      "job_material_items",
      "job_labor_items",
      "job_acceptances",
      "job_payment_requests",
      "job_schedule_proposals",
      "job_payment_records",
      "job_checkpoints",
      "job_change_orders",
      "job_punch_list_items",
      "job_completion_requests",
      "job_invoices",
      "job_invoice_line_items",
      "job_receipts",
    ];
    expect(routeSource).not.toContain("ensureDirectConnectDispatchLedgerTables");
    expect(serviceSource).not.toContain("ensureDirectConnectDispatchLedgerTables");
    for (const table of requiredTables) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      expect(schemaGuard).toContain(`'${table}'`);
    }
    expect(migration).toContain("idx_dc_contractor_responses_assignment_binding");
    expect(migration).toContain("direct_connect_notifications_idempotency_idx");
    expect(migration).toContain("CREATE OR REPLACE VIEW direct_connect_exact_binding_violations");
    expect(schemaGuard).toContain("FROM direct_connect_exact_binding_violations");
    expect(schemaGuard).toContain("directConnectExactBindingReady");
  });

  it("does not use payment, ads, featured placement, or subscription status in eligibility", () => {
    const spineSource = read("shared/directConnectRoutingSpine.ts").toLowerCase();
    expect(spineSource).toContain("paymentstatus");
    expect(spineSource).toContain("adstatus");
    expect(spineSource).toContain("featuredplacement");
    expect(spineSource).toContain("subscriptionlevel");
    expect(spineSource).not.toContain("if (!input.paymentstatus");
    expect(spineSource).not.toContain("if (!input.adstatus");
    expect(spineSource).not.toContain("featuredplacement)");
    expect(spineSource).not.toContain("subscriptionlevel)");
  });
});
