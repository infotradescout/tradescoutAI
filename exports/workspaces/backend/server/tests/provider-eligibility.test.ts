import { describe, expect, it } from "vitest";
import {
  buildComputedProviderEligibilities,
  getEligibilityDecisionForCounty,
} from "../providerEligibility";

describe("provider eligibility model", () => {
  it("treats verified state licenses as statewide legal envelope", () => {
    const computed = buildComputedProviderEligibilities({
      explicitEligibilities: [],
      inferredStateCodes: ["TX"],
    });

    const allowed = getEligibilityDecisionForCounty(computed, {
      fips: "48453",
      stateCode: "TX",
    });
    const blocked = getEligibilityDecisionForCounty(computed, {
      fips: "06037",
      stateCode: "CA",
    });

    expect(allowed.eligible).toBe(true);
    expect(allowed.matched[0]?.eligibilityBasis).toBe("state_license");
    expect(blocked.eligible).toBe(false);
  });

  it("allows county-licensed and verified-exception providers only in approved counties", () => {
    const computed = buildComputedProviderEligibilities({
      explicitEligibilities: [
        {
          jurisdictionType: "county",
          eligibilityBasis: "county_license",
          verificationStatus: "approved",
          countyFips: "12086",
          stateCode: "FL",
          isActive: true,
        },
        {
          jurisdictionType: "county",
          eligibilityBasis: "verified_exception",
          verificationStatus: "approved",
          countyFips: "12011",
          stateCode: "FL",
          isActive: true,
        },
      ],
    });

    expect(
      getEligibilityDecisionForCounty(computed, { fips: "12086", stateCode: "FL" }).eligible
    ).toBe(true);
    expect(
      getEligibilityDecisionForCounty(computed, { fips: "12011", stateCode: "FL" }).eligible
    ).toBe(true);
    expect(
      getEligibilityDecisionForCounty(computed, { fips: "12099", stateCode: "FL" }).eligible
    ).toBe(false);
  });

  it("ignores expired, inactive, and non-approved eligibility records", () => {
    const computed = buildComputedProviderEligibilities({
      explicitEligibilities: [
        {
          jurisdictionType: "county",
          eligibilityBasis: "verified_exception",
          verificationStatus: "approved",
          countyFips: "06037",
          stateCode: "CA",
          expiresAt: new Date("2020-01-01T00:00:00.000Z"),
          isActive: true,
        },
        {
          jurisdictionType: "county",
          eligibilityBasis: "county_license",
          verificationStatus: "pending",
          countyFips: "06059",
          stateCode: "CA",
          isActive: true,
        },
        {
          jurisdictionType: "state",
          eligibilityBasis: "state_license",
          verificationStatus: "approved",
          stateCode: "CA",
          isActive: false,
        },
      ],
      now: new Date("2026-03-07T00:00:00.000Z"),
    });

    expect(computed).toHaveLength(0);
  });
});
