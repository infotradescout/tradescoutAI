import React, { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useLocation } from "wouter";
import AppDrawer from "../components/AppDrawer";
import { useIsMobile } from "../hooks/useIsMobile";
import { ScoutInput } from "./ScoutInput";
import { ScoutThread } from "./ScoutThread";
import { ScoutToolsDrawer } from "./ScoutToolsDrawer";
import { sendToScout } from "./api";
import { ScoutMessage, useScoutState } from "./state";

export default function ScoutOS() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();

  const [state, dispatch] = useScoutState();
  const [inputValue, setInputValue] = useState("");
  const [appDrawerOpen, setAppDrawerOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message || state.status === "sending" || state.status === "thinking") return;

    setInputValue("");
    dispatch({ type: "USER_MESSAGE", content: message });

    try {
      const history = [...state.messages, {
        id: "temp",
        role: "user" as const,
        content: message,
        timestamp: new Date().toISOString(),
      }].map(m => ({ role: m.role, content: m.content }));

      const res = await sendToScout({ history, message });

      const serverMessage: Omit<ScoutMessage, "id"> = {
        role: "assistant",
        content: res.message,
        timestamp: res.timestamp,
        suggestedActions: res.suggestedActions ?? [],
      };

      dispatch({ type: "SERVER_RESPONSE", message: serverMessage });
    } catch (err: any) {
      dispatch({ type: "ERROR", message: err?.message || "Scout failed" });
    }
  };

  return (
    <div className="min-h-screen bg-[#060b1c] text-white flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 pt-10 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-orange-300 uppercase">
              TradeScout
            </p>
            <p className="text-sm text-gray-400">Local operating system</p>
          </div>

          <button
            onClick={() => setIsToolsOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-700 bg-gray-900 hover:bg-gray-800"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <h1 className="text-3xl font-bold">
          Empowering{" "}
          <span className="text-orange-400">
            {isAuthenticated ? user?.city || "your county" : "your county"}
          </span>
        </h1>

        {isAuthenticated ? (
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-semibold"
          >
            Open Dashboard
          </button>
        ) : (
          <button
            onClick={() => navigate("/register")}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-semibold"
          >
            Create Free Account
          </button>
        )}

        <button
          className="w-full text-center text-xs text-gray-400 hover:text-white"
          onClick={() => setAppDrawerOpen(true)}
        >
          Browse apps
        </button>

        <div className="text-xs text-gray-500 uppercase flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              state.messages.length > 0 || state.status === "sending" || state.status === "thinking"
                ? "bg-orange-400"
                : "bg-gray-600"
            }`}
          />
          {state.messages.length > 0 || state.status === "sending" || state.status === "thinking"
            ? "SCOUT ACTIVE"
            : "SCOUT IDLE"}
        </div>

        <div className="space-y-2">
          <p className="text-xs tracking-wide text-gray-400">LIVE SCOUT THREAD</p>
          <ScoutThread messages={state.messages} status={state.status} />
        </div>

        <ScoutInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          disabled={state.status === "sending" || state.status === "thinking"}
        />
      </div>

      <ScoutToolsDrawer isOpen={isToolsOpen} onClose={() => setIsToolsOpen(false)} />

      <AppDrawer
        isOpen={appDrawerOpen}
        onClose={() => setAppDrawerOpen(false)}
        isAdmin={user?.isAdmin}
      />
    </div>
  );
}
