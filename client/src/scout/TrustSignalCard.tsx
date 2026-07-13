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

/**
 * Displays safety context for Scout result cards.
 */
export function TrustSignalCard({
  confidenceLevel,
  verifiedActivityProof,
  verificationStatus,
  riskFlags,
  trustBandLabel,
  requiredReview,
  compact = false,
}: TrustSignalCardProps) {
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

        {!compact && (
          <div
            className="rounded-full border px-3 py-1 text-xs"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            Evidence checked
          </div>
        )}
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
            {confidenceLevel === "high"
              ? "Strong"
              : confidenceLevel === "medium"
                ? "Review"
                : "Limited"}
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
