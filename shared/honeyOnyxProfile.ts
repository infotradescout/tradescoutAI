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
