import { JW_STONE_SOCIAL_PRESENTATION } from "@shared/jwStonePresentation";

/**
 * JW Stone's profile-owned presentation data.
 *
 * Renderers consume the generic `profilePresentation` contract. Keeping the
 * brand, featured collection, story assets, and Phase 2 choices here prevents
 * shared profile UI from branching on the JW Stone slug.
 */
export const JW_STONE_PROFILE_PRESENTATION_BLOCK = {
  type: "profilePresentation",
  data: {
    layout: {
      variant: "brand-showcase",
    },
    header: {
      layout: "centered-brand",
      logoUrl: "/images/businesses/jw-stone/logo.svg",
      logoAlt: "JW Stone — Premium Wholesale Stone Distributor",
      homeLabel: "JW Stone home",
      backLabel: "Back within JW Stone",
      directConnectLabel: "Direct Connect with JW Stone",
    },
    hero: {
      videoUrl: "/images/businesses/jw-stone/video/hero.mp4",
      posterUrl: "/images/businesses/jw-stone/video/hero-poster.jpg",
      inventoryItemSlug: "amazonic-green",
      eyebrow: "Amazonic Green · collection highlight",
      headline: "Natural stone, selected at the source.",
      teaser:
        "Browse material references, then ask JW Stone to confirm what is physically available now.",
      preserveMedia: true,
      align: "left",
      zoomVideo: true,
    },
    copy: {
      inventoryTitle: "Stone Collection",
      inventoryTruth:
        "Collection photos and named materials are references, not automatic claims of current physical stock. Current inventory requires a confirmed physical item, quantity, dimensions, finish, location, and recent availability check.",
      ctaHeading: "Tell JW Stone what you need",
    },
    media: {
      fallbackLogoUrl: "/images/businesses/jw-stone/logo.svg",
      fallbackLogoAlt: "JW Stone",
    },
    inventory: {
      initialView: "catalog",
      density: "compact",
      pageSize: 12,
      pageStep: 12,
      stickyControls: true,
      sourceRequests: true,
      publicClassification: "material_collection",
      currentInventoryAuthority: "stone_asset_passports_and_inventory_positions",
      browseCtaImage:
        "/images/businesses/jw-stone/inventory-source/1YaoUMDs2-E_UvX7aqoNXRboo4M323utd.webp",
      browseCtaEyebrow: "White Rhino · collection example",
      featuredCollection: {
        label: "JW Stone Picks",
        slugs: ["blue-dunes", "cristallo", "gold-macaubas", "rhino-white", "taj-mahal", "titanium"],
      },
    },
    audience: {
      layout: "guided",
      availableFacts: [
        "Stone photos",
        "Material categories",
        "Confirmed finishes where listed",
        "Source counts where listed",
      ],
      contextHeading: "Helpful context to include",
    },
    faq: {
      layout: "disclosure",
    },
    recommendations: {
      initialLimit: 3,
      maxVisible: 24,
    },
    story: {
      eyebrow: "From source to finished space",
      heading: "Stone selected with the final room in mind.",
      images: [
        {
          src: "/images/businesses/jw-stone/story/quarry.webp",
          alt: "Natural stone quarry represented on the JW Stone website",
          label: "Direct quarry relationships",
        },
        {
          src: "/images/businesses/jw-stone/story/taj-living-room.webp",
          alt: "Light natural stone installation represented on the JW Stone website",
          label: "Stone specified for the whole space",
        },
        {
          src: "/images/businesses/jw-stone/story/fireplace.webp",
          alt: "Dark and light stone interior represented on the JW Stone website",
          label: "Material with architectural impact",
        },
        {
          src: "/images/businesses/jw-stone/story/mont-blanc-bar.webp",
          alt: "Illuminated stone bar represented on the JW Stone website",
          label: "Finished-space inspiration",
        },
      ],
    },
    social: {
      ...JW_STONE_SOCIAL_PRESENTATION,
    },
  },
} as const;

/**
 * Public routing is profile-owned data, separate from template presentation.
 * Shared profile, metadata, sitemap, share, and Direct Connect code all read
 * this same contract.
 */
export const JW_STONE_PUBLIC_DISCOVERY_BLOCK = {
  type: "publicDiscovery",
  data: {
    routes: {
      inventory: "stones",
      categories: "materials",
    },
    publicClassification: "material_collection",
    currentInventoryAuthority: "stone_asset_passports_and_inventory_positions",
    availabilityRule:
      "A published material or photo is not current inventory until a physical item and inventory position have been confirmed.",
    categories: [
      {
        sourceSlug: "granite",
        publicSlug: "granite",
        title: "Granite",
        summary:
          "Explore named Granite materials and photographs from the JW Stone collection, then ask JW Stone to confirm current physical stock, quantity, dimensions, finish, and availability.",
        leadItemSlug: "arizona-gold",
        indexable: true,
      },
      {
        sourceSlug: "marble",
        publicSlug: "marble",
        title: "Marble",
        summary:
          "Explore named Marble materials and photographs from the JW Stone collection, then ask JW Stone to confirm current physical stock, quantity, dimensions, finish, and availability.",
        leadItemSlug: "alabama-rose",
        indexable: true,
      },
      {
        sourceSlug: "quartzite",
        publicSlug: "quartzite",
        title: "Quartzite",
        summary:
          "Explore named Quartzite materials and photographs from the JW Stone collection, then ask JW Stone to confirm current physical stock, quantity, dimensions, finish, and availability.",
        leadItemSlug: "atlantic",
        indexable: true,
      },
      {
        sourceSlug: "quartz",
        publicSlug: "engineered-quartz",
        title: "Engineered Quartz",
        summary:
          "Explore named Engineered Quartz materials and photographs from the JW Stone collection, then ask JW Stone to confirm current physical stock, quantity, dimensions, finish, and availability.",
        leadItemSlug: "aj-quartz",
        indexable: true,
      },
      {
        sourceSlug: "onyx",
        publicSlug: "onyx",
        title: "Onyx",
        summary:
          "Explore Onyx material references and photographs, then ask JW Stone to confirm sourcing options and current physical availability for the project.",
        leadItemSlug: "honey-onyx",
        indexable: true,
      },
      {
        sourceSlug: "soapstone",
        publicSlug: "soapstone",
        title: "Soapstone",
        summary:
          "Explore Soapstone material references and photographs, then ask JW Stone to confirm sourcing options and current physical availability for the project.",
        leadItemSlug: "marina-black-soapstone",
        indexable: true,
      },
      {
        sourceSlug: "basalt",
        publicSlug: "basalt",
        title: "Basalt",
        summary:
          "Explore Basalt material references and photographs, then ask JW Stone to confirm sourcing options and current physical availability for the project.",
        leadItemSlug: "matrix-basalt",
        indexable: true,
      },
    ],
  },
} as const;