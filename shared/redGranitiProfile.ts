export const RED_GRANITI_PROFILE_SLUG = "red-graniti";
export const RED_GRANITI_BUSINESS_NAME = "R.E.D. Graniti";
export const RED_GRANITI_PROFILE_CONTROL = "tradescout_admin_controlled";

export const RED_GRANITI_OFFICIAL_WEBSITE = "https://www.redgraniti.com/en/";
export const RED_GRANITI_QUARRIES_URL = "https://www.redgraniti.com/en/quarries/";
export const RED_GRANITI_GROUP_URL =
  "https://www.redgraniti.com/en/r-e-d-graniti-group/";
export const RED_GRANITI_BLOCKS_AND_SLABS_URL =
  "https://www.redgraniti.com/en/r-e-d-graniti-group/red-quarries-blocks-and-slabs/";

/** Owner-supplied company mark, hosted locally so the profile never depends on a hotlink. */
export const RED_GRANITI_LOGO_URL =
  "/images/businesses/red-graniti/logo/red-graniti.png";
export const RED_GRANITI_OFFICIAL_LOGO_SOURCE_URL =
  "https://www.redgraniti.com/wp-content/uploads/2016/01/logored78x78.png";

export const RED_GRANITI_OFFICIAL_SOURCES = [
  RED_GRANITI_OFFICIAL_WEBSITE,
  RED_GRANITI_QUARRIES_URL,
  RED_GRANITI_GROUP_URL,
  RED_GRANITI_BLOCKS_AND_SLABS_URL,
] as const;

/**
 * The public profile is controlled by TradeScout. This is the visible managed
 * contact for calls and email; the R.E.D. corporate address remains company
 * information rather than the operating response destination.
 */
export const RED_GRANITI_MANAGED_CONTACT = {
  label: "TradeScout managed contact",
  heading: "R.E.D. Graniti inquiries",
  phone: "(850) 543-0748",
  tel: "+18505430748",
  email: "contact@thetradescout.com",
  description: "Calls and messages from this profile are handled through TradeScout.",
} as const;

/**
 * Official source-region imagery cached into TradeScout during the production
 * build. Local delivery prevents CSP and source-site hotlink failures while
 * every card remains linked to the corresponding official quarry page.
 */
export const RED_GRANITI_QUARRY_MEDIA = {
  madagascar: {
    imageUrl: "/images/businesses/red-graniti/source/lemurian-blue.svg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/lemurian-blue/",
  },
  southAfrica: {
    imageUrl: "/images/businesses/red-graniti/source/nero-africa.svg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/nero-africa-rustenburg/",
  },
  vermont: {
    imageUrl: "/images/businesses/red-graniti/source/eureka-danby.svg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/eureka-danbycalacatta-danby/",
  },
} as const;

export const RED_GRANITI_PUBLIC_IDENTITY = {
  brandName: RED_GRANITI_BUSINESS_NAME,
  legalName: "R.E.D. Graniti S.p.A.",
  legalId: "P.IVA 13161430155",
  locationLabel: "Massa, Italy",
  profileLabel: "Quarries, blocks and slabs",
  headline: "Quarries, blocks and slabs",
  summary:
    "For more than 50 years, R.E.D. Graniti has supplied rough blocks and slabs from company-owned quarries across leading stone regions worldwide.",
  about:
    "R.E.D. Graniti built its business around the quality of natural stone from controlled production sources. Its network connects quarry production, block yards, slab processing, and distribution in the world's main stone markets.",
  qualityStatement:
    "Every block is checked, controlled, and cataloged. Slabs follow the same quality standards, checks, and selection process used for rough blocks.",
  headquarters: {
    label: "Headquarters",
    addressLine1: "Via Dorsale 12",
    addressLine2: "54100 Massa, Italy",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Via%20Dorsale%2012%2C%2054100%20Massa%2C%20Italy",
  },
  operatingLocations: [
    {
      label: "Massa headquarters and block yard",
      location: "Massa, Italy",
      detail:
        "Sales and accounting offices beside a 60,000 m² yard with an average of 30,000 m³ of blocks ready for viewing and selection.",
    },
    {
      label: "Dolcè block yard",
      location: "Verona, Italy",
      detail: "A second Italian block yard with average availability of about 12,000 m³ of material.",
    },
    {
      label: "Cavaion Veronese slab warehouse",
      location: "Verona, Italy",
      detail: "An 8,500 m² warehouse used to store slabs ready for sale.",
    },
  ],
  stats: [
    { value: "50+", label: "years in natural stone" },
    { value: "4", label: "continents with group presence" },
    { value: "9", label: "countries with company-owned quarries" },
    { value: "16", label: "production companies worldwide" },
  ],
  capabilities: [
    {
      title: "Rough blocks",
      shortLabel: "Blocks",
      description:
        "Blocks from company-owned quarries are checked, controlled, cataloged, and selected for consistent quality and dependable supply.",
    },
    {
      title: "Natural stone slabs",
      shortLabel: "Slabs",
      description:
        "Semi-finished slabs are produced near key source regions and follow the same checks and selection standards used for rough blocks.",
    },
    {
      title: "Worldwide distribution",
      shortLabel: "Distribution",
      description:
        "The distribution network serves major luxury-stone markets with broad material access, on-schedule delivery, and ongoing service.",
    },
  ],
  quarryCountries: [
    "South Africa",
    "Namibia",
    "Zimbabwe",
    "Madagascar",
    "Brazil",
    "United States",
    "Canada",
    "Finland",
    "Norway",
  ],
  quarryHighlights: [
    {
      id: "madagascar",
      region: "Madagascar",
      title: "Labradorite source region",
      description: "A source region within R.E.D. Graniti's company-owned quarry network.",
      imageUrl: RED_GRANITI_QUARRY_MEDIA.madagascar.imageUrl,
      sourceUrl: RED_GRANITI_QUARRY_MEDIA.madagascar.sourceUrl,
    },
    {
      id: "south-africa",
      region: "South Africa",
      title: "Black granite source region",
      description: "A long-established production region for controlled black-granite selection.",
      imageUrl: RED_GRANITI_QUARRY_MEDIA.southAfrica.imageUrl,
      sourceUrl: RED_GRANITI_QUARRY_MEDIA.southAfrica.sourceUrl,
    },
    {
      id: "vermont",
      region: "Vermont, United States",
      title: "Danby marble source region",
      description: "A North American marble source within R.E.D. Graniti's block-and-slab network.",
      imageUrl: RED_GRANITI_QUARRY_MEDIA.vermont.imageUrl,
      sourceUrl: RED_GRANITI_QUARRY_MEDIA.vermont.sourceUrl,
    },
  ],
  partnership: {
    partnerName: "JW Stone Logistics",
    partnerProfileSlug: "jw-stone",
    relationshipLabel: "Exclusive first-cut distributor",
    description:
      "First-cut distribution for R.E.D. Graniti stone is handled by JW Stone. Calls and requests from this profile connect to that team.",
  },
  officialLinks: [
    { label: "Official website", href: RED_GRANITI_OFFICIAL_WEBSITE },
    { label: "R.E.D. Group", href: RED_GRANITI_GROUP_URL },
    { label: "Quarry directory", href: RED_GRANITI_QUARRIES_URL },
    { label: "Blocks and slabs", href: RED_GRANITI_BLOCKS_AND_SLABS_URL },
  ],
} as const;

/**
 * Company identity only. Material truth, physical assets, inventory positions,
 * publications, and distribution rights remain separate Stone Core records.
 */
export const RED_GRANITI_PROFILE_CONTENT_BLOCKS = [
  {
    type: "siteTemplate",
    data: { id: "default" },
  },
  {
    type: "profileSections",
    data: {
      sections: {
        about: true,
        rolesAndBadges: false,
        stats: false,
        services: true,
        marketplaceListings: false,
        reviews: false,
        communityActivity: false,
        contactCard: true,
      },
    },
  },
  {
    type: "hero",
    data: {
      presentationVariant: "classic",
      title: RED_GRANITI_PUBLIC_IDENTITY.headline,
      text: RED_GRANITI_PUBLIC_IDENTITY.summary,
      logoUrl: RED_GRANITI_LOGO_URL,
      imageUrl: RED_GRANITI_QUARRY_MEDIA.madagascar.imageUrl,
      imageAlt: "R.E.D. Graniti natural stone source",
      locationLabel: RED_GRANITI_PUBLIC_IDENTITY.locationLabel,
    },
  },
  {
    type: "about",
    data: {
      text: RED_GRANITI_PUBLIC_IDENTITY.about,
    },
  },
  {
    type: "services",
    data: {
      items: RED_GRANITI_PUBLIC_IDENTITY.capabilities.map((capability) => capability.title),
    },
  },
  {
    type: "gallery",
    data: {
      title: "Company-owned quarry network",
      description: "Source-region imagery tied to official R.E.D. Graniti quarry pages.",
      images: RED_GRANITI_PUBLIC_IDENTITY.quarryHighlights.map((highlight) => ({
        id: `red-graniti-${highlight.id}-quarry`,
        imageUrl: highlight.imageUrl,
        title: highlight.title,
        alt: `R.E.D. Graniti source region in ${highlight.region}`,
        description: highlight.description,
        sourceUrl: highlight.sourceUrl,
      })),
    },
  },
  {
    type: "publicDiscovery",
    data: {
      routes: {
        gallery: "quarries",
      },
      sitemap: {
        gallery: true,
      },
      sourceBoundary:
        "Only source-region media tied to official R.E.D. Graniti quarry pages is eligible for quarry-page discovery.",
    },
  },
  {
    type: "companyFacts",
    data: {
      title: "More than 50 years in natural stone",
      text:
        "R.E.D. Graniti operates across four continents, owns quarries in nine countries, and connects sixteen production companies with major stone markets worldwide.",
    },
  },
  {
    type: "partnership",
    data: {
      title: RED_GRANITI_PUBLIC_IDENTITY.partnership.relationshipLabel,
      text: RED_GRANITI_PUBLIC_IDENTITY.partnership.description,
    },
  },
  {
    type: "officialSource",
    data: {
      title: "R.E.D. Graniti company information",
      text:
        "Company facts, operating locations, and quarry references are tied to R.E.D. Graniti's official website and group pages.",
    },
  },
  {
    type: "cta",
    data: {
      heading: "Call or start a request",
      description:
        "Share the R.E.D. material, required format, dimensions, quantity, destination, and timing for first-cut review.",
      requestExamples: [
        "Ask about a R.E.D. material",
        "Plan rough-block supply",
        "Plan slab supply",
        "Review a first-cut requirement",
      ],
    },
  },
] as const;
