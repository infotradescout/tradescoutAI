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
    number: "01",
    label: "Countertops",
    title: "Countertop Planner & Area Estimator",
    body: "Choose Quartzite, Engineered Quartz, or another available surface from the photos, enter the room layout and cutouts, and see the approximate countertop area. Pricing is marked Quote needed.",
    image: "/images/stone-designer/cristallo/1.webp",
    imageAlt: "Cristallo quartzite surface",
    action: "Open Countertop Planner",
  },
  {
    key: "cabinets",
    number: "02",
    label: "Cabinets",
    title: "Cabinet Planner & Estimator",
    body: "Plan the room measurements, appliances, storage, island, cabinet style, and finish. The preview and early price estimate update with your choices.",
    image: "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
    imageAlt: "Warm kitchen cabinet design inspiration with an island",
    action: "Open Cabinet Planner",
  },
  {
    key: "building",
    number: "03",
    label: "Metal Buildings",
    title: "Metal Building Planner & Estimator",
    body: "Plan the metal building size, roof, openings, porch, and exterior colors. The preview and early price estimate update with your choices.",
    image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
    imageAlt: "Metal building exterior preview with a dark metal roof",
    action: "Open Metal Building Planner",
  },
] as const;

export const STEEL_HOME_PACKAGES_PROFILE_CONTENT = {
  version: 11,
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
    body: "Use three separate tools: start with Countertops, then use Cabinets or Metal Buildings when you need them. Countertops show approximate area and mark pricing Quote needed. Cabinets and Metal Buildings show early price estimates.",
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
      title: "Plan the countertops and estimate the area.",
      body: "Choose Quartzite, Engineered Quartz, or another available surface from real photos, enter the room layout and cutouts, and see the approximate area. Pricing is marked Quote needed.",
    },
    cabinets: {
      eyebrow: "Cabinet Planner",
      title: "Plan the cabinets and see an early estimate.",
      body: "Enter the room measurements, cabinet sizes, appliances, storage, island, cabinet style, and finish. The preview and early price estimate update as you work.",
    },
    building: {
      eyebrow: "Metal Building Planner",
      title: "Plan the metal building and see an early estimate.",
      body: "Enter the size, roof, openings, porch, and colors. The preview and early price estimate update as you work.",
    },
  },
  disclosure:
    "Early price estimates are not quotes. They exclude tax, site work, foundations, and installation unless stated otherwise. Final pricing depends on measurements, engineering, permits, product availability, delivery, fabrication, and installation.",
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
