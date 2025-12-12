import { describe, expect, it } from "vitest";
import { shouldInjectSponsored } from "../services/sponsoredEligibility";

describe("sponsoredEligibility", () => {
  it("never injects sponsored on the first Scout answer (historyLength 0)", () => {
    expect(
      shouldInjectSponsored({
        userId: "u1",
        historyLength: 0,
        rolesLength: 1,
        countyCode: "06037",
        stateCode: "CA",
        shownAdIdsLength: 0,
      })
    ).toBe(false);
  });

  it("never injects sponsored on the first Scout answer (historyLength 1)", () => {
    expect(
      shouldInjectSponsored({
        userId: "u1",
        historyLength: 1,
        rolesLength: 1,
        countyCode: "06037",
        stateCode: "CA",
        shownAdIdsLength: 0,
      })
    ).toBe(false);
  });

  it("never injects sponsored on likely guest first-run onboarding", () => {
    expect(
      shouldInjectSponsored({
        userId: undefined,
        historyLength: 0,
        rolesLength: 0,
        countyCode: undefined,
        stateCode: undefined,
        shownAdIdsLength: 0,
      })
    ).toBe(false);
  });

  it("enforces max impressions/session via shownAdIdsLength", () => {
    expect(
      shouldInjectSponsored({
        userId: "u1",
        historyLength: 3,
        rolesLength: 1,
        countyCode: "06037",
        stateCode: "CA",
        shownAdIdsLength: 2,
      })
    ).toBe(false);
  });

  it("allows injection for normal requests under cap", () => {
    expect(
      shouldInjectSponsored({
        userId: "u1",
        historyLength: 2,
        rolesLength: 1,
        countyCode: "06037",
        stateCode: "CA",
        shownAdIdsLength: 0,
      })
    ).toBe(true);
  });
});
