import React from "react";

export interface TrustSignalCardProps {
  cvsScore: number | null;
  confidenceLevel: "low" | "medium" | "high";
  confidenceNumeric?: number;
  verifiedActivityProof: string;
  verificationStatus?: "approved" | "pending" | "rejected" | "suspended" | "unknown";
  riskFlags?: string[];
  trustBandLabel?: string;
  requiredReview?: boolean;
  compact?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function statusLabel(status?: TrustSignalCardProps["verificationStatus"]): string {
  if (status === "approved") return "Verification approved";
  if (status === "pending") return "Verification pending";
  if (status === "rejected") return "Verification rejected";
  if (status === "suspended") return "Verification suspended";
  return "Verification unknown";
}

function confidenceColor(level: TrustSignalCardProps["confidenceLevel"]): string {
  if (level === "high") return "var(--status-success)";
  if (level === "medium") return "var(--status-warning)";
  return "var(--status-error)";
}

function scoreColor(score: number | null): string {
  if (score === null) return "var(--text-secondary)";
  if (score >= 80) return "var(--status-success)";
  if (score >= 50) return "var(--status-warning)";
  return "var(--status-error)";
}

function Ring({ score }: { score: number | null }) {
  const bounded = score === null ? 0 : clamp(score, 0, 100);
  const sweep = (bounded / 100) * 251.2;
  const stroke = scoreColor(score);

  return (
    <svg width="66" height="66" viewBox="0 0 66 66" role="img" aria-label="Safety score">
      <circle cx="33" cy="33" r="20" fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
      <circle
        cx="33"
        cy="33"
        r="20"
        fill="none"
        stroke={stroke}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="251.2"
        strokeDashoffset={251.2 - sweep}
        transform="rotate(-90 33 33)"
      />
      <text x="33" y="37" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">
        {score === null ? "--" : Math.round(score)}
      </text>
    </svg>
  );
}

/**
 * Displays safety context for Scout result cards.
 */
export function TrustSignalCard({
  cvsScore,
  confidenceLevel,
  confidenceNumeric,
  verifiedActivityProof,
  verificationStatus,
  riskFlags,
  trustBandLabel,
  requiredReview,
  compact = false,
}: TrustSignalCardProps) {
  const confidencePct = Math.round(clamp((confidenceNumeric ?? 0.65) * 100, 0, 100));
  const flags = Array.isArray(riskFlags) ? riskFlags : [];

  return (
    <section
      className="rounded-lg border p-3"
      style={{
        borderColor: requiredReview ? "var(--status-error)" : "var(--border-subtle)",
        background:
          "linear-gradient(165deg, color-mix(in oklab, var(--surface-card) 96%, transparent), color-mix(in oklab, var(--surface-intermediate) 95%, transparent))",
      }}
    >
      <header className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div
            className="text-[11px] uppercase tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            Safety check
          </div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {trustBandLabel || "Trust snapshot"}
          </div>
        </div>

        {!compact && <Ring score={cvsScore} />}
      </header>

      <div className="rounded-md border px-2 py-2" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Why this match
        </div>
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {verifiedActivityProof}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div
          className="rounded border px-2 py-2"
          style={{
            borderColor: "var(--border-subtle)",
            background: "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)",
          }}
        >
          <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Match quality
          </div>
          <div
            className="text-sm font-semibold"
            style={{ color: confidenceColor(confidenceLevel) }}
          >
            {confidenceLevel.toUpperCase()} ({confidencePct}%)
          </div>
        </div>

        <div
          className="rounded border px-2 py-2"
          style={{
            borderColor: "var(--border-subtle)",
            background: "color-mix(in oklab, var(--surface-intermediate) 92%, transparent)",
          }}
        >
          <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Account check
          </div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {statusLabel(verificationStatus)}
          </div>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Match profile
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
              width: `${confidencePct}%`,
              background: confidenceColor(confidenceLevel),
              transition: "width 180ms ease",
            }}
          />
        </div>
      </div>

      {flags.length > 0 && (
        <div
          className="mt-2 rounded-md border px-2 py-2"
          style={{ borderColor: "var(--status-error)" }}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--status-error)" }}
          >
            Things to review
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {flags.map((flag) => (
              <span
                key={flag}
                className="rounded-full px-2 py-1 text-[11px]"
                style={{
                  color: "var(--text-primary)",
                  background: "color-mix(in oklab, var(--status-error) 18%, var(--surface-card))",
                  border:
                    "1px solid color-mix(in oklab, var(--status-error) 55%, var(--border-subtle))",
                }}
              >
                {flag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {requiredReview && (
        <div className="mt-2 text-xs font-medium" style={{ color: "var(--status-error)" }}>
          Review required before contact or sharing opens.
        </div>
      )}
    </section>
  );
}

export default TrustSignalCard;
