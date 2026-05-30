import { describe, expect, it } from "vitest";
import { FIRST_USE_STEP_OPTIONS } from "@/lib/firstUseGuidance";

describe("First useful step launcher options", () => {
  it("defines the required six plain-language options", () => {
    expect(FIRST_USE_STEP_OPTIONS.map((option) => option.label)).toEqual([
      "Fix or improve my home",
      "Keep track of my home",
      "Create a local work request",
      "Review local activity",
      "Continue something I started",
      "Just looking",
    ]);
  });

  it("maps each option to the expected route", () => {
    expect(FIRST_USE_STEP_OPTIONS.map((option) => option.href)).toEqual([
      "/direct-connect?intent=fix_improve&homeContext=prompt_link",
      "/homes",
      "/direct-connect",
      "/scout",
      "/scout?tab=continue",
      "/scout",
    ]);
  });
});
