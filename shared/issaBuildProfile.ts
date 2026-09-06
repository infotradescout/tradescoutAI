import {
  PREMIUM_PRODUCT_PROFILE_VARIANT,
  type PremiumProductProfileData,
} from "./premiumProductProfile";

import { IRANIAN_ONYX_STOCK, ISSA_BUILD_ONYX_ORIGINS } from "./onyxOrigins";

/** Canonical public business profile for ISSA Build. */
export const ISSA_BUILD_PROFILE_SLUG = "issa-build";

/** Previous product-only URL; provisioning migrates this slug to ISSA Build. */
export const ISSA_BUILD_LEGACY_PROFILE_SLUG = "honey-onyx";

export const ISSA_BUILD_BUSINESS_NAME = "ISSA Build";

/** Owner-confirmed on 2026-09-06; local projects route to ISSA Build through TradeScout. */
export const ISSA_BUILD_LOCAL_DISCOVERY = {
  primaryCategory: "Kitchen Remodeling",
  tradeServices: ["Kitchen Remodeling", "Bathroom Remodeling"],
  title: "ISSA Build | Pensacola Kitchens, Bathrooms & Countertops",
  description:
    "Pensacola-area kitchens, bathrooms, cabinets, countertops and fabrication. Explore 2 cm Honey Onyx and Multi Green Onyx from Iran with ISSA Build. Start a Request.",
  headline: "Kitchens, bathrooms, cabinets and countertops in Pensacola and surrounding areas.",
  services: [
    {
      slug: "kitchen-projects",
      title: "Kitchen projects in Pensacola",
      description:
        "ISSA Build handles kitchen projects in Pensacola and surrounding areas. Share the room layout, cabinet and countertop needs, measurements and desired timing for a project review.",
    },
    {
      slug: "bathroom-projects",
      title: "Bathroom projects in Pensacola",
      description:
        "Bring your Pensacola-area bathroom project to ISSA Build, including vanity, cabinet and stone surface needs. Include the actual project location, dimensions and the work you want completed.",
    },
    {
      slug: "cabinets",
      title: "Cabinets in Pensacola",
      description:
        "Start a kitchen or bathroom cabinet request with ISSA Build for Pensacola and surrounding areas. Include room dimensions, door style, finish, storage needs and whether installation is part of your project.",
    },
    {
      slug: "countertops-fabrication",
      title: "Countertops and fabrication in Pensacola",
      description:
        "ISSA Build handles Pensacola-area stone countertop and fabrication requests. Discuss material selection, measurements, custom fabrication and installation together, with the scope and schedule confirmed for your job.",
    },
  ],
} as const;

export const ISSA_BUILD_LOGO = "/images/businesses/issa-build/logo/issa-build.png";

/** Full-bleed hero loop for the ISSA Build profile. */
export const ISSA_BUILD_HERO_VIDEO = "/images/businesses/issa-build/video/hero.mp4";
export const ISSA_BUILD_HERO_POSTER = "/images/businesses/issa-build/video/hero-poster.jpg";

/** Installed-project photography from the ISSA Build website pack. */
export const ISSA_BUILD_APPLICATION_IMAGES = [
  "/images/businesses/issa-build/applications/01.jpg",
  "/images/businesses/issa-build/applications/02.jpg",
  "/images/businesses/issa-build/applications/03.jpg",
  "/images/businesses/issa-build/applications/04.jpg",
  "/images/businesses/issa-build/applications/05.jpg",
  "/images/businesses/issa-build/applications/06.jpg",
  "/images/businesses/issa-build/applications/07.jpg",
  "/images/businesses/issa-build/applications/08.jpg",
  "/images/businesses/issa-build/applications/09.jpg",
] as const;

/** Close material views across the two ISSA Build onyx materials. */
export const ISSA_BUILD_SLAB_IMAGES = [
  "/images/businesses/issa-build/slabs/2.jpg",
  "/images/businesses/issa-build/slabs/6.jpg",
  "/images/businesses/issa-build/slabs/1.webp",
  "/images/businesses/issa-build/slabs/3.jpg",
  "/images/businesses/issa-build/slabs/4.jpg",
  "/images/businesses/issa-build/slabs/5.jpg",
] as const;

/** Owner-supplied project and material photography identified as Honey Onyx. */
export const ISSA_BUILD_HONEY_ONYX_IMAGES = [
  ISSA_BUILD_APPLICATION_IMAGES[2],
  ISSA_BUILD_APPLICATION_IMAGES[4],
  ISSA_BUILD_APPLICATION_IMAGES[5],
  ISSA_BUILD_APPLICATION_IMAGES[6],
  ISSA_BUILD_APPLICATION_IMAGES[7],
  ISSA_BUILD_APPLICATION_IMAGES[8],
  ISSA_BUILD_SLAB_IMAGES[0],
  ISSA_BUILD_SLAB_IMAGES[1],
] as const;

/** Owner-supplied project and material photography identified as Multi Green Onyx. */
export const ISSA_BUILD_MULTI_GREEN_ONYX_IMAGES = [
  ISSA_BUILD_APPLICATION_IMAGES[0],
  ISSA_BUILD_APPLICATION_IMAGES[1],
  ISSA_BUILD_APPLICATION_IMAGES[3],
  ISSA_BUILD_SLAB_IMAGES[2],
  ISSA_BUILD_SLAB_IMAGES[3],
  ISSA_BUILD_SLAB_IMAGES[4],
  ISSA_BUILD_SLAB_IMAGES[5],
] as const;

/** Primary gallery shown on the public profile (six application views). */
export const ISSA_BUILD_PROFILE_IMAGES = [
  ISSA_BUILD_APPLICATION_IMAGES[0],
  ISSA_BUILD_APPLICATION_IMAGES[2],
  ISSA_BUILD_APPLICATION_IMAGES[3],
  ISSA_BUILD_APPLICATION_IMAGES[4],
  ISSA_BUILD_APPLICATION_IMAGES[7],
  ISSA_BUILD_APPLICATION_IMAGES[8],
] as const;

export function isIssaBuildProfileSlug(slug: string | null | undefined): boolean {
  const normalized = String(slug || "")
    .trim()
    .toLowerCase();
  return normalized === ISSA_BUILD_PROFILE_SLUG || normalized === ISSA_BUILD_LEGACY_PROFILE_SLUG;
}

/**
 * ISSA Build public copy — Lux presentation voice.
 * Honey Onyx and Multi Green Onyx stay distinct. No catalog spam.
 * inventoryCatalog remains for Direct Connect / material identity only.
 */
export const ISSA_BUILD_PROFILE_CONTENT_BLOCKS = [
  {
    type: "services",
    data: { items: ISSA_BUILD_LOCAL_DISCOVERY.services },
  },
  {
    type: "serviceAreas",
    data: {
      areas: ["Pensacola, FL"],
      description:
        "ISSA Build serves Pensacola and surrounding areas for kitchen and bathroom projects, cabinets, countertops and fabrication. Include the actual project city or ZIP so the job location and scope can be confirmed.",
    },
  },
  {
    type: "hero",
    data: {
      // Editor title ↔ headerLabel (H1). Editor text ↔ teaser.
      // Sticky brand uses displayName; subtitle uses eyebrow — never repeat the brand as H1.
      eyebrow: "CUSTOM BACKLIT ONYX",
      headerLabel: "Onyx, brought to light.",
      teaser:
        "Custom Honey Onyx and Multi Green Onyx installations for residential and commercial interiors.",
    },
  },
  {
    type: "about",
    data: {
      text: "Custom Honey Onyx and Multi Green Onyx installations for residential and commercial interiors.",
    },
  },
  {
    // Lux consultation owns materials + privacy copy — no duplicate trust strip.
    type: "trust",
    data: {
      items: [] as string[],
    },
  },
  {
    type: "premiumProduct",
    data: {
      variant: PREMIUM_PRODUCT_PROFILE_VARIANT,
      presentation: "lux",
      featuredProductSlug: "honey-onyx",
      // Legacy fields retained for schema compatibility; public path uses luxuryHouse.
      offerings: {
        eyebrow: "Materials",
        title: "Two translucent onyxes.",
        body: `Honey Onyx and Multi Green Onyx from Iran. 2 cm slabs. ${IRANIAN_ONYX_STOCK.stockLabel}. ${IRANIAN_ONYX_STOCK.stockNote}`,
        items: [
          {
            slug: "honey-onyx",
            eyebrow: "Honey Onyx",
            title: "Honey Onyx",
            body: "Warm amber translucence for illuminated interiors.",
            highlights: ["Translucent"],
          },
          {
            slug: "multi-green-onyx",
            eyebrow: "Multi Green Onyx",
            title: "Multi Green Onyx",
            body: "Layered green depth for feature walls and custom interiors.",
            highlights: ["Translucent"],
          },
        ],
      },
      luxuryHouse: {
        designedWithLight: {
          eyebrow: "BACKLIGHTING",
          title: "The finish belongs to the room.",
          body: "Translucent onyx shows its depth when the material and how it is illuminated are planned together. We take projects from selection and customization through installation so the finished surface fits the space.",
          image: ISSA_BUILD_APPLICATION_IMAGES[2],
        },
        materialChapters: [
          {
            slug: "honey-onyx",
            name: "Honey Onyx",
            eyebrow: "HONEY ONYX",
            title: "Warm, luminous, unmistakable.",
            body: `${IRANIAN_ONYX_STOCK.specification} Golden movement and soft translucency for baths, bars, kitchens, feature walls, and statement interiors.`,
            applicationImage: ISSA_BUILD_APPLICATION_IMAGES[4],
            // Schema-retained for Direct Connect / deep-link identity; slabs render in materialSamples rail.
            detailImage: ISSA_BUILD_SLAB_IMAGES[0],
          },
          {
            slug: "multi-green-onyx",
            name: "Multi Green Onyx",
            eyebrow: "MULTI GREEN ONYX",
            title: "A deeper architectural tone.",
            body: `${IRANIAN_ONYX_STOCK.specification} Layered green movement for bathrooms, feature walls, and custom interiors shaped around the stone.`,
            applicationImage: ISSA_BUILD_APPLICATION_IMAGES[0],
            detailImage: ISSA_BUILD_SLAB_IMAGES[2],
          },
        ],
        capabilities: {
          eyebrow: "WHAT WE DO",
          title: "From material to installation.",
          body: "We begin with the space, dimensions, intended use, and how the stone will be illuminated.",
          items: [
            { title: "Material selection", body: "" },
            { title: "Custom cutting and shaping", body: "" },
            { title: "Backlighting", body: "" },
            { title: "Custom installation", body: "" },
            { title: "Residential and commercial projects", body: "" },
            { title: "Private project consultation", body: "" },
          ],
        },
        showcase: {
          eyebrow: "INSTALLED WORK",
          title: "Onyx in the room.",
          body: "",
          images: [
            ISSA_BUILD_APPLICATION_IMAGES[0],
            ISSA_BUILD_APPLICATION_IMAGES[1],
            ISSA_BUILD_APPLICATION_IMAGES[2],
            ISSA_BUILD_APPLICATION_IMAGES[3],
            ISSA_BUILD_APPLICATION_IMAGES[4],
            ISSA_BUILD_APPLICATION_IMAGES[5],
            ISSA_BUILD_APPLICATION_IMAGES[6],
            ISSA_BUILD_APPLICATION_IMAGES[7],
            ISSA_BUILD_APPLICATION_IMAGES[8],
          ],
        },
        materialSamples: {
          eyebrow: "MATERIAL SAMPLES",
          title: "Stone detail.",
          groups: [
            {
              slug: "honey-onyx",
              name: "Honey Onyx",
              images: [ISSA_BUILD_SLAB_IMAGES[0], ISSA_BUILD_SLAB_IMAGES[1]],
            },
            {
              slug: "multi-green-onyx",
              name: "Multi Green Onyx",
              images: [
                ISSA_BUILD_SLAB_IMAGES[2],
                ISSA_BUILD_SLAB_IMAGES[3],
                ISSA_BUILD_SLAB_IMAGES[4],
                ISSA_BUILD_SLAB_IMAGES[5],
              ],
            },
          ],
        },
        consultation: {
          eyebrow: "CONSULTATION",
          title: "Start with the room.",
          body: "Tell us the space, dimensions, location, schedule, and whether you are considering backlighting.",
          prompt: "",
          fields: [
            "Selected material",
            "Room / application",
            "Dimensions",
            "Location",
            "Timing",
            "Backlighting intent",
          ],
        },
      },
      contrast: {
        eyebrow: "Honey Onyx",
        title: "By day. By light.",
        body: "Warmth to glow as light moves through.",
        daylightLabel: "Daylight",
        backlitLabel: "Illuminated",
        daylightImageIndex: 0,
        backlitImageIndex: 6,
      },
      gallery: {
        eyebrow: "Showcase",
        title: "In situ.",
        body: "",
        portraitPhotoIndexes: [7],
        photos: [
          { label: "Suite", title: "", body: "" },
          { label: "Kitchen", title: "", body: "" },
          { label: "Island", title: "", body: "" },
          { label: "Match", title: "", body: "" },
          { label: "Wall", title: "", body: "" },
          { label: "Field", title: "", body: "" },
          { label: "Backlit", title: "", body: "" },
          { label: "Detail", title: "", body: "" },
        ],
      },
      applications: {
        eyebrow: "Placement",
        title: "Placement",
        body: "",
        items: [
          { title: "Suites", body: "", imageIndex: 0 },
          { title: "Kitchens", body: "", imageIndex: 1 },
          { title: "Walls", body: "", imageIndex: 4 },
        ],
      },
      brief: {
        eyebrow: "Consultation",
        title: "Discuss your project",
        body: "Tell us the space, dimensions, location, schedule, and whether you are considering backlighting.",
        steps: [
          "Selected material",
          "Room / application",
          "Dimensions",
          "Location",
          "Timing",
          "Backlighting intent",
        ],
      },
      // Schema-retained; Lux collapses closing into consultation.
      closing: {
        eyebrow: "CONSULTATION",
        title: "Start with the room.",
        body: "Tell us the space, dimensions, location, schedule, and whether you are considering backlighting.",
        imageIndex: 2,
        imageFit: "cover",
      },
    } satisfies PremiumProductProfileData,
  },
  {
    type: "publicDiscovery",
    data: {
      sitemap: {
        inventory: true,
        categories: true,
      },
      categories: [
        {
          sourceSlug: "onyx",
          publicSlug: "onyx",
          title: "Iranian Translucent Onyx",
          summary: `${IRANIAN_ONYX_STOCK.specification} Honey Onyx and Multi Green Onyx for backlit counters, baths and interiors. ${IRANIAN_ONYX_STOCK.stockLabel}. ${IRANIAN_ONYX_STOCK.stockNote}`,
          leadItemSlug: "honey-onyx",
          indexable: true,
          collectionKind: "offerings",
        },
      ],
    },
  },
  {
    // Identity + Direct Connect resolution only — not a public inventory browser.
    type: "inventoryCatalog",
    data: {
      title: "ISSA Build",
      description: `Honey Onyx and Multi Green Onyx. ${IRANIAN_ONYX_STOCK.specification}`,
      categories: [
        {
          category: "Onyx",
          categorySlug: "onyx",
          stones: [
            {
              name: "Honey Onyx",
              slug: "honey-onyx",
              images: [...ISSA_BUILD_HONEY_ONYX_IMAGES],
              countryOfOrigin: ISSA_BUILD_ONYX_ORIGINS["honey-onyx"].country,
              thicknessCm: IRANIAN_ONYX_STOCK.thicknessCm,
              publicKind: "offering",
              publicSummary: `Honey Onyx from ISSA Build. ${IRANIAN_ONYX_STOCK.specification} Warm amber translucence for custom backlit counters, walls, floors, stairs and interiors.`,
              materialStatus: "user_confirmed",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceNote:
                "Owner-supplied ISSA Build photography shows Honey Onyx in installed rooms and close material views.",
            },
            {
              name: "Multi Green Onyx",
              slug: "multi-green-onyx",
              images: [...ISSA_BUILD_MULTI_GREEN_ONYX_IMAGES],
              countryOfOrigin: ISSA_BUILD_ONYX_ORIGINS["multi-green-onyx"].country,
              thicknessCm: IRANIAN_ONYX_STOCK.thicknessCm,
              publicKind: "offering",
              publicSummary: `Multi Green Onyx from ISSA Build. ${IRANIAN_ONYX_STOCK.specification} Layered green translucence for backlit feature walls, baths, counters, floors and stairs.`,
              materialStatus: "user_confirmed",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceNote:
                "Owner-supplied ISSA Build photography shows Multi Green Onyx in installed rooms and close material views.",
            },
          ],
        },
      ],
    },
  },
  {
    type: "faq",
    data: {
      faqs: [
        {
          question: "Where does ISSA Build’s onyx come from?",
          answer: `Honey Onyx and Multi Green Onyx have country of origin: Iran and a thickness of 2 cm. ${IRANIAN_ONYX_STOCK.stockLabel}. ${IRANIAN_ONYX_STOCK.stockNote} Ask ISSA Build about fabrication, backlighting and installation.`,
        },
      ],
    },
  },
  {
    type: "cta",
    data: {
      heading: "Start with the room.",
      description:
        "Tell us the space, dimensions, location, schedule, and whether you are considering backlighting.",
      requestExamples: ["Discuss your project", "Ask about backlighting", "Something else"],
    },
  },
] as const;
