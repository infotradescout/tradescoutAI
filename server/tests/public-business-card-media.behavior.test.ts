import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePublicBusinessPreviewImage, toPublicBusinessCardDetails } from "@shared/publicBusinessCard";

const mocks = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], calls: 0, fail: false }));
vi.mock("../db", () => ({ db: {
  select: () => {
    mocks.calls++;
    const query = {
      from() { return this; }, innerJoin() { return this; }, where() { return this; },
      async orderBy() { if (mocks.fail) throw new Error("preview lookup failed"); return mocks.rows; },
    };
    return query;
  },
} }));
import { buildPublicBusinessProfilePreviews, enrichPublicBusinessCards } from "../services/publicBusinessCardEnrichment";

const business = {
  id: "business-1", slug: "preview-business", name: "Preview Business",
  card: toPublicBusinessCardDetails({ services: ["Plumbing repairs"] }),
};
const gallery = [{ type: "gallery", data: { title: "Project photos", images: [
  { title: "Fixture installation", description: "A completed fixture installation in this synthetic test project.", imageUrl: "/images/businesses/test/fixture.webp" },
  { title: "Completed kitchen", description: "The completed kitchen shown in this synthetic test fixture.", imageUrl: "/images/businesses/test/kitchen.webp" },
] } }];
function row(overrides: Record<string, unknown> = {}) {
  return {
    profileId: "profile-1", profileStatus: "published", profilePubliclyReleased: true,
    slug: "preview-profile", profileDisplayName: "Preview Business",
    profileSeoMeta: { faviconUrl: "/images/businesses/test/logo.svg", imageUrl: "/images/businesses/test/cover.webp" },
    profileRoleContext: "business_owner", profileHeadline: "Plumbing and renovation services.",
    profileContentBlocks: gallery, businessId: "business-1", businessSlug: "preview-business",
    profileOwnerUserId: "owner-1", ownerRole: "business_owner", ownerRoles: ["business_owner"],
    ownerVerifiedBadge: false, ownerVerificationStatus: "approved", ownerProvider: "local",
    ownerPreferences: { profileVisibility: "private", publicProfileIds: ["profile-1"] },
    businessStatus: "active", businessOwnerUserId: "owner-1", publicDiscoveryEnabled: true,
    businessSources: ["selective_intelligence_onboarding"], businessClaimStatus: "claimed",
    professionalRoleApproved: true, ...overrides,
  };
}

beforeEach(() => { mocks.rows = []; mocks.calls = 0; mocks.fail = false; });

describe("public business preview media URLs", () => {
  it.each([
    "/images/businesses/test/cover.webp", "/attached_assets/work.png", "/assets/brand.svg",
    "https://www.thetradescout.com/images/businesses/test/cover.webp",
    "https://thetradescout.com/images/businesses/test/cover.webp",
  ])("keeps a public static image: %s", (url) => {
    expect(normalizePublicBusinessPreviewImage(url)).toBe(new URL(url, "https://www.thetradescout.com").pathname);
  });
  it.each([
    null, undefined, {}, "", "javascript:alert(1)", "data:image/png;base64,abc", "//private.test/work.png",
    "https://private.test/work.png", "http://www.thetradescout.com/images/work.png",
    "https://user:secret@www.thetradescout.com/images/work.png", "/api/private/work.png",
    "/objects/private/work.png", "/images/work.png?token=secret", "/images/work.png#secret",
    "/images/%252e%252e/private/work.png", "/images/%2fprivate/work.png", "/images/work.png\n",
    "https://www.thetradescout.com:9443/images/work.png", "/api/auth/logout",
  ])("rejects non-public or credential-bearing reference: %s", (url) => {
    expect(normalizePublicBusinessPreviewImage(url)).toBeNull();
  });
});

describe("published profile previews", () => {
  it("uses the exact linked profile's published logo, cover and governed gallery paths", () => {
    const result = buildPublicBusinessProfilePreviews([business], [row()]).get(business.id);
    expect(result?.logoUrl).toBe("/images/businesses/test/logo.svg");
    expect(result?.coverImageUrl).toBe("/images/businesses/test/cover.webp");
    expect(result?.gallery).toHaveLength(2);
    expect(result?.gallery[0].path).toMatch(/^\/u\/preview-profile\//);
    expect(result?.gallery[0].title).toBe("Fixture installation");
  });
  it("uses a public gallery image when no share cover was published", () => {
    expect(buildPublicBusinessProfilePreviews([business], [row({ profileSeoMeta: {} })]).get(business.id)?.coverImageUrl)
      .toBe("/images/businesses/test/fixture.webp");
  });
  it.each([
    { businessId: "other-business" }, { businessSlug: "other-business" }, { profileStatus: "draft" },
    { ownerVerificationStatus: "pending" }, { ownerVerificationStatus: "suspended" },
    { publicDiscoveryEnabled: false }, { businessStatus: "suspended" }, { businessOwnerUserId: "someone-else" },
    { profilePubliclyReleased: false, ownerPreferences: { publicProfileIds: ["another-profile"] } },
    { slug: "../../private" },
  ])("does not publish a preview outside existing identity/release/trust authority: %j", (changes) => {
    expect(buildPublicBusinessProfilePreviews([business], [row(changes)]).size).toBe(0);
  });
  it("selects the newest eligible linked profile, not a newer private sibling", () => {
    const result = buildPublicBusinessProfilePreviews([business], [
      row({ slug: "private-sibling", profilePubliclyReleased: false, ownerPreferences: { publicProfileIds: [] } }),
      row(), row({ slug: "older-profile" }),
    ]);
    expect(result.get(business.id)?.profileSlug).toBe("preview-profile");
  });
  it("honors an explicit gallery discovery opt-out using the actual publication graph", () => {
    const result = buildPublicBusinessProfilePreviews([business], [row({
      profileSeoMeta: {},
      profileContentBlocks: [...gallery, { type: "publicDiscovery", data: { sitemap: { gallery: false } } }],
    })]).get(business.id);
    expect(result?.gallery).toEqual([]);
    expect(result?.coverImageUrl).toBeNull();
  });
  it("does not promote sparse gallery records into automatic public child pages", () => {
    const result = buildPublicBusinessProfilePreviews([business], [row({
      profileSeoMeta: {}, profileContentBlocks: [{ type: "gallery", data: { images: [
        { title: "Fixture installation", imageUrl: "/images/businesses/test/fixture.webp" },
      ] } }],
    })]).get(business.id);
    expect(result?.gallery).toEqual([]);
  });
  it("bounds and deduplicates gallery preview images", () => {
    const description = "Source-backed descriptive context for this synthetic test photo.";
    const blocks = [{ type: "gallery", data: { title: "Project photos", images: [
      { title: "First", description, imageUrl: "/images/businesses/test/first.webp" },
      { title: "Duplicate", description, imageUrl: "/images/businesses/test/first.webp" },
      ...Array.from({ length: 8 }, (_, n) => ({ title: `Project ${n}`, description, imageUrl: `/images/businesses/test/work-${n}.webp` })),
    ] } }];
    const result = buildPublicBusinessProfilePreviews([business], [row({ profileContentBlocks: blocks })]).get(business.id);
    expect(result?.gallery).toHaveLength(3);
    expect(new Set(result?.gallery.map((item) => item.imageUrl)).size).toBe(3);
  });
  it("retains only the public preview allowlist and sanitizes the headline", () => {
    const result = buildPublicBusinessProfilePreviews([business], [row({
      profileHeadline: "Ask private@example.test about repairs", privateNote: "internal-review-only",
    })]).get(business.id);
    expect(Object.keys(result || {}).sort()).toEqual(["businessId", "coverImageUrl", "gallery", "headline", "logoUrl", "profileSlug"]);
    expect(JSON.stringify(result)).not.toMatch(/private@example|internal-review-only|owner-1|publicProfileIds|ownerPreferences/);
  });
  it("uses one batch lookup and preserves the business page order and existing card data", async () => {
    mocks.rows = [row()];
    const other = { ...business, id: "business-2", slug: "other-business" };
    const result = await enrichPublicBusinessCards([other, business]);
    expect(mocks.calls).toBe(1);
    expect(result.map((item) => item.id)).toEqual([other.id, business.id]);
    expect(result[0].profilePreview).toBeNull();
    expect(result[1].profilePreview?.profileSlug).toBe("preview-profile");
    expect(result[1].card).toBe(business.card);
    expect(business).not.toHaveProperty("profilePreview");
  });
  it("does not query an empty page or silently expand beyond the existing page limit", async () => {
    expect(await enrichPublicBusinessCards([])).toEqual([]);
    await expect(enrichPublicBusinessCards(Array.from({ length: 51 }, (_, n) => ({ ...business, id: `business-${n}` })))).rejects.toThrow("existing limit");
    expect(mocks.calls).toBe(0);
  });
  it("propagates lookup failure instead of allowing a successful empty preview cache", async () => {
    mocks.fail = true;
    await expect(enrichPublicBusinessCards([business])).rejects.toThrow("preview lookup failed");
  });
});
