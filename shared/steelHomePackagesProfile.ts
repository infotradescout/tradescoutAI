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
  "Starting point (plans, 3D concept, sketch, photos, or an idea):",
  "Package choices (metal structure, natural stone, cabinets, or a combination):",
  "Preferred exterior direction:",
  "Rooms or features needing natural stone:",
  "Rooms needing cabinets:",
  "Current project stage:",
  "Desired timing:",
  "Files or reference links:",
  "Questions or additional details:",
].join("\n");

const STEEL_HOME_LABOR_REQUEST_DESCRIPTION = [
  "Project location:",
  "Labor needed (site work, foundation, steel erection, stone fabrication or installation, cabinet installation, or other):",
  "Plans or material package selected:",
  "Labor pricing only or labor plus package materials:",
  "Desired timing:",
  "Additional details:",
].join("\n");

export const STEEL_HOME_PACKAGES_START_REQUEST_PATH =
  `/direct-connect?profile=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug)}` +
  `&profileName=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel)}` +
  "&source=steel_home_packages_phase1" +
  "&subject=product" +
  `&title=${encodeURIComponent("Steel home structure, stone, and cabinet package")}` +
  `&description=${encodeURIComponent(STEEL_HOME_PACKAGE_REQUEST_DESCRIPTION)}`;

/**
 * Opens the canonical Direct Connect work-request composer without targeting
 * the package profile. Labor-only visitors need location-aware TradeScout
 * matching, not a request assigned to the material package team.
 */
export const STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH =
  "/direct-connect?source=steel_home_packages_phase1_labor" +
  "&subject=service" +
  `&title=${encodeURIComponent("Steel-home labor or installation request")}` +
  `&description=${encodeURIComponent(STEEL_HOME_LABOR_REQUEST_DESCRIPTION)}`;

export const STEEL_HOME_PACKAGES_PROFILE_CONTENT = {
  version: 4,
  header: {
    label: "Steel Home Studio",
    navigation: [
      { label: "Home ideas", href: "#home-ideas" },
      { label: "Build your package", href: "#build-your-package" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Find local labor", href: "#local-labor" },
    ],
  },
  hero: {
    eyebrow: "Metal structure • natural stone • cabinets",
    headline: "A steel home, built around your life.",
    body: "Bring your plans, a sketch, or a starting idea. TradeScout coordinates the metal structure, natural stone, and cabinets into one clear package with one point of contact.",
    primaryAction: "Start your package",
    plansAction: "I already have plans",
    laborAction: "Find local labor",
    image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
    imageAlt:
      "Design inspiration for a charcoal steel home with a wood porch and natural-stone accents",
  },
  startingPoints: {
    eyebrow: "How are you starting?",
    title: "Start where you are.",
    items: [
      {
        key: "ideas",
        number: "01",
        title: "I need a starting direction",
        body: "Explore finished-home looks before choosing the parts.",
        action: "Browse home ideas",
      },
      {
        key: "plans",
        number: "02",
        title: "I already have plans",
        body: "Attach the plan set, sketch, or photos to your request.",
        action: "Start with my plans",
      },
      {
        key: "design",
        number: "03",
        title: "I have a 3D concept",
        body: "Bring the file, screenshots, or reference and continue with us.",
        action: "Continue my design",
      },
      {
        key: "labor",
        number: "04",
        title: "I need local labor",
        body: "Request crews or labor pricing wherever the project is located.",
        action: "Find local crews",
      },
    ],
  },
  inspiration: {
    eyebrow: "Explore the look",
    title: "See the home before choosing the parts.",
    body: "Start with the feeling you want. The real package is then shaped around your property, plans, selections, local requirements, and written quote.",
    items: [
      {
        key: "exterior",
        label: "Exterior direction",
        title: "Warm modern steel home",
        image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
        imageAlt:
          "Design inspiration for a warm modern steel home with a deep porch and attached garage",
      },
      {
        key: "stone",
        label: "Natural-stone direction",
        title: "Quiet natural luxury",
        image: "/images/businesses/jw-stone/story/taj-living-room.webp",
        imageAlt: "Natural-stone interior direction with a full-height quartzite feature wall",
      },
      {
        key: "cabinets",
        label: "Cabinet direction",
        title: "Warm, useful, finished",
        image: "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
        imageAlt:
          "Cabinet design inspiration with white-oak storage walls and a large working island",
      },
    ],
    note: "These scenes show design direction, not a completed TradeScout project portfolio.",
  },
  package: {
    eyebrow: "Your package",
    title: "Choose one, two, or all three.",
    body: "TradeScout handles sourcing, ordering, delivery coordination, and problem-solving behind the scenes. You receive one coordinated package quote and one place to call.",
    items: [
      {
        key: "structure",
        label: "01 • Metal structure",
        title: "Shape the home",
        body: "Choose the footprint, roofline, openings, exterior colors, and structural options around the real property and plan.",
        image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
        imageAlt: "Charcoal metal-home exterior with wood porch columns and stone accents",
        details: ["Size and footprint", "Roofline and overhangs", "Openings and exterior colors"],
        action: "Configure structure",
      },
      {
        key: "stone",
        label: "02 • Natural stone",
        title: "Choose the surfaces",
        body: "Select slabs, containers, or blocks for the kitchen, bathrooms, fireplaces, feature walls, floors, and other suitable uses.",
        image: "/images/businesses/jw-stone/inventory/quartzite/cristallo/1.webp",
        imageAlt: "Backlit natural quartzite slab from the TradeScout stone collection",
        details: [
          "Slabs, containers, or blocks",
          "Kitchen and bathroom surfaces",
          "Fireplaces, walls, and floors",
        ],
        action: "Select natural stone",
      },
      {
        key: "cabinets",
        label: "03 • Cabinets",
        title: "Plan the storage",
        body: "Build a coordinated cabinet list for kitchens, bathrooms, laundry rooms, pantries, storage walls, and other planned areas.",
        image: "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
        imageAlt: "White-oak kitchen cabinet direction with pantry storage and island drawers",
        details: ["Kitchen and island", "Bathrooms and laundry", "Pantry and storage areas"],
        action: "Plan cabinets",
      },
    ],
  },
  process: {
    eyebrow: "How it works",
    title: "One conversation. One coordinated package.",
    items: [
      {
        title: "Show us where you are starting",
        body: "Share the jobsite, plans, 3D concept, sketch, photos, or just the idea you have in mind.",
      },
      {
        title: "Build the right scope",
        body: "Choose the structure, stone, cabinets, or any combination. Nothing else is added by assumption.",
      },
      {
        title: "Receive one clear quote",
        body: "The written package identifies products, specifications, availability, freight, warranty terms, exclusions, and timing before approval.",
      },
      {
        title: "Keep one point of contact",
        body: "You work with TradeScout. We handle the outside ordering and coordination and help resolve package problems.",
      },
    ],
  },
  labor: {
    eyebrow: "Express Direct Connect work request",
    title: "Need the people to build it too?",
    body: "Start a separate location-based work request for site work, foundation, steel erection, stone fabrication, cabinet installation, finish work, or labor pricing.",
    support:
      "Labor can be requested by itself or alongside the material package. TradeScout uses the real project location to help find the right local professionals.",
    examples: [
      "Site work and foundation",
      "Steel-structure erection",
      "Stone fabrication and installation",
      "Cabinet installation",
      "Other local construction work",
    ],
    action: "Start a labor request",
  },
  finalAction: {
    eyebrow: "Ready when you are",
    headline: "Bring the plan—or bring the idea.",
    body: "Tell us where the home will be and what you want to start with. We will help turn it into a clear package request.",
    packageAction: "Start your package",
    laborAction: "Find local labor",
  },
  disclosure:
    "TradeScout is your package contact. Product makers, model numbers, certifications, written warranty parties, delivery terms, exclusions, and local professional responsibilities are identified in the final written scope. Project design, engineering, permits, inspections, installation, and code approval remain subject to the responsible licensed professionals and local authorities.",
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
