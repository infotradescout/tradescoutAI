import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
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

const rawContact = {
  name: "Example Requester",
  phone: "985-555-0100",
  email: "requester@example.test",
  address: "123 Private Lane",
};
const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), "utf8");
const oldApprovalStates = [
  undefined, "", "locked", "review_required", "request_shared", "contact_hidden",
  "contractor_requested", "provider_requested_contact", "user_approved", "requester_approved",
  "submission_consented", "request_submission",
];

// Execute the actual shipped shell's three action predicates, not a duplicate
// implementation. The sandbox contains only one synthetic requester-card row.
function shellContactActions(request: Record<string, unknown>) {
  const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
  const marker = 'const contactGateState = String(r.contactGateState || "locked");';
  const start = source.indexOf(marker);
  const end = source.indexOf("const contactPanelState =", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const result = runInNewContext(
    source.slice(start, end) +
      "JSON.stringify({canApproveContact, canDenyContact, canReleaseContact});",
    { r: Object.freeze({ ...request }) },
    { timeout: 1000 }
  );
  return JSON.parse(result as string);
}

function requesterPanel(contactGateState: string | undefined, status = "routed") {
  const serialized = serializeDirectConnectCardContactGatePayload({
    contactGateState,
    releasedContact: rawContact,
  });
  const request = { id: "request-1", status, ...serialized };
  const state = normalizeDirectConnectContactState(request.contactGateState);
  const html = renderToStaticMarkup(createElement(DecisionContactGatePanel, {
    contactState: state,
    viewerRole: "requester",
    nextActor: getDirectConnectContactGateNextActor(state),
    nextRequiredAction: getDirectConnectContactGateNextAction(state),
    safeSummary: getDirectConnectContactGateSummary(request),
    releasedContact: getDirectConnectReleasedContactForPanel(request, state),
    actions: [],
  }));
  return { request, serialized, html };
}

describe("requester submission-contact integration", () => {
  it.each(oldApprovalStates)("removes second approval from the actual shell predicates for %s", (state) => {
    const { request, serialized, html } = requesterPanel(state);
    expect(serialized).toEqual({ contactGateState: "request_submission" });
    expect(shellContactActions(request)).toEqual({
      canApproveContact: false,
      canDenyContact: false,
      canReleaseContact: false,
    });
    expect(html).toContain("No additional contact approval is needed");
    expect(html).toContain("Not required");
    expect(html).not.toMatch(/Approve contact|Release contact|Contact request waiting|until contact opens/);
    for (const value of Object.values(rawContact)) expect(html).not.toContain(value);
  });

  it.each(["denied", "closed", "blocked", "unexpected_state"])(
    "retains explicit restrictions or unknown state %s without adding a contact payload", (state) => {
      const { serialized, html } = requesterPanel(state);
      expect(serialized.contactGateState).toBe(state);
      expect(serialized).not.toHaveProperty("releasedContact");
      for (const value of Object.values(rawContact)) expect(html).not.toContain(value);
    }
  );

  it.each(["released", "contact_released"])("preserves already-released historical contact in %s", (state) => {
    const { serialized, html } = requesterPanel(state);
    expect(serialized.releasedContact).toMatchObject(rawContact);
    for (const value of Object.values(rawContact)) expect(html).toContain(value);
  });

  it("does not say an unsent draft was sent or a paused request can recall delivered details", () => {
    expect(requesterPanel("locked", "draft").html).toContain("This draft has not been sent");
    expect(requesterPanel("contractor_requested", "cancelled").html).toContain("already sent cannot be recalled");
    expect(requesterPanel("user_approved", "completed").html).toContain("This request is complete");
    expect(getDisplayLatestStatus({ status: "cancelled", contactGateState: "contractor_requested" })).toBe("Cancelled");
    expect(getDisplayLatestStatus({ status: "completed", contactGateState: "contractor_requested" })).toBe("Completed");
  });

  it("normalizes display state idempotently and rejects non-string state values", () => {
    for (const state of [...oldApprovalStates, "denied", "closed", "released", "unknown_state"]) {
      const once = projectDirectConnectRequesterContactState(state);
      expect(projectDirectConnectRequesterContactState(once)).toBe(once);
    }
    for (const state of [true, 1, [], {}, { released: true }]) {
      expect(projectDirectConnectRequesterContactState(state)).toBe("unavailable");
      expect(serializeDirectConnectCardContactGatePayload({ contactGateState: state, releasedContact: rawContact }))
        .toEqual({ contactGateState: "unavailable" });
    }
  });

  it("keeps the projection read-only and public previews redacted", () => {
    const input = Object.freeze({ contactGateState: "contractor_requested", releasedContact: Object.freeze({ ...rawContact }) });
    serializeDirectConnectCardContactGatePayload(input);
    expect(input.contactGateState).toBe("contractor_requested");
    expect(input.releasedContact).toEqual(rawContact);
    for (const render of [buildWorkRequestPreviewTitle, buildWorkRequestScopeSummary]) {
      const result = render("Roof repair at 123 Private Lane. Call 985-555-0100 or requester@example.test.");
      expect(result).toContain("Roof repair");
      expect(result).not.toContain(rawContact.phone);
      expect(result).not.toContain(rawContact.email);
      expect(result).not.toContain(rawContact.address);
    }
  });

  it("uses the existing requester serializer and preserves actual request-management actions", () => {
    const server = read("server/routes/direct-connect.ts");
    const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(server).toContain("serializeDirectConnectCardContactGatePayload({");
    expect(server).toContain("contactGateState: contactGatePayload.contactGateState");
    expect(shell).toContain("normalizeDirectConnectContactState(r.contactGateState)");
    for (const action of ["Cancel request", "Reopen request", "Send to more pros", "Mark complete", "Open conversation", "Share request"]) {
      expect(shell).toContain(action);
    }
    const projection = read("shared/directConnectRequesterContact.ts");
    expect(projection).not.toMatch(/\bfetch\(|\bdb\.|contactPermissions|contactPermissionEvents/);
  });
});
