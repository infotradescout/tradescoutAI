export type ProviderFitInputs = {
  countyMatch: boolean | null;
  tradeMatch: boolean | null;
  verificationScore: number | null;
  responseRate: number | null;
  completionRate: number | null;
  recentActivity: number | null;
  recommendationTrust: number | null;
  disputePenalty: number | null;
  overCapacityPenalty: number | null;
};

export type ProviderFitScoreResult = {
  score: number;
  breakdown: ProviderFitInputs;
  reasons: string[];
  unmeasuredFields: Array<keyof ProviderFitInputs>;
  evidenceCompleteness: number;
};

const FIT_WEIGHTS: Record<keyof ProviderFitInputs, number> = {
  countyMatch: 30,
  tradeMatch: 20,
  verificationScore: 15,
  responseRate: 10,
  completionRate: 10,
  recentActivity: 8,
  recommendationTrust: 7,
  disputePenalty: 12,
  overCapacityPenalty: 10,
};

function clampUnit(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function measuredBoolean(value: boolean | null | undefined): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function computeDirectConnectProviderFitScore(
  input: Partial<ProviderFitInputs>
): ProviderFitScoreResult {
  const breakdown: ProviderFitInputs = {
    countyMatch: measuredBoolean(input.countyMatch),
    tradeMatch: measuredBoolean(input.tradeMatch),
    verificationScore: clampUnit(input.verificationScore),
    responseRate: clampUnit(input.responseRate),
    completionRate: clampUnit(input.completionRate),
    recentActivity: clampUnit(input.recentActivity),
    recommendationTrust: clampUnit(input.recommendationTrust),
    disputePenalty: clampUnit(input.disputePenalty),
    overCapacityPenalty: clampUnit(input.overCapacityPenalty),
  };

  const scoreRaw =
    (breakdown.countyMatch ? 1 : 0) * 30 +
    (breakdown.tradeMatch ? 1 : 0) * 20 +
    (breakdown.verificationScore ?? 0) * 15 +
    (breakdown.responseRate ?? 0) * 10 +
    (breakdown.completionRate ?? 0) * 10 +
    (breakdown.recentActivity ?? 0) * 8 +
    (breakdown.recommendationTrust ?? 0) * 7 -
    (breakdown.disputePenalty ?? 0) * 12 -
    (breakdown.overCapacityPenalty ?? 0) * 10;

  const score = Math.max(0, Math.min(100, Number(scoreRaw.toFixed(2))));
  const reasons: string[] = [];
  if (breakdown.countyMatch) reasons.push("County match");
  if (breakdown.tradeMatch) reasons.push("Trade match");
  if (breakdown.verificationScore !== null && breakdown.verificationScore >= 0.75) {
    reasons.push("Strong verification profile");
  }
  if (breakdown.responseRate !== null && breakdown.responseRate >= 0.65) {
    reasons.push("Reliable response behavior");
  }
  if (breakdown.completionRate !== null && breakdown.completionRate >= 0.65) {
    reasons.push("Good completion history");
  }
  if (breakdown.recommendationTrust !== null && breakdown.recommendationTrust >= 0.65) {
    reasons.push("Trusted recommendation signal");
  }
  if (breakdown.disputePenalty !== null && breakdown.disputePenalty > 0.2) {
    reasons.push("Dispute risk penalty");
  }
  if (breakdown.overCapacityPenalty !== null && breakdown.overCapacityPenalty > 0.2) {
    reasons.push("Capacity pressure penalty");
  }

  const unmeasuredFields = (Object.keys(breakdown) as Array<keyof ProviderFitInputs>).filter(
    (field) => breakdown[field] === null
  );
  const totalWeight = Object.values(FIT_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const measuredWeight = (Object.keys(breakdown) as Array<keyof ProviderFitInputs>)
    .filter((field) => breakdown[field] !== null)
    .reduce((sum, field) => sum + FIT_WEIGHTS[field], 0);
  const evidenceCompleteness = Number((measuredWeight / totalWeight).toFixed(4));

  return { score, breakdown, reasons, unmeasuredFields, evidenceCompleteness };
}
