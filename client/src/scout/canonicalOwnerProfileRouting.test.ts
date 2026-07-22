import { describe, expect, it } from "vitest";
import { routeFromClaims } from "./claimTypes";
import { resolvePostOnboardingActions } from "./resolvePostOnboardingActions";

describe("canonical owner and profile routing", () => {
  it("sends business representation to claims-first setup, never the sell-business form", () => {
    expect(routeFromClaims(["represent_business"])).toEqual({
      path: "/claim-my-business?source=scout_claims_represent_business",
      reason: "represent_business",
    });
    expect(routeFromClaims(["represent_business", "offer_services"])).toEqual({
      path: "/claim-my-business?source=scout_claims_business_services",
      reason: "business_plus_services",
    });
  });

  it("sends deal posting to the Exchange item flow", () => {
    expect(routeFromClaims(["posts_deals"])).toEqual({
      path: "/exchange/list",
      reason: "posts_deals",
    });
  });

  it("uses the canonical public profile for owner view and edit actions", () => {
    const actions = resolvePostOnboardingActions(["offer_services", "represent_business"], {
      slug: "JW Stone / Logistics",
    });

    expect(actions).toContainEqual({
      id: "view_page",
      label: "View your public profile",
      destination: "/u/JW%20Stone%20%2F%20Logistics",
    });
    expect(actions.some((action) => action.destination.startsWith("/business/"))).toBe(false);
  });

  it("never creates a fake profile slug when no canonical profile exists", () => {
    const actions = resolvePostOnboardingActions(["represent_business"], { slug: null });

    expect(actions).toContainEqual({
      id: "manage_profile",
      label: "Claim or create your business",
      destination: "/claim-my-business?source=scout_post_onboarding",
      primary: true,
    });
    expect(
      actions.some(
        (action) =>
          action.destination === "/business/my-business" || action.destination === "/u/my-business"
      )
    ).toBe(false);
  });
});
