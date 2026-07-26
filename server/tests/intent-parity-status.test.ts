import { describe, expect, it } from "vitest";
import {
  evaluateIntentParityStatus,
  type IntentParitySample,
} from "../services/intentParityStatus";

const NOW = Date.parse("2026-07-25T12:00:00.000Z");

function sample(
  offsetMinutes: number,
  eventNativeCount: number,
  snapshotDerivedCount: number,
  overlapRatio: number
): IntentParitySample {
  return {
    timestamp_utc: new Date(NOW - offsetMinutes * 60_000).toISOString(),
    scope: { source: "", stateCode: "", county: "", window_minutes: 60 },
    event_native_count: eventNativeCount,
    snapshot_derived_count: snapshotDerivedCount,
    overlap_count: overlapRatio > 0 ? 1 : 0,
    overlap_ratio: overlapRatio,
  };
}

describe("intent parity status", () => {
  it("does not call repeated zero-versus-zero samples a parity failure or readiness proof", () => {
    const samples = Array.from({ length: 12 }, (_, index) => sample(index, 0, 0, 0));
    const result = evaluateIntentParityStatus(samples, {
      lookbackHours: 24,
      minSamples: 12,
      targetOverlap: 0.8,
      nowMs: NOW,
    });

    expect(result.status).toBe("no_comparable_evidence");
    expect(result.summary).toMatchObject({
      sample_count: 12,
      comparable_sample_count: 0,
      event_native_avg: 0,
      snapshot_derived_avg: 0,
    });
  });

  it("requires the minimum number of comparable samples before readiness", () => {
    const samples = Array.from({ length: 11 }, (_, index) => sample(index, 2, 2, 1));
    const result = evaluateIntentParityStatus(samples, {
      lookbackHours: 24,
      minSamples: 12,
      targetOverlap: 0.8,
      nowMs: NOW,
    });
    expect(result.status).toBe("collecting_samples");
  });

  it("reports readiness only from enough non-empty comparison evidence", () => {
    const samples = Array.from({ length: 12 }, (_, index) => sample(index, 2, 2, 1));
    const result = evaluateIntentParityStatus(samples, {
      lookbackHours: 24,
      minSamples: 12,
      targetOverlap: 0.8,
      nowMs: NOW,
    });
    expect(result.status).toBe("ready_for_event_native_cutover");
    expect(result.summary.comparable_sample_count).toBe(12);
  });
});
