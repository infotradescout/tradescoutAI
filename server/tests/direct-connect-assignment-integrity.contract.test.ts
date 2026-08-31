import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect assignment integrity contracts", () => {
  it("creates visibility assignments only through eligible contractor/provider routing", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("filterContractorsEligibleForRequest");
    expect(source).toContain("filterBusinessesEligibleForRequest");
    expect(source).toContain(
      "const allAssignments = [...contractorAssignments, ...businessAssignments]"
    );
    expect(source).toContain('logDirectConnectFunnelEvent("direct_connect_visible_to_contractors"');
  });

  it("emits visible-to-contractors event when assignment rows are created", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("logDirectConnectVisibilityEvent({");
    expect(source).toContain("visibleContractorCount: allAssignments.length");
  });

  it("does not require Home Record/HomeID to create routed assignment visibility", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("if (created && shouldAutoRoute) {");
    expect(source).toContain("await routeRequestToTopContractors({");
    expect(source).toContain("if (homeId && homePacketId) {");
  });

  it("keeps HomeID draft submission path non-routing and event-only", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/requests/:id/submit-homeid-draft"');
    expect(source).toContain('type: "homeid_draft_submitted"');
    expect(source).not.toContain("Failed to auto-route request on submit-homeid-draft");
  });

  it("flags HomeID preview drafts separately for board filtering and artifact suppression", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain(
      'if (type === "homeid_draft_created") homeIdDraftCreatedByRequest.add(key);'
    );
    expect(source).toContain("isHomeIdPreviewDraft:");
  });

  it("blocks unauthorized/non-eligible providers from request access and action paths", () => {
    const source = [
      read("server/routes/direct-connect.ts"),
      read("server/routes/direct-connect/job-lifecycle.ts"),
    ].join("\n");
    expect(source).toContain("canResponderUserAccessRequest");
    expect(source).toContain('message: "Assignment not found"');
    expect(source).toContain('message: "Only the eligible business can start work."');
  });

  it("keeps requester contact redacted unless an eligible provider receives gate release", () => {
    const routes = read("server/routes/direct-connect.ts");
    const ledger = read("server/services/directConnectDispatchLedgerService.ts");
    expect(routes).toContain("homeownerContact: releasedContact");
    expect(ledger).toContain("getReleasedRequesterContactForProvider");
    expect(ledger).toContain("dispatch.contact_gate_state = 'released'");
    expect(ledger).toContain("candidate.eligibility_state = 'eligible'");
  });

  it("keeps routing integrity independent of paid placement/ranking fields", () => {
    const source = read("shared/directConnectRoutingSpine.ts");
    expect(source).toContain('paymentStatus?: "paid" | "unpaid" | "none";');
    expect(source).toContain("featuredPlacement?: boolean;");
    expect(source).toContain('subscriptionLevel?: "free" | "pro" | "enterprise" | "none";');
    expect(source).toContain('return { status: "eligible", eligible: true };');
  });
});
