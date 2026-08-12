export const STEEL_HOME_PACKAGES_PROFILE_IDENTITY = {
  internalKey: "steel-home-packages",
  temporarySlug: "steel-home-packages",
  slug: "steel-home-packages",
  displayLabel: "Steel Home Project Tools",
  publicRoute: "/u/steel-home-packages",
  releaseState: "unlisted",
  publiclyReleased: false,
} as const;

export const STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE =
  "operator_approved_unlisted_profile" as const;

const STEEL_HOME_PROJECT_REQUEST_FALLBACK = [
  "TradeScout steel-home project review",
  "Project location:",
  "Building, countertop, or cabinet design completed:",
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
  `&profileName=${encodeURIComponent("TradeScout project desk")}` +
  "&source=steel_home_project_tools" +
  "&subject=product" +
  `&title=${encodeURIComponent("Steel-home design review")}` +
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
    label: "Natural stone",
    title: "Countertop designer",
    body: "Choose a photographed stone, map the countertop shape, add measurements and cutouts, and see the planning area.",
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
  version: 6,
  header: {
    label: "Steel Home Project Tools",
    navigation: [
      { label: "Building", href: "#building-designer" },
      { label: "Countertops", href: "#countertop-designer" },
      { label: "Cabinets", href: "#cabinet-designer" },
      { label: "Project review", href: "#project-review" },
    ],
  },
  hero: {
    eyebrow: "Building • Countertops • Cabinets",
    headline: "Design each part before you request the quote.",
    body: "Use three working project tools, save only the scopes you need, and send the finished design brief to TradeScout. Local labor stays a separate jobsite request.",
    primaryAction: "Open the project tools",
    reviewAction: "Review my project",
    visuals: STEEL_HOME_PROJECT_TOOL_CARDS.map((tool) => ({
      key: tool.key,
      label: tool.label,
      title: tool.title,
      image: tool.image,
      imageAlt: tool.imageAlt,
    })),
  },
  toolIntro: {
    eyebrow: "Real planning tools",
    title: "Three separate designs. One useful project brief.",
    body: "Work on one scope or all three. Nothing is submitted while you design, and only the selections you mark ready move into the TradeScout project brief.",
  },
  tools: {
    cards: STEEL_HOME_PROJECT_TOOL_CARDS,
    building: {
      eyebrow: "Project tool 01 • Metal structure",
      title: "Shape the steel building concept.",
      body: "Adjust the core dimensions, roof, openings, porch, and colors. The visual is a planning concept, not structural engineering or a permit drawing.",
    },
    countertops: {
      eyebrow: "Project tool 02 • Natural stone",
      title: "Turn a stone choice into a measured countertop brief.",
      body: "Use photographed named stone records, choose the layout and cutouts, and carry the exact material and planning measurements into the request.",
    },
    cabinets: {
      eyebrow: "Project tool 03 • Cabinetry",
      title: "Build the cabinet wall around the room.",
      body: "Set the room and wall dimensions, place the major appliances and storage groups, choose a style direction, and review the concept elevation.",
    },
  },
  review: {
    eyebrow: "TradeScout project review",
    title: "Send the design, not a blank form.",
    body: "Add the project location, choose the designs that are ready, and review the same brief TradeScout will receive before opening Direct Connect.",
  },
  labor: {
    eyebrow: "Optional local labor",
    title: "Carry the design context into a local labor request.",
    body: "Select the jobsite work you need. The labor request stays untargeted and location-based while retaining the related design details.",
  },
  disclosure:
    "These tools create customer planning concepts. Final field measurements, structural engineering, local code requirements, product specifications, availability, pricing, delivery, fabrication, and installation scope are confirmed in writing before approval.",
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
