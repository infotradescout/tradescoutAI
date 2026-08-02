import { describe, expect, it } from "vitest";

import { parseProviderSearchScope } from "../services/providerSearchScope";

describe("parseProviderSearchScope", () => {
  it("normalizes a state-only scope", () => {
    expect(parseProviderSearchScope({ county: undefined, state: " fl " })).toEqual({
      kind: "state",
      stateCode: "FL",
    });
  });

  it("uses county as the more precise scope and retains a matching-state constraint", () => {
    expect(parseProviderSearchScope({ county: " 12033 ", state: "fl" })).toEqual({
      kind: "county",
      countyQuery: "12033",
      requestedStateCode: "FL",
    });
  });

  it("fails closed when neither county nor state is provided", () => {
    expect(parseProviderSearchScope({ county: undefined, state: undefined })).toEqual({
      kind: "none",
    });
  });

  it.each([
    { county: undefined, state: "" },
    { county: undefined, state: "Florida" },
    { county: undefined, state: ["FL"] },
    { county: ["12033"], state: "FL" },
  ])("rejects malformed query input %#", (input) => {
    expect(parseProviderSearchScope(input).kind).toBe("invalid");
  });
});
