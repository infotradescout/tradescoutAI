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
      eyebrow: "Natural onyx · translucent stone",
      headerLabel: "Independent product · distributed by JW Stone",
      teaser: "Soft green and amber movement in daylight. Warm gold when the light comes on.",
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
        "Independently owned product",
        "Distributed by JW Stone",
        "Six source photos — no stock imagery",
        "Daylight and backlit views",
      ],
    },
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
          body: "Every image on this profile came from the source inventory folder. Open the gallery and compare all six before you ask about availability.",
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
        "Open the product to compare all six source photos. Share any individual view and its photo will become the link preview.",
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
              sourceNote:
                "Product identity confirmed by the TradeScout operator; photography preserved from the distributor source folder.",
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
          question: "Who handles distribution?",
          answer:
            "Honey Onyx is independently owned. JW Stone currently handles product distribution and availability inquiries.",
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
      heading: "Have a place in mind for Honey Onyx?",
      description:
        "Call the distributor or send the product, project, dimensions, timing, and location through one private Direct Connect.",
      contactOperatorName: HONEY_ONYX_DISTRIBUTOR_NAME,
      contactOperatorRole: "distributor",
      requestExamples: [
        "Product availability",
        "Slab dimensions",
        "Backlighting plans",
        "Fabrication questions",
      ],
      footerText:
        "Honey Onyx is independently owned and distributed by JW Stone. Your contact details stay private until the recipient accepts your request.",
    },
  },
] as const;
