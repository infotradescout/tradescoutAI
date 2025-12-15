import React from "react";
import clsx from "clsx";
import type { ScoutAction, ScoutCluster, ScoutMessage, ScoutStatus } from "./state";

type ScoutThreadProps = {
  messages: ScoutMessage[];
  status: ScoutStatus;
  onAction?: (action: ScoutAction) => void;
  onQuickAction?: (text: string) => void;
};

function ClusterCard({
  cluster,
  onAction,
}: {
  cluster: ScoutCluster;
  onAction?: (action: ScoutAction) => void;
}) {
  const handleAction = (action: ScoutAction) => {
    if (!onAction) return;
    onAction(action);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {cluster.title}
      </div>
      {cluster.body && (
        <p className="text-xs text-slate-300/90">{cluster.body}</p>
      )}

      {cluster.items && cluster.items.length > 0 && (
        <ul className="mt-1 space-y-1.5">
          {cluster.items.map((item) => (
            <li
              key={item.id}
              className="text-[11px] text-slate-300/90 leading-snug"
            >
              <span className="font-medium text-slate-100">{item.label}</span>
              {item.description && (
                <>
                  {" "}
                  <span className="text-slate-400">— {item.description}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {cluster.actions && cluster.actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cluster.actions.map((action) => (
            <button
              key={`${cluster.id}-${action.label}`}
              type="button"
              onClick={() => handleAction(action)}
              className="inline-flex items-center rounded-full border border-tsAccent/70 px-3 py-1 text-[11px] font-medium text-tsAccent hover:bg-tsAccent hover:text-black transition"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {!cluster.actions && cluster.primaryAction && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => handleAction(cluster.primaryAction!)}
            className="inline-flex items-center justify-center rounded-xl bg-tsAccent px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
          >
            {cluster.primaryAction.label}
          </button>
        </div>
      )}
    </div>
  );
}

const ScoutThread: React.FC<ScoutThreadProps> = ({
  messages,
  status,
  onAction,
  onQuickAction,
}) => {
  const isBusy =
    status === "sending" || status === "thinking" || status === "responding";

  return (
    <div className="space-y-3 pr-1">
      {messages.map((msg) => {
        const isUser = msg.role === "user";

        return (
          <div
            key={msg.id}
            className={clsx("flex", {
              "justify-end": isUser,
              "justify-start": !isUser,
            })}
          >
            <div
              className={clsx(
                "max-w-[90%] rounded-2xl px-3 py-2 text-xs space-y-2",
                isUser
                  ? "bg-slate-700 text-slate-50 rounded-br-sm"
                  : "bg-slate-900/80 text-slate-100 rounded-bl-sm border border-slate-800"
              )}
            >
              {msg.content && (
                <p className="text-[13px] leading-relaxed whitespace-pre-line">
                  {msg.content.includes("I encountered an error creating a comprehensive overview")
                    ? "Scout is having trouble connecting to its brain right now. Please try again in a moment."
                    : msg.content}
                </p>
              )}

              {msg.clusters &&
                msg.clusters.length > 0 &&
                msg.clusters.map((cluster) => (
                  <ClusterCard
                    key={cluster.id}
                    cluster={cluster}
                    onAction={onAction}
                  />
                ))}

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
          </div>
        );
      })}

      {isBusy && (
        <div className="flex justify-start">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300 border border-slate-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Scout is thinking...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoutThread;
