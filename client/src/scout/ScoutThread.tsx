import React from "react";
import clsx from "clsx";
import type { ScoutAction, ScoutCluster, ScoutMessage, ScoutStatus } from "./state";

type ScoutThreadProps = {
  messages: ScoutMessage[];
  status: ScoutStatus;
  onAction?: (action: ScoutAction) => void;
  onQuickAction?: (text: string) => void;
};

interface ClusterCardProps {
  cluster: ScoutCluster;
  onAction?: (action: ScoutAction) => void;
}

function ClusterCard({ cluster, onAction }: ClusterCardProps) {
  const handlePrimary = () => {
    if (cluster.primaryAction && onAction) {
      onAction(cluster.primaryAction);
    }
  };

  const handleAction = (action: ScoutAction) => {
    if (onAction) {
      onAction(action);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
            {cluster.title}
          </p>
          {cluster.body && (
            <p className="mt-1 text-[12px] leading-relaxed text-slate-200">
              {cluster.body}
            </p>
          )}
        </div>

        {cluster.primaryAction && (
          <button
            type="button"
            onClick={handlePrimary}
            className="shrink-0 rounded-full border border-tsAccent/60 bg-tsAccent/10 px-3 py-1 text-[11px] font-medium text-tsAccent hover:bg-tsAccent hover:text-black transition"
          >
            {cluster.primaryAction.label ?? "Open"}
          </button>
        )}
      </div>

      {cluster.items && cluster.items.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {cluster.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/80 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-slate-50">
                  {item.label}
                </p>
                {item.description && (
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {item.description}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {cluster.actions && cluster.actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cluster.actions.map((action) => (
            <button
              key={`${cluster.id}-${action.label ?? action.type}`}
              type="button"
              onClick={() => handleAction(action)}
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 hover:bg-tsAccent hover:text-black hover:border-tsAccent transition"
            >
              {action.label ?? action.type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ScoutThread: React.FC<ScoutThreadProps> = ({
  messages,
  status, // kept for future use; we just don't render a visible "thinking" banner
  onAction,
  onQuickAction,
}) => {
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
                  {msg.content.includes(
                    "I encountered an error creating a comprehensive overview"
                  )
                    ? "Scout is having trouble connecting to its brain right now. Please try again in a moment."
                    : msg.content}
                </p>
              )}

              {msg.clusters && msg.clusters.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.clusters.map((cluster) => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      onAction={onAction}
                    />
                  ))}
                </div>
              )}

              {msg.suggestedActions &&
                msg.suggestedActions.length > 0 &&
                !isUser && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.suggestedActions.map((label) => (
                      <button
                        key={`${msg.id}-suggested-${label}`}
                        type="button"
                        onClick={() => onQuickAction?.(label)}
                        className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-slate-100 hover:bg-tsAccent hover:text-black hover:border-tsAccent transition"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ScoutThread;
