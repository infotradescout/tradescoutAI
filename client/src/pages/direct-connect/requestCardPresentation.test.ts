import {
  getDirectConnectContactGateNextAction,
  getDirectConnectContactGateNextActor,
  getDirectConnectContactGateSummary,
  getDisplayLatestStatus,
  getDisplayRequestDescription,
  getDisplayRequestTitle,
  looksLikeHiddenOrTestRequest,
  normalizeDirectConnectContactState,
} from "./requestCardPresentation";

describe("requestCardPresentation", () => {
  it("formats raw enum title copy to user-facing title", () => {
    expect(getDisplayRequestTitle({ title: "inspection request for single_family" })).toBe(
      "Home inspection request"
    );
  });

  it("hides internal HomeID preview copy on request cards", () => {
    expect(
      getDisplayRequestDescription({
        description: "Prepared from HomeID handoff preview.\nIncluded HomeID details: ...",
      })
    ).toBe("Direct Connect is preparing this request for local providers.");
  });

  it("hides preview/test artifacts from normal board", () => {
    expect(looksLikeHiddenOrTestRequest({ isHomeIdPreviewDraft: true })).toBe(true);
    expect(
      looksLikeHiddenOrTestRequest({
        title: "Inspection request",
        description: "Prepared from HomeID request preview.",
      })
    ).toBe(true);
  });

  it("keeps real user requests visible", () => {
    expect(
      looksLikeHiddenOrTestRequest({
        title: "Need roof repair estimate",
        description: "Leak over garage. Looking for licensed local pros.",
      })
    ).toBe(false);
  });

  it("uses non-contradictory status copy for ready-to-send and routed states", () => {
    expect(getDisplayLatestStatus({ status: "draft", latestStatus: "Open" })).toBe("Draft ready");
    expect(getDisplayLatestStatus({ status: "open", latestStatus: "ready_to_send" })).toBe(
      "Submitted"
    );
    expect(
      getDisplayLatestStatus({ status: "routed", latestStatus: "Waiting for local businesses" })
    ).toBe("Waiting on pros");
  });

  it("renders a single clear requester next-step status when provider activity starts", () => {
    expect(
      getDisplayLatestStatus({
        status: "in_progress",
        latestStatus: "contractor_responded",
        dcConversationThreadId: "thread_123",
      })
    ).toBe("Provider responded");
  });

  it("prevents raw internal enums from leaking into card status labels", () => {
    expect(
      getDisplayLatestStatus({ status: "pending_outcome", latestStatus: "single_family" })
    ).toBe("Choose next step");
  });

  it("shows contact-gated requester next step without exposing direct contact", () => {
    expect(
      getDisplayLatestStatus({
        status: "routed",
        latestStatus: "waiting_for_contact_gate",
        contactGateState: "contractor_requested",
      })
    ).toBe("Review contact request");
  });

  it("maps legacy Direct Connect contact states to exact P2 primitive state names", () => {
    expect(normalizeDirectConnectContactState()).toBe("contact_hidden");
    expect(normalizeDirectConnectContactState("locked")).toBe("contact_hidden");
    expect(normalizeDirectConnectContactState("review_required")).toBe("contact_hidden");
    expect(normalizeDirectConnectContactState("request_shared")).toBe("contact_hidden");
    expect(normalizeDirectConnectContactState("contractor_requested")).toBe(
      "provider_requested_contact"
    );
    expect(normalizeDirectConnectContactState("user_approved")).toBe("requester_approved");
    expect(normalizeDirectConnectContactState("released")).toBe("contact_released");
    expect(normalizeDirectConnectContactState("denied")).toBe("denied");
    expect(normalizeDirectConnectContactState("closed")).toBe("closed");
  });

  it("passes unknown contact states through for fail-closed panel rendering", () => {
    expect(normalizeDirectConnectContactState("mystery_state")).toBe("mystery_state");
  });

  it("provides safe contact gate panel copy without raw request contact data", () => {
    const request = {
      title: "Roof leak",
      description: "Call 555-123-9876 or email owner@example.test",
      contactGateState: "contractor_requested",
    };

    expect(getDirectConnectContactGateSummary(request)).toBe(
      "Contact stays gated for this request until the approved release step."
    );
    expect(getDirectConnectContactGateSummary(request)).not.toContain("555-123-9876");
    expect(getDirectConnectContactGateSummary(request)).not.toContain("owner@example.test");
    expect(getDirectConnectContactGateNextAction("provider_requested_contact")).toBe(
      "Review the provider contact request and approve or decline."
    );
    expect(getDirectConnectContactGateNextActor("provider_requested_contact")).toBe("requester");
    expect(getDirectConnectContactGateNextAction("mystery_state")).toBe(
      "Review the request state before taking contact action."
    );
    expect(getDirectConnectContactGateNextActor("mystery_state")).toBe("none");
  });
});
