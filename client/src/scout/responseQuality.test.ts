import { describe, expect, it } from "vitest";
import { enforceResponseQualityContract } from "./responseQuality";

describe("enforceResponseQualityContract", () => {
  it("removes generic filler and preserves a direct answer", () => {
    const result = enforceResponseQualityContract({
      userMessage: "What can I do now?",
      content:
        "I can help with that. Here's what TradeScout can do for your community. Open Direct Connect now.",
      hasActionOptions: true,
    });

    expect(result.toLowerCase()).not.toContain("i can help with that");
    expect(result.toLowerCase()).not.toContain("here's what tradescout can do for your community");
    expect(result).toContain("Open Direct Connect now");
  });

  it("adds explicit next step when actions exist but text is not actionable", () => {
    const result = enforceResponseQualityContract({
      userMessage: "Need a roofer",
      content: "I found strong options in your area.",
      hasActionOptions: true,
    });

    expect(result).toContain("Next:");
  });

  it("forces non-dead-end fallback when banned dead-end language appears", () => {
    const result = enforceResponseQualityContract({
      userMessage: "help",
      content: "I can't help with that right now.",
      hasActionOptions: false,
    });

    expect(result.toLowerCase()).not.toContain("can't help");
    expect(result).toContain("best available path");
  });
});
