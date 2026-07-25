import {
  PREMIUM_PRODUCT_PROFILE_VARIANT,
  type PremiumProductProfileData,
} from "./premiumProductProfile";

/** Canonical public business profile for ISSA Build. */
export const ISSA_BUILD_PROFILE_SLUG = "issa-build";

/** Previous product-only URL; provisioning migrates this slug to ISSA Build. */
export const ISSA_BUILD_LEGACY_PROFILE_SLUG = "honey-onyx";

export const ISSA_BUILD_BUSINESS_NAME = "ISSA Build";

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
        body: "Honey Onyx and Multi Green Onyx — separate materials for residential and commercial interiors.",
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
          // Schema-retained; lux UI shows body only (no eyebrow/title).
          eyebrow: "",
          title: "",
          body: "Translucent onyx shows its depth when the material and how it is illuminated are planned together. We take projects from selection and customization through installation so the finished surface fits the space.",
          image: ISSA_BUILD_APPLICATION_IMAGES[2],
        },
        materialChapters: [
          {
            slug: "honey-onyx",
            name: "Honey Onyx",
            eyebrow: "HONEY ONYX",
            title: "Warm, luminous, unmistakable.",
            body: "Golden movement and soft translucency for baths, bars, kitchens, feature walls, and statement interiors.",
            applicationImage: ISSA_BUILD_APPLICATION_IMAGES[4],
            // Schema-retained for Direct Connect / deep-link identity; slabs render in materialSamples rail.
            detailImage: ISSA_BUILD_SLAB_IMAGES[0],
          },
          {
            slug: "multi-green-onyx",
            name: "Multi Green Onyx",
            eyebrow: "MULTI GREEN ONYX",
            title: "A deeper architectural tone.",
            body: "Layered green movement for bathrooms, feature walls, and custom interiors shaped around the stone.",
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
            { title: "Project consultation", body: "" },
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
          note: "",
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
        note: "",
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
    // Identity + Direct Connect resolution only — not a public inventory browser.
    type: "inventoryCatalog",
    data: {
      title: "ISSA Build",
      description: "Honey Onyx and Multi Green Onyx.",
      categories: [
        {
          category: "Onyx",
          categorySlug: "onyx",
          stones: [
            {
              name: "Honey Onyx",
              slug: "honey-onyx",
              images: [...ISSA_BUILD_HONEY_ONYX_IMAGES],
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
      faqs: [] as Array<{ question: string; answer: string }>,
    },
  },
  {
    type: "cta",
    data: {
      heading: "Start with the room.",
      description:
        "Tell us the space, dimensions, location, schedule, and whether you are considering backlighting.",
      requestExamples: ["Discuss your project", "Ask about backlighting", "Something else"],
      footerText: "",
    },
  },
] as const;
