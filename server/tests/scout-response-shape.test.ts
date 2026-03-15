import { describe, expect, it } from "vitest";
import { ensureFollowUpQuestion } from "../scout/responseShape";

describe("ensureFollowUpQuestion", () => {
  it("adds follow-up question when none exists", () => {
    const result = ensureFollowUpQuestion("I found the best path for your request.");
    expect(result).toBe("I found the best path for your request. Want me to run that now?");
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
    expect(result).toBe(
      "I can still move this forward with a direct next step. Want me to run that now?"
    );
  });
});
