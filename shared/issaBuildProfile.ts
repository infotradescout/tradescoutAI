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
 * ISSA Build public copy — luxury-house voice.
 * Honey Onyx and Multi Green Onyx stay distinct. No catalog spam.
 */
export const ISSA_BUILD_PROFILE_CONTENT_BLOCKS = [
  {
    type: "hero",
    data: {
      eyebrow: "Luxury translucent onyx",
      headerLabel: "ISSA Build",
      teaser: "Honey Onyx. Multi Green Onyx. Crafted for light.",
    },
  },
  {
    type: "about",
    data: {
      text: "Two translucent onyxes. Choose the material, then inquire privately.",
    },
  },
  {
    // Intentionally empty on the public luxury path — no fact-pill clutter.
    type: "trust",
    data: {
      items: [] as string[],
    },
  },
  {
    type: "premiumProduct",
    data: {
      variant: PREMIUM_PRODUCT_PROFILE_VARIANT,
      presentation: "horizontal-luxury-showcase",
      featuredProductSlug: "honey-onyx",
      offerings: {
        eyebrow: "Lookbook",
        title: "The collection.",
        body: "Honey Onyx or Multi Green Onyx.",
        items: [
          {
            slug: "honey-onyx",
            eyebrow: "Honey Onyx",
            title: "Honey Onyx",
            body: "Amber and gold translucence.",
            highlights: ["Translucent"],
          },
          {
            slug: "multi-green-onyx",
            eyebrow: "Multi Green Onyx",
            title: "Multi Green Onyx",
            body: "Green and ivory depth.",
            highlights: ["Translucent"],
          },
        ],
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
        eyebrow: "Lookbook",
        title: "In situ.",
        body: "",
        portraitPhotoIndexes: [7],
        photos: [
          { label: "Bath", title: "Private suite", body: "" },
          { label: "Kitchen", title: "Statement plane", body: "" },
          { label: "Kitchen", title: "Island", body: "" },
          { label: "Kitchen", title: "Matched face", body: "" },
          { label: "Living", title: "Feature wall", body: "" },
          { label: "Living", title: "Modular field", body: "" },
          { label: "Atelier", title: "Backlit", body: "" },
          { label: "Atelier", title: "Detail", body: "" },
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
        eyebrow: "Inquiry",
        title: "Inquire",
        body: "Image, scale, place, timing — one private Direct Connect.",
        steps: ["Image", "Scale", "Place", "Timing"],
        note: "",
      },
      closing: {
        eyebrow: "ISSA Build",
        title: "Inquire privately.",
        body: "Select Honey Onyx or Multi Green Onyx. Direct Connect stays private until accepted.",
        imageIndex: 2,
        imageFit: "cover",
      },
    } satisfies PremiumProductProfileData,
  },
  {
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
      heading: "Inquire privately.",
      description: "One Direct Connect for material, scale, timing, and place.",
      requestExamples: ["Request material", "Match to a project", "Something else"],
      footerText: "Contact details stay private until accepted.",
    },
  },
] as const;
