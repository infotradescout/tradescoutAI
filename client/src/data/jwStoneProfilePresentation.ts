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
      eyebrow: "Amazonic Green · full inventory",
      headline: "Natural stone, selected at the source.",
      teaser: "Search the full collection or ask JW Stone about your project.",
      preserveMedia: true,
      align: "left",
      zoomVideo: true,
    },
    copy: {
      inventoryTitle: "Browse Full Inventory",
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
      browseCtaImage:
        "/images/businesses/jw-stone/inventory-source/1YaoUMDs2-E_UvX7aqoNXRboo4M323utd.webp",
      browseCtaEyebrow: "White Rhino · full inventory",
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
    categories: [
      {
        sourceSlug: "granite",
        publicSlug: "granite",
        title: "Granite",
        summary:
          "Browse granite slabs and named granite materials from JW Stone's Pensacola, Florida material library. Compare published photos, then ask JW Stone to confirm current pricing or availability for your project.",
        leadItemSlug: "arizona-gold",
        indexable: true,
        collectionKind: "offerings",
      },
      {
        sourceSlug: "marble",
        publicSlug: "marble",
        title: "Marble",
        summary:
          "Browse marble slabs and named marble materials from JW Stone's Pensacola, Florida material library. Compare published photos, then ask JW Stone to confirm current pricing or availability for your project.",
        leadItemSlug: "alabama-rose",
        indexable: true,
        collectionKind: "offerings",
      },
      {
        sourceSlug: "quartzite",
        publicSlug: "quartzite",
        title: "Quartzite",
        summary:
          "Browse quartzite slabs and named quartzite materials from JW Stone's Pensacola, Florida material library. Compare published photos, then ask JW Stone to confirm current pricing or availability for your project.",
        leadItemSlug: "atlantic",
        indexable: true,
        collectionKind: "offerings",
      },
      {
        sourceSlug: "quartz",
        publicSlug: "engineered-quartz",
        title: "Engineered Quartz",
        summary:
          "Browse engineered quartz materials from JW Stone's Pensacola, Florida material library. Compare published photos, then ask JW Stone to confirm current pricing or availability for your project.",
        leadItemSlug: "aj-quartz",
        indexable: true,
        collectionKind: "offerings",
      },
      {
        sourceSlug: "onyx",
        publicSlug: "onyx",
        title: "Onyx",
        summary:
          "Browse onyx slabs and named onyx materials from JW Stone's Pensacola, Florida material library. Review published photos, then ask JW Stone to confirm current pricing or availability for your project.",
        leadItemSlug: "honey-onyx",
        indexable: true,
        collectionKind: "offerings",
      },
      {
        sourceSlug: "soapstone",
        publicSlug: "soapstone",
        title: "Soapstone",
        summary:
          "Browse soapstone slabs and named soapstone materials from JW Stone's Pensacola, Florida material library. Review published photos, then ask JW Stone to confirm current pricing or availability for your project.",
        leadItemSlug: "marina-black-soapstone",
        indexable: true,
        collectionKind: "offerings",
      },
      {
        sourceSlug: "basalt",
        publicSlug: "basalt",
        title: "Basalt",
        summary:
          "Browse basalt slabs and named basalt materials from JW Stone's Pensacola, Florida material library. Review published photos, then ask JW Stone to confirm current pricing or availability for your project.",
        leadItemSlug: "matrix-basalt",
        indexable: true,
        collectionKind: "offerings",
      },
    ],
  },
} as const;
