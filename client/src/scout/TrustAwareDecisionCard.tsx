import React, { useMemo, useState } from "react";
import type { ScoutAction } from "./state";
import { TrustSignalCard, type TrustSignalCardProps } from "./TrustSignalCard";

export interface TrustAwareDecisionCardProps {
  title: string;
  summary: string;
  primaryAction: ScoutAction;
  alternativeActions?: ScoutAction[];
  confidence?: number;
  confidenceBand?: "low" | "medium" | "high";
  riskLevel?: "low" | "medium" | "high";
  trust: {
    trustSignals: {
      cvsScore: number | null;
      confidenceLevel: "low" | "medium" | "high";
      confidenceNumeric: number;
      verifiedActivityProof: string;
      verificationStatus?: "approved" | "pending" | "rejected" | "suspended" | "unknown";
      riskFlags: string[];
      trustBandLabel: string;
      requiredReview: boolean;
    };
    minRequiredScore: number;
    trustFilterApplied: boolean;
  };
  onAction?: (action: ScoutAction) => void;
  onOpenTrustModel?: () => void;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toLabel(action: ScoutAction): string {
  return action.label || action.to || action.path || action.type;
}

function actionTarget(action: ScoutAction): string {
  if (typeof action.to === "string") return action.to;
  if (typeof action.path === "string") return action.path;
  return "";
}

function confidenceColor(confidenceBand?: "low" | "medium" | "high") {
  if (confidenceBand === "high") return "var(--status-success)";
  if (confidenceBand === "medium") return "var(--status-warning)";
  return "var(--status-error)";
}

function riskColor(riskLevel?: "low" | "medium" | "high") {
  if (riskLevel === "high") return "var(--status-error)";
  if (riskLevel === "medium") return "var(--status-warning)";
  return "var(--status-success)";
}

/**
 * Result card that explains safety checks before opening a next step.
 */
export function TrustAwareDecisionCard({
  title,
  summary,
  primaryAction,
  alternativeActions,
  confidence,
  confidenceBand,
  riskLevel,
  trust,
  onAction,
  onOpenTrustModel,
  className,
}: TrustAwareDecisionCardProps) {
  const [showTrustDetails, setShowTrustDetails] = useState(false);
  const [showAllAlternatives, setShowAllAlternatives] = useState(false);
  const signal = trust.trustSignals;

  const trustProps: TrustSignalCardProps = {
    cvsScore: signal.cvsScore,
    confidenceLevel: signal.confidenceLevel,
    confidenceNumeric: signal.confidenceNumeric,
    verifiedActivityProof: signal.verifiedActivityProof,
    verificationStatus: signal.verificationStatus,
    riskFlags: signal.riskFlags,
    trustBandLabel: signal.trustBandLabel,
    requiredReview: signal.requiredReview,
    compact: false,
  };

  const normalizedScore = signal.cvsScore === null ? 55 : clamp(signal.cvsScore, 0, 100);
  const primaryAllowed = !signal.requiredReview && normalizedScore >= trust.minRequiredScore;

  const gateReason = useMemo(() => {
    if (signal.requiredReview) {
      return "This needs a quick review before contact or sharing opens.";
    }
    if (!primaryAllowed) {
      return "This match needs more trust info before contact or sharing opens.";
    }
    return null;
  }, [primaryAllowed, normalizedScore, signal.requiredReview, trust.minRequiredScore]);

  const displayedConfidence = Math.round(clamp(Number(confidence ?? 0.65) * 100, 0, 100));
  const finalAlt = (alternativeActions ?? []).slice(0, 3);
  const visibleAlternatives = showAllAlternatives ? finalAlt : finalAlt.slice(0, 1);

  return (
    <article
      className={className}
      style={{
        borderRadius: "12px",
        border: "1px solid var(--border-subtle)",
        background:
          "linear-gradient(160deg, color-mix(in oklab, var(--surface-card) 97%, transparent), color-mix(in oklab, var(--surface-intermediate) 96%, transparent))",
        padding: "14px",
      }}
    >
      <header className="mb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: "color-mix(in oklab, var(--surface-intermediate) 93%, transparent)",
              color: "var(--text-secondary)",
            }}
          >
            Suggested next step
          </span>

          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-2 py-1 text-[11px] font-semibold"
              style={{
                background: "color-mix(in oklab, var(--surface-intermediate) 93%, transparent)",
                color: confidenceColor(confidenceBand),
              }}
            >
              Match {displayedConfidence}%
            </span>

            <span
              className="rounded-full px-2 py-1 text-[11px] font-semibold"
              style={{
                background: "color-mix(in oklab, var(--surface-intermediate) 93%, transparent)",
                color: riskColor(riskLevel),
              }}
            >
              Safety {String(riskLevel || "low").toUpperCase()}
            </span>
          </div>
        </div>

        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>

        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {summary}
        </p>
      </header>

      <div className="mb-3">
        <button
          type="button"
          className="rounded border px-2.5 py-1.5 text-xs"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          onClick={() => setShowTrustDetails((v) => !v)}
        >
          {showTrustDetails ? "Hide why this is safer" : "Why this is safer"}
        </button>

        {showTrustDetails && (
          <div className="mt-2">
            <TrustSignalCard {...trustProps} />
          </div>
        )}
      </div>

      <div
        className="mb-3 rounded-md border p-2"
        style={{
          borderColor: primaryAllowed ? "var(--border-subtle)" : "var(--status-error)",
          background: "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)",
        }}
      >
        <div
          className="mb-1 text-[11px] uppercase tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          Best match
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {toLabel(primaryAction)}
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {actionTarget(primaryAction) || primaryAction.type}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAction?.(primaryAction)}
            disabled={!primaryAllowed}
            className="w-full rounded-md px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
            style={{
              color: "var(--ts-text-on-accent)",
              background: "var(--theme-accent-primary)",
            }}
          >
            Continue
          </button>
        </div>

        {gateReason && (
          <p className="mt-2 text-xs" style={{ color: "var(--status-error)" }}>
            {gateReason}
          </p>
        )}
      </div>

      {finalAlt.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div
              className="text-[11px] uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              Other options
            </div>
            {finalAlt.length > 1 && (
              <button
                type="button"
                className="text-xs font-medium"
                style={{ color: "var(--theme-accent-primary)" }}
                onClick={() => setShowAllAlternatives((v) => !v)}
              >
                {showAllAlternatives ? "Show fewer" : `Show all (${finalAlt.length})`}
              </button>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {visibleAlternatives.map((action) => {
              const label = toLabel(action);
              return (
                <button
                  key={`${action.type}_${label}_${actionTarget(action)}`}
                  type="button"
                  onClick={() => onAction?.(action)}
                  className="rounded-md border p-2 text-left"
                  style={{
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                    background: "color-mix(in oklab, var(--surface-card) 96%, transparent)",
                  }}
                >
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {actionTarget(action) || action.type}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <footer className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {trust.trustFilterApplied ? "Extra safety check applied" : "No extra safety check needed"}
        </div>

        <button
          type="button"
          className="rounded border px-2.5 py-1.5 text-xs"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          onClick={onOpenTrustModel}
        >
          How safety works
        </button>
      </footer>
    </article>
  );
}

export default TrustAwareDecisionCard;
