export const STONE_CORE_SCHEMA_VERSION = 1;

export const STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG = "red-graniti";
export const STONE_CORE_JW_STONE_DISTRIBUTOR_PROFILE_SLUG = "jw-stone";

export type StoneCoreMaterialSeed = {
  slug: string;
  canonicalName: string;
  materialClass: "natural_stone";
  materialFamily: "granite" | "marble" | "labradorite";
  sourceProfileSlug: string;
  sourceUrl: string;
  primaryImageUrl: string;
  quarryCountry: string;
  quarryRegion?: string;
  summary: string;
};

/**
 * Canonical source-material records. These are not profile inventory and do
 * not claim that a block, bundle, or slab is physically available at JW Stone.
 */
export const STONE_CORE_RED_GRANITI_MATERIALS = [
  {
    slug: "lemurian-blue",
    canonicalName: "Lemurian® Blue",
    materialClass: "natural_stone",
    materialFamily: "labradorite",
    sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    sourceUrl: "https://www.redgraniti.com/en/portfolio/lemurian-blue/",
    primaryImageUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/lemurian-blue-1.jpg",
    quarryCountry: "Madagascar",
    summary:
      "Madagascar labradorite tied to R.E.D. Graniti's official source record.",
  },
  {
    slug: "virginia-mist",
    canonicalName: "Virginia Mist",
    materialClass: "natural_stone",
    materialFamily: "granite",
    sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    sourceUrl: "https://www.redgraniti.com/en/portfolio/virginia-mist/",
    primaryImageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/01-24.jpg",
    quarryCountry: "United States",
    quarryRegion: "Virginia",
    summary:
      "Black granite tied to R.E.D. Graniti's official Virginia source record.",
  },
  {
    slug: "nero-zimbabwe",
    canonicalName: "Nero Zimbabwe",
    materialClass: "natural_stone",
    materialFamily: "granite",
    sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    sourceUrl: "https://www.redgraniti.com/en/portfolio/nero-zimbabwe/",
    primaryImageUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/nero-zimbabwe.jpg",
    quarryCountry: "Zimbabwe",
    summary:
      "Black granite tied to R.E.D. Graniti's official Zimbabwe source record.",
  },
  {
    slug: "nero-africa-rustenburg",
    canonicalName: "Nero Africa / Rustenburg",
    materialClass: "natural_stone",
    materialFamily: "granite",
    sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    sourceUrl: "https://www.redgraniti.com/en/portfolio/nero-africa-rustenburg/",
    primaryImageUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/nero-africa-1.jpg",
    quarryCountry: "South Africa",
    quarryRegion: "Rustenburg",
    summary:
      "Black granite tied to R.E.D. Graniti's official South Africa source record.",
  },
  {
    slug: "giallo-veneziano",
    canonicalName: "Giallo Veneziano",
    materialClass: "natural_stone",
    materialFamily: "granite",
    sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    sourceUrl: "https://www.redgraniti.com/en/portfolio/giallo-veneziano/",
    primaryImageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/01-27.jpg",
    quarryCountry: "Brazil",
    quarryRegion: "Nova Venécia",
    summary:
      "Yellow granite tied to R.E.D. Graniti's official Brazil source record.",
  },
  {
    slug: "giallo-duna",
    canonicalName: "Giallo Duna",
    materialClass: "natural_stone",
    materialFamily: "granite",
    sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    sourceUrl: "https://www.redgraniti.com/en/portfolio/giallo-duna/",
    primaryImageUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/giallo-duna-1.jpg",
    quarryCountry: "Namibia",
    summary:
      "Yellow granite tied to R.E.D. Graniti's official Namibia source record.",
  },
  {
    slug: "duna-red-rosso-duna",
    canonicalName: "Duna Red / Rosso Duna",
    materialClass: "natural_stone",
    materialFamily: "granite",
    sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    sourceUrl: "https://www.redgraniti.com/en/portfolio/duna-red-rosso-duna/",
    primaryImageUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/duna-red-rosso-duna.jpg",
    quarryCountry: "Namibia",
    summary:
      "Red granite tied to R.E.D. Graniti's official Namibia source record.",
  },
  {
    slug: "eureka-danby-calacatta-danby",
    canonicalName: "Eureka Danby / Calacatta Danby",
    materialClass: "natural_stone",
    materialFamily: "marble",
    sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    sourceUrl: "https://www.redgraniti.com/en/portfolio/eureka-danbycalacatta-danby/",
    primaryImageUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/eureka-danby-1.jpg",
    quarryCountry: "United States",
    quarryRegion: "Vermont",
    summary:
      "Danby marble tied to R.E.D. Graniti's official Vermont source record.",
  },
  {
    slug: "imperial-danby",
    canonicalName: "Imperial Danby",
    materialClass: "natural_stone",
    materialFamily: "marble",
    sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    sourceUrl: "https://www.redgraniti.com/en/portfolio/imperial-danby/",
    primaryImageUrl:
      "https://www.redgraniti.com/wp-content/uploads/2018/06/imperial-danby-1.jpg",
    quarryCountry: "United States",
    quarryRegion: "Vermont",
    summary:
      "Danby marble tied to R.E.D. Graniti's official Vermont source record.",
  },
] as const satisfies readonly StoneCoreMaterialSeed[];

/** The relationship is its own record, separate from both company profiles. */
export const STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT = {
  sourceProfileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
  distributorProfileSlug: STONE_CORE_JW_STONE_DISTRIBUTOR_PROFILE_SLUG,
  rightType: "distribution",
  scope: "first_cut",
  exclusivity: "exclusive",
  territoryStatus: "not_publicly_specified",
  relationshipStatus: "active",
  evidenceType: "operator_confirmed",
} as const;

/**
 * Authorized views of the canonical material records. Neither view is an
 * inventory position, and neither is marked published until a dedicated view
 * actually exists.
 */
export const STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS = [
  {
    profileSlug: STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
    channel: "source_company",
    publicationRole: "source_reference",
    visibility: "public",
    publicationStatus: "authorized_not_published",
    inventoryClaim: "none",
  },
  {
    profileSlug: STONE_CORE_JW_STONE_DISTRIBUTOR_PROFILE_SLUG,
    channel: "authorized_distributor",
    publicationRole: "exclusive_first_cut",
    visibility: "public",
    publicationStatus: "authorized_not_published",
    inventoryClaim: "none",
  },
] as const;
