import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
// Note: navigation is handled via AppShell top/bottom nav; ScoutOS focuses on chat.
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "../hooks/useIsMobile";
import AppDrawer from "../components/AppDrawer";
import { useScoutState } from "./state";
import ScoutThread from "./ScoutThread";
import { ScoutDirectConnectPanel } from "./ScoutDirectConnectPanel";
import ScoutInput from "./ScoutInput";
import ScoutToolsDrawer from "./ScoutToolsDrawer";
import {
  sendToScout,
  logScoutInsight,
  type ScoutLocality,
  type ScoutMode,
} from "./api";
import { executeScoutActions } from "./ScoutActionRouter";
import { getUserAudienceLabel } from "@/lib/copyHelpers";
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
import { ArrowRight, MessageCircle, Sparkles, Activity, ThumbsUp, ThumbsDown, Ban } from "lucide-react";
import { ScoutHeader } from "./ScoutHeader";
import { ScoutInputRow } from "./ScoutInputRow";
import { scoutActionTiles } from "./scoutActionTiles";
import { resolveAllTiles } from "./resolveScoutTiles";
import type { ScoutTileContext } from "./scoutActionTiles";
import { updateGeoPreferencesFromDeviceLocation } from "../agent/tools/geoPreferences";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { formatCityOnly } from "@/utils/locationDisplay";
import { openFloatingNote } from "@/lib/floatingNotes";
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
  proposeProviderProfileUpdate,
  type ProviderStanding,
  type ProviderProfileProposal,
} from "@/agent/tools/providers";
import { inferContextRoles, deriveModeFromContextRoles } from "./contextRoles";

const INTRO_DEMO_TEXT = "What can TradeScout do for my community?";
const INTRO_DEMO_SESSION_KEY = "ts_intro_demo_played_session";

const COUNTY_EXPLAINED_KEY = "scout:county_explained:v1";
const COUNTY_EXPLAINED_AT_KEY = "scout:county_explained_at";
const COUNTY_EXPLAINED_FOLLOWUP_KEY = "scout:county_explained_followup_recorded";

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
    out = `${out.slice(0, 77)}…`;
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

function tryRecordCountyExplanationFollowup(kind: "navigate" | "scout_message" | "gated_query_success", path: string) {
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
 * This is a response sanitation contract—Scout output must be user-facing only.
 */
function sanitizeScoutMessage(raw: unknown): string {
  if (typeof raw !== "string") return "";

  const trimmed = raw.trim();

  // Block entire JSON responses that contain internal reasoning fields
  if (
    trimmed.startsWith("{") &&
    (trimmed.includes('"intent"') ||
      trimmed.includes('"thought_flow"') ||
      trimmed.includes('"reasoning"') ||
      trimmed.includes('"decision"') ||
      trimmed.includes('"step-by-step"'))
  ) {
    console.warn("[Scout] Blocked internal reasoning leakage in response", { raw });
    return "I can help with that. Here's what TradeScout can do for your community:";
  }

  // If response looks like JSON with reasoning fields anywhere, strip and use fallback
  try {
    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed);
      if (
        parsed.intent ||
        parsed.thought_flow ||
        parsed.reasoning ||
        parsed.decision
      ) {
        console.warn("[Scout] Blocked JSON response with reasoning fields", {
          parsed,
        });
        return (
          parsed.message ||
          parsed.answer ||
          "I can help with that. Here's what TradeScout can do for your community:"
        );
      }
    }
  } catch {
    // Not JSON, continue with string validation
  }
  // Strip obvious internal reasoning sections from plain-text responses.
  const withoutInternal = trimmed
    .split("\n")
    .filter((line) => {
      const lower = line.trim().toLowerCase();
      if (!lower) return true;
      if (lower.startsWith("reasoning:")) return false;
      if (lower.startsWith("internal reasoning:")) return false;
      if (lower.startsWith("thought process:")) return false;
      if (lower.startsWith("analysis:")) return false;
      return true;
    })
    .join("\n")
    .trim();

  return withoutInternal || trimmed;
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

  // Keep only the first 1–3 sentences to match the
  // short-intent contract without changing the core answer.
  const sentences = trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length <= 3) return trimmed;

  const kept = sentences.slice(0, 3).join(" ");
  return kept.endsWith(".") || kept.endsWith("!") || kept.endsWith("?")
    ? kept
    : `${kept}…`;
}

export default function ScoutOS() {
  const { user, isAuthenticated, refetch: refetchUser } = useAuth();
  const [location, navigate] = useLocation();
  const isMobile = useIsMobile();

  const [appDrawerOpen, setAppDrawerOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [prefillKey, setPrefillKey] = useState(0);
  const [activeMode, setActiveMode] = useState<ScoutMode>("default");
  const [hasGuestInteracted, setHasGuestInteracted] = useState(false);
  const [firstIntroAppendix, setFirstIntroAppendix] = useState<string>("");
  const [introDemoText, setIntroDemoText] = useState("");
  const [introDemoState, setIntroDemoState] = useState<
    "idle" | "typing" | "armingSend" | "sending" | "done"
  >("idle");
  const [isUpdatingGeo, setIsUpdatingGeo] = useState(false);
  const introTimersRef = useRef<{
    typeTimer: number | null;
    startTimer: number | null;
  }>({ typeTimer: null, startTimer: null });
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

  // One-time init guard (keeps animations / welcome seed from re-running).
  // Removed client-side injected welcome message to avoid collision
  // with auto-typing demo. Scout should not speak until the user (or
  // auto demo) sends the first message.

  const unreadMessages =
    (user as any)?.unreadMessages ??
    (user as any)?.unreadMessageCount ??
    0;

  const unreadNotifications =
    (user as any)?.unreadNotifications ??
    (user as any)?.unreadNotificationCount ??
    0;

  const locationCtx = useLocationContext();
  const countyCommitted = hasCountyContext(locationCtx as any);

  const locality: ScoutLocality = useMemo(() => {
    return {
      // Align Scout locality with the canonical LocationContext for all reads.
      county: (locationCtx as any).countyName || (locationCtx as any).county,
      state: locationCtx.stateCode,
      // zip is still sourced from the user profile when present.
      zip: user?.zip,
      lat: locationCtx.lat,
      lng: locationCtx.lng,
    };
  }, [
    locationCtx.stateCode,
    (locationCtx as any).county,
    (locationCtx as any).countyName,
    locationCtx.lat,
    locationCtx.lng,
    user?.zip,
  ]);

  const hasMessages = state.messages.length > 0;

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

  // Ephemeral, derived context roles per message/page for tone + defaults
  const getContextRoles = useCallback((message: string): string[] => {
    const roles = inferContextRoles({
      message,
      pagePath: location,
      recentActions: state.lastActions.map((a) => a.type),
      inferredCapabilities: (user as any)?.capabilities ?? [],
    });
    return roles;
  }, [location, state.lastActions, user]);

  const userRoles = (user as any)?.roles as string[] | undefined;
  const hasRoles = Array.isArray(userRoles) && userRoles.length > 0;
  const isGuest = !isAuthenticated;
  const isSuperAdminTester =
    (Array.isArray(userRoles) && userRoles.some((r) => r.toLowerCase() === "super_admin")) ||
    (typeof sessionRole === "string" && sessionRole.toLowerCase() === "super_admin");

  const isBusy =
    state.status === "resolving_context" ||
    state.status === "checking_documents" ||
    state.status === "executing_action";

  // Watchdog: force idle state after 12 seconds if still busy
  // This ensures no user can ever be stuck, even if an API fails silently
  useEffect(() => {
    if (!isBusy) return;

    const timeout = setTimeout(() => {
      console.warn('[ScoutOS] Watchdog triggered - forcing idle state after 12s');
      setStatus("idle");
    }, 12000); // 12s max

    return () => clearTimeout(timeout);
  }, [isBusy, setStatus]);

  const hasUserMessages = useMemo(
    () => state.messages.some((m) => m.role === "user"),
    [state.messages]
  );

  // Disable auto-demo typing so Scout never speaks before the user does.
  // Scout should only respond after an explicit user intent (typing or tile).
  const shouldPlayIntroDemo = false;

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

  // First-time guest state: controls entire top half of Scout.
  // We treat this as "guest has not actively interacted yet" so that
  // auto-demo typing does NOT collapse the calm intro.
  const isFirstGuestVisit = isGuest && !hasGuestInteracted && !hasUserMessages;
  // Diagnostic: log intro demo gating values to verify which guard blocks (dev-only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      const sessionPlayed =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(INTRO_DEMO_SESSION_KEY);
      // One-line truth for debugging
      console.log("[INTRO DEMO CHECK]", {
        isAuthenticated,
        isGuest,
        hasMessages,
        hasUserMessages,
        introDemoState,
        sessionPlayed,
        shouldPlayIntroDemo,
      });
    } catch {
      // ignore
    }
  }, [isAuthenticated, isGuest, hasMessages, hasUserMessages, introDemoState, shouldPlayIntroDemo]);

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

    const normalized = roles.map((r) => r.toLowerCase());

    // Super-admins and operators get an admin-focused Scout persona.
    if (
      normalized.some((r) =>
        [
          "admin",
          "ops_admin",
          "super_admin",
          "head_admin",
          "owner",
        ].includes(r)
      )
    ) {
      return "admin";
    }

    if (
      normalized.some((r) =>
        ["restaurant_owner", "food_truck_owner", "bar_owner"].includes(r)
      )
    ) {
      return "mealscout";
    }

    if (
      normalized.some(
        (r) => r.startsWith("contractor:") || r === "contractor" || r === "pro"
      )
    ) {
      return "contractors";
    }
    if (normalized.some((r) => r.startsWith("realtor:") || r === "realtor")) {
      return "marketplace";
    }
    return "default";
  };

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
    const short = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;

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
          "Open my deal room",
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
      case "mealscout":
        base.push(
          "Open MealScout to see my current deals and subscriptions",
          "Help me create my next MealScout deal or menu update",
          "Show how MealScout and TradeScout work together for my area",
          "Open a floating note to keep this visible"
        );
        break;
      default:
        base.push(
          "Turn this into a trackable project on my board",
          "Find local contractors or groups who can help with this",
          "Open a floating note to keep this visible"
        );
        break;
    }

    // If the inferred context includes HOA board signals, tailor a few options.
    const roles = (opts?.contextRoles || []).map((r) => r.toLowerCase());
    if (roles.includes("hoa_board")) {
      base.splice(0, base.length,
        "Open HOA dashboard",
        "Post HOA notice",
        "Review dues and payments"
      );
    }

    if (roles.includes("marketplace_vendor") || roles.includes("vendor")) {
      base.splice(0, base.length,
        "Manage my listings",
        "Post a listing",
        "View offers"
      );
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
    async (
      value: string,
      explicitMode?: ScoutMode,
      opts?: { isScriptedIntro?: boolean }
    ) => {
      if (containsProfanity(value)) {
        const blocked: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: "That prompt isn’t allowed. Please keep it respectful.",
          timestamp: new Date().toISOString(),
        };

        // Keep a censored draft in the input so the user can quickly edit.
        try {
          window.localStorage.setItem(
            "scout:prefill:scout-main",
            censorProfanity(value)
          );
        } catch {
          // ignore
        }
        setPrefillKey((k) => k + 1);
        applyServerResponse(blocked, []);
        return;
      }

      const isFirstAnswer = !hasSeenFirstAnswer();
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

        if (!hasLoggedConfusionRef.current) {
          const looksConfused =
            /why[^\n]*\b(see|locked|show)\b/.test(normalized) ||
            /can['’]?t[^\n]*\bsee\b/.test(normalized);

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
        const contractorKeywords = ["contractor", "plumber", "electrician", "roofer", "hvac", "painter", "landscaper", "carpenter", "mason", "find a pro"];
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
        const marketplaceKeywords = ["marketplace", "for sale", "buying", "selling", "used", "buy", "sell", "list", "post"];
        const contactKeywords = ["contact", "support", "help desk", "reach out", "call", "phone", "text", "email", "mail"];
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
        const wantsContact = contactKeywords.some((kw) => lowerMsg.includes(kw));
        const wantsProviderOffer = providerOfferKeywords.some((kw) => lowerMsg.includes(kw));
        const wantsProviderStanding = providerStandingKeywords.some((kw) => lowerMsg.includes(kw));
        const wantsProviderPromotion = providerPromotionKeywords.some((kw) => lowerMsg.includes(kw));
        const wantsCommunityAnnouncement = communityAnnouncementKeywords.some((kw) => lowerMsg.includes(kw));

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
                  label: "Find help for a project",
                  payload: {
                    text: "Help me find someone local to do a project.",
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
                    text: "I am just looking around—suggest a quick tour of TradeScout.",
                  },
                },
              ],
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content: "Let’s get you a quick win.",
            timestamp: new Date().toISOString(),
            clusters: onboardingClusters,
            memoryDelta: {
              lastIntent: "onboarding_intent",
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
        // PROVIDER INTENT A: "I want to offer services here"
        // ------------------------------------------------------------------
        if (wantsProviderOffer && hasCountyContext(locationCtx)) {
          setStatus("executing_action");

          // Resolve a likely trade from the message using the trades catalog
          let selectedTrade: { id: string; name: string; slug?: string } | null = null;
          try {
            const tradesRes = await fetch("/api/trades", { credentials: "include" });
            if (tradesRes.ok) {
              const trades = (await tradesRes.json()) as { id: string; name: string; slug?: string }[];
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
          const countyName = (locationCtx as any).countyName || (locationCtx as any).county;
          const stateCode = (locationCtx as any).stateCode;

          let requirementsSummary: string | undefined;

          // Build a pure provider profile proposal; no writes, no API calls.
          const proposal: ProviderProfileProposal | null =
            selectedTrade && stateCode
              ? proposeProviderProfileUpdate({
                  services: [selectedTrade.name || selectedTrade.slug || ""].filter(Boolean),
                  serviceAreas: [
                    {
                      state: stateCode,
                      county: countyName,
                    },
                  ],
                })
              : null;

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
            content:
              selectedTrade && countyName && stateCode
                ? `I drafted a setup to offer ${selectedTrade.name.toLowerCase()} services in ${countyName}, ${stateCode}. Review and confirm it before we start promoting you.`
                : "I drafted a setup for your services in this area. Review and confirm it before saving.",
            timestamp: new Date().toISOString(),
            clusters,
            navTarget: "/offer-services?review=1",
            memoryDelta: {
              lastIntent: "provider_offer_here",
            },
            contextRoles,
            toolResult: proposal
              ? {
                  tool: "provider_profile_proposal",
                  success: true,
                  data: proposal,
                }
              : undefined,
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
        // PROVIDER INTENT B: "How strong is my presence here?"
        // ------------------------------------------------------------------
        if (wantsProviderStanding && hasCountyContext(locationCtx)) {
          setStatus("executing_action");

          const countyFips = (locationCtx as any).countyFips as string | undefined;
          const countyName = (locationCtx as any).countyName || (locationCtx as any).county;
          const stateCode = (locationCtx as any).stateCode;

          let standing: ProviderStanding | null = null;
          try {
            if (countyFips) {
              standing = await getProviderStanding({ countyFips });
            }
          } catch {
            standing = null;
          }

          if (!standing || !countyFips) {
            const msg: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content:
                "I couldn't read your presence for this county yet. Let's open your provider setup so you can review and adjust it.",
              timestamp: new Date().toISOString(),
              clusters: [
                {
                  id: "provider-standing-fallback",
                  title: "Review provider setup",
                  kind: "generic",
                  primaryAction: {
                    type: "NAVIGATE",
                    label: "Open provider setup",
                    to: "/offer-services",
                  },
                },
              ],
              navTarget: "/offer-services",
              memoryDelta: {
                lastIntent: "provider_standing_here",
              },
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
            content:
              countyName && stateCode
                ? `Here's how you're currently set up for ${countyName}, ${stateCode}.`
                : "Here's how you're currently set up for this area.",
            timestamp: new Date().toISOString(),
            clusters,
            navTarget: "/offer-services",
            memoryDelta: {
              lastIntent: "provider_standing_here",
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
            title = singleLine.length > 80 ? `${singleLine.slice(0, 77)}…` : singleLine;
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
            summaryLines.push(`Area: ${countyName}, ${stateCode}`);
          } else if (stateCode) {
            summaryLines.push(`Area: ${stateCode}`);
          }
          if (discountTypeForForm && discountValueForForm) {
            const discountLabel =
              discountTypeForForm === "percentage"
                ? `${discountValueForForm}% off`
                : `$${discountValueForForm} off`;
            summaryLines.push(`Discount: ${discountLabel}`);
          }
          summaryLines.push(`Window: ${startDateStr} → ${endDateStr}`);

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
            summaryLines.push(`Area: ${countyName}, ${stateCode}`);
          } else if (stateCode) {
            summaryLines.push(`Area: ${stateCode}`);
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
          else if (lowerMsg.includes("painter") || lowerMsg.includes("painting")) trade = "painting";
          else if (lowerMsg.includes("landscap")) trade = "landscaping";
          else if (lowerMsg.includes("carpenter") || lowerMsg.includes("carpentry")) trade = "carpentry";
          else if (lowerMsg.includes("mason")) trade = "masonry";

          const contractorResult = await searchContractors({
            trade,
            county: locality.county,
            state: locality.state,
            limit: 5,
          });
          

          if (contractorResult.success && Array.isArray(contractorResult.data) && contractorResult.data.length > 0) {
            const contractors: ContractorResult[] = contractorResult.data;
            const contractorClusters: ScoutCluster[] = contractors.slice(0, 3).map((c) => ({
              id: `contractor-${c.id}`,
              title: `${c.name} • ${c.trade}`,
              kind: "generic",
              body: `${c.rating ? `⭐ ${c.rating} (${c.reviewCount} reviews)` : "Not yet rated"}\n${c.location}\n${c.availability || "Availability unknown"}`,
              primaryAction: {
                type: "NAVIGATE",
                label: "View profile",
                to: c.profileUrl || `/contractors/${c.id}`,
              },
            }));

            const msg: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content: `Found ${contractors.length} ${trade} contractors near ${locality.county}, ${locality.state}. Here are the top matches:`,
              timestamp: new Date().toISOString(),
              clusters: contractorClusters,
              navTarget: "/contractors",
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
          } else {
            // No contractors found
            const msg: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content: `I couldn't find any ${trade} contractors in ${locality.county}, ${locality.state} right now. Try browsing all contractors or ask me about a different trade.`,
              timestamp: new Date().toISOString(),
              clusters: [
                {
                  id: "browse-all-contractors",
                  title: "Browse all contractors",
                  kind: "generic",
                  primaryAction: {
                    type: "NAVIGATE",
                    label: "Open",
                    to: "/contractors",
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
              .replace(/\b(post|list|sell|for sale|please|help|i want to|i'd like to|i would like to)\b/gi, "")
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
              content:
                `I drafted a listing for "${title}" based on what you described. Review it in Exchange and confirm before it goes live.`,
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
          if (marketplaceResult.success && Array.isArray(marketplaceResult.data) && marketplaceResult.data.length > 0) {
            const listings: MarketplaceResult[] = marketplaceResult.data;
            const listingClusters: ScoutCluster[] = listings.slice(0, 3).map((l) => ({
              id: `listing-${l.id}`,
              title: l.title,
              kind: "generic",
              body: `$${l.price}${l.condition ? ` • ${l.condition}` : ""}\n${l.location}\n${l.sellerName}${l.verified ? " ✓" : ""}`,
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
              id: "contact-email",
              title: "Email Us",
              kind: "generic",
              body: "Send us a detailed message at info.tradescout@gmail.com",
              primaryAction: {
                type: "EXTERNAL_LINK",
                label: "Send Email",
                to: "mailto:info.tradescout@gmail.com",
              },
            },
            {
              id: "contact-phone",
              title: "Call or Text",
              kind: "generic",
              body: "(850) 543-0748\nAvailable 24/7",
              actions: [
                {
                  type: "EXTERNAL_LINK",
                  label: "Call Now",
                  to: "tel:+18505430748",
                },
                {
                  type: "EXTERNAL_LINK",
                  label: "Text Us",
                  to: "sms:+18505430748",
                },
              ],
            },
            {
              id: "contact-help-center",
              title: "Help Center",
              kind: "generic",
              body: "Browse FAQs and guides",
              primaryAction: {
                type: "NAVIGATE",
                label: "Open Help",
                to: "/help",
              },
            },
          ];

          const msg: ScoutMessage = {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role: "assistant",
            content: "Here's how to reach our support team:",
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
        const isScriptedIntro =
          !isAuthenticated &&
          isFirstAnswer &&
          !!opts?.isScriptedIntro &&
          firstIntroAppendix.trim().length > 0;

        const smartSuggestions = buildSmartSuggestions(
          mode,
          value,
          res.suggestedActions,
          {
            isFirstAnswer,
            isGuest,
            intent: res.metadata?.intent,
            resolvedContext: res.metadata?.resolvedContext ?? null,
            contextRoles,
          }
        );

        const clusters: ScoutCluster[] = [];

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
                label: "👍 Helpful",
              },
              {
                type: "CALL_TOOL",
                name: "ads.feedback",
                args: { adId: res.sponsored.id, rating: "not_relevant", source: "scout" },
                label: "👎 Not relevant",
              },
              {
                type: "CALL_TOOL",
                name: "ads.feedback",
                args: { adId: res.sponsored.id, rating: "spam", source: "scout" },
                label: "🚫 Spam",
              },
            ],
          } as any);
          markAdSeen(res.sponsored.id);
        }

        // If the backend response reads like a generic template or provides a known
        // template frame, attach a concrete, pre-filled draft so the user leaves
        // with something actionable immediately.
        const looksLikeGenericTemplate =
          typeof res.message === "string" && /template\s+for\s+a\s+quote\s+request/i.test(res.message);
        const hasTemplateFrame = typeof res.frame?.templateId === "string" && res.frame.templateId.trim().length > 0;
        const prefilledDraft = looksLikeGenericTemplate || hasTemplateFrame ? buildAutoFilledDraft(value) : null;

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
              title: "Save your area and projects",
              kind: "generic",
              body: "Create a free account so Scout can remember your area and keep your projects synced.",
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
          clusters.push({
            id: `server-actions-${Date.now()}`,
            title: "Next actions",
            kind: "generic",
            body: "Tap to open a page or start a flow.",
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
            ? `${disciplined}\n\nHere’s your pre-filled request (ready to send):\n${prefilledDraft}`
            : disciplined;

        const finalContent =
          isFirstAnswer && typeof enrichedContent === "string" && enrichedContent.length > MAX_FIRST_MESSAGE_CHARS
            ? `${enrichedContent.slice(0, MAX_FIRST_MESSAGE_CHARS).trimEnd()}…`
            : enrichedContent;

        const msg: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: finalContent,
          timestamp: res.timestamp || new Date().toISOString(),
          suggestedActions: smartSuggestions,
          clusters: clusters.length ? clusters : undefined,
          frame: res.frame,
          contextRoles: getContextRoles(value),
        };

        applyServerResponse(msg, res.actions);

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

          if (countyCommitted && !alreadyExplained) {
            const explanation: ScoutMessage = {
              id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              role: "assistant",
              content:
                "Behind the scenes, TradeScout uses your saved home county as the single source of truth for what counts as local. That same county powers your community feed, marketplace, HOA tools, and leaderboards, and changing it later in Settings → Your Home County updates everything; your device location alone does not.",
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
        setError(err.message || "Unknown error");
        logScoutInsight({
          message: value,
          mode,
          locality,
          success: false,
          latencyMs,
          error: err.message || "Unknown error",
        });
      } finally {
        setStatus("idle");
      }
    },
    [
      applyServerResponse,
      buildSmartSuggestions,
      firstIntroAppendix,
      isAuthenticated,
      isGuest,
      locality,
      location,
      navigate,
      recordUserMessage,
      sessionRole,
      setPrefillKey,
      setError,
      state.messages,
      userRoles,
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
    (action: ScoutAction) => {
      if (action.type === "NAVIGATE") {
        const ttaMs = renderStartRef.current ? Date.now() - renderStartRef.current : undefined;
        recordActivity({
          type: "navigate",
          ts: new Date().toISOString(),
          path: location,
          to: action.to ?? action.path,
          label: action.label,
          meta: {
            ...(typeof action.payload?.jobId === "string" ? { jobId: action.payload.jobId as string } : {}),
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

      executeScoutActions([action], {
        navigate: (to) => navigate(to),
        openAppDrawer: () => setAppDrawerOpen(true),
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
      setStatus("idle");
    },
    [
      location,
      navigate,
      handleSend,
    ]
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
  const heroAudienceLabel = getUserAudienceLabel(user as any);
  const heroHeadlineTarget = (() => {
    if (isAuthenticated && heroLocationLabel) {
      return heroLocationLabel;
    }
    if (heroLocationLabel && heroLocationLabel.toLowerCase() !== "your area") {
      return heroLocationLabel;
    }
    return "your area";
  })();

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
    myProjects?: Array<{ id: string; title: string; contractorName?: string | null; updatedAt?: string | Date | null }>
  }>({
    queryKey: ["/api/dashboard", user?.id],
    queryFn: () => apiRequest("GET", "/api/dashboard"),
    enabled: !!user?.id && countyCommitted,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch invoices for tile context (deterministic personalization)
  const { data: invoicesData } = useQuery<
    Array<{ id: string; jobName?: string | null; status: string; updatedAt?: string | Date | null; amount?: number | null }>
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
        const usedVariant = tile.label !== original.label || tile.description !== original.description;
        
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

  const handleActionTile = useCallback(
    (tile: typeof scoutActionTiles[0]) => {
      // Derive lightweight variant metadata for KPI logging
      const isFresh = (updatedAt: string | Date | null | undefined, days = 14) => {
        if (!updatedAt) return false;
        const t = typeof updatedAt === "string" ? new Date(updatedAt).getTime() : new Date(updatedAt).getTime();
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
        (user as any)?.name ||
        (user as any)?.fullName ||
        (user as any)?.displayName ||
        undefined;

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
          [
            email ? `Email: ${email}` : undefined,
            phone ? `Phone: ${phone}` : undefined,
          ]
            .filter(Boolean)
            .join(" \n")
        );
      }

      parts.push("Thank you!");
      return parts.filter((p) => typeof p === "string" && p.trim().length > 0).join("\n\n");
    }, [user, locality]
  );

  return (
    <div className="scout-shell flex flex-col flex-1 min-h-0 w-full items-center text-white overflow-hidden">
      <div className="scout-content w-full flex flex-col flex-1 min-h-0">
        <div
          className={`w-full ${
            isMobile ? "px-3 pt-3 pb-24" : "max-w-5xl px-4 pt-4 pb-12"
          } flex flex-col flex-1 min-h-0`}
          style={{ paddingBottom: isMobile ? 'calc(6rem + env(safe-area-inset-bottom))' : undefined }}
        >
        {/* Main conversation layout: used for all users, including first-time guests. */}
        <div
          className={
            isMobile
              ? "max-w-xl mx-auto w-full flex flex-col flex-1 min-h-0"
              : "mx-auto w-full flex flex-1 min-h-0 max-w-5xl gap-4"
          }
        >
          <div className="w-full flex flex-col flex-1 min-h-0 max-w-xl">
            <ScoutHeader
              isAuthenticated={isAuthenticated}
              isFirstGuestVisit={isFirstGuestVisit}
                        locationLabel={heroLocationLabel}
            />

              {/* Thread + input in a single chat container that stretches toward
                  the bottom of the viewport, with the input pinned just above
                  the global bottom nav. */}
            <div
              className={`mt-2 flex flex-col flex-1 min-h-0 ${
                isMobile ? "space-y-2" : "space-y-2"
              }`}
              style={{ paddingBottom: isMobile ? '2rem' : '1.5rem' }}
            >
            {!hasUserMessages && (
              <div className="flex flex-col gap-3 py-3 px-1">
                <div className="space-y-1">
                  <p className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>
                    I help you get things done in your local community.
                  </p>
                  <p className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Tell me what you want to do, and I&apos;ll take you there.
                  </p>
                </div>

                {/* Primary action grid: navigation with intent, not chat suggestions */}
                {countyCommitted ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {resolvedTiles.map((tile) => (
                      <button
                        key={tile.id}
                        onClick={() => {
                          setHasGuestInteracted(true);
                          handleActionTile(tile);
                        }}
                        className="flex flex-col items-start justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3 text-left hover:border-orange-400/80 transition-colors"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <span className="font-medium text-sm mb-0.5">{tile.label}</span>
                        {tile.description && (
                          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {tile.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3">
                    <p className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>
                      You&apos;re viewing nearby activity. Set your home county to unlock fully local pros, posts, and jobs.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-3 text-[11px] bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                        onClick={() => navigate(ROUTES.SETTINGS)}
                      >
                        Set my county
                      </Button>
                    </div>
                  </div>
                )}

                {/* Optional, collapsed explanation about TradeScout (secondary) */}
                <details className="mt-2 text-left">
                  <summary className="text-[11px] md:text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                    What is TradeScout?
                  </summary>
                  <p className="mt-1 text-[11px] md:text-xs" style={{ color: 'var(--text-secondary)' }}>
                    TradeScout helps people connect, work, and trade locally — without spam, paywalls, or fake leads.
                  </p>
                </details>
              </div>
            )}

            <ScoutThread
                messages={state.messages}
                status={state.status}
                mode={activeMode}
                onAction={handleClusterAction}
                onQuickAction={(text) => {
                  const trimmed = text.trim();

                  // Mark that the user has interacted so we don't keep showing
                  // first-visit-only affordances.
                  setHasGuestInteracted(true);

                  // Certain smart suggestions should behave as direct actions
                  // instead of just re-asking Scout with the same text.
                  if (trimmed === "Turn this into a trackable project on my board") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/request-quote",
                      label: trimmed,
                    });
                    navigate("/request-quote");
                    return;
                  }

                  if (trimmed === "Open my community feed in TradeScout") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: ROUTES.COMMUNITY,
                      label: trimmed,
                    });
                    navigate(ROUTES.COMMUNITY);
                    return;
                  }

                  if (trimmed === "Show Exchange listings that match this need near me") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/exchange",
                      label: trimmed,
                    });
                    navigate("/exchange");
                    return;
                  }

                  if (trimmed === "Post a listing") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/exchange?new=1",
                      label: trimmed,
                    });
                    navigate("/exchange?new=1");
                    return;
                  }

                  if (trimmed === "Manage my listings") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/exchange?tab=my-listings",
                      label: trimmed,
                    });
                    navigate("/exchange?tab=my-listings");
                    return;
                  }

                  if (trimmed === "View offers") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/exchange?tab=offers",
                      label: trimmed,
                    });
                    navigate("/exchange?tab=offers");
                    return;
                  }

                  if (trimmed === "Find a Contractor") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: ROUTES.CONTRACTORS,
                      label: trimmed,
                    });
                    navigate(ROUTES.CONTRACTORS);
                    return;
                  }

                  if (trimmed === "Open my Notes" || trimmed === "Open Notes") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: ROUTES.NOTES,
                      label: trimmed,
                    });
                    navigate(ROUTES.NOTES);
                    return;
                  }

                  if (trimmed === "Create Account") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: ROUTES.REGISTER,
                      label: trimmed,
                    });
                    navigate(ROUTES.REGISTER);
                    return;
                  }

                  if (trimmed === "Leaderboard") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/leaderboard",
                      label: trimmed,
                    });
                    navigate("/leaderboard");
                    return;
                  }

                  if (
                    trimmed === "Open MealScout" ||
                    trimmed ===
                      "Open MealScout to browse local food and drink deals" ||
                    trimmed ===
                      "Open MealScout so I can manage or post deals for this" ||
                    trimmed ===
                      "Open MealScout to see my current deals and subscriptions"
                  ) {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/mealscout",
                      label: trimmed,
                    });
                    navigate("/mealscout");
                    return;
                  }

                  if (trimmed === "Show local groups, HOAs, and boards I can join or follow") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/hoa-management",
                      label: trimmed,
                    });
                    navigate("/hoa-management");
                    return;
                  }

                  if (trimmed === "Open my Admin Panel and monitoring tools") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/admin-panel",
                      label: trimmed,
                    });
                    navigate("/admin-panel");
                    return;
                  }

                  if (trimmed === "Show recent Finance / Invoicing ledger activity") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/admin-panel?tab=finance",
                      label: trimmed,
                    });
                    navigate("/admin-panel?tab=finance");
                    return;
                  }

                  if (trimmed === "Open my deal room") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/lead-management",
                      label: trimmed,
                    });
                    navigate("/lead-management");
                    return;
                  }

                  if (trimmed === "View invoices and payments") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/finances",
                      label: trimmed,
                    });
                    navigate("/finances");
                    return;
                  }

                  if (trimmed === "Post a new job") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/lead-management?new=1",
                      label: trimmed,
                    });
                    navigate("/lead-management?new=1");
                    return;
                  }

                  if (
                    trimmed === "Open a floating note" ||
                    trimmed === "Open floating note" ||
                    trimmed === "Open a quick note" ||
                    trimmed === "Open quick note"
                  ) {
                    recordActivity({
                      type: "open_note",
                      ts: new Date().toISOString(),
                      path: location,
                      label: trimmed,
                    });
                    void openFloatingNote("quick");
                    return;
                  }

                  if (trimmed === "Help me send a targeted broadcast announcement from Notification Ops") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/admin-panel?tab=notification-ops",
                      label: trimmed,
                    });
                    navigate("/admin-panel?tab=notification-ops");
                    return;
                  }

                  // HOA-focused quick actions
                  if (trimmed === "Open HOA dashboard") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/hoa-dashboard",
                      label: trimmed,
                    });
                    navigate("/hoa-dashboard");
                    return;
                  }

                  if (trimmed === "Post HOA notice") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/hoa-management?tab=notices",
                      label: trimmed,
                    });
                    navigate("/hoa-management?tab=notices");
                    return;
                  }

                  if (trimmed === "Review dues and payments") {
                    recordActivity({
                      type: "navigate",
                      ts: new Date().toISOString(),
                      path: location,
                      to: "/hoa-dashboard?tab=dues",
                      label: trimmed,
                    });
                    navigate("/hoa-dashboard?tab=dues");
                    return;
                  }

                  // Fallback: treat as a normal prompt to Scout so it can
                  // reason about next steps.
                  handleSend(trimmed);
                }}
              />

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
              autoDemoText={undefined}
              enableAutoDemo={false}
            />

            {!isAuthenticated && (
              <div className="text-xs text-slate-300/90">
                You can explore freely.{' '}
                <button
                  type="button"
                  className="text-tsAccent hover:text-orange-400 font-medium"
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>{' '}
                to save, post, or message.
              </div>
            )}
          </div>
          </div>

          {/* Right-side coordination panel on larger screens; stacks below chat on mobile. */}
          {isMobile ? (
            <div className="mt-4">
              <ScoutDirectConnectPanel isAuthenticated={isAuthenticated} />
            </div>
          ) : (
            <div className="hidden md:flex w-80 flex-shrink-0">
              <ScoutDirectConnectPanel isAuthenticated={isAuthenticated} />
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Tools & App drawer */}
      <ScoutToolsDrawer isOpen={toolsOpen} onClose={() => setToolsOpen(false)} />

      <AppDrawer
        isOpen={appDrawerOpen}
        onClose={() => setAppDrawerOpen(false)}
        isAdmin={Boolean(user?.isAdmin)}
      />
    </div>
  );
}
