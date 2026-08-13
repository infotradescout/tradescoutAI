export const STEEL_HOME_PACKAGES_PROFILE_IDENTITY = {
  internalKey: "steel-home-packages",
  temporarySlug: "steel-home-packages",
  slug: "steel-home-packages",
  displayLabel: "Steel Home Project Center",
  publicRoute: "/u/steel-home-packages",
  releaseState: "unlisted",
  publiclyReleased: false,
} as const;

export const STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE =
  "operator_approved_unlisted_profile" as const;

const STEEL_HOME_PROJECT_REQUEST_FALLBACK = [
  "TradeScout steel-home project review",
  "Project location:",
  "How I am building:",
  "Building, stone, cabinet, or whole-home scopes selected:",
  "Desired timing:",
  "Questions or additional details:",
].join("\n");

const STEEL_HOME_LABOR_REQUEST_FALLBACK = [
  "TradeScout steel-home local labor request",
  "Project location:",
  "Labor needed:",
  "Related building, countertop, or cabinet design:",
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
  `&title=${encodeURIComponent("Steel-home project review")}` +
  `&description=${encodeURIComponent(STEEL_HOME_PROJECT_REQUEST_FALLBACK)}`;

/**
 * Local labor stays untargeted so Direct Connect can match by the real jobsite
 * and requested trades. The saved design context is added by the project tools.
 */
export const STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH =
  "/direct-connect?source=steel_home_project_tools_labor" +
  "&subject=service" +
  `&title=${encodeURIComponent("Steel-home local labor request")}` +
  `&description=${encodeURIComponent(STEEL_HOME_LABOR_REQUEST_FALLBACK)}`;

const STEEL_HOME_PROJECT_TOOL_CARDS = [
  {
    key: "building",
    number: "01",
    label: "Metal structure",
    title: "Building designer",
    body: "Set the building dimensions, roof, openings, porch, and exterior colors while the concept updates on screen.",
    image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
    imageAlt: "Steel building exterior concept with a dark metal roof",
    action: "Design the building",
  },
  {
    key: "countertops",
    number: "02",
    label: "Stone + quartz",
    title: "Countertop designer",
    body: "Choose a photographed stone or quartz surface, map the countertop shape, add measurements and cutouts, and see the planning area.",
    image: "/images/stone-designer/cristallo/1.webp",
    imageAlt: "Cristallo natural stone photographed for material selection",
    action: "Design the countertops",
  },
  {
    key: "cabinets",
    number: "03",
    label: "Cabinetry",
    title: "Cabinet designer",
    body: "Plan the main cabinet wall, appliances, storage modules, island, style direction, and finish in one elevation.",
    image: "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
    imageAlt: "Warm kitchen cabinet design inspiration with an island",
    action: "Design the cabinets",
  },
] as const;

export const STEEL_HOME_PACKAGES_PROFILE_CONTENT = {
  version: 7,
  header: {
    label: "Steel Home Project Center",
    navigation: [
      { label: "Start", href: "#project-start" },
      { label: "Building + roof", href: "#building-designer" },
      { label: "Stone + quartz", href: "#countertop-designer" },
      { label: "Cabinets", href: "#cabinet-designer" },
      { label: "My plan", href: "#project-review" },
    ],
  },
  hero: {
    eyebrow: "For owner-builders, builders, and contractors",
    headline: "Shape the project before anyone starts guessing.",
    body: "Design the steel building and included roof, plan the cabinets and photographed stone or quartz, add the rest of the home scope, and bring one clear plan to TradeScout for pricing and local review.",
    primaryAction: "Start a Request",
    reviewAction: "Review my plan",
    visuals: STEEL_HOME_PROJECT_TOOL_CARDS.map((tool) => ({
      key: tool.key,
      label: tool.label,
      title: tool.title,
      image: tool.image,
      imageAlt: tool.imageAlt,
    })),
  },
  toolIntro: {
    eyebrow: "Design the project",
    title: "Work through the decisions that drive the build.",
    body: "The building, countertop, and cabinet tools update as you make choices. Add any design to the same saved plan, then bring the rest of the home scope in for exact review.",
  },
  projectStart: {
    eyebrow: "Start with your build",
    title: "Tell us how you are building.",
    body: "Choose the path that fits you. The tools stay the same, while the final plan makes your role and the help you need clear.",
  },
  additionalScopes: {
    eyebrow: "Complete the request",
    title: "Add the systems, finishes, and support you still need.",
    body: "Add house plans, windows, insulation, interior walls, fixtures, flooring, mini-split heating and cooling, tankless water heating, appliances, protection, site work, utilities, or installation support. Unknown categories stay marked Price after review and are never hidden in the estimate as zero-dollar items.",
  },
  tools: {
    cards: STEEL_HOME_PROJECT_TOOL_CARDS,
    building: {
      eyebrow: "Project tool 01 • Building and included roof",
      title: "Shape the steel building package.",
      body: "Adjust the core dimensions, roof, openings, porch, and colors while the planning range updates. The roof is included once with the building package.",
    },
    countertops: {
      eyebrow: "Project tool 02 • Stone and quartz",
      title: "Turn a surface choice into a measured countertop brief.",
      body: "Choose a stone or quartz surface from real material photos, set the layout and cutouts, and carry your selected surface and planning measurements into the project.",
    },
    cabinets: {
      eyebrow: "Project tool 03 • Cabinetry",
      title: "Plan the cabinet wall around the room.",
      body: "Set the room and wall dimensions, place the major appliances and storage groups, choose a style direction, and use the planning range to shape the budget.",
    },
  },
  review: {
    eyebrow: "My build plan",
    title: "Review the project before you send it.",
    body: "Add the project location, check the designs and added scopes, and see what has a planning range versus what still needs an exact price.",
  },
  labor: {
    eyebrow: "Optional local labor",
    title: "Carry the design context into a local labor request.",
    body: "Select the jobsite work you need and keep the related design details with the request for local review.",
  },
  disclosure:
    "Materials planning ranges are early budgeting guides, not quotes. Taxes, site work, foundation, and installation are not included unless a line says otherwise. Final measurements, engineering, local code and permit requirements, specifications, availability, delivery, and fabrication are confirmed in writing before approval.",
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
