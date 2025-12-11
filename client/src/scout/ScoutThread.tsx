import React from "react";
import type { ScoutMessage, ScoutStatus } from "./state";

interface ScoutThreadProps {
  messages: ScoutMessage[];
  status: ScoutStatus;
  onQuickAction?: (text: string) => void;
}

export default function ScoutThread({
  messages,
  status,
  onQuickAction,
}: ScoutThreadProps) {
  const isBusy =
    status === "sending" || status === "thinking" || status === "responding";

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
        Live Scout thread
      </p>

      <div className="mt-1 rounded-2xl border border-slate-800 bg-[#020617] px-4 py-3 min-h-[140px] max-h-96 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  msg.role === "user" ? "bg-orange-400" : "bg-cyan-300"
                }`}
              />
              {msg.role === "user" ? "You" : "Scout"}
            </div>

            <div
              className={`inline-block max-w-full rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-orange-500 text-white"
                  : "bg-slate-800 text-slate-50"
              }`}
            >
              {msg.content}
            </div>

            {msg.suggestedActions && msg.suggestedActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {msg.suggestedActions.map((act, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onQuickAction && onQuickAction(act)}
                    className="px-3 py-1.5 text-[11px] rounded-full border border-slate-700 bg-slate-900 hover:border-orange-400"
                  >
                    {act}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isBusy && (
          <div className="text-[11px] text-slate-400 italic flex gap-2 items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span>Scout is thinking...</span>
          </div>
        )}

        {!messages.length && !isBusy && (
          <p className="text-xs text-slate-500">
            Ask anything about local projects, pros, marketplace items, or MealScout deals.
          </p>
        )}
      </div>
    </div>
  );
}
