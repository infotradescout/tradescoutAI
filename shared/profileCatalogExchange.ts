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
    "Browse JW Stone material photography, including selections whose identity is still being confirmed, then ask through TradeScout about your project.",
  profilePath: "/u/jw-stone",
  catalogPath: "/u/jw-stone#inventory-browser",
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
  actionLabel: "View materials and ask",
} as const);

/**
 * Curated, request-only profile catalogs that Exchange may spotlight.
 *
 * These are discovery records, not marketplace listings. They intentionally
 * carry no transaction, inventory, fulfillment, or direct-contact fields.
 */
export const PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS = Object.freeze([
  jwStoneSpotlight,
  issaBuildSpotlight,
] as const);

export type ProfileCatalogExchangeSpotlight = (typeof PROFILE_CATALOG_EXCHANGE_SPOTLIGHTS)[number];
