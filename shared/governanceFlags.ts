// Governance feature gates (ships dark by default)
// These flags must be explicitly enabled (e.g., env var = "true" or code flip) by the founder.
// Defaults stay false to preserve current behavior.

const env = typeof process !== "undefined" ? process.env : {};

// Env-aware flag helper with default and explicit false override support.
const flagFromEnvWithDefault = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
};

// Day 1 defaults (can be rolled back via env = "false")
export const FEATURE_HOLD_TO_EXPLAIN = flagFromEnvWithDefault((env as any).FEATURE_HOLD_TO_EXPLAIN, true);
export const FEATURE_HOLD_INTRO_TUTORIAL = flagFromEnvWithDefault((env as any).FEATURE_HOLD_INTRO_TUTORIAL, true);

// Day 2: Education replacement default on (can be rolled back via env)
export const FEATURE_EDUCATION_REPLACEMENT = flagFromEnvWithDefault((env as any).FEATURE_EDUCATION_REPLACEMENT, true);

// Governance visibility/enforcement (remain dark by default unless flipped)
export const FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT = flagFromEnvWithDefault((env as any).FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT, false);
export const FEATURE_SCOPE_GOVERNOR = flagFromEnvWithDefault((env as any).FEATURE_SCOPE_GOVERNOR, false);
export const FEATURE_SCOPE_GOVERNOR_ENFORCED = flagFromEnvWithDefault((env as any).FEATURE_SCOPE_GOVERNOR_ENFORCED, false);
export const FEATURE_CUSTOMER_IMPACT = flagFromEnvWithDefault((env as any).FEATURE_CUSTOMER_IMPACT, false);
export const FEATURE_RISK_SENTINEL = flagFromEnvWithDefault((env as any).FEATURE_RISK_SENTINEL, false);
export const FEATURE_CHIEF_OF_STAFF = flagFromEnvWithDefault((env as any).FEATURE_CHIEF_OF_STAFF, false);

export function describeGovernanceFlags() {
  return {
    FEATURE_HOLD_TO_EXPLAIN,
    FEATURE_HOLD_INTRO_TUTORIAL,
    FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT,
    FEATURE_EDUCATION_REPLACEMENT,
    FEATURE_SCOPE_GOVERNOR,
    FEATURE_SCOPE_GOVERNOR_ENFORCED,
    FEATURE_CUSTOMER_IMPACT,
    FEATURE_RISK_SENTINEL,
    FEATURE_CHIEF_OF_STAFF,
  } as const;
}
