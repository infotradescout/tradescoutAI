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

/** Close material views for the Honey Green / honey translucent onyx product. */
export const ISSA_BUILD_SLAB_IMAGES = [
  "/images/businesses/issa-build/slabs/2.jpg",
  "/images/businesses/issa-build/slabs/6.jpg",
  "/images/businesses/issa-build/slabs/1.webp",
  "/images/businesses/issa-build/slabs/3.jpg",
  "/images/businesses/issa-build/slabs/4.jpg",
  "/images/businesses/issa-build/slabs/5.jpg",
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
        "Premium book-matched onyx slabs for high-end interiors — honey and jade tones that glow when the light comes on.",
    },
  },
  {
    type: "about",
    data: {
      text: "ISSA Build supplies premium, book-matched translucent onyx for luxury homes and interior design projects. The material reads soft honey and jade in daylight, then turns luminous when backlit. Each slab is hand-finished so the natural movement stays intact. The photos here show real installations and the actual stone — judge the character before you start a conversation.",
    },
  },
  {
    type: "trust",
    data: {
      items: [
        "Book-matched translucent onyx",
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
      contrast: {
        eyebrow: "Honey and jade. Day and night.",
        title: "Cool movement in daylight. Warm glow when lit.",
        body: "Translucent honey and light-green jade tones make the same slab feel completely different once light passes through it. Compare real rooms and real material before deciding where the drama belongs.",
        daylightLabel: "Installed daylight",
        backlitLabel: "Translucent glow",
        daylightImageIndex: 0,
        backlitImageIndex: 2,
      },
      gallery: {
        eyebrow: "In the room",
        title: "See how the stone lands in real spaces.",
        body: "Bathrooms, kitchens, living rooms, and entertainment walls — these are ISSA Build project photos of Honey Green translucent onyx. Open any view you want to discuss.",
        photos: [
          {
            label: "Bathroom",
            title: "Honey Green vanity and walls",
            body: "Warm honey movement wrapping a bathroom as the focal finish.",
          },
          {
            label: "Bathroom",
            title: "Translucent bath feature",
            body: "Backlit and translucent character in a wet-area application.",
          },
          {
            label: "Entertainment",
            title: "Feature wall glow",
            body: "A living / entertainment plane where translucency becomes the light source.",
          },
          {
            label: "Kitchen",
            title: "Honey kitchen surfaces",
            body: "Honey-toned translucent onyx working as a kitchen statement surface.",
          },
          {
            label: "Living",
            title: "Living-room rectangle field",
            body: "A large rectangular plane showing book-matched movement at room scale.",
          },
          {
            label: "Living",
            title: "Living-room modular field",
            body: "Smaller square modules showing how the pattern repeats across a wall.",
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
            body: "Honey and jade movement for counters, islands, and back walls.",
            imageIndex: 3,
          },
          {
            title: "Feature walls",
            body: "One strong illuminated plane instead of competing finishes.",
            imageIndex: 2,
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
        title: "Put ISSA Build in the conversation.",
        body: "Call now or send the project through Direct Connect. Your contact details stay private unless the request is accepted.",
        imageIndex: 1,
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
          title: "Honey and jade tones",
          body: "Translucent honey and light-green jade color suited to counters, walls, floors, and stairs.",
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
      title: "Honey Green translucent onyx",
      description:
        "Open the product to compare installation and material photos. Share any individual view and its photo will become the link preview.",
      categories: [
        {
          category: "Onyx",
          categorySlug: "onyx",
          stones: [
            {
              name: "Honey Green Onyx",
              slug: "honey-green-onyx",
              images: [...ISSA_BUILD_PROFILE_IMAGES, ...ISSA_BUILD_SLAB_IMAGES],
              materialStatus: "user_confirmed",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceNote:
                "ISSA Build photography shows Honey Green translucent onyx in installed rooms and close material views.",
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
            "ISSA Build supplies premium book-matched translucent onyx slabs for luxury interiors — including honey and jade (light green) colorways suited to counters, walls, floors, and stairs.",
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
        "Product availability",
        "Slab dimensions",
        "Backlighting plans",
        "Fabrication questions",
      ],
      footerText: "Your contact details stay private until the recipient accepts your request.",
    },
  },
] as const;
