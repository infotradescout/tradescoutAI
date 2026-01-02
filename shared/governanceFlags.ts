// Governance feature gates (ships dark by default)
// These flags must be explicitly enabled (e.g., env var = "true" or code flip) by the founder.
// Defaults stay false to preserve current behavior.

const env = typeof process !== "undefined" ? process.env : {};
const flagFromEnv = (value: string | undefined): boolean => value === "true";

export const FEATURE_HOLD_TO_EXPLAIN = flagFromEnv((env as any).FEATURE_HOLD_TO_EXPLAIN);
export const FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT = flagFromEnv((env as any).FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT);
export const FEATURE_EDUCATION_REPLACEMENT = flagFromEnv((env as any).FEATURE_EDUCATION_REPLACEMENT);
export const FEATURE_SCOPE_GOVERNOR = flagFromEnv((env as any).FEATURE_SCOPE_GOVERNOR);
export const FEATURE_CUSTOMER_IMPACT = flagFromEnv((env as any).FEATURE_CUSTOMER_IMPACT);
export const FEATURE_RISK_SENTINEL = flagFromEnv((env as any).FEATURE_RISK_SENTINEL);
export const FEATURE_CHIEF_OF_STAFF = flagFromEnv((env as any).FEATURE_CHIEF_OF_STAFF);

export function describeGovernanceFlags() {
  return {
    FEATURE_HOLD_TO_EXPLAIN,
    FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT,
    FEATURE_EDUCATION_REPLACEMENT,
    FEATURE_SCOPE_GOVERNOR,
    FEATURE_CUSTOMER_IMPACT,
    FEATURE_RISK_SENTINEL,
    FEATURE_CHIEF_OF_STAFF,
  } as const;
}
