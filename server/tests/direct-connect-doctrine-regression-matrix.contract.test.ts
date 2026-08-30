import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("direct connect doctrine regression matrix", () => {
  it("locks no-pay-to-play routing and visibility invariants", () => {
    const routingSpine = read("shared/directConnectRoutingSpine.ts");
    expect(routingSpine).toContain('paymentStatus?: "paid" | "unpaid" | "none";');
    expect(routingSpine).toContain("featuredPlacement?: boolean;");
    expect(routingSpine).toContain('subscriptionLevel?: "free" | "pro" | "enterprise" | "none";');
    expect(routingSpine).toContain('return { status: "eligible", eligible: true };');
  });

  it("locks no-lead-selling and contact-gate redaction pre-release", () => {
    const routes = read("server/routes/direct-connect.ts");
    expect(routes).toContain("homeownerContact: null");
    expect(routes).toContain(
      'canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved"'
    );
    const shareUtils = read("server/utils/workRequestShare.ts");
    expect(shareUtils).toContain("serializeDirectConnectCardContactGatePayload");
    expect(shareUtils).toContain(
      'contactGateState === "released" || contactGateState === "contact_released"'
    );
  });

  it("locks Home Record optionality across create/review/submit/routing path", () => {
    const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const routes = read("server/routes/direct-connect.ts");
    expect(shell).toContain('>("skip_for_now")');
    expect(shell).toContain("handleSkipAndAutoRoute");
    expect(shell).toContain("autoRoute: true");
    expect(routes).toContain("if (created && shouldAutoRoute) {");
    expect(routes).toContain("await routeRequestToTopContractors({");
  });

  it("locks preview/test/HomeID draft artifact suppression markers", () => {
    const routes = read("server/routes/direct-connect.ts");
    const presentation = read("client/src/pages/direct-connect/requestCardPresentation.ts");
    expect(routes).toContain("isHomeIdPreviewDraft:");
    expect(routes).toContain(
      'if (type === "homeid_draft_created") homeIdDraftCreatedByRequest.add(key);'
    );
    expect(presentation).toContain("if (request.isHomeIdPreviewDraft) return true;");
  });

  it("locks staff oversight boundary with role-gated audited mutation path", () => {
    const routes = read("server/routes/direct-connect.ts");
    expect(routes).toContain('"/api/admin/direct-connect/requests"');
    expect(routes).toContain('requireRole(["ops_admin", "super_admin"])');
    expect(routes).toContain("isDirectConnectOperator,");
    expect(routes).toContain('action: "admin_direct_connect_target_resolved"');
    expect(routes).toContain('operation: "admin_create"');
  });

  it("locks human-readable lifecycle/status presentation", () => {
    const presentationTest = read(
      "client/src/pages/direct-connect/requestCardPresentation.test.ts"
    );
    expect(presentationTest).toContain(
      "prevents raw internal enums from leaking into card status labels"
    );
    expect(presentationTest).toContain("hides internal HomeID preview copy on request cards");
    expect(presentationTest).toContain("uses non-contradictory status copy");
    expect(presentationTest).toContain(
      "covers the contact-gate regression matrix for fail-closed contact exposure"
    );
    expect(presentationTest).toContain("missing state");
    expect(presentationTest).toContain("unknown state");
  });

  it("locks funnel instrumentation coverage in KPI allowlist", () => {
    const analyticsRoutes = read("server/routes/analytics-routes.ts");
    expect(analyticsRoutes).toContain('"direct_connect_request_started"');
    expect(analyticsRoutes).toContain('"direct_connect_request_review_opened"');
    expect(analyticsRoutes).toContain('"direct_connect_request_submitted"');
    expect(analyticsRoutes).toContain('"direct_connect_visible_to_contractors"');
    expect(analyticsRoutes).toContain('"direct_connect_request_visible_to_contractors"');
    expect(analyticsRoutes).toContain('"direct_connect_contractor_action_started"');
  });

  it("keeps focused hardening harnesses present for doctrine surfaces", () => {
    const tests = read(
      "server/tests/direct-connect-end-to-end-local-lifecycle-smoke.contract.test.ts"
    );
    const assignment = read("server/tests/direct-connect-assignment-integrity.contract.test.ts");
    const contractor = read(
      "server/tests/direct-connect-contractor-action-surface.contract.test.ts"
    );
    const staff = read("server/tests/direct-connect-staff-oversight.contract.test.ts");
    const notifications = read(
      "server/tests/direct-connect-notification-delivery-safety.contract.test.ts"
    );

    expect(tests).toContain("direct connect end-to-end local lifecycle smoke");
    expect(assignment).toContain("direct connect assignment integrity contracts");
    expect(contractor).toContain("direct connect contractor action surface contracts");
    expect(staff).toContain("direct connect admin/staff oversight contracts");
    expect(notifications).toContain("direct connect notification/email delivery safety contracts");
  });
});
