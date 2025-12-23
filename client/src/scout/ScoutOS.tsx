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

const INTRO_DEMO_TEXT = "What can TradeScout do for my community?";
// Bump the storage key so the scripted intro demo runs again for
// users who previously saw v3 and had it permanently disabled.
const INTRO_DEMO_STORAGE_KEY = "ts_intro_demo_v4";

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
  const [introDemoState, setIntroDemoState] = useState<
    "idle" | "typing" | "armingSend" | "sending" | "done"
  >("idle");
  const [isUpdatingGeo, setIsUpdatingGeo] = useState(false);
  const introTimersRef = useRef<{
    typeTimer: number | null;
    startTimer: number | null;
  }>({ typeTimer: null, startTimer: null });
  const hasPlayedIntroDemoRef = useRef(false);
  const { sessionRole } = useSession();

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

  const hasUserMessages = useMemo(
    () => state.messages.some((m) => m.role === "user"),
    [state.messages]
  );

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
  const isFirstGuestVisit = isGuest && !hasGuestInteracted && !hasMessages;

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
    }
  ): string[] => {
    const base: string[] = [];
    const trimmed = userMessage.trim();
    const short = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
    const lower = trimmed.toLowerCase();

    const intent = opts?.intent?.toLowerCase() || "";
    const ctx = opts?.resolvedContext;

    // Finances / job flow-aware suggestions when we have a resolved context
    if (ctx && Array.isArray(ctx.allowedActions) && ctx.allowedActions.length) {
      const allowed = ctx.allowedActions;
      const projectBase: string[] = [];

      const hasOpenDealRoom = allowed.includes("OPEN_DEAL_ROOM");
      const canSendInvoice = allowed.includes("SEND_INVOICE") || allowed.includes("GENERATE_INVOICE");
      const canMarkPaid = allowed.includes("MARK_INVOICE_PAID");
      const canSendContract = allowed.includes("SEND_CONTRACT") || allowed.includes("SIGN_CONTRACT");

      if (canSendInvoice) {
        projectBase.push("Open invoices so I can review and send this invoice");
      }
      if (canMarkPaid) {
        projectBase.push("Open invoices so I can mark this invoice paid");
      }
      if (canSendContract) {
        projectBase.push("Open my finances dashboard so I can handle the contract and money for this job");
      }
      if (hasOpenDealRoom && projectBase.length === 0) {
        projectBase.push("Open my finances dashboard for this job so I can move this forward");
      }
      if (ctx.blockingReason) {
        projectBase.push("Explain what’s blocking this project and show how to unblock it");
      }

      if (projectBase.length) {
        const uniqueProject: string[] = [];
        for (const raw of projectBase) {
          const s = sanitizeSuggestionLabel(raw);
          if (!s || isWeakSuggestionLabel(s)) continue;
          if (!uniqueProject.includes(s)) uniqueProject.push(s);
          if (uniqueProject.length >= 3) break;
        }
        if (uniqueProject.length) {
          return uniqueProject.slice(0, 3);
        }
      }
    }

    // Very first OS orientation: suggestions should help them explore the platform,
    // not feel like generic chat actions.
    if (opts?.isFirstAnswer) {
      if (opts.isGuest) {
        // First-time guests should see clear, allowed actions that don't
        // require an existing account.
        base.push(
          "Create Account",
          "Find a Contractor",
          "Leaderboard"
        );
      } else {
        base.push(
          "Show me everything TradeScout can do for my situation",
          "Help me set up TradeScout for where I live",
          "Suggest 3 high-impact ways to use TradeScout this week"
        );
      }
    } else {
      // Light trade/topic/community-aware nudging
      const isPlumbing = /leak|clog|drain|sewer|sump pump|water heater|plumbing/.test(lower);
      const isElectrical = /panel|breaker|gfci|afci|outlet|receptacle|electrical/.test(lower);
      const isRoofing = /roof|shingle|hail|storm damage|leak/.test(lower);
      const isTaxOrPermit = /permit|inspection|code|zoning|setback|property tax|assessment/.test(lower);
      const isCommunity = /community|neighbors?|neighbours?|hoa|association|group|groups|club|meet people|connect with my local community/.test(lower);
      const isFoodOrEvents = /food|coffee|lunch|dinner|restaurant|truck|catering|snack|meal|bar|brewery|pub|happy hour|cocktail|drinks?/.test(lower);
      const isMoneyOrEstimate = /budget|cost|price|estimate|quote|afford|finance|loan|payment/.test(lower);
      const isOverwhelmed = /overwhelmed|confused|don['’]t understand|not sure where to start|lost/.test(lower);

      switch (mode) {
        case "contractors":
          if (isOverwhelmed) {
            base.push(
              "Break this into 3 clear steps I can take next",
              "Summarize the main decisions I need to make for this job",
              "Turn this into a trackable project on my board"
            );
          } else if (isPlumbing || isElectrical || isRoofing || isMoneyOrEstimate || intent === "estimate") {
            base.push(
              "Estimate realistic price ranges and timing for this job",
              "Find vetted pros for this exact job in my county",
              "Turn this into a project I can track and compare bids on"
            );
          } else {
            base.push(
              "Find vetted local contractors for this and queue intros",
              "Draft a message I can send to the top matches",
              "Turn this into a trackable project on my board"
            );
          }
          break;
        case "mealscout":
          if (isOverwhelmed) {
            base.push(
              "Explain how MealScout works for my business",
              "Break this MealScout idea into 3 clear steps",
              "Recommend the right MealScout plan and next actions"
            );
          } else if (isMoneyOrEstimate) {
            base.push(
              "Help me price and structure a MealScout deal for this",
              "Draft a MealScout promo I can post based on this",
              "Estimate how many customers this MealScout deal could reach"
            );
          } else if (isFoodOrEvents) {
            base.push(
              "Open MealScout so I can manage or post deals for this",
              "Show examples of high-performing MealScout promos like this",
              "Connect this idea to my TradeScout community and MealScout deals"
            );
          } else {
            base.push(
              "Open MealScout to see my current deals and subscriptions",
              "Help me create my next MealScout deal or menu update",
              "Show how MealScout and TradeScout work together for my area"
            );
          }
          break;
        case "admin":
          base.push(
            "Open my Admin Panel and monitoring tools",
            "Show recent Finance / Invoicing ledger activity",
            "Help me send a targeted broadcast announcement from Notification Ops"
          );
          break;
        case "marketplace":
          base.push(
            "Show Exchange listings that match this need near me",
            "Draft a listing I can post based on this",
            "Alert me if new local deals match this search"
          );
          break;
        default:
          if (isOverwhelmed) {
            base.push(
              "Break this into 3 concrete steps for me",
              "Highlight what matters most so I don’t get stuck",
              "Suggest the right TradeScout view or tool for this"
            );
          } else if (isTaxOrPermit) {
            base.push(
              "Help me understand local permits or code rules for this",
              "Find vetted pros who already know these rules in my county",
              "Summarize my options and next steps for this situation"
            );
          } else if (isCommunity) {
            base.push(
              "Open my community feed in TradeScout",
              "Show local groups, HOAs, and boards I can join or follow",
              "Draft a welcome or intro post I can share with my community"
            );
          } else if (isFoodOrEvents) {
            base.push(
              "Open MealScout to browse local food and drink deals",
              "Help me plan this around nearby restaurants, food trucks, and events",
              "Turn this into a small event I can track and share"
            );
          } else {
            base.push(
              "Turn this into a trackable project on my board",
              "Find local contractors or groups who can help with this",
              "Open the TradeScout view that fits this best (projects, community, or marketplace)"
            );
          }
          break;
      }
    }

    const server = (serverSuggestions ?? [])
      .filter(Boolean)
      .map((s) => sanitizeSuggestionLabel(String(s)))
      .filter((s) => s && !isWeakSuggestionLabel(s));
    const merged: string[] = [];

    // Prefer our local, mode-aware suggestions first so they stay tightly
    // connected to the conversation and product surface, then backfill
    // with any high-quality server suggestions.
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

      const mode: ScoutMode = explicitMode ?? inferModeFromRoles(rolesForRequest);
      setActiveMode(mode);

      const start = performance.now();
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

        if (isFirstAnswer) {
          clusters.push(
            {
              id: "first-nav-contractors",
              title: "Browse local professionals",
              kind: "generic",
              primaryAction: {
                type: "NAVIGATE",
                label: "Open",
                to: ROUTES.CONTRACTORS,
              },
            },
            {
              id: "first-nav-community",
              title: "Open community feed",
              kind: "generic",
              primaryAction: {
                type: "NAVIGATE",
                label: "Open",
                to: ROUTES.COMMUNITY,
              },
            },
            {
              id: "first-nav-marketplace",
              title: "Explore Exchange",
              kind: "generic",
              primaryAction: {
                type: "NAVIGATE",
                label: "Open",
                to: "/exchange",
              },
            }
          );

          if (isGuest) {
            clusters.push({
              id: "first-account-prompt",
              title: "Get set up in TradeScout",
              kind: "generic",
              body:
                "Here are three powerful first steps to take with Scout right now:\n\n1. Create a free account so Scout can remember your area, projects, and contractors.\n2. Post a question or update in your community feed so neighbors and local pros can respond.\n3. If you're a contractor, join the Contractor board to start getting local leads.",
              actions: [
                {
                  type: "NAVIGATE",
                  label: "Create account",
                  to: ROUTES.REGISTER,
                },
                {
                  type: "NAVIGATE",
                  label: "Post in community feed",
                  to: ROUTES.COMMUNITY,
                },
                {
                  type: "NAVIGATE",
                  label: "Join Contractor board",
                  to: ROUTES.CONTRACTOR_BOARD,
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
        const finalContent =
          isFirstAnswer && typeof mergedMessage === "string" && mergedMessage.length > MAX_FIRST_MESSAGE_CHARS
            ? `${mergedMessage.slice(0, MAX_FIRST_MESSAGE_CHARS).trimEnd()}…`
            : mergedMessage;

        const msg: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: finalContent,
          timestamp: res.timestamp || new Date().toISOString(),
          suggestedActions: smartSuggestions,
          clusters: clusters.length ? clusters : undefined,
          frame: res.frame,
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

  // Intro demo: scripted first message (type -> pulse send -> real send)
  useEffect(() => {
    // Load persisted flag once
    if (!hasPlayedIntroDemoRef.current) {
      if (isSuperAdminTester) {
        // Super admins should see the intro demo on each
        // new session's first visit to Scout, regardless of
        // any previous localStorage flag.
        hasPlayedIntroDemoRef.current = false;
      } else {
        try {
          hasPlayedIntroDemoRef.current =
            typeof window !== "undefined" &&
            window.localStorage.getItem(INTRO_DEMO_STORAGE_KEY) === "1";
        } catch {
          hasPlayedIntroDemoRef.current = false;
        }
      }
    }

    // Only run on an empty thread, and only once per browser.
    // If a Help Center intent is queued, let that drive the first
    // interaction instead of the scripted demo to avoid double prompts.
    if (hasMessages) return;
    if (hasSeenFirstAnswer()) return;
    if (hasPlayedIntroDemoRef.current) return;
    if (introDemoState !== "idle") return;

    try {
      if (typeof window !== "undefined") {
        const queuedHelpIntent = window.localStorage.getItem("scout:help-intent");
        if (queuedHelpIntent) {
          return;
        }
      }
    } catch {
      // ignore storage errors and fall back to normal intro behavior
    }

    let cancelled = false;

    const clearTimers = () => {
      if (introTimersRef.current.startTimer !== null) {
        window.clearTimeout(introTimersRef.current.startTimer);
        introTimersRef.current.startTimer = null;
      }
      if (introTimersRef.current.typeTimer !== null) {
        window.clearTimeout(introTimersRef.current.typeTimer);
        introTimersRef.current.typeTimer = null;
      }
    };

    const startTyping = (full: string) => {
      if (cancelled) return;
      setIntroDemoState("typing");
      setIntroDemoText("");
      let idx = 0;

      const step = () => {
        if (cancelled) return;
        idx += 1;
        setIntroDemoText(full.slice(0, idx));
        if (idx < full.length) {
          introTimersRef.current.typeTimer = window.setTimeout(step, 45) as unknown as number;
        } else {
          // Finished typing: pulse send briefly, then send for real
          setIntroDemoState("armingSend");
          introTimersRef.current.typeTimer = window.setTimeout(() => {
            if (cancelled) return;
            setIntroDemoState("sending");
            setHasGuestInteracted(true);
            void handleSend(full, undefined, { isScriptedIntro: true });
            if (!isSuperAdminTester) {
              try {
                window.localStorage.setItem(INTRO_DEMO_STORAGE_KEY, "1");
              } catch {
                // ignore
              }
            }
            hasPlayedIntroDemoRef.current = true;
            setIntroDemoState("done");
          }, 600) as unknown as number;
        }
      };

      introTimersRef.current.typeTimer = window.setTimeout(step, 300) as unknown as number;
    };

    let fullPrompt = INTRO_DEMO_TEXT;

    // Fire off auto-prompt fetch without blocking the animation.
    fetch("/api/scout/auto-prompt", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const candidate =
          typeof data.autoPrompt === "string" ? data.autoPrompt.trim() : "";
        if (candidate.length > 0) {
          fullPrompt = candidate;
        }
      })
      .catch(() => {
        // If auto-prompt fails, we keep the default intro text.
      });

    introTimersRef.current.startTimer = window.setTimeout(
      () => startTyping(fullPrompt),
      500
    ) as unknown as number;

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [handleSend, hasMessages, isAuthenticated, introDemoState, isSuperAdminTester]);

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
  }, [location, state.messages, handleSend, setPrefillKey]);

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

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full items-center bg-slate-950 text-white">
      <div
        className={`w-full ${
          isMobile ? "px-3 pt-3 pb-0" : "max-w-6xl px-4 pt-6 pb-1"
        } space-y-4 flex flex-col flex-1`}
      >
        {/* Main conversation layout: used for all users, including first-time guests. */}
        <div className="max-w-xl mx-auto w-full flex flex-col flex-1 min-h-0">
          <ScoutHeader
            isAuthenticated={isAuthenticated}
            isFirstGuestVisit={isFirstGuestVisit}
          />

            {/* Thread + input in a single chat container that stretches toward
                the bottom of the viewport, with the input pinned just above
                the global bottom nav. */}
          <div
            className={`mt-2 flex flex-col flex-1 min-h-0 ${
              isMobile ? "space-y-3" : "space-y-4"
            }`}
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
