import { describe, expect, it } from "vitest";
import {
  LIVE_READINESS_QUICK_START_PROMPT,
  SCOUT_QUICK_START_PROMPTS,
} from "./scoutQuickStartPrompts";

describe("SCOUT_QUICK_START_PROMPTS", () => {
  it("starts with the live-readiness next-step shortcut", () => {
    expect(SCOUT_QUICK_START_PROMPTS[0]).toBe(LIVE_READINESS_QUICK_START_PROMPT);
  });

  it("keeps the shortcut as a question Scout can route through readiness", () => {
    expect(SCOUT_QUICK_START_PROMPTS[0].toLowerCase()).toContain("next step");
  });
});
