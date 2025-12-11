import React from "react";
import { ScoutMessage, ScoutStatus } from "./state";

interface ScoutThreadProps {
  messages: ScoutMessage[];
  status: ScoutStatus;
}

export function ScoutThread({ messages, status }: ScoutThreadProps) {
  return (
    <div className="rounded-2xl bg-gray-900/40 p-4 max-h-96 overflow-y-auto space-y-4">
      {messages.map((msg) => (
        <div key={msg.id} className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-2">
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
                : "bg-gray-800 text-gray-100"
            }`}
          >
            {msg.content}
          </div>
          {msg.suggestedActions && msg.suggestedActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {msg.suggestedActions.map((act, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 text-xs rounded-full border border-gray-700 bg-gray-800 text-gray-200"
                >
                  {act}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {status === "sending" || status === "thinking" ? (
        <div className="text-xs text-gray-400 italic flex gap-2 items-center">
          <span className="loading-dot" />
          <span>{status === "sending" ? "Sending…" : "Scout is thinking…"}</span>
        </div>
      ) : null}
    </div>
  );
}
