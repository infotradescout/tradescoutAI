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
    sourceUrl: "https://www.redgraniti.com/en/portfolio/eureka-danbycalacatta-danby/",
  },
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
      presentationVariant: "first-deliverable",
      title: "R.E.D. Graniti",
      text: "Natural stone quarrying, rough blocks, and slabs.",
      logoUrl: RED_GRANITI_LOGO_URL,
      imageUrl: RED_GRANITI_QUARRY_MEDIA.madagascar.imageUrl,
      imageAlt: "Natural stone quarry associated with R.E.D. Graniti",
      locationLabel: "Massa, Italy",
    },
  },
  {
    type: "about",
    data: {
      text:
        "R.E.D. Graniti has spent more than 50 years extracting and marketing natural stone blocks and slabs. The company operates through a quarry network spanning major stone-producing regions across Africa, the Americas, and Northern Europe.",
    },
  },
  {
    type: "services",
    data: {
      items: [
        "Natural stone quarrying",
        "Rough stone blocks",
        "Natural stone slabs",
        "Quarry source documentation",
      ],
    },
  },
  {
    type: "gallery",
    data: {
      title: "Quarry network",
      description: "Official source imagery from R.E.D. Graniti quarry pages.",
      images: [
        {
          id: "red-graniti-madagascar-quarry",
          imageUrl: RED_GRANITI_QUARRY_MEDIA.madagascar.imageUrl,
          title: "Madagascar quarry source",
          alt: "R.E.D. Graniti quarry source in Madagascar",
          description: "Official quarry-source imagery published by R.E.D. Graniti.",
          sourceUrl: RED_GRANITI_QUARRY_MEDIA.madagascar.sourceUrl,
        },
        {
          id: "red-graniti-south-africa-quarry",
          imageUrl: RED_GRANITI_QUARRY_MEDIA.southAfrica.imageUrl,
          title: "South Africa quarry source",
          alt: "R.E.D. Graniti quarry source in South Africa",
          description: "Official quarry-source imagery published by R.E.D. Graniti.",
          sourceUrl: RED_GRANITI_QUARRY_MEDIA.southAfrica.sourceUrl,
        },
        {
          id: "red-graniti-vermont-quarry",
          imageUrl: RED_GRANITI_QUARRY_MEDIA.vermont.imageUrl,
          title: "Vermont quarry source",
          alt: "R.E.D. Graniti quarry source in Vermont",
          description: "Official quarry-source imagery published by R.E.D. Graniti.",
          sourceUrl: RED_GRANITI_QUARRY_MEDIA.vermont.sourceUrl,
        },
      ],
    },
  },
  {
    type: "partnership",
    data: {
      title: "Exclusive first-cut distribution",
      text:
        "JW Stone is the exclusive first-cut distributor for R.E.D. Graniti stone. The geographic territory is not stated publicly until its confirmed scope is available.",
    },
  },
  {
    type: "officialSource",
    data: {
      title: "Official company information",
      text:
        "Company and quarry facts shown here are tied to R.E.D. Graniti's official website and quarry directory.",
    },
  },
  {
    type: "cta",
    data: {
      heading: "Start a Request",
      description:
        "TradeScout reviews the request and routes first-cut distribution needs through the verified JW Stone relationship.",
      requestExamples: [
        "Discuss a source material",
        "Plan a first-cut requirement",
        "Ask about blocks or slabs",
        "Request next-step coordination",
      ],
    },
  },
] as const;
