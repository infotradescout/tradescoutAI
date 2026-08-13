export const STEEL_HOME_PACKAGES_PROFILE_IDENTITY = {
  internalKey: "steel-home-packages",
  temporarySlug: "steel-home-packages",
  slug: "steel-home-packages",
  displayLabel: "Steel Home Project Workspace",
  publicRoute: "/u/steel-home-packages",
  releaseState: "unlisted",
  publiclyReleased: false,
} as const;

export const STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE =
  "operator_approved_unlisted_profile" as const;

const STEEL_HOME_PROJECT_REQUEST_FALLBACK = [
  "Steel Home Package Request",
  "Project location:",
  "Contracting setup:",
  "Packages and home needs requested:",
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
 * Canonical TradeScout-owned project handoff. The interactive project tools
 * replace the fallback title and description with the customer's saved design.
 */
export const STEEL_HOME_PACKAGES_START_REQUEST_PATH =
  `/direct-connect?profile=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug)}` +
  `&profileName=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel)}` +
  "&source=steel_home_project_center" +
  "&subject=product" +
  `&title=${encodeURIComponent("Steel home package request")}` +
  `&description=${encodeURIComponent(STEEL_HOME_PROJECT_REQUEST_FALLBACK)}`;

/**
 * Local labor stays untargeted so Direct Connect can match by the real jobsite
 * and requested trades. The saved design context is added by the project tools.
 */
export const STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH =
  "/direct-connect?source=steel_home_project_tools_labor" +
  "&subject=service" +
  `&title=${encodeURIComponent("Steel home local trade request")}` +
  `&description=${encodeURIComponent(STEEL_HOME_LABOR_REQUEST_FALLBACK)}`;

const STEEL_HOME_PROJECT_TOOL_CARDS = [
  {
    key: "building",
    number: "01",
    label: "Building + roof",
    title: "Building Package Planner",
    body: "Enter the building size, roof, openings, porch, and exterior colors. The preview and early materials estimate update with your choices.",
    image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
    imageAlt: "Steel building exterior preview with a dark metal roof",
    action: "Open building planner",
  },
  {
    key: "countertops",
    number: "02",
    label: "Countertops",
    title: "Countertop Planner",
    body: "Choose quartzite, engineered quartz, or another available surface from the photos, enter the room layout and cutouts, and see the approximate countertop area.",
    image: "/images/stone-designer/cristallo/1.webp",
    imageAlt: "Cristallo quartzite surface",
    action: "Open countertop planner",
  },
  {
    key: "cabinets",
    number: "03",
    label: "Cabinetry",
    title: "Cabinet Planner",
    body: "Enter the room measurements, appliances, storage, island, cabinet style, and finish. The preview shows how the plan fits the primary wall.",
    image: "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
    imageAlt: "Warm kitchen cabinet design inspiration with an island",
    action: "Open cabinet planner",
  },
] as const;

export const STEEL_HOME_PACKAGES_PROFILE_CONTENT = {
  version: 9,
  header: {
    label: "Steel Home Project Workspace",
    navigation: [
      { key: "project", label: "Project Setup" },
      { key: "building", label: "Building + Roof" },
      { key: "countertops", label: "Countertops" },
      { key: "cabinets", label: "Cabinets" },
      { key: "whole-home", label: "Whole Home" },
      { key: "review", label: "Summary & Request" },
    ],
  },
  hero: {
    eyebrow: "For self-contracted homeowners, builders, and contractors",
    headline: "Plan packages, compare estimates, and request quotes.",
    body: "Enter the building and roof, countertop, cabinet, and whole-home details. Building and cabinet estimates update as you work. Countertops and other items are marked for quotes.",
    primaryAction: "Start a Request",
    reviewAction: "Open project summary",
    visuals: STEEL_HOME_PROJECT_TOOL_CARDS.map((tool) => ({
      key: tool.key,
      label: tool.label,
      title: tool.title,
      image: tool.image,
      imageAlt: tool.imageAlt,
    })),
  },
  toolIntro: {
    eyebrow: "Project workspace",
    title: "Build one complete request.",
    body: "Work through each package, add the other parts of the home, and review everything together before sending it.",
  },
  projectStart: {
    eyebrow: "Project Setup",
    title: "Set up the project.",
    body: "Tell us who is managing the build, where the jobsite is, and when you want to start.",
  },
  additionalScopes: {
    eyebrow: "Whole Home",
    title: "Add the rest of the home.",
    body: "Select the plans, materials, equipment, site work, utilities, and local trade help you still need. Items without a current estimate are marked Quote needed.",
  },
  tools: {
    cards: STEEL_HOME_PROJECT_TOOL_CARDS,
    building: {
      eyebrow: "Building + Roof",
      title: "Plan the building package.",
      body: "Enter the size, roof, openings, porch, and colors. The preview and early materials estimate update as you work.",
    },
    countertops: {
      eyebrow: "Countertops",
      title: "Plan the countertops and choose a surface.",
      body: "Choose quartzite, engineered quartz, or another available surface from real photos, enter the room layout and cutouts, and see the approximate area.",
    },
    cabinets: {
      eyebrow: "Cabinets",
      title: "Plan the main cabinet wall.",
      body: "Enter the room measurements, cabinet sizes, appliances, storage, island, cabinet style, and finish. The preview and early materials estimate update as you work.",
    },
  },
  review: {
    eyebrow: "Summary & Request",
    title: "Check everything before you send it.",
    body: "Review the contracting setup, jobsite, selected packages, home needs, estimates, and quotes still needed.",
  },
  labor: {
    eyebrow: "Local Trade Help",
    title: "Request the work needed at the jobsite.",
    body: "Select the work you need and send it with the project details and jobsite location.",
  },
  disclosure:
    "Early materials estimates are not quotes. They exclude tax, site work, foundations, and installation unless stated otherwise. Final pricing depends on measurements, engineering, permits, product availability, delivery, fabrication, and installation.",
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
