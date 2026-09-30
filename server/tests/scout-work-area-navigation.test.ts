import { describe, expect, it } from "vitest";
import { runScoutDecisionPipeline } from "../scout/scoutDecisionPipeline";
import { buildAuthRequiredScoutResponse } from "../scout/scoutAuthRequiredResponse";
import { buildDecisionPipelineBehaviorResponse } from "../scout/scoutBehaviorHandlers";
import { finalizeScoutResponse } from "../scout/scoutResponseContract";
import {
  scoutAllowedActionToAction,
  validateAction,
} from "../../client/src/scout/actionValidation";
import { canOpenScoutWorkArea } from "../../client/src/scout/scoutWorkAreas";
import { isSafeNextPath } from "../../client/src/lib/postOnboardingRoute";
import type { ScoutAllowedActionV1 } from "../../shared/types/scout";

const privateAreas = [
  ["Open my messages", "/messages"],
  ["Show me messages from roofers", "/messages"],
  ["Show me contractor messages", "/messages"],
  ["Show me notifications", "/notifications"],
  ["Show me my notifications from roofers", "/notifications"],
  ["Go to my profile settings", "/profile-settings"],
  ["Open my supply runs", "/utilities/supply-run"],
  ["Take me to my finances", "/finances"],
  ["Open my invoices from contractors in Maricopa County", "/finances"],
  ["Open my homes", "/homes"],
  ["Open my vehicle vault", "/vehicles"],
] as const;

describe("Scout work-area navigation", () => {
  it.each(privateAreas)("opens an authenticated work area: %s", (message, expectedRoute) => {
    const decision = runScoutDecisionPipeline({ message, isAuthenticated: true, history: [] });
    expect(decision).toMatchObject({
      type: "deterministic_route",
      behaviorKey: "explicit_navigation",
      metadata: { route: expectedRoute },
    });

    const route = String(decision.metadata?.route);
    expect(validateAction({ type: "NAVIGATE", label: "Open", to: route })?.to).toBe(route);
    expect(canOpenScoutWorkArea(route)).toBe(true);
  });

  it("opens the public Businesses directory for a guest", () => {
    const decision = runScoutDecisionPipeline({
      message: "Open the business directory",
      isAuthenticated: false,
      history: [],
    });
    expect(decision).toMatchObject({
      type: "deterministic_route",
      behaviorKey: "explicit_navigation",
      metadata: { route: "/direct-connect/pros" },
    });
    expect(canOpenScoutWorkArea(String(decision.metadata?.route))).toBe(true);
  });

  it("opens Businesses filtered to a named county", () => {
    const message = "Open businesses in Maricopa County, AZ";
    const decision = runScoutDecisionPipeline({ message, isAuthenticated: false, history: [] });
    expect(decision).toMatchObject({
      type: "server_behavior_handler",
      behaviorKey: "contractor_search_routing",
    });

    const response = buildDecisionPipelineBehaviorResponse({
      behaviorKey: String(decision.behaviorKey),
      message,
    });
    const route = String(response?.actions?.[0]?.to);
    expect(route).toBe(
      "/direct-connect/pros?source=scout&state=AZ&county=04013&trade=&q=&selected="
    );
    expect(validateAction(response!.actions![0])?.to).toBe(route);
    expect(canOpenScoutWorkArea(route)).toBe(true);
  });

  it("keeps payment-plan searches in the filtered provider directory", () => {
    const message = "Find roofers with payment plans in Maricopa County";
    const decision = runScoutDecisionPipeline({ message, isAuthenticated: false, history: [] });
    expect(decision).toMatchObject({
      type: "server_behavior_handler",
      behaviorKey: "contractor_search_routing",
    });

    const response = buildDecisionPipelineBehaviorResponse({
      behaviorKey: String(decision.behaviorKey),
      message,
    });
    expect(response?.actions?.[0]?.to).toBe(
      "/direct-connect/pros?source=scout&state=AZ&county=04013&trade=roofing&q=&selected="
    );
  });

  it.each(privateAreas)(
    "sends a guest to sign-in with the requested area saved: %s",
    (message, expectedRoute) => {
      const decision = runScoutDecisionPipeline({ message, isAuthenticated: false, history: [] });
      expect(decision).toMatchObject({
        type: "blocked",
        reason: "auth_required",
        requiresAuth: true,
      });

      const response = buildAuthRequiredScoutResponse(decision);
      expect(response.message).toMatch(/sign in/i);
      expect(response.actions).toHaveLength(1);
      expect(response.actions[0]).toMatchObject({
        type: "NAVIGATE",
        label: "Sign in",
        primary: true,
      });
      const redirect = String(response.actions[0].to);
      const url = new URL(redirect, "https://tradescout.test");
      expect(url.pathname).toBe("/pre-scout-setup");
      expect(url.searchParams.get("mode")).toBe("signin");
      expect(url.searchParams.get("next")).toBe(expectedRoute);
      expect(isSafeNextPath(expectedRoute)).toBe(true);
      expect(validateAction(response.actions[0])?.to).toBe(redirect);
      expect(response.actions.some((action) => action.to === expectedRoute)).toBe(false);

      const contract = finalizeScoutResponse(response, { requestMessage: message }) as {
        allowed_actions: ScoutAllowedActionV1[];
      };
      expect(contract.allowed_actions).toHaveLength(1);
      expect(contract.allowed_actions[0]).toMatchObject({
        type: "NAVIGATE",
        label: "Sign in",
        target: redirect,
        primary: true,
      });
      expect(scoutAllowedActionToAction(contract.allowed_actions[0])?.to).toBe(redirect);
    }
  );

  it.each([
    "Show me homes for sale",
    "Show me my homes for sale",
    "Show me vehicles for sale",
    "Show me my vehicle listings",
  ])("keeps listing discovery in Exchange: %s", (message) => {
    expect(runScoutDecisionPipeline({ message, isAuthenticated: true, history: [] })).toMatchObject(
      {
        type: "server_behavior_handler",
        behaviorKey: "marketplace_routing",
      }
    );
  });

  it("does not replace an explicit Exchange destination with Businesses", () => {
    expect(
      runScoutDecisionPipeline({
        message: "Show me businesses on the Exchange",
        isAuthenticated: false,
        history: [],
      })
    ).toMatchObject({
      type: "deterministic_route",
      behaviorKey: "explicit_navigation",
      metadata: { route: "/exchange" },
    });
  });
});
