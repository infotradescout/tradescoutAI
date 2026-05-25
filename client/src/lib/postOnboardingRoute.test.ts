import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDING,
  resolveOnboardingState,
  resolveDirectConnectLandingRoute,
  resolvePostOnboardingRoute,
} from "./postOnboardingRoute";

describe("post-onboarding Direct Connect routing", () => {
  it("defaults regular users into Direct Connect with an entry marker", () => {
    expect(resolvePostOnboardingRoute({})).toBe("/direct-connect?entry=onboarding");
    expect(DEFAULT_LANDING).toBe("/direct-connect?entry=default");
  });

  it("preserves explicit safe deep links", () => {
    expect(resolvePostOnboardingRoute({ nextParam: "/community-feed" })).toBe("/community-feed");
  });

  it("uses Direct Connect state when activity signals are known", () => {
    expect(resolveDirectConnectLandingRoute({ entry: "auth", hasReplies: true })).toBe(
      "/direct-connect/inbox?entry=auth"
    );
    expect(resolveDirectConnectLandingRoute({ entry: "setup", hasOpenRequests: true })).toBe(
      "/direct-connect/engagements?entry=setup"
    );
  });

  it("keeps Direct Connect intent choices inside local requests flow", () => {
    expect(resolvePostOnboardingRoute({ chosenIntent: "tools" })).toBe(
      "/direct-connect?entry=onboarding"
    );
  });

  it("uses one canonical onboarding state decision", () => {
    expect(resolveOnboardingState(null)).toBe("needs_profile");
    expect(
      resolveOnboardingState({
        firstName: "A",
        lastName: "B",
        phone: "(555) 111-2222",
        stateCode: "AL",
        countyFips: "01097",
        locationCommitted: true,
        onboardingCompleted: false,
        profileVersion: 0,
      })
    ).toBe("needs_intent");
    expect(
      resolveOnboardingState({
        firstName: "A",
        lastName: "B",
        phone: "(555) 111-2222",
        stateCode: "AL",
        countyFips: "01097",
        locationCommitted: true,
        onboardingCompleted: false,
        profileVersion: 0,
        preferences: { onboarding: { state: { lane: "find_help" } } },
      })
    ).toBe("complete");
    expect(resolveOnboardingState({ onboardingCompleted: true, profileVersion: 0 })).toBe(
      "complete"
    );
  });

  it("keeps business users in profile state until business basics exist", () => {
    expect(
      resolveOnboardingState({
        firstName: "Casey",
        lastName: "Lee",
        phone: "(555) 222-3333",
        stateCode: "LA",
        countyFips: "22105",
        locationCommitted: true,
        onboardingCompleted: false,
        profileVersion: 0,
        preferences: {
          provisional: { profileDraft: { presenceType: "represent_business" } },
          onboarding: { state: { lane: "business" } },
        },
      })
    ).toBe("needs_profile");

    expect(
      resolveOnboardingState({
        firstName: "Casey",
        lastName: "Lee",
        phone: "(555) 222-3333",
        stateCode: "LA",
        countyFips: "22105",
        locationCommitted: true,
        onboardingCompleted: false,
        profileVersion: 0,
        businessName: "Modern Wood LLC",
        businessType: "painting",
        preferences: {
          provisional: { profileDraft: { presenceType: "represent_business" } },
          onboarding: { state: { lane: "business" } },
        },
      })
    ).toBe("complete");
  });

  it("requires local area before intent state", () => {
    expect(
      resolveOnboardingState({
        firstName: "Taylor",
        lastName: "Reed",
        phone: "(555) 777-8888",
        stateCode: "LA",
        countyFips: "22105",
        locationCommitted: false,
        onboardingCompleted: false,
        profileVersion: 0,
      })
    ).toBe("needs_profile");
  });
});
