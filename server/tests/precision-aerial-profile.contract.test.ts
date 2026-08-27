import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRECISION_AERIAL_BUSINESS_NAME,
  PRECISION_AERIAL_MEDIA_SOURCES,
  PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_PUBLIC_SOURCES,
  PRECISION_AERIAL_STEWARD_PROVIDER,
  PRECISION_AERIAL_V1_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_V2_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS,
} from "@shared/precisionAerialProfile";
import { userRoleEnum } from "@shared/schema";
import { resolveProfilePublicMediaObjectKey } from "@shared/profilePublicMedia";
import {
  ADMIN_MANAGED_PROFILE_SOURCE,
  hasTradeScoutPendingOwnerCustody,
  isOwnerConfirmedDirectProfile,
} from "../services/ownerConfirmedDirectProfile";
import {
  isPrecisionAerialV1SystemSeed,
  isPrecisionAerialV2SystemSeed,
  isPrecisionAerialV3SystemSeed,
  mergePrecisionAerialBusinessProfileData,
  resolvePrecisionAerialProfileSeedFields,
} from "../services/precisionAerialProfileProvisioning";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Precision Aerial production profile contract", () => {
  it("keeps the public identity plain, media-first, and limited to supported work", () => {
    const publicCopy = JSON.stringify(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS).toLowerCase();
    const hero = PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS.find((block) => block.type === "hero");

    expect(PRECISION_AERIAL_PROFILE_SLUG).toBe("precision-aerial-services");
    expect(PRECISION_AERIAL_BUSINESS_NAME).toBe("Precision Aerial Services");
    expect(hero?.data.title).toBe("A better view.");
    expect(hero?.data.text).toBe(
      "Aerial photo, video, and FPV for real estate, construction, and land."
    );
    expect(hero?.data.upcomingService).toBe("Thermal imaging");
    expect(hero?.data.presentationVariant).toBe("first-deliverable");
    expect(
      PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS.find((block) => block.type === "siteTemplate")?.data
    ).toMatchObject({ id: "default" });
    expect(hero?.data.imageUrl).toBe("/images/profiles/precision-aerial/real-estate-aerial-01.jpg");
    expect(hero?.data.videoUrl).toBe("/images/profiles/precision-aerial/hero-reel.mp4");
    expect(hero?.data.videoPosterUrl).toBe(
      "/images/profiles/precision-aerial/hero-reel-poster.jpg"
    );
    expect(
      PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS.find((block) => block.type === "gallery")
    ).toBeTruthy();
    expect(PRECISION_AERIAL_PUBLIC_SOURCES).toContain(
      "https://www.instagram.com/precisionaerialservice/"
    );
    expect(PRECISION_AERIAL_MEDIA_SOURCES).toEqual([
      {
        assetPath: "/images/profiles/precision-aerial/real-estate-aerial-01.jpg",
        sourceUrl: "https://www.instagram.com/p/DWHQtuPkUv0/",
      },
      {
        assetPath: "/images/profiles/precision-aerial/real-estate-aerial-02.jpg",
        sourceUrl: "https://www.instagram.com/p/DWHQtuPkUv0/",
      },
      {
        assetPath: "/images/profiles/precision-aerial/hero-reel.mp4",
        sourceUrl: "https://www.instagram.com/reel/DWRwdNLEcDF/",
      },
      {
        assetPath: "/images/profiles/precision-aerial/hero-reel-poster.jpg",
        sourceUrl: "https://www.instagram.com/reel/DWRwdNLEcDF/",
      },
    ]);
    for (const unsupported of [
      "certified",
      "certification",
      "inspection",
      "survey",
      "mapping",
      "lidar",
      "fleet",
      "insurance",
      "faa part 107",
      "licensed drone pilot",
    ]) {
      expect(publicCopy).not.toContain(unsupported);
    }
    expect(publicCopy).toContain("fpv drone video");
    expect(publicCopy).toContain("thermal imaging");
  });

  it("uses a dedicated internal steward and fails closed on ownership or claim collisions", () => {
    const source = read("server/services/precisionAerialProfileProvisioning.ts");

    expect(source).toContain('if (process.env.NODE_ENV !== "production") return');
    expect(PRECISION_AERIAL_STEWARD_PROVIDER).toBe("admin_provisioned_profile_steward");
    expect(userRoleEnum.enumValues).toContain("content_creator");
    expect(source).toContain('role: "content_creator"');
    expect(source).not.toContain('"photographer_videographer"');
    expect(source).toContain("@profile-steward.invalid");
    expect(source).not.toContain("MASTER_ADMIN_EMAIL");
    expect(source).not.toContain("MASTER_ADMIN_PASSWORD");
    expect(source).toContain("internalProfileSteward");
    expect(source).toContain('profileVisibility: "public"');
    for (const section of [
      "rolesAndBadges",
      "stats",
      "marketplaceListings",
      "reviews",
      "communityActivity",
    ]) {
      expect(source).toContain(`${section}: false`);
    }
    for (const section of ["about", "services", "contactCard"]) {
      expect(source).toContain(`${section}: true`);
    }
    expect(source).toContain("...existingProfileData");
    expect(source).toContain("...existingBrandColors");
    expect(source).toContain('primary: "#52c8f5"');
    expect(source).toContain('claimStatus: "unclaimed"');
    expect(source).toContain("publicDiscoveryEnabled: false");
    expect(source).toContain('status: "active"');
    expect(source).toContain('status: "published"');
    expect(source).toContain("PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS");
    expect(source).toContain("PRECISION_AERIAL_PROFILE_PROVISIONING_SOURCE");
    expect(source).toContain("business is claimed; provisioning will not overwrite it");
    expect(source).toContain("business slug is owned by a non-steward account");
    expect(source).toContain("profile slug is owned by a non-steward account");
    expect(source).toContain("profile is unpublished; provisioning will not republish it");
    expect(source).not.toMatch(/\b(phone|address):\s*["'`]/i);
    expect(source).not.toContain('verificationStatus: "approved"');
    expect(source).not.toContain("verifiedBadge: true");
  });

  it("migrates only exact system seeds and preserves every customized profile field", () => {
    const v1Sections = {
      about: false,
      rolesAndBadges: false,
      stats: false,
      services: false,
      marketplaceListings: false,
      reviews: false,
      communityActivity: false,
      contactCard: false,
    };
    const v1Profile = {
      displayName: PRECISION_AERIAL_BUSINESS_NAME,
      roleContext: "content_creator",
      headline: "Drone photo and video in Pensacola.",
      contentBlocks: PRECISION_AERIAL_V1_PROFILE_CONTENT_BLOCKS,
      ctaConfig: {
        primary: {
          label: "Direct Connect",
          kind: "message",
          value: "/direct-connect",
        },
      },
      seoMeta: {
        title: "Precision Aerial Services | Pensacola Drone Photo and Video",
        description:
          "See aerial photo and video work from Precision Aerial Services in Pensacola and send a request through TradeScout Direct Connect.",
      },
    };

    expect(isPrecisionAerialV1SystemSeed(v1Profile, { profileSections: v1Sections })).toBe(true);
    const migrated = resolvePrecisionAerialProfileSeedFields(v1Profile, {
      profileSections: v1Sections,
    });
    expect(migrated.contentBlocks).toEqual(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS);
    expect(migrated.seoMeta).toMatchObject({
      imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-01.jpg",
      faviconUrl: "/images/profiles/precision-aerial/logo.jpg",
    });

    const v2Sections = {
      about: true,
      rolesAndBadges: false,
      stats: false,
      services: true,
      marketplaceListings: false,
      reviews: false,
      communityActivity: false,
      contactCard: true,
    };
    const v2Profile = {
      ...v1Profile,
      contentBlocks: PRECISION_AERIAL_V2_PROFILE_CONTENT_BLOCKS,
      seoMeta: {
        ...v1Profile.seoMeta,
        imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-01.jpg",
        imageWidth: 1440,
        imageHeight: 1080,
        faviconUrl: "/images/profiles/precision-aerial/logo.jpg",
      },
    };
    expect(isPrecisionAerialV2SystemSeed(v2Profile, { profileSections: v2Sections })).toBe(true);
    expect(
      resolvePrecisionAerialProfileSeedFields(v2Profile, {
        profileSections: v2Sections,
      }).contentBlocks
    ).toEqual(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS);

    const v3Profile = {
      ...v2Profile,
      contentBlocks: PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS,
    };
    expect(isPrecisionAerialV3SystemSeed(v3Profile, { profileSections: v2Sections })).toBe(true);
    expect(
      resolvePrecisionAerialProfileSeedFields(v3Profile, {
        profileSections: v2Sections,
      }).contentBlocks
    ).toEqual(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS);

    const customizedProfile = {
      ...v1Profile,
      headline: "Owner-written headline",
      contentBlocks: [
        { type: "siteTemplate", data: { id: "default" } },
        { type: "custom", data: { body: "Owner-authored block" } },
      ],
      seoMeta: {
        title: "Owner SEO title",
        description: "Owner SEO description",
        imageUrl: "/owner-image.jpg",
      },
      ctaConfig: {
        primary: {
          label: "Owner CTA",
          kind: "message",
          value: "/direct-connect",
        },
      },
    };
    expect(isPrecisionAerialV1SystemSeed(customizedProfile, { profileSections: v1Sections })).toBe(
      false
    );
    const preserved = resolvePrecisionAerialProfileSeedFields(customizedProfile, {
      profileSections: v1Sections,
    });
    expect(preserved).toEqual(customizedProfile);

    expect(
      isPrecisionAerialV1SystemSeed(v1Profile, {
        profileSections: { ...v1Sections, reviews: true },
      })
    ).toBe(false);
    expect(
      isPrecisionAerialV1SystemSeed(
        {
          ...v1Profile,
          seoMeta: { ...v1Profile.seoMeta, title: "Admin SEO title" },
        },
        { profileSections: v1Sections }
      )
    ).toBe(false);
    expect(
      isPrecisionAerialV2SystemSeed(
        {
          ...v2Profile,
          contentBlocks: [
            ...PRECISION_AERIAL_V2_PROFILE_CONTENT_BLOCKS,
            { type: "custom", data: { body: "Admin-authored block" } },
          ],
        },
        { profileSections: v2Sections }
      )
    ).toBe(false);
  });

  it("fills missing Cameron palette defaults without overwriting profile data or color edits", () => {
    const freshProfile = resolvePrecisionAerialProfileSeedFields(null, {});
    expect(freshProfile.contentBlocks).toEqual(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS);
    expect(freshProfile.headline).toBe("Aerial photo, video, and FPV in Pensacola.");

    const freshBusiness = mergePrecisionAerialBusinessProfileData(null);
    expect(freshBusiness).toMatchObject({
      category: "Drone photo and video",
      tradePartner: false,
      brandColors: {
        primary: "#52c8f5",
        background: "#05070a",
        surface: "#101820",
      },
    });

    const merged = mergePrecisionAerialBusinessProfileData({
      category: "Owner category",
      tradePartner: true,
      ownerField: "keep-me",
      brandColors: {
        primary: "#123456",
        surface: "#222222",
      },
    });

    expect(merged).toMatchObject({
      category: "Owner category",
      tradePartner: true,
      ownerField: "keep-me",
      brandColors: {
        primary: "#123456",
        surface: "#222222",
        background: "#05070a",
        accent: "#9de6ff",
      },
    });
  });

  it("grants Direct Connect authority only for the exact slug, source, and owner match", () => {
    const valid = {
      profileSlug: PRECISION_AERIAL_PROFILE_SLUG,
      profileStatus: "published",
      profileOwnerUserId: "steward-user",
      businessStatus: "active",
      businessOwnerUserId: "steward-user",
      publicDiscoveryEnabled: false,
      businessSources: [ADMIN_MANAGED_PROFILE_SOURCE, ...PRECISION_AERIAL_PUBLIC_SOURCES],
      businessClaimStatus: "unclaimed",
      ownerProvider: PRECISION_AERIAL_STEWARD_PROVIDER,
      ownerPreferences: {
        internalProfileSteward: {
          profileSlug: PRECISION_AERIAL_PROFILE_SLUG,
          source: ADMIN_MANAGED_PROFILE_SOURCE,
        },
      },
    };

    expect(isOwnerConfirmedDirectProfile(valid)).toBe(true);
    expect(hasTradeScoutPendingOwnerCustody(valid)).toBe(true);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        profileSlug: "another-drone-profile",
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        businessOwnerUserId: "someone-else",
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        businessSources: [...PRECISION_AERIAL_PUBLIC_SOURCES],
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        publicDiscoveryEnabled: true,
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        businessClaimStatus: "claimed",
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        ownerProvider: "google",
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        ownerPreferences: {},
      })
    ).toBe(false);
  });

  it("runs through the non-fatal startup wrapper and uses first-party media without an embed", () => {
    const entry = read("server/index.ts");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const profile = read("client/src/pages/profile-sites/PrecisionAerialProfile.tsx");

    expect(entry).toContain(
      'import { provisionPrecisionAerialProfile } from "./services/precisionAerialProfileProvisioning"'
    );
    expect(entry).toContain(
      'await provisionProfile("Precision Aerial", provisionPrecisionAerialProfile)'
    );
    expect(entry).not.toMatch(/await provisionPrecisionAerialProfile\(\);/);
    expect(entry).toContain('"https://www.instagram.com"');
    expect(entry).toContain('"media-src": [');
    expect(entry).toContain('"https://www.thetradescout.com"');
    expect(profileView).toContain(
      'import PrecisionAerialProfile from "@/pages/profile-sites/PrecisionAerialProfile"'
    );
    expect(profileView).toContain(
      'import { PRECISION_AERIAL_PROFILE_SLUG } from "@shared/precisionAerialProfile"'
    );
    expect(profileView).toContain("if (profile.slug === PRECISION_AERIAL_PROFILE_SLUG)");
    expect(profileView).toContain("<PrecisionAerialProfile");
    expect(profileView).toContain("onDirectConnect={openServiceDirectConnect}");
    expect(profileView).toContain(
      "deliveryCustody={business?.expressContactCapabilities?.deliveryCustody}"
    );
    expect(profileView).toContain("stayInProfile");
    expect(profile).toContain("safeFeaturedWorkUrl");
    expect(profile).toContain("href={featuredWorkUrl}");
    expect(profile).toContain("precision-aerial-hero-video");
    expect(profile).not.toContain("<iframe");
    for (const asset of [
      "/images/profiles/precision-aerial/real-estate-aerial-01.jpg",
      "/images/profiles/precision-aerial/hero-reel.mp4",
      "/images/profiles/precision-aerial/hero-reel-poster.jpg",
    ]) {
      expect(resolveProfilePublicMediaObjectKey(asset)).toBe(`public-media${asset}`);
      expect(fs.existsSync(path.resolve(process.cwd(), `client/public${asset}`))).toBe(false);
    }
  });

  it("preserves custody routing without exposing it as public-profile copy", () => {
    const expressRoute = read("server/routes/tradepartner-express.ts");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
    const publicRoute = read("server/routes/profiles.ts");

    expect(expressRoute).toContain('deliveryCustody: "business" | "tradescout_pending_owner"');
    expect(expressRoute).toContain('delivered: target.deliveryCustody === "business"');
    expect(expressRoute).toContain("TradeScout received your request for ${target.businessName}");
    expect(panel).not.toContain("TradeScout is receiving requests for");
    expect(panel).not.toContain("The owner has not connected this profile yet.");
    expect(read("client/src/pages/profile-sites/PrecisionAerialProfile.tsx")).not.toContain(
      "TradeScout securely holds requests until this business connects its profile."
    );
    expect(publicRoute).toContain("deliveryCustody: directConnectDeliveryCustody");
  });
});
