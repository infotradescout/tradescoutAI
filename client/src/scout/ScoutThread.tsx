import React from "react";
import clsx from "clsx";
import type {
  ScoutAction,
  ScoutCluster,
  ScoutMessage,
  ScoutStatus,
} from "./state";

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
  const handlePrimary = () => {
    if (onAction && cluster.primaryAction) {
      onAction(cluster.primaryAction);
    }
  };

  const handleAction = (action: ScoutAction) => {
    if (onAction) {
      onAction(action);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
      {cluster.title && (
        <div className="text-xs font-semibold text-slate-100">
          {cluster.title}
        </div>
      )}

      {cluster.body && (
        <p className="mt-1 text-[13px] text-slate-300 whitespace-pre-line">
          {cluster.body}
        </p>
      )}

      {cluster.items && cluster.items.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12px] text-slate-300">
          {cluster.items.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span className="mt-[3px] h-1 w-1 rounded-full bg-slate-500" />
              <span>{item.label}</span>
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
              className="inline-flex items-center rounded-full border border-orange-400/40 bg-slate-900 px-3 py-1 text-[11px] font-medium text-orange-300 hover:bg-orange-500 hover:text-black transition"
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
            onClick={handlePrimary}
            className="inline-flex items-center justify-center rounded-full bg-orange-500 px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
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
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (status === "idle" || status === "error") {
      setProgress(0);
      return;
    }

    // Start animating the progress bar whenever Scout is thinking.
    // While resolving/checking, ease toward ~85%; during executing_action toward ~95%;
    // when status flips to "ready", allow it to hit 100%.
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        let target = 85;
        if (status === "executing_action") target = 95;
        if (status === "ready") target = 100;

        if (prev === 0) {
          // Give a quick visual start so it never feels stuck at 0%.
          return 8;
        }

        if (prev >= target) {
          return prev;
        }

        const next = prev + 4;
        return next > target ? target : next;
      });
    }, 140);

    return () => {
      window.clearInterval(interval);
    };
  }, [status]);
  let statusLabel: string | null = null;
  if (status === "resolving_context") {
    statusLabel = "Checking your account and location...";
  } else if (status === "checking_documents") {
    statusLabel = "Reviewing your projects and documents...";
  } else if (status === "executing_action") {
    statusLabel = "Starting that action...";
  } else if (status === "ready") {
    statusLabel = "Preparing your answer...";
  }

  const showProgress = status !== "idle" && status !== "error";

  return (
    <div className="space-y-3 pr-1 max-h-[380px] overflow-y-auto">
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
                "max-w-[80%] rounded-2xl px-3 py-2 text-[13px]",
                isUser
                  ? "bg-orange-500 text-black"
                  : "bg-slate-900 text-slate-100 border border-slate-700/60"
              )}
            >
              <p className="whitespace-pre-line leading-relaxed">
                {msg.content}
              </p>

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
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.suggestedActions.map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => onQuickAction && onQuickAction(act)}
                      className="px-3 py-1.5 text-[11px] rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:border-orange-400"
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

      {showProgress && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 via-orange-300 to-amber-300 transition-[width] duration-150 ease-out"
              style={{ width: `${Math.max(5, Math.min(progress, 100))}%` }}
            />
          </div>

          <div className="flex justify-start">
            <div className="mt-1 inline-flex items-center rounded-2xl bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300 border border-slate-700/60">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
              {statusLabel ?? "Scout is thinking about the best local answer..."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoutThread;
