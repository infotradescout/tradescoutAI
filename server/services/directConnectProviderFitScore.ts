export type ProviderFitInputs = {
  countyMatch: boolean;
  tradeMatch: boolean;
  verificationScore: number;
  responseRate: number;
  completionRate: number;
  recentActivity: number;
  recommendationTrust: number;
  disputePenalty: number;
  overCapacityPenalty: number;
};

export type ProviderFitScoreResult = {
  score: number;
  breakdown: ProviderFitInputs;
  reasons: string[];
};

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function computeDirectConnectProviderFitScore(
  input: Partial<ProviderFitInputs>
): ProviderFitScoreResult {
  const breakdown: ProviderFitInputs = {
    countyMatch: Boolean(input.countyMatch),
    tradeMatch: Boolean(input.tradeMatch),
    verificationScore: clampUnit(input.verificationScore ?? 0.6),
    responseRate: clampUnit(input.responseRate ?? 0.5),
    completionRate: clampUnit(input.completionRate ?? 0.5),
    recentActivity: clampUnit(input.recentActivity ?? 0.5),
    recommendationTrust: clampUnit(input.recommendationTrust ?? 0.5),
    disputePenalty: clampUnit(input.disputePenalty ?? 0),
    overCapacityPenalty: clampUnit(input.overCapacityPenalty ?? 0),
  };

  const scoreRaw =
    (breakdown.countyMatch ? 1 : 0) * 30 +
    (breakdown.tradeMatch ? 1 : 0) * 20 +
    breakdown.verificationScore * 15 +
    breakdown.responseRate * 10 +
    breakdown.completionRate * 10 +
    breakdown.recentActivity * 8 +
    breakdown.recommendationTrust * 7 -
    breakdown.disputePenalty * 12 -
    breakdown.overCapacityPenalty * 10;

  const score = Math.max(0, Math.min(100, Number(scoreRaw.toFixed(2))));
  const reasons: string[] = [];
  if (breakdown.countyMatch) reasons.push("County match");
  if (breakdown.tradeMatch) reasons.push("Trade match");
  if (breakdown.verificationScore >= 0.75) reasons.push("Strong verification profile");
  if (breakdown.responseRate >= 0.65) reasons.push("Reliable response behavior");
  if (breakdown.completionRate >= 0.65) reasons.push("Good completion history");
  if (breakdown.recommendationTrust >= 0.65) reasons.push("Trusted recommendation signal");
  if (breakdown.disputePenalty > 0.2) reasons.push("Dispute risk penalty");
  if (breakdown.overCapacityPenalty > 0.2) reasons.push("Capacity pressure penalty");

  return { score, breakdown, reasons };
}
