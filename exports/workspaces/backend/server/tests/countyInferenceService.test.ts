import { describe, expect, it } from "vitest";
import {
  clearCountyInferenceCache,
  inferCountyFromCityState,
} from "../services/countyInferenceService";

function buildResponse(payload: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  } as any;
}

describe("countyInferenceService", () => {
  it("infers county when a single candidate is returned", async () => {
    clearCountyInferenceCache();
    const fetchMock = async () =>
      buildResponse({
        result: {
          addressMatches: [
            {
              matchedAddress: "Houston, TX",
              addressComponents: { city: "Houston" },
              geographies: { Counties: [{ GEOID: "48201", NAME: "Harris County" }] },
            },
          ],
        },
      });

    const result = await inferCountyFromCityState(
      { city: "Houston", stateCode: "tx" },
      fetchMock as any
    );

    expect(result.inferred?.countyFips).toBe("48201");
    expect(result.candidates).toHaveLength(1);
    expect(result.ambiguous).toBe(false);
    expect(result.confidence).toBe("high");
  });

  it("marks ambiguous when multiple counties match city/state", async () => {
    clearCountyInferenceCache();
    const fetchMock = async () =>
      buildResponse({
        result: {
          addressMatches: [
            {
              matchedAddress: "Springfield, MO",
              addressComponents: { city: "Springfield" },
              geographies: { Counties: [{ GEOID: "29077", NAME: "Greene County" }] },
            },
            {
              matchedAddress: "Springfield, MO",
              addressComponents: { city: "Springfield" },
              geographies: { Counties: [{ GEOID: "29167", NAME: "Polk County" }] },
            },
          ],
        },
      });

    const result = await inferCountyFromCityState(
      { city: "Springfield", stateCode: "MO" },
      fetchMock as any
    );

    expect(result.inferred).toBeNull();
    expect(result.ambiguous).toBe(true);
    expect(result.candidates).toHaveLength(2);
  });

  it("uses cache for repeated lookups", async () => {
    clearCountyInferenceCache();
    let calls = 0;
    const fetchMock = async () => {
      calls += 1;
      return buildResponse({
        result: {
          addressMatches: [
            {
              matchedAddress: "Austin, TX",
              addressComponents: { city: "Austin" },
              geographies: { Counties: [{ GEOID: "48453", NAME: "Travis County" }] },
            },
          ],
        },
      });
    };

    const first = await inferCountyFromCityState(
      { city: "Austin", stateCode: "TX" },
      fetchMock as any
    );
    const second = await inferCountyFromCityState(
      { city: "Austin", stateCode: "TX" },
      fetchMock as any
    );

    expect(first.inferred?.countyFips).toBe("48453");
    expect(second.cached).toBe(true);
    expect(calls).toBe(1);
  });
});
