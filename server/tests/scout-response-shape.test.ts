import { describe, expect, it } from "vitest";
import { ensureFollowUpQuestion } from "../scout/responseShape";

describe("ensureFollowUpQuestion", () => {
  it("keeps statement responses when no question exists", () => {
    const result = ensureFollowUpQuestion("I found the best path for your request.");
    expect(result).toBe("I found the best path for your request.");
  });

  it("preserves existing questions without duplication", () => {
    const result = ensureFollowUpQuestion(
      "I found the best path. Want me to open Direct Connect now?"
    );
    const questionCount = (result.match(/\?/g) || []).length;
    expect(questionCount).toBe(1);
    expect(result).toContain("Want me to open Direct Connect now?");
  });

  it("returns fallback question for empty input", () => {
    const result = ensureFollowUpQuestion("   ");
    expect(result).toBe("I found the next step and prepared it for you.");
  });

  it("never injects permission language", () => {
    const result = ensureFollowUpQuestion("I can map this immediately.");
    expect(result.toLowerCase()).not.toContain("want me to");
    expect(result.toLowerCase()).not.toContain("should i");
  });
});
