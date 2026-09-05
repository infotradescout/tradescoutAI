import type { LocalServiceProfilePresentation } from "./localServiceProfile";

/** Source scope and omissions: docs/profile-sources/LOUISIANA_STONE_SOLUTIONS.md. */
export const LOUISIANA_STONE_SOLUTIONS_BUSINESS_NAME = "Louisiana Stone Solutions";

/** Proposed profile identity; importing this module does not create or publish a profile. */
export const LOUISIANA_STONE_SOLUTIONS_PROFILE_SLUG = "louisiana-stone-solutions";

// Original company-published images, stored by content hash through TradeScout uploads.
export const LOUISIANA_STONE_SOLUTIONS_MEDIA = {
  kitchen: "/uploads/business-profiles/louisiana-stone-solutions/kitchen-a8af176a1642.jpg",
  logo: "/uploads/business-profiles/louisiana-stone-solutions/logo-ba7034eb0e0d.jpg",
} as const;

export const LOUISIANA_STONE_SOLUTIONS_HEADLINE =
  "Countertop specialists based in Baton Rouge, serving New Orleans and surrounding areas.";

export const LOUISIANA_STONE_SOLUTIONS_SEO_META = {
  title: "Louisiana Stone Solutions | Countertops & Remodeling",
  description:
    "Baton Rouge based countertop specialists serving New Orleans and surrounding areas, with tile, drywall, painting, cabinets, and remodeling services.",
  imageUrl: LOUISIANA_STONE_SOLUTIONS_MEDIA.kitchen,
  faviconUrl: LOUISIANA_STONE_SOLUTIONS_MEDIA.logo,
};

export const LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION: LocalServiceProfilePresentation = {
  template: "local-service",
  layout: "project-profile",
  eyebrow: "Countertops + remodeling",
  heroTitle: "Countertop specialists",
  heroDescription: "",
  heroImage: LOUISIANA_STONE_SOLUTIONS_MEDIA.kitchen,
  heroImageAlt: "Countertop kitchen featured by Louisiana Stone Solutions",
  logoImage: LOUISIANA_STONE_SOLUTIONS_MEDIA.logo,
  logoAlt: "Louisiana Stone Solutions",
  locationLabel: "Baton Rouge, Louisiana",
  primaryActionLabel: "Start a Request",
  serviceNote: "",
  servicesEyebrow: "",
  servicesTitle: "",
  highlights: [],
  services: [
    {
      title: "Countertops",
      description: "",
      icon: "construction",
    },
    {
      title: "Tile",
      description: "",
      icon: "construction",
    },
    {
      title: "Sheetrock & drywall",
      description: "",
      icon: "repair",
    },
    {
      title: "Painting",
      description: "",
      icon: "repair",
    },
    {
      title: "Cabinets",
      description: "",
      icon: "construction",
    },
    {
      title: "Remodeling",
      description: "",
      icon: "construction",
    },
  ],
  aboutEyebrow: "",
  aboutTitle: "",
  aboutBody: "",
  aboutImage: "",
  aboutImageAlt: "",
  serviceAreas: ["New Orleans", "surrounding areas"],
  serviceAreaDescription:
    "Based in Baton Rouge, Louisiana, and serving New Orleans and surrounding areas. Include your project location when you start a request.",
  // Publication on the company page is established; job completion and material are not.
  galleryEyebrow: "From the company page",
  galleryTitle: "Photos",
  galleryDescription: "Kitchen imagery shared by Louisiana Stone Solutions.",
  galleryShareText: "Explore Louisiana Stone Solutions",
  credentialLabel: "",
  credentials: [],
  requestTitle: "Start a Request",
  requestDescription: "Include the project location, work needed, timing, and any photos or plans.",
  // Exact color values are a presentation choice from the supplied white/black/yellow identity.
  brand: {
    primary: "#e7bd32",
    primaryDark: "#8a6900",
    surface: "#151515",
    background: "#ffffff",
  },
};

/** Native blocks retain the same copy for profile, public HTML, and service consumers. */
export const LOUISIANA_STONE_SOLUTIONS_PROFILE_CONTENT_BLOCKS = [
  {
    type: "profileSections",
    data: {
      sections: {
        about: true,
        rolesAndBadges: false,
        stats: false,
        services: true,
        marketplaceListings: false,
        reviews: false,
        communityActivity: false,
        contactCard: true,
      },
    },
  },
  {
    type: "localServiceProfile",
    data: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION,
  },
  {
    type: "hero",
    data: {
      title: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.heroTitle,
      text: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.heroDescription,
      locationLabel: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.locationLabel,
      imageUrl: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.heroImage,
      imageAlt: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.heroImageAlt,
      logoUrl: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.logoImage,
    },
  },
  {
    type: "about",
    data: {
      text: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.aboutBody,
    },
  },
  {
    type: "services",
    data: {
      items: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.services.map(
        (service) => service.title
      ),
    },
  },
  {
    type: "gallery",
    data: {
      title: "Kitchen details",
      description: "Kitchen imagery shared by Louisiana Stone Solutions.",
      images: [
        {
          id: "countertop-kitchen",
          imageUrl: LOUISIANA_STONE_SOLUTIONS_MEDIA.kitchen,
          title: "Countertop kitchen",
          alt: "Long kitchen countertop with white cabinets and pendant lighting",
          description: "A kitchen featured on Louisiana Stone Solutions' company page.",
        },
      ],
    },
  },
] as const;

/**
 * Content-only POST /api/profiles payload. The existing authenticated endpoint
 * supplies the owner and sets status to draft. Business binding is resolved by
 * the caller; no owner, business, contact, or verification identity is inferred.
 */
export const LOUISIANA_STONE_SOLUTIONS_PROFILE_DRAFT_PAYLOAD = {
  roleContext: "business_owner",
  slug: LOUISIANA_STONE_SOLUTIONS_PROFILE_SLUG,
  displayName: LOUISIANA_STONE_SOLUTIONS_BUSINESS_NAME,
  headline: LOUISIANA_STONE_SOLUTIONS_HEADLINE,
  contentBlocks: LOUISIANA_STONE_SOLUTIONS_PROFILE_CONTENT_BLOCKS,
  ctaConfig: {},
  seoMeta: LOUISIANA_STONE_SOLUTIONS_SEO_META,
  setActive: false,
} as const;
