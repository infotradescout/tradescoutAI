import { describe, expect, it } from "vitest";
import {
  classifyServiceAreaReach,
  computeRequiredVerificationScore,
  normalizeMeasuredCountSignal,
  normalizeMeasuredRate,
} from "../services/directConnectMeasuredEvidence";

describe("Direct Connect measured evidence helpers", () => {
  it("does not manufacture count or rate evidence", () => {
    expect(normalizeMeasuredCountSignal(undefined, 25)).toBeNull();
    expect(normalizeMeasuredCountSignal(-1, 25)).toBeNull();
    expect(normalizeMeasuredRate(undefined)).toBeNull();
    expect(normalizeMeasuredRate(140)).toBeNull();
  });

  it("normalizes measured counts and decimal or percentage rates", () => {
    expect(normalizeMeasuredCountSignal(5, 25)).toBe(0.2);
    expect(normalizeMeasuredCountSignal(50, 25)).toBe(1);
    expect(normalizeMeasuredRate("82.5")).toBe(0.825);
    expect(normalizeMeasuredRate(0.6)).toBe(0.6);
  });

  it("scores only explicitly required verification evidence", () => {
    const summary = { hasLicense: true, hasInsurance: false, hasEin: true };
    expect(
      computeRequiredVerificationScore(
        { requiresLicense: true, requiresInsurance: true, requiresEin: false },
        summary
      )
    ).toBe(0.5);
    expect(computeRequiredVerificationScore({}, summary)).toBeNull();
    expect(computeRequiredVerificationScore({ requiresLicense: true }, null)).toBeNull();
  });

  it("keeps missing service-area breadth unknown", () => {
    expect(classifyServiceAreaReach(undefined)).toBe("unknown");
    expect(classifyServiceAreaReach(1)).toBe("local");
    expect(classifyServiceAreaReach(4)).toBe("regional");
    expect(classifyServiceAreaReach(8)).toBe("wide");
  });
});
