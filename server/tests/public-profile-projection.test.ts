import { describe, expect, it } from "vitest";
import {
  absoluteCanonicalPublicProfileMediaUrl,
  buildCanonicalPublicProfileProjection,
  normalizeCanonicalPublicProfileCustomDomain,
  normalizeCanonicalPublicProfileMediaPath,
  normalizeCanonicalPublicProfileSlug,
  projectCanonicalPublicBusinessRecord,
  projectCanonicalPublicProfileContentBlocks,
  projectCanonicalPublicProfilePayloadValue,
  projectCanonicalPublicProfileRecord,
  resolveCanonicalPublicProfileUrl,
} from "../publicProfileProjection";

const PROFILE_MEDIA = "/images/businesses/jrs-auto-glass/cover.webp";
const JW_MEDIA = "/images/businesses/jw-stone/color-collage/01-white.webp";
const RED_MEDIA = "/images/businesses/red-graniti/source/home-hero.svg";

describe("canonical public profile projection", () => {
  it("accepts an ordinary non-contact slug containing literal at and dot words", () => {
    expect(normalizeCanonicalPublicProfileSlug("center-at-the-center-dot-beam")).toBe(
      "center-at-the-center-dot-beam"
    );
  });

  it("rejects a contact-shaped verbalized email slug", () => {
    expect(normalizeCanonicalPublicProfileSlug("owner-at-example-dot-com")).toBeNull();
  });

  it("rejects malformed, encoded, and path-bearing slugs", () => {
    for (const value of ["owner@example.com", "Owner/Profile", "owner%40example-com", " a "]) {
      expect(normalizeCanonicalPublicProfileSlug(value)).toBeNull();
    }
  });

  it("normalizes a plain verified-host candidate", () => {
    expect(normalizeCanonicalPublicProfileCustomDomain("Profile.Example.com.")).toBe(
      "profile.example.com"
    );
  });

  it("rejects URL, user-info, query, port, platform, and single-label domain values", () => {
    for (const value of [
      "https://owner@example.com/",
      "owner@example.com",
      "profile.example.com?email=owner@example.com",
      "profile.example.com:443",
      "www.thetradescout.com",
      "localhost",
    ]) {
      expect(normalizeCanonicalPublicProfileCustomDomain(value)).toBeNull();
    }
  });

  it("accepts exact paths from every pinned public media manifest", () => {
    expect(normalizeCanonicalPublicProfileMediaPath(PROFILE_MEDIA)).toBe(PROFILE_MEDIA);
    expect(normalizeCanonicalPublicProfileMediaPath(JW_MEDIA)).toBe(JW_MEDIA);
    expect(normalizeCanonicalPublicProfileMediaPath(RED_MEDIA)).toBe(RED_MEDIA);
  });

  it("canonicalizes an owned absolute asset to its manifest path without query data", () => {
    expect(
      normalizeCanonicalPublicProfileMediaPath(
        `https://cdn.example.test${PROFILE_MEDIA}?email=owner@example.com#private`
      )
    ).toBe(PROFILE_MEDIA);
  });

  it("rejects external and same-origin media that have no manifest owner", () => {
    for (const value of [
      "https://cdn.attacker.test/owner@example.com.png?phone=8505550199",
      "/uploads/profiles/unowned.jpg",
      "/images/provider/unowned.jpg",
    ]) {
      expect(normalizeCanonicalPublicProfileMediaPath(value)).toBeNull();
    }
  });

  it("re-homes owned media onto the trusted rendering origin", () => {
    expect(
      absoluteCanonicalPublicProfileMediaUrl(
        `https://attacker.test${PROFILE_MEDIA}?email=owner@example.com`,
        "https://www.thetradescout.com/private?ignored=1"
      )
    ).toBe(`https://www.thetradescout.com${PROFILE_MEDIA}`);
  });

  it("projects nested content once and removes direct contact, raw links, and unowned media", () => {
    const projected = projectCanonicalPublicProfileContentBlocks([
      {
        type: "hero",
        data: {
          title: "Call 850-555-0199 or email owner@example.com",
          description: "Visit https://owner@example.com/ at 123 Main Street",
          imageUrl: `https://cdn.attacker.test/owner@example.com.png?phone=8505550199`,
          faviconUrl: "https://example.test/icon.png?email=owner@example.com",
          website: "https://owner.example/?email=owner@example.com",
          instagramUrl: "https://social.example/owner@example.com",
          images: [PROFILE_MEDIA, "/uploads/profiles/unowned.jpg"],
        },
      },
    ]);
    const serialized = JSON.stringify(projected);

    expect(serialized).not.toMatch(
      /owner@example\.com|850-555-0199|8505550199|123 Main Street|owner\.example|cdn\.attacker/
    );
    expect(serialized).toContain(PROFILE_MEDIA);
    expect(serialized).not.toContain("/uploads/profiles/unowned.jpg");
  });

  it("preserves safe nested presentation metadata while projecting every leaf", () => {
    const projected = projectCanonicalPublicProfileContentBlocks([
      {
        type: "profilePresentation",
        data: {
          social: {
            brandName: "Safe Stone",
            logoUrl: PROFILE_MEDIA,
            profileImageUrl: JW_MEDIA,
            accentColor: "#123456",
            profileCta: "View profile",
            website: "https://owner.example/?email=owner@example.com",
          },
          email: {
            label: "Private email",
            value: "owner@example.com",
          },
          contact: {
            label: "Private contact",
            value: "850-555-0199",
          },
        },
      },
    ]);

    expect(projected).toEqual([
      {
        type: "profilePresentation",
        data: {
          social: {
            brandName: "Safe Stone",
            logoUrl: PROFILE_MEDIA,
            profileImageUrl: JW_MEDIA,
            accentColor: "#123456",
            profileCta: "View profile",
          },
        },
      },
    ]);
  });

  it("projects auxiliary /api/u collections through the same leaf authority", () => {
    const projected = projectCanonicalPublicProfilePayloadValue({
      communityPosts: [
        {
          id: "post-1",
          title: "Email owner@example.com at 123 Main Street",
          imageUrls: [PROFILE_MEDIA, "/uploads/profiles/unowned.jpg"],
          website: "https://owner.example/?email=owner@example.com",
        },
      ],
    });
    const serialized = JSON.stringify(projected);

    expect(serialized).toContain(PROFILE_MEDIA);
    expect(serialized).not.toMatch(
      /owner@example\.com|123 Main Street|owner\.example|\/uploads\/profiles\/unowned\.jpg/
    );
  });

  it("projects SEO through the same custom-domain and media authority", () => {
    const profile = projectCanonicalPublicProfileRecord({
      id: "profile-1",
      slug: "safe-profile",
      displayName: "Owner owner@example.com",
      headline: "Visit https://owner@example.com/",
      roleContext: "Stone service",
      contentBlocks: [],
      seoMeta: {
        title: "Owner owner@example.com",
        description: "123 Main Street",
        imageUrl: PROFILE_MEDIA,
        faviconUrl: "https://example.test/icon.png?email=owner@example.com",
        customDomain: "https://owner@example.com/",
      },
    });
    expect(profile).not.toBeNull();
    expect(JSON.stringify(profile)).not.toMatch(
      /owner@example\.com|123 Main Street|https:\/\/owner@example\.com/
    );
    expect(profile?.seoMeta).toEqual({
      title: "Owner Continue through TradeScout",
      description: "Continue through TradeScout",
      imageUrl: PROFILE_MEDIA,
    });
  });

  it("rejects an entire profile whose route identity is contact-shaped", () => {
    expect(
      projectCanonicalPublicProfileRecord({
        slug: "owner-at-example-dot-com",
        displayName: "Owner",
      })
    ).toBeNull();
  });

  it("removes raw /api/u business identifiers, website, address, ZIP, and unsafe areas", () => {
    const business = projectCanonicalPublicBusinessRecord({
      id: "business-secret-id",
      ownerUserId: "owner-secret-id",
      directConnectOwnerUserId: "owner-secret-id",
      name: "Stone Co owner@example.com",
      categories: ["Stone", "Email owner@example.com"],
      services: ["Install at 123 Main Street", "Design"],
      serviceAreas: ["Escambia County, FL", "123 Main Street", "https://owner.example"],
      website: "https://owner.example/?email=owner@example.com",
      address: "123 Main Street",
      zipCode: "32501",
      tradePartner: true,
      city: "Pensacola",
      stateCode: "fl",
    });
    const serialized = JSON.stringify(business);

    expect(business).toMatchObject({
      name: "Stone Co Continue through TradeScout",
      categories: ["Stone", "Email Continue through TradeScout"],
      services: ["Install at Continue through TradeScout", "Design"],
      serviceAreas: ["Escambia County, FL"],
      tradePartner: true,
      city: "Pensacola",
      stateCode: "FL",
    });
    expect(serialized).not.toMatch(
      /business-secret-id|owner-secret-id|owner@example\.com|123 Main Street|32501|owner\.example/
    );
  });

  it("builds canonical URLs only from the approved route identity and plain host", () => {
    expect(
      resolveCanonicalPublicProfileUrl({
        profileSlug: "safe-profile",
        customDomain: "profile.example.com",
        platformOrigin: "https://www.thetradescout.com",
      })
    ).toBe("https://profile.example.com/");
    expect(
      resolveCanonicalPublicProfileUrl({
        profileSlug: "safe-profile",
        customDomain: "https://owner@example.com/",
        platformOrigin: "https://www.thetradescout.com/path?raw=1",
      })
    ).toBe("https://www.thetradescout.com/u/safe-profile");
  });

  it("returns one canonical profile/business pair for every downstream consumer", () => {
    const projection = buildCanonicalPublicProfileProjection({
      profile: {
        id: "profile-1",
        businessId: "business-secret-id",
        slug: "safe-profile",
        displayName: "Safe Profile",
        contentBlocks: [{ type: "hero", data: { imageUrl: PROFILE_MEDIA } }],
        seoMeta: { imageUrl: PROFILE_MEDIA },
      },
      business: {
        id: "business-secret-id",
        name: "Safe Business",
        categories: ["Stone"],
        services: ["Design"],
        serviceAreas: ["Escambia County, FL"],
      },
    });

    expect(projection?.profile.slug).toBe("safe-profile");
    expect(projection?.profile.contentBlocks).toEqual([
      { type: "hero", data: { imageUrl: PROFILE_MEDIA } },
    ]);
    expect(projection?.business?.name).toBe("Safe Business");
    expect(JSON.stringify(projection)).not.toContain("business-secret-id");
  });
});
