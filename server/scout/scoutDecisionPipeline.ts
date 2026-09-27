import type { NormalizedScoutRequest, ScoutDecision } from "../../shared/types/scout";
import { isExplicitProviderBrowseIntent } from "./scoutProviderBrowseIntent";
import { isMixedScoutDiscoveryRequest } from "./scoutCountyFips";

export function runScoutDecisionPipeline(request: NormalizedScoutRequest): ScoutDecision {
  const raw = typeof request.message === "string" ? request.message.trim() : "";
  const lower = raw.toLowerCase();
  const isMixedDiscovery = isMixedScoutDiscoveryRequest(raw);

  if (!raw) {
    return {
      type: "blocked",
      reason: "missing_message",
      requiresAuth: false,
      metadata: { stage: "decision_pipeline" },
    };
  }

  // A request to inspect providers is a search, even when the same sentence
  // describes a repair. Keep it ahead of project intake and generic navigation.
  if (!isMixedDiscovery && isExplicitProviderBrowseIntent(raw)) {
    return {
      type: "server_behavior_handler",
      behaviorKey: "contractor_search_routing",
      metadata: { stage: "decision_pipeline" },
    };
  }

  const explicitNavVerbs = /\b(open|go to|take me to|navigate|show me|bring me to)\b/i;
  const listingSearch = /\b(for sale|to buy|to sell|buying|selling|marketplace|exchange|listings?)\b/i.test(raw);
  const explicitNavTargets: Array<{
    route: string;
    label: string;
    pattern: RegExp;
    requiresAuth?: boolean;
    excludeListingSearch?: boolean;
  }> = [
    {
      route: "/direct-connect/pros",
      label: "Open Businesses",
      pattern: /\b(?:business(?:es)?|providers?|contractors?|pros?)\s+director(?:y|ies)\b|\bbusinesses(?:\s+(?:page|tab))?\b/i,
      excludeListingSearch: true,
    },
    { route: "/messages", label: "Open Messages", pattern: /\b(?:my\s+)?(?:messages?|inbox|conversations?)\b/i, requiresAuth: true },
    { route: "/notifications", label: "Open Notifications", pattern: /\b(?:my\s+)?notifications?\b/i, requiresAuth: true },
    { route: "/profile-settings", label: "Open Profile Settings", pattern: /\b(?:(?:my\s+)?(?:profile|account)\s+settings|my\s+settings)\b/i, requiresAuth: true },
    { route: "/utilities/supply-run", label: "Open Supply Run", pattern: /\b(?:my\s+)?supply\s+runs?\b/i, requiresAuth: true },
    { route: "/finances", label: "Open Finances", pattern: /\b(?:my\s+finances|finance(?:s)?\s+(?:page|dashboard|workspace)|my\s+(?:invoices|payments))\b/i, requiresAuth: true },
    { route: "/homes", label: "Open My Homes", pattern: /\b(?:my\s+homes|home\s*(?:vault|id))\b/i, requiresAuth: true, excludeListingSearch: true },
    { route: "/vehicles", label: "Open My Vehicles", pattern: /\b(?:my\s+vehicles|vehicle\s+vault)\b/i, requiresAuth: true, excludeListingSearch: true },
    { route: "/help", label: "Open Help Center", pattern: /support tickets?/i },
    { route: "/help", label: "Open Help", pattern: /help( center)?/i },
    { route: "/exchange", label: "Open Exchange", pattern: /exchange|marketplace/i },
    { route: "/community", label: "Open Community", pattern: /community/i },
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
    const matchedTarget = explicitNavTargets.find(
      (target) =>
        target.pattern.test(raw) &&
        !(isMixedDiscovery && !target.requiresAuth) &&
        !(target.excludeListingSearch && listingSearch) &&
        !(target.route === "/direct-connect/pros" && /\bmy\s+business(?:es)?\b/i.test(raw))
    );
    if (matchedTarget) {
      if (matchedTarget.requiresAuth && !request.isAuthenticated) {
        return {
          type: "blocked",
          reason: "auth_required",
          requiresAuth: true,
          metadata: {
            stage: "decision_pipeline",
            redirect: `/pre-scout-setup?mode=signin&next=${encodeURIComponent(matchedTarget.route)}`,
          },
        };
      }
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

  const authRequiredPattern =
    /(offer services|provider standing|run a promotion|post(?: this)?(?:\s+\w+){0,4}\s+community|community feed|community announcement|community builder donation|support ticket|my dashboard|my listings|publish(?: it| this)?)/i;
  if (!request.isAuthenticated && authRequiredPattern.test(raw)) {
    return {
      type: "blocked",
      reason: "auth_required",
      requiresAuth: true,
      metadata: { stage: "decision_pipeline", redirect: "/pre-scout-setup?mode=create" },
    };
  }

  // Public posts and deals across sources need the live discovery handler.
  // Individual work-area navigation and auth checks above still take precedence.
  if (isMixedDiscovery) {
    return { type: "synthesis_required", metadata: { stage: "decision_pipeline" } };
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
    /(exchange listing|marketplace|for sale|buying|selling|post listing|list this|\blistings?\b)/i.test(lower)
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
