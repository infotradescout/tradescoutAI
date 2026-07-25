import type { NormalizedScoutRequest, ScoutDecision } from "../../shared/types/scout";

/** Guest-safe community explore entry (read-only global browse). */
export const GUEST_COMMUNITY_EXPLORE_ROUTE = "/community-feed?geo=global";

/**
 * Account/action intents that must not run anonymously.
 * Intentionally excludes browse/explore phrasing (community feed, published listings, etc.).
 */
export const SCOUT_AUTH_REQUIRED_ACTION_PATTERN =
  /\b(?:offer services|provider standing|run a promotion|community announcement|community builder donation|support ticket|my dashboard|my listings)\b|(?:\b(?:post|publish|create)\b(?:\s+\w+){0,6}\s+(?:to\s+)?(?:(?:the|my)\s+)?community\b)|\bpublish(?:\s+it|\s+this)?\b/i;

/** Read/explore community phrasing that should stay open for guests. */
export const SCOUT_GUEST_COMMUNITY_EXPLORE_PATTERN =
  /\b(?:browse|open|show|see|view|read|check(?:\s+out)?)\b.{0,48}\bcommunity(?:\s+feed)?\b|\bcommunity feed\b|\bwhat(?:'s| is) happening\b.{0,32}\b(?:community|nearby|neighbors?)\b/i;

export function runScoutDecisionPipeline(request: NormalizedScoutRequest): ScoutDecision {
  const raw = typeof request.message === "string" ? request.message.trim() : "";
  const lower = raw.toLowerCase();

  if (!raw) {
    return {
      type: "blocked",
      reason: "missing_message",
      requiresAuth: false,
      metadata: { stage: "decision_pipeline" },
    };
  }

  const explicitNavVerbs = /(open|go to|take me to|navigate|show me|bring me to)/i;
  const guestCommunityRoute = request.isAuthenticated
    ? "/community-feed"
    : GUEST_COMMUNITY_EXPLORE_ROUTE;
  const explicitNavTargets: Array<{ route: string; label: string; pattern: RegExp }> = [
    { route: "/help", label: "Open Help Center", pattern: /support tickets?/i },
    { route: "/help", label: "Open Help", pattern: /help( center)?/i },
    { route: "/exchange", label: "Open Exchange", pattern: /exchange|marketplace/i },
    { route: guestCommunityRoute, label: "Open Community", pattern: /community/i },
    {
      route: "/direct-connect",
      label: "Open Direct Connect",
      pattern: /direct connect|find (a )?(pro|contractor)/i,
    },
    {
      route: "/offer-services",
      label: "Open Offer Services",
      pattern: /offer services|provider setup|provider standing/i,
    },
  ];

  if (explicitNavVerbs.test(raw)) {
    const matchedTarget = explicitNavTargets.find((target) => target.pattern.test(raw));
    if (matchedTarget) {
      return {
        type: "deterministic_route",
        behaviorKey: "explicit_navigation",
        metadata: {
          stage: "decision_pipeline",
          route: matchedTarget.route,
          label: matchedTarget.label,
        },
      };
    }
  }

  // Guest community browse/explore stays open (visibility ≠ posting/contact).
  if (!request.isAuthenticated && SCOUT_GUEST_COMMUNITY_EXPLORE_PATTERN.test(raw)) {
    return {
      type: "deterministic_route",
      behaviorKey: "guest_community_explore",
      metadata: {
        stage: "decision_pipeline",
        route: GUEST_COMMUNITY_EXPLORE_ROUTE,
        label: "Browse Community",
      },
    };
  }

  if (!request.isAuthenticated && SCOUT_AUTH_REQUIRED_ACTION_PATTERN.test(raw)) {
    return {
      type: "blocked",
      reason: "auth_required",
      requiresAuth: true,
      metadata: { stage: "decision_pipeline", redirect: "/pre-scout-setup?mode=create" },
    };
  }

  const homeProjectPattern =
    /(repair|replace|install|estimate|cost|quote|permit|inspection|leak|foundation|roof|plumb|electric|hvac|paint)/i;
  if (homeProjectPattern.test(raw)) {
    return {
      type: "deterministic_route",
      behaviorKey: "home_project_routing",
      metadata: { stage: "decision_pipeline" },
    };
  }

  if (
    /(offer services|get more local jobs|provider standing|eligible to be promoted|run a promotion|draft promo)/i.test(
      lower
    )
  ) {
    return {
      type: "server_behavior_handler",
      behaviorKey: "provider_routing",
      metadata: { stage: "decision_pipeline" },
    };
  }

  if (
    /(community builder donation|county vault donation|community announcement|post to community|hoa announcement|neighborhood update)/i.test(
      lower
    )
  ) {
    return {
      type: "server_behavior_handler",
      behaviorKey: "community_routing",
      metadata: { stage: "decision_pipeline" },
    };
  }

  if (
    /(exchange listing|marketplace|for sale|buying|selling|post listing|list this)/i.test(lower)
  ) {
    return {
      type: "server_behavior_handler",
      behaviorKey: "marketplace_routing",
      metadata: { stage: "decision_pipeline" },
    };
  }

  if (
    /(find a pro|find contractor|contractor|plumber|electrician|roofer|hvac|painter)/i.test(lower)
  ) {
    return {
      type: "server_behavior_handler",
      behaviorKey: "contractor_search_routing",
      metadata: { stage: "decision_pipeline" },
    };
  }

  if (
    /(contact support|support ticket|technical support|request support|customer support)/i.test(
      lower
    )
  ) {
    return {
      type: "server_behavior_handler",
      behaviorKey: "support_routing",
      metadata: { stage: "decision_pipeline" },
    };
  }

  return {
    type: "synthesis_required",
    metadata: { stage: "decision_pipeline" },
  };
}
