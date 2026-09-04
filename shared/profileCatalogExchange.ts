export const PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE = "profile_catalog" as const;
export const PROFILE_CATALOG_EXCHANGE_CATEGORY = "building-materials" as const;

const jwStoneSpotlight = Object.freeze({
  id: "profile-catalog-jw-stone",
  sourceType: PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
  category: PROFILE_CATALOG_EXCHANGE_CATEGORY,
  businessName: "JW Stone LLC",
  profileSlug: "jw-stone",
  commerceMode: "request_only",
  catalogKind: "material_catalog",
  title: "Natural stone from JW Stone LLC",
  description:
    "Browse the maintained JW Stone material catalog, including selections whose source identity remains clearly labeled for confirmation, then ask through TradeScout about your project.",
  profilePath: "/u/jw-stone",
  catalogPath: "/u/jw-stone#inventory-browser",
  imagePath:
    "/images/businesses/jw-stone/inventory-source/1ZcGVAg76xGKbQ1l9v7kO64Qqf-Nt-U74.webp",
  actionLabel: "View materials and ask",
} as const);

const issaBuildSpotlight = Object.freeze({
  id: "profile-catalog-issa-build",
  sourceType: PROFILE_CATALOG_EXCHANGE_SOURCE_TYPE,
  category: PROFILE_CATALOG_EXCHANGE_CATEGORY,
  businessName: "ISSA Build",
  profileSlug: "issa-build",
  commerceMode: "request_only",
  catalogKind: "material_showcase",
  title: "Honey Onyx and Multi Green Onyx by ISSA Build",
  description:
    "View owner-supplied material and installed-project photography, then ask through TradeScout about a custom residential or commercial project.",
  profilePath: "/u/issa-build",
  catalogPath: "/u/issa-build#material-chapters",
  imagePath: "/images/businesses/issa-build/video/hero-poster.jpg",
  actionLabel: "View materials and ask",
} as const);

/**
 * Curated discovery records, not marketplace inventory or offers. Material
 * detail remains authoritative on the maintained business profile.
 */
export const PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS = Object.freeze([
  jwStoneSpotlight,
  issaBuildSpotlight,
] as const);

export type ProfileCatalogExchangeSpotlight = (typeof PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS)[number];
