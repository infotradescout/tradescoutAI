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
    const serviceSource = read("server/services/directConnectDispatchLedgerService.ts");
    expect(serviceSource).toContain("contact_gate_state text NOT NULL DEFAULT 'locked'");
    expect(serviceSource).toContain("CONTACT_RELEASE_REQUIRES_APPROVAL");
    expect(serviceSource).toContain("AND contact_gate_state = 'user_approved'");
  });

  it("stores contractor response contract in structured table", () => {
    const serviceSource = read("server/services/directConnectDispatchLedgerService.ts");
    expect(serviceSource).toContain(
      "CREATE TABLE IF NOT EXISTS direct_connect_contractor_responses"
    );
    expect(serviceSource).toContain("response_type text NOT NULL");
    expect(serviceSource).toContain("contact_request_state text NOT NULL DEFAULT 'locked'");
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
