import { describe, expect, it } from "vitest";
import {
  isMixedScoutDiscoveryRequest,
  normalizeScoutCountyFips,
  resolveScoutCountyDiscoveryArea,
  requiresFreshScoutDiscovery,
} from "../scout/scoutCountyFips";
import { buildScoutMixedDiscoveryRecovery } from "../scout/scoutMixedDiscoveryRecovery";

describe("Scout county lookup", () => {
  it("uses a complete FIPS rather than a readable county label", () => {
    expect(normalizeScoutCountyFips("Maricopa County, AZ", "04013")).toBe("04013");
    expect(normalizeScoutCountyFips("Maricopa County, AZ")).toBeNull();
    expect(normalizeScoutCountyFips("04013junk", "04013")).toBe("04013");
    expect(normalizeScoutCountyFips("04013junk")).toBeNull();
  });

  it("names the county from the selected FIPS rather than trusting request display text", () => {
    expect(
      resolveScoutCountyDiscoveryArea({
        countyHint: "04013",
        countyCode: "Maricopa County, AZ",
        stateCode: "AZ",
      })
    ).toEqual({ countyFips: "04013", countyLabel: "Maricopa County, AZ" });

    expect(
      resolveScoutCountyDiscoveryArea({
        countyHint: "04013",
        countyCode: "Los Angeles County, CA",
        stateCode: "CA",
      })
    ).toEqual({ countyFips: null, countyLabel: undefined });
    expect(
      resolveScoutCountyDiscoveryArea({
        countyHint: "04013",
        countyCode: "Los Angeles County, CA",
      })
    ).toEqual({ countyFips: null, countyLabel: undefined });
    expect(
      resolveScoutCountyDiscoveryArea({
        countyHint: "04013",
        countyCode: "Maricopa County, AZ",
        stateCode: "CA",
      })
    ).toEqual({ countyFips: null, countyLabel: undefined });
  });

  it("resolves an explicit new county and never replaces it with an older profile county", () => {
    expect(
      resolveScoutCountyDiscoveryArea({
        countyCode: "Los Angeles County, CA",
        stateCode: "CA",
        profileCountyFips: "04013",
      })
    ).toEqual({ countyFips: "06037", countyLabel: "Los Angeles County, CA" });
    expect(
      resolveScoutCountyDiscoveryArea({
        countyCode: "Unknown County, CA",
        stateCode: "CA",
        profileCountyFips: "04013",
      })
    ).toEqual({ countyFips: null, countyLabel: undefined });
    expect(
      resolveScoutCountyDiscoveryArea({ stateCode: "CA", profileCountyFips: "04013" })
    ).toEqual({ countyFips: null, countyLabel: undefined });
    expect(
      resolveScoutCountyDiscoveryArea({ countyHint: "04013bad", profileCountyFips: "06037" })
    ).toEqual({ countyFips: null, countyLabel: undefined });
    expect(resolveScoutCountyDiscoveryArea({ profileCountyFips: "04013" })).toEqual({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
    });
  });

  it("refreshes mixed county discovery requests without hijacking their answer", () => {
    expect(
      requiresFreshScoutDiscovery(
        "Search TradeScout and my area for posts & deals. Include matching pages, tools and requests."
      )
    ).toBe(true);
    expect(requiresFreshScoutDiscovery("Show local posts and requests near me")).toBe(true);
    expect(requiresFreshScoutDiscovery("Post this to my community feed")).toBe(false);
    expect(requiresFreshScoutDiscovery("Find a plumber near me")).toBe(false);
    expect(isMixedScoutDiscoveryRequest("Find local roofing deals")).toBe(false);
    expect(isMixedScoutDiscoveryRequest("Find local posts and deals near me")).toBe(false);
    expect(isMixedScoutDiscoveryRequest("Show local posts and requests near me")).toBe(false);
    expect(
      isMixedScoutDiscoveryRequest(
        "Search TradeScout and my area for posts & deals. Include matching pages, tools and requests."
      )
    ).toBe(true);
  });

  it("shows only dated, published county post evidence and working next surfaces", () => {
    const result = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      now: new Date("2026-09-23T18:00:00.000Z"),
      communityPosts: [
        {
          id: "post_1",
          title: "Neighborhood tool swap",
          createdAt: "2026-09-22T12:00:00.000Z",
        },
        { id: "old", title: "Old post", createdAt: "2026-09-01T12:00:00.000Z" },
      ],
    });

    expect(result.message).toContain("1 published county post from the last 7 days");
    expect(result.message).toContain("This Scout result includes");
    expect(result.message).toContain(
      "It does not verify deals, businesses, pages, tools, or other requests"
    );
    expect(result.entities).toEqual([
      expect.objectContaining({ name: "Neighborhood tool swap", url: "/community/posts/post_1" }),
    ]);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: "/community-feed?geo=local&feed=recent" }),
        expect.objectContaining({ to: "/contractors" }),
      ])
    );
    expect(JSON.stringify(result)).not.toContain("/trade-deals");
  });

  it("does not turn a limited empty result into a county-wide no-results claim", () => {
    const result = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      communityPosts: [],
    });
    expect(result.message).toContain("does not verify a county post");
    expect(result.message).not.toMatch(/I checked|Scout check found/i);
    expect(result.message).not.toMatch(/no (posts|deals|businesses)|0 (posts|deals|businesses)/i);
    expect(result.entities).toEqual([]);
  });

  it("does not imply a county search when no county is set", () => {
    const result = buildScoutMixedDiscoveryRecovery({ countyLabel: "Maricopa County, AZ" });
    expect(result.message).toContain("Set your county");
    expect(result.message).toContain(
      "does not verify county posts, deals, businesses, pages, tools, or requests"
    );
    expect(result.actions).toEqual([expect.objectContaining({ to: "/settings" })]);
  });
});
