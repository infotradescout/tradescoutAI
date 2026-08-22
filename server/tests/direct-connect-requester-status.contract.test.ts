import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect requester status contracts", () => {
  it("supports requester list and detail endpoints", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/requests"');
    expect(source).toContain('"/api/direct-connect/requests/:id"');
    expect(source).toContain("isAuthenticated");
    expect(source).toContain("eq(workRequests.createdByUserId, String(userId))");
    expect(source).toContain("Sign in is required to view posted Direct Connect requests.");
    expect(source).toContain("You can only view your own requests");
  });

  it("keeps nonterminal work visible while bounding only terminal history", () => {
    const source = read("server/routes/direct-connect.ts");
    const listStart = source.indexOf("// Requester-facing: list Direct Connect requests");
    const detailStart = source.indexOf('"/api/direct-connect/requests/:id"', listStart);
    const listBlock = source.slice(listStart, detailStart);

    expect(listBlock).toContain(
      'const isTerminal = normalizedStatus === "completed" || normalizedStatus === "cancelled"'
    );
    expect(listBlock).toContain("if (isTerminal) {");
    expect(listBlock).toContain('"pending_outcome"');
  });

  it("surfaces requester-list schema failure instead of presenting a false empty queue", () => {
    const source = read("server/routes/direct-connect.ts");
    const listStart = source.indexOf("// Requester-facing: list Direct Connect requests");
    const detailStart = source.indexOf('"/api/direct-connect/requests/:id"', listStart);
    const listBlock = source.slice(listStart, detailStart);

    expect(listBlock).toContain('code: "DIRECT_CONNECT_REQUEST_LIST_SCHEMA_UNAVAILABLE"');
    expect(listBlock).toContain("return res.status(503).json({");
    expect(listBlock).not.toContain("schema mismatch while listing requests; returning empty list");
  });

  it("includes contractor responses and contact-request visibility in request detail", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("FROM direct_connect_contractor_responses");
    expect(source).toContain("responseType");
    expect(source).toContain("contactRequestState");
    expect(source).toContain("contactRequestCount");
    expect(source).toContain("allowedRequesterActions");
  });

  it("keeps request detail privacy-safe for requester consumption", () => {
    const source = read("server/routes/direct-connect.ts");
    const detailStart = source.indexOf('"/api/direct-connect/requests/:id"');
    const detailEnd = source.indexOf('"/api/direct-connect/requests/:id/share"');
    const detailBlock =
      detailStart >= 0 && detailEnd > detailStart ? source.slice(detailStart, detailEnd) : source;
    expect(detailBlock).not.toContain("SELECT * FROM direct_connect_contractor_responses");
    expect(detailBlock).not.toContain("homeownerContact");
    expect(detailBlock).not.toContain("emailAddress");
    expect(detailBlock).not.toContain("phoneNumber");
  });

  it("serializes contact gate payload through the server serializer for requester list and detail", () => {
    const source = read("server/routes/direct-connect.ts");

    expect(source).toContain("serializeDirectConnectCardContactGatePayload({");
    expect(source).toContain("contactGateState: contactGatePayload.contactGateState");
    expect(source).toContain("...(contactGatePayload.releasedContact");
    expect(source).not.toContain("releasedContact: dispatch?.released_contact");
  });

  it("keeps the share payload redacted and contact-locked", () => {
    const source = read("server/routes/direct-connect.ts");
    const shareStart = source.indexOf('"/api/direct-connect/share/:token"');
    const shareEnd = source.indexOf('"/api/direct-connect/requests/:id/contact-gate"');
    const shareBlock =
      shareStart >= 0 && shareEnd > shareStart ? source.slice(shareStart, shareEnd) : source;

    expect(shareBlock).toContain("buildWorkRequestScopeSummary");
    expect(shareBlock).toContain("buildWorkRequestPreviewTitle");
    expect(shareBlock).toContain("contactLocked: true");
    expect(shareBlock).toContain("requiresJoinAndVerification: true");
    expect(shareBlock).not.toContain("releasedContact");
    expect(shareBlock).not.toContain("homeownerContact");
  });

  it("keeps contact release behind requester approval transitions", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("contractor_requested->user_approved");
    expect(source).toContain("user_approved->released");
    expect(source).toContain("contractor_requested->denied");
    expect(source).toContain("CONTACT_RELEASE_REQUIRES_APPROVAL");
    expect(source).toContain("Invalid contact gate transition");
  });

  it("records requester visibility and approval audit events", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("requester_viewed_request");
    expect(source).toContain("requester_viewed_response");
    expect(source).toContain("homeowner_viewed_request");
    expect(source).toContain("homeowner_viewed_response");
    expect(source).toContain("contact_approved");
    expect(source).toContain("contact_denied");
    expect(source).toContain("contact_released");
    expect(source).toContain("request_closed");
  });

  it("keeps contractor-side contact request separate from release", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id/request-contact"');
    expect(source).toContain('nextState: "contractor_requested"');
    expect(source).not.toContain('"/api/direct-connect/contractor/requests/:id/release-contact"');
  });

  it("shows requester status actions in my requests surface", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("Approve contact");
    expect(source).toContain("Decline");
    expect(source).toContain("Release contact");
    expect(source).toContain("/api/direct-connect/requests/${payload.requestId}/contact-gate");
    expect(source).toContain("No requests in this view");
    expect(source).toContain("Sign in to view and manage your requests.");
    expect(source).toContain("Contact released");
  });

  it("does not add monetization-based routing language", () => {
    const routeSource = read("server/routes/direct-connect.ts").toLowerCase();
    const uiSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx").toLowerCase();
    for (const source of [routeSource, uiSource]) {
      expect(source).not.toContain("buy lead");
      expect(source).not.toContain("claim lead");
      expect(source).not.toContain("lead marketplace");
      expect(source).not.toContain("boosted placement");
      expect(source).not.toContain("featured placement");
      expect(source).not.toContain("subscription priority");
      expect(source).not.toContain("paid placement");
      expect(source).not.toContain("premium lead");
    }
  });

  it("requires authentication for posted request actions", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("AUTH_REQUIRED_TO_SHARE_REQUEST");
    expect(source).toContain("AUTH_REQUIRED_TO_VIEW_REQUESTS");
    expect(source).toContain("AUTH_REQUIRED_TO_VIEW_REQUEST_DETAIL");
    expect(source).toContain("AUTH_REQUIRED_TO_UPDATE_CONTACT_GATE");
    expect(source).toContain("Only the request owner can update contact approval");
  });

  it("keeps anonymous continuity limited to local draft state", () => {
    const uiSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(uiSource).toContain("Create your free account to share this request");
    expect(uiSource).toContain("Your contact information stays private until you approve");
  });

  it("avoids homeowner-only language in generic requester surfaces", () => {
    const uiSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(uiSource).toContain("My Requests");
    expect(uiSource).toContain("A local business responded");
    expect(uiSource).toContain("They are asking to contact you");
    expect(uiSource).not.toContain("homeowner status");
    expect(uiSource).not.toContain("homeowner approval");
  });
});
