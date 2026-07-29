/** Canonical public profile identity for Cameron's Pensacola drone work. */
export const PRECISION_AERIAL_PROFILE_SLUG = "precision-aerial-services";
export const PRECISION_AERIAL_BUSINESS_NAME = "Precision Aerial Services";
export const PRECISION_AERIAL_STEWARD_PROVIDER = "admin_provisioned_profile_steward";

/** First-party public accounts supplied by the operator through TradeScout. */
export const PRECISION_AERIAL_PUBLIC_SOURCES = [
  "https://www.instagram.com/precisionaerialservice/",
  "https://www.instagram.com/reel/DWRwdNLEcDF/",
  "https://www.tiktok.com/@chillshots",
] as const;

/**
 * Keep this profile plain and media-first. Public service wording is limited
 * to work demonstrated by the supplied accounts; it does not imply inspection,
 * survey, mapping, thermal, fleet, insurance, or certification verification.
 */
export const PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS = [
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
