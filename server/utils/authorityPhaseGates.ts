import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { featureFlags, siteSettings } from "../../shared/schema";
import { parseTruthyToggle } from "./authorityConfig";

export const OBSERVATION_MODE_KEY = "observation_mode_enabled";
export const PHASE_2B_ENABLED_KEY = "phase_2b_enabled";
export const PHASE_2C_ENABLED_KEY = "phase_2c_enabled";
export const PHASE_2B_FEATURE_FLAG_KEY = "phase_2b_authority_labels";
export const PHASE_2C_FEATURE_FLAG_KEY = "phase_2c_outcome_weighting";

const CACHE_TTL_MS = 15_000;

export interface AuthorityPhaseGateState {
  evaluatedAt: string;
  observationModeEnabled: boolean;
  phase2bRequested: boolean;
  phase2cRequested: boolean;
  phase2bAuthorityLabelsEnabled: boolean;
  phase2cOutcomeWeightingEnabled: boolean;
  phase2bBlockedReason: string | null;
  phase2cBlockedReason: string | null;
}

export interface AuthorityPhaseGateInputs {
  observationModeSetting?: unknown;
  phase2bSetting?: unknown;
  phase2cSetting?: unknown;
  phase2bFeatureFlagEnabled?: boolean;
  phase2cFeatureFlagEnabled?: boolean;
  envEnableAuthorityLabels?: unknown;
  envEnableOutcomeWeighting?: unknown;
}

type AuthorityPhase = "phase2b" | "phase2c";

let cachedState: AuthorityPhaseGateState | null = null;
let cachedAtMs = 0;

function cloneState(state: AuthorityPhaseGateState): AuthorityPhaseGateState {
  return {
    ...state,
    evaluatedAt: state.evaluatedAt,
  };
}

function parseOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string" && value.trim().length > 0) {
    return parseTruthyToggle(value);
  }
  if (value && typeof value === "object") {
    if ("enabled" in (value as Record<string, unknown>)) {
      return parseOptionalBoolean((value as Record<string, unknown>).enabled);
    }
    if ("value" in (value as Record<string, unknown>)) {
      return parseOptionalBoolean((value as Record<string, unknown>).value);
    }
  }
  return null;
}

export function deriveAuthorityPhaseGateState(
  inputs: AuthorityPhaseGateInputs
): AuthorityPhaseGateState {
  const observationSetting = parseOptionalBoolean(inputs.observationModeSetting);
  const observationModeEnabled = observationSetting !== false;

  const envPhase2b = parseTruthyToggle(inputs.envEnableAuthorityLabels);
  const envPhase2c = parseTruthyToggle(inputs.envEnableOutcomeWeighting);

  const settingPhase2b = parseOptionalBoolean(inputs.phase2bSetting) === true;
  const settingPhase2c = parseOptionalBoolean(inputs.phase2cSetting) === true;
  const featurePhase2b = inputs.phase2bFeatureFlagEnabled === true;
  const featurePhase2c = inputs.phase2cFeatureFlagEnabled === true;

  const phase2bRequested = envPhase2b || settingPhase2b || featurePhase2b;
  const phase2cRequested = envPhase2c || settingPhase2c || featurePhase2c;

  const phase2bAuthorityLabelsEnabled = !observationModeEnabled && phase2bRequested;
  const phase2cOutcomeWeightingEnabled =
    !observationModeEnabled && phase2bAuthorityLabelsEnabled && phase2cRequested;

  let phase2bBlockedReason: string | null = null;
  if (observationModeEnabled) {
    phase2bBlockedReason = "Observation mode lock is enabled";
  } else if (!phase2bRequested) {
    phase2bBlockedReason = "Phase 2B is not toggled on";
  }

  let phase2cBlockedReason: string | null = null;
  if (observationModeEnabled) {
    phase2cBlockedReason = "Observation mode lock is enabled";
  } else if (!phase2bAuthorityLabelsEnabled) {
    phase2cBlockedReason = "Phase 2B must be enabled first";
  } else if (!phase2cRequested) {
    phase2cBlockedReason = "Phase 2C is not toggled on";
  }

  return {
    evaluatedAt: new Date().toISOString(),
    observationModeEnabled,
    phase2bRequested,
    phase2cRequested,
    phase2bAuthorityLabelsEnabled,
    phase2cOutcomeWeightingEnabled,
    phase2bBlockedReason,
    phase2cBlockedReason,
  };
}

export function invalidateAuthorityPhaseGateCache(): void {
  cachedState = null;
  cachedAtMs = 0;
}

async function loadAuthorityPhaseGateInputsFromDb(): Promise<AuthorityPhaseGateInputs> {
  const [settingsResult, flagsResult] = await Promise.allSettled([
    db
      .select({
        key: siteSettings.key,
        value: siteSettings.value,
      })
      .from(siteSettings)
      .where(
        inArray(siteSettings.key, [
          OBSERVATION_MODE_KEY,
          PHASE_2B_ENABLED_KEY,
          PHASE_2C_ENABLED_KEY,
        ])
      ),
    db
      .select({
        key: featureFlags.key,
        enabled: featureFlags.enabled,
      })
      .from(featureFlags)
      .where(
        and(
          inArray(featureFlags.key, [PHASE_2B_FEATURE_FLAG_KEY, PHASE_2C_FEATURE_FLAG_KEY]),
          eq(featureFlags.enabled, true)
        )
      ),
  ]);

  const settings = settingsResult.status === "fulfilled" ? settingsResult.value : [];
  const flags = flagsResult.status === "fulfilled" ? flagsResult.value : [];

  if (settingsResult.status === "rejected") {
    console.error(
      "[AuthorityPhaseGates] failed to read site settings; using safe defaults",
      settingsResult.reason
    );
  }
  if (flagsResult.status === "rejected") {
    console.error(
      "[AuthorityPhaseGates] failed to read feature flags; using safe defaults",
      flagsResult.reason
    );
  }

  const settingsByKey = new Map<string, unknown>();
  for (const setting of settings || []) {
    settingsByKey.set(String(setting.key), setting.value);
  }

  const enabledFlagSet = new Set((flags || []).map((flag) => String(flag.key)));

  return {
    observationModeSetting: settingsByKey.get(OBSERVATION_MODE_KEY),
    phase2bSetting: settingsByKey.get(PHASE_2B_ENABLED_KEY),
    phase2cSetting: settingsByKey.get(PHASE_2C_ENABLED_KEY),
    phase2bFeatureFlagEnabled: enabledFlagSet.has(PHASE_2B_FEATURE_FLAG_KEY),
    phase2cFeatureFlagEnabled: enabledFlagSet.has(PHASE_2C_FEATURE_FLAG_KEY),
    envEnableAuthorityLabels: process.env.ENABLE_AUTHORITY_LABELS,
    envEnableOutcomeWeighting: process.env.ENABLE_OUTCOME_WEIGHTING,
  };
}

export async function getAuthorityPhaseGateState(options?: {
  forceRefresh?: boolean;
}): Promise<AuthorityPhaseGateState> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && cachedState && Date.now() - cachedAtMs < CACHE_TTL_MS) {
    return cloneState(cachedState);
  }

  const inputs = await loadAuthorityPhaseGateInputsFromDb();
  const derived = deriveAuthorityPhaseGateState(inputs);
  cachedState = derived;
  cachedAtMs = Date.now();
  return cloneState(derived);
}

export async function setAuthorityPhaseToggle(
  phase: AuthorityPhase,
  enabled: boolean
): Promise<void> {
  const key = phase === "phase2b" ? PHASE_2B_ENABLED_KEY : PHASE_2C_ENABLED_KEY;
  await db
    .insert(siteSettings)
    .values({
      id: randomUUID(),
      category: "authority_unlock",
      key,
      value: enabled,
      description:
        phase === "phase2b"
          ? "Phase 2B activation toggle (authority labels)"
          : "Phase 2C activation toggle (outcome weighting)",
      isActive: true,
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: enabled,
        updatedAt: new Date(),
      },
    });

  invalidateAuthorityPhaseGateCache();
}
