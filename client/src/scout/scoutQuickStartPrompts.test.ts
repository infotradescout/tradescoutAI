import { describe, expect, it } from "vitest";
import {
  LIVE_READINESS_QUICK_START_PROMPT,
  SCOUT_QUICK_START_PROMPTS,
} from "./scoutQuickStartPrompts";

describe("SCOUT_QUICK_START_PROMPTS", () => {
  it("starts with the live-readiness next-step shortcut", () => {
    expect(SCOUT_QUICK_START_PROMPTS[0]).toBe(LIVE_READINESS_QUICK_START_PROMPT);
  });

  it("covers the expert jobs Scout is expected to perform", () => {
    expect(SCOUT_QUICK_START_PROMPTS).toEqual([
      "Continue my open work",
      "Plan my project",
      "Check codes and permits",
      "Build a realistic estimate",
      "Compare a quote",
      "Find the right professional",
    ]);
  });
});
