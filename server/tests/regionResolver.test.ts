import { describe, expect, it } from "vitest";
import { resolveCountyFips, resolveRegionSlug } from "../services/regionResolver";

describe("regionResolver", () => {
  it("resolves county FIPS from county:#####", () => {
    const fips = resolveCountyFips({
      countyCode: "county:06037, CA",
      stateCode: "CA",
      counties: [],
    });
    expect(fips).toBe("06037");
  });

  it("resolves county FIPS from county name", () => {
    const fips = resolveCountyFips({
      countyCode: "Los Angeles County, CA",
      stateCode: "CA",
      counties: [{ name: "Los Angeles", fips: "06037", stateCode: "CA" }],
    });
    expect(fips).toBe("06037");
  });

  it("picks the most specific region when multiple match", () => {
    const slug = resolveRegionSlug({
      stateCode: "CA",
      countyFips: "06001",
      regions: [
        {
          slug: "bay-area",
          isOfficial: true,
          statesCovered: ["CA"],
          countiesCovered: ["06001", "06013"],
        },
        {
          slug: "east-bay",
          isOfficial: true,
          statesCovered: ["CA"],
          countiesCovered: ["06001"],
        },
      ],
    });

    expect(slug).toBe("east-bay");
  });

  it("uses explicit statewide fallback when no county match", () => {
    const slug = resolveRegionSlug({
      stateCode: "CA",
      countyFips: "99999",
      regions: [
        {
          slug: "bay-area",
          isOfficial: true,
          statesCovered: ["CA"],
          countiesCovered: ["06001", "06013"],
        },
        {
          slug: "california",
          isOfficial: true,
          statesCovered: ["CA"],
          countiesCovered: [],
        },
      ],
    });

    expect(slug).toBe("california");
  });

  it("returns undefined when no county match and no statewide region", () => {
    const slug = resolveRegionSlug({
      stateCode: "CA",
      countyFips: "99999",
      regions: [
        {
          slug: "bay-area",
          isOfficial: true,
          statesCovered: ["CA"],
          countiesCovered: ["06001", "06013"],
        },
      ],
    });

    expect(slug).toBeUndefined();
  });
});
