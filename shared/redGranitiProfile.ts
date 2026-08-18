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

/** Company/quarry imagery only. Canonical material records live in Stone Core. */
export const RED_GRANITI_QUARRY_MEDIA = {
  madagascar: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/lemurian-blue-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/lemurian-blue/",
  },
  southAfrica: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/nero-africa-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/nero-africa-rustenburg/",
  },
  vermont: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/eureka-danby-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/eureka-danbycalatta-danby/",
  },
} as const;

export const RED_GRANITI_PUBLIC_IDENTITY = {
  brandName: RED_GRANITI_BUSINESS_NAME,
  legalName: "R.E.D. Graniti S.p.A.",
  legalId: "P.IVA 13161430155",
  locationLabel: "Massa, Italy",
  eyebrow: "NATURAL STONE · QUARRIES · BLOCKS · SLABS",
  headline: "Natural stone at the source.",
  summary:
    "For more than 50 years, R.E.D. Graniti has built a global natural-stone business around quarry ownership, block selection, slab production, and dependable distribution.",
  about:
    "R.E.D. Graniti operates from Massa, Italy, with production and commercial companies positioned across major stone markets. The company controls source relationships, inspects and catalogs rough blocks, supplies slabs produced near key quarry regions, and supports customers from material selection through scheduled delivery.",
  qualityStatement:
    "Every source decision begins with material quality, consistent selection, documented control, and a clear path from quarry to customer.",
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
        "Company-reported 60,000 m² yard with an average of 30,000 m³ of blocks available for selection.",
    },
    {
      label: "Dolcè block yard",
      location: "Verona, Italy",
      detail: "Company-reported average availability of about 12,000 m³ of block material.",
    },
    {
      label: "Cavaion Veronese slab warehouse",
      location: "Verona, Italy",
      detail: "Company-reported 8,500 m² warehouse dedicated to slabs ready for sale.",
    },
  ],
  stats: [
    { value: "50+", label: "years in natural stone" },
    { value: "4", label: "continents represented" },
    { value: "9", label: "countries with company-owned quarries" },
    { value: "16", label: "production companies reported worldwide" },
  ],
  capabilities: [
    {
      title: "Rough blocks",
      shortLabel: "Blocks",
      description:
        "Blocks from company-controlled sources are inspected, selected, and cataloged before entering the sales network.",
    },
    {
      title: "Natural stone slabs",
      shortLabel: "Slabs",
      description:
        "Semi-finished slabs are produced through modern facilities near key production regions and held to the same source-quality standards.",
    },
    {
      title: "Global distribution",
      shortLabel: "Distribution",
      description:
        "The commercial network connects quarry production, yards, processing locations, and major luxury-stone markets around the world.",
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
      description:
        "One part of R.E.D. Graniti's owned-quarry network across major stone-producing regions.",
      imageUrl: RED_GRANITI_QUARRY_MEDIA.madagascar.imageUrl,
      sourceUrl: RED_GRANITI_QUARRY_MEDIA.madagascar.sourceUrl,
    },
    {
      id: "south-africa",
      region: "South Africa",
      title: "Black granite source region",
      description:
        "A long-established production region within R.E.D. Graniti's international quarry network.",
      imageUrl: RED_GRANITI_QUARRY_MEDIA.southAfrica.imageUrl,
      sourceUrl: RED_GRANITI_QUARRY_MEDIA.southAfrica.sourceUrl,
    },
    {
      id: "vermont",
      region: "Vermont, United States",
      title: "Danby marble source region",
      description:
        "A North American source connected to R.E.D. Graniti's broader block-and-slab operation.",
      imageUrl: RED_GRANITI_QUARRY_MEDIA.vermont.imageUrl,
      sourceUrl: RED_GRANITI_QUARRY_MEDIA.vermont.sourceUrl,
    },
  ],
  partnership: {
    partnerName: "JW Stone Logistics",
    partnerProfileSlug: "jw-stone",
    relationshipLabel: "Exclusive first-cut distributor",
    headline: "From R.E.D. Graniti source to JW Stone first cut.",
    description:
      "R.E.D. Graniti remains the source company. JW Stone handles the exclusive first-cut distribution path, while TradeScout keeps each request connected to the right company, material, and next step.",
  },
  officialLinks: [
    { label: "Official website", href: RED_GRANITI_OFFICIAL_WEBSITE },
    { label: "Company group", href: RED_GRANITI_GROUP_URL },
    { label: "Quarry directory", href: RED_GRANITI_QUARRIES_URL },
    { label: "Blocks and slabs", href: RED_GRANITI_BLOCKS_AND_SLABS_URL },
  ],
} as const;

/**
 * Company identity only. Material truth, physical assets, inventory positions,
 * publications, and distribution rights are separate Stone Core records.
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
      title: "Quarry network",
      description: "Official source imagery from R.E.D. Graniti quarry pages.",
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
    type: "companyFacts",
    data: {
      title: "A global source company",
      text:
        "R.E.D. Graniti reports operations across four continents, company-owned quarries in nine countries, sixteen production companies, major Italian block yards, and a dedicated slab warehouse.",
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
      title: "Official company information",
      text:
        "Company facts shown here are tied to R.E.D. Graniti's official website, group information, and quarry directory.",
    },
  },
  {
    type: "cta",
    data: {
      heading: "Start a Request",
      description:
        "TradeScout reviews the request and routes first-cut distribution needs through JW Stone without changing R.E.D. Graniti's company identity.",
      requestExamples: [
        "Discuss a source material",
        "Plan a first-cut requirement",
        "Ask about blocks or slabs",
        "Request next-step coordination",
      ],
    },
  },
] as const;
