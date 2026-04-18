import { describe, expect, it } from "vitest";
import { evaluateFeatureUnlocks, getUnlockedAdvancedHrefs } from "./progressiveFeatureUnlocks";

describe("evaluateFeatureUnlocks", () => {
  it("keeps advanced features locked for first-time user with no activity", () => {
    const snapshot = evaluateFeatureUnlocks({
      user: {
        onboardingCompleted: false,
        profileVersion: 0,
      },
      recentActivity: [],
    });

    const unlockedHrefs = getUnlockedAdvancedHrefs(snapshot);
    expect(unlockedHrefs.size).toBe(0);
    expect(snapshot.unlocked.trade_deals).toBe(false);
    expect(snapshot.unlocked.exchange).toBe(false);
    expect(snapshot.unlocked.foundation).toBe(false);
  });

  it("unlocks trade deals and exchange from scout/action activity", () => {
    const snapshot = evaluateFeatureUnlocks({
      user: {
        onboardingCompleted: false,
        profileVersion: 0,
      },
      recentActivity: [
        { type: "ask_scout", ts: "2026-04-17T00:00:00.000Z" },
        { type: "decision_card_choice", ts: "2026-04-17T00:01:00.000Z" },
      ],
    });

    expect(snapshot.unlocked.trade_deals).toBe(true);
    expect(snapshot.unlocked.exchange).toBe(true);
    expect(snapshot.unlocked.share).toBe(true);
  });

  it("unlocks home, maps, leaderboard, and foundation as readiness increases", () => {
    const snapshot = evaluateFeatureUnlocks({
      user: {
        onboardingCompleted: true,
        profileVersion: 999,
        emailVerified: true,
      },
      recentActivity: [
        { type: "ask_scout", ts: "2026-04-17T00:00:00.000Z" },
        { type: "decision_card_choice", ts: "2026-04-17T00:01:00.000Z" },
        { type: "onboarding_answer", ts: "2026-04-17T00:02:00.000Z" },
        { type: "community.county_default", ts: "2026-04-17T00:03:00.000Z" },
        { type: "dc.county_default_applied", ts: "2026-04-17T00:04:00.000Z" },
        { type: "ask_scout", ts: "2026-04-17T00:05:00.000Z" },
      ],
    });

    expect(snapshot.unlocked.home_scout_listings).toBe(true);
    expect(snapshot.unlocked.maps).toBe(true);
    expect(snapshot.unlocked.leaderboard).toBe(true);
    expect(snapshot.unlocked.foundation).toBe(true);
  });
});
