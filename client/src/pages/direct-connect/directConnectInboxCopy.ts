export function getDirectConnectInboxStatusLabel(status: string | null | undefined): string {
  const value = String(status || "suggested").toLowerCase();
  switch (value) {
    case "suggested":
      return "New opportunity";
    case "invited":
      return "Invited";
    case "saved":
      return "Saved opportunity";
    case "accepted":
    case "in_progress":
      return "Connected";
    case "declined":
    case "cancelled":
      return "Dismissed";
    case "expired":
      return "Closed";
    default:
      return "Review";
  }
}

export function formatDirectConnectInboxTime(
  timestamp: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) return "Updated today";
  if (dayDiff === 1) return "Updated yesterday";

  return `Updated ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })}`;
}

export function getDirectConnectInboxMatchStrength(
  score: number | null | undefined
): string | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (score >= 80) return "Strong local fit";
  if (score >= 50) return "Worth reviewing";
  return "Needs review";
}

export function formatDirectConnectInboxLocalContext(
  distanceMiles: number | null | undefined
): string | null {
  if (typeof distanceMiles !== "number" || !Number.isFinite(distanceMiles)) return null;
  if (distanceMiles <= 5) return "Nearby local reply";
  if (distanceMiles <= 25) return "Within your local area";
  return "Area reply";
}

export function buildDirectConnectInboxDisplay(params: {
  status?: string | null;
  timestamp?: string | null;
  scoreSnapshot?: {
    score?: number;
    reasons?: string[];
    distanceMiles?: number;
    tradeMatch?: boolean;
    recommendationCount?: number;
    responseRate?: number;
  } | null;
  now?: Date;
}) {
  const snapshot = params.scoreSnapshot || undefined;
  const matchStrength = getDirectConnectInboxMatchStrength(snapshot?.score);
  const localContext = formatDirectConnectInboxLocalContext(snapshot?.distanceMiles);
  const reasons = Array.isArray(snapshot?.reasons) ? snapshot.reasons.filter(Boolean) : [];
  const detailRows = [
    matchStrength,
    localContext,
    snapshot?.tradeMatch ? "Trade experience appears relevant" : null,
    typeof snapshot?.recommendationCount === "number" && snapshot.recommendationCount > 0
      ? "Has local recommendations"
      : null,
    ...reasons.slice(0, 2).map((reason) => `Context: ${reason}`),
  ].filter((row): row is string => Boolean(row));

  return {
    statusLabel: getDirectConnectInboxStatusLabel(params.status),
    timeLabel: formatDirectConnectInboxTime(params.timestamp, params.now),
    localContext,
    detailsLabel: "Match details",
    detailsHeading: "Local context",
    detailRows,
  };
}
