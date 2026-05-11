import { describe, expect, it } from "vitest";
import { sanitizeScoutUserFacingText } from "../scout/userFacingSanitizer";

describe("sanitizeScoutUserFacingText", () => {
  it("strips markdown decorators and keeps readable content", () => {
    const raw = "### **Direct Connect**\nUse [this path](/direct-connect) to start.";
    const result = sanitizeScoutUserFacingText(raw);

    expect(result.text).toContain("Direct Connect");
    expect(result.text).toContain("Use this path to start.");
    expect(result.text).not.toContain("###");
    expect(result.text).not.toContain("**");
    expect(result.text).not.toContain("[");
  });

  it("removes internal source and docs leakage lines", () => {
    const raw = [
      "SOURCE: [docs] BEHAVIORAL_CENTER.md",
      "For 90%+ of users, Scout is the fake homepage.",
      "Keep this in user-facing copy.",
    ].join("\n");

    const result = sanitizeScoutUserFacingText(raw);

    expect(result.text).toContain("Keep this in user-facing copy.");
    expect(result.text).not.toContain("SOURCE:");
    expect(result.text).not.toContain("BEHAVIORAL_CENTER.md");
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it("returns fallback when scrub removes everything", () => {
    const result = sanitizeScoutUserFacingText("SOURCE: [docs] BEHAVIORAL_CENTER.md", {
      fallback: "fallback text",
    });

    expect(result.text).toBe("fallback text");
    expect(result.flags).toContain("empty_replaced_after_scrub");
  });

  it("clamps to maxChars", () => {
    const result = sanitizeScoutUserFacingText("word ".repeat(120), { maxChars: 90 });
    expect(result.text.length).toBeLessThanOrEqual(90);
    expect(result.text.endsWith("...")).toBe(true);
  });

  it("keeps clean text unchanged", () => {
    const raw = "Here is the clearest next step for your county today.";
    const result = sanitizeScoutUserFacingText(raw);
    expect(result.text).toBe(raw);
    expect(result.flags).toEqual([]);
  });

  it("rewrites internal routing and workspace words", () => {
    const result = sanitizeScoutUserFacingText(
      "Scout can route the strongest next step without bypassing trust gates. Open the Finances workspace."
    );

    expect(result.text.toLowerCase()).not.toContain("route");
    expect(result.text.toLowerCase()).not.toContain("workspace");
    expect(result.text.toLowerCase()).not.toContain("trust gates");
    expect(result.text).toContain("open the best next step");
    expect(result.flags).toContain("system_word_rewritten");
  });

  it("turns two-path prompts into next-step copy", () => {
    const result = sanitizeScoutUserFacingText(
      "Scout can route it correctly. Do you want to start with DIY-vs-hire-out guidance or contractor matching?"
    );

    expect(result.text.toLowerCase()).not.toContain("route");
    expect(result.text.toLowerCase()).not.toContain("do you want");
    expect(result.text).toContain("project planning and finding local help");
    expect(result.flags).toContain("choice_question_rewritten");
  });

  it("replaces internal spec dumps with fallback", () => {
    const raw =
      "Shifts overhead: users feel ownership pressure. Safe Path (recommended by this analysis): Auto-persist. Trigger Examples: roof repair. Phase 1: Implementation trust signals.";
    const result = sanitizeScoutUserFacingText(raw, {
      fallback: "fallback text",
    });

    expect(result.text).toBe("fallback text");
    expect(result.flags).toContain("internal_spec_dump_replaced");
  });
});
