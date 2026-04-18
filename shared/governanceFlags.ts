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
export const FEATURE_HOLD_TO_EXPLAIN = flagFromEnvWithDefault(
  (env as any).FEATURE_HOLD_TO_EXPLAIN,
  true
);
export const FEATURE_HOLD_INTRO_TUTORIAL = flagFromEnvWithDefault(
  (env as any).FEATURE_HOLD_INTRO_TUTORIAL,
  true
);

// Day 2: Education replacement default on (can be rolled back via env)
export const FEATURE_EDUCATION_REPLACEMENT = flagFromEnvWithDefault(
  (env as any).FEATURE_EDUCATION_REPLACEMENT,
  true
);

// Governance visibility/enforcement
export const FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT = flagFromEnvWithDefault(
  (env as any).FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT,
  false
);

// Day 3 visibility (no blocking)
export const FEATURE_CUSTOMER_IMPACT = flagFromEnvWithDefault(
  (env as any).FEATURE_CUSTOMER_IMPACT,
  true
);
export const FEATURE_RISK_SENTINEL = flagFromEnvWithDefault(
  (env as any).FEATURE_RISK_SENTINEL,
  true
);
export const FEATURE_CHIEF_OF_STAFF = flagFromEnvWithDefault(
  (env as any).FEATURE_CHIEF_OF_STAFF,
  true
);
export const FEATURE_SCOPE_GOVERNOR = flagFromEnvWithDefault(
  (env as any).FEATURE_SCOPE_GOVERNOR,
  true
);

// Day 7 enforcement (remains off)
export const FEATURE_SCOPE_GOVERNOR_ENFORCED = flagFromEnvWithDefault(
  (env as any).FEATURE_SCOPE_GOVERNOR_ENFORCED,
  false
);

// Progressive exposure rollout starts in shadow mode (observe only, no UX gating).
export const FEATURE_PROGRESSIVE_EXPOSURE_SHADOW = flagFromEnvWithDefault(
  (env as any).FEATURE_PROGRESSIVE_EXPOSURE_SHADOW,
  true
);

// Progressive exposure Phase A: keep 4 core nav features always visible and
// unlock advanced destinations only after action-based triggers.
export const FEATURE_PROGRESSIVE_EXPOSURE_CORE_NAV_GATING = flagFromEnvWithDefault(
  (env as any).FEATURE_PROGRESSIVE_EXPOSURE_CORE_NAV_GATING,
  true
);

export function describeGovernanceFlags() {
  return {
    FEATURE_HOLD_TO_EXPLAIN,
    FEATURE_HOLD_INTRO_TUTORIAL,
    FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT,
    FEATURE_EDUCATION_REPLACEMENT,
    FEATURE_SCOPE_GOVERNOR,
    FEATURE_SCOPE_GOVERNOR_ENFORCED,
    FEATURE_PROGRESSIVE_EXPOSURE_SHADOW,
    FEATURE_PROGRESSIVE_EXPOSURE_CORE_NAV_GATING,
    FEATURE_CUSTOMER_IMPACT,
    FEATURE_RISK_SENTINEL,
    FEATURE_CHIEF_OF_STAFF,
  } as const;
}
