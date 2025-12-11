import React, { useMemo, useState } from "react";
import { SlidersHorizontal, MessageCircle, Bell } from "lucide-react";
import { useLocation } from "wouter";
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

export default function ScoutOS() {
  const { user, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const isMobile = useIsMobile();

  const [appDrawerOpen, setAppDrawerOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [prefillKey, setPrefillKey] = useState(0);

  const { state, recordUserMessage, applyServerResponse, setError } = useScoutState();

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

  const statusLabel =
    state.status === "idle"
      ? "SCOUT IDLE"
      : state.status === "sending"
      ? "SCOUT SENDING"
      : state.status === "thinking"
      ? "SCOUT THINKING"
      : state.status === "responding"
      ? "SCOUT RESPONDING"
      : "SCOUT ERROR";

  const statusDotClass =
    state.status === "idle"
      ? "bg-slate-600"
      : state.status === "error"
      ? "bg-red-500"
      : "bg-orange-400";

  const inferModeFromRoles = (roles: string[] | undefined | null): ScoutMode => {
    if (!roles || roles.length === 0) return "default";
    if (roles.some((r) => r.startsWith("contractor:") || r === "contractor" || r === "pro")) {
      return "contractors";
    }
    if (roles.some((r) => r.startsWith("realtor:") || r === "realtor")) {
      return "marketplace";
    }
    if (roles.includes("mealscout") || roles.some((r) => r.startsWith("mealscout:"))) {
      return "mealscout";
    }
    return "default";
  };

  const handleSend = async (value: string, explicitMode?: ScoutMode) => {
    const roles = (user as any)?.roles as string[] | undefined;
    const mode: ScoutMode = explicitMode ?? inferModeFromRoles(roles);
    const start = performance.now();
    recordUserMessage(value);

    try {
      const res = await sendToScout({
        history: state.messages.map((m) => ({ role: m.role, content: m.content })),
        message: value,
        locality,
        mode,
        knowledgeMode: "local-first",
        roles,
      });

      const msg = {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        role: "assistant" as const,
        content: res.message,
        timestamp: res.timestamp || new Date().toISOString(),
        suggestedActions: res.suggestedActions ?? [],
      };

      applyServerResponse(msg, res.actions);

      executeScoutActions(res.actions, {
        navigate: (to) => navigate(to),
        openAppDrawer: () => setAppDrawerOpen(true),
        openToolsDrawer: () => setToolsOpen(true),
        prefillInput: (text) => {
          // bump key so ScoutInput resets
          setPrefillKey((k) => k + 1);
          // we pass text as initial value via location state if needed later
          // right now we just log; you can extend to actually inject the value
          console.debug("Scout prefilling input with:", text);
        },
      });

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
  };

  const heroLocationLabel = getUserLocationLabel(user as any);
  const heroAudienceLabel = getUserAudienceLabel(user as any);

  return (
    <div className="min-h-screen bg-[#060b1c] text-white flex flex-col items-center">
      <div className="w-full max-w-xl px-4 pt-10 pb-4 space-y-6">
        {/* Header + hero */}
        <header className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            {/* Left: brand, headline, browse link */}
            <div>
              <p className="text-[10px] tracking-[0.25em] text-orange-300 uppercase">
                TradeScout
              </p>
              <p className="text-xs text-slate-400">Local operating system</p>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Empowering{" "}
                <span className="text-orange-400">{heroLocationLabel}</span>
                {heroAudienceLabel ? ` ${heroAudienceLabel}` : null}
              </h1>

              <button
                type="button"
                className="mt-3 text-xs font-medium text-slate-400 hover:text-slate-100"
                onClick={() => setAppDrawerOpen(true)}
              >
                Browse apps
              </button>
            </div>

            {/* Right: tools + context actions in a single row */}
            <div className="flex items-center gap-2">
              {/* When logged out: Create account chip to the left of tools */}
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.REGISTER || "/register")}
                  className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-3 py-1 text-xs font-semibold text-black shadow-lg shadow-orange-500/30 hover:bg-orange-400"
                >
                  Create account
                </button>
              )}

              {/* When logged in: Messages + Notifications */}
              {isAuthenticated && (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.CONVERSATIONS || "/messages")}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-100 border border-slate-700 hover:bg-slate-800"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-orange-400" />
                    <span className="hidden sm:inline">Messages</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.NOTIFICATIONS || "/notifications")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/80 hover:bg-slate-900"
                    aria-label="Notifications"
                  >
                    <Bell className="h-3.5 w-3.5 text-orange-400" />
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

          <div className="text-[11px] text-slate-500 uppercase flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
            {statusLabel}
          </div>
        </header>

        {/* Thread + input */}
        <ScoutThread
          messages={state.messages}
          status={state.status}
          onQuickAction={(text) => handleSend(text)}
        />

        <ScoutInput
          key={prefillKey}
          disabled={state.status === "sending" || state.status === "thinking"}
          onSend={(v) => handleSend(v)}
        />

        {/* Trending */}
        <ScoutTrending locality={locality} onPromptClick={(p) => handleSend(p)} />
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
