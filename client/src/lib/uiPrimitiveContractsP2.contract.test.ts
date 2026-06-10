import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("UI primitive contracts P2", () => {
  const contract = read("docs/audits/UI_PRIMITIVE_CONTRACTS_P2.md");

  it("defines the four critical primitive contracts before visual migration", () => {
    for (const primitive of [
      "DecisionContactGatePanel",
      "LawAwareCtaBlock",
      "RequestCard",
      "FormStepShell",
    ]) {
      expect(contract).toContain(primitive);
    }

    expect(contract).toContain("This document authorizes no visual components");
    expect(contract).toContain("No functional UI code changed");
  });

  it("pins contact gate states and no-leak invariants", () => {
    for (const state of [
      "contact_hidden",
      "provider_requested_contact",
      "requester_approved",
      "contact_released",
      "denied",
      "closed",
    ]) {
      expect(contract).toContain(state);
    }

    expect(contract).toContain("Must never reveal raw requester contact before approval");
    expect(contract).toContain("Must display current contact state");
    expect(contract).toContain("Must show who must act next");
    expect(contract).toContain("Provider-facing no-contact-leak test before release");
  });

  it("pins CTA, request card, and form shell law-sensitive guardrails", () => {
    expect(contract).toContain("Must support one primary CTA per viewport/context");
    expect(contract).toContain("Must not imply visibility grants contact");
    expect(contract).toContain("No pay-to-play language");
    expect(contract).toContain("No lead-selling framing");

    expect(contract).toContain(
      "Must show request status, county context, trade/category, trust/routing state, and next action"
    );
    expect(contract).toContain("Must support provider/staff/requester variants");
    expect(contract).toContain("Must preserve role-specific operational controls");

    expect(contract).toContain("Must support progressive sections without deleting fields");
    expect(contract).toContain("Must keep required request fields before optional HomeID");
    expect(contract).toContain("Must make HomeID optional/secondary");
    expect(contract).toContain("Must preserve anonymous draft behavior");
    expect(contract).toContain("Must support auth-gated submit state");
  });
});
