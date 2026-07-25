import { describe, expect, it } from "vitest";
import {
  GUEST_COMMUNITY_EXPLORE_ROUTE,
  runScoutDecisionPipeline,
} from "../scout/scoutDecisionPipeline";
import { buildAuthRequiredScoutResponse } from "../scout/scoutAuthRequiredResponse";
import type { NormalizedScoutRequest } from "../../shared/types/scout";

function request(message: string, isAuthenticated = false): NormalizedScoutRequest {
  return {
    message,
    isAuthenticated,
    history: [],
  };
}

describe("auth-required Scout intent contract", () => {
  it.each([
    "I want to offer services here",
    "Help me run a promotion",
    "Post to community for me",
    "Open my dashboard",
    "Publish this listing",
  ])("blocks protected guest intent before synthesis: %s", (message) => {
    const decision = runScoutDecisionPipeline(request(message));

    expect(decision).toMatchObject({
      type: "blocked",
      reason: "auth_required",
      requiresAuth: true,
    });
    expect(decision.metadata?.redirect).toBe("/pre-scout-setup?mode=create");

    const response = buildAuthRequiredScoutResponse(decision);
    expect(response.metadata).toMatchObject({
      intent: "auth_required",
      scaffoldDecision: "blocked",
      scaffoldReason: "auth_required",
      sourceUsed: "decision_pipeline_auth",
      fallbackUsed: false,
      confidenceBand: "high",
      exploreWithoutAccount: true,
    });
  });

  it("exposes account creation as the only primary gated action", () => {
    const decision = runScoutDecisionPipeline(request("Post to community for me"));
    const response = buildAuthRequiredScoutResponse(decision);

    const primaryActions = response.actions.filter((action) => action.primary);
    expect(primaryActions).toHaveLength(1);
    expect(primaryActions[0]).toMatchObject({
      type: "NAVIGATE",
      label: "Create account",
      to: "/pre-scout-setup?mode=create",
      path: "/pre-scout-setup?mode=create",
    });

    const exploreActions = response.actions.filter((action) => !action.primary);
    expect(exploreActions.some((action) => action.to === "/scout")).toBe(true);
    expect(exploreActions.some((action) => action.to === GUEST_COMMUNITY_EXPLORE_ROUTE)).toBe(true);

    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("contact");
    expect(serialized).not.toContain("message provider");
    expect(serialized).not.toContain("lead");
    expect(serialized).not.toContain("hire now");
  });

  it("does not auth-block read-only discovery for guests", () => {
    const decision = runScoutDecisionPipeline(request("Show me contractors near me"));

    expect(decision.type).not.toBe("blocked");
    expect(decision.requiresAuth).not.toBe(true);
  });

  it.each([
    "community feed",
    "Browse the community feed",
    "Show me the community feed",
    "Open community",
    "What's happening in the community",
    "Show me published listings nearby",
  ])("keeps guest explore/browse open without account: %s", (message) => {
    const decision = runScoutDecisionPipeline(request(message));

    expect(decision.type).not.toBe("blocked");
    expect(decision.requiresAuth).not.toBe(true);
  });

  it("routes guest community browse to read-only explore", () => {
    const decision = runScoutDecisionPipeline(request("Browse the community feed"));

    expect(decision).toMatchObject({
      type: "deterministic_route",
      behaviorKey: "guest_community_explore",
    });
    expect(decision.metadata?.route).toBe(GUEST_COMMUNITY_EXPLORE_ROUTE);
  });

  it("routes authenticated community nav without forcing global explore", () => {
    const decision = runScoutDecisionPipeline(request("Show me community", true));

    expect(decision).toMatchObject({
      type: "deterministic_route",
      behaviorKey: "explicit_navigation",
    });
    expect(decision.metadata?.route).toBe("/community-feed");
  });
});
