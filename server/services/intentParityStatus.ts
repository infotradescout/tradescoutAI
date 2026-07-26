export type IntentAutomationStatus =
  | "disabled"
  | "collecting_samples"
  | "no_comparable_evidence"
  | "parity_below_target"
  | "ready_for_event_native_cutover";

export type IntentParitySample = {
  timestamp_utc: string;
  scope: {
    source: string;
    stateCode: string;
    county: string;
    window_minutes: number;
  };
  event_native_count: number;
  snapshot_derived_count: number;
  overlap_count: number;
  overlap_ratio: number;
};

export function evaluateIntentParityStatus(
  samples: IntentParitySample[],
  args: {
    lookbackHours: number;
    minSamples: number;
    targetOverlap: number;
    source?: string;
    stateCode?: string;
    county?: string;
    nowMs?: number;
  }
) {
  const source = String(args.source || "").toLowerCase();
  const stateCode = String(args.stateCode || "").toUpperCase();
  const county = String(args.county || "").toLowerCase();
  const cutoffMs = (args.nowMs ?? Date.now()) - args.lookbackHours * 60 * 60 * 1000;

  const scoped = samples.filter((sample) => {
    const ts = new Date(sample.timestamp_utc).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs) return false;
    if (source && sample.scope.source.toLowerCase() !== source) return false;
    if (stateCode && sample.scope.stateCode.toUpperCase() !== stateCode) return false;
    if (county && sample.scope.county.toLowerCase() !== county) return false;
    return true;
  });
  const comparable = scoped.filter(
    (sample) => sample.event_native_count > 0 || sample.snapshot_derived_count > 0
  );

  const sampleCount = scoped.length;
  const comparableSampleCount = comparable.length;
  const overlapAvg =
    comparableSampleCount > 0
      ? Number(
          (
            comparable.reduce((sum, sample) => sum + sample.overlap_ratio, 0) /
            comparableSampleCount
          ).toFixed(3)
        )
      : 0;
  const eventNativeAvg =
    comparableSampleCount > 0
      ? Number(
          (
            comparable.reduce((sum, sample) => sum + sample.event_native_count, 0) /
            comparableSampleCount
          ).toFixed(2)
        )
      : 0;
  const snapshotDerivedAvg =
    comparableSampleCount > 0
      ? Number(
          (
            comparable.reduce((sum, sample) => sum + sample.snapshot_derived_count, 0) /
            comparableSampleCount
          ).toFixed(2)
        )
      : 0;

  let status: IntentAutomationStatus;
  if (sampleCount < args.minSamples) {
    status = "collecting_samples";
  } else if (comparableSampleCount === 0) {
    status = "no_comparable_evidence";
  } else if (comparableSampleCount < args.minSamples) {
    status = "collecting_samples";
  } else if (overlapAvg >= args.targetOverlap) {
    status = "ready_for_event_native_cutover";
  } else {
    status = "parity_below_target";
  }

  return {
    status,
    filters: {
      lookback_hours: args.lookbackHours,
      min_samples: args.minSamples,
      target_overlap: args.targetOverlap,
      source: source || null,
      stateCode: stateCode || null,
      county: county || null,
    },
    summary: {
      sample_count: sampleCount,
      comparable_sample_count: comparableSampleCount,
      overlap_avg: overlapAvg,
      event_native_avg: eventNativeAvg,
      snapshot_derived_avg: snapshotDerivedAvg,
    },
    latest_sample: scoped[scoped.length - 1] || null,
    samples: scoped,
  };
}
