export type VerificationRequirements = {
  requiresLicense?: boolean | null;
  requiresInsurance?: boolean | null;
  requiresEin?: boolean | null;
};

export type VerificationSummary = {
  hasLicense: boolean;
  hasInsurance: boolean;
  hasEin: boolean;
};

export type ServiceAreaReachTier = "local" | "regional" | "wide" | "unknown";

export function normalizeMeasuredCountSignal(
  value: number | string | null | undefined,
  saturationPoint: number
): number | null {
  if (value === null || value === undefined || saturationPoint <= 0) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.max(0, Math.min(1, numeric / saturationPoint));
}

export function normalizeMeasuredRate(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  const unitValue = numeric > 1 && numeric <= 100 ? numeric / 100 : numeric;
  if (unitValue > 1) return null;
  return unitValue;
}

export function computeRequiredVerificationScore(
  requirements: VerificationRequirements | null | undefined,
  summary: VerificationSummary | null | undefined
): number | null {
  if (!requirements || !summary) return null;
  const requiredChecks = [
    requirements.requiresLicense ? summary.hasLicense : null,
    requirements.requiresInsurance ? summary.hasInsurance : null,
    requirements.requiresEin ? summary.hasEin : null,
  ].filter((value): value is boolean => value !== null);
  if (requiredChecks.length === 0) return null;
  return requiredChecks.filter(Boolean).length / requiredChecks.length;
}

export function classifyServiceAreaReach(
  countyCount: number | null | undefined
): ServiceAreaReachTier {
  if (typeof countyCount !== "number" || !Number.isFinite(countyCount) || countyCount < 0) {
    return "unknown";
  }
  if (countyCount <= 1) return "local";
  if (countyCount <= 5) return "regional";
  return "wide";
}
