import { describe, expect, it } from "vitest";
import {
  isMixedScoutDiscoveryRequest,
  normalizeScoutCountyFips,
  resolveScoutCountyDiscoveryArea,
  requiresFreshScoutDiscovery,
} from "../scout/scoutCountyFips";
import { buildScoutMixedDiscoveryRecovery } from "../scout/scoutMixedDiscoveryRecovery";
import {
  buildScoutDealPath,
  isEligibleScoutDeal,
  toScoutDealPublicView,
  type ScoutDealCandidate,
} from "../scout/scoutDealDiscovery";

const postedDeal: ScoutDealCandidate = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "County tool rental offer",
  shortDescription: "Posted tool rental terms",
  type: "trade_deal",
  tier: "paid_campaign",
  exclusive: true,
  status: "active",
  placementScout: true,
  startsAt: new Date("2026-09-22T00:00:00.000Z"),
  endsAt: new Date("2026-09-30T00:00:00.000Z"),
  countyFips: ["04013"],
  createdAt: new Date("2026-09-21T00:00:00.000Z"),
};
const dealNow = new Date("2026-09-23T18:00:00.000Z");

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
    expect(result.message).toContain("It does not verify deals");
    expect(result.message).toContain(
      "Businesses, pages, tools, and other requests were not checked"
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

  it("uses the same strict Scout publication rule for a result and its detail path", () => {
    expect(isEligibleScoutDeal(postedDeal, "04013", dealNow)).toBe(true);
    expect(isEligibleScoutDeal(postedDeal, "06037", dealNow)).toBe(false);
    expect(isEligibleScoutDeal(postedDeal, null, dealNow)).toBe(false);
    expect(isEligibleScoutDeal({ ...postedDeal, countyFips: [] }, null, dealNow)).toBe(true);
    expect(isEligibleScoutDeal({ ...postedDeal, placementScout: false }, "04013", dealNow)).toBe(
      false
    );
    expect(isEligibleScoutDeal({ ...postedDeal, tier: "free_directory" }, "04013", dealNow)).toBe(
      false
    );
    expect(isEligibleScoutDeal({ ...postedDeal, exclusive: false }, "04013", dealNow)).toBe(false);
    expect(isEligibleScoutDeal({ ...postedDeal, status: "paused" }, "04013", dealNow)).toBe(false);
    expect(isEligibleScoutDeal(postedDeal, "04013", new Date("2026-10-01T00:00:00.000Z"))).toBe(
      false
    );
    expect(isEligibleScoutDeal(postedDeal, "04013", new Date("2026-09-20T00:00:00.000Z"))).toBe(
      false
    );
    expect(buildScoutDealPath(postedDeal.id, "04013")).toBe(`/deals/${postedDeal.id}?county=04013`);
    expect(buildScoutDealPath("not-an-id", "04013")).toBeNull();
    expect(toScoutDealPublicView(postedDeal)).toEqual(
      expect.objectContaining({
        title: "County tool rental offer",
        scope: "county",
        source: "TradeScout posted promotion",
      })
    );
    expect(JSON.stringify(toScoutDealPublicView(postedDeal))).not.toContain("ctaUrl");
  });

  it("shows checked posted deals alongside posts and opens the exact eligible deal", () => {
    const result = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      now: dealNow,
      dealCheck: "checked",
      deals: [
        postedDeal,
        { ...postedDeal, id: "22222222-2222-4222-8222-222222222222", countyFips: ["06037"] },
      ],
      communityPosts: [
        { id: "post_1", title: "Tool request", createdAt: "2026-09-22T12:00:00.000Z" },
      ],
    });
    expect(result.entities).toHaveLength(2);
    expect(result.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "community_post", url: "/community/posts/post_1" }),
        expect.objectContaining({
          type: "trade_deal",
          url: `/deals/${postedDeal.id}?county=04013`,
        }),
      ])
    );
    expect(result.message).toContain("1 posted Scout TradeDeal");
    expect(result.message).toContain("terms and availability are not independently verified");
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Open promotional TradeDeal",
          to: `/deals/${postedDeal.id}?county=04013`,
        }),
      ])
    );
  });

  it("distinguishes an empty Scout placement check from a failed check", () => {
    const empty = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      dealCheck: "checked",
      deals: [],
    });
    const error = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      dealCheck: "error",
      deals: [postedDeal],
    });
    expect(empty.message).toContain("no eligible TradeDeals were returned");
    expect(empty.message).toContain("Other deal sources were not checked");
    expect(error.message).toContain("could not be checked right now");
    expect(error.entities).toEqual([]);
    expect(error.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "ASK_SCOUT", label: "Retry local posts and deals" }),
      ])
    );
  });
});
