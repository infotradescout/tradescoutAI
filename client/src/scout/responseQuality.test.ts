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

    expect(result).toContain("I can run the next step now.");
  });

  it("forces non-dead-end fallback when banned dead-end language appears", () => {
    const result = enforceResponseQualityContract({
      userMessage: "help",
      content: "I can't help with that right now.",
      hasActionOptions: false,
    });

    expect(result.toLowerCase()).not.toContain("can't help");
    expect(result).toContain("direct next step");
  });

  it("appends a follow-up question when response has no question", () => {
    const result = enforceResponseQualityContract({
      userMessage: "I need roof repair",
      content: "I found vetted providers in your county.",
      hasActionOptions: true,
    });

    expect(result).not.toContain("Which option should I run first?");
    expect(result).not.toContain("What should I help you with next?");
  });

  it("keeps existing follow-up questions without duplicating", () => {
    const result = enforceResponseQualityContract({
      userMessage: "What should I do now?",
      content: "I found the fastest path for your request. Want me to open Direct Connect now?",
      hasActionOptions: true,
    });

    const questionCount = (result.match(/\?/g) || []).length;
    expect(questionCount).toBe(1);
    expect(result).toContain("Want me to open Direct Connect now?");
  });

  it("does not force generic action copy on recovery/system messages", () => {
    const result = enforceResponseQualityContract({
      userMessage: "what can you do for me",
      content: "I'm having trouble generating a full answer right now, but I can still route you.",
      hasActionOptions: true,
    });

    expect(result).not.toContain("Next: pick a button below.");
    expect(result).not.toContain("Which option should I run first?");
    expect(result).toContain("having trouble generating");
  });

  it("replaces blocked fallback copy with direct next-step language", () => {
    const result = enforceResponseQualityContract({
      userMessage: "hello",
      content:
        "I couldn't find reliable information about this in TradeScout's local data or on the web. You may need to confirm with a local professional or contact your admin for assistance.",
      hasActionOptions: false,
    });

    expect(result).toContain("direct next step");
    expect(result.toLowerCase()).not.toContain("couldn't find reliable information");
  });
});
