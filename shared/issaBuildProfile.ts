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
      text: "ISSA Build presents two translucent onyxes as luxury materials — Honey Onyx in amber and gold, Multi Green Onyx in layered green and ivory. Each is hand-finished. The photography is real. Choose the material that belongs in the room, then inquire privately.",
    },
  },
  {
    type: "trust",
    data: {
      items: ["Honey Onyx", "Multi Green Onyx", "Hand-finished", "Private inquiry"],
    },
  },
  {
    type: "premiumProduct",
    data: {
      variant: PREMIUM_PRODUCT_PROFILE_VARIANT,
      presentation: "horizontal-luxury-showcase",
      featuredProductSlug: "honey-onyx",
      offerings: {
        eyebrow: "The collection",
        title: "Two materials. Absolute clarity.",
        body: "Select Honey Onyx or Multi Green Onyx to enter its lookbook.",
        items: [
          {
            slug: "honey-onyx",
            eyebrow: "Honey Onyx",
            title: "Honey Onyx",
            body: "Amber, gold, and cream — luminous when light moves through.",
            highlights: ["Translucent", "Hand-finished"],
          },
          {
            slug: "multi-green-onyx",
            eyebrow: "Multi Green Onyx",
            title: "Multi Green Onyx",
            body: "Green, ivory, and mineral depth — its own translucent presence.",
            highlights: ["Translucent", "Hand-finished"],
          },
        ],
      },
      contrast: {
        eyebrow: "Honey Onyx",
        title: "By day. By light.",
        body: "The same slab shifts from quiet warmth to glowing depth. See it installed. See it close.",
        daylightLabel: "Daylight",
        backlitLabel: "Illuminated",
        daylightImageIndex: 0,
        backlitImageIndex: 6,
      },
      gallery: {
        eyebrow: "Lookbook",
        title: "The stone in situ.",
        body: "Editorial views from ISSA Build projects. Expand any frame.",
        portraitPhotoIndexes: [7],
        photos: [
          { label: "Bath", title: "Private suite", body: "Honey Onyx as the room’s quiet drama." },
          { label: "Kitchen", title: "Statement plane", body: "Warm translucence at counter scale." },
          { label: "Kitchen", title: "Island", body: "A continuous field of amber movement." },
          { label: "Kitchen", title: "Matched face", body: "Natural rhythm across a single application." },
          { label: "Living", title: "Feature wall", body: "One illuminated surface. Nothing competing." },
          { label: "Living", title: "Modular field", body: "Pattern repeating as architecture." },
          { label: "Atelier", title: "Backlit", body: "Light through Honey Onyx." },
          { label: "Atelier", title: "Detail", body: "Color and variation, close." },
        ],
      },
      applications: {
        eyebrow: "Placement",
        title: "Where presence matters.",
        body: "Suites, kitchens, walls, arrival.",
        items: [
          { title: "Suites & vanities", body: "Intimate, luminous finishes.", imageIndex: 0 },
          { title: "Kitchens", body: "Surfaces that hold the room.", imageIndex: 1 },
          { title: "Feature walls", body: "A single illuminated plane.", imageIndex: 4 },
          { title: "Living & hospitality", body: "Spaces people remember.", imageIndex: 4 },
        ],
      },
      brief: {
        eyebrow: "Inquiry",
        title: "Begin with the image.",
        body: "Share the frame, scale, place, and timing. Direct Connect stays private until accepted.",
        steps: ["The image", "Approximate scale", "Place and timing", "How it should live with light"],
        note: "Availability, dimensions, fabrication, and lighting are confirmed for each project.",
      },
      closing: {
        eyebrow: "ISSA Build",
        title: "Request the material.",
        body: "Honey Onyx or Multi Green Onyx — one private Direct Connect. Your details stay private until accepted.",
        imageIndex: 2,
        imageFit: "cover",
      },
    } satisfies PremiumProductProfileData,
  },
  {
    type: "differentiators",
    data: {
      items: [
        {
          title: "Honey Onyx",
          body: "Warm amber and gold translucence for surfaces that deserve light.",
        },
        {
          title: "Multi Green Onyx",
          body: "Layered green and ivory — kept as its own collection.",
        },
        {
          title: "Hand-finished",
          body: "Movement left readable. Craft over commodity.",
        },
        {
          title: "Private Direct Connect",
          body: "Availability, scale, viewing, fabrication — one quiet path.",
        },
      ],
    },
  },
  {
    type: "audience",
    data: {
      title: "For those who specify with care",
      items: [
        { title: "Designers", body: "See the material before the specification." },
        { title: "Fabricators", body: "Ask with dimensions in hand." },
        { title: "Builders", body: "Confirm timing early." },
        { title: "Principals", body: "Share the room. Inquire privately." },
      ],
    },
  },
  {
    type: "inventoryCatalog",
    data: {
      title: "ISSA Build",
      description: "Honey Onyx and Multi Green Onyx. Share any frame as the preview.",
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
      faqs: [
        {
          question: "What does ISSA Build offer?",
          answer:
            "Honey Onyx and Multi Green Onyx — translucent luxury stone for interiors: walls, counters, floors, stairs.",
        },
        {
          question: "Are Honey Onyx and Multi Green Onyx the same?",
          answer:
            "No. Separate materials, separate lookbooks. Choose before you inquire so the request keeps that context.",
        },
        {
          question: "How does lighting change the stone?",
          answer:
            "Warm tones lift; darker movement deepens. The lookbook shows rooms and close views first.",
        },
        {
          question: "How do I inquire?",
          answer:
            "Direct Connect with the image, scale, timing, and place — or the call option when you need speed.",
        },
      ],
    },
  },
  {
    type: "cta",
    data: {
      heading: "Request ISSA Build.",
      description: "One private Direct Connect for material, scale, timing, and place.",
      requestExamples: [
        "Request material",
        "Match stone to a project",
        "Ask about a bundle",
        "Schedule a showroom visit",
        "Something else",
      ],
      footerText: "Your contact details stay private until the recipient accepts your request.",
    },
  },
] as const;
