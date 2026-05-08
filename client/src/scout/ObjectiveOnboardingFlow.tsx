import React, { useMemo, useState } from "react";

export type ObjectiveCardCategory =
  | "seasonal"
  | "maintenance"
  | "growth"
  | "community"
  | "compliance"
  | "trust";

export interface ObjectiveSuggestionView {
  id: string;
  title: string;
  description: string;
  category: ObjectiveCardCategory;
  estimatedMinutes: number;
  expectedValueScore: number;
  recommendedRoute: string;
  starterPrompt: string;
}

export interface FastWinCardView {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  actionTarget: string;
  objectiveId: string;
  valueScore: number;
  urgency: "low" | "medium" | "high";
}

export interface OnboardingStateView {
  objectiveId: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  completionPct: number;
  updatedAt: string;
}

export interface ObjectiveOnboardingFlowProps {
  roleLabel?: string;
  suggestions: ObjectiveSuggestionView[];
  fastWins: FastWinCardView[];
  objectiveStates?: OnboardingStateView[];
  nextRecommendedObjectiveId?: string;
  onStartObjective?: (objectiveId: string, starterPrompt: string) => void;
  onOpenRoute?: (route: string) => void;
  onCompleteFastWin?: (objectiveId: string) => void;
  className?: string;
}

function badgeColor(category: ObjectiveCardCategory): string {
  if (category === "seasonal") return "var(--status-warning)";
  if (category === "maintenance") return "var(--status-info)";
  if (category === "growth") return "var(--status-success)";
  if (category === "community") return "var(--theme-accent-primary)";
  if (category === "compliance") return "var(--status-error)";
  return "color-mix(in oklab, var(--theme-accent-primary) 60%, var(--status-info) 40%)";
}

function urgencyBadge(urgency: FastWinCardView["urgency"]): { label: string; tone: string } {
  if (urgency === "high") return { label: "High urgency", tone: "var(--status-error)" };
  if (urgency === "medium") return { label: "Medium urgency", tone: "var(--status-warning)" };
  return { label: "Low urgency", tone: "var(--status-success)" };
}

function statusLabel(state?: OnboardingStateView): string {
  if (!state) return "Not started";
  if (state.status === "completed") return "Completed";
  if (state.status === "in_progress") return `${Math.round(state.completionPct)}% complete`;
  if (state.status === "skipped") return "Skipped";
  return "Pending";
}

function pct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{
        borderColor: "var(--border-subtle)",
        background: "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)",
      }}
    >
      <div
        className="text-[11px] uppercase tracking-wide"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </div>
      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function ObjectiveSuggestionCard(props: {
  suggestion: ObjectiveSuggestionView;
  state?: OnboardingStateView;
  isRecommended: boolean;
  onStartObjective?: (objectiveId: string, starterPrompt: string) => void;
  onOpenRoute?: (route: string) => void;
}) {
  const { suggestion, state, isRecommended, onStartObjective, onOpenRoute } = props;

  const completion = pct(state?.completionPct ?? 0);
  const categoryTone = badgeColor(suggestion.category);

  return (
    <article
      className="rounded-lg border p-4"
      style={{
        borderColor: isRecommended ? "var(--theme-accent-primary)" : "var(--border-subtle)",
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--surface-card) 96%, transparent), color-mix(in oklab, var(--surface-intermediate) 95%, transparent))",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className="rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            color: "var(--text-primary)",
            border: `1px solid color-mix(in oklab, ${categoryTone} 40%, var(--border-subtle))`,
            background: `color-mix(in oklab, ${categoryTone} 20%, var(--surface-intermediate))`,
          }}
        >
          {suggestion.category}
        </span>

        {isRecommended && (
          <span
            className="rounded-full border px-2 py-1 text-[11px] font-semibold"
            style={{
              color: "var(--theme-accent-primary)",
              borderColor: "var(--theme-accent-primary)",
            }}
          >
            Next recommended
          </span>
        )}
      </div>

      <h4
        className="text-base font-semibold leading-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {suggestion.title}
      </h4>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {suggestion.description}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SummaryStat
          label="Value score"
          value={String(Math.round(suggestion.expectedValueScore))}
        />
        <SummaryStat label="Estimated" value={`${suggestion.estimatedMinutes} min`} />
      </div>

      <div className="mt-3">
        <div
          className="mb-1 flex items-center justify-between text-[11px]"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>Status</span>
          <span>{statusLabel(state)}</span>
        </div>
        <div
          className="h-1.5 rounded"
          style={{
            background: "color-mix(in oklab, var(--surface-intermediate) 88%, transparent)",
          }}
        >
          <div
            className="h-full rounded"
            style={{
              width: `${completion}%`,
              background: "var(--theme-accent-primary)",
              transition: "width 160ms ease",
            }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onStartObjective?.(suggestion.id, suggestion.starterPrompt)}
          className="rounded-md px-3 py-2 text-sm font-semibold"
          style={{
            color: "var(--ts-text-on-accent)",
            background: "var(--theme-accent-primary)",
          }}
        >
          Start objective
        </button>

        <button
          type="button"
          onClick={() => onOpenRoute?.(suggestion.recommendedRoute)}
          className="rounded-md border px-3 py-2 text-sm font-semibold"
          style={{
            color: "var(--text-primary)",
            borderColor: "var(--border-subtle)",
          }}
        >
          Open
        </button>
      </div>
    </article>
  );
}

function FastWinCard(props: {
  card: FastWinCardView;
  onOpenRoute?: (route: string) => void;
  onCompleteFastWin?: (objectiveId: string) => void;
}) {
  const { card, onOpenRoute, onCompleteFastWin } = props;
  const urgency = urgencyBadge(card.urgency);

  return (
    <article
      className="rounded-lg border p-4"
      style={{
        borderColor: "var(--border-subtle)",
        background: "color-mix(in oklab, var(--surface-card) 95%, transparent)",
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h5 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {card.title}
        </h5>
        <span
          className="rounded-full px-2 py-1 text-[11px] font-semibold"
          style={{
            color: urgency.tone,
            border: `1px solid color-mix(in oklab, ${urgency.tone} 40%, var(--border-subtle))`,
            background: `color-mix(in oklab, ${urgency.tone} 20%, var(--surface-intermediate))`,
          }}
        >
          {urgency.label}
        </span>
      </div>

      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {card.body}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Value score{" "}
          <strong style={{ color: "var(--text-primary)" }}>{Math.round(card.valueScore)}</strong>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-2.5 py-1.5 text-xs font-semibold"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-primary)",
            }}
            onClick={() => onOpenRoute?.(card.actionTarget)}
          >
            {card.actionLabel}
          </button>

          <button
            type="button"
            className="rounded-md px-2.5 py-1.5 text-xs font-semibold"
            style={{
              color: "var(--ts-text-on-accent)",
              backgroundColor: "var(--theme-accent-primary)",
            }}
            onClick={() => onCompleteFastWin?.(card.objectiveId)}
          >
            Mark complete
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * Guided first-step surface for Scout.
 *
 * This component is intentionally state-light:
 * - Server/service controls objective scoring and recommendation ordering.
 * - UI only handles local selection and emits user actions.
 */
export function ObjectiveOnboardingFlow({
  roleLabel,
  suggestions,
  fastWins,
  objectiveStates,
  nextRecommendedObjectiveId,
  onStartObjective,
  onOpenRoute,
  onCompleteFastWin,
  className,
}: ObjectiveOnboardingFlowProps) {
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(
    nextRecommendedObjectiveId ?? suggestions[0]?.id ?? null
  );
  const [showFastWins, setShowFastWins] = useState(true);

  const stateMap = useMemo(() => {
    return new Map((objectiveStates ?? []).map((state) => [state.objectiveId, state]));
  }, [objectiveStates]);

  const summary = useMemo(() => {
    const total = suggestions.length;
    const completed = (objectiveStates ?? []).filter((s) => s.status === "completed").length;
    const inProgress = (objectiveStates ?? []).filter((s) => s.status === "in_progress").length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      completionPct,
    };
  }, [objectiveStates, suggestions.length]);

  const selectedSuggestion = useMemo(
    () => suggestions.find((suggestion) => suggestion.id === selectedObjectiveId) ?? null,
    [selectedObjectiveId, suggestions]
  );

  if (suggestions.length === 0) {
    return (
      <section
        className={className}
        style={{
          border: "1px solid var(--border-subtle)",
          borderRadius: "12px",
          padding: "14px",
          background: "color-mix(in oklab, var(--surface-card) 95%, transparent)",
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Getting started
        </h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          No suggestions available yet. Ask Scout for a local objective to begin.
        </p>
      </section>
    );
  }

  return (
    <section
      className={className}
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: "12px",
        padding: "14px",
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--surface-card) 97%, transparent), color-mix(in oklab, var(--surface-intermediate) 96%, transparent))",
      }}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Your next steps
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {roleLabel ? `${roleLabel} path` : "Your path"} with quick wins and clear next steps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SummaryStat label="Objectives" value={String(summary.total)} />
          <SummaryStat label="Completed" value={String(summary.completed)} />
          <SummaryStat label="Progress" value={`${summary.completionPct}%`} />
        </div>
      </header>

      <div className="mb-4">
        <div
          className="mb-1 flex items-center justify-between text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>Completion</span>
          <span>{summary.completionPct}%</span>
        </div>
        <div
          className="h-2 rounded"
          style={{
            background: "color-mix(in oklab, var(--surface-intermediate) 90%, transparent)",
          }}
        >
          <div
            className="h-full rounded"
            style={{
              width: `${summary.completionPct}%`,
              background: "var(--theme-accent-primary)",
              transition: "width 180ms ease",
            }}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {suggestions.map((suggestion) => {
          const isRecommended = suggestion.id === nextRecommendedObjectiveId;
          return (
            <div key={suggestion.id} onMouseEnter={() => setSelectedObjectiveId(suggestion.id)}>
              <ObjectiveSuggestionCard
                suggestion={suggestion}
                state={stateMap.get(suggestion.id)}
                isRecommended={isRecommended}
                onStartObjective={onStartObjective}
                onOpenRoute={onOpenRoute}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border p-3" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Quick wins
          </h4>

          <button
            type="button"
            onClick={() => setShowFastWins((v) => !v)}
            className="rounded border px-2 py-1 text-xs"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--text-secondary)",
            }}
          >
            {showFastWins ? "Hide" : "Show"}
          </button>
        </div>

        {showFastWins ? (
          <div className="grid gap-3 md:grid-cols-2">
            {fastWins.map((card) => (
              <FastWinCard
                key={card.id}
                card={card}
                onOpenRoute={onOpenRoute}
                onCompleteFastWin={onCompleteFastWin}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Quick wins are hidden. Re-open them whenever you want another easy next step.
          </p>
        )}
      </div>

      {selectedSuggestion && (
        <footer
          className="mt-5 rounded-lg border p-3"
          style={{
            borderColor: "var(--border-subtle)",
            background: "color-mix(in oklab, var(--surface-intermediate) 94%, transparent)",
          }}
        >
          <div
            className="text-xs uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Selected step
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {selectedSuggestion.title}
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {selectedSuggestion.starterPrompt}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onStartObjective?.(selectedSuggestion.id, selectedSuggestion.starterPrompt)
              }
              className="rounded-md px-3 py-2 text-xs font-semibold"
              style={{
                color: "var(--ts-text-on-accent)",
                backgroundColor: "var(--theme-accent-primary)",
              }}
            >
              Send to Scout
            </button>

            <button
              type="button"
              onClick={() => onOpenRoute?.(selectedSuggestion.recommendedRoute)}
              className="rounded-md border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
            >
              Open
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}

export default ObjectiveOnboardingFlow;
