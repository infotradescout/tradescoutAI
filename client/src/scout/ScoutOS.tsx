import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { SlidersHorizontal, MessageCircle, Bell } from "lucide-react";
import { Link, useLocation } from "wouter";
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

const BANNED_TERMS = ["fuck", "shit", "bitch", "asshole", "cunt", "slut", "whore"];

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

  const initialized = useRef(false);

  const [appDrawerOpen, setAppDrawerOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [prefillKey, setPrefillKey] = useState(0);
  const [hasGuestInteracted, setHasGuestInteracted] = useState(false);
  const { sessionRole } = useSession();

  const { state, recordUserMessage, applyServerResponse, setError } = useScoutState();

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
    state.status === "sending" ||
    state.status === "thinking" ||
    state.status === "responding";

  const hasMessages = state.messages.length > 0;

  const hasUserMessages = useMemo(
    () => state.messages.some((m) => m.role === "user"),
    [state.messages]
  );

  // First-time guest state: controls entire top half of Scout.
  // We treat this as "guest has not actively interacted yet" so that
  // auto-demo typing does NOT collapse the calm intro.
  const isFirstGuestVisit = !isAuthenticated && !hasGuestInteracted;

  const statusLabel = isBusy ? "SCOUT THINKING" : "SCOUT IDLE";
  const statusDotClass = isBusy ? "bg-amber-400" : "bg-emerald-400";
  const statusTextClass = isBusy ? "text-amber-300/90" : "text-tsAccentSoft";

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

  const buildSmartSuggestions = (
    mode: ScoutMode,
    userMessage: string,
    serverSuggestions?: string[] | null
  ): string[] => {
    const base: string[] = [];
    const trimmed = userMessage.trim();
    const short = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;

    switch (mode) {
      case "contractors":
        base.push(
          "Find vetted local contractors for this and queue intros",
          "Draft a message I can send to the top matches",
          "Turn this into a trackable project on my board"
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
        base.push(
          "Summarize this into a simple next-step plan",
          "Route me to the best page in TradeScout for this",
          "Turn this into a saved note or project I can revisit"
        );
        break;
    }

    const server = (serverSuggestions ?? []).filter(Boolean);
    const merged: string[] = [];

    for (const s of server) {
      if (!merged.includes(s)) merged.push(s);
      if (merged.length === 3) return merged;
    }

    for (const s of base) {
      if (!merged.includes(s)) merged.push(s);
      if (merged.length === 3) return merged;
    }

    if (!merged.length && short) {
      merged.push(`Remember this for later and suggest my next move on: ${short}`);
    }

    return merged.slice(0, 3);
  };
  const handleSend = useCallback(
    async (value: string, explicitMode?: ScoutMode) => {
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
      recordUserMessage(value);
      recordActivity({
        type: "ask_scout",
        ts: new Date().toISOString(),
        path: location,
        label: value.slice(0, 160),
      });

      try {
        const recentActivity = getRecentActivity();
        const shownAdIds = getSeenAdIds();

        const res = await sendToScout({
          history: state.messages.map((m) => ({ role: m.role, content: m.content })),
          message: value,
          locality,
          mode,
          knowledgeMode: "local-first",
          roles: rolesForRequest,
          recentActivity,
          shownAdIds,
        });

        const smartSuggestions = buildSmartSuggestions(
          mode,
          value,
          res.suggestedActions
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

        const msg: ScoutMessage = {
          id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          role: "assistant",
          content: res.message,
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
      }
    },
    [
      applyServerResponse,
      buildSmartSuggestions,
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

  // One-time autorun prompt for first-time guests: fire a single
  // "What can TradeScout do for my community?" question so the
  // conversation starts automatically, with the standard
  // "Scout is thinking..." indicator while it loads.
  useEffect(() => {
    if (initialized.current) return;
    if (isAuthenticated) return;
    if (hasMessages) return;

    initialized.current = true;
    setHasGuestInteracted(true);
    void handleSend(INTRO_DEMO_TEXT);
  }, [handleSend, hasMessages, isAuthenticated]);

  const handleClusterAction = useCallback(
    (action: ScoutAction) => {
      if (action.type === "NAVIGATE") {
        recordActivity({
          type: "navigate",
          ts: new Date().toISOString(),
          path: location,
          to: action.to ?? action.path,
          label: action.label,
        });
      }

      if (action.type === "NOOP") {
        return;
      }

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
    },
    [
      location,
      navigate,
      handleSend,
    ]
  );

  const heroLocationLabel = getUserLocationLabel(user as any);
  const heroAudienceLabel = getUserAudienceLabel(user as any);

  const quickLinks: Array<{ label: string; to: string }> = useMemo(
    () => [
      { label: "Dashboard", to: "/dashboard" },
      { label: "Contractors", to: ROUTES.CONTRACTORS },
      { label: "Exchange", to: "/exchange" },
      { label: "Community", to: ROUTES.COMMUNITY },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#060b1c] text-white flex flex-col items-center">
      <div className="w-full max-w-xl px-4 pt-10 pb-4 space-y-6">
        {isFirstGuestVisit ? (
          // FIRST GUEST INTRO: Clean, intentional, single-purpose
          <div className="space-y-6">
            <header className="text-center space-y-3">
              <p className="text-[10px] tracking-[0.25em] text-orange-300 uppercase">
                TradeScout
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-[0.12em] text-white uppercase">
                <span className="text-orange-400">Your local AI assistant</span>
              </h1>
              <p className="text-sm text-slate-300/90 max-w-md mx-auto">
                Ask about contractors, community updates, home projects — anything local.
              </p>
            </header>

            {/* Single input with auto-typing demo */}
            <div className="rounded-2xl border border-slate-800 bg-[#020617] px-4 py-4">
              <ScoutInput
                key={prefillKey}
                disabled={isBusy}
                placeholder="What can I help you with in your county?"
                onSend={(v) => handleSend(v)}
                onUserTyping={() => {
                  setHasGuestInteracted(true);
                  recordActivity({
                    type: "ask_scout",
                    ts: new Date().toISOString(),
                    path: location,
                    label: "typed",
                  });
                }}
                prefillKey="scout-main"
                initialValue=""
                enableAutoDemo={true}
                autoDemoText={INTRO_DEMO_TEXT}
              />
            </div>
          </div>
        ) : (
          // FULL CONVERSATION: All features visible after first message
          <>
            {/* Header + hero */}
            <header className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            {/* Left: brand, headline */}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] tracking-[0.25em] text-orange-300 uppercase">
                TradeScout
              </p>
              <p className="text-xs text-slate-400">Local operating system</p>

              <h1 className="mt-3 text-[clamp(0.9rem,4vw,1.4rem)] sm:text-2xl md:text-3xl font-semibold tracking-[0.12em] text-white uppercase text-center whitespace-nowrap">
                <span className="text-orange-400">Empowering your community</span>
              </h1>

              {!isAuthenticated && (
                <p className="mt-2 text-xs text-slate-300/90">
                  You can explore without an account. Sign in when you want to save or participate.
                </p>
              )}

              {/* Browse apps link removed per updated hero spec */}
            </div>
            {/* Right: tools + context actions in a single row */}
            <div className="flex items-center gap-2 shrink-0">
              {!isAuthenticated && (
                <Link
                  href="/login"
                  className="cta inline-flex items-center justify-center rounded-xl bg-tsAccent px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
                >
                  Create your free account
                </Link>
              )}

              {/* When logged out: Create account chip to the left of tools */}
              {/* When logged in: Messages + Notifications */}
              {isAuthenticated && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.CONVERSATIONS || "/messages")}
                    className="relative inline-flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-1 text-xs font-medium text-tsTextMain border border-tsBorder hover:bg-slate-800"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-tsAccent" />
                    <span className="hidden sm:inline">Messages</span>

                    {unreadMessages > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unreadMessages > 99 ? "99+" : unreadMessages}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        (((ROUTES as any)?.NOTIFICATIONS as string | undefined) ??
                          "/notifications")
                      )
                    }
                    className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl border border-tsBorder bg-slate-950/80 hover:bg-slate-900"
                    aria-label="Notifications"
                  >
                    <Bell className="h-3.5 w-3.5 text-tsAccent" />

                    {unreadNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                        {unreadNotifications > 9 ? "9+" : unreadNotifications}
                      </span>
                    )}
                  </button>
                </>
              )}

              {/* Tools icon – stays on the far right */}
              <button
                type="button"
                onClick={() => setToolsOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800"
                aria-label="Open tools & personalization"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="sr-only">Tools</span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-black/40 px-3 py-1">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
              <span className={`text-[10px] font-semibold tracking-[0.18em] uppercase ${statusTextClass}`}>
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickLinks.map((l) => (
              <button
                key={l.to}
                type="button"
                onClick={() => {
                  setHasGuestInteracted(true);
                  navigate(l.to);
                }}
                className="px-3 py-1.5 text-[11px] rounded-full border border-slate-700 bg-slate-900 hover:border-orange-400"
              >
                {l.label}
              </button>
            ))}
          </div>
        </header>

        {/* Thread + input in a single chat container */}
        <div className="mt-3 rounded-2xl border border-slate-800 bg-[#020617] px-4 py-4 space-y-4">
          {!hasUserMessages && (
            <div className="flex flex-wrap gap-2">
              {[
                "Find top-rated contractors in my county",
                "What's happening in my community this week?",
                "Help me estimate a home repair project",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setHasGuestInteracted(true);
                    handleSend(prompt);
                  }}
                  className="px-3 py-1.5 text-[11px] rounded-full border border-slate-700 bg-slate-900 hover:border-orange-400"
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
            onQuickAction={(text) => handleSend(text)}
          />

          <ScoutInput
            key={prefillKey}
            disabled={isBusy}
            placeholder="What can I help you with in your county?"
            onSend={(v) => handleSend(v)}
            onUserTyping={() => {
              setHasGuestInteracted(true);
              recordActivity({
                type: "ask_scout",
                ts: new Date().toISOString(),
                path: location,
                label: "typed",
              });
            }}
            prefillKey="scout-main"
            initialValue=""
            enableAutoDemo={!isAuthenticated && !hasUserMessages}
            autoDemoText={INTRO_DEMO_TEXT}
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
              recentPrompts={state.messages.filter((m) => m.role === "user").map((m) => m.content)}
              onPromptClick={(p) => {
                setHasGuestInteracted(true);
                handleSend(p);
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
