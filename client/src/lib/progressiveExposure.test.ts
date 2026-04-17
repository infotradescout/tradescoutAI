import { describe, expect, it } from "vitest";
import { evaluateProgressiveExposure } from "./progressiveExposure";

const baseNow = new Date("2026-04-17T12:00:00.000Z");

describe("evaluateProgressiveExposure", () => {
  it("keeps users in tier 0 when setup is incomplete", () => {
    const snapshot = evaluateProgressiveExposure({
      user: {
        onboardingCompleted: false,
        profileVersion: 0,
        createdAt: "2026-04-01T12:00:00.000Z",
      },
      recentActivity: [],
      now: baseNow,
    });

    expect(snapshot.tier).toBe(0);
    expect(snapshot.reasons).toContain("setup_incomplete");
  });

  it("moves to tier 2 for setup-complete users with sufficient activity and tenure", () => {
    const snapshot = evaluateProgressiveExposure({
      user: {
        onboardingCompleted: true,
        profileVersion: 999,
        createdAt: "2026-04-01T12:00:00.000Z",
        emailVerified: false,
      },
      recentActivity: [
        { type: "ask_scout", ts: "2026-04-16T01:00:00.000Z" },
        { type: "decision_card_choice", ts: "2026-04-16T02:00:00.000Z" },
        { type: "onboarding_answer", ts: "2026-04-16T03:00:00.000Z" },
      ],
      now: baseNow,
    });

    expect(snapshot.tier).toBe(2);
    expect(snapshot.reasons).toContain("setup_complete");
    expect(snapshot.reasons).toContain("activity_and_tenure_ready");
  });

  it("moves to tier 3 only when advanced readiness and verification are met", () => {
    const snapshot = evaluateProgressiveExposure({
      user: {
        onboardingCompleted: true,
        profileVersion: 999,
        createdAt: "2026-03-01T12:00:00.000Z",
        emailVerified: true,
      },
      recentActivity: [
        { type: "ask_scout", ts: "2026-04-16T01:00:00.000Z" },
        { type: "decision_card_choice", ts: "2026-04-16T02:00:00.000Z" },
        { type: "onboarding_answer", ts: "2026-04-16T03:00:00.000Z" },
        { type: "ask_scout", ts: "2026-04-16T04:00:00.000Z" },
        { type: "decision_card_choice", ts: "2026-04-16T05:00:00.000Z" },
        { type: "onboarding_answer", ts: "2026-04-16T06:00:00.000Z" },
        { type: "community.county_default", ts: "2026-04-16T07:00:00.000Z" },
        { type: "dc.county_default_applied", ts: "2026-04-16T08:00:00.000Z" },
      ],
      now: baseNow,
    });

    expect(snapshot.tier).toBe(3);
    expect(snapshot.reasons).toContain("verified_advanced_ready");
  });
});
