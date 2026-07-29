import { describe, expect, it } from "vitest";
import { computeDirectConnectProviderFitScore } from "../services/directConnectProviderFitScore";

describe("Direct Connect provider fit evidence", () => {
  it("keeps every unmeasured input null and awards no points", () => {
    const result = computeDirectConnectProviderFitScore({});

    expect(result.score).toBe(0);
    expect(result.evidenceCompleteness).toBe(0);
    expect(result.reasons).toEqual([]);
    expect(Object.values(result.breakdown)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(result.unmeasuredFields).toHaveLength(9);
  });

  it("preserves measured false and zero instead of treating them as unknown", () => {
    const result = computeDirectConnectProviderFitScore({
      countyMatch: false,
      tradeMatch: false,
      verificationScore: 0,
      responseRate: 0,
      completionRate: 0,
      recentActivity: 0,
      recommendationTrust: 0,
      disputePenalty: 0,
      overCapacityPenalty: 0,
    });

    expect(result.score).toBe(0);
    expect(result.evidenceCompleteness).toBe(1);
    expect(result.unmeasuredFields).toEqual([]);
  });

  it("scores only the measured fields without normalizing unknowns upward", () => {
    const result = computeDirectConnectProviderFitScore({
      countyMatch: true,
      tradeMatch: true,
    });

    expect(result.score).toBe(50);
    expect(result.breakdown.verificationScore).toBeNull();
    expect(result.evidenceCompleteness).toBe(0.4098);
    expect(result.reasons).toEqual(["County match", "Trade match"]);
  });

  it("clamps measured numeric evidence and rejects non-finite values as unknown", () => {
    const result = computeDirectConnectProviderFitScore({
      verificationScore: 2,
      responseRate: -1,
      completionRate: Number.NaN,
      disputePenalty: Number.POSITIVE_INFINITY,
    });

    expect(result.breakdown.verificationScore).toBe(1);
    expect(result.breakdown.responseRate).toBe(0);
    expect(result.breakdown.completionRate).toBeNull();
    expect(result.breakdown.disputePenalty).toBeNull();
    expect(result.score).toBe(15);
  });
});
