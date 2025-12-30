import React from "react";
import clsx from "clsx";
import type { ScoutMode } from "./api";
import type {
  ScoutAction,
  ScoutCluster,
  ScoutMessage,
  ScoutStatus,
} from "./state";
import { validateAction } from "./actionValidation";
import { CommunityCTA } from "@/components/community/CommunityCTA";

type ScoutThreadProps = {
  messages: ScoutMessage[];
  status: ScoutStatus;
  mode?: ScoutMode;
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
      const validated = validateAction(cluster.primaryAction);
      if (validated) {
        onAction(validated);
      }
    }
  };

  const handleAction = (action: ScoutAction) => {
    if (onAction) {
      const validated = validateAction(action);
      if (validated) {
        onAction(validated);
      }
    }
  };

  return (
    <div className="scout-card mt-3 rounded-xl px-3 py-2">
      {cluster.title && (
        <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          {cluster.title}
        </div>
      )}

      {cluster.body && (
        <p className="mt-1 text-[13px] whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
          {cluster.body}
        </p>
      )}

      {cluster.items && cluster.items.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          {cluster.items.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span className="mt-[3px] h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
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
              className="scout-action-button"
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
            className="inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold text-black transition"
            style={{ backgroundColor: 'var(--theme-accent-primary)' }}
          >
            {cluster.primaryAction.label}
          </button>
        </div>
      )}

      {cluster.ctaSource && cluster.ctaContextId && (
        <div className="mt-2 space-y-1">
          {cluster.ctaLabel && cluster.ctaSource === "trade_deal" && (
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {cluster.ctaLabel}
            </div>
          )}
          <CommunityCTA
            layout="inline"
            source={cluster.ctaSource}
            contextId={cluster.ctaContextId}
            ownerUserId={cluster.ctaOwnerUserId}
            canDirectConnect={cluster.ctaCanDirectConnect}
            canMessage={cluster.ctaCanMessage}
            disableDirectConnect={cluster.ctaDisableDirectConnect}
          />
        </div>
      )}
    </div>
  );
}

const ScoutThread: React.FC<ScoutThreadProps> = ({
  messages,
  status,
  mode,
  onAction,
  onQuickAction,
}) => {
  const [progress, setProgress] = React.useState(0);
  const phaseStartRef = React.useRef<number | null>(null);

  // Reset progress whenever Scout is fully idle or in an error state.
  React.useEffect(() => {
    if (status === "idle" || status === "error") {
      phaseStartRef.current = null;
      setProgress(0);
      return;
    }

    // Record the start time for this phase so we can map elapsed
    // time -> progress within that phase.
    phaseStartRef.current = performance.now();
  }, [status]);

  React.useEffect(() => {
    if (status === "idle" || status === "error") {
      return;
    }

    const interval = window.setInterval(() => {
      if (phaseStartRef.current == null) return;

      const now = performance.now();
      const elapsed = now - phaseStartRef.current;

      // Each ScoutStatus maps to a real phase of work in ScoutOS
      // and on the server. We treat progress as a function of time
      // spent in that phase, capped so it never falsely reaches 100%
      // before the phase actually changes. Phase ranges are tuned so
      // context-checking feels quick, document review does the heavy
      // lifting, and READY eases out smoothly.
      type PhaseConfig = { base: number; max: number; durationMs: number };
      const phaseConfig: Record<string, PhaseConfig> = {
        // Quick snap into motion while Scout reads account + locality
        resolving_context: { base: 0.06, max: 0.18, durationMs: 550 },
        // Heavier work: knowledge + documents. Slightly slower crawl so
        // users attribute wait time to real reading. Variable max to avoid
        // predictable stops.
        checking_documents: { base: 0.18, max: 0.75 + Math.random() * 0.15, durationMs: 4200 },
        // When Scout is running tools or navigation actions, stay below
        // 100% but show confident forward motion.
        executing_action: { base: 0.6, max: 0.95 + Math.random() * 0.02, durationMs: 1900 },
        // Final synthesis on the client: short, smooth ease-out into 100%.
        ready: { base: 0.9, max: 1.0, durationMs: 750 },
      };

      const cfg: PhaseConfig =
        phaseConfig[status] ?? { base: 0.05, max: 0.8, durationMs: 2000 };

      const phaseSpan = Math.max(cfg.max - cfg.base, 0.01);
      let t = Math.min(1, elapsed / cfg.durationMs);

      // READY should feel like a smooth glide to 100%, not a linear
      // crawl. Use a simple ease-out curve for that phase only.
      if (status === "ready") {
        t = 1 - (1 - t) * (1 - t);
      }

      const value = cfg.base + t * phaseSpan;

      setProgress((prev) => {
        // Never move backwards; only advance toward the current phase max.
        const next = Math.max(prev, value);
        return Math.min(next, 1);
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
    // Rotate through status messages based on progress in this phase
    // to show Scout is actively working on different aspects
    const statusMessages = 
      mode === "contractors"
        ? [
            "Analyzing your project needs...",
            "Matching local contractors...",
            "Loading profiles and ratings..."
          ]
        : mode === "marketplace"
        ? [
            "Scanning local listings...",
            "Filtering matched offers...",
            "Loading marketplace updates..."
          ]
        : mode === "admin"
        ? [
            "Checking system status...",
            "Gathering activity reports...",
            "Compiling control settings..."
          ]
        : [
            "Scanning your community...",
            "Reviewing local activity...",
            "Preparing community insights..."
          ];
    
    // Cycle through messages based on progress (0-1 range maps to 0-messages.length)
    const messageIndex = Math.floor(progress * statusMessages.length);
    statusLabel = statusMessages[Math.min(messageIndex, statusMessages.length - 1)];
  } else if (status === "executing_action") {
    statusLabel = "Starting that action...";
  } else if (status === "ready") {
    statusLabel = "Preparing your answer...";
  }

  // Show loader for any active phase so returning answers and actions
  // still surface a visible state indicator.
  const showProgress = 
    status !== "idle" && 
    status !== "error";

  const statusStyles: React.CSSProperties =
    status === "checking_documents"
      ? { color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }
      : status === "ready"
      ? { color: 'var(--text-primary)', border: '1px solid var(--theme-accent-primary)' }
      : { color: 'var(--text-secondary)', border: '1px solid var(--border-secondary)' };

  return (
    <div className="space-y-3 pr-1 flex-1 min-h-0 overflow-y-auto">
      {messages.map((msg) => {
        const isUser = msg.role === "user";

        // When a structured frame is present, prefer rendering its
        // truth/meaning/direction blocks explicitly and trim any
        // overlapping paragraphs from the raw content so we stay
        // within the tight, screen-fit answer budget.
        let displayContent = msg.content;
        if (!isUser && msg.frame && typeof msg.content === "string") {
          const { truthLines, meaningLine, directionLine } = msg.frame;
          const toStrip = [
            ...(Array.isArray(truthLines) ? truthLines : []),
            meaningLine,
            directionLine,
          ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

          if (toStrip.length > 0) {
            const paragraphs = msg.content
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter((p) => p.length > 0);

            const filtered = paragraphs.filter(
              (p) => !toStrip.some((line) => p === line.trim())
            );

            displayContent = filtered.join("\n\n");
          }
        }

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
                "scout-message",
                isUser ? "user" : "assistant"
              )}
            >
              {displayContent && (
                <p className="whitespace-pre-line leading-relaxed">
                  {displayContent}
                </p>
              )}

              {/* Frame-level action chips (e.g., Open Finances, Open Deal Room)
                  render as navigation buttons just below the core answer. */}
              {!isUser && msg.frame?.actionChips && msg.frame.actionChips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.frame.actionChips.map((chip) => (
                    <button
                      key={`${msg.id}-chip-${chip.id}`}
                      type="button"
                      onClick={() => {
                        if (!onAction) return;
                        if (chip.kind === "NAVIGATE") {
                          onAction({
                            type: "NAVIGATE",
                            label: chip.label,
                            to: chip.target,
                            path: chip.target,
                            payload:
                              chip.args && typeof chip.args === "object"
                                ? (chip.args as Record<string, unknown>)
                                : undefined,
                          });
                        }
                      }}
                      className="scout-action-button"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
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
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.suggestedActions.map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => onQuickAction && onQuickAction(act)}
                      className="scout-suggestion px-3 py-1.5 text-[11px] rounded-full"
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
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--charcoal-800)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-150 ease-out"
              style={{
                width: `${Math.max(5, Math.min(Math.round(progress * 100), 100))}%`,
                background: 'linear-gradient(to right, var(--theme-accent-primary), var(--theme-accent-secondary), var(--theme-accent-tertiary, var(--theme-accent-primary)))',
              }}
            />
          </div>

          <div className="flex justify-start">
            <div
              className={clsx(
                "mt-1 inline-flex items-center rounded-2xl px-3 py-1 text-[11px]"
              )}
              style={{ backgroundColor: 'color-mix(in oklab, var(--bg-quaternary) 85%, black)', ...statusStyles }}
            >
              <span className="mr-1 h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--theme-accent-primary)' }} />
              {statusLabel ?? "Scout is thinking about the best local answer..."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoutThread;
