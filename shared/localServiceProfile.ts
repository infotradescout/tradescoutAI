export type LocalServiceProfileIcon =
  | "backflow"
  | "bath"
  | "construction"
  | "drain"
  | "gas"
  | "repair"
  | "water-heater";

export type LocalServiceProfilePresentation = {
  template: "local-service";
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  heroImage: string;
  heroImageAlt: string;
  logoImage: string;
  logoAlt: string;
  locationLabel: string;
  serviceNote: string;
  servicesEyebrow: string;
  servicesTitle: string;
  highlights: string[];
  services: Array<{
    title: string;
    description: string;
    icon: LocalServiceProfileIcon;
  }>;
  aboutTitle: string;
  aboutBody: string;
  aboutEyebrow: string;
  aboutImage?: string;
  aboutImageAlt?: string;
  serviceAreas: string[];
  serviceAreaDescription: string;
  galleryEyebrow: string;
  galleryTitle: string;
  galleryDescription: string;
  galleryShareText: string;
  credentialLabel: string;
  credentials: Array<{ label: string; value: string }>;
  credentialDisclosure: string;
  requestTitle: string;
  requestDescription: string;
  brand: {
    primary: string;
    primaryDark: string;
    surface: string;
    background: string;
  };
};

export const LA_PLUMBING_PROFILE_SLUG = "la-plumbing-solutions";

export const LA_PLUMBING_PROFILE_PRESENTATION: LocalServiceProfilePresentation = {
  template: "local-service",
  eyebrow: "Licensed · Family-owned · Residential + commercial",
  heroTitle: "Residential and commercial plumbers serving southeast Louisiana.",
  heroDescription:
    "Repairs, fixtures, drain cameras, backflow, gas, tank and tankless water heaters, renovations, and complete new-construction plumbing.",
  heroImage: "/images/businesses/la-plumbing-solutions/bathroom.jpg",
  heroImageAlt:
    "Finished freestanding bath and plumbing fixtures installed by LA Plumbing Solutions",
  logoImage: "/images/businesses/la-plumbing-solutions/logo.jpg",
  logoAlt: "LA Plumbing Solutions",
  locationLabel: "Hammond, Louisiana",
  serviceNote: "Licensed plumbing for homes, businesses, renovations, and new construction.",
  servicesEyebrow: "Complete plumbing service",
  servicesTitle: "From the first repair to a complete new system.",
  highlights: [
    "Master licensed plumbers",
    "Residential + commercial",
    "Tank + tankless specialists",
    "Project financing available",
  ],
  services: [
    {
      title: "Repairs & replacements",
      description:
        "Leaks, damaged piping, fixtures, and full system replacements handled with a clear plan.",
      icon: "repair",
    },
    {
      title: "Fixtures & appliances",
      description:
        "Professional installation for sinks, faucets, showers, toilets, dishwashers, and disposals.",
      icon: "bath",
    },
    {
      title: "Drain clearing & cleaning",
      description:
        "Drain clearing, camera locating, and hydro jetting for stubborn wastewater problems.",
      icon: "drain",
    },
    {
      title: "Backflow protection",
      description:
        "Backflow testing, prevention, and installation for homes and commercial properties.",
      icon: "backflow",
    },
    {
      title: "Water heaters",
      description:
        "Tank and tankless water-heater repair, installation, replacement, and conversion.",
      icon: "water-heater",
    },
    {
      title: "Water, sewer & gas",
      description:
        "Water lines, sewer and drainage systems, gas lines, leak detection, and tunneling.",
      icon: "gas",
    },
    {
      title: "New construction plumbing",
      description:
        "Code-conscious plumbing systems for residential and commercial projects from the ground up.",
      icon: "construction",
    },
    {
      title: "Kitchen & bath renovations",
      description:
        "Plumbing moves and modern fixture installation for kitchens, bathrooms, and utility rooms.",
      icon: "bath",
    },
  ],
  aboutTitle: "Family-owned and raised in the plumbing trade.",
  aboutBody:
    "LA Plumbing Solutions is a local, family-owned company founded by two brothers who grew up learning the plumbing trade from their father. Their team brings licensed plumbers, apprentices, and office support together so the work stays coordinated from the first request through the final follow-up.",
  aboutEyebrow: "The people behind the work",
  aboutImage: "/images/businesses/la-plumbing-solutions/family.jpg",
  aboutImageAlt: "A family moment shared by LA Plumbing Solutions",
  serviceAreas: ["Hammond", "Ponchatoula", "Baton Rouge", "Covington", "Mandeville", "Slidell"],
  serviceAreaDescription: "Based in Hammond and serving projects across southeast Louisiana.",
  galleryEyebrow: "Completed work",
  galleryTitle: "See their plumbing work.",
  galleryDescription: "These are examples of completed plumbing work—not products or inventory.",
  galleryShareText: "See this completed plumbing work",
  credentialLabel: "Credentials listed by LA Plumbing Solutions",
  credentials: [
    { label: "Commercial plumbing", value: "CL 75460" },
    { label: "Master plumbing", value: "LMP 8436" },
    { label: "Natural gas", value: "LMNGF 9933" },
    { label: "Backflow", value: "WSPS 20230920" },
    { label: "Boiler installation", value: "457" },
  ],
  credentialDisclosure:
    "TradeScout has reviewed this profile and its required provider credentials. Credential numbers are also published by LA Plumbing Solutions.",
  requestTitle: "Call now or send LA Plumbing the job details.",
  requestDescription:
    "Choose Call for a direct conversation, or fill out the form with the property, problem, timing, and photos. Form details stay private unless LA Plumbing accepts.",
  brand: {
    primary: "#1ba9dc",
    primaryDark: "#0878a6",
    surface: "#0d2430",
    background: "#061117",
  },
};

export const LA_PLUMBING_PROFILE_CONTENT_BLOCKS = [
  {
    type: "localServiceProfile",
    data: LA_PLUMBING_PROFILE_PRESENTATION,
  },
  {
    type: "gallery",
    data: {
      title: "Work in the field",
      description:
        "A look at plumbing systems, installations, and finished spaces completed by LA Plumbing Solutions.",
      images: [
        {
          id: "new-construction-rough-in",
          imageUrl: "/images/businesses/la-plumbing-solutions/new-construction.jpg",
          title: "New-construction plumbing rough-in",
          alt: "White plumbing lines installed in red soil for a new construction project",
          description: "Underground plumbing laid out before the foundation work continues.",
        },
        {
          id: "finished-bath-installation",
          imageUrl: "/images/businesses/la-plumbing-solutions/bathroom.jpg",
          title: "Finished bath installation",
          alt: "Freestanding bath with black fixtures in a finished tiled room",
          description: "A finished fixture installation in a remodeled bathroom.",
        },
        {
          id: "commercial-restroom-fixtures",
          imageUrl: "/images/businesses/la-plumbing-solutions/commercial-restroom.jpg",
          title: "Commercial restroom fixtures",
          alt: "Commercial restroom sinks, mirrors, and countertop",
          description: "Completed sink and fixture work in a commercial restroom.",
        },
        {
          id: "tankless-water-heater-system",
          imageUrl: "/images/businesses/la-plumbing-solutions/tankless.jpg",
          title: "Tankless water-heater system",
          alt: "Tankless water heater connected to copper lines and water filtration",
          description: "A tankless unit installed with organized copper piping and filtration.",
        },
        {
          id: "underground-drainage-installation",
          imageUrl: "/images/businesses/la-plumbing-solutions/underground.jpg",
          title: "Underground drainage installation",
          alt: "Plumber installing white drainage pipe in a construction area",
          description: "Drainage lines installed before the site is closed back in.",
        },
        {
          id: "trench-piping",
          imageUrl: "/images/businesses/la-plumbing-solutions/trench.jpg",
          title: "Trench piping",
          alt: "Plumbing lines installed in a deep soil trench",
          description: "Underground piping positioned and joined inside an open trench.",
        },
        {
          id: "mechanical-room-piping",
          imageUrl: "/images/businesses/la-plumbing-solutions/mechanical-room.jpg",
          title: "Mechanical-room piping",
          alt: "Copper piping and water-heater equipment in a mechanical room",
          description: "A coordinated mechanical-room installation with copper distribution lines.",
        },
        {
          id: "multi-unit-water-heaters",
          imageUrl: "/images/businesses/la-plumbing-solutions/water-heaters.jpg",
          title: "Multi-unit water-heater installation",
          alt: "Three water heaters connected in a utility room",
          description: "Multiple water-heater units installed for higher-capacity demand.",
        },
      ],
    },
  },
] as const;
