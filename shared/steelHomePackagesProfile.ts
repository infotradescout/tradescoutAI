export const STEEL_HOME_PACKAGES_PROFILE_IDENTITY = {
  internalKey: "steel-home-packages",
  temporarySlug: "steel-home-packages",
  slug: "steel-home-packages",
  displayLabel: "Steel Home TradePartners",
  publicRoute: "/u/steel-home-packages",
  releaseState: "unlisted",
  publiclyReleased: false,
} as const;

export const STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE =
  "operator_approved_unlisted_profile" as const;

export const WORLDWIDE_STEEL_BUILDINGS_3D_DESIGNER_URL =
  "https://www.worldwidesteelbuildings.com/3d-building-designer/" as const;
export const WORLDWIDE_STEEL_BUILDINGS_RESIDENTIAL_GALLERY_URL =
  "https://www.worldwidesteelbuildings.com/projects/type/residential-barndominiums/" as const;
export const JW_STONE_MARKETPLACE_PATH = "/jw-stone" as const;

export const STEEL_HOME_TRADEPARTNER_KEYS = [
  "worldwide-steel-buildings",
  "jw-stone-logistics",
  "a-plus-cabinets",
] as const;

export type SteelHomeTradePartnerKey = (typeof STEEL_HOME_TRADEPARTNER_KEYS)[number];

const STEEL_HOME_TRADEPARTNER_REQUESTS: Readonly<
  Record<
    SteelHomeTradePartnerKey,
    {
      source: string;
      title: string;
      description: string;
    }
  >
> = {
  "worldwide-steel-buildings": {
    source: "steel_home_tradepartners_worldwide",
    title: "Worldwide Steel Buildings structure request",
    description: [
      "TradePartner: Worldwide Steel Buildings",
      "Project location:",
      "Intended building use:",
      "3D Designer reference, screenshots, plans, or sketch:",
      "Approximate width, length, and height:",
      "Roof style, porches, overhangs, doors, windows, and colors:",
      "Known local load or permit requirements:",
      "Desired timing:",
      "Questions or additional details:",
    ].join("\n"),
  },
  "jw-stone-logistics": {
    source: "steel_home_tradepartners_jw_stone",
    title: "JW Stone Logistics natural-stone request",
    description: [
      "TradePartner: JW Stone Logistics",
      "Project location:",
      "Stone name, saved selection, or collection link:",
      "Rooms or planned uses:",
      "Approximate measurements or quantity:",
      "Fabrication or installation help needed:",
      "Desired timing:",
      "Questions or additional details:",
    ].join("\n"),
  },
  "a-plus-cabinets": {
    source: "steel_home_tradepartners_a_plus_cabinets",
    title: "A+ Cabinets project request",
    description: [
      "TradePartner: A+ Cabinets — Ocean Springs, Mississippi",
      "Project location:",
      "Rooms needing cabinets:",
      "Plans, measurements, cabinet schedule, or inspiration available:",
      "Preferred door style, color, or finish:",
      "Known appliance sizes or special storage needs:",
      "Delivery or installation help needed:",
      "Desired timing:",
      "Questions or additional details:",
    ].join("\n"),
  },
};

const STEEL_HOME_TRADEPARTNERS_REQUEST_DESCRIPTION = [
  "TradePartner requested (Worldwide Steel Buildings, JW Stone Logistics, or A+ Cabinets):",
  "Project location:",
  "Product or material needed:",
  "Plans, 3D design, saved stone, measurements, photos, or reference links:",
  "Desired timing:",
  "Questions or additional details:",
].join("\n");

const STEEL_HOME_LABOR_REQUEST_DESCRIPTION = [
  "Project location:",
  "Labor needed (site work, foundation, steel erection, stone fabrication or installation, cabinet installation, or other):",
  "TradePartner or material already selected:",
  "Labor pricing only or labor plus materials:",
  "Desired timing:",
  "Additional details:",
].join("\n");

export const STEEL_HOME_PACKAGES_START_REQUEST_PATH =
  `/direct-connect?profile=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug)}` +
  `&profileName=${encodeURIComponent(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel)}` +
  "&source=steel_home_tradepartners" +
  "&subject=product" +
  `&title=${encodeURIComponent("Steel-home TradePartner request")}` +
  `&description=${encodeURIComponent(STEEL_HOME_TRADEPARTNERS_REQUEST_DESCRIPTION)}`;

/**
 * Retargets the shared TradeScout request entry to one named TradePartner while
 * keeping the customer inside the Steel Home TradePartners coordination profile.
 */
export function buildSteelHomeTradePartnerRequestHref(
  baseHref: string,
  partnerKey: SteelHomeTradePartnerKey
): string {
  const request = STEEL_HOME_TRADEPARTNER_REQUESTS[partnerKey];
  const isAbsolute = /^https?:\/\//i.test(baseHref);
  const url = new URL(baseHref, "https://tradescout.local");

  url.searchParams.set("profile", STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug);
  url.searchParams.set("profileName", STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel);
  url.searchParams.set("source", request.source);
  url.searchParams.set("subject", "product");
  url.searchParams.set("title", request.title);
  url.searchParams.set("description", request.description);
  url.searchParams.delete("intent");

  return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Opens the canonical Direct Connect work-request composer without targeting
 * any material TradePartner. Labor-only visitors need location-aware matching.
 */
export const STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH =
  "/direct-connect?source=steel_home_tradepartners_labor" +
  "&subject=service" +
  `&title=${encodeURIComponent("Steel-home labor or installation request")}` +
  `&description=${encodeURIComponent(STEEL_HOME_LABOR_REQUEST_DESCRIPTION)}`;

const STEEL_HOME_TRADEPARTNER_CARDS = [
  {
    key: "structure",
    partnerKey: "worldwide-steel-buildings",
    number: "01",
    label: "Metal structure and roofing",
    title: "Worldwide Steel Buildings",
    body: "Explore the steel-building system, use Worldwide's real 3D Designer, then bring the saved design or project reference into a TradeScout request.",
    image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
    imageAlt: "Steel-home exterior inspiration for the Worldwide Steel Buildings section",
    details: [
      "Custom steel building kit",
      "3D size and exterior configuration",
      "Project-specific structural requirements",
    ],
    action: "Explore Worldwide",
  },
  {
    key: "stone",
    partnerKey: "jw-stone-logistics",
    number: "02",
    label: "Natural stone",
    title: "JW Stone Logistics",
    body: "Browse the live TradeScout stone collection, open exact named-stone galleries, save favorites, and carry the selection into a project request.",
    image: "/images/businesses/jw-stone/inventory/quartzite/cristallo/1.webp",
    imageAlt: "Cristallo natural quartzite from the JW Stone Logistics collection",
    details: [
      "Photographed natural-stone collection",
      "Exact stone galleries",
      "Saved selections and project requests",
    ],
    action: "Explore JW Stone",
  },
  {
    key: "cabinets",
    partnerKey: "a-plus-cabinets",
    number: "03",
    label: "Cabinetry",
    title: "A+ Cabinets",
    body: "Start a cabinet conversation for kitchens, vanities, pantries, built-ins, and other planned storage with the Ocean Springs TradePartner.",
    image: "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
    imageAlt: "Warm cabinet design inspiration for the A+ Cabinets section",
    details: ["Kitchen cabinets", "Bathroom vanities", "Pantries and built-ins"],
    action: "Explore A+ Cabinets",
  },
] as const;

export const STEEL_HOME_PACKAGES_PROFILE_CONTENT = {
  version: 5,
  header: {
    label: "Steel Home TradePartners",
    navigation: [
      { label: "TradePartners", href: "#tradepartners" },
      { label: "Worldwide", href: "#worldwide-steel" },
      { label: "JW Stone", href: "#jw-stone" },
      { label: "A+ Cabinets", href: "#a-plus-cabinets" },
      { label: "Local labor", href: "#local-labor" },
    ],
  },
  hero: {
    eyebrow: "Phase 1 • Metal structure • Natural stone • Cabinets",
    headline: "The right TradePartner for each part.",
    body: "Explore Worldwide Steel Buildings, JW Stone Logistics, and A+ Cabinets as three separate specialties. See what each company brings to the project, then start the exact request you need through TradeScout.",
    primaryAction: "Meet the TradePartners",
    laborAction: "Find local labor",
    image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
    imageAlt: "Steel-home structure inspiration with metal roofing and natural-stone accents",
    visuals: STEEL_HOME_TRADEPARTNER_CARDS.map((partner) => ({
      key: partner.key,
      label: partner.label,
      title: partner.title,
      image: partner.image,
      imageAlt: partner.imageAlt,
    })),
  },
  partnerIntro: {
    eyebrow: "Our Phase 1 TradePartners",
    title: "Three companies. Three clear scopes.",
    body: "Each TradePartner is shown by name, with its own specialty, real project starting point, and useful next step. Choose the company that matches the part of the project you are working on.",
  },
  tradePartners: {
    cards: STEEL_HOME_TRADEPARTNER_CARDS,
    worldwide: {
      key: "worldwide-steel-buildings",
      number: "01",
      eyebrow: "TradePartner • Metal structure and roofing",
      name: "Worldwide Steel Buildings",
      headline: "Start with the steel building system.",
      body: "Worldwide manufactures custom steel building kits. Its 3D Designer lets you explore the building size, roof style and rise, porches or overhangs, doors, windows, garage doors, and exterior colors before the structure request moves forward.",
      image: "/images/businesses/steel-home-packages/steel-home-hero.webp",
      imageAlt: "Steel-home exterior inspiration representing the structure scope",
      facts: [
        "Custom steel building kit and roofing system",
        "Real 3D size, roof, opening, accessory, and color controls",
        "Building drawings shaped around the jobsite requirements",
      ],
      requestAction: "Start a Worldwide structure request",
      designerAction: "Open Worldwide's 3D Designer",
      galleryAction: "View Worldwide residential examples",
      designerHref: WORLDWIDE_STEEL_BUILDINGS_3D_DESIGNER_URL,
      galleryHref: WORLDWIDE_STEEL_BUILDINGS_RESIDENTIAL_GALLERY_URL,
      scopeNote:
        "The steel-building tool and structural scope are not a complete residential plan. Floor plans, site design, foundation adaptation, utilities, energy compliance, permits, and construction remain separate unless identified in writing.",
    },
    jwStone: {
      key: "jw-stone-logistics",
      number: "02",
      eyebrow: "TradePartner • Natural stone",
      name: "JW Stone Logistics",
      headline: "Browse real stone, not sample promises.",
      body: "The JW Stone experience is already integrated into TradeScout. Open current named selections, see the exact photographs, save favorites, and ask about the material tied to the project.",
      featuredStoneIds: ["cristallo", "amazonic-green", "taj-mahal", "blue-goias"],
      collectionAction: "Open the full JW Stone collection",
      requestAction: "Start a JW Stone project request",
      scopeNote:
        "Current availability, quantity, size, finish, freight, fabrication, and installation are confirmed for the selected material before approval.",
    },
    aPlusCabinets: {
      key: "a-plus-cabinets",
      number: "03",
      eyebrow: "TradePartner • Cabinetry",
      name: "A+ Cabinets",
      location: "Ocean Springs, Mississippi",
      headline: "Plan the cabinets around the real rooms.",
      body: "Bring the kitchen plan, room measurements, cabinet schedule, appliance sizes, or a starting direction. The request stays focused on cabinetry for the spaces that actually need it.",
      image: "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
      imageAlt: "Warm kitchen cabinet design direction with island and full-height storage",
      facts: [
        "Kitchen cabinets and islands",
        "Bathroom vanities",
        "Pantries, built-ins, and storage",
      ],
      requestAction: "Start an A+ Cabinets request",
      imageNote: "Cabinet design inspiration—not A+ completed-project photography.",
      scopeNote:
        "Available cabinet lines, construction, finishes, measurements, lead times, delivery, and installation are confirmed for the project in writing.",
    },
  },
  integration: {
    eyebrow: "Fully connected through TradeScout",
    title: "Explore the partner. Keep the request useful.",
    items: [
      {
        title: "Use the real partner experience",
        body: "Open Worldwide's 3D tool, browse JW Stone's live collection, or begin the A+ cabinet brief.",
      },
      {
        title: "Carry the exact starting point",
        body: "Bring the design reference, stone link, plans, measurements, photos, or room list into the request.",
      },
      {
        title: "Keep each scope separate",
        body: "Structure, stone, cabinets, and local labor remain distinct so nobody is promised work that has not been quoted.",
      },
    ],
  },
  labor: {
    eyebrow: "Express Direct Connect work request",
    title: "Need local labor for one of these scopes?",
    body: "Start a separate location-based request for site work, foundation, steel erection, stone fabrication or installation, cabinet installation, or labor pricing.",
    support:
      "The labor request is not assigned to a material TradePartner. TradeScout uses the real jobsite and the work selected to help find the right local professionals.",
    examples: [
      "Site work and foundation",
      "Steel-structure erection",
      "Stone fabrication and installation",
      "Cabinet installation",
      "Other local construction work",
    ],
    action: "Start a local labor request",
  },
  disclosure:
    "Each TradePartner keeps its own product scope, specifications, written warranty, availability, pricing, delivery, and fulfillment terms. Residential design, site work, permits, inspections, and installation are separate unless included in a written scope. Local labor is requested separately through Express Direct Connect.",
  // Compatibility data for the earlier package-builder component. The current
  // public page renders the named TradePartner experience above instead.
  package: {
    eyebrow: "Phase 1 TradePartners",
    title: "Start with the TradePartner you need.",
    body: "Each company covers a separate scope and receives a partner-specific project request.",
    items: STEEL_HOME_TRADEPARTNER_CARDS,
  },
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
