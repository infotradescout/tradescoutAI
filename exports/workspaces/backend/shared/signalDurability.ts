export type SignalDurabilityClass = "volatile" | "stable" | "persistent";
export type SignalTruthState = "current" | "stale";

function toTimestampMs(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function minutesSinceTimestamp(value: string | Date | null | undefined): number | null {
  const ts = toTimestampMs(value);
  if (ts === null) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

export function resolveSignalDurability(sourceKind: string): SignalDurabilityClass {
  const key = String(sourceKind || "").trim().toLowerCase();
  if (
    key === "scout_interactions" ||
    key === "objectives" ||
    key === "bot_visibility" ||
    key === "bot_crawl_signals" ||
    key === "alert" ||
    key === "truth_now"
  ) {
    return "volatile";
  }
  if (
    key === "observations" ||
    key === "homescout_listings" ||
    key === "data_production" ||
    key === "llm_optimization" ||
    key === "crawler_volume" ||
    key === "crawler_top_bot" ||
    key === "finding"
  ) {
    return "stable";
  }
  return "persistent";
}

export function defaultMaxAgeMinutesForDurability(
  durability: SignalDurabilityClass
): number {
  if (durability === "volatile") return 180;
  if (durability === "stable") return 720;
  return Number.MAX_SAFE_INTEGER;
}

export function resolveMaxAgeMinutesForSignal(params: {
  sourceKind: string;
  sourceOverrides?: Record<string, number>;
  durabilityOverrides?: Partial<Record<SignalDurabilityClass, number>>;
}): number {
  const sourceKind = String(params.sourceKind || "").trim();
  const sourceOverride = params.sourceOverrides?.[sourceKind];
  if (typeof sourceOverride === "number" && Number.isFinite(sourceOverride) && sourceOverride > 0) {
    return sourceOverride;
  }
  const durability = resolveSignalDurability(sourceKind);
  const durabilityOverride = params.durabilityOverrides?.[durability];
  if (
    typeof durabilityOverride === "number" &&
    Number.isFinite(durabilityOverride) &&
    durabilityOverride > 0
  ) {
    return durabilityOverride;
  }
  return defaultMaxAgeMinutesForDurability(durability);
}

export function computeSignalTruthState(params: {
  observedAt: string | Date | null | undefined;
  sourceKind: string;
  sourceOverrides?: Record<string, number>;
  durabilityOverrides?: Partial<Record<SignalDurabilityClass, number>>;
}): SignalTruthState {
  const age = minutesSinceTimestamp(params.observedAt);
  if (age === null) return "stale";
  const maxAge = resolveMaxAgeMinutesForSignal({
    sourceKind: params.sourceKind,
    sourceOverrides: params.sourceOverrides,
    durabilityOverrides: params.durabilityOverrides,
  });
  return age <= maxAge ? "current" : "stale";
}

