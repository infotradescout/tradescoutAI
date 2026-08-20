/** Canonical public profile identity for Cameron's Pensacola drone work. */
export const PRECISION_AERIAL_PROFILE_SLUG = "precision-aerial-services";
export const PRECISION_AERIAL_BUSINESS_NAME = "Precision Aerial Services";
export const PRECISION_AERIAL_STEWARD_PROVIDER = "admin_provisioned_profile_steward";
export const PRECISION_AERIAL_PUBLIC_HEADLINE = "Aerial photo, video, and FPV in Pensacola.";
export const PRECISION_AERIAL_PUBLIC_SEO_DESCRIPTION =
  "Aerial media for real estate, construction progress, land and property, and FPV projects. Start a request through TradeScout.";

/** First-party public accounts supplied by the operator through TradeScout. */
export const PRECISION_AERIAL_PUBLIC_SOURCES = [
  "https://www.instagram.com/precisionaerialservice/",
  "https://www.instagram.com/p/DWHQtuPkUv0/",
  "https://www.instagram.com/reel/DWRwdNLEcDF/",
  "https://www.tiktok.com/@chillshots",
] as const;

/** First-party post provenance for the two locally hosted carousel images. */
export const PRECISION_AERIAL_MEDIA_SOURCES = [
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
] as const;

/**
 * Immutable migration sentinel for the exact v1 system-authored profile that
 * shipped before the premium default. Do not broaden or update this shape:
 * any difference means an admin or owner may have edited the profile and the
 * startup provisioner must preserve it.
 */
export const PRECISION_AERIAL_V1_PROFILE_CONTENT_BLOCKS = [
  {
    type: "siteTemplate",
    data: { id: "videographer" },
  },
  {
    type: "about",
    data: {
      text: "Cameron shoots aerial photo and video for real estate, construction progress, roofs, land, vehicles, boats, and events around Pensacola.",
    },
  },
  {
    type: "hero",
    data: {
      title: "A better view.",
      text: "Drone photo and video.",
      operatorName: "Cameron",
      locationLabel: "Pensacola, Florida",
      featuredWorkUrl: "https://www.instagram.com/reel/DWRwdNLEcDF/",
      instagramUrl: "https://www.instagram.com/precisionaerialservice/",
      instagramHandle: "@PrecisionAerialService",
      tiktokUrl: "https://www.tiktok.com/@chillshots",
      tiktokHandle: "@chillshots",
    },
  },
  {
    type: "services",
    data: {
      items: [
        "Real estate aerial photo and video",
        "Construction progress photos",
        "Roof and property imagery",
        "Land and farm aerials",
        "Boats, vehicles, and events",
      ],
    },
  },
] as const;

/**
 * Immutable migration sentinel for the exact default-profile seed currently
 * serving in production. Any difference means an admin or owner may have
 * edited the profile and the startup provisioner must preserve it.
 */
export const PRECISION_AERIAL_V2_PROFILE_CONTENT_BLOCKS = [
  {
    type: "siteTemplate",
    data: { id: "default" },
  },
  {
    type: "profileSections",
    data: {
      sections: {
        about: true,
        rolesAndBadges: false,
        stats: false,
        services: true,
        marketplaceListings: false,
        reviews: false,
        communityActivity: false,
        contactCard: true,
      },
    },
  },
  {
    type: "about",
    data: {
      text: "Cameron shoots aerial photo and video for real estate, construction progress, roofs, land, vehicles, boats, and events around Pensacola.",
    },
  },
  {
    type: "hero",
    data: {
      title: "A better view.",
      text: "Drone photo and video.",
      operatorName: "Cameron",
      locationLabel: "Pensacola, Florida",
      logoUrl: "/images/profiles/precision-aerial/logo.jpg",
      imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-01.jpg",
      imageAlt: "Aerial view of a residential property photographed by Precision Aerial Services",
      imageSourceUrl: "https://www.instagram.com/p/DWHQtuPkUv0/",
      featuredWorkUrl: "https://www.instagram.com/reel/DWRwdNLEcDF/",
      instagramUrl: "https://www.instagram.com/precisionaerialservice/",
      instagramHandle: "@PrecisionAerialService",
      tiktokUrl: "https://www.tiktok.com/@chillshots",
      tiktokHandle: "@chillshots",
    },
  },
  {
    type: "services",
    data: {
      items: [
        "Real estate aerial photo and video",
        "Construction progress photos",
        "Roof and property imagery",
        "Land and farm aerials",
        "Boats, vehicles, and events",
      ],
    },
  },
  {
    type: "gallery",
    data: {
      title: "Pensacola real estate aerials",
      description: "Aerial property imagery shared by Precision Aerial Services.",
      images: [
        {
          id: "pensacola-real-estate-aerial-wide",
          imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-01.jpg",
          title: "Property overview",
          alt: "Wide aerial overview of a Pensacola residential property",
          description: "A wide property view captured from the air.",
          sourceUrl: "https://www.instagram.com/p/DWHQtuPkUv0/",
        },
        {
          id: "pensacola-real-estate-aerial-close",
          imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-02.jpg",
          title: "Closer property view",
          alt: "Closer aerial view of a Pensacola residential property",
          description: "A closer aerial angle showing the buildings and surrounding property.",
          sourceUrl: "https://www.instagram.com/p/DWHQtuPkUv0/",
        },
      ],
    },
  },
] as const;

/** Exact pre-social-research seed retained only for safe one-time migration. */
export const PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS =
  PRECISION_AERIAL_V2_PROFILE_CONTENT_BLOCKS.map((block) =>
    block.type === "hero"
      ? {
          ...block,
          data: {
            ...block.data,
            presentationVariant: "first-deliverable",
          },
        }
      : block
  );

/**
 * Current source-backed profile. Cameron's public accounts show real estate,
 * construction, land, aerial-photo, video, and FPV work. Thomas confirmed on
 * 2026-07-29 that FPV is currently available and thermal imaging is upcoming.
 * Credential wording remains excluded until an authoritative record is confirmed.
 */
export const PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS =
  PRECISION_AERIAL_V3_PROFILE_CONTENT_BLOCKS.map((block) => {
    if (block.type === "about") {
      return {
        ...block,
        data: {
          ...block.data,
          text: "Cameron creates aerial photo, traditional drone video, and FPV work for real estate, construction progress, and land or site documentation in the Pensacola area.",
        },
      };
    }
    if (block.type === "hero") {
      return {
        ...block,
        data: {
          ...block.data,
          text: "Aerial photo, video, and FPV for real estate, construction, and land.",
          upcomingService: "Thermal imaging",
          videoUrl: "/images/profiles/precision-aerial/hero-reel.mp4",
          videoPosterUrl: "/images/profiles/precision-aerial/hero-reel-poster.jpg",
          videoSourceUrl: "https://www.instagram.com/reel/DWRwdNLEcDF/",
        },
      };
    }
    if (block.type === "services") {
      return {
        ...block,
        data: {
          ...block.data,
          items: [
            "Real estate aerial photo and video",
            "Construction progress imagery",
            "Land and site aerials",
            "FPV drone video",
          ],
        },
      };
    }
    return block;
  });
