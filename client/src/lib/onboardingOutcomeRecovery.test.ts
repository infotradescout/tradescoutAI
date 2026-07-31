import { describe, expect, it } from "vitest";
import { readPersistedOnboardingOutcomeRecovery } from "./onboardingOutcomeRecovery";

describe("persisted onboarding outcome recovery", () => {
  it("recovers an express handoff after the completion response is lost", () => {
    expect(
      readPersistedOnboardingOutcomeRecovery({
        onboardingCompleted: true,
        preferences: {
          onboardingOutcome: {
            kind: "express_result",
            goal: "Find a mobile mechanic",
            resultRoute: "/scout?source=onboarding_result",
          },
        },
      })
    ).toEqual({
      resultRoute: "/scout?source=onboarding_result",
      resultPrompt: "Find a mobile mechanic",
    });
  });

  it("rejects incomplete, malformed, and unsafe persisted outcomes", () => {
    expect(readPersistedOnboardingOutcomeRecovery({ onboardingCompleted: false })).toBeNull();
    expect(
      readPersistedOnboardingOutcomeRecovery({
        onboardingCompleted: true,
        preferences: {
          onboardingOutcome: {
            kind: "express_result",
            goal: "Find help",
            resultRoute: "//evil.example/path",
          },
        },
      })
    ).toBeNull();
  });
});
