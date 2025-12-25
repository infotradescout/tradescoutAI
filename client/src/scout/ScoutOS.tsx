import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
// Note: navigation is handled via AppShell top/bottom nav; ScoutOS focuses on chat.
import { useAuth } from "../hooks/useAuth";
import { useIsMobile } from "../hooks/useIsMobile";
import AppDrawer from "../components/AppDrawer";
import { useScoutState } from "./state";
import ScoutThread from "./ScoutThread";
import ScoutInput from "./ScoutInput";
import ScoutToolsDrawer from "./ScoutToolsDrawer";
import {
  sendToScout,
  logScoutInsight,
  type ScoutLocality,
  type ScoutMode,
} from "./api";
import { executeScoutActions } from "./ScoutActionRouter";
import { getUserLocationLabel, getUserAudienceLabel } from "@/lib/copyHelpers";
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
import { ArrowRight, MessageCircle, Sparkles, Activity } from "lucide-react";
import { ScoutSuggestions } from "./ScoutSuggestions";
import { ScoutHeader } from "./ScoutHeader";
import { ScoutInputRow } from "./ScoutInputRow";
import { updateGeoPreferencesFromDeviceLocation } from "../agent/tools/geoPreferences";
import { openFloatingNote } from "@/lib/floatingNotes";
import { searchContractors, searchMarketplace } from "../agent/tools/scoutTools";
import { inferContextRoles, deriveModeFromContextRoles } from "./contextRoles";

const INTRO_DEMO_TEXT = "What can TradeScout do for my community?";
const INTRO_DEMO_SESSION_KEY = "ts_intro_demo_played_session";

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

  return trimmed;
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
  const [autoPromptSuggestions, setAutoPromptSuggestions] = useState<string[]>([]);
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

  const locality: ScoutLocality = useMemo(() => {
    const prefsGeo = (user as any)?.preferences?.geo;
    const homeLocation = prefsGeo?.homeLocation as
      | { lat?: number; lng?: number; label?: string }
      | undefined;

    return {
      // Prefer a stored geo home-location label when explicit county
      // is missing; otherwise keep using the canonical user county.
      county: user?.county || (homeLocation?.label as string | undefined),
      state: user?.state,
      zip: user?.zip,
      // Prefer precise geo from preferences when available.
      lat: typeof homeLocation?.lat === "number" ? homeLocation.lat : user?.latitude,
      lng: typeof homeLocation?.lng === "number" ? homeLocation.lng : user?.longitude,
    };
  }, [
    user?.county,
    user?.state,
    user?.zip,
    user?.latitude,
    user?.longitude,
    (user as any)?.preferences?.geo?.homeLocation?.label,
    (user as any)?.preferences?.geo?.homeLocation?.lat,
    (user as any)?.preferences?.geo?.homeLocation?.lng,
  ]);

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

  const hasMessages = state.messages.length > 0;

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

  const shouldPlayIntroDemo =
    isGuest &&
    !hasPlayedDemoThisSession &&
    !hasUserMessages;

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
  // Diagnostic: log intro demo gating values to verify which guard blocks
  useEffect(() => {
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

  // Load auto-prompt suggestions for initial quick-tap chips
  useEffect(() => {
    let cancelled = false;

    fetch("/api/scout/auto-prompt", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const raw = Array.isArray(data.suggestions) ? data.suggestions : [];
        const cleaned = raw
          .map((s: unknown) =>
            typeof s === "string" ? sanitizeSuggestionLabel(s) : ""
          )
          .filter((s: string) => s.length > 0 && !isWeakSuggestionLabel(s));
        if (cleaned.length > 0) {
          setAutoPromptSuggestions(cleaned.slice(0, 6));
        }
      })
      .catch(() => {
        // If auto-prompt suggestions fail, we fall back to static chips.
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
          "Draft a listing I can post based on this",
          "Alert me if new local deals match this search",
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
       let activeTool: string | null = null;

      // User message is recorded into the thread; we immediately move into
      // a short RESOLVING_CONTEXT state so the UI can show progress without
      // exposing any internal reasoning text.
      recordUserMessage(value);
      setStatus("resolving_context");
      recordActivity({
        type: "ask_scout",
        ts: new Date().toISOString(),
        path: location,
        label: value.slice(0, 160),
      });

      try {
        // ==================================================================
        // INTENT DETECTION: Check if user wants a contractor or marketplace search
        // ==================================================================
        const lowerMsg = value.toLowerCase();
        const contractorKeywords = ["contractor", "plumber", "electrician", "roofer", "hvac", "painter", "landscaper", "carpenter", "mason", "find a pro"];
        const marketplaceKeywords = ["marketplace", "for sale", "buying", "selling", "used", "buy", "sell"];
        const contactKeywords = ["contact", "support", "help desk", "reach out", "call", "phone", "text", "email", "mail"];
        
        const wantsContractor = contractorKeywords.some(kw => lowerMsg.includes(kw));
        const wantsMarketplace = marketplaceKeywords.some(kw => lowerMsg.includes(kw));
        const wantsContact = contactKeywords.some(kw => lowerMsg.includes(kw));

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
           activeTool = null;

          if (contractorResult.success && contractorResult.data && contractorResult.data.length > 0) {
            const contractors = contractorResult.data;
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
        // MARKETPLACE SEARCH INTENT
        // ------------------------------------------------------------------
        if (wantsMarketplace && locality?.state) {
          setStatus("executing_action");
           activeTool = "searchMarketplace";

          const marketplaceResult = await searchMarketplace({
            query: value,
            location: locality.state,
            limit: 5,
          });
           activeTool = null;

          if (marketplaceResult.success && marketplaceResult.data && marketplaceResult.data.length > 0) {
            const listings = marketplaceResult.data;
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
              memoryDelta: {
                lastIntent: "marketplace_search",
              },
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
            logScoutInsight({
              message: value,
              mode,
              locality,
              success: true,
              latencyMs,
            });
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
          });
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

          // Provide a direct Notes entry as a first-answer chip
          clusters.push({
            id: "first-nav-notes",
            title: "Open Notes",
            kind: "generic",
            primaryAction: {
              type: "NAVIGATE",
              label: "Open",
              to: ROUTES.NOTES,
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

        const mergedMessage = isScriptedIntro
          ? `${res.message}\n\n${firstIntroAppendix.trim()}`
          : res.message;

        // Keep Scout's very first answer tight so it never feels
        // like a wall of text or gets visually "cut off" behind
        // navigation. This is a hard character cap, tuned for the
        // current layout.
        const MAX_FIRST_MESSAGE_CHARS = 600;
        
        // CRITICAL: Sanitize the message to remove any internal reasoning leakage
        const sanitized = sanitizeScoutMessage(res.message);

        const enrichedContent =
          prefilledDraft && typeof sanitized === "string"
            ? `${sanitized}\n\nHere’s your pre-filled request (ready to send):\n${prefilledDraft}`
            : sanitized;

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

  // Intro demo typing is handled by ScoutInput; we only supply
  // session-scoped enable flag and the demo text.

  const handleClusterAction = useCallback(
    (action: ScoutAction) => {
      if (action.type === "NAVIGATE") {
        recordActivity({
          type: "navigate",
          ts: new Date().toISOString(),
          path: location,
          to: action.to ?? action.path,
          label: action.label,
          meta:
            typeof action.payload?.jobId === "string"
              ? { jobId: action.payload.jobId as string }
              : undefined,
        });
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

  const heroLocationLabel = getUserLocationLabel(user as any);
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
        <div className="max-w-xl mx-auto w-full flex flex-col flex-1 min-h-0">
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
              <ScoutSuggestions
                hasUserMessages={hasUserMessages}
                autoPromptSuggestions={autoPromptSuggestions}
                heroLocationLabel={heroLocationLabel || "your area"}
                heroAudienceLabel={heroAudienceLabel}
                onPromptClick={(prompt) => {
                  setHasGuestInteracted(true);
                  try {
                    if (typeof window !== "undefined") {
                      window.localStorage.removeItem("scout:prefill:scout-main");
                    }
                  } catch {
                    // ignore storage errors
                  }
                  setPrefillKey((k) => k + 1);
                  handleSend(prompt);
                }}
              />
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
              autoDemoText={introDemoText}
              enableAutoDemo={shouldPlayIntroDemo}
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
