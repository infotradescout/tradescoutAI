import type { ScoutDecision, ScoutResponseContract } from "../../shared/types/scout";

export const AUTH_REQUIRED_REDIRECT = "/pre-scout-setup?mode=create";

export function buildAuthRequiredScoutResponse(decision: ScoutDecision): ScoutResponseContract & {
  metadata: Record<string, unknown>;
  actions: NonNullable<ScoutResponseContract["actions"]>;
} {
  const redirect =
    typeof decision.metadata?.redirect === "string"
      ? decision.metadata.redirect
      : AUTH_REQUIRED_REDIRECT;
  const isSignIn =
    redirect.startsWith("/pre-scout-setup?") &&
    new URLSearchParams(redirect.split("?")[1]).get("mode") === "signin";

  return {
    message: isSignIn
      ? "Sign in to continue to this area."
      : "To continue with this request, you'll need a TradeScout account. Create an account and Scout will resume from this step.",
    suggestedActions: isSignIn
      ? []
      : ["Create account now", "Learn how TradeScout works", "Continue as guest"],
    actions: [
      {
        type: "NAVIGATE",
        label: isSignIn ? "Sign in" : "Create account",
        to: redirect,
        path: redirect,
        primary: true,
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
    },
  };
}
