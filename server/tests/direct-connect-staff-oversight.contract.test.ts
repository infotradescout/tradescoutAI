import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

const sectionBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex === -1 || endIndex === -1) return "";
  return source.slice(startIndex, endIndex);
};

describe("direct connect admin/staff oversight contracts", () => {
  it("keeps private Direct Connect operations limited to ops and super admins", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/admin/direct-connect/requests"');
    expect(source).toContain("isAuthenticated,");
    expect(source).toContain('requireRole(["ops_admin", "super_admin"])');
    expect(source).toContain("isDirectConnectOperator,");
    expect(source).not.toContain("isStaff,");
  });

  it("keeps staff/admin mutation paths explicit and audited", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("await logAdminAction({");
    expect(source).toContain('action: "admin_direct_connect_target_resolved"');
    expect(source).toContain("await auditDirectConnectBypassUsage({");
    expect(source).toContain('operation: "admin_create"');
  });

  it("keeps lifecycle metadata available in support-visible requester detail", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/requests/:id"');
    expect(source).toContain("contactGateState:");
    expect(source).toContain("allowedLifecycleActions,");
    expect(source).toContain("timeline: timelineItems,");
  });

  it("keeps staff/admin read paths free from visibility/action event emission side effects", () => {
    const source = read("server/routes/direct-connect.ts");
    const requesterDetail = sectionBetween(
      source,
      '"/api/direct-connect/requests/:id"',
      '"/api/direct-connect/requests/:id/timeline"'
    );
    const inboxRead = sectionBetween(
      source,
      '"/api/direct-connect/inbox"',
      '"/api/direct-connect/requests/:id"'
    );

    expect(requesterDetail).not.toContain("direct_connect_request_visible_to_contractors");
    expect(requesterDetail).not.toContain("direct_connect_contractor_action_started");
    expect(requesterDetail).not.toContain("contact_released");
    expect(inboxRead).not.toContain("direct_connect_request_visible_to_contractors");
    expect(inboxRead).not.toContain("direct_connect_contractor_action_started");
  });

  it("keeps requester contact redacted in contractor-facing detail payloads before gate release", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("homeownerContact: null");
    expect(source).toContain(
      'canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved"'
    );
  });

  it("keeps requester-facing detail payloads free of contractor contact payload leakage", () => {
    const source = read("server/routes/direct-connect.ts");
    const requesterDetail = sectionBetween(
      source,
      '"/api/direct-connect/requests/:id"',
      '"/api/direct-connect/requests/:id/timeline"'
    );

    expect(requesterDetail).toContain("responses: contractorResponses,");
    expect(requesterDetail).not.toContain("contractorContact");
    expect(requesterDetail).not.toContain("providerPhone");
    expect(requesterDetail).not.toContain("providerEmail");
  });

  it("keeps HomeID preview/test artifacts explicitly represented for staff-safe provenance handling", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain(
      'if (type === "homeid_draft_created") homeIdDraftCreatedByRequest.add(key);'
    );
    expect(source).toContain(
      'if (type === "homeid_draft_submitted") homeIdDraftSubmittedByRequest.add(key);'
    );
    expect(source).toContain("isHomeIdPreviewDraft:");
  });

  it("keeps assignment/routing integrity independent of paid or featured ranking flags", () => {
    const source = read("shared/directConnectRoutingSpine.ts");
    expect(source).toContain('paymentStatus?: "paid" | "unpaid" | "none";');
    expect(source).toContain("featuredPlacement?: boolean;");
    expect(source).toContain('subscriptionLevel?: "free" | "pro" | "enterprise" | "none";');
    expect(source).toContain('return { status: "eligible", eligible: true };');
  });
});
