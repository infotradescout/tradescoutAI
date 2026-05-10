import React from "react";
import clsx from "clsx";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  ClipboardList,
  HelpCircle,
  MessageSquareText,
  Search,
  Store,
  Users2,
} from "lucide-react";
import type { ScoutMode } from "./api";
import type { ScoutAction, ScoutCluster, ScoutMessage, ScoutStatus } from "./state";
import type { ScoutContextCard } from "./scoutContextCards";
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
  pendingContextCards?: ScoutContextCard[];
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

function actionTarget(action: ScoutAction): string {
  return String(action.to || action.path || action.prompt || action.payload?.route || action.type);
}

function clusterKindMeta(kind: ScoutCluster["kind"]) {
  switch (kind) {
    case "pros":
      return { label: "Local help", icon: Users2 };
    case "marketplace":
      return { label: "Exchange", icon: Store };
    case "community":
      return { label: "Nearby activity", icon: MessageSquareText };
    case "projects":
      return { label: "Saved search", icon: ClipboardList };
    case "rules":
      return { label: "What to check", icon: BadgeCheck };
    case "site":
      return { label: "Ask Scout", icon: Search };
    case "account":
      return { label: "Account", icon: BadgeCheck };
    default:
      return { label: "Result", icon: Search };
  }
}

function defaultActionsForCluster(cluster: ScoutCluster): ScoutAction[] {
  if (cluster.kind === "pros") {
    return [
      {
        type: "NAVIGATE",
        label: "Create request",
        to: "/direct-connect",
        subtitle: "Review before sharing",
      },
      {
        type: "NAVIGATE",
        label: "Browse local help",
        to: "/direct-connect/pros",
      },
    ];
  }

  if (cluster.kind === "community") {
    return [{ type: "NAVIGATE", label: "See local posts", to: "/community" }];
  }

  if (cluster.kind === "marketplace") {
    return [{ type: "NAVIGATE", label: "Open Exchange", to: "/exchange" }];
  }

  if (cluster.kind === "projects") {
    return [{ type: "NAVIGATE", label: "Save this search", to: "/direct-connect" }];
  }

  if (cluster.kind === "site") {
    return [
      { type: "ASK_SCOUT", label: "Ask Scout", prompt: `Help me with ${cluster.title || "this"}.` },
    ];
  }

  if (cluster.kind === "rules") {
    return [
      {
        type: "ASK_SCOUT",
        label: "Ask before calling",
        prompt: `Tell me what I should check before calling about ${cluster.title || "this"}.`,
      },
    ];
  }

  if (cluster.kind === "account") {
    return [{ type: "NAVIGATE", label: "Open settings", to: "/settings" }];
  }

  return [];
}

function buildAskScoutAction(cluster: ScoutCluster): ScoutAction {
  const title = cluster.title || "this result";
  const bodyHint = cluster.body ? ` Context: ${cluster.body.slice(0, 180)}` : "";

  return {
    type: "ASK_SCOUT",
    label: "Ask Scout",
    prompt: `Tell me more about ${title} and what I can safely do next.${bodyHint}`,
  };
}

function mergeClusterActions(cluster: ScoutCluster): ScoutAction[] {
  const candidates = [
    ...(cluster.primaryAction ? [{ ...cluster.primaryAction, primary: true }] : []),
    ...(Array.isArray(cluster.actions) ? cluster.actions : []),
    ...defaultActionsForCluster(cluster),
    buildAskScoutAction(cluster),
  ];
  const seen = new Set<string>();
  const merged: ScoutAction[] = [];

  for (const action of candidates) {
    const key = [action.type, normalizeActionText(action.label || ""), actionTarget(action)].join(
      "|"
    );
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(action);
  }

  return merged;
}

function quickStartsForPendingSearch(userMessage?: string): string[] {
  const text = String(userMessage || "").toLowerCase();
  if (/\b(ac|a c|hvac|heat|heating|furnace|air conditioner|not cooling|no heat)\b/.test(text)) {
    return ["AC or heating", "Ask before calling", "Check prices"];
  }
  if (/\b(plumb|pipe|drain|toilet|sink|water heater|leak)\b/.test(text)) {
    return ["Plumbing", "Soon or flexible", "Check prices"];
  }
  if (/\b(roof|shingle|gutter|leak)\b/.test(text)) {
    return ["Roofing", "Quote questions", "Find local help"];
  }
  if (/\b(concrete|driveway|slab|sidewalk)\b/.test(text)) {
    return ["Concrete", "Compare prices", "Find local help"];
  }
  return ["Find someone", "Check prices", "Ask before calling"];
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
        {open ? "Hide details" : "Why this helps"}
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
            <div className="scout-evidence-sources">Checked: {evidenceSources.join(" | ")}</div>
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
              Options
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
  const handleAction = (action: ScoutAction) => {
    if (onAction) {
      const validated = validateAction(action);
      if (validated) {
        onAction(validated);
      }
    }
  };

  const [showAllActions, setShowAllActions] = React.useState(false);
  const kindMeta = clusterKindMeta(cluster.kind);
  const KindIcon = kindMeta.icon;
  const prioritizedActions = React.useMemo(() => {
    const actions = mergeClusterActions(cluster);
    return [...actions].sort((a, b) => {
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      const aIsNavigate = a.type === "NAVIGATE";
      const bIsNavigate = b.type === "NAVIGATE";
      if (aIsNavigate !== bIsNavigate) return aIsNavigate ? -1 : 1;
      const aIsAsk = a.type === "ASK_SCOUT";
      const bIsAsk = b.type === "ASK_SCOUT";
      if (aIsAsk !== bIsAsk) return aIsAsk ? 1 : -1;
      return 0;
    });
  }, [cluster]);

  const visibleActions = React.useMemo(() => {
    if (showAllActions) return prioritizedActions;
    return prioritizedActions.slice(0, 3);
  }, [prioritizedActions, showAllActions]);

  return (
    <article className="scout-result-card">
      <div className="scout-result-card__header">
        <div className="scout-result-card__icon" aria-hidden="true">
          <KindIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="scout-result-card__kind">{kindMeta.label}</div>
          <h4 className="scout-result-card__title">{cluster.title || kindMeta.label}</h4>
        </div>
        {cluster.primaryAction && <BadgeCheck className="h-4 w-4 text-ts-orange" />}
      </div>

      {cluster.body && <p className="scout-result-card__body">{cluster.body}</p>}

      {cluster.items && cluster.items.length > 0 && (
        <ul className="scout-result-card__items">
          {cluster.items.map((item) => (
            <li key={item.id} className="scout-result-card__item">
              <Bookmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ts-orange" />
              <span className="min-w-0">
                <span className="block font-medium text-[var(--text-primary)]">{item.label}</span>
                {item.description && (
                  <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">
                    {item.description}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {prioritizedActions.length > 0 && (
        <div className="scout-result-card__actions">
          <div className="flex flex-wrap gap-2">
            {visibleActions.map((action) => (
              <button
                key={`${cluster.id}-${action.type}-${action.label}-${actionTarget(action)}`}
                type="button"
                onClick={() => handleAction(action)}
                className={clsx(
                  "scout-result-action",
                  action.primary && "scout-result-action--primary",
                  action.type === "ASK_SCOUT" && "scout-result-action--ask"
                )}
              >
                <span className="scout-result-action__icon" aria-hidden="true">
                  {action.type === "ASK_SCOUT" ? (
                    <HelpCircle className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col items-start text-left">
                  <span>{action.label}</span>
                  {action.subtitle && (
                    <span className="text-[11px] opacity-80">{action.subtitle}</span>
                  )}
                  {(action.why || (action as any)._scoutWhy) && (
                    <span className="text-[10px] opacity-70">
                      {action.why ?? (action as any)._scoutWhy}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {prioritizedActions.length > 3 && (
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
              {showAllActions ? "Show fewer" : `More actions (${prioritizedActions.length - 3})`}
            </button>
          )}
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
    </article>
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
  pendingContextCards,
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

  const latestUserMessage = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "user") return messages[i];
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
    statusLabel = "Getting oriented...";
  } else if (status === "checking_documents") {
    // Rotate through status messages based on progress in this phase
    // to show Scout is actively working on different aspects
    const statusMessages =
      mode === "contractors"
        ? [
            "Reading your search...",
            "Finding nearby help...",
            "Checking trust and profile details...",
          ]
        : mode === "marketplace"
          ? [
              "Searching local listings...",
              "Comparing matching offers...",
              "Checking recent marketplace updates...",
            ]
          : mode === "admin"
            ? [
                "Checking system status...",
                "Gathering activity reports...",
                "Compiling control settings...",
              ]
            : ["Looking nearby...", "Checking local context...", "Getting options ready..."];

    // Cycle through messages based on progress (0-1 range maps to 0-messages.length)
    const messageIndex = Math.floor(progress * statusMessages.length);
    statusLabel = statusMessages[Math.min(messageIndex, statusMessages.length - 1)];
  } else if (status === "executing_action") {
    statusLabel = "Opening the next step...";
  } else if (status === "ready") {
    statusLabel = "Getting this ready...";
  }

  // Show loader for any active phase so returning answers and actions
  // still surface a visible state indicator.
  const showProgress = status !== "idle" && status !== "error";

  const statusStyles: React.CSSProperties =
    status === "checking_documents"
      ? { color: "var(--text-secondary)" }
      : status === "ready"
        ? { color: "var(--text-primary)" }
        : { color: "var(--text-secondary)" };

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
        <div
          className="rounded-2xl border p-3"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--surface-card)",
            boxShadow: "var(--surface-card-shadow)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="scout-avatar mt-0.5" aria-hidden="true">
              TS
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold" style={statusStyles}>
                {statusLabel ?? "Starting your search..."}
              </div>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                Tell me what happened, where it is, and how soon you need it. I’ll narrow it down
                while I look.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Array.isArray(pendingContextCards) && pendingContextCards.length > 0
                  ? pendingContextCards.slice(0, 3).map((card) => ({
                      key: card.id,
                      label: card.label,
                      onClick: () => onAction && onAction(card.action),
                    }))
                  : quickStartsForPendingSearch(latestUserMessage?.content).map((label) => ({
                      key: label,
                      label,
                      onClick: () => onQuickAction && onQuickAction(label),
                    }))
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                    style={{
                      borderColor: "var(--border-subtle)",
                      backgroundColor: "var(--surface-intermediate)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoutThread;
