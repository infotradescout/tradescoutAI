import { describe, expect, it } from "vitest";
import {
  isMixedScoutDiscoveryRequest,
  normalizeScoutCountyFips,
  resolveScoutCountyDiscoveryArea,
  requiresFreshScoutDiscovery,
} from "../scout/scoutCountyFips";
import {
  buildScoutMixedDiscoveryRecovery,
  extractScoutMixedDiscoveryTopic,
} from "../scout/scoutMixedDiscoveryRecovery";
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
  endsAt: new Date("2026-10-01T06:32:45.000Z"),
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
    const retryPrompt =
      "Search TradeScout and my area for posts & deals and public business profiles. Include matching pages, tools and requests.";
    expect(isMixedScoutDiscoveryRequest(retryPrompt)).toBe(true);
    expect(requiresFreshScoutDiscovery(retryPrompt)).toBe(true);
  });

  it("keeps the screenshot's broad request topic-free and recognizes a plain-language refinement", () => {
    const broad =
      "Search TradeScout and my area for posts & deals in my county. Look in Site, Near me, Latest, assume I care about this week, and keep it simple. Include matching pages, tools, local results, posts, requests, and anything nearby that may help.";
    const refined =
      "Find TradeScout posts and deals about plumbing in my county this week. Include public posts linked to requests and local businesses.";
    expect(extractScoutMixedDiscoveryTopic(broad)).toBeNull();
    expect(extractScoutMixedDiscoveryTopic("Search TradeScout for nearby activity posts and deals in my county. Include requests.")).toBeNull();
    expect(isMixedScoutDiscoveryRequest(refined)).toBe(true);
    expect(extractScoutMixedDiscoveryTopic(refined)).toBe("plumbing");
    expect(extractScoutMixedDiscoveryTopic("Search TradeScout for roofing posts and deals near me. Include requests.")).toBe("roofing");
    expect(extractScoutMixedDiscoveryTopic("Find TradeScout posts and deals about this week in my county. Include requests.")).toBeNull();
    expect(extractScoutMixedDiscoveryTopic("Find TradeScout posts and deals about % in my county. Include requests.")).toBeNull();
  });

  it("labels untargeted items as county results and narrows only public post text and business names", () => {
    const common = {
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      now: dealNow,
      postCheck: "checked" as const,
      dealCheck: "checked" as const,
      businessCheck: "checked" as const,
      communityPosts: [
        { id: "post_plumbing", title: "Plumbing repair", createdAt: "2026-09-22T12:00:00.000Z" },
        { id: "post_body", title: "Question", content: "Need plumbing advice", createdAt: "2026-09-22T11:00:00.000Z" },
        { id: "post_unrelated", title: "Roofing request", createdAt: "2026-09-22T10:00:00.000Z" },
      ],
      deals: [postedDeal],
      businesses: [
        { id: "plumbing", name: "Mesa Plumbing", slug: "mesa-plumbing", counties: [{ fips: "04013" }] },
        { id: "roofing", name: "Mesa Roofing", slug: "mesa-roofing", counties: [{ fips: "04013" }] },
      ],
    };
    const county = buildScoutMixedDiscoveryRecovery(common);
    expect(county.message).toContain("These are county results, not matches for a specific topic");
    expect(county.actions).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Open county post" })]));
    expect(county.entities).toHaveLength(6);

    const plumbing = buildScoutMixedDiscoveryRecovery({ ...common, topic: "plumbing" });
    expect(plumbing.entities.map((entity) => entity.name)).toEqual([
      "Plumbing repair", "Question", "Mesa Plumbing", "County tool rental offer",
    ]);
    expect(plumbing.entities[0]?.match_reasons).toContain('Title or text includes "plumbing"');
    expect(plumbing.entities[2]?.match_reasons).toContain('Business name includes "plumbing"');
    expect(plumbing.entities[3]?.match_reasons).toContain("Selected by county; not matched to your topic");
    expect(plumbing.message).toContain("Scout promotions were selected by county, not matched to your topic");
    expect(plumbing.actions).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Open topic post" })]));
    expect(JSON.stringify(plumbing)).not.toContain("Mesa Roofing");
  });

  it("does not mistake a topic miss or unavailable source for empty county inventory", () => {
    const common = {
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      topic: "plumbing",
      now: dealNow,
      postCheck: "checked" as const,
      dealCheck: "checked" as const,
      businessCheck: "checked" as const,
    };
    const empty = buildScoutMixedDiscoveryRecovery(common);
    expect(empty.message).toContain('for "plumbing"; none matched this topic');
    expect(empty.message).toContain('public business names for "plumbing"');
    expect(empty.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ to: "/community-feed?geo=local&feed=recent" }),
    ]));
    expect(empty.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Change my area" }),
    ]));
    const promotionalOnly = buildScoutMixedDiscoveryRecovery({ ...common, deals: [postedDeal] });
    expect(promotionalOnly.entities).toEqual([
      expect.objectContaining({ type: "trade_deal" }),
    ]);
    expect(promotionalOnly.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Open promotional TradeDeal", primary: false }),
      expect.objectContaining({
        label: "Draft a request for my county",
        to: "/direct-connect?source=scout",
        payload: { countyFips: "04013" },
        primary: true,
      }),
    ]));
    const failed = buildScoutMixedDiscoveryRecovery({
      ...common, postCheck: "error", businessCheck: "error", dealCheck: "error",
    });
    expect(failed.message).toContain("could not be checked right now");
    expect(failed.message).not.toContain("none matched this topic");
    expect(failed.entities).toEqual([]);
    expect(failed.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "ASK_SCOUT", label: "Retry local search" }),
    ]));
    expect(failed.actions).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Draft a request for my county" }),
    ]));
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
    expect(result.message).toContain("Businesses were not checked");
    expect(result.message).toContain("Pages, tools, and other requests were not checked");
    expect(result.entities).toEqual([
      expect.objectContaining({ name: "Neighborhood tool swap", url: "/community/posts/post_1" }),
    ]);
    expect(result.entities[0]?.match_reasons).toContain(
      "From the last 7 days in Maricopa County, AZ"
    );
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: "/community-feed?geo=local&feed=recent" }),
        expect.objectContaining({ to: "/contractors" }),
      ])
    );
    expect(JSON.stringify(result)).not.toContain("/trade-deals");
  });

  it("counts joined work-request rows once per published post and keeps their request signal", () => {
    const result = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      now: dealNow,
      postCheck: "checked",
      communityPosts: [
        {
          id: "post_1",
          title: "Tool request",
          createdAt: "2026-09-22T12:00:00.000Z",
          hasWorkRequest: false,
        },
        {
          id: "post_1",
          title: "Tool request",
          createdAt: "2026-09-22T12:00:00.000Z",
          hasWorkRequest: true,
        },
        {
          id: "post_2",
          title: "Neighborhood update",
          createdAt: "2026-09-21T12:00:00.000Z",
          hasWorkRequest: false,
        },
      ],
    });

    expect(result.message).toContain("2 published county posts from the last 7 days");
    expect(result.entities.map((entity) => entity.url)).toEqual([
      "/community/posts/post_1",
      "/community/posts/post_2",
    ]);
    expect(result.entities[0]?.match_reasons).toContain(
      "Published county post linked to a request"
    );
    expect(result.entities[1]?.match_reasons).toContain("Published county post");
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

  it("keeps public business cards within the checked county and links only safe slugs", () => {
    const result = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      postCheck: "checked",
      dealCheck: "checked",
      businessCheck: "checked",
      businesses: [
        { id: "one", name: "Repair One", slug: "repair-one", counties: [{ fips: "04013" }] },
        { id: "other", name: "Other County", slug: "other", counties: [{ fips: "06037" }] },
        { id: "unsafe", name: "Unsafe", slug: "../unsafe", counties: [{ fips: "04013" }] },
        { id: "reserved", name: "Requests Route", slug: "requests", counties: [{ fips: "04013" }] },
      ],
    });

    expect(result.entities).toEqual([
      expect.objectContaining({
        type: "business",
        name: "Repair One",
        url: "/business/repair-one",
      }),
    ]);
    expect(result.message).toContain("Business profiles were not filtered to this week");
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: "/business/repair-one", primary: true }),
      ])
    );
    expect(JSON.stringify(result)).not.toMatch(
      /Other County|\.\.\/unsafe|Requests Route|\/business\/requests/
    );
  });

  it("opens a county-bound private draft only after an all-source checked-empty result", () => {
    const result = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      postCheck: "checked",
      communityPosts: [],
      dealCheck: "checked",
      deals: [],
      businessCheck: "checked",
      businesses: [],
    });

    expect(result.entities).toEqual([]);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "NAVIGATE",
          label: "Draft a request for my county",
          to: "/direct-connect?source=scout",
          payload: { countyFips: "04013" },
          primary: true,
        }),
        expect.objectContaining({
          label: "Browse recent Community beyond my county",
          primary: false,
        }),
      ])
    );
    expect(result.actions.filter((action) => action.primary)).toHaveLength(1);
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
    expect(isEligibleScoutDeal(postedDeal, "04013", new Date("2026-10-02T00:00:00.000Z"))).toBe(
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
    expect(result.entities[1]?.match_reasons).toEqual(
      expect.arrayContaining([
        "Listed for Maricopa County, AZ",
        expect.stringContaining("when the offer ends"),
      ])
    );
    expect(result.entities[0]?.match_reasons).toContain(
      "From the last 7 days in Maricopa County, AZ"
    );
    expect(JSON.stringify(result.entities[1])).not.toMatch(/2026-10-01|UTC/);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Open promotional TradeDeal",
          to: `/deals/${postedDeal.id}?county=04013`,
        }),
      ])
    );
  });

  it("keeps deal-only county cues distinct from global placement and validates long labels", () => {
    const countyDealOnly = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      now: dealNow,
      postCheck: "checked",
      communityPosts: [],
      dealCheck: "checked",
      deals: [postedDeal],
    });
    expect(countyDealOnly.entities).toHaveLength(1);
    expect(countyDealOnly.entities[0]?.match_reasons).toContain("Listed for Maricopa County, AZ");
    expect(countyDealOnly.actions[0]).toEqual(
      expect.objectContaining({ label: "Open promotional TradeDeal", primary: true })
    );

    const globalDealOnly = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County, AZ",
      now: dealNow,
      postCheck: "checked",
      communityPosts: [],
      dealCheck: "checked",
      deals: [{ ...postedDeal, countyFips: [] }],
    });
    expect(globalDealOnly.entities[0]?.match_reasons).toContain("Listed for all counties");
    expect(globalDealOnly.entities[0]?.match_reasons).not.toContain(
      "Listed for Maricopa County, AZ"
    );

    const longArea = `${"Very Long County Name ".repeat(3).trim()}, AZ`;
    const longAreaResult = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: longArea,
      now: dealNow,
      postCheck: "checked",
      communityPosts: [
        { id: "post_1", title: "Tool request", createdAt: "2026-09-22T12:00:00.000Z" },
      ],
    });
    expect(longAreaResult.entities[0]?.match_reasons).toContain(
      `From the last 7 days in ${longArea}`
    );

    const malformedResult = buildScoutMixedDiscoveryRecovery({
      countyFips: "04013",
      countyLabel: "Maricopa County <script>, AZ",
      now: dealNow,
      dealCheck: "checked",
      deals: [postedDeal],
    });
    expect(malformedResult.entities[0]?.match_reasons).toContain("Listed for your county");
    expect(JSON.stringify(malformedResult)).not.toContain("<script>");
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
        expect.objectContaining({ type: "ASK_SCOUT", label: "Retry local search" }),
      ])
    );
  });
});
