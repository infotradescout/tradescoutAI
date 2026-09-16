// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DecisionContactGatePanel } from "@/components/ui/DecisionContactGatePanel";
import { projectDirectConnectRequesterContactState } from "@shared/directConnectRequesterContact";
import {
  buildWorkRequestPreviewTitle,
  buildWorkRequestScopeSummary,
  serializeDirectConnectCardContactGatePayload,
} from "../../../../server/utils/workRequestShare";
import {
  getDirectConnectContactGateNextAction,
  getDirectConnectContactGateNextActor,
  getDirectConnectContactGateSummary,
  getDirectConnectReleasedContactForPanel,
  getDisplayLatestStatus,
  normalizeDirectConnectContactState,
} from "./requestCardPresentation";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const privateContact = {
  name: "Private Example",
  phone: "+19855550100",
  email: "private@example.com",
  address: "123 Private Example Lane",
  notes: "Request-specific private note",
};
const obsoleteStates = [
  undefined,
  null,
  "",
  "locked",
  "review_required",
  "request_shared",
  "contact_hidden",
  "contractor_requested",
  "provider_requested_contact",
  "user_approved",
  "requester_approved",
  "submission_consented",
];

describe("requester contact projection from server payload to rendered card", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderProjectedCard(rawState: unknown, status = "routed") {
    const payload = serializeDirectConnectCardContactGatePayload({
      contactGateState: rawState,
      releasedContact: privateContact,
    });
    const request = { id: "request-1", status, ...payload };
    const state = normalizeDirectConnectContactState(request.contactGateState);
    act(() => root.render(
      <DecisionContactGatePanel
        viewerRole="requester"
        contactState={state}
        safeSummary={getDirectConnectContactGateSummary(request)}
        releasedContact={getDirectConnectReleasedContactForPanel(request, state)}
        nextActor={getDirectConnectContactGateNextActor(state)}
        nextRequiredAction={getDirectConnectContactGateNextAction(state)}
        actions={[{ label: "Approve contact" }, { label: "Release contact" }]}
      />
    ));
    return { payload, request, state };
  }

  it.each(obsoleteStates)("does not ask for a second approval for old state %s", (rawState) => {
    const { payload, state } = renderProjectedCard(rawState);
    expect(state).toBe("request_submission");
    expect(payload).not.toHaveProperty("releasedContact");
    expect(container.textContent).toContain("No additional contact approval is needed");
    expect(container.textContent).toContain("Not required");
    expect(container.textContent).not.toContain("Approve contact");
    expect(container.textContent).not.toContain("Release contact");
    expect(container.textContent).not.toContain("stays locked");
    expect(container.querySelector('[aria-label="Available actions"]')).toBeNull();
    for (const value of Object.values(privateContact)) {
      expect(container.textContent).not.toContain(value);
    }
  });

  it("does not permit stale caller action text to restore the removed approval step", () => {
    act(() => root.render(
      <DecisionContactGatePanel
        viewerRole="requester"
        contactState="request_submission"
        safeSummary="Sending your request authorizes request-related contact."
        nextActor="requester"
        nextRequiredAction="Approve contact again"
        releasedContact={privateContact}
        actions={[{ label: "Release contact" }]}
      />
    ));
    expect(container.textContent).toContain("Not required");
    expect(container.textContent).not.toContain("Approve contact again");
    expect(container.textContent).not.toContain("Release contact");
    expect(container.textContent).not.toContain(privateContact.phone);
  });

  it.each([
    ["draft", "This draft has not been sent"],
    ["cancelled", "Contact details already sent cannot be recalled"],
    ["completed", "This request is complete"],
  ])("explains %s without claiming a delivery or recalling a sent email", (status, expected) => {
    renderProjectedCard("locked", status);
    expect(container.textContent).toContain(expected);
    expect(container.textContent).not.toContain("Approve contact");
  });

  it.each([
    ["draft", "Draft ready"],
    ["routed", "Waiting on pros"],
    ["in_progress", "Provider responded"],
    ["cancelled", "Cancelled"],
    ["completed", "Completed"],
  ])("does not let old approval state obscure the %s job status", (status, expected) => {
    expect(getDisplayLatestStatus({ status, contactGateState: "contractor_requested" })).toBe(expected);
  });

  it.each(["denied", "closed", "blocked", "unknown_state", "unavailable"])(
    "preserves explicit or unknown restriction %s without exposing contact",
    (rawState) => {
      const { payload, state } = renderProjectedCard(rawState);
      expect(payload.contactGateState).toBe(rawState);
      expect(state).not.toBe("request_submission");
      expect(payload).not.toHaveProperty("releasedContact");
      for (const value of Object.values(privateContact)) expect(container.textContent).not.toContain(value);
    }
  );

  it.each([false, true, 1, [], {}, { toString: () => "released" }].map((rawState) => ({ rawState })))(
    "does not coerce malformed contact states into authority: $rawState",
    ({ rawState }) => {
      const { payload } = renderProjectedCard(rawState);
      expect(payload.contactGateState).toBe("unavailable");
      expect(payload).not.toHaveProperty("releasedContact");
      expect(container.textContent).not.toContain(privateContact.email);
    }
  );

  it.each(["released", "contact_released"])("preserves historical released contact for %s", (rawState) => {
    const { state } = renderProjectedCard(rawState);
    expect(state).toBe("contact_released");
    expect(container.textContent).toContain(privateContact.name);
    expect(container.textContent).toContain(privateContact.phone);
  });

  it("leaves public-share contact redaction independent of requester-card presentation", () => {
    const text = `Roof repair. Call ${privateContact.phone} or ${privateContact.email}.`;
    for (const publicText of [buildWorkRequestPreviewTitle(text), buildWorkRequestScopeSummary(text)]) {
      expect(publicText).not.toContain(privateContact.phone);
      expect(publicText).not.toContain(privateContact.email);
    }
    expect(projectDirectConnectRequesterContactState("request_shared")).toBe("request_submission");
    expect(serializeDirectConnectCardContactGatePayload({
      contactGateState: "request_shared", releasedContact: privateContact,
    })).not.toHaveProperty("releasedContact");
  });
});
