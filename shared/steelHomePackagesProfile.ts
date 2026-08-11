export const STEEL_HOME_PACKAGES_PROFILE_IDENTITY = {
  internalKey: "steel-home-packages",
  temporarySlug: "steel-home-packages",
  slug: "steel-home-packages",
  displayLabel: "Complete Steel-Home Packages",
  publicRoute: "/u/steel-home-packages",
  releaseState: "unlisted",
  publiclyReleased: false,
} as const;

export const STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE =
  "operator_approved_unlisted_profile" as const;

export const STEEL_HOME_PACKAGES_START_REQUEST_PATH =
  `/direct-connect?profile=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug)}` +
  `&profileName=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel)}` +
  "&source=profile_site&intent=fix_improve&subject=service";

export const STEEL_HOME_PACKAGES_PROFILE_CONTENT = {
  version: 1,
  header: {
    audience: "For owner-builders, builders, and contractors",
    status: "Early project intake",
  },
  hero: {
    headline: "One place to start your steel home.",
    body: "Start with the steel structure, cabinets, and natural stone we already source. We are building one coordinated path for the additional partner-supplied systems needed to complete the home.",
    audience: "Built first for self-contracting homeowners, builders, and contractors.",
    primaryAction: "Start a Request",
    secondaryAction: "See what is available now",
  },
  currentCapabilities: {
    title: "Start with what is already available",
    intro: "These are the supply categories currently at the center of the business.",
    items: [
      {
        title: "Steel structures and metal-building packages",
        body: "Begin with the engineered structural package suited to the project, supplier, plans, and destination requirements.",
      },
      {
        title: "Cabinet packages",
        body: "Kitchen, bathroom, laundry, pantry, storage, and other cabinet needs can be included in the project request.",
      },
      {
        title: "Natural stone",
        body: "Request natural stone slabs, containers, or blocks for countertops, showers, walls, fireplaces, floors, and other approved uses.",
      },
    ],
  },
  housingPaths: {
    title: "Three steel-home paths",
    items: [
      {
        title: "Full-size steel homes",
        status: "First focus",
        body: "Permanent steel-home packages built around the property, selected plans, approved engineering, and the needs of the homeowner or builder.",
      },
      {
        title: "Next-generation single-wide homes",
        status: "In development",
        body: "A redesigned steel single-wide home line is planned. Final construction classification, dimensions, layouts, and production details are not yet being published.",
      },
      {
        title: "Steel tiny homes",
        status: "Future line",
        body: "Compact steel homes designed around useful living space, efficient mechanical layouts, and destination-specific requirements.",
      },
    ],
  },
  audiences: {
    title: "Built for people who want more control",
    items: [
      {
        title: "Owner-builders",
        body: "Act as your own project manager where local law, financing, and project conditions allow. Start with a coordinated package instead of finding every supplier separately.",
      },
      {
        title: "Builders",
        body: "Bring an existing plan or project and use one request to organize the major package categories and supplier handoff.",
      },
      {
        title: "Contractors",
        body: "Request a complete project package or a focused stage such as the structure, cabinets, stone, or another supported category.",
      },
    ],
  },
  process: {
    title: "One customer-facing path",
    items: [
      {
        title: "Start with the property and project",
        body: "Share the project location, intended home type, plans if available, current stage, and the role you will have in the build.",
      },
      {
        title: "Build the package",
        body: "The request is organized around current supply categories and qualified partner-supplied components as those relationships and project requirements are confirmed.",
      },
      {
        title: "Confirm scope and funding",
        body: "The final scope identifies what is included, what is excluded, who supplies each part, and what remains the responsibility of the homeowner, contractor, or builder.",
      },
      {
        title: "Release and hand off",
        body: "After the required payment or approved funding is complete, supplier orders can be released and the package formally handed to the customer or builder.",
      },
    ],
  },
  mechanical: {
    title: "Use space for the home, not wasted mechanical rooms",
    body: "Mini-split heating and cooling is preferred where the project layout, load calculation, climate, code, and manufacturer requirements support it. Electric or gas tankless water heating is also preferred where the available utilities and project conditions support it.",
    support:
      "The goal is to reduce unnecessary duct runs and oversized equipment closets so more of the floor plan can serve the people living in the home.",
  },
  location: {
    title: "The package starts with where the home will be built",
    body: "Building requirements change by location. Final package decisions may depend on local codes, amendments, zoning, structural loads, flood conditions, energy rules, utilities, engineering, permits, and inspections.",
    responsibility:
      "Final construction, engineering, permitting, inspection, and code approval remain with the appropriate licensed professionals, manufacturers, builders, and local authorities.",
  },
  homeId: {
    title: "A home record that can stay with the property",
    body: "Plans, product information, equipment records, warranties, inspections, repairs, and maintenance should not disappear after construction. The long-term goal is to preserve the home’s verified history through HomeID.",
    status: "Long-term goal",
  },
  finalAction: {
    headline: "Start with the property, plan, or idea you already have.",
    body: "Tell us what you want to build, where it will go, and whether you are acting as the homeowner, owner-builder, contractor, or builder.",
    supportingLine: "Already working with a builder? Include them in the project information.",
  },
  projectInterests: [
    "Full-size steel home",
    "Next-generation single-wide interest",
    "Steel tiny-home interest",
    "Steel structure or metal-building package",
    "Cabinet package",
    "Natural stone",
    "Multiple package categories",
  ],
  customerRoles: [
    "Self-contracting homeowner or owner-builder",
    "Homeowner using a builder",
    "Builder",
    "Contractor",
    "Developer or landowner",
    "Other",
  ],
  disclosure:
    "We coordinate material and partner-supplied package requests. Construction, engineering, permitting, inspections, financing, insurance, warranties, and other regulated services are performed or approved by the appropriate qualified providers and authorities. Availability depends on project location, supplier coverage, and final project requirements.",
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
