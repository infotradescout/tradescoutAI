import { describe, expect, it } from "vitest";
import {
  sanitizePublicDiscoveryText,
  sanitizePublicProfileText,
} from "@shared/publicListingSafety";

describe("public discovery text safety", () => {
  it("removes direct contact, exact addresses, and bare domains from indexed text", () => {
    const safe = sanitizePublicDiscoveryText(
      "Call 423-555-0188, email owner@example.com, visit vendor.example or 123 Main Street.",
      500
    );

    expect(safe).toContain("Continue through TradeScout");
    expect(safe).not.toMatch(/423-555-0188|owner@example|vendor\.example|123 Main Street/);
  });

  it("removes persisted profile narration without adding replacement copy", () => {
    expect(
      sanitizePublicProfileText(
        "See residential work from Example Plumbing, then make a private request through TradeScout Direct Connect."
      )
    ).toBe("See residential work from Example Plumbing.");
    expect(
      sanitizePublicProfileText("Your contact details stay private until you choose to connect.")
    ).toBe("");
  });
});
