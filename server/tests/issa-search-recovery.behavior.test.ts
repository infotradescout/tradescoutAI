import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatTradeScoutTitle } from "@shared/brand";
import { issaBuildBusinessText } from "@shared/issaBuildPageContent";
import { ISSA_BUILD_LOCAL_DISCOVERY } from "@shared/issaBuildProfile";
import { resolveIssaBuildCanonicalRedirect } from "@shared/issaBuildRoutes";

const records = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("../db", () => {
  const query: any = {};
  for (const method of ["select", "from", "innerJoin", "where"]) query[method] = vi.fn(() => query);
  query.orderBy = vi.fn(async () => records.rows);
  return { db: query };
});
import { resolveCanonicalBusinessProfileRoute } from "../services/canonicalBusinessProfileRoute";

function published(overrides: Record<string, unknown> = {}) {
  return {
    profileId: "synthetic-profile", profilePubliclyReleased: true, slug: "issa-build",
    profileRoleContext: "business_owner", profileHeadline: "Synthetic published local business",
    profileContentBlocks: [{ type: "about", data: { text: "Synthetic published business details." } }],
    businessId: "synthetic-business", profileOwnerUserId: "synthetic-owner",
    ownerRole: "business_owner", ownerRoles: ["business_owner"], ownerVerifiedBadge: false,
    ownerVerificationStatus: "approved", ownerProvider: "local",
    ownerPreferences: { profileVisibility: "private", publicProfileIds: ["synthetic-profile"] },
    businessStatus: "active", businessOwnerUserId: "synthetic-owner", publicDiscoveryEnabled: true,
    businessSources: ["selective_intelligence_onboarding"], businessClaimStatus: "claimed", ...overrides,
  };
}
beforeEach(() => { records.rows = [published()]; });

describe("ISSA search destination recovery", () => {
  it("resolves the published business directly to the existing canonical document", async () => {
    const route = await resolveCanonicalBusinessProfileRoute("issa-build");
    expect(route).toEqual({ slug: "issa-build", path: "/issa-build" });
    expect(resolveIssaBuildCanonicalRedirect(route!.path)).toBeNull();
  });
  it("leaves unrelated published business destinations unchanged", async () => {
    records.rows = [published({ slug: "issa-build-neighbor" })];
    await expect(resolveCanonicalBusinessProfileRoute("neighbor")).resolves.toEqual({
      slug: "issa-build-neighbor", path: "/u/issa-build-neighbor",
    });
  });
  it.each([
    { ownerVerificationStatus: "pending" },
    { profilePubliclyReleased: false, ownerPreferences: { profileVisibility: "private", publicProfileIds: [] } },
    { publicDiscoveryEnabled: false },
    { businessStatus: "suspended" },
  ])("does not create a canonical destination for an ineligible ISSA record %j", async override => {
    records.rows = [published(override)];
    await expect(resolveCanonicalBusinessProfileRoute("issa-build")).resolves.toBeNull();
  });
  it("does not resurrect an absent or inactive contractor as an SEO shortcut", async () => {
    records.rows = [];
    await expect(resolveCanonicalBusinessProfileRoute("issa-build")).resolves.toBeNull();
    expect(resolveIssaBuildCanonicalRedirect("/contractors/issa-build")).toBeNull();
  });
  it("preserves exact referral and material selectors on supported legacy URLs", () => {
    expect(resolveIssaBuildCanonicalRedirect("/u/issa-build?ref=local#work")).toBe("/issa-build?ref=local#work");
    expect(resolveIssaBuildCanonicalRedirect("/u/issa-build?stone=honey-onyx&photo=2")).toBe("/issa-build/onyx?stone=honey-onyx&photo=2");
  });
});

describe("ISSA complete default search title", () => {
  it("keeps both business names, location and service words without a generated ellipsis", () => {
    const title = formatTradeScoutTitle(issaBuildBusinessText(ISSA_BUILD_LOCAL_DISCOVERY.title));
    expect(title).toBe("ISSA Build | Pensacola Kitchens & Bathrooms | TradeScout");
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).not.toContain("…");
  });
  it("uses the same complete default for missing and legacy product-only titles", () => {
    for (const value of [undefined, "", "ISSA Build | Luxury Translucent Onyx"]) {
      expect(formatTradeScoutTitle(issaBuildBusinessText(value, ISSA_BUILD_LOCAL_DISCOVERY.title)))
        .toBe("ISSA Build | Pensacola Kitchens & Bathrooms | TradeScout");
    }
  });
  it("does not rewrite custom owner wording or the current business description", () => {
    for (const value of ["Owner's precise title", "ISSA Build | Custom Countertops", ISSA_BUILD_LOCAL_DISCOVERY.description]) {
      expect(issaBuildBusinessText(value)).toBe(value);
    }
  });
  it("does not change the persisted default or the existing product-page title", () => {
    expect(ISSA_BUILD_LOCAL_DISCOVERY.title).toBe("ISSA Build | Pensacola Kitchens, Bathrooms & Countertops");
    expect(formatTradeScoutTitle("Onyx | ISSA Build")).toBe("Onyx | ISSA Build | TradeScout");
  });
});
