import type { ScoutDecision, ScoutResponseContract } from "../../shared/types/scout";
import { GUEST_COMMUNITY_EXPLORE_ROUTE } from "./scoutDecisionPipeline";

export const AUTH_REQUIRED_REDIRECT = "/pre-scout-setup?mode=create";

export function buildAuthRequiredScoutResponse(decision: ScoutDecision): ScoutResponseContract & {
  metadata: Record<string, unknown>;
  actions: NonNullable<ScoutResponseContract["actions"]>;
} {
  const redirect =
    typeof decision.metadata?.redirect === "string"
      ? decision.metadata.redirect
      : AUTH_REQUIRED_REDIRECT;

  return {
    message:
      "That step needs a TradeScout account. You can keep exploring Scout and community read-only without signing up; create an account when you want to post or take a gated action.",
    suggestedActions: [
      "Continue exploring",
      "Browse community",
      "Create account now",
      "Learn how TradeScout works",
    ],
    actions: [
      {
        type: "NAVIGATE",
        label: "Create account",
        to: redirect,
        path: redirect,
        primary: true,
      },
      {
        type: "NAVIGATE",
        label: "Continue exploring",
        to: "/scout",
        path: "/scout",
        primary: false,
      },
      {
        type: "NAVIGATE",
        label: "Browse community",
        to: GUEST_COMMUNITY_EXPLORE_ROUTE,
        path: GUEST_COMMUNITY_EXPLORE_ROUTE,
        primary: false,
      },
    ],
    sponsored: null,
    metadata: {
      intent: "auth_required",
      scaffoldDecision: decision.type,
      scaffoldReason: decision.reason,
      redirect,
      sourceUsed: "decision_pipeline_auth",
      fallbackUsed: false,
      confidenceBand: "high",
      exploreWithoutAccount: true,
    },
  };
}
