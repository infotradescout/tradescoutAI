import { describe, expect, it } from "vitest";
import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";

describe("public discovery text safety", () => {
  it("removes direct contact, exact addresses, and bare domains from indexed text", () => {
    const safe = sanitizePublicDiscoveryText(
      "Call 423-555-0188, email owner@example.com, visit vendor.example or 123 Main Street.",
      500
    );

    expect(safe).toContain("Continue through TradeScout");
    expect(safe).not.toMatch(/423-555-0188|owner@example|vendor\.example|123 Main Street/);
  });
});
