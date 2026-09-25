import { describe, expect, it } from "vitest";
import {
  buildScoutLaunchContextCacheKey,
  normalizeScoutLaunchContext,
  parseScoutLaunchLocation,
  SCOUT_LAUNCH_CONTINUATION_PARAM,
} from "../../shared/scoutLaunchContext";
import { normalizeScoutRequest } from "../scout/scoutRequestNormalizer";
import { buildScoutMissionCacheKey } from "../services/scoutOptimizationEngine";

describe("Scout classic-to-conversation launch context", () => {
  it("preserves a HomeScout listing, locality, prompt, and safe return path", () => {
    const launch = parseScoutLaunchLocation(
      "/scout?source=homescout_listing&listingId=listing_123&countyFips=12095&stateCode=fl&prompt=Review%20this%20listing"
    );

    expect(launch.prompt).toBe("Review this listing");
    expect(launch.context).toEqual({
      source: "homescout_listing",
      contextType: "home_listing",
      contextId: "listing_123",
      listingId: "listing_123",
      countyFips: "12095",
      state: "FL",
    });
    expect(launch.returnPath).toBe("/homescout/listings/listing_123");
  });

  it("keeps county and trade handoffs distinct", () => {
    const county = parseScoutLaunchLocation(
      "/scout?intent=local-search&source=county-community-path&county=Orange%20County&countyFips=12095&stateCode=FL"
    );
    const trade = parseScoutLaunchLocation(
      "/scout?intent=estimate&source=trade_city_empty&trade=roofing&state=FL&city=Winter%20Garden"
    );

    expect(county.context?.contextType).toBe("county");
    expect(county.returnPath).toBe("/county/fl/orange-county");
    expect(trade.context?.contextType).toBe("trade");
    expect(trade.returnPath).toBe("/trade/roofing/fl/city/winter-garden");
    expect(buildScoutLaunchContextCacheKey(county.context || undefined)).not.toBe(
      buildScoutLaunchContextCacheKey(trade.context || undefined)
    );
  });

  it("does not accept arbitrary sources, entity types, identifiers, or return URLs", () => {
    const context = normalizeScoutLaunchContext({
      source: "attacker",
      intent: "estimate",
      listingId: "../../admin",
      entityId: "entity-1",
      entityType: "admin",
      returnPath: "https://example.com/steal",
    });

    expect(context).toEqual({
      intent: "estimate",
      contextType: "classic_handoff",
    });
    expect(parseScoutLaunchLocation("/scout?returnPath=https://example.com").returnPath).toBe(
      undefined
    );
    expect(parseScoutLaunchLocation("/scout-admin?listingId=listing_123").context).toBeNull();
  });

  it("keeps existing cache keys stable when no launch context is present", () => {
    const baseInput = {
      query: "Need a roofer",
      countyFips: "12095",
      stateCode: "FL",
      trade: "roofing",
    };

    expect(buildScoutMissionCacheKey(baseInput)).toBe("need a roofer|12095|fl|roofing|standard");
    expect(
      buildScoutMissionCacheKey({
        ...baseInput,
        contextKey: "homescout_listing:home_listing:listing_123:roofing:12095:FL",
      })
    ).toBe(
      "need a roofer|12095|fl|roofing|context:homescout_listing:home_listing:listing_123:roofing:12095:fl|standard"
    );
  });

  it("keeps a prompt-only launch as a user-reviewed draft", () => {
    const launch = parseScoutLaunchLocation(
      "/scout?prompt=Compare%20these%20options%20before%20I%20contact%20anyone"
    );

    expect(launch.prompt).toBe("Compare these options before I contact anyone");
    expect(launch.context).toBeNull();
  });

  it("recognizes a confirmed onboarding result as an explicit Scout handoff", () => {
    const launch = parseScoutLaunchLocation(
      "/scout?source=onboarding_result&prompt=Find%20a%20licensed%20roofer%20near%20me"
    );

    expect(launch.prompt).toBe("Find a licensed roofer near me");
    expect(launch.context).toEqual({
      source: "onboarding_result",
      contextType: "classic_handoff",
    });
  });

  it("sanitizes the launch context again at the server boundary", () => {
    const request = normalizeScoutRequest({
      message: "What should I check next?",
      history: [],
      launchContext: {
        source: "business_profile_call",
        businessId: "business-123",
        businessSlug: "local-roofing-co",
        returnPath: "https://example.com/not-allowed",
        secret: "not-allowed",
      },
    });

    expect(request.launchContext).toEqual({
      source: "business_profile_call",
      contextType: "business_profile",
      contextId: "business-123",
      businessId: "business-123",
      businessSlug: "local-roofing-co",
    });
  });

  it("returns profile-launched Scout conversations to the public profile", () => {
    const launch = parseScoutLaunchLocation(
      "/scout?source=business_profile_call&businessSlug=la-plumbing-solutions&prompt=Help%20me%20plan%20this%20job"
    );

    expect(launch.context?.contextType).toBe("business_profile");
    expect(launch.returnPath).toBe("/u/la-plumbing-solutions");
  });

  it("distinguishes an opaque context-only continuation without changing unmarked signatures", () => {
    const base = "/scout?source=business_profile_call&businessSlug=shared-plumbing&intent=estimate";
    const token = "0123456789abcdef0123456789abcdef";
    const unmarked = parseScoutLaunchLocation(base);
    const marked = parseScoutLaunchLocation(`${base}&${SCOUT_LAUNCH_CONTINUATION_PARAM}=${token}`);
    const withPrompt = parseScoutLaunchLocation(`${base}&prompt=Private%20job%20details`);
    const withPromptAndMarker = parseScoutLaunchLocation(
      `${base}&prompt=Private%20job%20details&${SCOUT_LAUNCH_CONTINUATION_PARAM}=${token}`
    );

    expect(unmarked.signature).toBe(JSON.stringify({ context: unmarked.context, prompt: null }));
    expect(marked.context).toEqual(unmarked.context);
    expect(marked.returnPath).toBe("/u/shared-plumbing");
    expect(marked.continuationToken).toBe(token);
    expect(marked.signature).not.toBe(unmarked.signature);
    expect(withPromptAndMarker.signature).toBe(withPrompt.signature);
    expect(withPromptAndMarker.continuationToken).toBeUndefined();
  });

  it("drops malformed or duplicate continuation markers before they reach Scout", () => {
    const base = "/scout?source=scout_resume&intent=local-search";
    for (const suffix of [
      `&${SCOUT_LAUNCH_CONTINUATION_PARAM}=not-a-token`,
      `&${SCOUT_LAUNCH_CONTINUATION_PARAM}=0123456789abcdef0123456789abcdef&${SCOUT_LAUNCH_CONTINUATION_PARAM}=fedcba9876543210fedcba9876543210`,
    ]) {
      const launch = parseScoutLaunchLocation(`${base}${suffix}`);
      expect(launch.context).toBeNull();
      expect(launch.prompt).toBeUndefined();
      expect(launch.continuationToken).toBeUndefined();
    }
  });
});
