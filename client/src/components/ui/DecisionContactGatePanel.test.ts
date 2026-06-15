import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  DECISION_CONTACT_GATE_STATES,
  DecisionContactGatePanel,
  type DecisionContactGatePanelProps,
} from "./DecisionContactGatePanel";

const rawContact = {
  name: "Taylor Requester",
  email: "owner@example.test",
  phone: "555-123-4567",
  address: "123 Private Lane",
  notes: "Call after 6",
};

const rawContactTokens = [
  rawContact.name,
  rawContact.email,
  rawContact.phone,
  rawContact.address,
  rawContact.notes,
];

function renderPanel(props: Partial<DecisionContactGatePanelProps> = {}): string {
  return renderToStaticMarkup(
    React.createElement(DecisionContactGatePanel, {
      contactState: "contact_hidden",
      viewerRole: "provider",
      nextActor: "requester",
      safeSummary: "Safe request summary. Contact remains gated.",
      releasedContact: rawContact,
      ...props,
    })
  );
}

function expectNoRawContact(html: string) {
  for (const token of rawContactTokens) {
    expect(html).not.toContain(token);
  }
}

describe("DecisionContactGatePanel", () => {
  it("preserves the exact P2 contact state names", () => {
    expect(DECISION_CONTACT_GATE_STATES).toEqual([
      "contact_hidden",
      "provider_requested_contact",
      "requester_approved",
      "contact_released",
      "denied",
      "closed",
    ]);

    for (const state of DECISION_CONTACT_GATE_STATES) {
      const html = renderPanel({ contactState: state });
      expect(html).toContain(`data-contact-state="${state}"`);
    }
  });

  it("does not render phone, email, address, name, or notes while contact is hidden", () => {
    const html = renderPanel({ contactState: "contact_hidden" });

    expect(html).toContain("Review only");
    expect(html).toContain("Private requester contact stays hidden until contact opens.");
    expectNoRawContact(html);
  });

  it("does not render contact payload when a provider has requested contact", () => {
    const html = renderPanel({
      contactState: "provider_requested_contact",
      viewerRole: "requester",
      nextActor: "requester",
    });

    expect(html).toContain("Contact request waiting");
    expect(html).toContain("The requester must approve or deny the contact request.");
    expectNoRawContact(html);
  });

  it("does not render contact payload after requester approval until release occurs", () => {
    const html = renderPanel({
      contactState: "requester_approved",
      viewerRole: "staff",
      nextActor: "staff",
    });

    expect(html).toContain("Approval recorded");
    expect(html).toContain("Approval is recorded, but private contact stays locked until release.");
    expectNoRawContact(html);
  });

  it("renders released contact payload only in contact_released state", () => {
    const html = renderPanel({
      contactState: "contact_released",
      viewerRole: "provider",
      nextActor: "none",
    });

    expect(html).toContain("Contact open");
    expect(html).toContain("Contact details");
    for (const token of rawContactTokens) {
      expect(html).toContain(token);
    }
  });

  it("does not render contact payload for denied and closed states", () => {
    for (const state of ["denied", "closed"] as const) {
      const html = renderPanel({ contactState: state, viewerRole: "admin", nextActor: "none" });

      expect(html).toContain(state === "denied" ? "Contact declined" : "Closed");
      expectNoRawContact(html);
    }
  });

  it("renders readable state, visibility, next action, and next actor copy for every required state", () => {
    for (const state of DECISION_CONTACT_GATE_STATES) {
      const html = renderPanel({
        contactState: state,
        nextRequiredAction: `Next action for ${state}`,
        nextActor: "platform",
      });

      expect(html).toContain("Contact status");
      expect(html).toContain("Available now");
      expect(html).toContain("What happens next");
      expect(html).toContain("Waiting on");
      expect(html).toContain(`Next action for ${state}`);
      expect(html).toContain("TradeScout");
    }
  });

  it("fails closed for an unknown state and does not render contact payload", () => {
    const html = renderPanel({
      contactState: "unexpected_contact_state",
      viewerRole: "staff",
      nextActor: "staff",
    });

    expect(html).toContain('data-contact-state="unexpected_contact_state"');
    expect(html).toContain("Contact unavailable");
    expect(html).toContain("Contact status is unavailable. Private contact details stay locked.");
    expectNoRawContact(html);
  });
});
