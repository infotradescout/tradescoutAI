import {
  getDirectConnectContactGateNextAction,
  getDirectConnectContactGateNextActor,
  getDirectConnectContactGateSummary,
  getDirectConnectReleasedContactForPanel,
  getDisplayLatestStatus,
  getDisplayRequestDescription,
  getDisplayRequestTitle,
  buildDirectConnectRequestCardView,
  looksLikeHiddenOrTestRequest,
  normalizeDirectConnectContactState,
} from "./requestCardPresentation";

describe("requestCardPresentation", () => {
  const rawReleasedContact = {
    name: "Jane Provider",
    phone: "555-123-9876",
    email: "provider@example.test",
    address: "123 Provider Lane",
  };

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

  it("builds one safe request-card view for compact and full surfaces", () => {
    expect(
      buildDirectConnectRequestCardView({
        id: "request-1",
        title: "Roof repair",
        description: "Leak above the garage",
        status: "routed",
        countyLabel: "Escambia County, FL",
        budgetMin: "1000",
        budgetMax: 2500,
        updatedAt: "2026-07-13T12:00:00.000Z",
      })
    ).toMatchObject({
      id: "request-1",
      title: "Roof repair",
      description: "Leak above the garage",
      statusLabel: "Waiting on pros",
      countyLabel: "Escambia County, FL",
      budgetLabel: "$1,000–$2,500",
    });
  });

  it("keeps released contact out of the base request-card view", () => {
    const view = buildDirectConnectRequestCardView({
      id: "request-2",
      title: "Electrical work",
      contactGateState: "contact_released",
      releasedContact: rawReleasedContact,
    });
    expect(JSON.stringify(view)).not.toContain(rawReleasedContact.phone);
    expect(JSON.stringify(view)).not.toContain(rawReleasedContact.email);
    expect(JSON.stringify(view)).not.toContain(rawReleasedContact.address);
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
      "Your name and phone are shared with the exact assigned recipients when you send the request. Email and address stay private."
    );
    expect(getDirectConnectContactGateSummary(request)).not.toContain("555-123-9876");
    expect(getDirectConnectContactGateSummary(request)).not.toContain("owner@example.test");
    expect(getDirectConnectContactGateNextAction("provider_requested_contact")).toBe(
      "Review the provider contact request and approve or decline."
    );
    expect(getDirectConnectContactGateNextActor("provider_requested_contact")).toBe("requester");
    expect(getDirectConnectContactGateNextAction("mystery_state")).toBe(
      "Review the request status before taking the next step."
    );
    expect(getDirectConnectContactGateNextActor("mystery_state")).toBe("none");
  });

  it("only hands released contact to the panel for the exact contact_released state", () => {
    const request = {
      contactGateState: "contractor_requested",
      releasedContact: rawReleasedContact,
    };

    expect(getDirectConnectReleasedContactForPanel(request, "provider_requested_contact")).toBe(
      undefined
    );
    expect(getDirectConnectReleasedContactForPanel(request, "requester_approved")).toBe(undefined);
    expect(getDirectConnectReleasedContactForPanel(request, "contact_hidden")).toBe(undefined);
    expect(getDirectConnectReleasedContactForPanel(request, "mystery_state")).toBe(undefined);
    expect(getDirectConnectReleasedContactForPanel(request, "contact_released")).toEqual({
      name: "Jane Provider",
      phone: "555-123-9876",
      email: "provider@example.test",
      address: "123 Provider Lane",
      notes: undefined,
    });
  });

  it("does not treat a truthy contact payload as release authority", () => {
    const request = {
      contactGateState: "released",
      releasedContact: {
        phone: "555-123-9876",
        email: "provider@example.test",
      },
    };

    expect(getDirectConnectReleasedContactForPanel(request, "released")).toBe(undefined);
    expect(getDirectConnectReleasedContactForPanel(request, "contact_released")).toMatchObject({
      phone: "555-123-9876",
      email: "provider@example.test",
    });
  });

  it("covers the contact-gate regression matrix for fail-closed contact exposure", () => {
    const matrix: Array<{
      label: string;
      inputState?: string;
      expectedNormalized: string;
      shouldExposeReleasedContact: boolean;
    }> = [
      {
        label: "missing state",
        inputState: undefined,
        expectedNormalized: "contact_hidden",
        shouldExposeReleasedContact: false,
      },
      {
        label: "contact_hidden",
        inputState: "contact_hidden",
        expectedNormalized: "contact_hidden",
        shouldExposeReleasedContact: false,
      },
      {
        label: "provider_requested_contact",
        inputState: "provider_requested_contact",
        expectedNormalized: "provider_requested_contact",
        shouldExposeReleasedContact: false,
      },
      {
        label: "requester_approved",
        inputState: "requester_approved",
        expectedNormalized: "requester_approved",
        shouldExposeReleasedContact: false,
      },
      {
        label: "contact_released",
        inputState: "contact_released",
        expectedNormalized: "contact_released",
        shouldExposeReleasedContact: true,
      },
      {
        label: "unknown state",
        inputState: "unknown_contact_state",
        expectedNormalized: "unknown_contact_state",
        shouldExposeReleasedContact: false,
      },
    ];

    for (const row of matrix) {
      const normalized = normalizeDirectConnectContactState(row.inputState);
      expect(normalized, row.label).toBe(row.expectedNormalized);

      const payload = getDirectConnectReleasedContactForPanel(
        { contactGateState: row.inputState, releasedContact: rawReleasedContact },
        normalized
      );

      if (row.shouldExposeReleasedContact) {
        expect(payload, row.label).toMatchObject(rawReleasedContact);
      } else {
        expect(payload, row.label).toBeUndefined();
      }
    }
  });
});
