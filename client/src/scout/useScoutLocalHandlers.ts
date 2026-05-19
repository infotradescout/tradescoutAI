/**
 * useScoutLocalHandlers
 *
 * Encapsulates the four client-side early-return intent branches that live
 * inside handleSend in ScoutOS.tsx.  Each branch detects a specific pattern
 * in the user's message and returns a pre-built ScoutMessage (plus optional
 * auto-route target) so the component can apply state mutations without
 * embedding the detection logic inline.
 *
 * Design philosophy:
 *   - Pure pattern matching — no side effects, no state mutations here.
 *   - Returns a discriminated union so the caller knows exactly which branch
 *     fired and what to do next.
 *   - contextRoles is passed per-call (computed from message text at call time).
 *   - All async work (profile API call) is isolated in checkProfileLookup.
 */

import { useCallback } from "react";
import { resolveExplicitNavigationIntent } from "./localIntents";
import { buildExplicitNavigationMessage } from "./messageBuilders";
import { normalizeForMatch, tokenOverlapScore } from "./textUtils";
import { getHelpLink } from "./helpSources";
import type { ScoutCluster, ScoutMessage } from "./state";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type LocalHandlerResult =
  | {
      kind: "explicit_nav";
      message: ScoutMessage;
      autoRoute: { to: string; label: string; confidence: number; why: string };
    }
  | {
      kind: "profile_lookup";
      message: ScoutMessage;
      autoRoute: { to: string; label: string; confidence: number; why: string } | null;
    }
  | {
      kind: "routing_explainer";
      message: ScoutMessage;
    }
  | {
      kind: "messaging_locked_explainer";
      message: ScoutMessage;
    }
  | { kind: "no_match" };

// ---------------------------------------------------------------------------
// Pure helpers (no React)
// ---------------------------------------------------------------------------

function makeId(): string {
  return `a_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function checkRoutingQuestion(normalized: string): boolean {
  const mentionsRoute = /\b(route|routing|routed)\b/.test(normalized);
  const mentionsOpen = /\bopen request\b/.test(normalized);
  const mentionsNotRouted = /not routed yet/.test(normalized);
  const asksWhy = /\bwhy\b/.test(normalized);
  return (mentionsRoute || mentionsNotRouted || mentionsOpen) && asksWhy;
}

function checkMessagingLockedQuestion(normalized: string): boolean {
  const mentionsMessage = /\b(message|messaging)\b/.test(normalized);
  const hasCant = /\b(can't|cant|cannot)\b/.test(normalized);
  const mentionsLocked = /\b(locked|disabled|closed)\b/.test(normalized);
  const asksWhy = /\bwhy\b/.test(normalized);
  return mentionsMessage && (asksWhy || mentionsLocked || hasCant) && (hasCant || mentionsLocked);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useScoutLocalHandlers() {
  /**
   * Synchronously check for explicit navigation intent.
   */
  const checkExplicitNav = useCallback(
    (value: string, contextRoles: string[]): LocalHandlerResult => {
      const explicitNav = resolveExplicitNavigationIntent(value);
      if (!explicitNav) return { kind: "no_match" };

      const message = buildExplicitNavigationMessage(
        { to: explicitNav.to, label: explicitNav.label },
        { contextRoles }
      );

      return {
        kind: "explicit_nav",
        message,
        autoRoute: {
          to: explicitNav.to,
          label: explicitNav.label,
          confidence: explicitNav.confidence,
          why: "Explicit request",
        },
      };
    },
    []
  );

  /**
   * Async profile lookup — calls the public-search API.
   * Returns { kind: "no_match" } when pattern doesn't match or query is too short.
   */
  const checkProfileLookup = useCallback(
    async (value: string, contextRoles: string[]): Promise<LocalHandlerResult> => {
      const normalizedExplicit = normalizeForMatch(value);
      const wantsProfileLookup =
        /^(go to|take me to|open|show me|navigate to)\b/.test(normalizedExplicit) &&
        /\bprofile\b/.test(normalizedExplicit) &&
        !/\bprofile settings\b/.test(normalizedExplicit);

      if (!wantsProfileLookup) return { kind: "no_match" };

      const afterProfile = normalizedExplicit.split("profile")[1]?.trim() || "";
      const query = afterProfile.replace(/^(for|of)\s+/i, "").trim();

      if (query.length < 3) return { kind: "no_match" };

      try {
        const res = await fetch(
          `/api/profiles/public-search?query=${encodeURIComponent(query)}&limit=6`,
          { credentials: "include" }
        );
        const list = res.ok ? ((await res.json()) as any[]) : [];
        const results = Array.isArray(list) ? list : [];

        const scored = results
          .map((p) => ({
            id: String(p.id || ""),
            slug: String(p.slug || ""),
            displayName: String(p.displayName || ""),
            score: tokenOverlapScore(query, String(p.displayName || p.slug || "")),
          }))
          .filter((r) => r.slug && r.displayName)
          .sort((a, b) => b.score - a.score);

        const best = scored[0];
        const second = scored[1];
        const confident =
          best && best.score >= 0.9 && (!second || best.score - second.score >= 0.08);

        const fallbackToSearch = "/community";
        const targetTo = best?.slug ? `/u/${encodeURIComponent(best.slug)}` : fallbackToSearch;

        const clusters: ScoutCluster[] = [
          {
            id: "profile-lookup",
            title: best?.displayName ? best.displayName : "Browse community",
            kind: "generic",
            body: best?.displayName
              ? "Open their public profile."
              : "Try browsing community activity first.",
            primaryAction: {
              type: "NAVIGATE",
              label: "Open",
              to: targetTo,
            },
          },
        ];

        const message: ScoutMessage = {
          id: makeId(),
          role: "assistant",
          content: best?.displayName
            ? `I found ${best.displayName}.`
            : "I couldn't find a public profile match for that yet.",
          timestamp: new Date().toISOString(),
          clusters,
          navTarget: targetTo,
          memoryDelta: { lastIntent: "profile_lookup" },
          contextRoles,
        };

        return {
          kind: "profile_lookup",
          message,
          autoRoute: best?.slug
            ? {
                to: targetTo,
                label: best.displayName,
                confidence: confident ? best.score : Math.min(0.84, best.score),
                why: "Profile match",
              }
            : null,
        };
      } catch {
        // Network error — fall through to server pipeline
        return { kind: "no_match" };
      }
    },
    []
  );

  /**
   * Synchronously check for "why isn't my request routing yet?" pattern.
   */
  const checkRoutingExplainer = useCallback(
    (value: string, contextRoles: string[]): LocalHandlerResult => {
      const normalized = value.toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
      if (!checkRoutingQuestion(normalized)) return { kind: "no_match" };

      const helpLink = getHelpLink("directConnect");

      const bodyLines: string[] = [
        "TradeScout only shares a request when the basics are complete, so local help sees a clear need.",
        "",
        "Your request is currently saved as a draft and has not been shared yet.",
        "",
        "What to do next:",
        "- Open saved requests and finish the basics (job type, location, budget).",
        "- If sharing is blocked, add the trade and local area so Scout can find local matches.",
        "- If you no longer need it, cancel it and reopen later when ready.",
      ];

      const routingClusters: ScoutCluster[] = [
        {
          id: "direct-connect-routing-explainer",
          title: "Why your request is still saved",
          kind: "generic",
          body: bodyLines.join("\n"),
          primaryAction: {
            type: "NAVIGATE",
            label: "See how sharing works",
            to: helpLink,
          },
        },
      ];

      const message: ScoutMessage = {
        id: makeId(),
        role: "assistant",
        content:
          "Your request will be shared once the key details are complete so the right local help can respond.",
        timestamp: new Date().toISOString(),
        clusters: routingClusters,
        navTarget: helpLink,
        memoryDelta: { lastIntent: "direct_connect_routing_explainer" },
        contextRoles,
      };

      return { kind: "routing_explainer", message };
    },
    []
  );

  /**
   * Synchronously check for "why can't I message yet?" pattern.
   */
  const checkMessagingLocked = useCallback(
    (value: string, contextRoles: string[]): LocalHandlerResult => {
      const normalized = value.toLowerCase().replace(/[^a-z0-9\s]/gi, " ");
      if (!checkMessagingLockedQuestion(normalized)) return { kind: "no_match" };

      const helpLink = getHelpLink("messaging");

      const bodyLines: string[] = [
        "TradeScout keeps messaging locked until someone accepts the request. This prevents spam and keeps contact tied to a real match.",
        "",
        "Right now nobody has accepted this request yet, so messaging stays closed.",
        "",
        "What to do next:",
        "- Wait for someone to accept. Messaging opens automatically on that request.",
        "- Improve request details if responses are slow or off-target.",
        "- Cancel and replace the request if your needs changed.",
      ];

      const messagingClusters: ScoutCluster[] = [
        {
          id: "messaging-rules-explainer",
          title: "Why messaging is locked",
          kind: "generic",
          body: bodyLines.join("\n"),
          primaryAction: {
            type: "NAVIGATE",
            label: "Why messaging is locked",
            to: helpLink,
          },
        },
      ];

      const message: ScoutMessage = {
        id: makeId(),
        role: "assistant",
        content:
          "Messaging opens after someone accepts your request. Until then, it stays locked to prevent spam and mismatched contact.",
        timestamp: new Date().toISOString(),
        clusters: messagingClusters,
        navTarget: helpLink,
        memoryDelta: { lastIntent: "messaging_locked_explainer" },
        contextRoles,
      };

      return { kind: "messaging_locked_explainer", message };
    },
    []
  );

  /**
   * Run all sync checks in priority order.
   * Returns the first match, or { kind: "no_match" } to fall through.
   */
  const resolveSyncIntent = useCallback(
    (value: string, contextRoles: string[]): LocalHandlerResult => {
      const nav = checkExplicitNav(value, contextRoles);
      if (nav.kind !== "no_match") return nav;

      const routing = checkRoutingExplainer(value, contextRoles);
      if (routing.kind !== "no_match") return routing;

      const messaging = checkMessagingLocked(value, contextRoles);
      if (messaging.kind !== "no_match") return messaging;

      return { kind: "no_match" };
    },
    [checkExplicitNav, checkRoutingExplainer, checkMessagingLocked]
  );

  return {
    resolveSyncIntent,
    checkProfileLookup,
  };
}
