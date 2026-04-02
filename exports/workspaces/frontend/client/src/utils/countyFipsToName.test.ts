import { describe, expect, it } from "vitest";
import { countyFipsToName, formatCountyLabel, getCountyStateCode } from "./countyFipsToName";

describe("countyFipsToName", () => {
  it("maps known county fips to county and state label", () => {
    expect(countyFipsToName("12033")).toBe("Escambia County, FL");
  });

  it("normalizes numeric fips values", () => {
    expect(countyFipsToName("1001")).toBe("Autauga County, AL");
  });

  it("does not leak unknown fips codes to user-facing label", () => {
    expect(countyFipsToName("99999")).toBe("");
  });
});

describe("formatCountyLabel", () => {
  it("returns friendly fallback without raw codes when county is unknown", () => {
    expect(formatCountyLabel("99999", "TX")).toBe("Local county, TX");
  });

  it("returns generic local area when county and state are unavailable", () => {
    expect(formatCountyLabel(undefined)).toBe("Local area");
  });
});

describe("getCountyStateCode", () => {
  it("returns state code for known county", () => {
    expect(getCountyStateCode("12033")).toBe("FL");
  });

  it("returns empty string for unknown county", () => {
    expect(getCountyStateCode("99999")).toBe("");
  });
});
