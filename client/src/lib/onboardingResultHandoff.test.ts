// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ONBOARDING_RESULT_PROMPT_KEY,
  consumeOnboardingResultPrompt,
  storeOnboardingResultPrompt,
} from "./onboardingResultHandoff";

describe("private onboarding result handoff", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("keeps the confirmed goal in session storage and consumes it once", () => {
    storeOnboardingResultPrompt("  Find a mobile mechanic today  ", "user:A");

    expect(JSON.parse(window.sessionStorage.getItem(ONBOARDING_RESULT_PROMPT_KEY) || "null")).toEqual({
      owner: "user:A",
      prompt: "Find a mobile mechanic today",
    });
    expect(consumeOnboardingResultPrompt("user:A")).toBe("Find a mobile mechanic today");
    expect(consumeOnboardingResultPrompt("user:A")).toBe("");
  });

  it("does not persist an empty prompt", () => {
    storeOnboardingResultPrompt("   ", "user:A");
    expect(window.sessionStorage.getItem(ONBOARDING_RESULT_PROMPT_KEY)).toBeNull();
  });

  it("hands the prompt across the SPA when session storage is denied", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    storeOnboardingResultPrompt("Find a mobile mechanic today", "user:A");
    expect(consumeOnboardingResultPrompt("user:A")).toBe("Find a mobile mechanic today");
    expect(consumeOnboardingResultPrompt("user:A")).toBe("");

    setItem.mockRestore();
    getItem.mockRestore();
    removeItem.mockRestore();
  });

  it("does not release A's confirmed result to B or accept an unmarked legacy prompt", () => {
    storeOnboardingResultPrompt("A's private outcome", "user:A");
    expect(consumeOnboardingResultPrompt("user:B")).toBe("");
    expect(window.sessionStorage.getItem(ONBOARDING_RESULT_PROMPT_KEY)).toBeNull();

    window.sessionStorage.setItem(ONBOARDING_RESULT_PROMPT_KEY, "Legacy private outcome");
    expect(consumeOnboardingResultPrompt("user:B")).toBe("");
    expect(window.sessionStorage.getItem(ONBOARDING_RESULT_PROMPT_KEY)).toBeNull();
  });
});
