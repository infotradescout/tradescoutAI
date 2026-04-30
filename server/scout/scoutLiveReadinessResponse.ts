import type { LiveReadinessResult } from "../../shared/liveReadiness";
import type { ScoutActionContract, ScoutResponseContract } from "../../shared/types/scout";

const READINESS_PATTERN =
  /\b(what(?:'s| is)? next|next step|what should i do|where am i|am i ready|ready to go live|go live|live state|profile completion|finish(?:ing)? (?:my )?(?:setup|profile)|direct connect request|respond to (?:a )?request)\b/i;

const STATE_MESSAGES: Record<LiveReadinessResult["state"], string> = {
  needs_local_setup:
    "Your next valid step is local setup. Finish your county and state first so Scout can route everything in the right place.",
  needs_profile_basics:
    "Your next valid step is profile basics. Add the missing identity and local details before TradeScout treats you as ready for coordination.",
  needs_intent_confirmation:
    "Your next valid step is confirming your focus. This keeps Scout's guidance aligned with what you are actually here to do.",
  needs_verification:
    "Your next valid step is verification. TradeScout keeps live profile and coordination trust separate from profile completion.",
  ready_to_go_live:
    "You are ready to review live readiness. Your profile has the core gates satisfied; check the live-facing details before relying on it for work.",
  ready_to_create_direct_connect_request:
    "You are ready to create a Direct Connect request. Describe what you need, and Scout will keep routing and contact inside the governed Direct Connect path.",
  has_direct_connect_request_waiting:
    "Your next valid step is tracking your Direct Connect request. It is still moving through routing or waiting for responses.",
  has_direct_connect_reply_to_review:
    "Your next valid step is reviewing Direct Connect replies. Contact stays gated until an accepted coordination path exists.",
  has_direct_connect_response_to_accept_or_decline:
    "Your next valid step is responding to a Direct Connect request. Accept, decline, or hold from Direct Connect so the coordination trail stays clear.",
  in_active_coordination:
    "Your next valid step is continuing active coordination in Direct Connect. This is the valid place to continue the accepted contact path.",
};

export function isLiveReadinessQuestion(message: string): boolean {
  return READINESS_PATTERN.test(String(message || ""));
}

export function buildScoutLiveReadinessResponse(
  readiness: LiveReadinessResult
): ScoutResponseContract & { actions: ScoutActionContract[]; metadata: Record<string, unknown> } {
  return {
    message: STATE_MESSAGES[readiness.state],
    suggestedActions: [readiness.action.label, "Ask Scout why", "Open Direct Connect"],
    actions: [
      {
        type: "NAVIGATE",
        label: readiness.action.label,
        to: readiness.action.href,
        path: readiness.action.href,
        primary: true,
      },
    ],
    sponsored: null,
    metadata: {
      intent: "live_readiness_next_step",
      sourceUsed: "live_readiness_resolver",
      fallbackUsed: false,
      confidenceBand: "high",
      readinessState: readiness.state,
      readinessAction: readiness.action.id,
      gates: readiness.gates,
      psychologicalIntent: readiness.psychologicalIntent,
    },
  };
}
