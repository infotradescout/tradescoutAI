export const STEEL_HOME_PACKAGES_PROFILE_IDENTITY = {
  internalKey: "steel-home-packages",
  temporarySlug: "steel-home-packages",
  slug: "steel-home-packages",
  displayLabel: "Steel Home Planning Tools",
  publicRoute: "/u/steel-home-packages",
  releaseState: "unlisted",
  publiclyReleased: false,
} as const;

export const STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE =
  "operator_approved_unlisted_profile" as const;

export const STEEL_HOME_PACKAGES_REQUEST_SOURCE = "steel_home_planning_tools" as const;
export const STEEL_HOME_PACKAGES_LABOR_REQUEST_SOURCE = "steel_home_planning_tools_labor" as const;

const STEEL_HOME_PROJECT_REQUEST_FALLBACK = [
  "Steel Home Builder Request",
  "Builder:",
  "Project location:",
  "Contracting setup:",
  "Desired timing:",
  "Questions or additional details:",
].join("\n");

const STEEL_HOME_LABOR_REQUEST_FALLBACK = [
  "Steel Home Local Trade Request",
  "Project location:",
  "Work needed:",
  "Related project plans:",
  "Desired timing:",
  "Additional details:",
].join("\n");

/**
 * Canonical TradeScout-owned builder handoff. The active builder replaces the
 * fallback title and description with only that builder's saved design.
 */
export const STEEL_HOME_PACKAGES_START_REQUEST_PATH =
  `/direct-connect?profile=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug)}` +
  `&profileName=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel)}` +
  `&source=${STEEL_HOME_PACKAGES_REQUEST_SOURCE}` +
  "&subject=product" +
  `&title=${encodeURIComponent("Steel home builder request")}` +
  `&description=${encodeURIComponent(STEEL_HOME_PROJECT_REQUEST_FALLBACK)}`;

/**
 * Local labor stays untargeted so Direct Connect can match by the real jobsite
 * and requested trades. The saved design context is added by the project tools.
 */
export const STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH =
  `/direct-connect?source=${STEEL_HOME_PACKAGES_LABOR_REQUEST_SOURCE}` +
  "&subject=service" +
  `&title=${encodeURIComponent("Steel home local trade request")}` +
  `&description=${encodeURIComponent(STEEL_HOME_LABOR_REQUEST_FALLBACK)}`;

const STEEL_HOME_PROJECT_TOOL_CARDS = [
  {
    key: "countertops",
    label: "Countertops",
    title: "Countertop Builder",
    body: "Choose real Quartzite, Engineered Quartz, Granite, and other surfaces, then plan the runs and gross countertop layout footprint. Backsplash and range-gap deductions are excluded until field measurement. Stone ordering and countertop fabrication are separate.",
    image: "/images/stone-designer/cristallo/1.webp",
    imageAlt: "Cristallo quartzite surface",
    action: "Open Countertop Builder",
  },
  {
    key: "cabinets",
    label: "Cabinets",
    title: "Cabinet Builder",
    body: "Fit the room, appliances, storage, island, door style, and finish into one working cabinet layout.",
    image: "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
    imageAlt: "Warm kitchen cabinet design inspiration with an island",
    action: "Open Cabinet Builder",
  },
  {
    key: "building",
    label: "Metal Buildings",
    title: "Metal Building Builder",
    body: "Set the footprint, height, roof, openings, porch, and colors while the building and early estimate update.",
    image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
    imageAlt: "Metal building exterior preview with a dark metal roof",
    action: "Open Metal Building Builder",
  },
] as const;

export const STEEL_HOME_PACKAGES_PROFILE_CONTENT = {
  version: 14,
  header: {
    label: "Steel Home Planning Tools",
    navigation: [
      { key: "countertops", label: "Countertops" },
      { key: "cabinets", label: "Cabinets" },
      { key: "building", label: "Metal Buildings" },
    ],
  },
  hero: {
    eyebrow: "For self-contracted homeowners, builders, and contractors",
    headline: "Choose the builder you need.",
    body: "Countertops, Cabinets, and Metal Buildings are three stand-alone builders. Open any one without starting or completing another.",
    primaryAction: "Start a Request",
    visuals: STEEL_HOME_PROJECT_TOOL_CARDS.map((tool) => ({
      key: tool.key,
      label: tool.label,
      title: tool.title,
      image: tool.image,
      imageAlt: tool.imageAlt,
    })),
  },
  tools: {
    cards: STEEL_HOME_PROJECT_TOOL_CARDS,
    countertops: {
      eyebrow: "Countertop Builder",
      title: "Build the layout and estimate its gross countertop footprint.",
      body: "Choose Quartzite, Engineered Quartz, or another catalog surface from real photos and plan the approximate area. Stone selection and ordering cover material supply only. TradeScout and the stone supplier do not template, fabricate, finish, or install countertops; those services require a separate independent fabricator.",
    },
    cabinets: {
      eyebrow: "Cabinet Builder",
      title: "Fit the cabinets and see an early estimate.",
      body: "Every room, layout, size, storage, island, door, finish, and hardware choice updates the live cabinet result.",
    },
    building: {
      eyebrow: "Metal Building Builder",
      title: "Shape the building and see an early estimate.",
      body: "Every size, use, roof, opening, porch, and color choice updates the building or its early estimate.",
    },
  },
  disclosure:
    "Countertop-top area is approximate, excludes backsplash, and is not a price or final template. Stone ordering and countertop fabrication are separate. TradeScout and the stone supplier do not template, fabricate, finish, or install countertops; those services require a separate independent fabricator. Cabinet and metal-building early price estimates are not quotes and exclude tax, site work, foundations, and installation unless stated otherwise.",
} as const;

export const STEEL_HOME_PACKAGES_PROFILE_CONTENT_BLOCKS = [
  {
    type: "profileSections",
    data: {
      sections: {
        about: false,
        rolesAndBadges: false,
        stats: false,
        services: false,
        marketplaceListings: false,
        reviews: false,
        communityActivity: false,
        contactCard: false,
      },
    },
  },
  {
    type: "steelHomePackagesProfile",
    data: STEEL_HOME_PACKAGES_PROFILE_CONTENT,
  },
] as const;

export function isSteelHomePackagesProfileSlug(slug: unknown): boolean {
  return (
    String(slug || "")
      .trim()
      .toLowerCase() === STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug
  );
}

export function isSteelHomePackagesProfilePubliclyReleased(): boolean {
  return STEEL_HOME_PACKAGES_PROFILE_IDENTITY.publiclyReleased;
}
