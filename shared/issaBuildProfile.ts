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
 * ISSA Build public copy — luxury-material-house voice.
 * Honey Onyx and Multi Green Onyx stay distinct. No catalog spam.
 * inventoryCatalog remains for Direct Connect / material identity only.
 */
export const ISSA_BUILD_PROFILE_CONTENT_BLOCKS = [
  {
    type: "hero",
    data: {
      // Editor title ↔ headerLabel (H1). Editor text ↔ teaser.
      // Sticky brand uses displayName; subtitle uses eyebrow — never repeat the brand as H1.
      eyebrow: "ISSA BUILD · TRANSLUCENT ONYX",
      headerLabel: "Crafted for light.",
      teaser: "Honey Onyx and Multi Green Onyx for interiors designed to glow.",
    },
  },
  {
    type: "about",
    data: {
      text: "Translucent onyx for interiors designed to glow — private project consultation through Direct Connect.",
    },
  },
  {
    // Sparse trust line only — no catalog / stoneyard fact spam.
    type: "trust",
    data: {
      items: ["Honey Onyx · Multi Green Onyx", "Private Direct Connect"] as string[],
    },
  },
  {
    type: "premiumProduct",
    data: {
      variant: PREMIUM_PRODUCT_PROFILE_VARIANT,
      presentation: "luxury-material-house",
      featuredProductSlug: "honey-onyx",
      // Legacy fields retained for schema compatibility; public path uses luxuryHouse.
      offerings: {
        eyebrow: "Materials",
        title: "Two translucent onyxes.",
        body: "Honey Onyx and Multi Green Onyx — separate materials for interiors designed with light.",
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
            body: "Layered green depth that comes alive with light.",
            highlights: ["Translucent"],
          },
        ],
      },
      luxuryHouse: {
        designedWithLight: {
          eyebrow: "Atmosphere",
          title: "Designed with light.",
          body: "When translucent onyx is illuminated, the room changes. Warmth moves through the stone, edges soften, and an installed interior takes on a quiet glow that photographs cannot fully hold.",
          image: ISSA_BUILD_APPLICATION_IMAGES[2],
        },
        materialChapters: [
          {
            slug: "honey-onyx",
            name: "Honey Onyx",
            eyebrow: "Material chapter",
            body: "Amber translucence for suites, walls, and islands meant to glow from within.",
            applicationImage: ISSA_BUILD_APPLICATION_IMAGES[4],
            detailImage: ISSA_BUILD_SLAB_IMAGES[0],
          },
          {
            slug: "multi-green-onyx",
            name: "Multi Green Onyx",
            eyebrow: "Material chapter",
            body: "Layered green depth for feature walls and custom installations shaped by light.",
            applicationImage: ISSA_BUILD_APPLICATION_IMAGES[0],
            detailImage: ISSA_BUILD_SLAB_IMAGES[2],
          },
        ],
        capabilities: {
          eyebrow: "From stone to space",
          title: "From stone to space.",
          body: "ISSA Build carries onyx from material into installed interiors — light, custom work, and private consultation.",
          items: [
            {
              title: "Custom onyx installation",
              body: "Installed interiors planned around how the stone meets the room.",
            },
            {
              title: "Backlighting solutions",
              body: "Illumination designed so translucent onyx can glow as atmosphere.",
            },
            {
              title: "Onyx customization",
              body: "Cuts, matches, and detailing shaped to the project — not a catalog pick.",
            },
            {
              title: "Project consultation",
              body: "A private conversation about material, application, scale, and timing.",
            },
          ],
        },
        showcase: {
          eyebrow: "Projects",
          title: "Curated project showcase.",
          body: "Installed spaces where translucent onyx becomes the light in the room.",
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
        consultation: {
          eyebrow: "Private consultation",
          title: "Private project consultation.",
          body: "Tell ISSA Build what you are creating.",
          prompt: "Tell ISSA Build what you are creating.",
          fields: [
            "Selected material",
            "Room / application",
            "Dimensions",
            "Location",
            "Timing",
            "Backlighting intent",
          ],
          note: "Contact details stay private until accepted. Direct Connect carries material and source context.",
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
        title: "Discuss a project",
        body: "Material, room, scale, place, timing, and backlighting — one private Direct Connect.",
        steps: [
          "Selected material",
          "Room / application",
          "Dimensions",
          "Location",
          "Timing",
          "Backlighting intent",
        ],
        note: "Contact details stay private until accepted.",
      },
      closing: {
        eyebrow: "Direct Connect",
        title: "Discuss a project.",
        body: "Honey Onyx or Multi Green Onyx. Private until accepted.",
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
      heading: "Discuss a project.",
      description:
        "Tell ISSA Build what you are creating — material, room, scale, place, timing, and light.",
      requestExamples: ["Discuss a project", "Ask about backlighting", "Something else"],
      footerText: "Contact details stay private until accepted.",
    },
  },
] as const;
