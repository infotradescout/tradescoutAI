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

export const RED_GRANITI_QUARRY_MEDIA = {
  lemurianBlue: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/lemurian-blue-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/lemurian-blue/",
  },
  gialloVeneziano: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/01-27.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/giallo-veneziano/",
  },
  virginiaMist: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/01-24.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/virginia-mist/",
  },
  neroZimbabwe: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/nero-zimbabwe.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/nero-zimbabwe/",
  },
  neroAfrica: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/nero-africa-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/nero-africa-rustenburg/",
  },
  gialloDuna: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/giallo-duna-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/giallo-duna/",
  },
  dunaRed: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/duna-red-rosso-duna.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/duna-red-rosso-duna/",
  },
  eurekaDanby: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/eureka-danby-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/eureka-danbycalacatta-danby/",
  },
  imperialDanby: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/imperial-danby-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/imperial-danby/",
  },
} as const;

const OFFICIAL_QUARRY_SOURCE_NOTE =
  "Material identity and quarry origin are tied to R.E.D. Graniti's official quarry pages.";

function quarryOffering(args: {
  name: string;
  slug: string;
  imageUrl: string;
  sourceUrl: string;
  summary: string;
}) {
  return {
    name: args.name,
    slug: args.slug,
    // The local logo is a reliable visual fallback when the source site blocks
    // hotlinking. Share cards prefer the local mark rather than a remote asset.
    images: [args.imageUrl, RED_GRANITI_LOGO_URL],
    shareImageOrder: [1, 0],
    publicKind: "offering",
    publicSummary: args.summary,
    materialStatus: "source_folder",
    finishStatus: "unconfirmed",
    hideFinishDetails: true,
    sourceUrl: args.sourceUrl,
    sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
  } as const;
}

const LEMURIAN_BLUE = quarryOffering({
  name: "Lemurian® Blue",
  slug: "lemurian-blue",
  imageUrl: RED_GRANITI_QUARRY_MEDIA.lemurianBlue.imageUrl,
  sourceUrl: RED_GRANITI_QUARRY_MEDIA.lemurianBlue.sourceUrl,
  summary:
    "Lemurian® Blue is a Madagascar labradorite offered by R.E.D. Graniti for interior applications, with first-cut requests coordinated through JW Stone.",
});

const VIRGINIA_MIST = quarryOffering({
  name: "Virginia Mist",
  slug: "virginia-mist",
  imageUrl: RED_GRANITI_QUARRY_MEDIA.virginiaMist.imageUrl,
  sourceUrl: RED_GRANITI_QUARRY_MEDIA.virginiaMist.sourceUrl,
  summary:
    "Virginia Mist is a black granite from R.E.D. Graniti's Virginia quarry for interior and exterior applications, with first-cut requests coordinated through JW Stone.",
});

const NERO_ZIMBABWE = quarryOffering({
  name: "Nero Zimbabwe",
  slug: "nero-zimbabwe",
  imageUrl: RED_GRANITI_QUARRY_MEDIA.neroZimbabwe.imageUrl,
  sourceUrl: RED_GRANITI_QUARRY_MEDIA.neroZimbabwe.sourceUrl,
  summary:
    "Nero Zimbabwe is a quarry-origin black granite from Zimbabwe offered for block, slab, and first-cut planning through JW Stone.",
});

const NERO_AFRICA = quarryOffering({
  name: "Nero Africa / Rustenburg",
  slug: "nero-africa-rustenburg",
  imageUrl: RED_GRANITI_QUARRY_MEDIA.neroAfrica.imageUrl,
  sourceUrl: RED_GRANITI_QUARRY_MEDIA.neroAfrica.sourceUrl,
  summary:
    "Nero Africa / Rustenburg is a South African black granite offered for interior, exterior, cladding, and memorial applications, with first-cut requests coordinated through JW Stone.",
});

const GIALLO_VENEZIANO = quarryOffering({
  name: "Giallo Veneziano",
  slug: "giallo-veneziano",
  imageUrl: RED_GRANITI_QUARRY_MEDIA.gialloVeneziano.imageUrl,
  sourceUrl: RED_GRANITI_QUARRY_MEDIA.gialloVeneziano.sourceUrl,
  summary:
    "Giallo Veneziano is a yellow Brazilian granite from R.E.D. Graniti's Nova Venécia quarry, with first-cut requests coordinated through JW Stone.",
});

const GIALLO_DUNA = quarryOffering({
  name: "Giallo Duna",
  slug: "giallo-duna",
  imageUrl: RED_GRANITI_QUARRY_MEDIA.gialloDuna.imageUrl,
  sourceUrl: RED_GRANITI_QUARRY_MEDIA.gialloDuna.sourceUrl,
  summary:
    "Giallo Duna is a quarry-origin Namibian granite offered for block, slab, and project-specific first-cut planning through JW Stone.",
});

const DUNA_RED = quarryOffering({
  name: "Duna Red / Rosso Duna",
  slug: "duna-red-rosso-duna",
  imageUrl: RED_GRANITI_QUARRY_MEDIA.dunaRed.imageUrl,
  sourceUrl: RED_GRANITI_QUARRY_MEDIA.dunaRed.sourceUrl,
  summary:
    "Duna Red / Rosso Duna is a red Namibian granite offered for block, slab, and first-cut planning through JW Stone.",
});

const EUREKA_DANBY = quarryOffering({
  name: "Eureka Danby / Calacatta Danby",
  slug: "eureka-danby-calacatta-danby",
  imageUrl: RED_GRANITI_QUARRY_MEDIA.eurekaDanby.imageUrl,
  sourceUrl: RED_GRANITI_QUARRY_MEDIA.eurekaDanby.sourceUrl,
  summary:
    "Eureka Danby / Calacatta Danby is a Vermont marble offering associated with R.E.D. Graniti's quarry network, with first-cut requests coordinated through JW Stone.",
});

const IMPERIAL_DANBY = quarryOffering({
  name: "Imperial Danby",
  slug: "imperial-danby",
  imageUrl: RED_GRANITI_QUARRY_MEDIA.imperialDanby.imageUrl,
  sourceUrl: RED_GRANITI_QUARRY_MEDIA.imperialDanby.sourceUrl,
  summary:
    "Imperial Danby is a Vermont marble offering associated with R.E.D. Graniti's quarry network, with first-cut requests coordinated through JW Stone.",
});

export const RED_GRANITI_FEATURED_MATERIAL_SLUGS = [
  LEMURIAN_BLUE.slug,
  GIALLO_VENEZIANO.slug,
  VIRGINIA_MIST.slug,
  NERO_ZIMBABWE.slug,
  IMPERIAL_DANBY.slug,
] as const;

export const RED_GRANITI_PROFILE_CONTENT_BLOCKS = [
  {
    type: "siteTemplate",
    data: { id: "wholesaler" },
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
    type: "profilePresentation",
    data: {
      layout: { variant: "brand-showcase" },
      header: {
        layout: "centered-brand",
        logoUrl: RED_GRANITI_LOGO_URL,
        logoAlt: "R.E.D. Graniti logo",
        homeLabel: "R.E.D. Graniti",
        backLabel: "Back to TradeScout",
        directConnectLabel: "Start a Request",
      },
      hero: {
        inventoryItemSlug: LEMURIAN_BLUE.slug,
        eyebrow: "QUARRY ORIGIN · GLOBAL NATURAL STONE",
        headline: "From quarry to first cut.",
        teaser:
          "R.E.D. Graniti stone, with exclusive first-cut distribution through JW Stone.",
        preserveMedia: false,
        align: "left",
      },
      copy: {
        inventoryTitle: "Selected quarry materials",
        ctaHeading: "Start a first-cut request",
        footerText: "Source company: R.E.D. Graniti · First-cut distribution: JW Stone",
      },
      inventory: {
        initialView: "catalog",
        density: "comfortable",
        pageSize: 12,
        pageStep: 12,
        stickyControls: true,
        sourceRequests: true,
        browseCtaImage: RED_GRANITI_LOGO_URL,
        browseCtaEyebrow: "R.E.D. Graniti quarry materials",
        featuredCollection: {
          label: "Quarry highlights",
          slugs: [...RED_GRANITI_FEATURED_MATERIAL_SLUGS],
        },
      },
      audience: {
        layout: "guided",
        intro:
          "Start with the material, application, dimensions, quantity, project location, and first-cut plan.",
        availableFacts: [
          "Official quarry identity",
          "Block or slab format",
          "Source references",
          "First-cut planning",
        ],
        contextHeading: "What JW Stone needs to review",
        availabilityNote:
          "Availability, production timing, dimensions, freight, and first-cut capacity are confirmed per request.",
      },
      faq: { layout: "disclosure" },
      social: {
        brandName: RED_GRANITI_BUSINESS_NAME,
        logoUrl: RED_GRANITI_LOGO_URL,
        profileImageUrl: RED_GRANITI_LOGO_URL,
        accentColor: "#d71920",
        profileCta: "Start a Request",
        inventoryCta: "Ask about this material",
        galleryCta: "View source",
      },
    },
  },
  {
    type: "hero",
    data: {
      eyebrow: "QUARRY ORIGIN · GLOBAL NATURAL STONE",
      headerLabel: "Blocks · Slabs · First-cut distribution",
      teaser:
        "R.E.D. Graniti stone, with exclusive first-cut distribution through JW Stone.",
    },
  },
  {
    type: "about",
    data: {
      text:
        "R.E.D. Graniti has spent more than 50 years extracting and marketing natural stone blocks and slabs. Its quarry network reaches major stone-producing regions across Africa, the Americas, and Northern Europe. Through this TradeScout profile, JW Stone handles the exclusive first-cut distribution path for the materials offered here.",
    },
  },
  {
    type: "trust",
    data: {
      items: [
        "Company and quarry facts tied to official R.E.D. Graniti sources",
        "Material identity tied to official quarry pages",
        "Exclusive first-cut distribution through JW Stone",
        "Availability, dimensions, freight, and production timing confirmed per request",
      ],
    },
  },
  {
    type: "services",
    data: {
      items: [
        "Quarry-origin natural stone",
        "Rough stone blocks",
        "Natural stone slabs",
        "Exclusive first-cut distribution through JW Stone",
      ],
    },
  },
  {
    type: "differentiators",
    data: {
      items: [
        {
          title: "Quarry-origin identity",
          body: "Selections stay tied to the source company and quarry instead of being presented as anonymous stone.",
        },
        {
          title: "Block and slab planning",
          body: "Requests can begin with rough blocks, slabs, or the first-cut requirements for a specific project.",
        },
        {
          title: "JW Stone coordination",
          body: "JW Stone handles the exclusive first-cut distribution path and keeps the request tied to the selected material.",
        },
        {
          title: "Project-specific review",
          body: "Material, dimensions, quantity, freight, schedule, and cut requirements are reviewed together before a commitment is made.",
        },
      ],
    },
  },
  {
    type: "audience",
    data: {
      title: "Start with the project",
      items: [
        {
          title: "Fabricators",
          body:
            "Send the material, block or slab format, target dimensions, quantity, destination, schedule, and the first cuts you need JW Stone to review.",
          actionLabel: "Plan first-cut supply",
          requestType: "ask_about_bundle",
          review: [
            "Selected quarry material",
            "Block or slab format and target dimensions",
            "Quantity, destination, schedule, and first-cut requirements",
          ],
        },
        {
          title: "Builders & Developers",
          body:
            "Share the project type, location, volume, installation schedule, and consistency requirements so JW Stone can review a source plan.",
          actionLabel: "Match a development",
          requestType: "match_project",
          review: [
            "Project type and location",
            "Volume, consistency, and phasing",
            "Required delivery and installation schedule",
          ],
        },
        {
          title: "Architects & Designers",
          body:
            "Start with the design intent, application, movement, color, dimensions, and finish goals, then request source and first-cut review.",
          actionLabel: "Review a specification",
          requestType: "match_project",
          review: [
            "Application and design intent",
            "Material, movement, color, and dimension goals",
            "Selection deadline and first-cut requirements",
          ],
        },
        {
          title: "Homeowners",
          body:
            "Share the room, inspiration, selected material, dimensions, project location, fabricator status, and timing for a guided next step.",
          actionLabel: "Match my project",
          requestType: "match_project",
          review: [
            "Room or application",
            "Selected material, inspiration, and dimensions",
            "Project location, fabricator status, and timing",
          ],
        },
      ],
    },
  },
  {
    type: "publicDiscovery",
    data: {
      sitemap: {
        inventory: true,
        categories: true,
      },
      categories: [
        {
          sourceSlug: "architectural-exotic-stone",
          publicSlug: "architectural-exotic-stone",
          title: "Architectural & Exotic Stone",
          summary:
            "Explore source-backed architectural and exotic stone from R.E.D. Graniti, with first-cut distribution requests handled through JW Stone.",
          leadItemSlug: LEMURIAN_BLUE.slug,
          indexable: true,
          collectionKind: "offerings",
        },
        {
          sourceSlug: "black-granite",
          publicSlug: "black-granite",
          title: "Black Granite",
          summary:
            "Explore source-backed black granite from R.E.D. Graniti quarries in the United States, Zimbabwe, and South Africa, with first-cut requests handled through JW Stone.",
          leadItemSlug: VIRGINIA_MIST.slug,
          indexable: true,
          collectionKind: "offerings",
        },
        {
          sourceSlug: "warm-granite",
          publicSlug: "warm-granite",
          title: "Warm Granite",
          summary:
            "Explore source-backed yellow and red granite from R.E.D. Graniti's quarry network, with first-cut requests handled through JW Stone.",
          leadItemSlug: GIALLO_VENEZIANO.slug,
          indexable: true,
          collectionKind: "offerings",
        },
        {
          sourceSlug: "danby-marble",
          publicSlug: "danby-marble",
          title: "Danby Marble",
          summary:
            "Explore source-backed Vermont Danby marble offerings associated with R.E.D. Graniti's quarry network, with first-cut requests handled through JW Stone.",
          leadItemSlug: EUREKA_DANBY.slug,
          indexable: true,
          collectionKind: "offerings",
        },
      ],
    },
  },
  {
    type: "inventoryCatalog",
    data: {
      title: "Selected quarry materials",
      description:
        "These source-backed quarry offerings support material selection and first-cut planning. JW Stone confirms current availability, block or slab format, dimensions, quantity, freight, production timing, and first-cut capacity for each request.",
      featuredStoneSlugs: [...RED_GRANITI_FEATURED_MATERIAL_SLUGS],
      categories: [
        {
          category: "Architectural & Exotic Stone",
          categorySlug: "architectural-exotic-stone",
          stones: [LEMURIAN_BLUE],
        },
        {
          category: "Black Granite",
          categorySlug: "black-granite",
          stones: [VIRGINIA_MIST, NERO_ZIMBABWE, NERO_AFRICA],
        },
        {
          category: "Warm Granite",
          categorySlug: "warm-granite",
          stones: [GIALLO_VENEZIANO, GIALLO_DUNA, DUNA_RED],
        },
        {
          category: "Danby Marble",
          categorySlug: "danby-marble",
          stones: [EUREKA_DANBY, IMPERIAL_DANBY],
        },
      ],
    },
  },
  {
    type: "faq",
    data: {
      faqs: [
        {
          question: "Who handles requests from this profile?",
          answer:
            "JW Stone handles the exclusive first-cut distribution path. TradeScout administers the profile and keeps each request tied to the selected R.E.D. Graniti material.",
        },
        {
          question: "What should I include in a material request?",
          answer:
            "Include the selected material, block or slab format, dimensions, quantity, destination, project schedule, freight needs, and requested first-cut scope.",
        },
        {
          question: "Are availability and pricing shown publicly?",
          answer:
            "No. JW Stone confirms current availability, dimensions, production timing, freight, first-cut capacity, and project-specific pricing after reviewing the request.",
        },
      ],
    },
  },
  {
    type: "cta",
    data: {
      heading: "Start a first-cut request",
      description:
        "Tell JW Stone the selected material, format, dimensions, quantity, destination, timing, freight needs, and requested first cuts.",
      contactOperatorName: "JW Stone",
      contactOperatorRole: "exclusive first-cut distributor",
      requestExamples: [
        "Request a quarry material",
        "Plan block or slab supply",
        "Review first-cut requirements",
        "Ask about freight and timing",
      ],
    },
  },
] as const;
