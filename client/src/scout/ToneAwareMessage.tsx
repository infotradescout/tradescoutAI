import React from "react";

export interface ToneAwareMessageProps {
  message: string;
  scenario?:
    | "default"
    | "technical_fallback"
    | "confidence_low"
    | "blocked_action"
    | "next_step_prompt";
  toneScore?: number;
  guardrailFlags?: string[];
  confidenceBand?: "low" | "medium" | "high";
  onUseNextStep?: () => void;
  className?: string;
}

function scenarioLabel(scenario: ToneAwareMessageProps["scenario"]): string {
  if (scenario === "technical_fallback") return "Fallback";
  if (scenario === "confidence_low") return "Low confidence";
  if (scenario === "blocked_action") return "Action gated";
  if (scenario === "next_step_prompt") return "Next step";
  return "Scout";
}

function scoreColor(score?: number): string {
  if (typeof score !== "number") return "var(--text-secondary)";
  if (score >= 85) return "#22c55e";
  if (score >= 65) return "#f59e0b";
  return "#ef4444";
}

function confidenceLabel(band?: ToneAwareMessageProps["confidenceBand"]): string {
  if (band === "high") return "High confidence";
  if (band === "medium") return "Medium confidence";
  if (band === "low") return "Low confidence";
  return "Confidence pending";
}

/**
 * Render a tone-aware Scout message with transparent quality signals.
 */
export function ToneAwareMessage({
  message,
  scenario = "default",
  toneScore,
  guardrailFlags,
  confidenceBand,
  onUseNextStep,
  className,
}: ToneAwareMessageProps) {
  return (
    <article
      className={className}
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: "12px",
        padding: "12px",
        background:
          "linear-gradient(160deg, color-mix(in oklab, var(--surface-card) 97%, transparent), color-mix(in oklab, var(--surface-intermediate) 95%, transparent))",
      }}
    >
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          {scenarioLabel(scenario)}
        </span>

        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: "var(--text-secondary)" }}>{confidenceLabel(confidenceBand)}</span>
          {typeof toneScore === "number" && (
            <span style={{ color: scoreColor(toneScore), fontWeight: 700 }}>
              Tone {Math.round(toneScore)}
            </span>
          )}
        </div>
      </header>

      <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
        {message}
      </p>

      {Array.isArray(guardrailFlags) && guardrailFlags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {guardrailFlags.slice(0, 4).map((flag) => (
            <span
              key={flag}
              className="rounded-full px-2 py-1 text-[11px]"
              style={{
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                background: "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)",
              }}
            >
              {flag.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {onUseNextStep && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onUseNextStep}
            className="rounded-md px-3 py-2 text-xs font-semibold"
            style={{ color: "#111827", backgroundColor: "var(--theme-accent-primary)" }}
          >
            Use next step
          </button>
        </div>
      )}
    </article>
  );
}

export default ToneAwareMessage;
