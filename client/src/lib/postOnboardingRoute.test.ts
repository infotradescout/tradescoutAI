import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDING,
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
});
