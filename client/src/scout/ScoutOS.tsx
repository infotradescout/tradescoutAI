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
import ScoutTrending from "./ScoutTrending";
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

const INTRO_DEMO_TEXT = "What can TradeScout do for my community?";
const INTRO_DEMO_STORAGE_KEY = "ts_intro_demo_v3";

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
  const { user, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const isMobile = useIsMobile();

  const [appDrawerOpen, setAppDrawerOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [prefillKey, setPrefillKey] = useState(0);
  const [hasGuestInteracted, setHasGuestInteracted] = useState(false);
  const [firstIntroAppendix, setFirstIntroAppendix] = useState<string>("");
  const [autoPromptSuggestions, setAutoPromptSuggestions] = useState<string[]>([]);
  const [introDemoState, setIntroDemoState] = useState<
    "idle" | "typing" | "armingSend" | "sending" | "done"
  >("idle");
  const [introDemoText, setIntroDemoText] = useState<string>("");
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

  const locality: ScoutLocality = useMemo(
    () => ({
      county: user?.county,
      state: user?.state,
      zip: user?.zip,
      lat: user?.latitude,
      lng: user?.longitude,
    }),
    [user?.county, user?.state, user?.zip, user?.latitude, user?.longitude]
  );

  const userRoles = (user as any)?.roles as string[] | undefined;
  const hasRoles = Array.isArray(userRoles) && userRoles.length > 0;
  const isGuest = !isAuthenticated;

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
    if (roles.some((r) => r.startsWith("contractor:") || r === "contractor" || r === "pro")) {
      return "contractors";
    }
    if (roles.some((r) => r.startsWith("realtor:") || r === "realtor")) {
      return "marketplace";
    }
    return "default";
  };

  const recentPrompts = useMemo(
    () =>
      state.messages
        .filter((m) => m.role === "user" && !!m.content)
        .map((m) => m.content as string),
    [state.messages]
  );

  const buildSmartSuggestions = (
    mode: ScoutMode,
    userMessage: string,
    serverSuggestions?: string[],
    opts?: { isFirstAnswer?: boolean; isGuest?: boolean }
  ): string[] => {
    const base: string[] = [];
    const trimmed = userMessage.trim();
    const short = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
    const lower = trimmed.toLowerCase();

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

      switch (mode) {
        case "contractors":
          if (isPlumbing || isElectrical || isRoofing) {
            base.push(
              "Find vetted pros for this exact job in my county",
              "Turn this into a project I can track and compare bids on",
              "Explain price range, materials, and code topics for this"
            );
          } else {
            base.push(
              "Find vetted local contractors for this and queue intros",
              "Draft a message I can send to the top matches",
              "Turn this into a trackable project on my board"
            );
          }
          break;
        case "marketplace":
          base.push(
            "Show Exchange listings that match this need near me",
            "Draft a listing I can post based on this",
            "Alert me if new local deals match this search"
          );
          break;
        default:
          if (isTaxOrPermit) {
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
          } else {
            base.push(
              "Summarize this into a simple next-step plan",
              "Route me to the best place in TradeScout for this",
              "Turn this into a trackable project on my board"
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

    for (const s of server) {
      if (!merged.includes(s)) merged.push(s);
      if (merged.length === 3) return merged;
    }

    for (const raw of base) {
      const s = sanitizeSuggestionLabel(raw);
      if (!s || isWeakSuggestionLabel(s)) continue;
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
          { isFirstAnswer, isGuest }
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
              title: "Create an account to unlock local setup",
              kind: "generic",
              body:
                "Save your area, tailor results, and manage projects or listings in one place.",
              actions: [
                {
                  type: "NAVIGATE",
                  label: "Create account",
                  to: ROUTES.REGISTER,
                },
                { type: "NOOP", label: "Continue browsing" },
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
      try {
        hasPlayedIntroDemoRef.current =
          typeof window !== "undefined" &&
          window.localStorage.getItem(INTRO_DEMO_STORAGE_KEY) === "1";
      } catch {
        hasPlayedIntroDemoRef.current = false;
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
            try {
              window.localStorage.setItem(INTRO_DEMO_STORAGE_KEY, "1");
            } catch {
              // ignore
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
  }, [handleSend, hasMessages, isAuthenticated, introDemoState]);

  const abortIntroDemo = () => {
    if (introDemoState === "done" || introDemoState === "idle") return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(INTRO_DEMO_STORAGE_KEY, "1");
      }
    } catch {
      // ignore
    }
    hasPlayedIntroDemoRef.current = true;
    if (introTimersRef.current.startTimer !== null) {
      window.clearTimeout(introTimersRef.current.startTimer);
      introTimersRef.current.startTimer = null;
    }
    if (introTimersRef.current.typeTimer !== null) {
      window.clearTimeout(introTimersRef.current.typeTimer);
      introTimersRef.current.typeTimer = null;
    }
    setIntroDemoState("done");
  };

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

  return (
    <div className="min-h-screen bg-[#060b1c] text-white flex flex-col items-center">
      <div
        className={`w-full ${
          isMobile ? "px-0 pt-3 pb-2" : "max-w-xl px-4 pt-6 pb-3"
        } space-y-4`}
      >
        {isFirstGuestVisit ? (
          // FIRST GUEST INTRO: Clean, intentional, single-purpose
          <div className="space-y-6">
            <header className="text-center space-y-2">
              <p className="text-[10px] tracking-[0.25em] text-orange-300 uppercase">
                COMMUNITY OS
              </p>
              <h1 className="text-xl md:text-2xl font-black tracking-[0.12em] text-white uppercase">
                <span className="text-white">EMPOWERING </span>
                <span className="text-orange-400">{heroHeadlineTarget}</span>
              </h1>
              <p className="text-xs text-slate-300/90 max-w-md mx-auto">
                Your local AI assistant for contractors, community updates, and home projects.
              </p>
            </header>

            {/* Scripted intro demo composer (types, pulses send, then sends) */}
            <div
              className={`rounded-2xl border border-slate-800 bg-[#020617] ${
                isMobile ? "px-3 py-3" : "px-4 py-4"
              } space-y-2`}
            >
              <textarea
                value={introDemoText}
                onChange={(e) => {
                  abortIntroDemo();
                  if (!hasGuestInteracted && e.target.value.trim().length > 0) {
                    setHasGuestInteracted(true);
                    recordActivity({
                      type: "ask_scout",
                      ts: new Date().toISOString(),
                      path: location,
                      label: "typed",
                    });
                  }
                  setIntroDemoText(e.target.value);
                }}
                disabled={isBusy}
                placeholder="Ask about contractors, projects, or your community"
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400/70 focus:outline-none focus:ring-2 focus:ring-orange-500/60 min-h-[80px]"
              />
              <button
                type="button"
                onClick={() => {
                  abortIntroDemo();
                  const trimmed = introDemoText.trim();
                  if (!trimmed) return;
                  setHasGuestInteracted(true);
                  void handleSend(trimmed);
                }}
                disabled={isBusy || !introDemoText.trim()}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60 ${
                  introDemoState === "armingSend" ? "animate-pulse" : ""
                }`}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-800/80 text-[10px] font-bold text-orange-300">
                  ↗
                </span>
                <span>{isBusy ? "Sending..." : "Send"}</span>
              </button>
            </div>
          </div>
        ) : (
          // FULL CONVERSATION: All features visible after first message
          <>
            {/* Header + hero (copy only; all navigation lives in AppShell) */}
            <header className="space-y-2">
              <p className="text-[10px] tracking-[0.25em] text-orange-300 uppercase">
                COMMUNITY OS
              </p>
              <p className="text-[11px] text-slate-400">
                Your local operating system for contractors, projects, and community.
              </p>

              <h1 className="mt-1 text-[clamp(0.95rem,3.5vw,1.35rem)] tracking-[0.12em] text-white uppercase">
                <span className="text-white">EMPOWERING </span>
                <span className="text-orange-400">{heroHeadlineTarget}</span>
              </h1>

              {!isAuthenticated && (
                <p className="mt-1 text-[11px] text-slate-300/90 max-w-md">
                  You can explore without an account. Sign in when you want to save, post, or message.
                </p>
              )}
            </header>

            {/* Thread + input in a single chat container */}
            <div
              className={`mt-3 rounded-2xl border border-slate-800 bg-[#020617] ${
                isMobile ? "px-3 py-3 space-y-3" : "px-4 py-4 space-y-4"
              }`}
            >
              {!hasUserMessages && (
                <div className="flex flex-wrap gap-2 justify-center text-center">
                  {(autoPromptSuggestions.length
                    ? autoPromptSuggestions.slice(0, 3)
                    : [
                        `Find trusted local pros in ${heroLocationLabel || "your area"}`,
                        heroAudienceLabel
                          ? `Show opportunities for ${heroAudienceLabel} in ${heroLocationLabel || "my area"}`
                          : "Show me what's happening in my community",
                        "Draft a post I can share with my neighbors",
                      ]
                  ).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
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
                      className="px-3 py-1.5 text-[11px] rounded-full border border-slate-700 bg-slate-900 hover:border-orange-400 max-w-full"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              <ScoutThread
                messages={state.messages}
                status={state.status}
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

                  // Fallback: treat as a normal prompt to Scout so it can
                  // reason about next steps.
                  handleSend(trimmed);
                }}
              />

              <ScoutInput
                key={prefillKey}
                disabled={isBusy}
                placeholder="Ask about contractors, projects, or your community"
                onSend={(value) => handleSend(value)}
                onUserTyping={() => {
                  setHasGuestInteracted(true);
                  recordActivity({
                    type: "ask_scout",
                    ts: new Date().toISOString(),
                    path: location,
                    label: "typing",
                  });
                }}
                prefillKey="scout-main"
                initialValue=""
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

            {/* Trending */}
            <ScoutTrending
              locality={locality}
              recentPrompts={recentPrompts}
              onPromptClick={(prompt) => {
                setHasGuestInteracted(true);
                handleSend(prompt);
              }}
            />
          </>
        )}
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
