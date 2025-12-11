import React, { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
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

  const handleSend = async (value: string, mode: ScoutMode = "default") => {
    const start = performance.now();
    recordUserMessage(value);

    try {
      const res = await sendToScout({
        history: state.messages.map((m) => ({ role: m.role, content: m.content })),
        message: value,
        locality,
        mode,
        knowledgeMode: "local-first",
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

  const heroTitleLocation =
    user?.county && user?.state
      ? `${user.county}, ${user.state}`
      : "your county";

  return (
    <div className="min-h-screen bg-[#060b1c] text-white flex flex-col items-center">
      <div className="w-full max-w-md px-4 pt-10 pb-4 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-orange-300 uppercase">
              TradeScout
            </p>
            <p className="text-xs text-slate-400">Local operating system</p>
          </div>
          <button
            type="button"
            onClick={() => setToolsOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Hero */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">
            Empowering{" "}
            <span className="text-orange-400">{heroTitleLocation}</span>
          </h1>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-semibold"
            >
              Open Dashboard
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-semibold"
            >
              Create Free Account
            </button>
          )}

          <button
            type="button"
            className="w-full text-center text-[11px] text-slate-400 hover:text-slate-100"
            onClick={() => setAppDrawerOpen(true)}
          >
            Browse apps
          </button>

          <div className="text-[11px] text-slate-500 uppercase flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
            {statusLabel}
          </div>
        </div>

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
