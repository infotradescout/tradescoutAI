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

/** Close material views across the two distinct ISSA Build onyx offerings. */
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

export const ISSA_BUILD_PROFILE_CONTENT_BLOCKS = [
  {
    type: "hero",
    data: {
      eyebrow: "ISSA Build",
      headerLabel: "Luxury translucent onyx",
      teaser:
        "Honey Onyx and Multi Green Onyx for high-end interiors — two distinct, book-matched materials that glow when lit.",
    },
  },
  {
    type: "about",
    data: {
      text: "ISSA Build supplies premium, book-matched translucent onyx for luxury homes and interior design projects. Honey Onyx brings warm gold movement; Multi Green Onyx brings layered green character. Both are hand-finished and naturally translucent. The photos here show real ISSA Build installations and material — compare each offering before you start a conversation.",
    },
  },
  {
    type: "trust",
    data: {
      items: [
        "Honey Onyx and Multi Green Onyx",
        "Hand-finished slabs",
        "Real installation photography",
        "Private Direct Connect",
      ],
    },
  },
  {
    type: "premiumProduct",
    data: {
      variant: PREMIUM_PRODUCT_PROFILE_VARIANT,
      presentation: "horizontal-luxury-showcase",
      featuredProductSlug: "honey-onyx",
      offerings: {
        eyebrow: "Two distinct offerings",
        title: "Choose the onyx by character, not a blended label.",
        body: "Honey Onyx and Multi Green Onyx are separate ISSA Build materials. Open either collection to share its photos or carry that exact material into Direct Connect.",
        items: [
          {
            slug: "honey-onyx",
            eyebrow: "Warm translucent onyx",
            title: "Honey Onyx",
            body: "Golden, amber, and cream movement with a warm glow when backlit.",
            highlights: ["Book-matched", "Hand-finished", "Naturally translucent"],
          },
          {
            slug: "multi-green-onyx",
            eyebrow: "Layered green onyx",
            title: "Multi Green Onyx",
            body: "Green, ivory, and mineral movement with its own distinct translucent character.",
            highlights: ["Book-matched", "Hand-finished", "Naturally translucent"],
          },
        ],
      },
      contrast: {
        eyebrow: "Honey Onyx. Day and night.",
        title: "Warm movement in daylight. A deeper glow when lit.",
        body: "Honey Onyx changes as light moves through its amber, gold, and cream pattern. Compare real ISSA Build rooms and material before deciding where the glow belongs.",
        daylightLabel: "Installed daylight",
        backlitLabel: "Translucent glow",
        daylightImageIndex: 0,
        backlitImageIndex: 6,
      },
      gallery: {
        eyebrow: "Honey Onyx in the room",
        title: "See the warm material in real spaces.",
        body: "Bathrooms, kitchens, living rooms, and close material views — these are real ISSA Build Honey Onyx photos. Open any view you want to discuss.",
        portraitPhotoIndexes: [7],
        photos: [
          {
            label: "Bathroom",
            title: "Honey Onyx vanity and walls",
            body: "Warm Honey Onyx movement wrapping a bathroom as the focal finish.",
          },
          {
            label: "Kitchen",
            title: "Honey Onyx surfaces",
            body: "Warm translucent movement used as a kitchen statement surface.",
          },
          {
            label: "Kitchen",
            title: "Honey Onyx island",
            body: "A large Honey Onyx plane showing book-matched movement at room scale.",
          },
          {
            label: "Kitchen",
            title: "Book-matched Honey Onyx",
            body: "Natural movement carried across a high-impact kitchen application.",
          },
          {
            label: "Living",
            title: "Honey Onyx feature wall",
            body: "A large wall plane where warm translucent movement becomes the focal finish.",
          },
          {
            label: "Living",
            title: "Honey Onyx modular field",
            body: "Smaller square modules showing how the pattern repeats across a wall.",
          },
          {
            label: "Material",
            title: "Backlit Honey Onyx",
            body: "A close view of Honey Onyx with light passing through the material.",
          },
          {
            label: "Material",
            title: "Honey Onyx movement",
            body: "A second close material view for comparing color and natural variation.",
          },
        ],
      },
      applications: {
        eyebrow: "Where it earns attention",
        title: "Use translucent onyx where the room can respond.",
        body: "ISSA Build material is not background stone. It belongs where light, gathering, and first impressions matter.",
        items: [
          {
            title: "Bathrooms and vanities",
            body: "Turn wet areas into a warm, luminous focal finish.",
            imageIndex: 0,
          },
          {
            title: "Kitchens",
            body: "Honey Onyx for counters, islands, and statement back walls.",
            imageIndex: 1,
          },
          {
            title: "Feature walls",
            body: "One strong illuminated plane instead of competing finishes.",
            imageIndex: 4,
          },
          {
            title: "Living and hospitality",
            body: "Arrival and gathering spaces people remember.",
            imageIndex: 4,
          },
        ],
      },
      brief: {
        eyebrow: "From inspiration to a real answer",
        title: "Send the idea, not a perfect specification.",
        body: "Choose the photo you like, add rough dimensions, location, timing, and what you want the stone to do. Direct Connect gives you a call option or a private form.",
        steps: [
          "The photo you like",
          "Rough dimensions",
          "Project location and timing",
          "How you want to use or light it",
        ],
        note: "Availability, exact dimensions, fabrication, support, lighting, and final suitability still need to be confirmed for the project.",
      },
      closing: {
        eyebrow: "Ready when the idea is",
        title: "Put the right ISSA Build material in the conversation.",
        body: "Choose Honey Onyx or Multi Green Onyx, then send the project through Direct Connect. Your contact details stay private unless the request is accepted.",
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
          title: "Book-matched translucent onyx",
          body: "Premium slabs chosen for mirrored movement and high-end interior work.",
        },
        {
          title: "Hand-finished character",
          body: "A fully manual finish path that keeps the natural movement readable in the room.",
        },
        {
          title: "Two distinct onyx offerings",
          body: "Honey Onyx and Multi Green Onyx stay separate so every shared photo and request carries the right material context.",
        },
        {
          title: "One private path to answers",
          body: "Use Direct Connect for availability, dimensions, viewing, fabrication questions, or project matching.",
        },
      ],
    },
  },
  {
    type: "audience",
    data: {
      title: "Start with how you plan to use it",
      items: [
        {
          title: "Designers",
          body: "Compare installation photos and material views before specifying translucent onyx.",
        },
        {
          title: "Fabricators",
          body: "Send project dimensions and ask for the slab details needed to plan fabrication.",
        },
        {
          title: "Builders",
          body: "Check availability and timing early enough to coordinate with the rest of the project.",
        },
        {
          title: "Homeowners",
          body: "Share the room, idea, and photos. Direct Connect turns inspiration into a practical next step.",
        },
      ],
    },
  },
  {
    type: "inventoryCatalog",
    data: {
      title: "ISSA Build translucent onyx",
      description:
        "Open Honey Onyx or Multi Green Onyx to compare its real project and material photos. Share any individual view and its photo will become the link preview.",
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
          question: "What does ISSA Build supply?",
          answer:
            "ISSA Build supplies premium book-matched translucent onyx slabs for luxury interiors. Honey Onyx and Multi Green Onyx are two separate offerings suited to counters, walls, floors, and stairs.",
        },
        {
          question: "Are Honey Onyx and Multi Green Onyx the same material?",
          answer:
            "No. They are separate ISSA Build offerings with distinct color and movement. Choose the material and photo you mean before starting Direct Connect so the request keeps that context.",
        },
        {
          question: "What changes when the stone is backlit?",
          answer:
            "Honey and gold tones become brighter while darker movement creates contrast. The gallery includes room installations and material views so you can compare the effect before you ask about availability.",
        },
        {
          question: "Can I ask about a specific photo or room idea?",
          answer:
            "Yes. Open that photo, tap Direct Connect, and include the view you are interested in along with your dimensions, timing, and project location.",
        },
        {
          question: "How do I check availability?",
          answer:
            "Open Direct Connect and send the photo you like along with your dimensions, timing, and project location. You can also choose the call option for a faster answer.",
        },
      ],
    },
  },
  {
    type: "cta",
    data: {
      heading: "See ISSA Build stone in your project.",
      description:
        "Call or send the product, project, dimensions, timing, and location through one private Direct Connect.",
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
