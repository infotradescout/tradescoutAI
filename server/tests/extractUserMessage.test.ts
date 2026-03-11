import { describe, expect, it } from "vitest";
import { extractUserMessage } from "../utils/extractUserMessage";

describe("extractUserMessage", () => {
  it("keeps safe message even when reasoning fields exist in object", () => {
    const result = extractUserMessage({
      intent: "community",
      thought_flow: ["internal step"],
      message: "Open Community and post your update.",
    });

    expect(result.message).toContain("Open Community");
    expect(result.hadLeakage).toBe(true);
  });

  it("recovers user-facing message from JSON string payloads", () => {
    const payload = JSON.stringify({
      message: "### **Open Direct Connect** now.",
      thought_flow: ["internal"],
    });

    const result = extractUserMessage(payload);
    expect(result.message).toContain("Open Direct Connect now.");
    expect(result.message).not.toContain("###");
    expect(result.message).not.toContain("**");
  });

  it("scrubs internal docs/source leakage", () => {
    const result = extractUserMessage(
      "SOURCE: [docs] BEHAVIORAL_CENTER.md\n\n1. Next: pick a button below."
    );

    expect(result.message).not.toContain("SOURCE:");
    expect(result.message).not.toContain("BEHAVIORAL_CENTER.md");
  });

  it("falls back when JSON string cannot be parsed", () => {
    const result = extractUserMessage("{not valid json");
    expect(result.message.toLowerCase()).toContain("clear next step");
    expect(result.hadLeakage).toBe(true);
  });
});
