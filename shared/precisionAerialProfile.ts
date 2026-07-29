/** Canonical public profile identity for Cameron's Pensacola drone work. */
export const PRECISION_AERIAL_PROFILE_SLUG = "precision-aerial-services";
export const PRECISION_AERIAL_BUSINESS_NAME = "Precision Aerial Services";
export const PRECISION_AERIAL_STEWARD_PROVIDER = "admin_provisioned_profile_steward";

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

/**
 * Cameron's isolated first-deliverable candidate. Public service wording is
 * limited to work demonstrated by the supplied accounts; it does not imply
 * inspection, survey, mapping, thermal, fleet, insurance, or certification
 * verification. The presentation flag is generic profile data, not a slug
 * branch, so the candidate can be reviewed without changing every default
 * profile.
 */
export const PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS =
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
