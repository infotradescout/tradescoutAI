export const STEEL_HOME_PACKAGES_PROFILE_IDENTITY = {
  internalKey: "steel-home-packages",
  temporarySlug: "steel-home-packages",
  slug: "steel-home-packages",
  displayLabel: "Steel Home Packages",
  publicRoute: "/u/steel-home-packages",
  releaseState: "unlisted",
  publiclyReleased: false,
} as const;

export const STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE =
  "operator_approved_unlisted_profile" as const;

const STEEL_HOME_PACKAGE_REQUEST_DESCRIPTION = [
  "Project location:",
  "Plans or Worldwide Steel Buildings design reference:",
  "Phase 1 materials needed (metal structure, natural stone, cabinets, or a combination):",
  "Current project stage:",
  "Desired timing:",
  "Additional details:",
].join("\n");

const STEEL_HOME_LABOR_REQUEST_DESCRIPTION = [
  "Project location:",
  "Labor needed (site work, foundation, steel erection, stone fabrication or installation, cabinet installation, or other):",
  "Plans or material package selected:",
  "Labor pricing only or labor plus Phase 1 materials:",
  "Desired timing:",
  "Additional details:",
].join("\n");

export const STEEL_HOME_PACKAGES_START_REQUEST_PATH =
  `/direct-connect?profile=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug)}` +
  `&profileName=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel)}` +
  "&source=steel_home_packages_phase1" +
  "&intent=fix_improve&subject=service" +
  `&title=${encodeURIComponent("Phase 1 metal structure, stone, and cabinet package")}` +
  `&description=${encodeURIComponent(STEEL_HOME_PACKAGE_REQUEST_DESCRIPTION)}`;

/**
 * Opens the canonical Direct Connect work-request composer without targeting
 * the package profile. Labor-only visitors need location-aware TradeScout
 * matching, not a request assigned to one of the three material suppliers.
 */
export const STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH =
  "/direct-connect?source=steel_home_packages_phase1_labor" +
  "&intent=hire&subject=service" +
  `&title=${encodeURIComponent("Steel-home labor or installation request")}` +
  `&description=${encodeURIComponent(STEEL_HOME_LABOR_REQUEST_DESCRIPTION)}`;

export const STEEL_HOME_PACKAGES_PROFILE_CONTENT = {
  version: 2,
  header: {
    audience: "For owner-builders, builders, and contractors",
    status: "Phase 1",
  },
  hero: {
    headline: "The structure. The stone. The cabinets.",
    body: "Phase 1 brings together the three supply relationships already in place: a custom metal structure through Worldwide Steel Buildings, natural stone through JW Stone Logistics, and cabinets through A+ Cabinets in Ocean Springs.",
    audience: "A focused first package for real steel-home projects.",
    primaryAction: "Start a Package Request",
    laborAction: "Start a Labor Request",
    secondaryAction: "See the Phase 1 package",
  },
  phaseOnePackage: {
    title: "Three parts. One Phase 1 starting point.",
    intro:
      "This page covers only the metal structure, natural stone, and cabinets. Other material systems are not part of the Phase 1 offer.",
    items: [
      {
        key: "structure",
        title: "Metal structure",
        partner: "Worldwide Steel Buildings",
        partnerDetail: "Structural and roofing partner",
        body: "Shape the custom metal structure, roof system, openings, colors, and structure-specific options around the project location and plans. Save the Worldwide design so it can follow the package request.",
        action: {
          label: "Open the 3D Building Designer",
          href: "https://www.worldwidesteelbuildings.com/3d-building-designer/",
          external: true,
        },
      },
      {
        key: "stone",
        title: "Natural stone",
        partner: "JW Stone Logistics",
        partnerDetail: "Natural-stone partner",
        body: "Request natural stone slabs, containers, or blocks for countertops, showers, walls, fireplaces, floors, and other suitable project uses.",
        action: {
          label: "Explore natural stone",
          href: "/jw-stone",
          external: false,
        },
      },
      {
        key: "cabinets",
        title: "Cabinets",
        partner: "A+ Cabinets",
        partnerDetail: "Ocean Springs",
        body: "Include cabinet needs for the kitchen, bathrooms, laundry, pantry, storage, and other planned cabinet areas in the same Phase 1 request.",
        action: null,
      },
    ],
  },
  audiences: {
    title: "Built for people who want more control",
    items: [
      {
        title: "Owner-builders",
        body: "Coordinate the three Phase 1 supply categories while acting as your own project manager where local rules and project conditions allow.",
      },
      {
        title: "Builders",
        body: "Bring the plans and jobsite requirements, then organize the metal structure, stone, and cabinets through one request.",
      },
      {
        title: "Contractors",
        body: "Request one supported category or coordinate all three around the construction sequence and the customer’s plan.",
      },
    ],
  },
  process: {
    title: "A clear path from the idea to three real quotes",
    items: [
      {
        title: "Start with the jobsite and plan",
        body: "Share the project location, plans or sketch, current stage, and whether you are the owner-builder, builder, or contractor.",
      },
      {
        title: "Choose the Phase 1 scope",
        body: "Select the metal structure, natural stone, cabinets, or any combination of the three. Nothing else is added to the material package by assumption.",
      },
      {
        title: "Confirm each partner quote",
        body: "Each quote identifies what that partner supplies, the project-specific selections, timing, delivery terms, and the items that remain outside its scope.",
      },
      {
        title: "Add local labor when needed",
        body: "Use a separate TradeScout labor request for site work, foundation, erection, fabrication, installation, or other local work. The material suppliers are not treated as the labor crew.",
      },
    ],
  },
  labor: {
    title: "Need labor only, or labor pricing with the package?",
    body: "Start a separate express work request. Tell TradeScout where the project is and what work is needed, and we will help find the right local professionals without confusing the labor request with the three-part material package.",
    support:
      "You can request labor even if you buy no Phase 1 materials, or ask for labor pricing alongside a structure, stone, or cabinet request.",
    examples: [
      "Site work and foundation",
      "Metal-structure erection",
      "Stone fabrication and installation",
      "Cabinet installation",
      "Other local construction work",
    ],
    action: "Start a Labor Request",
  },
  location: {
    title: "The jobsite controls the structure and the labor match",
    body: "Building requirements and available trade professionals change by location. Share the real jobsite so the metal structure can reflect the required loads and the labor request can reach appropriate professionals serving that area.",
    responsibility:
      "Final engineering, foundation design, construction, permitting, inspections, and code approval remain with the responsible manufacturers, design professionals, contractors, builders, and local authorities.",
  },
  finalAction: {
    headline: "Choose the request that matches what you need.",
    packageTitle: "Buy Phase 1 materials",
    packageBody:
      "Start here for the metal structure, natural stone, cabinets, or a combination of those three.",
    laborTitle: "Find local labor",
    laborBody:
      "Start here for labor only, labor pricing, installation help, or the local work needed around your material package.",
    supportingLine:
      "Need both? Submit the package request first, then use the labor request so each scope stays clear.",
  },
  disclosure:
    "Phase 1 coordinates requests for a metal structure, natural stone, and cabinets. Labor is requested separately through TradeScout. Quotes, availability, delivery, engineering, installation, warranties, permits, inspections, and final responsibility remain subject to the written scope and the appropriate supplier, qualified professional, builder, and local authority.",
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
