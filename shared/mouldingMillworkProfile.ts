export const MOULDING_MILLWORK_PROFILE_SLUG = "moulding-millwork-supply";
export const MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE =
  "operator_confirmed_selective_inheritance";
export const MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE =
  "operator_confirmed_selective_inheritance_revoked";

export const MOULDING_MILLWORK_PUBLIC_SOURCES = [
  "https://mouldingmillworksupply.com/",
  "https://mouldingmillworksupply.com/faqs/",
  "https://mouldingmillworksupply.com/moulding/",
  "https://mouldingmillworksupply.com/mms-advantage/",
  "https://mouldingmillworksupply.com/windows/",
  "https://mouldingmillworksupply.com/exterior-doors/",
  "https://www.loewen.com/dealers/moulding-millwork-supply/",
] as const;

// Named, individually photographed moulding profiles from the business's own
// catalog pages -- real evidence, not stock/placeholder art.
const MOULDING_PROFILE_IMAGES = [
  "https://mouldingmillworksupply.com/wp-content/uploads/2019/02/WM106SOL-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2019/02/WM254SOL-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2019/02/WM239SOL-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2019/02/WM206SOL-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2019/02/WM147Pine-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2019/02/WM1021Pine-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2019/02/WM390PFJ-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2019/02/WM49SOL-300x300.png",
] as const;

const BEADLINE_COLLECTION_IMAGES = [
  "https://mouldingmillworksupply.com/wp-content/uploads/2018/03/beadline2pc-casing-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2018/03/beadline-base-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2018/03/beadline-cap-300x300.png",
  "https://mouldingmillworksupply.com/wp-content/uploads/2018/03/beadline-casing-300x300.png",
] as const;

export const MOULDING_MILLWORK_PROFILE_CONTENT_BLOCKS = [
  {
    type: "hero",
    data: {
      eyebrow: "Moulding, doors & windows",
      headerLabel: "Moulding · Doors & Windows · Millwork",
      teaser:
        "Gulf South supplier of moulding, interior and exterior doors, windows, select stair products, hardware, shutters, and related millwork for contractors, builders, and homeowners.",
    },
  },
  {
    type: "about",
    data: {
      text: "Moulding & Millwork Supply stocks moulding, interior and exterior doors, windows, select stair products, hardware, and shutters for contractors, builders, and homeowners across the Gulf South. The MMS Advantage program gives contractors a dedicated catalog and quote cart for plan review, product selection, and quote preparation.",
    },
  },
  {
    type: "trust",
    data: {
      items: [
        "Harahan, LA",
        "Mon–Fri, 6:30 AM–4:00 PM",
        "450+ moulding profiles stocked",
        "MMS Advantage contractor quotes",
      ],
    },
  },
  {
    type: "differentiators",
    data: {
      items: [
        {
          title: "Moulding, doors & windows under one roof",
          body: "Interior and exterior doors, windows, moulding and trim, select stair products, hardware, and shutters from a single Gulf South supplier.",
        },
        {
          title: "450+ moulding profiles in stock",
          body: "Crown, base, casing, chair rail, stool, trim, and specialty profiles, including the named Beadline collection shown here.",
        },
        {
          title: "Plan and measurement review",
          body: "Send plans or measurements for doors, windows, and millwork and get help matching them to named catalog products.",
        },
        {
          title: "MMS Advantage contractor quoting",
          body: "A contractor-oriented catalog and quote cart for building a product quote request without starting from scratch.",
        },
      ],
    },
  },
  {
    type: "audience",
    data: {
      title: "Who We Work With",
      items: [
        {
          title: "Contractors",
          body: "Use MMS Advantage to review plans, select products, and prepare a quote for the job.",
        },
        {
          title: "Builders",
          body: "Source moulding, doors, and windows for a project alongside consistent product availability.",
        },
        {
          title: "Homeowners",
          body: "Bring in a project's doors, windows, or trim details and get help matching them to what's in stock.",
        },
      ],
    },
  },
  {
    type: "inventoryCatalog",
    data: {
      title: "Explore the moulding collection",
      description: "Open any profile to see the available photos.",
      categories: [
        {
          category: "Moulding Profiles",
          categorySlug: "moulding-profiles",
          stones: [
            {
              name: "Moulding Profile Collection",
              slug: "moulding-profiles",
              images: MOULDING_PROFILE_IMAGES,
              materialStatus: "source_folder",
              hideFinishDetails: true,
              sourceNote: "Named moulding profiles shown on the business's own catalog pages.",
            },
          ],
        },
        {
          category: "Beadline Collection",
          categorySlug: "beadline-collection",
          stones: [
            {
              name: "Beadline Collection",
              slug: "beadline-collection",
              images: BEADLINE_COLLECTION_IMAGES,
              materialStatus: "source_folder",
              hideFinishDetails: true,
              sourceNote:
                "The Beadline casing, base, and cap profiles shown on the business's own catalog pages.",
            },
          ],
        },
      ],
    },
  },
  {
    type: "cta",
    data: {
      heading: "Tell Moulding & Millwork Supply what you need",
      description: "Ask about a moulding profile, a door or window, or start a project quote.",
      requestExamples: ["Moulding profile", "Door or window", "Project quote", "Plan review"],
      footerText: "Open Monday–Friday, 6:30 AM–4:00 PM.",
    },
  },
] as const;
