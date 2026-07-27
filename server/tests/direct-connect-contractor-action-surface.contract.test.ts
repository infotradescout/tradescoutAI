import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect contractor action surface contracts", () => {
  it("keeps contractor-visible routed request list and detail endpoints", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/contractor/requests"');
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id"');
  });

  it("keeps contractor action CTA endpoints in place", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id/respond"');
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id/request-contact"');
  });

  it("emits contractor action started analytics on contractor response", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain(
      'logDirectConnectFunnelEvent("direct_connect_contractor_action_started"'
    );
    expect(source).toContain("await recordContractorResponse(");
    expect(source).toContain("DIRECT_CONNECT_EXACT_ASSIGNMENT_REQUIRED");
  });

  it("preserves contact gate by requiring response before requesting contact", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("Accept the exact assignment before requesting contact.");
    expect(source).toContain("resolveDirectConnectAcceptedProviderBinding(requestId)");
    expect(source).toContain("acceptedBinding.providerUserId !== userId");
    expect(source).toContain('nextState: "contractor_requested"');
  });

  it("reports the persisted request-contact state and never re-appends advanced gates", () => {
    const source = read("server/routes/direct-connect.ts");
    const routeStart = source.indexOf(
      '"/api/direct-connect/contractor/requests/:id/request-contact"'
    );
    const routeEnd = source.indexOf(
      '"/api/direct-connect/jobs/:jobWorkspaceId/estimates"',
      routeStart
    );
    const requestContactRoute = source.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(requestContactRoute).toContain(
      "const contactGateResult = await db.transaction(async (tx: any)"
    );
    expect(requestContactRoute).toContain(
      "SELECT contact_gate_state, contact_gate_assignment_id, contact_gate_provider_key"
    );
    expect(requestContactRoute).toContain("FOR UPDATE");
    expect(requestContactRoute).toContain('new Set(["user_approved", "released"])');
    expect(requestContactRoute).toContain("? { ok: true as const, state: persistedGate.state }");
    expect(requestContactRoute).toContain("contactGateState: contactGateResult.state");
    expect(requestContactRoute).not.toContain('contactGateState: "contractor_requested"');
    expect(requestContactRoute.indexOf("await appendDispatchEvent(")).toBeGreaterThan(
      requestContactRoute.indexOf("advancedContactGateStates.has(persistedGate.state)")
    );
  });

  it("keeps requester contact redacted in contractor request detail payload", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("homeownerContact: null");
  });

  it("blocks non-eligible/non-provider actors from unauthorized contractor action paths", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('message: "Assignment not found"');
    expect(source).toContain(
      'message: "Only registered providers (contractors or businesses) can express interest."'
    );
  });

  it("uses human empty-state copy in contractor dashboard when no routed requests exist", () => {
    const source = read("client/src/pages/contractor-dashboard.tsx");
    expect(source).toContain(
      "No routed requests yet. When a matching local request appears, it will show here."
    );
    expect(source).not.toContain("eligibility_state");
    expect(source).not.toContain("direct_connect_dispatch_candidates");
  });
});
