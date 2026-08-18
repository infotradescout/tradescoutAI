export const RED_GRANITI_PROFILE_SLUG = "red-graniti";
export const RED_GRANITI_BUSINESS_NAME = "R.E.D. Graniti";

export const RED_GRANITI_OFFICIAL_WEBSITE = "https://www.redgraniti.com/en/";
export const RED_GRANITI_QUARRIES_URL = "https://www.redgraniti.com/en/quarries/";
export const RED_GRANITI_LOGO_URL =
  "https://www.redgraniti.com/wp-content/uploads/2016/01/logored78x78.png";

export const RED_GRANITI_OFFICIAL_SOURCES = [
  RED_GRANITI_OFFICIAL_WEBSITE,
  RED_GRANITI_QUARRIES_URL,
  "https://www.redgraniti.com/en/r-e-d-graniti-group/",
  "https://www.redgraniti.com/en/r-e-d-graniti-group/red-quarries-blocks-and-slabs/",
] as const;

export const RED_GRANITI_QUARRY_MEDIA = {
  gialloVeneziano: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/01-27.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/giallo-veneziano/",
  },
  virginiaMist: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/01-24.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/virginia-mist/",
  },
  eurekaDanby: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/eureka-danby-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/eureka-danbycalacatta-danby/",
  },
  lemurianBlue: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/lemurian-blue-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/lemurian-blue/",
  },
  neroZimbabwe: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/nero-zimbabwe.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/nero-zimbabwe/",
  },
  gialloDuna: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/giallo-duna-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/giallo-duna/",
  },
  dunaRed: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/duna-red-rosso-duna.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/duna-red-rosso-duna/",
  },
  neroAfrica: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/nero-africa-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/nero-africa-rustenburg/",
  },
  imperialDanby: {
    imageUrl: "https://www.redgraniti.com/wp-content/uploads/2018/06/imperial-danby-1.jpg",
    sourceUrl: "https://www.redgraniti.com/en/portfolio/imperial-danby/",
  },
} as const;

const OFFICIAL_QUARRY_SOURCE_NOTE =
  "Material identity and quarry origin are sourced from R.E.D. Graniti's official quarry page.";

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
        inventoryItemSlug: "lemurian-blue",
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
      },
      inventory: {
        initialView: "catalog",
        density: "comfortable",
        pageSize: 12,
        pageStep: 12,
        stickyControls: true,
        sourceRequests: true,
        browseCtaImage: RED_GRANITI_QUARRY_MEDIA.lemurianBlue.imageUrl,
        browseCtaEyebrow: "R.E.D. Graniti quarry materials",
        featuredCollection: {
          label: "Quarry highlights",
          slugs: [
            "lemurian-blue",
            "giallo-veneziano",
            "virginia-mist",
            "nero-zimbabwe",
            "imperial-danby",
          ],
        },
      },
      audience: {
        layout: "guided",
        intro:
          "Start with the material, application, dimensions, quantity, project location, and first-cut plan.",
        availableFacts: [
          "Official quarry identity",
          "Block or slab format",
          "Source imagery",
          "First-cut planning",
        ],
        contextHeading: "What JW Stone needs to review",
        availabilityNote:
          "Availability, production timing, dimensions, freight, and first-cut capacity are confirmed per request.",
      },
      faq: { layout: "disclosure" },
      story: {
        eyebrow: "QUARRY NETWORK",
        heading: "Source material with a documented origin.",
        images: [
          {
            src: RED_GRANITI_QUARRY_MEDIA.gialloVeneziano.imageUrl,
            alt: "Giallo Veneziano quarry operated by R.E.D. Graniti",
            label: "Brazil",
          },
          {
            src: RED_GRANITI_QUARRY_MEDIA.lemurianBlue.imageUrl,
            alt: "Lemurian Blue quarry operated by R.E.D. Graniti",
            label: "Madagascar",
          },
          {
            src: RED_GRANITI_QUARRY_MEDIA.neroAfrica.imageUrl,
            alt: "Nero Africa quarry operated by R.E.D. Graniti",
            label: "South Africa",
          },
        ],
      },
      social: {
        brandName: "R.E.D. Graniti",
        logoUrl: RED_GRANITI_LOGO_URL,
        profileImageUrl: RED_GRANITI_QUARRY_MEDIA.lemurianBlue.imageUrl,
        accentColor: "#d71920",
        profileCta: "Start a Request",
        inventoryCta: "Ask about this material",
        galleryCta: "View quarry source",
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
        "R.E.D. Graniti has spent more than 50 years extracting and marketing natural stone blocks and slabs. Its quarry network spans South Africa, Namibia, Zimbabwe, Madagascar, Brazil, the United States, Canada, Finland, and Norway. Through this partnership, JW Stone is the exclusive first-cut distributor for R.E.D. Graniti stone, with territory intentionally left unstated until it is formally published.",
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
          body: "Selections are tied to the company and quarry source instead of being presented as anonymous stone.",
        },
        {
          title: "Block and slab planning",
          body: "Requests can begin with rough blocks, slabs, or the first-cut requirements for a specific project.",
        },
        {
          title: "JW Stone first-cut coordination",
          body: "JW Stone handles the exclusive first-cut distribution path and keeps the request tied to the selected material.",
        },
        {
          title: "Project-specific sourcing",
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
    type: "inventoryCatalog",
    data: {
      title: "Selected quarry materials",
      description:
        "These are source-backed quarry offerings for material selection and first-cut planning. JW Stone confirms current availability, block or slab format, dimensions, quantity, freight, production timing, and first-cut capacity for each request.",
      featuredStoneSlugs: [
        "lemurian-blue",
        "giallo-veneziano",
        "virginia-mist",
        "nero-zimbabwe",
        "imperial-danby",
      ],
      categories: [
        {
          category: "Architectural & Exotic Stone",
          categorySlug: "architectural-exotic-stone",
          stones: [
            {
              name: "Lemurian® Blue",
              slug: "lemurian-blue",
              images: [RED_GRANITI_QUARRY_MEDIA.lemurianBlue.imageUrl],
              publicKind: "offering",
              publicSummary:
                "Lemurian® Blue is a Madagascar labradorite offered by R.E.D. Graniti for interior applications, with first-cut requests coordinated through JW Stone.",
              materialStatus: "source_folder",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceUrl: RED_GRANITI_QUARRY_MEDIA.lemurianBlue.sourceUrl,
              sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
            },
          ],
        },
        {
          category: "Black Granite",
          categorySlug: "black-granite",
          stones: [
            {
              name: "Virginia Mist",
              slug: "virginia-mist",
              images: [RED_GRANITI_QUARRY_MEDIA.virginiaMist.imageUrl],
              publicKind: "offering",
              publicSummary:
                "Virginia Mist is a black granite from R.E.D. Graniti's Virginia quarry for interior and exterior applications, with first-cut requests coordinated through JW Stone.",
              materialStatus: "source_folder",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceUrl: RED_GRANITI_QUARRY_MEDIA.virginiaMist.sourceUrl,
              sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
            },
            {
              name: "Nero Zimbabwe",
              slug: "nero-zimbabwe",
              images: [RED_GRANITI_QUARRY_MEDIA.neroZimbabwe.imageUrl],
              publicKind: "offering",
              publicSummary:
                "Nero Zimbabwe is a quarry-origin black granite from near Mutoko, Zimbabwe, offered for block, slab, and first-cut planning through JW Stone.",
              materialStatus: "source_folder",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceUrl: RED_GRANITI_QUARRY_MEDIA.neroZimbabwe.sourceUrl,
              sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
            },
            {
              name: "Nero Africa / Rustenburg",
              slug: "nero-africa-rustenburg",
              images: [RED_GRANITI_QUARRY_MEDIA.neroAfrica.imageUrl],
              publicKind: "offering",
              publicSummary:
                "Nero Africa / Rustenburg is a classic South African black granite used across interior, exterior, cladding, and memorial applications, with first-cut requests coordinated through JW Stone.",
              materialStatus: "source_folder",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceUrl: RED_GRANITI_QUARRY_MEDIA.neroAfrica.sourceUrl,
              sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
            },
          ],
        },
        {
          category: "Warm Granite",
          categorySlug: "warm-granite",
          stones: [
            {
              name: "Giallo Veneziano",
              slug: "giallo-veneziano",
              images: [RED_GRANITI_QUARRY_MEDIA.gialloVeneziano.imageUrl],
              publicKind: "offering",
              publicSummary:
                "Giallo Veneziano is a distinctive yellow Brazilian granite from R.E.D. Graniti's Nova Venécia quarry, with first-cut requests coordinated through JW Stone.",
              materialStatus: "source_folder",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceUrl: RED_GRANITI_QUARRY_MEDIA.gialloVeneziano.sourceUrl,
              sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
            },
            {
              name: "Giallo Duna",
              slug: "giallo-duna",
              images: [RED_GRANITI_QUARRY_MEDIA.gialloDuna.imageUrl],
              publicKind: "offering",
              publicSummary:
                "Giallo Duna is a quarry-origin Namibian granite offered for block, slab, and first-cut planning through JW Stone.",
              materialStatus: "source_folder",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceUrl: RED_GRANITI_QUARRY_MEDIA.gialloDuna.sourceUrl,
              sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
            },
            {
              name: "Duna Red / Rosso Duna",
              slug: "duna-red-rosso-duna",
              images: [RED_GRANITI_QUARRY_MEDIA.dunaRed.imageUrl],
              publicKind: "offering",
              publicSummary:
                "Duna Red / Rosso Duna is the red companion material from the Giallo Duna quarry in Namibia, offered for first-cut planning through JW Stone.",
              materialStatus: "source_folder",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceUrl: RED_GRANITI_QUARRY_MEDIA.dunaRed.sourceUrl,
              sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
            },
          ],
        },
        {
          category: "Danby Marble",
          categorySlug: "danby-marble",
          stones: [
            {
              name: "Eureka Danby / Calacatta Danby",
              slug: "eureka-danby-calacatta-danby",
              images: [RED_GRANITI_QUARRY_MEDIA.eurekaDanby.imageUrl],
              publicKind: "offering",
              publicSummary:
                "Eureka Danby / Calacatta Danby is U.S.-quarried Danby marble offered for architectural stone selection and first-cut planning through JW Stone.",
              materialStatus: "source_folder",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceUrl: RED_GRANITI_QUARRY_MEDIA.eurekaDanby.sourceUrl,
              sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
            },
            {
              name: "Imperial Danby",
              slug: "imperial-danby",
              images: [RED_GRANITI_QUARRY_MEDIA.imperialDanby.imageUrl],
              publicKind: "offering",
              publicSummary:
                "Imperial Danby is U.S.-quarried Danby marble offered for architectural stone selection and first-cut planning through JW Stone.",
              materialStatus: "source_folder",
              finishStatus: "unconfirmed",
              hideFinishDetails: true,
              sourceUrl: RED_GRANITI_QUARRY_MEDIA.imperialDanby.sourceUrl,
              sourceNote: OFFICIAL_QUARRY_SOURCE_NOTE,
            },
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
            "Explore source-backed architectural and exotic stone from R.E.D. Graniti, then send the material and first-cut requirements to JW Stone through TradeScout.",
          leadItemSlug: "lemurian-blue",
          indexable: true,
          collectionKind: "offerings",
        },
        {
          sourceSlug: "black-granite",
          publicSlug: "black-granite",
          title: "Black Granite",
          summary:
            "Explore quarry-origin black granite from R.E.D. Graniti for interior, exterior, cladding, memorial, block, slab, and first-cut planning through JW Stone.",
          leadItemSlug: "virginia-mist",
          indexable: true,
          collectionKind: "offerings",
        },
        {
          sourceSlug: "warm-granite",
          publicSlug: "warm-granite",
          title: "Warm Granite",
          summary:
            "Explore quarry-origin yellow and red granite from Brazil and Namibia, with material selection and exclusive first-cut distribution coordinated through JW Stone.",
          leadItemSlug: "giallo-veneziano",
          indexable: true,
          collectionKind: "offerings",
        },
        {
          sourceSlug: "danby-marble",
          publicSlug: "danby-marble",
          title: "Danby Marble",
          summary:
            "Explore U.S.-quarried Danby marble offerings from R.E.D. Graniti, then send the selected material and first-cut plan to JW Stone through TradeScout.",
          leadItemSlug: "imperial-danby",
          indexable: true,
          collectionKind: "offerings",
        },
      ],
    },
  },
  {
    type: "faq",
    data: {
      faqs: [
        {
          question: "What does exclusive first-cut distribution mean?",
          answer:
            "JW Stone is the exclusive first-cut distribution contact for this partnership. Send the selected material, format, dimensions, quantity, project location, schedule, and required cuts through Start a Request. No geographic territory is claimed on this profile.",
        },
        {
          question: "Can I request rough blocks or slabs?",
          answer:
            "Yes. R.E.D. Graniti works in rough blocks and slabs. JW Stone confirms the available format, dimensions, quantity, freight, timing, and first-cut path for each request.",
        },
        {
          question: "Is every R.E.D. Graniti quarry material shown here?",
          answer:
            "No. This profile starts with a selected quarry collection. Use Start a Request when you need another material from the broader R.E.D. Graniti portfolio.",
        },
        {
          question: "Is pricing public?",
          answer:
            "No. Pricing depends on the material, block or slab format, dimensions, quantity, freight, schedule, and first-cut requirements. JW Stone confirms it against the exact request.",
        },
      ],
    },
  },
  {
    type: "cta",
    data: {
      heading: "Start a first-cut request",
      description:
        "Send the R.E.D. Graniti material, block or slab format, dimensions, quantity, destination, timing, and first-cut requirements. JW Stone will review the source and next step.",
      contactOperatorName: "JW Stone",
      contactOperatorRole: "Exclusive first-cut distributor",
      requestExamples: [
        "Ask about a material",
        "Request first-cut coordination",
        "Match stone to a project",
        "Check block or slab availability",
      ],
    },
  },
] as const;
