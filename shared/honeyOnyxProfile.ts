import {
  PREMIUM_PRODUCT_PROFILE_VARIANT,
  type PremiumProductProfileData,
} from "./premiumProductProfile";

export const HONEY_ONYX_PROFILE_SLUG = "honey-onyx";

export const HONEY_ONYX_DISTRIBUTOR_NAME = "JW Stone";

export const HONEY_ONYX_PROFILE_IMAGES = [
  "/images/businesses/honey-onyx/2.jpg",
  "/images/businesses/honey-onyx/6.jpg",
  "/images/businesses/honey-onyx/1.webp",
  "/images/businesses/honey-onyx/3.jpg",
  "/images/businesses/honey-onyx/4.jpg",
  "/images/businesses/honey-onyx/5.jpg",
] as const;

export const HONEY_ONYX_PROFILE_CONTENT_BLOCKS = [
  {
    type: "hero",
    data: {
      eyebrow: "Translucent natural stone",
      headerLabel: "Natural stone collection",
      teaser: "Natural movement by day. A warm golden glow when the light comes on.",
    },
  },
  {
    type: "about",
    data: {
      text: "Honey Onyx changes with the room around it. In natural light, the stone shows soft green, cream, amber, and rust movement. Backlit, it glows warm gold and turns a surface into the focal point. The six photos here show the actual material in both lighting conditions, so you can judge the character before starting a conversation.",
    },
  },
  {
    type: "trust",
    data: {
      items: [
        "Six real material photos",
        "Daylight and backlit views",
        "Project-ready conversations",
        "Private Direct Connect",
      ],
    },
  },
  {
    type: "premiumProduct",
    data: {
      variant: PREMIUM_PRODUCT_PROFILE_VARIANT,
      contrast: {
        eyebrow: "One stone. Two atmospheres.",
        title: "Cool and sculptural by day. Warm and luminous after dark.",
        body: "The same movement reads completely differently when light passes through it. Compare the actual material—not a rendering—before deciding where the drama belongs.",
        daylightLabel: "Natural light",
        backlitLabel: "Backlit",
        daylightImageIndex: 2,
        backlitImageIndex: 0,
      },
      gallery: {
        eyebrow: "The actual material",
        title: "Pick the view that stopped you.",
        body: "Six real photos, in real lighting. Open any one full screen or share that exact view with the people helping plan the project.",
      },
      applications: {
        eyebrow: "Ideas worth exploring",
        title: "Use the glow where it earns attention.",
        body: "Honey Onyx is not background material. It makes the most sense where the stone can become part of the lighting and the room can respond to it.",
        items: [
          {
            title: "Bar fronts",
            body: "Turn the face of a bar into a warm source of light and a natural gathering point.",
            imageIndex: 0,
          },
          {
            title: "Feature walls",
            body: "Create one strong illuminated plane instead of filling the room with competing finishes.",
            imageIndex: 1,
          },
          {
            title: "Vanities and counters",
            body: "Let the green, cream, amber, and rust movement lead in daylight, then change after dark.",
            imageIndex: 2,
          },
          {
            title: "Reception and hospitality",
            body: "Give arrival spaces a focal point people remember without relying on a temporary trend.",
            imageIndex: 3,
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
        title: "Put Honey Onyx in the conversation.",
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
          title: "Two completely different moods",
          body: "Cool and organic in daylight; warm and luminous when backlit. The material can change the feeling of the entire room.",
        },
        {
          title: "See the real material",
          body: "Every image shows the actual material. Open the gallery and compare all six before you ask about availability.",
        },
        {
          title: "Made to be the focal point",
          body: "A strong option for bars, feature walls, vanities, reception desks, and other surfaces meant to be noticed.",
        },
        {
          title: "One private path to answers",
          body: "Use Direct Connect for availability, dimensions, slab viewing, fabrication questions, or help matching the stone to a project.",
        },
      ],
    },
  },
  {
    type: "audience",
    data: {
      title: "Start with the way you plan to use it",
      items: [
        {
          title: "Designers",
          body: "Compare the daylight and backlit views before specifying Honey Onyx for a focal surface.",
        },
        {
          title: "Fabricators",
          body: "Send the project dimensions and ask for the slab details needed to plan fabrication.",
        },
        {
          title: "Builders",
          body: "Check availability and timing early enough to coordinate the material with the rest of the project.",
        },
        {
          title: "Homeowners",
          body: "Share the room, idea, and photos. Direct Connect will help turn the inspiration into a practical next step.",
        },
      ],
    },
  },
  {
    type: "inventoryCatalog",
    data: {
      title: "See Honey Onyx in both kinds of light",
      description:
        "Open the product to compare all six real photos. Share any individual view and its photo will become the link preview.",
      categories: [
        {
          category: "Onyx",
          categorySlug: "onyx",
          stones: [
            {
              name: "Honey Onyx",
              slug: "honey-onyx",
              images: HONEY_ONYX_PROFILE_IMAGES,
              materialStatus: "user_confirmed",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceNote:
                "Six real material photos show Honey Onyx in both daylight and backlit conditions.",
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
          question: "What changes when Honey Onyx is backlit?",
          answer:
            "The amber and gold tones become much brighter while the darker movement creates contrast. The gallery includes natural-light and backlit views of the same product so you can compare them directly.",
        },
        {
          question: "Can I ask about the exact slab or photo I like?",
          answer:
            "Yes. Open that photo, tap Direct Connect, and include the view you are interested in along with your dimensions, timing, and project location.",
        },
        {
          question: "How do I check availability?",
          answer:
            "Open Direct Connect and send the photo you like along with your dimensions, timing, and project location. You can also choose the call option for a faster answer.",
        },
        {
          question: "Where can this material be used?",
          answer:
            "Common focal-point ideas include bars, feature walls, vanities, reception desks, and illuminated panels. Final suitability depends on the application and fabrication plan.",
        },
      ],
    },
  },
  {
    type: "cta",
    data: {
      heading: "See Honey Onyx in your project.",
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
