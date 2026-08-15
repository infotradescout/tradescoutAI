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
  "Steel Home Planner Request",
  "Planner:",
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
 * Canonical TradeScout-owned planner handoff. The active planner replaces the
 * fallback title and description with only that planner's saved design.
 */
export const STEEL_HOME_PACKAGES_START_REQUEST_PATH =
  `/direct-connect?profile=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug)}` +
  `&profileName=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel)}` +
  `&source=${STEEL_HOME_PACKAGES_REQUEST_SOURCE}` +
  "&subject=product" +
  `&title=${encodeURIComponent("Steel home planner request")}` +
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
    title: "Countertop Planner",
    body: "Plan measured countertop runs, place fabrication openings, and apply a real JW Stone catalog photo in an orbitable room. Stone ordering and countertop fabrication stay separate.",
    image: "/images/stone-designer/cristallo/1.webp",
    imageAlt: "Cristallo quartzite surface",
    action: "Open Countertop Planner",
  },
  {
    key: "cabinets",
    label: "Cabinets",
    title: "Cabinet Planner",
    body: "Measure the room, place cabinets and appliance openings, check clearances, and review the same plan in measured elevations and an orbitable room.",
    image: "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
    imageAlt: "Warm kitchen cabinet design inspiration with an island",
    action: "Open Cabinet Planner",
  },
  {
    key: "building",
    label: "Metal Buildings",
    title: "Metal Building Planner",
    body: "Choose a sellable building direction, enter measured geometry, and place openings, attachments, colors, and accessories for professional review and quote.",
    image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
    imageAlt: "Metal building exterior preview with a dark metal roof",
    action: "Open Metal Building Planner",
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
    headline: "Choose the planner you need.",
    body: "Countertops, Cabinets, and Metal Buildings are three stand-alone planners. Open any one without starting or completing another.",
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
      eyebrow: "Countertop Planner",
      title: "Measure the layout and see the stone in the room.",
      body: "Choose Quartzite, Engineered Quartz, or another catalog surface from real photos and plan the approximate area. Stone selection and ordering cover material supply only. TradeScout and the stone supplier do not template, fabricate, finish, or install countertops; those services require a separate independent fabricator.",
    },
    cabinets: {
      eyebrow: "Cabinet Planner",
      title: "Fit the room and prepare a cabinet scope for quote.",
      body: "Room measurements, fixed features, placed modules, islands, and appearance preferences update one measured cabinet scene. Final products and price require a quote.",
    },
    building: {
      eyebrow: "Metal Building Planner",
      title: "Shape a sellable building concept for professional review.",
      body: "Use, structure, roof, measurements, placed openings, attachments, colors, and accessories update one measured planning scene. Engineering, availability, and price require a quote.",
    },
  },
  disclosure:
    "Countertop area remains a planning measurement, not a final field template. Stone ordering and countertop fabrication are separate. TradeScout and the stone supplier do not template, fabricate, finish, or install countertops; those services require a separate independent fabricator. Cabinet and metal-building products, engineering, availability, delivery, installation, and price require professional review and a quote.",
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
