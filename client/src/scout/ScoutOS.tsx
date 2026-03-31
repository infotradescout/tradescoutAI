import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
// Note: navigation is handled via AppShell top/bottom nav; ScoutOS focuses on chat.
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "../hooks/useIsMobile";
import { useScoutState } from "./state";
import ScoutThread from "./ScoutThread";
import { ScoutDirectConnectPanel } from "./ScoutDirectConnectPanel";
import { ScoutHasDonePanel } from "./ScoutHasDonePanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ScoutToolsDrawer from "./ScoutToolsDrawer";
import { apiBase, sendToScout, logScoutInsight, type ScoutLocality, type ScoutMode } from "./api";
import { executeScoutActions } from "./ScoutActionRouter";
import { ROUTES } from "@/lib/routes";
import type { ScoutAction, ScoutCluster, ScoutMessage } from "./state";
import { useSession } from "../contexts/SessionContext";
import {
  getRecentActivity,
  recordActivity,
  getSeenAdIds,
  markAdSeen,
  canShowAnotherSponsored,
  hasSeenFirstAnswer,
  markFirstAnswerSeen,
} from "../agent/activity";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, ClipboardList, Users2, Wrench } from "lucide-react";
import { getHelpLink } from "./helpSources";
import { ScoutHeader } from "./ScoutHeader";
import { ScoutInputRow } from "./ScoutInputRow";
import { scoutActionTiles } from "./scoutActionTiles";
import { resolveAllTiles } from "./resolveScoutTiles";
import type { ScoutTileContext } from "./scoutActionTiles";
import { applyCtasToClusters, type ScoutCtaHint } from "./ctaHelpers";
import { updateGeoPreferencesFromDeviceLocation } from "../agent/tools/geoPreferences";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { formatCityOnly } from "@/utils/locationDisplay";
import { openFloatingNote } from "@/lib/floatingNotes";
import { ScoutWorkAreaSheet } from "./ScoutWorkAreaSheet";
import { hasAdminUiAccess } from "@/lib/roleChecks";
import {
  searchContractors,
  searchMarketplace,
  type ContractorResult,
  type MarketplaceResult,
  type MarketplaceListingProposal,
  proposeMarketplaceListing,
  type PromotionProposal,
  type PromotionProposalPayload,
  proposePromotion,
  type CommunityPostProposal,
  type CommunityPostProposalPayload,
  proposeCommunityPost,
} from "../agent/tools/scoutTools";
import {
  getProviderRequirements,
  getProviderStanding,
  type ProviderStanding,
} from "@/agent/tools/providers";
import { inferContextRoles, deriveModeFromContextRoles } from "./contextRoles";
import { useScoutOnboarding } from "./useScoutOnboarding";
import { ClaimConfirmationCard as ClaimConfirmationCardComponent } from "./ClaimConfirmationCard";
import { buildScoutProvenance } from "./provenance";
import { enforceResponseQualityContract } from "./responseQuality";
import type { ClaimType } from "./claimTypes";
import type { ProfileDraft } from "@/types/profileDraft";
import { useScoutMode } from "./useScoutMode";
import { PostOnboardingActionCard } from "./PostOnboardingActionCard";
import { resolvePostOnboardingActions } from "./resolvePostOnboardingActions";
import { resolveExplicitNavigationIntent, resolveQuickActionIntent } from "./localIntents";
import { buildConnectionFallback, buildExplicitNavigationMessage } from "./messageBuilders";
import ObjectiveChip from "./ObjectiveChip";
import ObjectiveOnboardingFlow from "./ObjectiveOnboardingFlow";
import ToneAwareMessage from "./ToneAwareMessage";
import TrustAwareDecisionCard from "./TrustAwareDecisionCard";
import WatchdogInterventionBanner from "./WatchdogInterventionBanner";
import { UnifiedScoutRouterClient, type UnifiedRoutingDecision } from "./unifiedRouterClient";
import type { Objective } from "@shared/types/objective";
import { trackDemandEvent } from "@/lib/demandEngine";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

const INTRO_DEMO_TEXT = "What can TradeScout do for my community?";
// Must match the key used by ScoutInput so the demo only runs once per session.
const INTRO_DEMO_SESSION_KEY = "ts_intro_demo_session";
const SCOUT_QUICK_START_PROMPTS = [
  "Help me find the right local help",
  "Help me figure out cost and timing",
  "Do I need permits for this?",
  "Show me what's happening nearby",
] as const;

const COUNTY_EXPLAINED_KEY = "scout:county_explained:v1";
const COUNTY_EXPLAINED_AT_KEY = "scout:county_explained_at";
const COUNTY_EXPLAINED_FOLLOWUP_KEY = "scout:county_explained_followup_recorded";

const AUTO_ROUTE_ENABLED_KEY = "scout:auto_route_enabled:v1";
const SCOUT_VIEW_MODE_KEY = "scout:view_mode:v1";
const AUTO_ROUTE_DEFAULT_ENABLED = true;
const AUTO_ROUTE_MIN_CONFIDENCE = 0.85;
const AUTO_ROUTE_DELAY_MS = 1600;
const OBJECTIVES_ENABLED = String(import.meta.env.VITE_OBJECTIVES_ENABLED ?? "true") === "true";
const SCOUT_EVOLUTION_SURFACES_ENABLED =
  String(import.meta.env.VITE_SCOUT_EVOLUTION_SURFACES_ENABLED ?? "false") === "true";

const BANNED_TERMS = ["fuck", "shit", "bitch", "asshole", "cunt", "slut", "whore"];

const WEAK_SUGGESTION_PREFIXES = [/^ask\b/i, /^explain\b/i, /^tell me more\b/i];

function isWeakSuggestionLabel(label: string) {
  const trimmed = label.trim();
  return WEAK_SUGGESTION_PREFIXES.some((re) => re.test(trimmed));
}

function sanitizeSuggestionLabel(label: string) {
  let out = label.trim();
  if (!out) return "";

  // Avoid internal jargon that new users won't understand
  out = out.replace(/dashboards?/gi, "views");

  // Keep chips readable on mobile
  if (out.length > 80) {
    out = `${out.slice(0, 77)}...`;
  }

  return out;
}

function containsProfanity(text: string) {
  const lower = text.toLowerCase();
  return BANNED_TERMS.some((term) => lower.includes(term));
}

function censorProfanity(text: string) {
  let cleaned = text;
  for (const term of BANNED_TERMS) {
    const re = new RegExp(term, "gi");
    cleaned = cleaned.replace(re, `${term[0]}***`);
  }
  return cleaned;
}

function confidenceLabelToScore(label?: string | null): number {
  const l = (label || "").toLowerCase();
  if (l === "high") return 0.9;
  if (l === "medium") return 0.7;
  if (l === "low") return 0.4;
  return 0;
}

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForRepetitionCheck(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapScore(query: string, candidate: string): number {
  const q = normalizeForMatch(query);
  const c = normalizeForMatch(candidate);
  if (!q || !c) return 0;
  if (c.includes(q)) return 0.98;

  const qTokens = new Set(q.split(" ").filter(Boolean));
  const cTokens = new Set(c.split(" ").filter(Boolean));
  if (qTokens.size === 0 || cTokens.size === 0) return 0;

  let intersect = 0;
  qTokens.forEach((t) => {
    if (cTokens.has(t)) intersect += 1;
  });
  const union = qTokens.size + cTokens.size - intersect;
  const jaccard = union > 0 ? intersect / union : 0;

  // Penalize very short / generic queries
  const lengthBoost = Math.min(1, q.length / 12);
  return Math.max(0, Math.min(0.95, jaccard * 0.9 + lengthBoost * 0.1));
}

function tryRecordCountyExplanationFollowup(
  kind: "navigate" | "scout_message" | "gated_query_success",
  path: string
) {
  try {
    if (typeof window === "undefined") return;

    if (window.localStorage.getItem(COUNTY_EXPLAINED_FOLLOWUP_KEY) === "1") {
      return;
    }

    const raw = window.localStorage.getItem(COUNTY_EXPLAINED_AT_KEY);
    if (!raw) return;

    const explainedAt = Number(raw);
    if (!Number.isFinite(explainedAt)) return;

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    if (now - explainedAt > fiveMinutes) {
      return;
    }

    recordActivity({
      type: "county_explained_followup_action",
      ts: new Date().toISOString(),
      path,
      meta: { kind },
    });

    window.localStorage.setItem(COUNTY_EXPLAINED_FOLLOWUP_KEY, "1");
  } catch {
    // Ignore storage/telemetry failures; never affect UX.
  }
}

/**
 * CRITICAL: Strip internal reasoning from Scout responses before rendering.
 * Internal fields like intent, thought_flow, reasoning must NEVER be visible to users.
 * This is a response sanitation contract - Scout output must be user-facing only.
 */
function sanitizeScoutMessage(raw: unknown): string {
  if (typeof raw !== "string") return "";

  const trimmed = raw.trim();

  const fallback = "Let's keep this practical and local. Pick a next step and I'll route it.";

  // If response looks like JSON, recover user-facing message fields.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const candidate =
        (typeof parsed?.message === "string" && parsed.message) ||
        (typeof parsed?.answer === "string" && parsed.answer) ||
        (typeof parsed?.response === "string" && parsed.response) ||
        "";
      if (candidate.trim()) return sanitizeScoutMessage(candidate);
      return fallback;
    } catch {
      return fallback;
    }
  }

  const markdownStripped = trimmed
    .replace(/```[a-zA-Z0-9_-]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");

  const internalSpecDump =
    /recommended by this analysis|trigger examples\s*:|implementation trust signals|auto-persist|safe path|ownership pressure|increases drop-?off|phase\s+\d+\s*:/i.test(
      markdownStripped
    ) ||
    ((markdownStripped.match(/:/g) || []).length >= 7 && markdownStripped.length > 260);
  if (internalSpecDump) return fallback;

  const internalLinePattern =
    /^(source:|knowledge base:|available knowledge base:|reasoning:|analysis:|thought[_\s-]*flow:|decision:|render order:|state injection\b|ui emphasis\b)/i;

  const withoutInternal = markdownStripped
    .split("\n")
    .filter((line) => {
      const text = line.trim();
      if (!text) return true;
      if (/\[(docs?|source)\]/i.test(text)) return false;
      if (/\b[\w/-]+\.md\b/i.test(text)) return false;
      if (/\bbehavioral_center\.md\b/i.test(text)) return false;
      if (/\bbehavioral\s+center\b/i.test(text)) return false;
      if (/^admins?$/i.test(text)) return false;
      if (/pick\s+a\s+button\s+below/i.test(text)) return false;
      if (/for\s*90%\+\s*of\s*users/i.test(text)) return false;
      return !internalLinePattern.test(text);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return withoutInternal || fallback;
}

function enforceShortIntentDiscipline(
  userMessage: string,
  content: string,
  intentLabel?: string
): string {
  const lower = userMessage.trim().toLowerCase();
  const isVeryShortPrompt = lower.length > 0 && lower.length <= 120;
  const startsWithShortWh = /^(what|why|who|where|when)\b/.test(lower);

  const looksShortIntent =
    isVeryShortPrompt &&
    (startsWithShortWh ||
      intentLabel === "short" ||
      intentLabel === "definition" ||
      intentLabel === "why");

  if (!looksShortIntent) return content;

  const trimmed = content.trim();
  if (!trimmed) return trimmed;

  // Keep only the first 1-3 sentences to match the
  // short-intent contract without changing the core answer.
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length <= 3) return trimmed;

  const kept = sentences.slice(0, 3).join(" ");
  return kept.endsWith(".") || kept.endsWith("!") || kept.endsWith("?") ? kept : `${kept}...`;
}

function objectiveStatusToOnboardingStatus(
  status: Objective["status"]
): "pending" | "in_progress" | "completed" | "skipped" {
  if (status === "completed") return "completed";
  if (status === "active") return "in_progress";
  if (status === "paused") return "pending";
  return "skipped";
}

function objectiveStatusToProgress(status: Objective["status"]): number {
  if (status === "completed") return 100;
  if (status === "paused") return 20;
  if (status === "active") return 45;
  return 0;
}

export default function ScoutOS() {
  const { user, isAuthenticated, refetch: refetchUser } = useAuth();
  const [location, navigate] = useLocation();
  const isMobile = useIsMobile();

  const [toolsOpen, setToolsOpen] = useState(false);
  const [workAreaOpen, setWorkAreaOpen] = useState(false);
  const [workAreaUrl, setWorkAreaUrl] = useState<string | null>(null);
  const [workAreaTitle, setWorkAreaTitle] = useState<string | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);
  const [activeMode, setActiveMode] = useState<ScoutMode>("default");
  const [hasGuestInteracted, setHasGuestInteracted] = useState(false);
  const [firstIntroAppendix, setFirstIntroAppendix] = useState<string>("");
  const [overridePendingScope, setOverridePendingScope] = useState<string | null>(null);
  const [introDemoText, setIntroDemoText] = useState("");
  const [isUpdatingGeo, setIsUpdatingGeo] = useState(false);
  const [autoRouteEnabled, setAutoRouteEnabled] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return AUTO_ROUTE_DEFAULT_ENABLED;
      const raw = window.localStorage.getItem(AUTO_ROUTE_ENABLED_KEY);
      if (raw === "0") return false;
      if (raw === "1") return true;
      return AUTO_ROUTE_DEFAULT_ENABLED;
    } catch {
      return AUTO_ROUTE_DEFAULT_ENABLED;
    }
  });
  const [autoRoutePending, setAutoRoutePending] = useState<null | {
    to: string;
    label: string;
    confidence: number;
    why?: string;
  }>(null);
  const [activeObjective, setActiveObjective] = useState<Objective | null>(null);
  const [objectiveBusy, setObjectiveBusy] = useState(false);
  const [objectiveOnboardingBundle, setObjectiveOnboardingBundle] = useState<any | null>(null);
  const [watchdogResult, setWatchdogResult] = useState<any | null>(null);
  const [dismissedWatchdogId, setDismissedWatchdogId] = useState<string | null>(null);
  const [routingDecisionCard, setRoutingDecisionCard] = useState<UnifiedRoutingDecision | null>(
    null
  );
  const [toneMessage, setToneMessage] = useState<null | {
    message: string;
    scenario?:
      | "default"
      | "technical_fallback"
      | "confidence_low"
      | "blocked_action"
      | "next_step_prompt";
    toneScore?: number;
    guardrailFlags?: string[];
    confidenceBand?: "low" | "medium" | "high";
  }>(null);

  const [dcConfirmOpen, setDcConfirmOpen] = useState(false);
  const [dcDraft, setDcDraft] = useState<null | {
    title: string;
    description: string;
    countyFips?: string;
    stateCode?: string;
    tradeId?: string;
    budgetMin?: number;
    budgetMax?: number;
  }>(null);
  const [dcBusy, setDcBusy] = useState(false);
  const [controllerRailOpen, setControllerRailOpen] = useState(true);
  const [controllerShowAll, setControllerShowAll] = useState(false);
  const [scoutViewMode, setScoutViewMode] = useState<"chat_only" | "chat_plus_controller">(() => {
    try {
      if (typeof window === "undefined") return "chat_only";
      const raw = window.localStorage.getItem(SCOUT_VIEW_MODE_KEY);
      if (raw === "chat_only") return "chat_only";
      if (raw === "chat_plus_controller") return "chat_plus_controller";
      return "chat_only";
    } catch {
      return "chat_only";
    }
  });
  const autoRouteTimerRef = useRef<number | null>(null);
  const { sessionRole } = useSession();

  const hasPlayedDemoThisSession = (() => {
    try {
      const played =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(INTRO_DEMO_SESSION_KEY) === "1";

      // Allow forcing the intro demo via URL (e.g., /scout?forceIntro=1)
      let forceIntro = false;
      try {
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          forceIntro = params.get("forceIntro") === "1";
        }
      } catch {
        // ignore
      }

      // In development, always allow the intro demo to re-run
      // so designers/devs can validate the animation and auto-prompt.
      if (import.meta.env.DEV) return false;

      return played && !forceIntro;
    } catch {
      return false;
    }
  })();

  const { state, recordUserMessage, applyServerResponse, setError, setStatus } = useScoutState();

  // KPI: Track time-to-action from render to first action execution
  const renderStartRef = useRef<number | null>(null);
  const hasLoggedIntroRef = useRef<boolean>(false);
  const hasLoggedConfusionRef = useRef<boolean>(false);
  const trackedUrlIntentRef = useRef<string | null>(null);

  const cancelAutoRoute = useCallback(() => {
    if (autoRouteTimerRef.current) {
      window.clearTimeout(autoRouteTimerRef.current);
      autoRouteTimerRef.current = null;
    }
    setAutoRoutePending(null);
  }, []);

  const queueAutoRoute = useCallback(
    (candidate: { to: string; label: string; confidence: number; why?: string } | null) => {
      if (!candidate) return;
      cancelAutoRoute();
      setAutoRoutePending(candidate);

      if (!autoRouteEnabled) return;
      if (candidate.confidence < AUTO_ROUTE_MIN_CONFIDENCE) return;

      autoRouteTimerRef.current = window.setTimeout(() => {
        autoRouteTimerRef.current = null;
        setAutoRoutePending(null);
        navigate(candidate.to);
      }, AUTO_ROUTE_DELAY_MS);
    },
    [autoRouteEnabled, cancelAutoRoute, navigate]
  );

  // One-time init guard (keeps animations / welcome seed from re-running).
  // Removed client-side injected welcome message to avoid collision
  // with auto-typing demo. Scout should not speak until the user (or
  // auto demo) sends the first message.

  const locationCtx = useLocationContext();
  const countyCommitted = hasCountyContext(locationCtx);

  const locality: ScoutLocality = useMemo(() => {
    const countyName = countyCommitted
      ? locationCtx.countyName || (locationCtx as any).county
      : undefined;
    const stateCode = countyCommitted ? locationCtx.stateCode : undefined;

    return {
      county: countyName,
      countyName,
      countyFips: countyCommitted ? locationCtx.countyFips : undefined,
      state: stateCode,
      stateCode,
      // zip is still sourced from the user profile when present.
      zip: user?.zip,
      lat: locationCtx.lat,
      lng: locationCtx.lng,
    };
  }, [
    countyCommitted,
    (locationCtx as any).county,
    locationCtx.countyFips,
    locationCtx.countyName,
    locationCtx.stateCode,
    locationCtx.lat,
    locationCtx.lng,
    user?.zip,
  ]);

  const hasMessages = state.messages.length > 0;
  const showThreadRegion =
    hasMessages ||
    state.status === "resolving_context" ||
    state.status === "checking_documents" ||
    state.status === "executing_action";

  // Log a lightweight "intro_shown" event the first time the Scout surface
  // renders without any prior messages. Keep hasMessages above this effect to
  // avoid TDZ issues in production builds.
  useEffect(() => {
    if (!hasMessages && !hasLoggedIntroRef.current) {
      recordActivity({
        type: "intro_shown",
        ts: new Date().toISOString(),
        path: location,
        label: "scout_intro_hero",
      });
      hasLoggedIntroRef.current = true;
    }
  }, [hasMessages, location]);

  useEffect(() => {
    return () => {
      cancelAutoRoute();
    };
  }, [cancelAutoRoute]);

  const handleToggleAutoRoute = useCallback(
    (enabled: boolean) => {
      setAutoRouteEnabled(enabled);
      cancelAutoRoute();

      try {
        window.localStorage.setItem(AUTO_ROUTE_ENABLED_KEY, enabled ? "1" : "0");
      } catch {
        // ignore
      }

      // Best-effort persist for authed users (safe to ignore failures).
      if (user) {
        void fetch("/api/agent/preferences/scout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scout: { autoRouteEnabled: enabled } }),
        }).catch(() => undefined);
      }
    },
    [cancelAutoRoute, user]
  );

  const persistScoutResume = useCallback(
    async (delta: any) => {
      if (!user) return;
      try {
        await fetch("/api/agent/preferences/scout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scout: delta }),
        });
      } catch {
        // best-effort only
      }
    },
    [user]
  );

  const openWorkArea = useCallback(
    (opts: { url: string; title?: string }) => {
      const url = typeof opts.url === "string" ? opts.url.trim() : "";
      if (!url.startsWith("/")) return;

      setWorkAreaUrl(url);
      setWorkAreaTitle(typeof opts.title === "string" ? opts.title : null);
      setWorkAreaOpen(true);

      recordActivity({
        type: "open_work_area",
        ts: new Date().toISOString(),
        path: location,
        to: url,
        label: opts.title || "Workspace",
      } as any);
    },
    [location]
  );

  const maybeOpenWorkAreaForRoute = useCallback(
    (to: string | null | undefined, label?: string) => {
      const raw = typeof to === "string" ? to : "";
      if (!raw.startsWith("/")) return false;

      // Tight allowlist: only embed pages that behave correctly without a full route swap.
      const safePrefixes = [
        "/profile-settings",
        "/settings",
        "/notifications",
        "/direct-connect",
        "/exchange",
        "/community-feed",
        "/community",
        "/homescout-listings",
        "/homescout",
      ];

      if (!safePrefixes.some((p) => raw.startsWith(p))) return false;

      openWorkArea({ url: raw, title: label });
      return true;
    },
    [openWorkArea]
  );

  // Ephemeral, derived context roles per message/page for tone + defaults
  const getContextRoles = useCallback(
    (message: string): string[] => {
      const roles = inferContextRoles({
        message,
        pagePath: location,
        recentActions: state.lastActions.map((a) => a.type),
        inferredCapabilities: (user as any)?.capabilities ?? [],
      });
      return roles;
    },
    [location, state.lastActions, user]
  );

  const userRoles = (user as any)?.roles as string[] | undefined;
  const isGuest = !isAuthenticated;

  const isBusy =
    state.status === "resolving_context" ||
    state.status === "checking_documents" ||
    state.status === "executing_action";

  // Watchdog: force idle state if still busy past the normal API timeout window.
  // Keep this > client API timeout to avoid false triggers in slow-but-successful requests.
  useEffect(() => {
    if (!isBusy) return;

    const timeout = setTimeout(() => {
      console.warn("[ScoutOS] Watchdog triggered - forcing idle state after 28s");
      setStatus("idle");
    }, 28000);

    return () => clearTimeout(timeout);
  }, [isBusy, setStatus]);

  const hasUserMessages = useMemo(
    () => state.messages.some((m) => m.role === "user"),
    [state.messages]
  );

  // First-time guest state: controls the calm intro + auto-demo gating.
  const isFirstGuestVisit = isGuest && !hasGuestInteracted && !hasUserMessages;

  const controllerActions = useMemo(() => {
    const actions = Array.isArray(state.lastActions) ? state.lastActions : [];
    const filtered = actions.filter(
      (a) =>
        a &&
        a.type !== "NOOP" &&
        (typeof a.label === "string" || typeof a.to === "string" || typeof a.path === "string")
    );

    const deduped: ScoutAction[] = [];
    const seen = new Set<string>();

    const rankAction = (action: ScoutAction) => {
      if (action.primary) return 0;
      if (action.type === "NAVIGATE") return 1;
      if (action.type === "CALL_TOOL") return 2;
      return 3;
    };

    const prioritized = [...filtered].sort((a, b) => {
      const rankDiff = rankAction(a) - rankAction(b);
      if (rankDiff !== 0) return rankDiff;
      const aHasPath = typeof a.to === "string" || typeof a.path === "string";
      const bHasPath = typeof b.to === "string" || typeof b.path === "string";
      if (aHasPath !== bHasPath) return aHasPath ? -1 : 1;
      return 0;
    });

    for (const action of prioritized) {
      const key = [action.type, action.label || "", action.to || "", action.path || ""].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(action);
      if (deduped.length >= 5) break;
    }

    return deduped;
  }, [state.lastActions]);

  const visibleControllerActions = useMemo(() => {
    if (controllerShowAll) return controllerActions;
    return controllerActions.slice(0, 2);
  }, [controllerActions, controllerShowAll]);

  const setViewMode = useCallback((nextMode: "chat_only" | "chat_plus_controller") => {
    setScoutViewMode(nextMode);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SCOUT_VIEW_MODE_KEY, nextMode);
      }
    } catch {
      // ignore persistence errors
    }
  }, []);

  const effectiveViewMode: "chat_only" | "chat_plus_controller" = isMobile
    ? "chat_only"
    : scoutViewMode;

  // Keep the Scout surface feeling like a modern chat: shortcuts are available,
  // but they shouldn't crowd the thread once a conversation has started.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => {
    if (hasUserMessages) {
      setShortcutsOpen(false);
    }
  }, [hasUserMessages]);

  const refreshObjective = useCallback(async () => {
    if (!OBJECTIVES_ENABLED || !isAuthenticated) {
      setActiveObjective(null);
      return;
    }

    try {
      const res = await fetch("/api/objectives/active", {
        credentials: "include",
      });
      if (!res.ok) {
        setActiveObjective(null);
        return;
      }

      const payload = (await res.json()) as { objective?: Objective | null };
      setActiveObjective(payload?.objective ?? null);
    } catch {
      setActiveObjective(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshObjective();
  }, [refreshObjective]);

  const updateObjective = useCallback(
    async (patch: Partial<Pick<Objective, "title" | "status">>) => {
      if (!OBJECTIVES_ENABLED || !activeObjective?.id) return;
      setObjectiveBusy(true);
      try {
        await fetch(`/api/objectives/${encodeURIComponent(String(activeObjective.id))}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
      } finally {
        await refreshObjective();
        setObjectiveBusy(false);
      }
    },
    [activeObjective?.id, refreshObjective]
  );

  const deleteObjective = useCallback(async () => {
    if (!OBJECTIVES_ENABLED || !activeObjective?.id) return;
    setObjectiveBusy(true);
    try {
      await fetch(`/api/objectives/${encodeURIComponent(String(activeObjective.id))}`, {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      await refreshObjective();
      setObjectiveBusy(false);
    }
  }, [activeObjective?.id, refreshObjective]);

  // Auto-demo typing for first-time guest sessions.
  // This is intentionally session-scoped and can be forced via ?forceIntro=1.
  const shouldPlayIntroDemo = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!location.startsWith("/scout")) return false;

    let forceIntro = false;
    try {
      const params = new URLSearchParams(window.location.search);
      forceIntro = params.get("forceIntro") === "1";
    } catch {
      // ignore
    }

    if (forceIntro) return true;
    if (isAuthenticated) return false;
    if (!isFirstGuestVisit) return false;
    if (hasPlayedDemoThisSession) return false;
    return true;
  }, [hasPlayedDemoThisSession, isAuthenticated, isFirstGuestVisit, location]);

  // Parse URL search params to detect explicit intent (e.g. /scout?intent=estimate)
  const urlIntent = useMemo(() => {
    try {
      if (!location.startsWith("/scout")) return undefined;
      const searchIndex = location.indexOf("?");
      if (searchIndex === -1) return undefined;
      const search = location.substring(searchIndex);
      const params = new URLSearchParams(search);
      const raw = params.get("intent") || undefined;
      return raw ? raw.toLowerCase() : undefined;
    } catch {
      return undefined;
    }
  }, [location]);

  useEffect(() => {
    if (!urlIntent) return;

    try {
      const searchIndex = location.indexOf("?");
      const search = searchIndex >= 0 ? location.substring(searchIndex) : "";
      const params = new URLSearchParams(search);
      const source = params.get("source");
      const prompt = params.get("prompt");
      const signature = [
        urlIntent,
        source || "",
        prompt ? "prompt" : "",
        params.get("ref") || "",
        params.get("utm_campaign") || "",
      ].join("|");

      if (trackedUrlIntentRef.current === signature) return;
      trackedUrlIntentRef.current = signature;

      void trackDemandEvent("intent_submitted", {
        intent: urlIntent,
        source: source || undefined,
        hasPrompt: Boolean(prompt),
      });
    } catch {
      // fail-soft: analytics must never impact scout flow
    }
  }, [location, urlIntent]);

  // PHASE 3d-A: Scout Onboarding Flow with Claim Inference
  const onboarding = useScoutOnboarding();

  // PHASE 3d-B: Scout Mode State Machine (onboarding -> post_onboarding -> freeform)
  const provisional = (user as any)?.preferences?.provisional;
  const profileDraft: ProfileDraft | undefined = provisional?.profileDraft;
  const scoutModeHook = useScoutMode({
    userId: (user as any)?.id,
    profileDraftComplete: !!(profileDraft?.countyFips && profileDraft?.presenceType),
    profileDraftPublished: !!(profileDraft?.countyFips && profileDraft?.presenceType), // Will expand as business profile is saved
    claimsConfirmed:
      !!(user as any)?.confirmedClaims &&
      Array.isArray((user as any)?.confirmedClaims) &&
      (user as any).confirmedClaims.length > 0,
    confirmedClaims: Array.isArray((user as any)?.confirmedClaims)
      ? (user as any).confirmedClaims
      : [],
    publishedProfileSlug: (user as any)?.businessSlug || undefined,
  });

  // Enforce pre-Scout gate completion before running onboarding
  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      const params = new URLSearchParams(location.split("?")[1] || "");
      const wantsOnboarding = params.get("onboarding") === "true";
      const provisional = (user as any)?.preferences?.provisional;
      const profileDraft: ProfileDraft | undefined = provisional?.profileDraft;
      const hasCanonicalLocation = hasCountyContext(locationCtx);

      // Avoid redirect loops: once a user has a canonical location committed, they should not be
      // forced back into pre-scout setup just because a provisional draft was cleared.
      if (
        wantsOnboarding &&
        !hasCanonicalLocation &&
        (!profileDraft?.countyFips || !profileDraft.presenceType)
      ) {
        navigate("/pre-scout-setup");
      }
    } catch {
      // Ignore malformed URLs; do not block navigation.
    }
  }, [isAuthenticated, location, locationCtx, navigate, user]);

  // Trigger onboarding flow when ?onboarding=true
  useEffect(() => {
    const userId = (user as any)?.id;
    const provisional = (user as any)?.preferences?.provisional;
    const profileDraft: ProfileDraft | undefined = provisional?.profileDraft;
    const alreadyCompleted = (user as any)?.onboardingCompleted === true;

    // Once a user has completed onboarding, never auto-trigger it again
    // from lingering onboarding query params.
    if (alreadyCompleted) return;

    if (!onboarding.shouldTriggerOnboarding(location, userId, provisional)) {
      return;
    }

    // Extract intent data
    const userIntentText = provisional?.userIntent || "";
    const provisionalUserTypes = provisional?.userTypes || [];
    const countyName = profileDraft?.countyName || locality.county || null;

    // Start inference flow
    onboarding.startOnboardingFlow(userIntentText, provisionalUserTypes, countyName, profileDraft);
  }, [location, user, locality.county, onboarding]);

  // First-time guest state is derived earlier (before intro demo gating).
  // Diagnostic: log intro demo gating values to verify which guard blocks (dev-only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      const sessionPlayed =
        typeof window !== "undefined" && window.sessionStorage.getItem(INTRO_DEMO_SESSION_KEY);
      // One-line truth for debugging
      console.log("[INTRO DEMO CHECK]", {
        isAuthenticated,
        isGuest,
        hasMessages,
        hasUserMessages,
        sessionPlayed,
        shouldPlayIntroDemo,
      });
    } catch {
      // ignore
    }
  }, [isAuthenticated, isGuest, hasMessages, hasUserMessages, shouldPlayIntroDemo]);

  // Clear any stale prefill on first guest visit so input is always empty
  useEffect(() => {
    if (isFirstGuestVisit) {
      try {
        window.localStorage.removeItem("scout:prefill:scout-main");
      } catch {
        // ignore storage errors
      }
      setPrefillKey((k) => k + 1);
    }
  }, [isFirstGuestVisit]);

  // Load public config (first intro appendix text) once
  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/config", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const v = typeof data.firstIntroAppendix === "string" ? data.firstIntroAppendix : "";
        setFirstIntroAppendix(v);
      })
      .catch(() => {
        // If config fails, we simply don't append anything.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Seed auto-demo text with default, then prefer server auto-prompt
  useEffect(() => {
    // Use hardcoded intro demo text
    setIntroDemoText(INTRO_DEMO_TEXT);
  }, []);

  const inferModeFromRoles = (roles: string[] | undefined | null): ScoutMode => {
    if (!roles || roles.length === 0) return "default";

    const normalized = roles.map((r) => {
      const raw = String(r || "").toLowerCase();
      if (raw === "owner" || raw === "head_admin") return "super_admin";
      return raw;
    });

    // Super-admins and operators get an admin-focused Scout persona.
    if (normalized.some((r) => ["admin", "ops_admin", "super_admin"].includes(r))) {
      return "admin";
    }

    if (normalized.some((r) => r.startsWith("contractor:") || r === "contractor" || r === "pro")) {
      return "contractors";
    }
    if (normalized.some((r) => r.startsWith("realtor:") || r === "realtor")) {
      return "marketplace";
    }
    return "default";
  };

  const hasAdminAccess = hasAdminUiAccess(user);
  const showEvolutionSurfaces = SCOUT_EVOLUTION_SURFACES_ENABLED && hasAdminAccess;

  // We no longer surface the separate "Trending" tab at the bottom; all
  // focus stays on the main Scout thread and input.

  const buildSmartSuggestions = (
    mode: ScoutMode,
    userMessage: string,
    serverSuggestions?: string[],
    opts?: {
      isFirstAnswer?: boolean;
      isGuest?: boolean;
      intent?: string;
      resolvedContext?: {
        stage?: string;
        blockingReason?: string | null;
        allowedActions?: string[];
      } | null;
      contextRoles?: string[];
    }
  ): string[] => {
    const base: string[] = [];
    const trimmed = userMessage.trim();
    const short = trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;

    switch (mode) {
      case "admin":
        base.push(
          "Open my Admin Panel and monitoring tools",
          "Show recent Finance / Invoicing ledger activity",
          "Help me send a targeted broadcast announcement from Notification Ops",
          "Open a floating note to keep this visible"
        );
        break;
      case "contractors":
        base.push(
          "Open my jobs workspace",
          "Create an invoice for this job",
          "View invoices and payments",
          "Post a new job",
          "Open a floating note to keep this visible"
        );
        break;
      case "marketplace":
        base.push(
          "Show Exchange listings that match this need near me",
          "Post a listing",
          "Manage my listings",
          "Open a floating note to keep this visible"
        );
        break;
      default:
        base.push(
          "Start a Direct Connect request for this",
          "Find local contractors or groups who can help with this",
          "Open a floating note to keep this visible"
        );
        break;
    }

    // If the inferred context includes HOA board signals, tailor a few options.
    const roles = (opts?.contextRoles || []).map((r) => r.toLowerCase());
    if (roles.includes("hoa_board")) {
      base.splice(
        0,
        base.length,
        "Open HOA dashboard",
        "Post HOA notice",
        "Review dues and payments"
      );
    }

    if (roles.includes("marketplace_vendor") || roles.includes("vendor")) {
      base.splice(0, base.length, "Manage my listings", "Post a listing", "View offers");
    }

    const server = (serverSuggestions ?? [])
      .filter(Boolean)
      .map((s) => sanitizeSuggestionLabel(String(s)))
      .filter((s) => s && !isWeakSuggestionLabel(s));
    const merged: string[] = [];

    for (const raw of base) {
      const s = sanitizeSuggestionLabel(raw);
      if (!s || isWeakSuggestionLabel(s)) continue;
      if (!merged.includes(s)) merged.push(s);
      if (merged.length === 3) return merged;
    }

    for (const s of server) {
      if (!merged.includes(s)) merged.push(s);
      if (merged.length === 3) return merged;
    }

    if (!merged.length && short) {
      merged.push(`Remember this for later and suggest my next move on: ${short}`);
    }
    return merged.slice(0, 3);
  };

  const handleSend = useCallback(
    async (value: string, explicitMode?: ScoutMode, _opts?: { isScriptedIntro?: boolean }) => {
      if (containsProfanity(value)) {
        const blocked: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: "That prompt isn't allowed. Please keep it respectful.",
          timestamp: new Date().toISOString(),
        };

        // Keep a censored draft in the input so the user can quickly edit.
        try {
          window.localStorage.setItem("scout:prefill:scout-main", censorProfanity(value));
        } catch {
          // ignore
        }
        setPrefillKey((k) => k + 1);
        applyServerResponse(blocked, []);
        return;
      }

      const rolesForRequest =
        (userRoles && userRoles.length > 0
          ? userRoles
          : sessionRole
            ? [sessionRole]
            : isGuest
              ? ["just-browsing"]
              : undefined) ?? undefined;

      // Context-aware roles: derive ephemeral roles based on message/page/signals
      const contextRoles = getContextRoles(value);
      const contextMode = deriveModeFromContextRoles(contextRoles as any);
      const mode: ScoutMode = explicitMode ?? contextMode ?? inferModeFromRoles(rolesForRequest);
      setActiveMode(mode);

      const start = performance.now();

      // User message is recorded into the thread; we immediately move into
      // a short RESOLVING_CONTEXT state so the UI can show progress without
      // exposing any internal reasoning text.
      recordUserMessage(value);
      // recordUserMessage already moves state into "resolving_context";
      // avoid a redundant status dispatch here.
      recordActivity({
        type: "ask_scout",
        ts: new Date().toISOString(),
        path: location,
        label: value.slice(0, 160),
      });

      // If a county explanation was recently shown, treat this as a
      // potential follow-up signal when it happens within the
      // five-minute window. This does not affect behavior.
      tryRecordCountyExplanationFollowup("scout_message", location);

      try {
        // ==================================================================
        // INTENT DETECTION: Check for onboarding, contractor, marketplace, or
        // support flows before falling back to the generic Scout endpoint.
        // ==================================================================
        const lowerMsg = value.toLowerCase();
        const normalized = lowerMsg.replace(/[^a-z0-9\s]/gi, " ");

        // ------------------------------------------------------------------
        // EXPLICIT NAV INTENT (high confidence; user asked to be routed)
        // ------------------------------------------------------------------
        const explicitNav = resolveExplicitNavigationIntent(value);
        if (explicitNav) {
          setStatus("ready");

          const msg = buildExplicitNavigationMessage(
            { to: explicitNav.to, label: explicitNav.label },
            { contextRoles }
          );

          applyServerResponse(msg, []);
          queueAutoRoute({
            to: explicitNav.to,
            label: explicitNav.label,
            confidence: explicitNav.confidence,
            why: "Explicit request",
          });
          setStatus("idle");
          return;
        }

        // ------------------------------------------------------------------
        // EXPLICIT PROFILE LOOKUP (route to the exact public profile when possible)
        // ------------------------------------------------------------------
        const normalizedExplicit = normalizeForMatch(value);
        const wantsProfileLookup =
          /^(go to|take me to|open|show me|navigate to)\b/.test(normalizedExplicit) &&
          /\bprofile\b/.test(normalizedExplicit) &&
          !/\bprofile settings\b/.test(normalizedExplicit);

        if (wantsProfileLookup) {
          const afterProfile = normalizedExplicit.split("profile")[1]?.trim() || "";
          const query = afterProfile.replace(/^(for|of)\s+/i, "").trim();

          if (query.length >= 3) {
            try {
              setStatus("executing_action");
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

              const targetTo = best?.slug
                ? `/u/${encodeURIComponent(best.slug)}`
                : fallbackToSearch;

              const msg: ScoutMessage = {
                id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                role: "assistant",
                content: best?.displayName
                  ? `I found ${best.displayName}.`
                  : "I couldn't find a public profile match for that yet.",
                timestamp: new Date().toISOString(),
                clusters: [
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
                ],
                navTarget: targetTo,
                memoryDelta: { lastIntent: "profile_lookup" },
                contextRoles,
              };

              applyServerResponse(msg, []);

              if (best?.slug) {
                queueAutoRoute({
                  to: targetTo,
                  label: best.displayName,
                  confidence: confident ? best.score : Math.min(0.84, best.score),
                  why: "Profile match",
                });
              }

              setStatus("idle");
              return;
            } catch {
              setStatus("idle");
              // fall through to normal flow
            }
          }
        }

        if (!hasLoggedConfusionRef.current) {
          const looksConfused =
            /why[^\n]*\b(see|locked|show)\b/.test(normalized) ||
            /\b(can't|cant|cannot)\b[^\n]*\bsee\b/.test(normalized);

          if (looksConfused) {
            recordActivity({
              type: "scout_confusion_location",
              ts: new Date().toISOString(),
              path: location,
              label: value.slice(0, 160),
              meta: { normalized: "why_cant_i_see" },
            });
            hasLoggedConfusionRef.current = true;
          }
        }

        // ------------------------------------------------------------------
        // EXPLANATION: "Why isn't this moving yet?"
        // Pure explanation + navigation. Does not change workflow behavior.
        // ------------------------------------------------------------------
        const mentionsRoute = /\b(route|routing|routed)\b/.test(normalized);
        const mentionsOpen = /\bopen request\b/.test(normalized);
        const mentionsNotRouted = /not routed yet/.test(normalized);
        const asksWhyRoute = /\bwhy\b/.test(normalized);

        const looksRoutingQuestion =
          (mentionsRoute || mentionsNotRouted || mentionsOpen) && asksWhyRoute;

        if (looksRoutingQuestion) {
          setStatus("ready");

          const helpLink = getHelpLink("directConnect");

          const bodyLines: string[] = [
            "Direct Connect only shares requests when the core details are complete so local pros get clear, serious work posts.",
            "",
            "Your request is currently saved as a draft and has not been shared yet.",
            "",
            "What to do next:",
            "- Open My requests and finish the basics (job type, location, budget).",
            "- If sharing is blocked, add a trade and county so Scout can find local matches.",
            "- If you no longer need it, cancel it and reopen later when ready.",
          ];

          const routingClusters: ScoutCluster[] = [
            {
              id: "direct-connect-routing-explainer",
              title: "Why your request is still in draft",
              kind: "generic",
              body: bodyLines.join("\n"),
              primaryAction: {
                type: "NAVIGATE",
                label: "Open Direct Connect guide",
                to: helpLink,
              },
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content:
              "Your request will be shared once the key details are complete so the right local providers can respond.",
            timestamp: new Date().toISOString(),
            clusters: routingClusters,
            navTarget: helpLink,
            memoryDelta: {
              lastIntent: "direct_connect_routing_explainer",
            },
            contextRoles,
          };

          applyServerResponse(msg, []);
          setStatus("idle");

          const latencyMs = performance.now() - start;
          logScoutInsight({
            message: value,
            mode,
            locality,
            success: true,
            latencyMs,
          });
          return;
        }

        // ------------------------------------------------------------------
        // EXPLANATION: "Why can't I message yet?"
        // This is a pure explanation + navigation branch. It does not
        // change any Direct Connect or messaging behavior; it only
        // explains the rule and links to the canonical guide.
        // ------------------------------------------------------------------
        const mentionsMessage = /\b(message|messaging)\b/.test(normalized);
        const hasCant = /\b(can't|cant|cannot)\b/.test(normalized);
        const mentionsLocked = /\b(locked|disabled|closed)\b/.test(normalized);
        const asksWhy = /\bwhy\b/.test(normalized);

        const looksMessagingLockedQuestion =
          mentionsMessage && (asksWhy || mentionsLocked || hasCant) && (hasCant || mentionsLocked);

        if (looksMessagingLockedQuestion) {
          setStatus("ready");

          const helpLink = getHelpLink("messaging");

          const bodyLines: string[] = [
            "TradeScout keeps messaging locked until a provider accepts the request. This prevents spam and keeps communication tied to a real match.",
            "",
            "Right now no provider has accepted this request yet, so messaging stays closed.",
            "",
            "What to do next:",
            "- Wait for a provider acceptance. Messaging opens automatically on that request.",
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

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content:
              "Messaging opens after a provider accepts your Direct Connect request. Until then, it stays locked to prevent spam and misalignment.",
            timestamp: new Date().toISOString(),
            clusters: messagingClusters,
            navTarget: helpLink,
            memoryDelta: {
              lastIntent: "messaging_locked_explainer",
            },
            contextRoles,
          };

          applyServerResponse(msg, []);
          setStatus("idle");

          const latencyMs = performance.now() - start;
          logScoutInsight({
            message: value,
            mode,
            locality,
            success: true,
            latencyMs,
          });
          return;
        }

        const contractorKeywords = [
          "contractor",
          "plumber",
          "electrician",
          "roofer",
          "hvac",
          "painter",
          "landscaper",
          "carpenter",
          "mason",
          "find a pro",
        ];
        const providerOfferKeywords = [
          "offer services",
          "offer my services",
          "get more work",
          "get more local jobs",
          "get more local leads",
          "use this to get jobs",
          "use this to get leads",
          "i want to offer services here",
          "set up my business here",
        ];
        const providerStandingKeywords = [
          "how strong is my presence",
          "how strong is my presence here",
          "how am i showing up here",
          "how visible am i here",
          "am i eligible to be promoted",
          "am i eligible to be featured",
        ];
        const providerPromotionKeywords = [
          "run a promotion",
          "run a promo",
          "run promo",
          "draft a promotion",
          "draft promo",
          "special offer",
          "discount campaign",
          "marketing campaign",
          "deal for my services",
          "deal for my business",
        ];
        const communityBuilderDonationKeywords = [
          "community builder donation",
          "county vault donation",
          "donate to county vault",
          "donate to the county vault",
          "donation pipeline",
          "submit a contribution",
          "propose a contribution",
          "community builder contribution",
          "vault contribution",
        ];
        const communityAnnouncementKeywords = [
          "community announcement",
          "post to community",
          "post in community",
          "announce to neighbors",
          "post to my neighbors",
          "neighborhood update",
          "neighbourhood update",
          "hoa notice",
          "hoa announcement",
          "community alert",
          "post to the feed",
          "post on the feed",
        ];
        const marketplaceKeywords = [
          "marketplace",
          "for sale",
          "buying",
          "selling",
          "used",
          "buy",
          "sell",
          "list",
          "post",
        ];
        const contactKeywords = [
          "contact support",
          "support ticket",
          "support tickets",
          "help desk",
          "help center",
          "customer support",
          "technical support",
          "reach out",
          "request support",
          "open support",
          "contact",
        ];
        const contactChannelKeywords = ["call", "phone", "text", "email"];
        const onboardingKeywords = [
          "get started",
          "start onboarding",
          "help me get started",
          "what should i do first",
          "onboard me",
          "orientation",
          "what do you want to get done right now",
        ];

        const wantsOnboarding =
          onboardingKeywords.some((kw) => lowerMsg.includes(kw)) ||
          lowerMsg.includes("__scout_onboarding__");
        const wantsContractor = contractorKeywords.some((kw) => lowerMsg.includes(kw));
        const wantsMarketplace = marketplaceKeywords.some((kw) => lowerMsg.includes(kw));
        const hasContactIntentKeyword = contactKeywords.some((kw) => {
          if (kw.includes(" ")) return normalized.includes(kw);
          return new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(normalized);
        });
        const hasContactChannelKeyword = contactChannelKeywords.some((kw) =>
          new RegExp(`\\b${kw}\\b`).test(normalized)
        );
        const hasSupportTarget = /\b(support|help|ticket|team|admin|tradescout|you)\b/.test(
          normalized
        );
        const wantsContact =
          hasContactIntentKeyword || (hasContactChannelKeyword && hasSupportTarget);
        const wantsProviderOffer = providerOfferKeywords.some((kw) => lowerMsg.includes(kw));
        const wantsProviderStanding = providerStandingKeywords.some((kw) => lowerMsg.includes(kw));
        const wantsProviderPromotion = providerPromotionKeywords.some((kw) =>
          lowerMsg.includes(kw)
        );
        const wantsCommunityBuilderDonation = communityBuilderDonationKeywords.some((kw) =>
          lowerMsg.includes(kw)
        );
        const wantsCommunityAnnouncement = communityAnnouncementKeywords.some((kw) =>
          lowerMsg.includes(kw)
        );

        // ------------------------------------------------------------------
        // SCOUT ONBOARDING INTENT (fast win)
        // ------------------------------------------------------------------
        if (wantsOnboarding) {
          setStatus("ready");

          const onboardingClusters: ScoutCluster[] = [
            {
              id: "onboarding-intent",
              title: "What are you here to do today?",
              kind: "generic",
              body: "Pick the fastest win that fits right now. You can always change paths later.",
              actions: [
                {
                  type: "PREFILL_INPUT",
                  label: "Start a Direct Connect request",
                  payload: {
                    text: "Help me start a Direct Connect request for this.",
                  },
                },
                {
                  type: "PREFILL_INPUT",
                  label: "Get more work",
                  payload: {
                    text: "Help me get more local jobs and leads.",
                  },
                },
                {
                  type: "PREFILL_INPUT",
                  label: "Explore community",
                  payload: {
                    text: "Show me community activity and groups near me.",
                  },
                },
                {
                  type: "PREFILL_INPUT",
                  label: "Just looking around",
                  payload: {
                    text: "I am just looking around - suggest a quick tour of TradeScout.",
                  },
                },
              ],
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content: "Let's pick your fastest next step.",
            timestamp: new Date().toISOString(),
            clusters: onboardingClusters,
            memoryDelta: { lastIntent: "scout_onboarding_prompt" },
            contextRoles,
          };

          applyServerResponse(msg, []);
          setStatus("idle");

          const latencyMs = performance.now() - start;
          logScoutInsight({
            message: value,
            mode,
            locality,
            success: true,
            latencyMs,
          });
          return;
        }

        // ------------------------------------------------------------------
        // PROVIDER INTENT A: "I want to offer services here"
        // ------------------------------------------------------------------
        if (wantsProviderOffer && hasCountyContext(locationCtx)) {
          setStatus("executing_action");

          // Resolve a likely trade from the message using the trades catalog
          let selectedTrade: { id: string; name: string; slug?: string } | null = null;
          try {
            const tradesRes = await fetch("/api/trades", { credentials: "include" });
            if (tradesRes.ok) {
              const trades = (await tradesRes.json()) as {
                id: string;
                name: string;
                slug?: string;
              }[];
              const msg = lowerMsg;
              const matchOrder = [
                { key: "plumb", test: (t: any) => /plumb/i.test(t.name || t.slug || "") },
                { key: "electric", test: (t: any) => /electric/i.test(t.name || t.slug || "") },
                { key: "roof", test: (t: any) => /roof/i.test(t.name || t.slug || "") },
                { key: "hvac", test: (t: any) => /hvac/i.test(t.name || t.slug || "") },
                { key: "paint", test: (t: any) => /paint/i.test(t.name || t.slug || "") },
                { key: "landscap", test: (t: any) => /landscap/i.test(t.name || t.slug || "") },
                { key: "carpent", test: (t: any) => /carpent/i.test(t.name || t.slug || "") },
                { key: "mason", test: (t: any) => /mason/i.test(t.name || t.slug || "") },
              ];

              for (const rule of matchOrder) {
                if (msg.includes(rule.key)) {
                  const found = trades.find(rule.test);
                  if (found) {
                    selectedTrade = found;
                    break;
                  }
                }
              }

              if (!selectedTrade && trades.length > 0) {
                selectedTrade = trades[0];
              }
            }
          } catch {
            // If trades lookup fails, we will fall back to navigation-only guidance
          }

          const countyFips = (locationCtx as any).countyFips as string | undefined;

          let requirementsSummary: string | undefined;

          // Best-effort: fetch requirements so the user knows what promotion will expect.
          if (selectedTrade && countyFips) {
            try {
              const requirements = await getProviderRequirements({
                tradeSlugs: selectedTrade.slug ? [selectedTrade.slug] : [],
                countyFips,
              });

              if (requirements && requirements.length > 0) {
                const r = requirements[0];
                const needs: string[] = [];
                if (r.requires.ein) needs.push("a business tax ID (EIN)");
                if (r.requires.license) needs.push("an active license");
                if (r.requires.insurance) needs.push("proof of insurance");

                if (needs.length > 0) {
                  requirementsSummary = `For ${r.trade.name} in this area, promotion usually expects ${needs.join(", ")}.`;
                } else {
                  requirementsSummary = `For ${r.trade.name} in this area, there are no extra business documents required before we can start promoting you.`;
                }
              }
            } catch {
              // If requirements call fails, continue with navigation-only guidance
            }
          }

          const clusters: ScoutCluster[] = [
            {
              id: "provider-offer-services-here",
              title: "Review provider profile",
              kind: "generic",
              body:
                requirementsSummary ||
                "I drafted updates to your provider profile. Review and confirm them before saving.",
              primaryAction: {
                type: "NAVIGATE",
                label: "Review profile",
                to: "/offer-services?review=1",
              },
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content: "I drafted your provider setup path. Review it before saving.",
            timestamp: new Date().toISOString(),
            clusters,
            navTarget: "/offer-services?review=1",
            memoryDelta: { lastIntent: "provider_offer_services" },
            contextRoles,
          };

          applyServerResponse(msg, []);
          setStatus("idle");
          return;
        }

        // ------------------------------------------------------------------
        // PROVIDER INTENT B: "How strong is my presence here?"
        // ------------------------------------------------------------------
        if (wantsProviderStanding && hasCountyContext(locationCtx)) {
          setStatus("executing_action");

          const countyFips = (locationCtx as any).countyFips as string | undefined;
          const countyName = (locationCtx as any).countyName || (locationCtx as any).county;
          const stateCode = (locationCtx as any).stateCode as string | undefined;

          let standing: ProviderStanding | null = null;
          if (countyFips) {
            try {
              standing = await getProviderStanding({ countyFips });
            } catch {
              standing = null;
            }
          }

          if (!standing) {
            const msg: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content:
                "I couldn't load your local standing right now. Open your provider setup to review your current status.",
              timestamp: new Date().toISOString(),
              clusters: [
                {
                  id: "provider-standing-unavailable",
                  title: "Provider setup",
                  kind: "generic",
                  primaryAction: {
                    type: "NAVIGATE",
                    label: "Open provider setup",
                    to: "/offer-services",
                  },
                },
              ],
              contextRoles,
            };

            applyServerResponse(msg, []);
            setStatus("idle");
            return;
          }

          const reachLabel = standing.reach.label;
          let reachText: string;
          if (reachLabel === "local_here") {
            reachText = "You're set up as a local provider for this county.";
          } else if (reachLabel === "regional_here") {
            reachText = "You're set up to serve this county as part of a broader region.";
          } else if (reachLabel === "nearby_not_listed_here") {
            reachText = "You're listed in nearby areas but not yet committed to this county.";
          } else {
            reachText = "You haven't fully set up your presence for this county yet.";
          }

          const a = standing.activity;
          const activityParts: string[] = [];
          if (a.jobsCompleted > 0) activityParts.push(`${a.jobsCompleted} jobs completed`);
          if (a.peopleHelped > 0) activityParts.push(`${a.peopleHelped} people helped`);
          if (a.activeWeeks > 0) activityParts.push(`active in ${a.activeWeeks} recent weeks`);
          const activitySummary =
            activityParts.length > 0
              ? `What we've seen so far: ${activityParts.join(", ")}.`
              : "We haven't seen much recorded activity for you here yet.";

          const blockers = standing.promotion;
          let promotionSummary: string;
          if (!blockers.blocked) {
            promotionSummary =
              "You're not blocked by any business requirements in this county. When your activity grows, we can highlight you more confidently.";
          } else if (blockers.reasons.length > 0) {
            promotionSummary = blockers.reasons.join(" ");
          } else {
            promotionSummary =
              "There are a few business requirements we still need on file before we can fully promote you here.";
          }

          const clusters: ScoutCluster[] = [
            {
              id: "provider-standing-overview",
              title:
                countyName && stateCode
                  ? `Your presence in ${countyName}, ${stateCode}`
                  : "Your presence here",
              kind: "generic",
              body: `${reachText}\n\n${activitySummary}\n\n${promotionSummary}`,
              primaryAction: {
                type: "NAVIGATE",
                label: "Review provider setup",
                to: "/offer-services",
              },
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content: "Here is your current provider standing for this county.",
            timestamp: new Date().toISOString(),
            clusters,
            navTarget: "/offer-services",
            memoryDelta: { lastIntent: "provider_standing" },
            contextRoles,
          };

          applyServerResponse(msg, []);
          setStatus("idle");

          const latencyMs = performance.now() - start;
          logScoutInsight({
            message: value,
            mode,
            locality,
            success: true,
            latencyMs,
          });
          return;
        }

        // ------------------------------------------------------------------
        // COMMUNITY BUILDER INTENT: donation + contribution flow
        // ------------------------------------------------------------------
        if (wantsCommunityBuilderDonation) {
          setStatus("ready");

          const countyName = (locationCtx as any)?.countyName || (locationCtx as any)?.county;
          const stateCode = (locationCtx as any)?.stateCode as string | undefined;
          const countyLabel =
            countyName && stateCode
              ? `${countyName}, ${stateCode}`
              : countyName
                ? String(countyName)
                : "your county";

          const clusters: ScoutCluster[] = [
            {
              id: "community-builder-donation-pipeline",
              title: "County Vault donation pipeline",
              kind: "generic",
              body: `Community Builder routes value into county vaults, not TradeScout revenue. Start by proposing a contribution, then complete donation checkout when your contribution is ready. County context: ${countyLabel}.`,
              actions: [
                {
                  type: "NAVIGATE",
                  label: "Propose contribution",
                  to: "/community-builder/contributions/new",
                },
                {
                  type: "NAVIGATE",
                  label: "Open Community Builder dashboard",
                  to: "/community-builder/dashboard",
                },
                {
                  type: "NAVIGATE",
                  label: "Open Foundation causes",
                  to: "/foundation",
                },
              ],
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content:
              "Understood. This is a county-vault donation flow. I'll route you to Community Builder contribution actions now.",
            timestamp: new Date().toISOString(),
            clusters,
            navTarget: "/community-builder/contributions/new",
            memoryDelta: {
              lastIntent: "community_builder_donation_pipeline",
            },
            contextRoles,
          };

          applyServerResponse(msg, []);
          setStatus("idle");

          const latencyMs = performance.now() - start;
          logScoutInsight({
            message: value,
            mode,
            locality,
            success: true,
            latencyMs,
          });
          return;
        }

        // ------------------------------------------------------------------
        // PROVIDER INTENT C: "Help me run a promotion/deal"
        // ------------------------------------------------------------------
        if (wantsProviderPromotion && hasCountyContext(locationCtx)) {
          setStatus("executing_action");

          const countyName = (locationCtx as any).countyName || (locationCtx as any).county;
          const stateCode = (locationCtx as any).stateCode as string | undefined;

          // Derive a concise title from the user's message.
          const singleLine = value.replace(/\s+/g, " ").trim();
          let title = "Local services promotion";
          if (singleLine.length > 0) {
            title = singleLine.length > 80 ? `${singleLine.slice(0, 77)}...` : singleLine;
          }

          // Heuristic discount extraction (percentage or fixed amount).
          const percentMatch = value.match(/(\d{1,3})\s*%/);
          const dollarMatch = value.match(/\$\s*(\d+(?:\.\d{1,2})?)/);

          let discountTypeForForm: "percentage" | "fixed_amount" | undefined;
          let discountValueForForm: string | undefined;
          if (percentMatch) {
            discountTypeForForm = "percentage";
            discountValueForForm = percentMatch[1];
          } else if (dollarMatch) {
            discountTypeForForm = "fixed_amount";
            discountValueForForm = dollarMatch[1];
          }

          // Default to a 30-day window starting today for the proposal.
          const nowDate = new Date();
          const startDateStr = nowDate.toISOString().split("T")[0];
          const endDate = new Date(nowDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          const endDateStr = endDate.toISOString().split("T")[0];

          const proposalPayload: PromotionProposalPayload = {
            title,
            description: value,
            category: "services",
            county: countyName,
            state: stateCode,
            startsAt: startDateStr,
            endsAt: endDateStr,
          };

          const proposal: PromotionProposal = proposePromotion(proposalPayload);

          // Build a prefilled contractor promo URL for review/publish.
          const params = new URLSearchParams();
          params.set("promoDraft", "1");
          params.set("title", title);
          if (proposalPayload.description) params.set("description", proposalPayload.description);
          // Reuse description as default offerDetails if none is provided explicitly.
          if (proposalPayload.description) params.set("offerDetails", proposalPayload.description);
          if (discountTypeForForm) params.set("discountType", discountTypeForForm);
          if (discountValueForForm) params.set("discountValue", discountValueForForm);
          if (proposalPayload.endsAt) params.set("expiresAt", proposalPayload.endsAt);

          const promoUrl = `/contractor-promos?${params.toString()}`;

          const summaryLines: string[] = [];
          if (countyName && stateCode) {
            summaryLines.push(`Service area: ${countyName}, ${stateCode}`);
          } else if (stateCode) {
            summaryLines.push(`Service area: ${stateCode}`);
          }
          if (discountTypeForForm && discountValueForForm) {
            const discountLabel =
              discountTypeForForm === "percentage"
                ? `${discountValueForForm}% off`
                : `$${discountValueForForm} off`;
            summaryLines.push(`Discount: ${discountLabel}`);
          }
          summaryLines.push(`Window: ${startDateStr} -> ${endDateStr}`);

          const clusters: ScoutCluster[] = [
            {
              id: "provider-promotion-draft",
              title: "Draft promotion ready to review",
              kind: "generic",
              body: summaryLines.join("\n"),
              primaryAction: {
                type: "NAVIGATE",
                label: "Review and publish",
                to: promoUrl,
              },
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content:
              countyName && stateCode
                ? `I drafted a promotion for your services in ${countyName}, ${stateCode}. Review it and publish when you're ready.`
                : "I drafted a promotion for your services. Review the details and publish when you're ready.",
            timestamp: new Date().toISOString(),
            clusters,
            navTarget: promoUrl,
            memoryDelta: {
              lastIntent: "provider_promotion_here",
            },
            contextRoles,
            toolResult: {
              tool: "promotion_proposal",
              success: true,
              data: proposal,
            },
          };

          applyServerResponse(msg, []);
          setStatus("idle");

          const latencyMs = performance.now() - start;
          logScoutInsight({
            message: value,
            mode,
            locality,
            success: true,
            latencyMs,
          });
          return;
        }

        // ------------------------------------------------------------------
        // COMMUNITY INTENT: "Help me post an announcement/update"
        // ------------------------------------------------------------------
        if (wantsCommunityAnnouncement && hasCountyContext(locationCtx)) {
          setStatus("executing_action");

          const countyName = (locationCtx as any).countyName || (locationCtx as any).county;
          const stateCode = (locationCtx as any).stateCode as string | undefined;

          const singleLine = value.replace(/\s+/g, " ").trim();
          const body = singleLine.length > 0 ? singleLine : "Community announcement for my area.";

          let postTypeForComposer: "alert" | "discussion" | "admin_notice" = "discussion";
          if (
            lowerMsg.includes("hoa") ||
            lowerMsg.includes("board") ||
            lowerMsg.includes("association")
          ) {
            postTypeForComposer = "admin_notice";
          } else if (
            lowerMsg.includes("alert") ||
            lowerMsg.includes("urgent") ||
            lowerMsg.includes("maintenance") ||
            lowerMsg.includes("closure") ||
            lowerMsg.includes("notice")
          ) {
            postTypeForComposer = "alert";
          }

          const proposalPayload: CommunityPostProposalPayload = {
            body,
            category: "announcements",
            scope: "county",
            county: countyName,
            state: stateCode,
          };

          const proposal: CommunityPostProposal = proposeCommunityPost(proposalPayload);

          const params = new URLSearchParams();
          params.set("postDraft", "1");
          params.set("content", body);
          params.set("postType", postTypeForComposer);

          const communityUrl = `/community?${params.toString()}`;

          const summaryLines: string[] = [];
          if (countyName && stateCode) {
            summaryLines.push(`Service area: ${countyName}, ${stateCode}`);
          } else if (stateCode) {
            summaryLines.push(`Service area: ${stateCode}`);
          }
          summaryLines.push("Scope: County community feed");

          const clusters: ScoutCluster[] = [
            {
              id: "community-announcement-draft",
              title: "Draft community post ready to review",
              kind: "generic",
              body: summaryLines.join("\n"),
              primaryAction: {
                type: "NAVIGATE",
                label: "Review and post",
                to: communityUrl,
              },
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content:
              countyName && stateCode
                ? `I drafted a community announcement for ${countyName}, ${stateCode}. Review it and post when you're ready.`
                : "I drafted a community announcement for your area. Review the details and post when you're ready.",
            timestamp: new Date().toISOString(),
            clusters,
            navTarget: communityUrl,
            memoryDelta: {
              lastIntent: "community_announcement_here",
            },
            contextRoles,
            toolResult: {
              tool: "community_post_proposal",
              success: true,
              data: proposal,
            },
          };

          applyServerResponse(msg, []);
          setStatus("idle");

          const latencyMs = performance.now() - start;
          logScoutInsight({
            message: value,
            mode,
            locality,
            success: true,
            latencyMs,
          });
          return;
        }

        // ------------------------------------------------------------------
        // CONTRACTOR SEARCH INTENT
        // ------------------------------------------------------------------
        if (wantsContractor && locality?.county && locality?.state) {
          setStatus("executing_action");

          // Extract trade from message (basic pattern matching)
          let trade = "general";
          if (lowerMsg.includes("plumber")) trade = "plumbing";
          else if (lowerMsg.includes("electrician")) trade = "electrical";
          else if (lowerMsg.includes("roofer") || lowerMsg.includes("roofing")) trade = "roofing";
          else if (lowerMsg.includes("hvac")) trade = "hvac";
          else if (lowerMsg.includes("painter") || lowerMsg.includes("painting"))
            trade = "painting";
          else if (lowerMsg.includes("landscap")) trade = "landscaping";
          else if (lowerMsg.includes("carpenter") || lowerMsg.includes("carpentry"))
            trade = "carpentry";
          else if (lowerMsg.includes("mason")) trade = "masonry";

          const extractContractorNameQuery = () => {
            const quoted = value.match(/"([^"]{3,80})"/);
            if (quoted && quoted[1]) return quoted[1].trim();

            const called = value.match(/\b(named|called)\s+([^,.#\n]{3,80})/i);
            if (called && called[2]) return called[2].trim();

            const k =
              /(contractor|contractors|roofer|roofing|plumber|plumbing|electrician|electrical|hvac|painter|painting|landscaper|landscaping)\b/i;
            const m = value.match(k);
            if (!m) return null;

            const matchIndex = m.index;
            if (typeof matchIndex !== "number") return null;

            const after = value.slice(matchIndex + m[0].length).trim();
            if (!after) return null;
            // Stop at common location delimiters
            const stop = after.split(/\b(in|near|around)\b/i)[0].trim();
            // Remove leading filler words
            const cleaned = stop.replace(/^(a|an|the|some|any|my)\s+/i, "").trim();
            return cleaned.length >= 3 ? cleaned : null;
          };

          const nameQuery = extractContractorNameQuery();

          const contractorResult = await searchContractors({
            query: nameQuery || undefined,
            trade,
            county: locality.county,
            state: locality.state,
            limit: nameQuery ? 10 : 5,
          });

          if (
            contractorResult.success &&
            Array.isArray(contractorResult.data) &&
            contractorResult.data.length > 0
          ) {
            const contractors: ContractorResult[] = contractorResult.data;

            let bestMatch: { contractor: ContractorResult; score: number } | null = null;
            if (nameQuery) {
              const scored = contractors
                .map((c) => ({ contractor: c, score: tokenOverlapScore(nameQuery, c.name) }))
                .sort((a, b) => b.score - a.score);
              if (scored.length > 0) bestMatch = scored[0];
            }

            const secondBestScore =
              nameQuery && contractors.length > 1
                ? (contractors
                    .map((c) => tokenOverlapScore(nameQuery, c.name))
                    .sort((a, b) => b - a)[1] ?? 0)
                : 0;

            const bestMatchScore = bestMatch?.score ?? 0;
            const bestMatchContractor = bestMatch?.contractor;
            const bestMatchNavTarget =
              bestMatchContractor?.profileUrl ||
              (bestMatchContractor ? `/contractors/${bestMatchContractor.id}` : "/direct-connect");
            const shouldAutoToProfile =
              Boolean(nameQuery) &&
              bestMatchScore >= 0.9 &&
              (contractors.length === 1 || bestMatchScore - secondBestScore >= 0.08);

            const contractorClusters: ScoutCluster[] = contractors.slice(0, 3).map((c) => ({
              id: `contractor-${c.id}`,
              title: `${c.name} - ${c.trade}`,
              kind: "generic",
              body: `Trust (CVS): ${(c as any).cvsScore ?? (c as any).cvs ?? (c as any).rating ?? "pending"} · ${(c as any).recommendationCount ?? (c as any).recommendationsCount ?? (c as any).reviewCount ?? 0} recs\n${c.location}\n${c.availability || "Availability unknown"}`,
              primaryAction: {
                type: "NAVIGATE",
                label: "View profile",
                to: c.profileUrl || `/contractors/${c.id}`,
              },
            }));

            let contractorClustersWithCtas = contractorClusters;

            // If server has returned CTA hints (e.g., related trade_deals or community_posts),
            // attach them to these contractor result clusters as well.
            if (
              Array.isArray((contractorResult as any).ctaHints) &&
              (contractorResult as any).ctaHints.length > 0
            ) {
              contractorClustersWithCtas =
                applyCtasToClusters(contractorClusters, {
                  hints: ((contractorResult as any).ctaHints as any[]).map((h) => ({
                    type: h.type,
                    id: h.id,
                    ownerUserId: h.ownerUserId ?? undefined,
                    authorId: h.authorId ?? undefined,
                    canDirectConnect: h.canDirectConnect,
                    canMessage: h.canMessage,
                    label: h.label,
                  })) as ScoutCtaHint[],
                }) || contractorClusters;
            }

            const msgBase: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content: nameQuery
                ? `I searched ${trade} contractors near ${locality.county}, ${locality.state} for "${nameQuery}". Here are the closest matches:`
                : `Found ${contractors.length} ${trade} contractors near ${locality.county}, ${locality.state}. Here are the top matches:`,
              timestamp: new Date().toISOString(),
              clusters: contractorClustersWithCtas,
              navTarget: shouldAutoToProfile ? bestMatchNavTarget : "/direct-connect",
              memoryDelta: {
                lastViewedTrade: trade,
                lastIntent: "find_contractors",
              },
              contextRoles: getContextRoles(value),
              toolResult: {
                tool: "searchContractors",
                success: true,
                data: contractors,
                durationMs: contractorResult.telemetry?.durationMs,
              },
            };

            const msg = msgBase;
            applyServerResponse(msg, []);

            if (shouldAutoToProfile && bestMatchContractor) {
              queueAutoRoute({
                to: msg.navTarget || "/direct-connect",
                label: bestMatchContractor.name,
                confidence: bestMatchScore,
                why: "Name match",
              });
            }
            setStatus("idle");

            const latencyMs = performance.now() - start;
            logScoutInsight({
              message: value,
              mode,
              locality,
              success: true,
              latencyMs,
            });
            return;
          } else {
            // No contractors found
            const msg: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content: `I couldn't find any ${trade} contractors in ${locality.county}, ${locality.state} right now. Try creating a Direct Connect request so providers in this trade can raise their hand, or ask me about a different trade.`,
              timestamp: new Date().toISOString(),
              clusters: [
                {
                  id: "direct-connect-request",
                  title: "Create a Direct Connect request",
                  kind: "generic",
                  primaryAction: {
                    type: "NAVIGATE",
                    label: "Open",
                    to: "/direct-connect",
                  },
                },
              ],
            };
            applyServerResponse(msg, []);
            setStatus("idle");
            return;
          }
        }

        // ------------------------------------------------------------------
        // MARKETPLACE INTENT: search vs post
        // ------------------------------------------------------------------
        if (wantsMarketplace && locality?.state) {
          setStatus("executing_action");
          // Determine if the user is trying to post a listing (sell/list/post)
          const wantsPost = /\b(post|list|sell|for sale)\b/i.test(value);

          if (wantsPost) {
            // Extract basic fields from the free-form message
            const priceMatch = value.match(/\$\s*(\d+(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\b/);
            const price = priceMatch ? Number(priceMatch[1] || priceMatch[2]) : 0;
            // Title heuristic: remove common verbs, take a short slice
            const cleaned = value
              .replace(
                /\b(post|list|sell|for sale|please|help|i want to|i'd like to|i would like to)\b/gi,
                ""
              )
              .trim();
            const title = cleaned.split(/\s+/).slice(0, 10).join(" ") || "My item";
            // Build a pure listing proposal; no writes, no API calls.
            const proposal: MarketplaceListingProposal = proposeMarketplaceListing({
              title,
              description: cleaned,
              price: price > 0 ? price : undefined,
            });

            // Route user to Exchange sell tab with prefilled fields.
            const params = new URLSearchParams();
            params.set("tab", "sell");
            params.set("title", title);
            if (cleaned) params.set("description", cleaned);
            if (price > 0) params.set("price", String(price));

            // Best-effort location prefill, using committed locality only.
            if (locality.county && locality.state) {
              params.set("loc", `${locality.county}, ${locality.state}`);
            } else if (locality.state) {
              params.set("loc", String(locality.state));
            }

            const listingUrl = `/exchange?${params.toString()}`;

            const msg: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content: `I drafted a listing for "${title}" based on what you described. Review it in Exchange and confirm before it goes live.`,
              timestamp: new Date().toISOString(),
              clusters: [
                {
                  id: "post-listing",
                  title: "Review draft listing",
                  kind: "generic",
                  body: price > 0 ? `$${price}` : undefined,
                  primaryAction: {
                    type: "NAVIGATE",
                    label: "Open Exchange",
                    to: listingUrl,
                  },
                },
                {
                  id: "manage-listings",
                  title: "Manage my listings",
                  kind: "generic",
                  primaryAction: {
                    type: "NAVIGATE",
                    label: "Open",
                    to: "/exchange?tab=my-listings",
                  },
                },
              ],
              navTarget: listingUrl,
              memoryDelta: {
                lastIntent: "marketplace_post",
              },
              contextRoles: getContextRoles(value),
              toolResult: {
                tool: "marketplace_listing_proposal",
                success: true,
                data: proposal,
              },
            };

            applyServerResponse(msg, []);
            setStatus("idle");

            const latencyMs = performance.now() - start;
            logScoutInsight({ message: value, mode, locality, success: true, latencyMs });
            return;
          }

          // Otherwise, run a marketplace search
          const marketplaceResult = await searchMarketplace({
            query: value,
            location: locality.state,
            limit: 5,
          });
          if (
            marketplaceResult.success &&
            Array.isArray(marketplaceResult.data) &&
            marketplaceResult.data.length > 0
          ) {
            const listings: MarketplaceResult[] = marketplaceResult.data;
            const listingClusters: ScoutCluster[] = listings.slice(0, 3).map((l) => ({
              id: `listing-${l.id}`,
              title: l.title,
              kind: "generic",
              body: `$${l.price}${l.condition ? ` - ${l.condition}` : ""}\n${l.location}\n${l.sellerName}${l.verified ? " (verified)" : ""}`,
              primaryAction: {
                type: "NAVIGATE",
                label: "View listing",
                to: l.listingUrl || `/exchange/${l.id}`,
              },
            }));

            const msg: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content: `Found ${listings.length} marketplace listings matching "${value}". Here are the top results:`,
              timestamp: new Date().toISOString(),
              clusters: listingClusters,
              navTarget: "/exchange",
              memoryDelta: { lastIntent: "marketplace_search" },
              contextRoles: getContextRoles(value),
              toolResult: {
                tool: "searchMarketplace",
                success: true,
                data: listings,
                durationMs: marketplaceResult.telemetry?.durationMs,
              },
            };

            applyServerResponse(msg, []);
            setStatus("idle");

            const latencyMs = performance.now() - start;
            logScoutInsight({ message: value, mode, locality, success: true, latencyMs });
            return;
          }
        }

        // ------------------------------------------------------------------
        // CONTACT SUPPORT INTENT
        // ------------------------------------------------------------------
        if (wantsContact) {
          setStatus("ready");

          const contactClusters: ScoutCluster[] = [
            {
              id: "contact-request",
              title: "Request Support",
              kind: "generic",
              body: "Start a tracked support request in TradeScout.",
              primaryAction: {
                type: "NAVIGATE",
                label: "Open Support Tickets",
                to: "/support-tickets",
              },
            },
            {
              id: "contact-help-center",
              title: "Help Center",
              kind: "generic",
              body: "Quick answers for setup, jobs, and account actions.",
              primaryAction: {
                type: "NAVIGATE",
                label: "Open Help",
                to: "/help",
              },
            },
            {
              id: "contact-request-quote",
              title: "Request Quote",
              kind: "generic",
              body: "Need project help? Send one request and route it through Scout.",
              primaryAction: {
                type: "NAVIGATE",
                label: "Open Request Quote",
                to: "/request-quote",
              },
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content: "Choose the fastest support path:",
            timestamp: new Date().toISOString(),
            clusters: contactClusters,
            memoryDelta: {
              lastIntent: "contact_support",
            },
            contextRoles: getContextRoles(value),
          };

          applyServerResponse(msg, []);
          setStatus("idle");

          const latencyMs = performance.now() - start;
          logScoutInsight({
            message: value,
            mode,
            locality,
            success: true,
            latencyMs,
          });
          return;
        }

        // ==================================================================
        // FALLBACK: Use existing server flow if no intent matched
        // ==================================================================
        // Unified router assist (situation + trust + tone) is production-gated.
        if (showEvolutionSurfaces) {
          try {
            const resolve = await UnifiedScoutRouterClient.resolveIntent(
              value,
              {
                userId:
                  typeof (user as any)?.id === "string" ? String((user as any).id) : undefined,
                isAuthenticated: Boolean(isAuthenticated),
                userRole:
                  typeof (user as any)?.role === "string"
                    ? String((user as any).role)
                    : sessionRole || undefined,
                location: {
                  county: locality?.county,
                  state: locality?.state,
                  region: undefined,
                },
                trustLevel: undefined,
              },
              {
                situation: {
                  activeObjectives: activeObjective
                    ? [
                        {
                          id: activeObjective.id,
                          title: activeObjective.title,
                          intentClass: activeObjective.intentClass,
                          status: activeObjective.status,
                          progressPct: objectiveStatusToProgress(activeObjective.status),
                          updatedAt: activeObjective.updatedAt,
                        },
                      ]
                    : [],
                  recentEvents: state.messages.slice(-6).map((m) => ({
                    type: m.role === "assistant" ? "action_success" : "message_sent",
                    timestamp: m.timestamp,
                  })),
                  urgencySignals: [
                    {
                      source: "direct_user_signal",
                      level: /urgent|asap|today|now/i.test(value) ? 3 : 2,
                    },
                  ],
                  now: new Date().toISOString(),
                },
                trust: {
                  userId:
                    typeof (user as any)?.id === "string" ? String((user as any).id) : undefined,
                  countyFips:
                    typeof (user as any)?.countyFips === "string"
                      ? String((user as any).countyFips)
                      : typeof (user as any)?.county_fips === "string"
                        ? String((user as any).county_fips)
                        : undefined,
                  cvsScore:
                    typeof (user as any)?.cvsScore === "number"
                      ? Number((user as any).cvsScore)
                      : typeof (user as any)?.trustScore === "number"
                        ? Number((user as any).trustScore)
                        : null,
                  verificationStatus:
                    typeof (user as any)?.verificationStatus === "string"
                      ? ((user as any).verificationStatus as any)
                      : "unknown",
                  riskFlags: [],
                },
                tone: {
                  scenario: "next_step_prompt",
                  countyLabel: locality?.county,
                  roleLabel:
                    typeof (user as any)?.role === "string"
                      ? String((user as any).role)
                      : sessionRole || undefined,
                  includeNextStep: true,
                },
              }
            );

            if (resolve) {
              setRoutingDecisionCard(resolve);
            } else {
              setRoutingDecisionCard(null);
            }
          } catch {
            setRoutingDecisionCard(null);
          }
        } else {
          setRoutingDecisionCard(null);
        }

        // Once we start building the server payload and hitting /api/scout,
        // switch to CHECKING_DOCUMENTS to drive the loader animation.
        setStatus("checking_documents");
        const recentActivity = getRecentActivity();
        const shownAdIds = getSeenAdIds();

        const res = await sendToScout({
          history: state.messages.map((m) => ({ role: m.role, content: m.content })),
          message: value,
          locality,
          mode,
          intent: urlIntent,
          knowledgeMode: "local-first",
          roles: rolesForRequest,
          recentActivity,
          shownAdIds,
        });

        // Backend has responded; we are now preparing the
        // final Scout answer and actions on the client.
        // This maps to the READY phase for the progress UI.
        setStatus("ready");

        const isFirstAnswer = !hasSeenFirstAnswer();

        const smartSuggestions = buildSmartSuggestions(mode, value, res.suggestedActions, {
          isFirstAnswer,
          isGuest,
          intent: res.metadata?.intent,
          resolvedContext: res.metadata?.resolvedContext ?? null,
          contextRoles,
        });

        let clusters: ScoutCluster[] = [];

        // Sponsored/affiliate guardrails:
        // - never on the first real Scout answer
        const allowSponsoredClientSide =
          !isFirstAnswer && hasSeenFirstAnswer() && canShowAnotherSponsored();

        if (allowSponsoredClientSide && res.sponsored?.id) {
          const bodyLines = [res.sponsored.title, res.sponsored.content].filter(Boolean);
          const body = bodyLines.join("\n\n");
          clusters.push({
            id: `sponsored-${res.sponsored.id}`,
            title: "Sponsored",
            kind: "generic",
            body,
            primaryAction: res.sponsored.linkUrl
              ? {
                  type: "NAVIGATE",
                  label: res.sponsored.isAffiliate ? "View offer" : "Learn more",
                  to: res.sponsored.linkUrl,
                  payload: { adId: res.sponsored.id },
                }
              : undefined,
            // Minimal feedback affordance rendered as secondary actions
            secondaryActions: [
              {
                type: "CALL_TOOL",
                name: "ads.feedback",
                args: { adId: res.sponsored.id, rating: "helpful", source: "scout" },
                label: "Helpful",
              },
              {
                type: "CALL_TOOL",
                name: "ads.feedback",
                args: { adId: res.sponsored.id, rating: "not_relevant", source: "scout" },
                label: "Not relevant",
              },
              {
                type: "CALL_TOOL",
                name: "ads.feedback",
                args: { adId: res.sponsored.id, rating: "spam", source: "scout" },
                label: "Spam",
              },
            ],
          } as any);
          markAdSeen(res.sponsored.id);
        }

        // If the backend response reads like a generic template or provides a known
        // template frame, attach a concrete, pre-filled draft so the user leaves
        // with something actionable immediately.
        const looksLikeGenericTemplate =
          typeof res.message === "string" &&
          /template\s+for\s+a\s+quote\s+request/i.test(res.message);
        const hasTemplateFrame =
          typeof res.frame?.templateId === "string" && res.frame.templateId.trim().length > 0;
        const prefilledDraft =
          looksLikeGenericTemplate || hasTemplateFrame ? buildAutoFilledDraft(value) : null;

        if (prefilledDraft) {
          clusters.push({
            id: `prefilled-draft-${Date.now()}`,
            title: "Pre-filled request",
            kind: "generic",
            body: prefilledDraft,
            actions: [
              {
                type: "PREFILL_INPUT",
                label: "Edit and send",
                payload: { text: prefilledDraft },
              },
              {
                type: "OPEN_FLOATING_NOTE",
                label: "Open a floating note",
                payload: { noteId: "quick" },
              },
            ],
          });
        }

        if (isFirstAnswer) {
          clusters.push({
            id: "first-nav-contractors",
            title: "Browse local professionals",
            kind: "generic",
            primaryAction: {
              type: "NAVIGATE",
              label: "Open",
              to: ROUTES.CONTRACTORS,
            },
          });

          if (isGuest) {
            clusters.push({
              id: "first-account-prompt",
              title: "Save your area and requests",
              kind: "generic",
              body: "Create a free account so Scout can remember your area and keep your Direct Connect requests synced.",
              actions: [
                {
                  type: "NAVIGATE",
                  label: "Create account",
                  to: ROUTES.REGISTER,
                },
                { type: "NOOP", label: "Keep exploring with Scout" },
              ],
            });
          }
        }

        // Attach server-returned actions as explicit user-clickable chips.
        if (res.actions && res.actions.length > 0) {
          // If the server already gave actions, avoid adding extra "first answer" blocks
          // that repeat the same navigation intent.
          clusters = clusters.filter(
            (c) => c.id !== "first-nav-contractors" && c.id !== "first-account-prompt"
          );
          clusters.push({
            id: `server-actions-${Date.now()}`,
            title: "Actions",
            kind: "generic",
            actions: res.actions.map((a) => ({
              ...a,
              label: a.label || (typeof a.type === "string" ? a.type.replace(/_/g, " ") : "Action"),
            })),
          });
        }

        // Keep Scout's very first answer tight so it never feels
        // like a wall of text or gets visually "cut off" behind
        // navigation. This is a hard character cap, tuned for the
        // current layout. Onboarding answers should feel like a lead-in
        // to action tiles, not an essay.
        const MAX_FIRST_MESSAGE_CHARS = 280;

        // CRITICAL: Sanitize the message to remove any internal reasoning leakage
        const sanitized = sanitizeScoutMessage(res.message);

        const disciplined =
          typeof sanitized === "string"
            ? enforceShortIntentDiscipline(value, sanitized, res.metadata?.intent)
            : sanitized;

        const enrichedContent =
          prefilledDraft && typeof disciplined === "string"
            ? `${disciplined}\n\nHere's your pre-filled request (ready to send):\n${prefilledDraft}`
            : disciplined;

        const finalContent =
          isFirstAnswer &&
          typeof enrichedContent === "string" &&
          enrichedContent.length > MAX_FIRST_MESSAGE_CHARS
            ? `${enrichedContent.slice(0, MAX_FIRST_MESSAGE_CHARS).trimEnd()}...`
            : enrichedContent;

        const preliminaryContent =
          typeof finalContent === "string" && finalContent.trim().length > 0
            ? finalContent
            : "I'm here and ready. Choose an action below or ask me for the next step.";

        const hasActionOptions =
          (Array.isArray(res.actions) && res.actions.length > 0) ||
          (Array.isArray(clusters) && clusters.length > 0);

        const resolvedContent = enforceResponseQualityContract({
          userMessage: value,
          content: preliminaryContent,
          hasActionOptions,
        });

        // Guardrail: if Scout falls into repeated generic fallback language
        // without actions, force a concrete recovery response with explicit paths.
        const previousAssistant = [...state.messages]
          .reverse()
          .find((m) => m.role === "assistant")?.content;
        const repeatedResponse =
          normalizeForRepetitionCheck(previousAssistant || "") !== "" &&
          normalizeForRepetitionCheck(previousAssistant || "") ===
            normalizeForRepetitionCheck(resolvedContent);
        const genericRoutingFallback =
          /having trouble generating a full answer|seeing heavy demand right now|route you to the right next step|which option should i run first|tradescout can still route the strongest next step|tradescout can help move local work forward|what should i help you with next/i.test(
            resolvedContent
          );

        if (!hasActionOptions && (repeatedResponse || genericRoutingFallback)) {
          const { message: fallbackMessage, actions: fallbackActions } = buildConnectionFallback(
            {
              contractorsRoute: "/direct-connect/pros",
              communityRoute: "/community",
              exchangeRoute: "/exchange",
            },
            value,
            { contextRoles: getContextRoles(value) }
          );

          applyServerResponse(fallbackMessage, fallbackActions);
          setToneMessage(null);
          setStatus("idle");

          const latencyMs = performance.now() - start;
          logScoutInsight({
            message: value,
            mode,
            locality,
            success: true,
            latencyMs,
          });
          return;
        }

        // Attach CTA hints from server (community posts, trade deals, etc.)
        if (Array.isArray(res.ctaHints) && res.ctaHints.length > 0) {
          clusters =
            applyCtasToClusters(clusters, {
              hints: res.ctaHints.map((h) => ({
                type: h.type,
                id: h.id,
                ownerUserId: h.ownerUserId ?? undefined,
                authorId: h.authorId ?? undefined,
                canDirectConnect: h.canDirectConnect,
                canMessage: h.canMessage,
                label: h.label,
              })) as ScoutCtaHint[],
            }) || clusters;
        }

        const msg: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: resolvedContent,
          timestamp: res.timestamp || new Date().toISOString(),
          suggestedActions: smartSuggestions,
          overrideOption: res.overrideOption,
          clusters: clusters.length ? clusters : undefined,
          frame: res.frame,
          contextRoles: getContextRoles(value),
          navTarget: Array.isArray(res.actions)
            ? (() => {
                const nav = res.actions.find(
                  (a) =>
                    a &&
                    a.type === "NAVIGATE" &&
                    (typeof a.to === "string" || typeof a.path === "string")
                );
                return (nav?.to as string) || (nav?.path as string) || undefined;
              })()
            : undefined,
          provenance: buildScoutProvenance(res),
        };

        applyServerResponse(msg, res.actions);

        if (showEvolutionSurfaces) {
          try {
            const toneRes = await fetch("/api/scout/tone/build", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scenario:
                  res.metadata?.resolvedContext?.confidence === "low"
                    ? "confidence_low"
                    : "next_step_prompt",
                message: msg.content,
                countyLabel: locality?.county,
                roleLabel:
                  typeof (user as any)?.role === "string"
                    ? String((user as any).role)
                    : sessionRole || undefined,
                confidenceBand:
                  res.metadata?.resolvedContext?.confidence === "low" ||
                  res.metadata?.resolvedContext?.confidence === "medium" ||
                  res.metadata?.resolvedContext?.confidence === "high"
                    ? res.metadata.resolvedContext.confidence
                    : "medium",
                includeNextStep: true,
                nextStepLabel: msg.navTarget ? "Open next step" : "Continue in Scout",
                nextStepRoute: msg.navTarget || "/scout",
              }),
            });

            if (toneRes.ok) {
              const built = await toneRes.json();
              setToneMessage({
                message: String(built?.message || ""),
                scenario: built?.scenario,
                toneScore: typeof built?.toneScore === "number" ? built.toneScore : undefined,
                guardrailFlags: Array.isArray(built?.guardrailFlags)
                  ? built.guardrailFlags
                  : undefined,
                confidenceBand:
                  res.metadata?.resolvedContext?.confidence === "low" ||
                  res.metadata?.resolvedContext?.confidence === "medium" ||
                  res.metadata?.resolvedContext?.confidence === "high"
                    ? res.metadata.resolvedContext.confidence
                    : undefined,
              });
            } else {
              setToneMessage(null);
            }
          } catch {
            setToneMessage(null);
          }
        } else {
          setToneMessage(null);
        }

        // Persist a lightweight "resume" snapshot so other surfaces can offer a
        // single-click "continue in Scout" affordance without the user having to
        // hunt for the last thread.
        if (user) {
          const nav = Array.isArray(res.actions)
            ? res.actions.find(
                (a) =>
                  a &&
                  a.type === "NAVIGATE" &&
                  (typeof a.to === "string" || typeof a.path === "string")
              )
            : undefined;
          const suggestedTo = (nav?.to as string) || (nav?.path as string) || msg.navTarget || null;
          const suggestedLabel =
            (nav?.label as string) || (suggestedTo ? "Continue" : "Open Scout");

          void persistScoutResume({
            resume: {
              prompt: value,
              intent: res.metadata?.intent || urlIntent || undefined,
              suggestedTo,
              suggestedLabel,
              mode,
              locality: {
                county: locality?.county,
                state: locality?.state,
                zip: locality?.zip,
              },
              updatedAt: new Date().toISOString(),
              knowledgeLayer: res.knowledge?.layer,
            },
          });
        }

        // Auto-route: only when Scout provides a NAVIGATE action with high confidence.
        if (Array.isArray(res.actions)) {
          const nav = res.actions.find(
            (a) =>
              a && a.type === "NAVIGATE" && (typeof a.to === "string" || typeof a.path === "string")
          );
          const navTo = (nav?.to as string) || (nav?.path as string) || null;
          const confidence = confidenceLabelToScore(res.metadata?.resolvedContext?.confidence) || 0;

          if (navTo && confidence >= AUTO_ROUTE_MIN_CONFIDENCE) {
            queueAutoRoute({
              to: navTo,
              label: nav?.label || "Next step",
              confidence,
              why: "Scout identified a high-confidence next step",
            });
          }
        }

        if (!hasSeenFirstAnswer()) {
          markFirstAnswerSeen();
        }

        // One-time, neutral explanation of why county matters.
        // This runs only after we have a committed county and the
        // user has seen at least one full Scout answer. It does not
        // ask the user to change anything; it simply explains the
        // system rule once and then marks a local flag.
        try {
          const alreadyExplained =
            typeof window !== "undefined" &&
            window.localStorage.getItem(COUNTY_EXPLAINED_KEY) === "1";

          const responseUsedFallback =
            Boolean(res.metadata?.fallbackUsed) || Boolean(res.metadata?.degradationReason);

          if (countyCommitted && !alreadyExplained && !responseUsedFallback) {
            const explanation: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content:
                "Behind the scenes, TradeScout uses your saved home location as the single source of truth for what counts as local. This powers your community feed, marketplace, HOA tools, and leaderboards. You can change it anytime in Settings → Home Location.",
              timestamp: new Date().toISOString(),
            };

            applyServerResponse(explanation, []);

            if (typeof window !== "undefined") {
              window.localStorage.setItem(COUNTY_EXPLAINED_KEY, "1");
              window.localStorage.setItem(COUNTY_EXPLAINED_AT_KEY, String(Date.now()));
              window.localStorage.removeItem(COUNTY_EXPLAINED_FOLLOWUP_KEY);
            }

            recordActivity({
              type: "county_explained_shown",
              ts: new Date().toISOString(),
              path: location,
              meta: { countyCommitted: true },
            });
          }
        } catch {
          // If storage is unavailable, silently skip the explanation flag.
        }

        // NOTE: do not auto-execute server actions; show them as chips instead.

        const latencyMs = performance.now() - start;
        logScoutInsight({
          message: value,
          mode,
          locality,
          success: true,
          latencyMs,
        });
      } catch (err: any) {
        const latencyMs = performance.now() - start;
        const { message: fallback, actions: fallbackActions } = buildConnectionFallback(
          {
            contractorsRoute: ROUTES.CONTRACTORS ?? "/contractors",
            communityRoute: ROUTES.COMMUNITY ?? "/community",
            exchangeRoute: ROUTES.EXCHANGE ?? "/exchange",
          },
          value,
          { contextRoles: getContextRoles(value) }
        );

        applyServerResponse(fallback, fallbackActions);
        logScoutInsight({
          message: value,
          mode,
          locality,
          success: false,
          latencyMs,
          error: err.message || "Unknown error",
        });
      } finally {
        await refreshObjective();
        setStatus("idle");
      }
    },
    [
      applyServerResponse,
      buildSmartSuggestions,
      firstIntroAppendix,
      isAuthenticated,
      isGuest,
      persistScoutResume,
      locality,
      location,
      navigate,
      recordUserMessage,
      sessionRole,
      setPrefillKey,
      state.messages,
      queueAutoRoute,
      refreshObjective,
      showEvolutionSurfaces,
      activeObjective,
      user,
      userRoles,
    ]
  );

  /**
   * Handle onboarding answer/skip via unified sendMessage pattern
   * Server controls everything; client just sends payload
   */
  const handleOnboardingMessage = useCallback(
    async (payload: {
      onboardingAnswer: {
        sessionId: string;
        questionKey: string;
        value?: string;
        skipped?: boolean;
      };
    }) => {
      try {
        const rolesForRequest =
          (userRoles && userRoles.length > 0
            ? userRoles
            : sessionRole
              ? [sessionRole]
              : isGuest
                ? ["just-browsing"]
                : undefined) ?? undefined;

        setStatus("checking_documents");
        const recentActivity = getRecentActivity();
        const shownAdIds = getSeenAdIds();

        const { sessionId, questionKey, value, skipped } = payload.onboardingAnswer;

        const res = await sendToScout({
          history: state.messages.map((m) => ({ role: m.role, content: m.content })),
          message: skipped ? "skip" : value || "",
          locality,
          mode: "general" as any,
          roles: rolesForRequest,
          recentActivity,
          shownAdIds,
          sessionId,
          onboardingAnswer: skipped ? "skip" : value,
          onboardingQuestionKey: questionKey as "Q1" | "Q2" | "Q3" | "Q4",
        });

        setStatus("ready");

        // Record user interaction (for history)
        if (!skipped && value) {
          recordUserMessage(value);
        }

        // Apply server response (includes next question or expiration)
        const msg: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: res.message,
          timestamp: res.timestamp || new Date().toISOString(),
          suggestedActions: res.suggestedActions,
          onboarding: (res as any).onboarding,
          contextRoles: [],
        };

        applyServerResponse(msg, res.actions || []);

        recordActivity({
          type: skipped ? "onboarding_skip" : "onboarding_answer",
          ts: new Date().toISOString(),
          path: location,
          label: skipped ? `Skipped ${questionKey}` : `${questionKey}: ${value}`,
          meta: { sessionId },
        });
      } catch (err: any) {
        setError(formatUserFacingErrorMessage(err, "Failed to process onboarding"));
        console.error("[Onboarding Error]", err);
      } finally {
        await refreshObjective();
        setStatus("idle");
      }
    },
    [
      userRoles,
      sessionRole,
      isGuest,
      state.messages,
      locality,
      location,
      applyServerResponse,
      recordUserMessage,
      refreshObjective,
      setStatus,
      setError,
      recordActivity,
    ]
  );

  const loadObjectiveOnboardingBundle = useCallback(async () => {
    if (!showEvolutionSurfaces) {
      setObjectiveOnboardingBundle(null);
      return;
    }

    try {
      const objectiveStates = activeObjective
        ? [
            {
              objectiveId: activeObjective.id,
              status: objectiveStatusToOnboardingStatus(activeObjective.status),
              completionPct: objectiveStatusToProgress(activeObjective.status),
              updatedAt: activeObjective.updatedAt,
            },
          ]
        : [];

      const response = await fetch("/api/scout/onboarding/objective-bundle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: (user as any)?.role ?? sessionRole ?? undefined,
          countyFips: (user as any)?.countyFips ?? (user as any)?.county_fips ?? undefined,
          stateCode: (user as any)?.stateCode ?? (user as any)?.state_code ?? undefined,
          objectiveStates,
        }),
      });

      if (!response.ok) {
        setObjectiveOnboardingBundle(null);
        return;
      }

      const payload = await response.json();
      setObjectiveOnboardingBundle(payload);
    } catch {
      setObjectiveOnboardingBundle(null);
    }
  }, [activeObjective, sessionRole, showEvolutionSurfaces, user]);

  useEffect(() => {
    void loadObjectiveOnboardingBundle();
  }, [loadObjectiveOnboardingBundle]);

  const loadWatchdogResult = useCallback(async () => {
    if (!showEvolutionSurfaces) {
      setWatchdogResult(null);
      return;
    }

    try {
      const snapshot = {
        userId: typeof (user as any)?.id === "string" ? String((user as any).id) : "guest",
        role: (user as any)?.role ?? sessionRole ?? undefined,
        countyFips: (user as any)?.countyFips ?? (user as any)?.county_fips ?? undefined,
        lastActiveAt: new Date().toISOString(),
        objectives: activeObjective
          ? [
              {
                id: activeObjective.id,
                title: activeObjective.title,
                intentClass: activeObjective.intentClass,
                status: activeObjective.status,
                completionPct:
                  activeObjective.status === "completed"
                    ? 100
                    : activeObjective.status === "paused"
                      ? 20
                      : 45,
                updatedAt: activeObjective.updatedAt,
                route: "/scout",
              },
            ]
          : [],
        events: state.messages.slice(-8).map((message) => ({
          type: message.role === "user" ? "message_sent" : "action_executed",
          occurredAt: message.timestamp,
        })),
      };

      const response = await fetch("/api/scout/watchdog/evaluate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });

      if (!response.ok) {
        setWatchdogResult(null);
        return;
      }

      const payload = await response.json();
      setWatchdogResult(payload);
    } catch {
      setWatchdogResult(null);
    }
  }, [activeObjective, sessionRole, showEvolutionSurfaces, state.messages, user]);

  useEffect(() => {
    void loadWatchdogResult();
  }, [loadWatchdogResult]);

  const visibleWatchdogInterventions = useMemo(() => {
    const all = Array.isArray(watchdogResult?.interventions) ? watchdogResult.interventions : [];
    if (!dismissedWatchdogId) return all;
    return all.filter((item: any) => String(item?.id || "") !== dismissedWatchdogId);
  }, [dismissedWatchdogId, watchdogResult?.interventions]);

  const handleOpenObjectiveRoute = useCallback(
    (route: string) => {
      recordActivity({
        type: "navigate",
        ts: new Date().toISOString(),
        path: location,
        to: route,
        label: "objective_onboarding",
      });
      if (!maybeOpenWorkAreaForRoute(route, "Objective path")) {
        navigate(route);
      }
    },
    [location, maybeOpenWorkAreaForRoute, navigate]
  );

  const handleStartObjectiveSuggestion = useCallback(
    (objectiveId: string, starterPrompt: string) => {
      setHasGuestInteracted(true);
      recordActivity({
        type: "ask_scout",
        ts: new Date().toISOString(),
        path: location,
        label: objectiveId,
      });
      void handleSend(starterPrompt);
    },
    [handleSend, location]
  );

  const handleCompleteFastWin = useCallback(
    async (objectiveId: string) => {
      if (activeObjective?.id && activeObjective.id === objectiveId) {
        await updateObjective({ status: "completed" });
      } else {
        await refreshObjective();
      }
      setDismissedWatchdogId(null);
      await loadWatchdogResult();
      await loadObjectiveOnboardingBundle();
    },
    [
      activeObjective?.id,
      loadObjectiveOnboardingBundle,
      loadWatchdogResult,
      refreshObjective,
      updateObjective,
    ]
  );

  // Auto-consume one-time onboarding marker set by post-signup/dashboard flows.
  // If present on first clean /scout load (no prior user messages and no intro
  // demo), send the onboarding token directly so the intent detector routes
  // into the "What are you here to do today?" chooser without requiring a
  // manual keypress. Marker is cleared immediately so this is strictly
  // one-time unless explicitly re-set.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!location.startsWith("/scout")) return;

    const hasUserMsgs = state.messages.some((m) => m.role === "user");
    if (hasUserMsgs) return;
    if (shouldPlayIntroDemo) return;

    try {
      const marker = window.localStorage.getItem("scout:prefill:scout-main");
      if (marker === "__SCOUT_ONBOARDING__") {
        window.localStorage.removeItem("scout:prefill:scout-main");
        setPrefillKey((k) => k + 1);
        void handleSend("__SCOUT_ONBOARDING__");
      }
    } catch {
      // ignore storage errors
    }
  }, [location, state.messages, shouldPlayIntroDemo, handleSend, setPrefillKey]);

  // Intro demo typing is handled by ScoutInput; we only supply
  // session-scoped enable flag and the demo text.

  const handleClusterAction = useCallback(
    async (action: ScoutAction) => {
      if (action.type === "NAVIGATE") {
        const target = (action.to ?? action.path) as string | undefined;
        if (maybeOpenWorkAreaForRoute(target, action.label)) {
          return;
        }

        const ttaMs = renderStartRef.current ? Date.now() - renderStartRef.current : undefined;
        recordActivity({
          type: "navigate",
          ts: new Date().toISOString(),
          path: location,
          to: action.to ?? action.path,
          label: action.label,
          meta: {
            ...(typeof action.payload?.jobId === "string"
              ? { jobId: action.payload.jobId as string }
              : {}),
            ttaMs,
            source: "cluster_action",
          },
        });
        renderStartRef.current = null;
      }

      if (action.type === "NOOP") {
        return;
      }

      // While executing a tool or navigation action, briefly move into
      // EXECUTING_ACTION so the loader reflects real work instead of
      // fake "typing".
      setStatus("executing_action");

      try {
        await executeScoutActions([action], {
          navigate: (to) => {
            if (!maybeOpenWorkAreaForRoute(to)) {
              navigate(to);
            }
          },
          openAppDrawer: () => setToolsOpen(true),
          openToolsDrawer: () => setToolsOpen(true),
          prefillInput: (text) => {
            try {
              window.localStorage.setItem("scout:prefill:scout-main", text);
            } catch {
              // ignore
            }
            setPrefillKey((k) => k + 1);
          },
          askScout: (prompt) => {
            void handleSend(prompt);
          },
        });
      } catch (err: any) {
        setError(formatUserFacingErrorMessage(err, "Action failed to execute."));
      } finally {
        setStatus("idle");
      }
    },
    [location, maybeOpenWorkAreaForRoute, navigate, handleSend, setError]
  );

  const handleOverride = useCallback(
    async (option: NonNullable<ScoutMessage["overrideOption"]>) => {
      const scope = option.scope ?? "global";
      if (overridePendingScope === scope) return;

      setOverridePendingScope(scope);
      try {
        const res = await fetch(`${apiBase}/scout/override`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            contextType: option.contextType ?? "general",
            contextId: option.contextId ?? null,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Override HTTP ${res.status}`);
        }

        const ack: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content:
            "Understood. I'll proceed and record that you chose to continue so Scout can learn from this scope.",
          timestamp: new Date().toISOString(),
        };
        applyServerResponse(ack, []);
      } catch (err: any) {
        setError(formatUserFacingErrorMessage(err, "Failed to record override"));
      } finally {
        setOverridePendingScope(null);
      }
    },
    [applyServerResponse, overridePendingScope, setError]
  );

  // Auto-consume Help Center intents: when arriving from Help, send the
  // stored prompt into Scout immediately so the user sees a guided flow
  // instead of a blank chat box.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!location.startsWith("/scout")) return;

    const hasUserMsgs = state.messages.some((m) => m.role === "user");
    if (hasUserMsgs) return;
    // If the intro demo will run, do not auto-send the help intent here
    if (shouldPlayIntroDemo) return;

    try {
      const raw = window.localStorage.getItem("scout:help-intent");
      if (!raw) return;

      const parsed = JSON.parse(raw) as { prompt?: string } | null;
      if (!parsed || typeof parsed.prompt !== "string" || !parsed.prompt.trim()) {
        window.localStorage.removeItem("scout:help-intent");
        return;
      }

      // Clear any stored prefill so the input is blank when the
      // help-center intent is auto-sent.
      try {
        window.localStorage.removeItem("scout:prefill:scout-main");
      } catch {
        // ignore
      }
      setPrefillKey((k) => k + 1);

      window.localStorage.removeItem("scout:help-intent");
      setHasGuestInteracted(true);
      void handleSend(parsed.prompt);
    } catch {
      // ignore storage/JSON errors
    }
  }, [location, state.messages, handleSend, setPrefillKey, shouldPlayIntroDemo]);

  const heroLocationLabel = formatCityOnly({ label: locationCtx.label });

  const handleUseDeviceLocation = useCallback(() => {
    if (isUpdatingGeo) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      console.warn("Geolocation is not available in this environment.");
      return;
    }

    setIsUpdatingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          await updateGeoPreferencesFromDeviceLocation({
            lat: latitude,
            lng: longitude,
            enableNearbyDeals: true,
          });
          // Refresh auth/user so Scout picks up the new geo prefs.
          void refetchUser();
        } catch (err) {
          console.warn("Failed to update geo preferences from device location", err);
        } finally {
          setIsUpdatingGeo(false);
        }
      },
      (error) => {
        console.warn("Geolocation error", error);
        setIsUpdatingGeo(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  }, [isUpdatingGeo, refetchUser]);

  // Fetch saved contractors for tile context (deterministic personalization)
  const { data: savedContractorsData } = useQuery<
    Array<{ id: string; name: string; category?: string | null }>
  >({
    queryKey: ["/api/saved-contractors"],
    queryFn: () => apiRequest("GET", "/api/saved-contractors"),
    // Only fetch if user is logged in
    enabled: !!user && countyCommitted,
    // Cache for 5 minutes (tiles don't need real-time updates)
    staleTime: 5 * 60 * 1000,
  });

  // Fetch dashboard data to derive active projects (deterministic personalization)
  const { data: dashboardData } = useQuery<{
    myProjects?: Array<{
      id: string;
      title: string;
      contractorName?: string | null;
      updatedAt?: string | Date | null;
    }>;
  }>({
    queryKey: ["/api/dashboard", user?.id],
    queryFn: () => apiRequest("GET", "/api/dashboard"),
    enabled: !!user?.id && countyCommitted,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch invoices for tile context (deterministic personalization)
  const { data: invoicesData } = useQuery<
    Array<{
      id: string;
      jobName?: string | null;
      status: string;
      updatedAt?: string | Date | null;
      amount?: number | null;
    }>
  >({
    queryKey: ["/api/invoices", user?.id],
    queryFn: () => apiRequest("GET", "/api/invoices"),
    // Only fetch if user is logged in
    enabled: !!user?.id && countyCommitted,
    // Cache for 5 minutes (tiles don't need real-time updates)
    staleTime: 5 * 60 * 1000,
  });

  // Build tile context from deterministic user state (no guessing, only real data)
  const tileContext: ScoutTileContext = useMemo(() => {
    const saved = savedContractorsData ?? [];
    const projects = dashboardData?.myProjects ?? [];
    const invoices = invoicesData ?? [];

    // Confidence rule: Only include saved contractors if we have data
    const savedContractors = saved.map((c) => ({
      id: c.id,
      name: c.name,
      trade: c.category ?? undefined,
    }));

    // Map projects to activeJobs with updatedAt for freshness logic
    const activeJobs = projects.map((p) => ({
      id: p.id,
      name: p.title,
      status: "active",
      updatedAt: p.updatedAt ?? null,
    }));

    // Map invoices to activeInvoices with updatedAt for freshness logic
    const activeInvoices = invoices.map((inv) => ({
      id: inv.id,
      jobName: (inv.jobName ?? undefined) as string | undefined,
      status: inv.status,
      amount: typeof inv.amount === "number" ? inv.amount : undefined,
      updatedAt: inv.updatedAt ?? null,
    }));

    return {
      activeJobs,
      activeInvoices,
      savedContractors,
      location: heroLocationLabel || undefined,
      recentActivity: [],
    };
  }, [heroLocationLabel, savedContractorsData, dashboardData, invoicesData]);

  // Resolve tiles to contextual variants based on deterministic state
  // Feature kill switch: Set VITE_DISABLE_CONTEXTUAL_TILES=true to disable variants
  const resolvedTiles = useMemo(() => {
    const disableFeature = import.meta.env.VITE_DISABLE_CONTEXTUAL_TILES === "true";

    if (disableFeature) {
      console.warn("[Scout] Contextual tiles disabled via feature flag");
      return scoutActionTiles; // Return defaults only
    }

    const resolved = resolveAllTiles(scoutActionTiles, tileContext);

    // Dev-mode logging: always log tile context summary
    if (import.meta.env.DEV) {
      console.info("[Scout Tile Context]", {
        location: tileContext.location || "unknown",
        savedContractors: tileContext.savedContractors.length,
        activeProjects: tileContext.activeJobs.length,
        activeInvoices: tileContext.activeInvoices.length,
      });
    }

    // Dev-mode logging: trace which variants rendered and why
    if (import.meta.env.DEV) {
      resolved.forEach((tile, i) => {
        const original = scoutActionTiles[i];
        const usedVariant =
          tile.label !== original.label || tile.description !== original.description;

        if (usedVariant) {
          console.info(`[Scout Tiles] ${tile.id}:`, {
            variant: "custom",
            label: tile.label,
            context: {
              savedContractors: tileContext.savedContractors.length,
              location: tileContext.location,
              activeJobs: tileContext.activeJobs.length,
              activeInvoices: tileContext.activeInvoices.length,
            },
          });
        }
      });
    }

    // KPI: mark render start time for time-to-action tracking
    renderStartRef.current = Date.now();

    return resolved;
  }, [tileContext]);

  const tileMetaById: Record<
    string,
    { icon: React.ComponentType<{ className?: string }>; eyebrow: string }
  > = {
    start_project: { icon: ClipboardList, eyebrow: "Direct Connect" },
    find_pros: { icon: Wrench, eyebrow: "Provider Routing" },
    nearby: { icon: Users2, eyebrow: "Community" },
    manage: { icon: Sparkles, eyebrow: "Exchange" },
  };

  const handleActionTile = useCallback(
    (tile: (typeof scoutActionTiles)[0]) => {
      // Derive lightweight variant metadata for KPI logging
      const isFresh = (updatedAt: string | Date | null | undefined, days = 14) => {
        if (!updatedAt) return false;
        const t =
          typeof updatedAt === "string"
            ? new Date(updatedAt).getTime()
            : new Date(updatedAt).getTime();
        const windowMs = days * 24 * 60 * 60 * 1000;
        return Date.now() - t <= windowMs;
      };
      let variantType: "default" | "single" | "multi" = "default";
      let entityId: string | undefined = undefined;
      if (tile.id === "manage") {
        const invs = tileContext.activeInvoices;
        if (invs.length === 1 && isFresh(invs[0]?.updatedAt)) {
          variantType = "single";
          entityId = invs[0]?.id;
        } else if (invs.length > 1) {
          variantType = "multi";
        } else {
          variantType = "default";
        }
      } else if (tile.id === "start_project") {
        const jobs = tileContext.activeJobs;
        if (jobs.length === 1 && isFresh(jobs[0]?.updatedAt)) variantType = "single";
        else if (jobs.length > 1) variantType = "multi";
        else variantType = "default";
      }

      const ttaMs = renderStartRef.current ? Date.now() - renderStartRef.current : undefined;

      recordActivity({
        type: "navigate",
        ts: new Date().toISOString(),
        path: location,
        to: tile.action.to,
        label: tile.label,
        meta: {
          tileId: tile.id,
          variantType,
          entityId,
          ttaMs,
        },
      });

      // Reset render start to avoid double-counting subsequent actions
      renderStartRef.current = null;
      const navTarget = (tile.action as any)?.to ?? (tile.action as any)?.path ?? "/";
      navigate(navTarget);
    },
    [location, navigate, tileContext]
  );

  // Build a concrete, ready-to-send draft using known profile and locality.
  const buildAutoFilledDraft = useCallback(
    (userMessage: string): string => {
      const parts: string[] = [];

      const name =
        (user as any)?.name || (user as any)?.fullName || (user as any)?.displayName || undefined;

      const county = locality?.county ? String(locality.county) : undefined;
      const state = locality?.state ? String(locality.state) : undefined;
      const zip = locality?.zip ? String(locality.zip) : undefined;

      const locLabel = (() => {
        if (county && state) return `${county}, ${state}`;
        if (county) return county;
        if (state) return state;
        return undefined;
      })();

      const email = (user as any)?.email || (user as any)?.primaryEmail || undefined;
      const phone = (user as any)?.phone || (user as any)?.phoneNumber || undefined;

      parts.push("Hello,");
      if (name || locLabel) {
        parts.push(
          [
            name ? `I'm ${name}` : undefined,
            locLabel ? `based in ${locLabel}${zip ? ` (${zip})` : ""}` : undefined,
          ]
            .filter(Boolean)
            .join(" ") + "."
        );
      }

      const trimmed = userMessage.trim();
      if (trimmed) {
        parts.push(`I'm looking for help with: ${trimmed}.`);
      }

      // If the prompt includes urgency hints, reflect them; otherwise omit.
      const lower = trimmed.toLowerCase();
      const urgency =
        lower.includes("urgent") || lower.includes("asap")
          ? "This is time-sensitive."
          : lower.includes("week")
            ? "Ideally within the next couple of weeks."
            : lower.includes("month")
              ? "Ideally within the next month."
              : undefined;
      if (urgency) parts.push(urgency);

      if (email || phone) {
        parts.push(
          [email ? `Email: ${email}` : undefined, phone ? `Phone: ${phone}` : undefined]
            .filter(Boolean)
            .join(" \n")
        );
      }

      parts.push("Thank you!");
      return parts.filter((p) => typeof p === "string" && p.trim().length > 0).join("\n\n");
    },
    [user, locality]
  );

  return (
    <div className="scout-shell flex flex-col flex-1 min-h-0 w-full items-center overflow-hidden">
      <div className="scout-content w-full flex flex-col flex-1 min-h-0">
        <div
          className={`w-full ${
            isMobile ? "px-2 pt-1 pb-12" : "max-w-6xl px-4 pt-3 pb-8"
          } flex flex-col flex-1 min-h-0`}
          style={{
            paddingBottom: isMobile ? "calc(3.9rem + env(safe-area-inset-bottom))" : undefined,
          }}
        >
          {/* Main conversation layout: used for all users, including first-time guests. */}
          <div
            className={
              isMobile
                ? "max-w-xl mx-auto w-full flex flex-col min-h-0"
                : "mx-auto w-full flex flex-1 min-h-0 max-w-6xl gap-5"
            }
          >
            <div
              className={`scout-panel w-full flex flex-col min-h-0 max-w-3xl rounded-2xl px-2.5 md:px-4 py-2.5 relative ${
                isMobile ? "" : "flex-1"
              }`}
            >
              {/* Keep the main thread clean: move dashboards into an optional side sheet. */}
              {!isMobile && (
                <div className="flex items-center justify-end pb-2">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[11px]"
                        style={{
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-primary)",
                          backgroundColor: "transparent",
                        }}
                      >
                        Dashboard
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[380px] max-w-[92vw]">
                      <SheetHeader>
                        <SheetTitle>Scout workspace</SheetTitle>
                      </SheetHeader>
                      <div className="mt-4 flex flex-col gap-3">
                        <ScoutDirectConnectPanel isAuthenticated={isAuthenticated} />
                        <ScoutHasDonePanel />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              )}

              {!hasUserMessages && (
                <ScoutHeader
                  isAuthenticated={isAuthenticated}
                  isFirstGuestVisit={isFirstGuestVisit}
                  locationLabel={heroLocationLabel}
                />
              )}

              {/* PHASE 3d-A: Claim Confirmation Card during onboarding */}
              {onboarding.flowState.phase === "confirming" &&
                onboarding.flowState.confirmationCard && (
                  <div className="mt-3 mb-4 flex justify-center">
                    <ClaimConfirmationCardComponent
                      data={onboarding.flowState.confirmationCard}
                      onConfirm={(selectedClaims: ClaimType[]) => {
                        const card = onboarding.flowState.confirmationCard;
                        if (!card) return;

                        // Build metadata from original inference
                        const confidenceByClaim: Record<string, number> = {};
                        const evidenceByClaim: Record<string, string> = {};
                        card.options.forEach((opt) => {
                          if (selectedClaims.includes(opt.claimType)) {
                            confidenceByClaim[opt.claimType] = opt.confidence;
                            evidenceByClaim[opt.claimType] = opt.description || "";
                          }
                        });

                        const provisional = (user as any)?.preferences?.provisional;
                        const profileDraft: ProfileDraft | undefined = provisional?.profileDraft;
                        const countyFips =
                          profileDraft?.countyFips || (user as any)?.countyFips || null;
                        onboarding.confirmClaims(
                          selectedClaims,
                          {
                            confidenceByClaim,
                            evidenceByClaim,
                            rawUserIntentText: provisional?.userIntent || "",
                          },
                          countyFips
                        );

                        // PHASE 3d-B: Trigger ScoutMode state machine transition
                        scoutModeHook.completeOnboarding(selectedClaims);
                      }}
                      onSkip={() => {
                        onboarding.skipOnboarding();
                        scoutModeHook.skipOnboarding();
                      }}
                      onEdit={() => {
                        onboarding.resetFlow();
                        navigate("/profile-settings");
                      }}
                    />
                  </div>
                )}

              {/* Show loading state during inference */}
              {onboarding.flowState.phase === "inferring" && (
                <div className="mt-3 mb-4 flex justify-center">
                  <Card className="w-full max-w-2xl border-primary/20 bg-card/95 backdrop-blur p-6">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                      <span className="text-sm text-muted-foreground">
                        Understanding your intent...
                      </span>
                    </div>
                  </Card>
                </div>
              )}

              {/* Show writing state */}
              {onboarding.flowState.phase === "writing" && (
                <div className="mt-3 mb-4 flex justify-center">
                  <Card className="w-full max-w-2xl border-primary/20 bg-card/95 backdrop-blur p-6">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                      <span className="text-sm text-muted-foreground">
                        Setting up your experience...
                      </span>
                    </div>
                  </Card>
                </div>
              )}

              {/* Show error if any */}
              {onboarding.flowState.error && (
                <div className="mt-3 mb-4 flex justify-center">
                  <Card className="w-full max-w-2xl border-destructive/20 bg-destructive/10 backdrop-blur p-4">
                    <p className="text-sm text-destructive">{onboarding.flowState.error}</p>
                  </Card>
                </div>
              )}

              {/* PHASE 3d-B: Post-Onboarding Action Card (deterministic action selection) */}
              {scoutModeHook.scoutMode === "post_onboarding" && scoutModeHook.confirmedClaims && (
                <div className="mt-3 mb-4 flex justify-center">
                  <PostOnboardingActionCard
                    claims={scoutModeHook.confirmedClaims as ClaimType[]}
                    actions={resolvePostOnboardingActions(
                      scoutModeHook.confirmedClaims as ClaimType[],
                      {
                        slug: scoutModeHook.publishedProfileSlug || "my-business",
                        businessName: profileDraft?.businessName,
                      }
                    )}
                    onActionSelected={(actionId: string, destination: string) => {
                      scoutModeHook.selectPostOnboardingAction(actionId);
                      navigate(destination);
                    }}
                  />
                </div>
              )}

              <div
                className="scout-composer-dock mt-1.5 order-2 z-10 rounded-lg border px-1.5 py-1.5"
                style={{
                  borderColor: "var(--border-subtle)",
                  backgroundColor: "color-mix(in oklab, var(--surface-card) 93%, transparent)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {isMobile && (
                  <div
                    className="mb-2 rounded-md border px-2.5 py-2"
                    style={{
                      borderColor: "var(--border-subtle)",
                      backgroundColor:
                        "color-mix(in oklab, var(--surface-intermediate) 90%, transparent)",
                    }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Step 1 of 3
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                      Tell Scout what you need. You will review a decision card before any contact
                      action.
                    </p>
                  </div>
                )}

                <ScoutInputRow
                  isBusy={isBusy}
                  prefillKey={prefillKey}
                  heroLocationLabel={heroLocationLabel}
                  isUpdatingGeo={isUpdatingGeo}
                  onOpenLocationSettings={() => navigate("/settings")}
                  onUseDeviceLocation={handleUseDeviceLocation}
                  onSend={(value) => handleSend(value)}
                  onTyping={() => {
                    setHasGuestInteracted(true);
                    recordActivity({
                      type: "ask_scout",
                      ts: new Date().toISOString(),
                      path: location,
                      label: "typing",
                    });
                  }}
                  quickStartPrompts={
                    !hasMessages
                      ? isMobile
                        ? SCOUT_QUICK_START_PROMPTS.slice(0, 2)
                        : [...SCOUT_QUICK_START_PROMPTS]
                      : []
                  }
                  autoDemoText={introDemoText}
                  enableAutoDemo={shouldPlayIntroDemo}
                />

                {!isAuthenticated && (
                  <div className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    Start here first.{" "}
                    <button
                      type="button"
                      className="font-medium underline underline-offset-2"
                      style={{ color: "var(--text-primary)" }}
                      onClick={() => navigate("/login")}
                    >
                      Sign in
                    </button>{" "}
                    only when you want to save this or come back to it later.
                  </div>
                )}

                {!isMobile && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShortcutsOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors"
                      style={{
                        borderColor: "var(--border-subtle)",
                        backgroundColor:
                          "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
                        color: "var(--text-secondary)",
                      }}
                      aria-expanded={shortcutsOpen}
                    >
                      {shortcutsOpen ? "Hide shortcuts" : "Shortcuts"}
                    </button>

                    {shortcutsOpen &&
                      resolvedTiles.slice(0, isMobile ? 3 : 4).map((tile) => (
                        <button
                          key={`dock-${tile.id}`}
                          type="button"
                          onClick={() => {
                            setHasGuestInteracted(true);
                            handleActionTile(tile);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors"
                          style={{
                            borderColor: "var(--border-subtle)",
                            backgroundColor:
                              "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <span>{tile.label}</span>
                        </button>
                      ))}
                  </div>
                )}

                {!isMobile && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      View mode
                    </p>

                    <div
                      className="inline-flex items-center gap-1 rounded-full border p-0.5"
                      style={{
                        borderColor: "var(--border-subtle)",
                        backgroundColor:
                          "color-mix(in oklab, var(--surface-intermediate) 84%, transparent)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setViewMode("chat_only")}
                        className="rounded-full px-2 py-1 text-[10px] font-medium"
                        style={{
                          color:
                            scoutViewMode === "chat_only"
                              ? "var(--ts-text-on-accent, #0B0F14)"
                              : "var(--text-secondary)",
                          backgroundColor:
                            scoutViewMode === "chat_only"
                              ? "var(--theme-accent-primary)"
                              : "transparent",
                        }}
                      >
                        Chat only
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("chat_plus_controller")}
                        className="rounded-full px-2 py-1 text-[10px] font-medium"
                        style={{
                          color:
                            scoutViewMode === "chat_plus_controller"
                              ? "var(--ts-text-on-accent, #0B0F14)"
                              : "var(--text-secondary)",
                          backgroundColor:
                            scoutViewMode === "chat_plus_controller"
                              ? "var(--theme-accent-primary)"
                              : "transparent",
                        }}
                      >
                        Chat + controller
                      </button>
                    </div>
                  </div>
                )}

                {/* Avoid duplicated action rails: in "Chat + controller" view, actions render per-message. */}
                {false && effectiveViewMode === "chat_only" && controllerActions.length > 0 && (
                  <div
                    className="mt-2 rounded-lg border p-2"
                    style={{
                      borderColor: "var(--border-subtle)",
                      backgroundColor:
                        "color-mix(in oklab, var(--surface-intermediate) 84%, transparent)",
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p
                        className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Controller
                      </p>

                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-secondary)",
                          backgroundColor: "transparent",
                        }}
                        onClick={() => setControllerRailOpen((v) => !v)}
                        aria-expanded={controllerRailOpen}
                      >
                        {controllerRailOpen ? "Hide" : `Show (${controllerActions.length})`}
                      </button>
                    </div>

                    {controllerRailOpen && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {visibleControllerActions.map((action, index) => (
                            <button
                              key={`controller-rail-${index}-${action.type}-${action.label || "action"}`}
                              type="button"
                              onClick={() => {
                                setHasGuestInteracted(true);
                                void handleClusterAction(action);
                              }}
                              className="scout-action-button"
                            >
                              {action.label || (action.type === "NAVIGATE" ? "Open" : "Run action")}
                            </button>
                          ))}
                        </div>

                        {controllerActions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setControllerShowAll((v) => !v)}
                            className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium"
                            style={{
                              borderColor: "var(--border-subtle)",
                              color: "var(--text-secondary)",
                              backgroundColor: "transparent",
                            }}
                          >
                            {controllerShowAll
                              ? "Show fewer"
                              : `More actions (${controllerActions.length - 2})`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Thread + input in a single chat container that stretches toward
                  the bottom of the viewport, with the input pinned just above
                  the global bottom nav. */}
              <div
                className={`mt-1.5 flex flex-col min-h-0 ${
                  showThreadRegion ? "flex-1" : "flex-none"
                } ${isMobile ? "space-y-2 order-1" : "space-y-2 order-1"}`}
                style={{ paddingBottom: isMobile ? "0.75rem" : "1rem" }}
              >
                {false && !hasUserMessages && (
                  <div className="flex flex-col gap-2.5 py-2 px-0.5">
                    <p
                      className="text-[11px] md:text-xs font-semibold tracking-wide uppercase"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Start with Scout
                    </p>

                    <p
                      className="text-[11px] md:text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Pick the operating path that matches what you need to move forward right now.
                    </p>

                    {/* Primary action grid: navigation with intent, not chat suggestions */}
                    {countyCommitted ? (
                      <div className="grid grid-cols-2 gap-2 mt-0.5">
                        {resolvedTiles.map((tile) => (
                          <button
                            key={tile.id}
                            onClick={() => {
                              setHasGuestInteracted(true);
                              handleActionTile(tile);
                            }}
                            className="flex flex-col items-start justify-between rounded-lg border px-2 py-2 text-left transition-colors"
                            style={{
                              borderColor: "var(--border-subtle)",
                              backgroundColor:
                                "color-mix(in oklab, var(--surface-intermediate) 86%, transparent)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <div
                              className="mb-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                              style={{
                                borderColor: "var(--border-subtle)",
                                backgroundColor:
                                  "color-mix(in oklab, var(--surface-card) 92%, transparent)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {(() => {
                                const meta = tileMetaById[tile.id];
                                if (!meta) return null;
                                const Icon = meta.icon;
                                return <Icon className="h-3 w-3" />;
                              })()}
                              <span>{tileMetaById[tile.id]?.eyebrow || "Scout"}</span>
                            </div>
                            <span className="font-semibold text-[13px] mb-1">{tile.label}</span>
                            {!isMobile && tile.description && (
                              <span
                                className="text-[11px]"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {tile.description}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="mt-1.5 space-y-2 rounded-lg border px-3 py-2.5"
                        style={{
                          borderColor: "var(--border-subtle)",
                          backgroundColor:
                            "color-mix(in oklab, var(--surface-intermediate) 86%, transparent)",
                        }}
                      >
                        <p
                          className="text-xs md:text-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Set your county so Scout can route local providers, activity, and jobs
                          correctly.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-3 text-[11px] font-medium"
                            style={{
                              backgroundColor: "var(--theme-accent-primary)",
                              color: "var(--ts-text-on-accent, #0B0F14)",
                            }}
                            onClick={() => navigate(ROUTES.SETTINGS)}
                          >
                            Set my county
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeObjective && (
                  <ObjectiveChip
                    objective={activeObjective}
                    isLoading={objectiveBusy}
                    onRename={async (_id, newTitle) => {
                      await updateObjective({ title: newTitle });
                    }}
                    onPause={async (_id) => {
                      await updateObjective({ status: "paused" });
                    }}
                    onComplete={async (_id) => {
                      await updateObjective({ status: "completed" });
                    }}
                    onDelete={async (_id) => {
                      await deleteObjective();
                    }}
                  />
                )}

                {showEvolutionSurfaces && objectiveOnboardingBundle && (
                  <ObjectiveOnboardingFlow
                    roleLabel={String(objectiveOnboardingBundle.role || "")}
                    suggestions={
                      Array.isArray(objectiveOnboardingBundle.suggestions)
                        ? objectiveOnboardingBundle.suggestions
                        : []
                    }
                    fastWins={
                      Array.isArray(objectiveOnboardingBundle.fastWins)
                        ? objectiveOnboardingBundle.fastWins
                        : []
                    }
                    objectiveStates={
                      activeObjective
                        ? [
                            {
                              objectiveId: activeObjective.id,
                              status: objectiveStatusToOnboardingStatus(activeObjective.status),
                              completionPct: objectiveStatusToProgress(activeObjective.status),
                              updatedAt: activeObjective.updatedAt,
                            },
                          ]
                        : []
                    }
                    nextRecommendedObjectiveId={
                      typeof objectiveOnboardingBundle.nextRecommendedObjectiveId === "string"
                        ? objectiveOnboardingBundle.nextRecommendedObjectiveId
                        : undefined
                    }
                    onStartObjective={handleStartObjectiveSuggestion}
                    onOpenRoute={handleOpenObjectiveRoute}
                    onCompleteFastWin={(objectiveId) => {
                      void handleCompleteFastWin(objectiveId);
                    }}
                  />
                )}

                {showEvolutionSurfaces && visibleWatchdogInterventions.length > 0 && (
                  <WatchdogInterventionBanner
                    interventions={visibleWatchdogInterventions}
                    engagementScore={
                      typeof watchdogResult?.engagementScore === "number"
                        ? watchdogResult.engagementScore
                        : undefined
                    }
                    inactivityHours={
                      typeof watchdogResult?.inactivityHours === "number"
                        ? watchdogResult.inactivityHours
                        : undefined
                    }
                    onOpenIntervention={(route, interventionId) => {
                      recordActivity({
                        type: "navigate",
                        ts: new Date().toISOString(),
                        path: location,
                        to: route,
                        label: `watchdog_${interventionId}`,
                      });
                      if (!maybeOpenWorkAreaForRoute(route, "Watchdog intervention")) {
                        navigate(route);
                      }
                    }}
                    onDismissIntervention={(interventionId) => {
                      setDismissedWatchdogId(interventionId);
                    }}
                  />
                )}

                {showEvolutionSurfaces &&
                  routingDecisionCard?.action &&
                  routingDecisionCard.metadata?.trust?.trustSignals && (
                    <TrustAwareDecisionCard
                      title="Scout recommended route"
                      summary={routingDecisionCard.reasoning}
                      primaryAction={routingDecisionCard.action}
                      alternativeActions={routingDecisionCard.metadata?.alternativeActions}
                      confidence={routingDecisionCard.confidence}
                      confidenceBand={routingDecisionCard.metadata?.confidenceBand}
                      riskLevel={routingDecisionCard.metadata?.riskLevel}
                      trust={{
                        trustSignals: {
                          cvsScore:
                            typeof routingDecisionCard.metadata?.trust?.trustSignals?.cvsScore ===
                            "number"
                              ? routingDecisionCard.metadata.trust.trustSignals.cvsScore
                              : null,
                          confidenceLevel:
                            routingDecisionCard.metadata?.trust?.trustSignals?.confidenceLevel ||
                            "medium",
                          confidenceNumeric:
                            typeof routingDecisionCard.metadata?.trust?.trustSignals
                              ?.confidenceNumeric === "number"
                              ? routingDecisionCard.metadata.trust.trustSignals.confidenceNumeric
                              : 0.64,
                          verifiedActivityProof:
                            routingDecisionCard.metadata?.trust?.trustSignals
                              ?.verifiedActivityProof || "No verified activity proof yet",
                          verificationStatus:
                            routingDecisionCard.metadata?.trust?.trustSignals?.verificationStatus ||
                            "unknown",
                          riskFlags: Array.isArray(
                            routingDecisionCard.metadata?.trust?.trustSignals?.riskFlags
                          )
                            ? routingDecisionCard.metadata.trust.trustSignals.riskFlags
                            : [],
                          trustBandLabel:
                            routingDecisionCard.metadata?.trust?.trustSignals?.trustBandLabel ||
                            "CVS pending",
                          requiredReview: Boolean(
                            routingDecisionCard.metadata?.trust?.trustSignals?.requiredReview
                          ),
                        },
                        minRequiredScore:
                          typeof routingDecisionCard.metadata?.trust?.minRequiredScore === "number"
                            ? routingDecisionCard.metadata.trust.minRequiredScore
                            : 0,
                        trustFilterApplied: Boolean(
                          routingDecisionCard.metadata?.trust?.trustFilterApplied
                        ),
                      }}
                      onAction={(action) => {
                        void handleClusterAction(action);
                      }}
                      onOpenTrustModel={() => {
                        if (!maybeOpenWorkAreaForRoute("/trust-model", "Trust model")) {
                          navigate("/trust-model");
                        }
                      }}
                    />
                  )}

                {showEvolutionSurfaces && toneMessage?.message && (
                  <ToneAwareMessage
                    message={toneMessage.message}
                    scenario={toneMessage.scenario}
                    toneScore={toneMessage.toneScore}
                    guardrailFlags={toneMessage.guardrailFlags}
                    confidenceBand={toneMessage.confidenceBand}
                    onUseNextStep={() => {
                      const target =
                        routingDecisionCard?.action?.to || routingDecisionCard?.action?.path;
                      if (typeof target === "string" && target.length > 0) {
                        if (!maybeOpenWorkAreaForRoute(target, "Tone-aware next step")) {
                          navigate(target);
                        }
                      }
                    }}
                  />
                )}

                {showThreadRegion && (
                  <ScoutThread
                    messages={state.messages}
                    status={state.status}
                    mode={activeMode}
                    showControllerExtras={false}
                    onAction={handleClusterAction}
                    onOverride={handleOverride}
                    overridePendingScope={overridePendingScope}
                    onSendMessage={handleOnboardingMessage}
                    onQuickAction={(text) => {
                      const trimmed = text.trim();
                      setHasGuestInteracted(true);
                      const localAction = resolveQuickActionIntent(trimmed);

                      if (localAction?.kind === "direct_connect_request") {
                        if (!isAuthenticated) {
                          navigate("/pre-scout-setup?mode=signin");
                          return;
                        }

                        const lastUserMsg = [...state.messages]
                          .reverse()
                          .find((m) => m.role === "user" && typeof m.content === "string")?.content;
                        const raw = String(lastUserMsg || "")
                          .replace(/\s+/g, " ")
                          .trim();

                        if (!raw) {
                          navigate("/direct-connect");
                          return;
                        }

                        const title = raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
                        const countyFips =
                          typeof (user as any)?.countyFips === "string"
                            ? String((user as any).countyFips)
                            : typeof (user as any)?.county_fips === "string"
                              ? String((user as any).county_fips)
                              : undefined;
                        const stateCode =
                          typeof (user as any)?.stateCode === "string"
                            ? String((user as any).stateCode)
                            : typeof (user as any)?.state_code === "string"
                              ? String((user as any).state_code)
                              : undefined;

                        setDcDraft({
                          title,
                          description: raw,
                          countyFips,
                          stateCode,
                        });
                        setDcConfirmOpen(true);
                        return;
                      }

                      if (localAction?.kind === "navigate") {
                        recordActivity({
                          type: "navigate",
                          ts: new Date().toISOString(),
                          path: location,
                          to: localAction.to,
                          label: trimmed,
                        });
                        if (!maybeOpenWorkAreaForRoute(localAction.to, trimmed)) {
                          navigate(localAction.to);
                        }
                        return;
                      }

                      if (localAction?.kind === "open_note") {
                        recordActivity({
                          type: "open_note",
                          ts: new Date().toISOString(),
                          path: location,
                          label: trimmed,
                        });
                        void openFloatingNote("quick");
                        return;
                      }

                      handleSend(trimmed);
                    }}
                  />
                )}

                {autoRoutePending && (
                  <Card
                    className="shadow-sm"
                    style={{
                      borderColor: "var(--border-subtle)",
                      backgroundColor:
                        "color-mix(in oklab, var(--surface-intermediate) 90%, transparent)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          Smart navigation {autoRouteEnabled ? "on" : "off"} •{" "}
                          {Math.round(autoRoutePending.confidence * 100)}%
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {autoRouteEnabled &&
                          autoRoutePending.confidence >= AUTO_ROUTE_MIN_CONFIDENCE
                            ? `Opening ${autoRoutePending.label}...`
                            : `Suggested: ${autoRoutePending.label}`}
                          {autoRoutePending.why ? ` - ${autoRoutePending.why}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(!autoRouteEnabled ||
                          autoRoutePending.confidence < AUTO_ROUTE_MIN_CONFIDENCE) && (
                          <Button
                            size="sm"
                            style={{
                              backgroundColor: "var(--theme-accent-primary)",
                              color: "var(--ts-text-on-accent, #0B0F14)",
                            }}
                            onClick={() => {
                              cancelAutoRoute();
                              navigate(autoRoutePending.to);
                            }}
                          >
                            Go
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          style={{
                            borderColor: "var(--border-subtle)",
                            color: "var(--text-primary)",
                            backgroundColor: "transparent",
                          }}
                          onClick={cancelAutoRoute}
                        >
                          {autoRouteEnabled &&
                          autoRoutePending.confidence >= AUTO_ROUTE_MIN_CONFIDENCE
                            ? "Cancel"
                            : "Dismiss"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Coordination panels moved into the Dashboard sheet to keep the thread clean. */}
          </div>
        </div>
      </div>

      <AlertDialog
        open={dcConfirmOpen}
        onOpenChange={(open) => {
          if (dcBusy) return;
          setDcConfirmOpen(open);
          if (!open) setDcDraft(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post to Direct Connect?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a request on your Direct Connect board. You can route it to pros
              after it is posted.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-3 rounded-md border p-3 text-sm">
            <div className="font-medium">{dcDraft?.title || "New request"}</div>
            <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
              {dcDraft?.description ? String(dcDraft.description).slice(0, 600) : ""}
              {dcDraft?.description && String(dcDraft.description).length > 600 ? "..." : ""}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={dcBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={dcBusy || !dcDraft}
              onClick={async (e) => {
                e.preventDefault();
                if (!dcDraft || dcBusy) return;

                setDcBusy(true);
                try {
                  const payload: any = {
                    title: dcDraft.title,
                    description: dcDraft.description,
                    ...(dcDraft.tradeId ? { tradeId: dcDraft.tradeId } : {}),
                    ...(typeof dcDraft.budgetMin === "number"
                      ? { budgetMin: dcDraft.budgetMin }
                      : {}),
                    ...(typeof dcDraft.budgetMax === "number"
                      ? { budgetMax: dcDraft.budgetMax }
                      : {}),
                    ...(dcDraft.countyFips ? { countyFips: dcDraft.countyFips } : {}),
                    ...(dcDraft.stateCode ? { stateCode: dcDraft.stateCode } : {}),
                  };

                  const res: any = await apiRequest(
                    "POST",
                    "/api/direct-connect/requests",
                    payload
                  );

                  // Verification gate returns HTTP 200 with actions + retry metadata.
                  if (res && typeof res === "object" && (res as any).verificationRequired) {
                    const msg: ScoutMessage = {
                      id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                      role: "assistant",
                      content:
                        typeof (res as any).message === "string" && (res as any).message.trim()
                          ? String((res as any).message)
                          : "Before I can post that request, you need to verify a requirement.",
                      timestamp: new Date().toISOString(),
                      clusters: [
                        {
                          id: `dc-verify-${Date.now()}`,
                          title: "Next step",
                          kind: "generic",
                          body: "Complete verification, then retry posting the request.",
                          primaryAction:
                            Array.isArray((res as any).actions) && (res as any).actions.length > 0
                              ? ((res as any).actions[0] as any)
                              : {
                                  type: "NAVIGATE",
                                  label: "Open verification",
                                  to: "/verification",
                                },
                        } as any,
                      ],
                    };

                    applyServerResponse(
                      msg,
                      Array.isArray((res as any).actions) ? (res as any).actions : []
                    );
                    return;
                  }

                  const createdId =
                    typeof (res as any)?.id === "string" ? String((res as any).id) : null;
                  const msg: ScoutMessage = {
                    id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    role: "assistant",
                    content: "Posted. Want to review it in Direct Connect?",
                    timestamp: new Date().toISOString(),
                    clusters: [
                      {
                        id: `dc-created-${Date.now()}`,
                        title: "Direct Connect",
                        kind: "generic",
                        body: createdId
                          ? "Your request is live. You can route it to local pros from the board."
                          : "Your request is live. You can route it to local pros from the board.",
                        primaryAction: {
                          type: "NAVIGATE",
                          label: "Open Direct Connect",
                          to: "/direct-connect",
                        },
                      },
                    ],
                  };

                  applyServerResponse(msg, [
                    { type: "NAVIGATE", label: "Open Direct Connect", to: "/direct-connect" },
                  ]);

                  recordActivity({
                    type: "direct_connect_request_created",
                    ts: new Date().toISOString(),
                    path: location,
                    meta: { workRequestId: createdId || undefined },
                  } as any);
                } catch (err: any) {
                  const message = formatUserFacingErrorMessage(
                    err,
                    "Failed to create Direct Connect request."
                  );
                  setError(message);
                } finally {
                  setDcBusy(false);
                  setDcConfirmOpen(false);
                  setDcDraft(null);
                }
              }}
            >
              {dcBusy ? "Posting..." : "Post request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tools & App drawer */}
      <ScoutToolsDrawer
        isOpen={toolsOpen}
        onClose={() => setToolsOpen(false)}
        onOpenWorkArea={(opts) => openWorkArea({ url: opts.url, title: opts.title })}
      />

      <ScoutWorkAreaSheet
        open={workAreaOpen}
        onOpenChange={setWorkAreaOpen}
        url={workAreaUrl}
        title={workAreaTitle}
      />
    </div>
  );
}
