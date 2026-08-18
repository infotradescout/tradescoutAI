export type LocalServiceProfileIcon =
  | "backflow"
  | "bath"
  | "construction"
  | "drain"
  | "gas"
  | "repair"
  | "water-heater";

export type LocalServiceCredential = {
  label: string;
  value: string;
  authority?: string;
  verificationUrl?: string;
  checkedAt?: string;
  statusLabel?: string;
  note?: string;
};

export type LocalServiceProfilePresentation = {
  template: "local-service";
  eyebrow: string;
  missionEyebrow?: string;
  missionStatement?: string;
  heroTitle: string;
  heroDescription: string;
  heroImage: string;
  heroImageAlt: string;
  logoImage: string;
  logoAlt: string;
  locationLabel: string;
  addressLabel?: string;
  websiteUrl?: string;
  directionsUrl?: string;
  primaryActionLabel?: string;
  callActionLabel?: string;
  websiteActionLabel?: string;
  directionsActionLabel?: string;
  serviceNote: string;
  servicesEyebrow: string;
  servicesTitle: string;
  highlights: string[];
  services: Array<{
    title: string;
    description: string;
    icon: LocalServiceProfileIcon;
  }>;
  serviceGroups?: Array<{
    eyebrow: string;
    title: string;
    description: string;
    imageUrl: string;
    imageAlt: string;
    services: string[];
  }>;
  aboutTitle: string;
  aboutBody: string;
  aboutEyebrow: string;
  commitments?: string[];
  aboutImage?: string;
  aboutImageAlt?: string;
  serviceAreas: string[];
  serviceAreaDescription: string;
  galleryEyebrow: string;
  galleryTitle: string;
  galleryDescription: string;
  galleryShareText: string;
  credentialLabel: string;
  credentials: LocalServiceCredential[];
  credentialDisclosure?: string;
  verificationHistoryNote?: string;
  sourceCheckedAt?: string;
  sourceSummary?: string;
  hoursLabel?: string;
  hoursNote?: string;
  financingTitle?: string;
  financingProvider?: string;
  financingDescription?: string;
  requestTitle: string;
  requestDescription?: string;
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
  eyebrow: "Residential + commercial plumbing",
  missionEyebrow: "The LA Plumbing promise",
  missionStatement: "Your comfort is our mission.",
  heroTitle: "Tell the team what is wrong. They will take it from there.",
  heroDescription:
    "Start with the problem, project, or property. LA Plumbing handles repairs, drains, water heaters, renovations, backflow, gas, and complete residential or commercial plumbing systems across southeast Louisiana.",
  heroImage: "/images/businesses/la-plumbing-solutions/hero.jpg",
  heroImageAlt: "LA Plumbing Solutions plumber installing a tankless water-heater system",
  logoImage: "/images/businesses/la-plumbing-solutions/logo.jpg",
  logoAlt: "LA Plumbing Solutions",
  locationLabel: "Hammond, Louisiana",
  addressLabel: "13073 Hwy 190 West, Hammond, LA 70401",
  websiteUrl: "https://www.laplumbingsolutions.com/",
  directionsUrl:
    "https://www.google.com/maps/search/?api=1&query=13073+Hwy+190+West+Hammond+LA+70401",
  primaryActionLabel: "Start a Request",
  callActionLabel: "Call LA Plumbing",
  websiteActionLabel: "Company Website",
  directionsActionLabel: "Get Directions",
  serviceNote:
    "Choose the closest job type. The request opens with room for the property, symptoms, timing, and photos.",
  servicesEyebrow: "Choose the job",
  servicesTitle: "Start with what needs to happen.",
  highlights: [
    "Verified TradeScout provider",
    "Residential + commercial",
    "Tank + tankless systems",
    "Financing through Hearth",
  ],
  services: [
    {
      title: "Repairs, leaks & replacements",
      description:
        "Leaks, damaged piping, fixtures, and full system replacements with the problem and options explained first.",
      icon: "repair",
    },
    {
      title: "Drains, sewer & diagnostics",
      description:
        "Drain clearing, camera locating, hydro jetting, sewer work, leak detection, and tunneling.",
      icon: "drain",
    },
    {
      title: "Water heaters & gas",
      description:
        "Tank and tankless repair, installation, replacement, conversion, gas lines, and related equipment.",
      icon: "water-heater",
    },
    {
      title: "Fixtures & renovations",
      description:
        "Sinks, faucets, showers, toilets, appliances, and plumbing changes for kitchens, baths, and utility rooms.",
      icon: "bath",
    },
    {
      title: "Backflow & system protection",
      description:
        "Backflow testing and prevention plus service and maintenance planning for homes and businesses.",
      icon: "backflow",
    },
    {
      title: "New construction plumbing",
      description:
        "Complete residential and commercial plumbing systems coordinated before walls and finishes close the work in.",
      icon: "construction",
    },
  ],
  serviceGroups: [
    {
      eyebrow: "Something is wrong",
      title: "Repair, diagnose, or protect the system",
      description:
        "Get the source of the problem identified, understand the next step, and avoid unnecessary disruption.",
      imageUrl: "/images/businesses/la-plumbing-solutions/underground.jpg",
      imageAlt: "Plumber installing underground drainage piping",
      services: [
        "Leaks, repairs, and full replacements",
        "Drain clearing, cameras, and hydro jetting",
        "Water, sewer, gas, and leak detection",
        "Backflow and maintenance planning",
      ],
    },
    {
      eyebrow: "Improve the property",
      title: "Water heating, fixtures, and renovations",
      description:
        "Coordinate the plumbing behind a more comfortable, efficient kitchen, bathroom, utility room, or whole property.",
      imageUrl: "/images/businesses/la-plumbing-solutions/bathroom.jpg",
      imageAlt: "Finished freestanding bath and plumbing fixtures",
      services: [
        "Tank and tankless water heaters",
        "Fixture and appliance installation",
        "Kitchen and bath renovations",
        "Efficiency upgrades and conversions",
      ],
    },
    {
      eyebrow: "Build from the ground up",
      title: "Residential and commercial construction",
      description:
        "Plan and install the complete plumbing system with the project team before late changes become expensive.",
      imageUrl: "/images/businesses/la-plumbing-solutions/new-construction.jpg",
      imageAlt: "Underground plumbing rough-in for new construction",
      services: [
        "New residential construction",
        "Commercial plumbing systems",
        "Underground water and drainage",
        "Mechanical rooms and multi-unit systems",
      ],
    },
  ],
  aboutTitle: "A family plumbing company built to answer the next call too.",
  aboutBody:
    "LA Plumbing Solutions is a local, family-owned company founded by two brothers who learned the trade from their father. Master plumbers, journeymen, apprentices, and office staff work as one team so scheduling, communication, installation, and follow-up stay coordinated instead of being passed between disconnected people.",
  aboutEyebrow: "The people behind the work",
  commitments: [
    "Explain the work before surprises appear",
    "Use modern tools when they reduce guesswork",
    "Coordinate scheduling, installation, and follow-up",
    "Treat the current job as the start of a long relationship",
  ],
  aboutImage: "/images/businesses/la-plumbing-solutions/family.jpg",
  aboutImageAlt: "A family moment shared by LA Plumbing Solutions",
  serviceAreas: ["Hammond", "Ponchatoula", "Baton Rouge", "Covington", "Mandeville", "Slidell"],
  serviceAreaDescription:
    "Based in Hammond and serving residential and commercial projects across southeast Louisiana.",
  galleryEyebrow: "Completed work",
  galleryTitle: "See the systems, not stock photography.",
  galleryDescription:
    "Selected residential, commercial, renovation, water-heating, and new-construction work published by LA Plumbing Solutions.",
  galleryShareText: "See this LA Plumbing Solutions project",
  credentialLabel: "Credential numbers and where to verify them",
  credentials: [
    {
      label: "Commercial plumbing",
      value: "CL 75460",
      authority: "Louisiana State Licensing Board for Contractors",
      verificationUrl: "https://lslbc.louisiana.gov/verify-licensure/",
      checkedAt: "August 18, 2026",
      statusLabel: "Confirm current status with LSLBC",
    },
    {
      label: "Master plumbing",
      value: "LMP 8436",
      authority: "State Plumbing Board of Louisiana",
      verificationUrl: "https://www.spbla.com/",
      checkedAt: "August 18, 2026",
      statusLabel: "Published by LA Plumbing; verify with the board",
    },
    {
      label: "Natural gas",
      value: "LMNGF 9933",
      authority: "State Plumbing Board of Louisiana",
      verificationUrl: "https://www.spbla.com/",
      checkedAt: "August 18, 2026",
      statusLabel: "Published by LA Plumbing; verify with the board",
    },
    {
      label: "Backflow",
      value: "WSPS 20230920",
      authority: "State Plumbing Board of Louisiana",
      verificationUrl: "https://www.spbla.com/",
      checkedAt: "August 18, 2026",
      statusLabel: "Published by LA Plumbing; verify with the board",
    },
    {
      label: "Boiler installation",
      value: "457",
      authority: "Published by LA Plumbing Solutions",
      checkedAt: "August 18, 2026",
      statusLabel: "Confirm the applicable authority before regulated work",
    },
  ],
  credentialDisclosure:
    "LA Plumbing publishes these credential numbers on its current company website. TradeScout shows the source and review date; confirm current status with the issuing authority before regulated work.",
  verificationHistoryNote:
    "The verified profile confirms the TradeScout business identity and onboarding record. It is not a substitute for a current license lookup for a specific regulated job.",
  sourceCheckedAt: "August 18, 2026",
  sourceSummary:
    "Current facts use the company’s active www website and the Tangipahoa Chamber listing. Older non-www pages still show a former Fox Hollow address and 24/7 hours; those legacy claims are intentionally excluded.",
  hoursLabel: "Office hours · Monday–Friday · 7:00am–4:00pm",
  hoursNote:
    "The current company website lists weekends closed. For urgent needs outside office hours, use the call option to confirm availability rather than assuming 24/7 service.",
  financingTitle: "Explore project financing through Hearth.",
  financingProvider: "Hearth",
  financingDescription:
    "LA Plumbing’s current website connects qualifying customers to Hearth for personalized payment options. Eligibility, lender offers, rates, and funding terms are handled by Hearth and participating lenders and can change.",
  requestTitle: "Put the plumbing problem in front of the right team.",
  requestDescription:
    "Start a Request with the property, problem, timing, and photos. Choose the call option in the next panel when a direct conversation is the better first step.",
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
