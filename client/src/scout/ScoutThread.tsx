import React from "react";
import clsx from "clsx";
import type { ScoutMode } from "./api";
import type { ScoutAction, ScoutCluster, ScoutMessage, ScoutStatus } from "./state";
import { validateAction } from "./actionValidation";
import { CommunityCTA } from "@/components/community/CommunityCTA";
import { OnboardingPrompt } from "./OnboardingPrompt";

type ScoutThreadProps = {
  messages: ScoutMessage[];
  status: ScoutStatus;
  mode?: ScoutMode;
  showControllerExtras?: boolean;
  onAction?: (action: ScoutAction) => void;
  onQuickAction?: (text: string) => void;
  onOverride?: (option: NonNullable<ScoutMessage["overrideOption"]>) => void;
  overridePendingScope?: string | null;
  onSendMessage?: (payload: any) => void;
};

function AssistantStreamedText({
  content,
  shouldAnimate,
}: {
  content: string;
  shouldAnimate: boolean;
}) {
  const [visibleChars, setVisibleChars] = React.useState(() =>
    shouldAnimate ? 0 : content.length
  );

  React.useEffect(() => {
    if (!shouldAnimate) {
      setVisibleChars(content.length);
      return;
    }

    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || content.length <= 60) {
      setVisibleChars(content.length);
      return;
    }

    setVisibleChars(0);
    const step = Math.max(2, Math.ceil(content.length / 70));
    const timer = window.setInterval(() => {
      setVisibleChars((prev) => {
        if (prev >= content.length) {
          window.clearInterval(timer);
          return content.length;
        }
        return Math.min(content.length, prev + step);
      });
    }, 12);

    return () => window.clearInterval(timer);
  }, [content, shouldAnimate]);

  return <>{content.slice(0, visibleChars)}</>;
}

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeActionText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEvidenceChips(msg: ScoutMessage): string[] {
  const provenance = msg.provenance;
  if (!provenance) return [];

  const chips: string[] = [];

  if (provenance.sourceUsed) {
    chips.push(`Source: ${humanizeToken(provenance.sourceUsed)}`);
  }

  if (provenance.confidenceBand) {
    chips.push(`Confidence: ${humanizeToken(provenance.confidenceBand)}`);
  }

  if (typeof provenance.knowledgeLayer === "number") {
    chips.push(`Layer: ${provenance.knowledgeLayer}`);
  }

  if (provenance.fallbackUsed) {
    chips.push("Fallback: Active");
  }

  if (provenance.degradationReason) {
    chips.push(`Degraded: ${humanizeToken(provenance.degradationReason)}`);
  }

  if (provenance.blockingReason) {
    chips.push(`Authority: Gated (${humanizeToken(provenance.blockingReason)})`);
  } else if (Array.isArray(provenance.allowedActions) && provenance.allowedActions.length > 0) {
    chips.push("Authority: Clear");
  }

  return chips;
}

function EvidenceStrip({ msg, enabled }: { msg: ScoutMessage; enabled: boolean }) {
  const [open, setOpen] = React.useState(false);
  const chips = React.useMemo(() => buildEvidenceChips(msg), [msg]);
  const evidenceSources = React.useMemo(() => {
    const sourceTitles = Array.isArray(msg.provenance?.sourceTitles)
      ? msg.provenance?.sourceTitles
      : [];
    return sourceTitles.slice(0, 2);
  }, [msg.provenance?.sourceTitles]);

  if (!enabled) return null;
  if (chips.length === 0 && evidenceSources.length === 0) return null;

  return (
    <div className="scout-evidence-strip" aria-label="Scout evidence and authority">
      <button
        type="button"
        className="scout-evidence-chip"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide why" : "Why this answer"}
      </button>

      {open && (
        <>
          {chips.length > 0 && (
            <div className="scout-evidence-chip-row">
              {chips.map((chip) => (
                <span key={`${msg.id}-${chip}`} className="scout-evidence-chip">
                  {chip}
                </span>
              ))}
            </div>
          )}
          {evidenceSources.length > 0 && (
            <div className="scout-evidence-sources">Evidence: {evidenceSources.join(" | ")}</div>
          )}
        </>
      )}
    </div>
  );
}
function MessageExtras({
  msg,
  isUser,
  showControllerExtras,
  onAction,
  onQuickAction,
  onOverride,
  overridePendingScope,
  onSendMessage,
}: {
  msg: ScoutMessage;
  isUser: boolean;
  showControllerExtras: boolean;
  onAction?: (action: ScoutAction) => void;
  onQuickAction?: (text: string) => void;
  onOverride?: (option: NonNullable<ScoutMessage["overrideOption"]>) => void;
  overridePendingScope?: string | null;
  onSendMessage?: (payload: any) => void;
}) {
  if (isUser) return null;

  const hasActionChips = Boolean(msg.frame?.actionChips && msg.frame.actionChips.length > 0);
  const hasClusters = Boolean(msg.clusters && msg.clusters.length > 0);
  const hasOverride = Boolean(msg.overrideOption);
  const hasOnboardingPrompt = Boolean(
    msg.onboarding?.active && Boolean(msg.onboarding.question) && Boolean(onSendMessage)
  );

  const [controllerOpen, setControllerOpen] = React.useState(() => !showControllerExtras);
  const [controllerShowAll, setControllerShowAll] = React.useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);

  const prioritizedActionChips = React.useMemo(() => {
    const chips = Array.isArray(msg.frame?.actionChips) ? msg.frame.actionChips : [];
    return [...chips].sort((a, b) => {
      const aIsNavigate = a.kind === "NAVIGATE";
      const bIsNavigate = b.kind === "NAVIGATE";
      if (aIsNavigate !== bIsNavigate) return aIsNavigate ? -1 : 1;
      const aHasSubtitle = Boolean(a.subtitle);
      const bHasSubtitle = Boolean(b.subtitle);
      if (aHasSubtitle !== bHasSubtitle) return aHasSubtitle ? -1 : 1;
      return 0;
    });
  }, [msg.frame?.actionChips]);

  const visibleActionChips = React.useMemo(() => {
    if (controllerShowAll) return prioritizedActionChips;
    return prioritizedActionChips.slice(0, 2);
  }, [controllerShowAll, prioritizedActionChips]);

  const visibleClusters = React.useMemo(() => {
    const clusters = Array.isArray(msg.clusters) ? msg.clusters : [];
    if (controllerShowAll) return clusters;
    return clusters.slice(0, 2);
  }, [controllerShowAll, msg.clusters]);

  const dedupedSuggestions = React.useMemo(() => {
    const suggestions = Array.isArray(msg.suggestedActions) ? msg.suggestedActions : [];
    if (!suggestions.length) return [];

    const taken = new Set<string>();

    for (const chip of msg.frame?.actionChips || []) {
      if (chip.label) {
        taken.add(normalizeActionText(chip.label));
      }
    }

    for (const cluster of msg.clusters || []) {
      if (cluster.title) {
        taken.add(normalizeActionText(cluster.title));
      }
      if (cluster.primaryAction?.label) {
        taken.add(normalizeActionText(cluster.primaryAction.label));
      }
      for (const action of cluster.actions || []) {
        if (action.label) {
          taken.add(normalizeActionText(action.label));
        }
      }
    }

    const seen = new Set<string>();
    const filtered: string[] = [];
    for (const suggestion of suggestions) {
      const key = normalizeActionText(suggestion);
      if (!key) continue;
      if (seen.has(key)) continue;
      if (taken.has(key)) continue;
      seen.add(key);
      filtered.push(suggestion);
    }

    return filtered;
  }, [msg.suggestedActions, msg.frame?.actionChips, msg.clusters]);

  const hasSuggestions = dedupedSuggestions.length > 0;
  const shouldShowSuggestions = hasSuggestions && !hasActionChips && !hasClusters;

  const hasAnything =
    hasActionChips || hasClusters || hasOverride || hasSuggestions || hasOnboardingPrompt;

  if (!hasAnything) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Keep the chat bubble clean: render actions/suggestions as separate blocks. */}

      {(hasActionChips || hasClusters || (showControllerExtras && hasOverride)) && (
        <div
          className="rounded-lg border p-2"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "color-mix(in oklab, var(--surface-intermediate) 84%, transparent)",
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Next steps
            </div>
            <button
              type="button"
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
                backgroundColor: "transparent",
              }}
              onClick={() => setControllerOpen((v) => !v)}
              aria-expanded={controllerOpen}
            >
              {controllerOpen ? "Hide" : "Show"}
            </button>
          </div>

          {controllerOpen && (
            <div className="space-y-2">
              {!isUser && msg.frame?.actionChips && msg.frame.actionChips.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {visibleActionChips.map((chip) => (
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
                        <div className="flex flex-col items-start text-left">
                          <span>{chip.label}</span>
                          {chip.subtitle && (
                            <span className="text-[11px] opacity-80">{chip.subtitle}</span>
                          )}
                          {(chip as any).why && (
                            <span className="text-[10px] opacity-70">{(chip as any).why}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {prioritizedActionChips.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setControllerShowAll((v) => !v)}
                      className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium"
                      style={{
                        borderColor: "var(--border-subtle)",
                        color: "var(--text-secondary)",
                        backgroundColor: "transparent",
                      }}
                    >
                      {controllerShowAll
                        ? "Show fewer"
                        : `More actions (${prioritizedActionChips.length - 2})`}
                    </button>
                  )}
                </div>
              )}

              {msg.clusters && msg.clusters.length > 0 && (
                <div className="space-y-2">
                  {visibleClusters.map((cluster) => (
                    <ClusterCard key={cluster.id} cluster={cluster} onAction={onAction} />
                  ))}

                  {msg.clusters.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setControllerShowAll((v) => !v)}
                      className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium"
                      style={{
                        borderColor: "var(--border-subtle)",
                        color: "var(--text-secondary)",
                        backgroundColor: "transparent",
                      }}
                    >
                      {controllerShowAll
                        ? "Show fewer sections"
                        : `More sections (${msg.clusters.length - 2})`}
                    </button>
                  )}
                </div>
              )}

              {showControllerExtras && msg.overrideOption && (
                <div
                  className="rounded-lg border border-dashed p-3"
                  style={{
                    backgroundColor:
                      "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {msg.overrideOption.message}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOverride && onOverride(msg.overrideOption!)}
                      disabled={overridePendingScope === (msg.overrideOption.scope ?? "global")}
                      className="scout-action-button"
                    >
                      {overridePendingScope === (msg.overrideOption.scope ?? "global")
                        ? "Logging override..."
                        : msg.overrideOption.label}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {shouldShowSuggestions && (
        <div
          className="rounded-lg border p-2"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "color-mix(in oklab, var(--surface-card) 88%, transparent)",
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Keep going
            </div>
            <button
              type="button"
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
                backgroundColor: "transparent",
              }}
              onClick={() => setSuggestionsOpen((v) => !v)}
              aria-expanded={suggestionsOpen}
            >
              {suggestionsOpen ? "Hide" : `Show (${dedupedSuggestions.length})`}
            </button>
          </div>

          {suggestionsOpen && (
            <div className="flex flex-wrap gap-2">
              {dedupedSuggestions.map((act) => (
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
      )}

      {/* Onboarding: Server-controlled, renders only when active + question exists */}
      {msg.onboarding?.active && msg.onboarding.question && onSendMessage && (
        <OnboardingPrompt
          onboarding={msg.onboarding}
          mode="card"
          onAnswer={(value) =>
            onSendMessage({
              onboardingAnswer: {
                sessionId: msg.onboarding!.sessionId,
                questionKey: msg.onboarding!.question!.key,
                value,
              },
            })
          }
          onSkip={() =>
            onSendMessage({
              onboardingAnswer: {
                sessionId: msg.onboarding!.sessionId,
                questionKey: msg.onboarding!.question!.key,
                skipped: true,
              },
            })
          }
        />
      )}
    </div>
  );
}

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

  const [showAllActions, setShowAllActions] = React.useState(false);
  const prioritizedActions = React.useMemo(() => {
    const actions = Array.isArray(cluster.actions) ? cluster.actions : [];
    return [...actions].sort((a, b) => {
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      const aIsNavigate = a.type === "NAVIGATE";
      const bIsNavigate = b.type === "NAVIGATE";
      if (aIsNavigate !== bIsNavigate) return aIsNavigate ? -1 : 1;
      return 0;
    });
  }, [cluster.actions]);

  const visibleActions = React.useMemo(() => {
    if (showAllActions) return prioritizedActions;
    return prioritizedActions.slice(0, 2);
  }, [prioritizedActions, showAllActions]);

  return (
    <div className="scout-card mt-3 rounded-xl px-3 py-2">
      {cluster.title && (
        <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          {cluster.title}
        </div>
      )}

      {cluster.body && (
        <p
          className="mt-1 text-[13px] whitespace-pre-line"
          style={{ color: "var(--text-secondary)" }}
        >
          {cluster.body}
        </p>
      )}

      {cluster.items && cluster.items.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
          {cluster.items.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span
                className="mt-[3px] h-1 w-1 rounded-full"
                style={{ backgroundColor: "var(--text-muted)" }}
              />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      )}

      {cluster.actions && cluster.actions.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {visibleActions.map((action) => (
              <button
                key={`${cluster.id}-${action.label}`}
                type="button"
                onClick={() => handleAction(action)}
                className="scout-action-button"
              >
                <div className="flex flex-col items-start text-left">
                  <span>{action.label}</span>
                  {action.subtitle && (
                    <span className="text-[11px] opacity-80">{action.subtitle}</span>
                  )}
                  {(action.why || (action as any)._scoutWhy) && (
                    <span className="text-[10px] opacity-70">
                      {action.why ?? (action as any)._scoutWhy}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {prioritizedActions.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllActions((v) => !v)}
              className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
                backgroundColor: "transparent",
              }}
            >
              {showAllActions ? "Show fewer" : `More actions (${prioritizedActions.length - 2})`}
            </button>
          )}
        </div>
      )}

      {!cluster.actions && cluster.primaryAction && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handlePrimary}
            className="inline-flex items-center justify-center rounded-full px-3 py-2 text-xs font-semibold transition"
            style={{
              backgroundColor: "var(--theme-accent-primary)",
              color: "var(--ts-text-on-accent, #0B0F14)",
            }}
          >
            <div className="flex flex-col items-start text-left">
              <span>{cluster.primaryAction.label}</span>
              {cluster.primaryAction.subtitle && (
                <span className="text-[11px] opacity-80">{cluster.primaryAction.subtitle}</span>
              )}
              {(cluster.primaryAction.why || (cluster.primaryAction as any)._scoutWhy) && (
                <span className="text-[10px] opacity-70">
                  {cluster.primaryAction.why ?? (cluster.primaryAction as any)._scoutWhy}
                </span>
              )}
            </div>
          </button>
        </div>
      )}

      {cluster.ctaSource && cluster.ctaContextId && (
        <div className="mt-2 space-y-1">
          {cluster.ctaLabel && cluster.ctaSource === "trade_deal" && (
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
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
  showControllerExtras = true,
  onAction,
  onQuickAction,
  onOverride,
  overridePendingScope,
  onSendMessage,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = React.useState(0);
  const phaseStartRef = React.useRef<number | null>(null);

  const latestAssistantMessageId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    if (lastMessage.role === "assistant") {
      const target = node.querySelector<HTMLElement>(`[data-scout-message-id="${lastMessage.id}"]`);
      if (target) {
        target.scrollIntoView({ block: "end", behavior: "smooth" });
        return;
      }
    }

    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages]);

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

      const cfg: PhaseConfig = phaseConfig[status] ?? { base: 0.05, max: 0.8, durationMs: 2000 };

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
            "Loading profiles and trust (CVS)...",
          ]
        : mode === "marketplace"
          ? [
              "Scanning local listings...",
              "Filtering matched offers...",
              "Loading marketplace updates...",
            ]
          : mode === "admin"
            ? [
                "Checking system status...",
                "Gathering activity reports...",
                "Compiling control settings...",
              ]
            : [
                "Scanning your community...",
                "Reviewing local activity...",
                "Preparing community insights...",
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
  const showProgress = status !== "idle" && status !== "error";

  const statusStyles: React.CSSProperties =
    status === "checking_documents"
      ? { color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }
      : status === "ready"
        ? { color: "var(--text-primary)", border: "1px solid var(--theme-accent-primary)" }
        : { color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" };

  return (
    <div
      ref={containerRef}
      className="scout-thread space-y-3 flex-1 min-h-0 overflow-y-auto"
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
    >
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

            const filtered = paragraphs.filter((p) => !toStrip.some((line) => p === line.trim()));

            displayContent = filtered.join("\n\n");
          }
        }

        return (
          <div key={msg.id} className="space-y-2" data-scout-message-id={msg.id}>
            <div className={clsx("scout-row", isUser ? "user" : "assistant")}>
              {!isUser && (
                <div className="scout-avatar" aria-hidden="true">
                  TS
                </div>
              )}

              <div className="min-w-0">
                <div className={clsx("scout-sender", isUser ? "user" : "assistant")}>
                  {isUser ? "You" : "Scout"}
                </div>
                <div className={clsx("scout-message", isUser ? "user" : "assistant")}>
                  {displayContent && (
                    <p className="whitespace-pre-line leading-relaxed">
                      {isUser ? (
                        displayContent
                      ) : (
                        <AssistantStreamedText
                          content={displayContent}
                          shouldAnimate={msg.id === latestAssistantMessageId}
                        />
                      )}
                    </p>
                  )}
                </div>
                {!isUser && <EvidenceStrip msg={msg} enabled={showControllerExtras} />}
              </div>
            </div>

            <MessageExtras
              msg={msg}
              isUser={isUser}
              showControllerExtras={showControllerExtras}
              onAction={onAction}
              onQuickAction={onQuickAction}
              onOverride={onOverride}
              overridePendingScope={overridePendingScope}
              onSendMessage={onSendMessage}
            />
          </div>
        );
      })}

      {showProgress && (
        <div className="space-y-1">
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--charcoal-800)" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-150 ease-out"
              style={{
                width: `${Math.max(5, Math.min(Math.round(progress * 100), 100))}%`,
                background:
                  "linear-gradient(to right, var(--theme-accent-primary), var(--theme-accent-secondary), var(--theme-accent-tertiary, var(--theme-accent-primary)))",
              }}
            />
          </div>

          <div className="flex justify-start">
            <div
              className={clsx("mt-1 inline-flex items-center rounded-2xl px-3 py-1 text-[11px]")}
              style={{
                backgroundColor:
                  "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
                ...statusStyles,
              }}
            >
              <span
                className="mr-1 h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: "var(--theme-accent-primary)" }}
              />
              {statusLabel ?? "Scout is thinking about the best local answer..."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoutThread;
