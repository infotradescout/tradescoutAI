import { beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_INVENTORY_CATEGORIES } from "../../client/src/data/jwStoneInventory";
import { JW_STONE_PUBLIC_DISCOVERY_BLOCK } from "../../client/src/data/jwStoneProfilePresentation";
import { listProfileGalleryItems } from "../../shared/profileGalleryShare";

const storageMocks = vi.hoisted(() => ({
  getProfileBySlugPublic: vi.fn(),
  getBusinessPublicById: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: storageMocks,
}));

import { resolvePublicProfileSocialPreview } from "../publicProfileSocialPreview";

const BLUE_MARE_SOURCE_IMAGE =
  "https://www.thetradescout.com/images/businesses/jw-stone/inventory-source/1vGOdELy1LIE5i-A8lurdUMnRdjzotBMo.webp";
const PUBLIC_PRESENTATION_LOGO = "/images/businesses/pro-fab-specialty-services/logo.svg";
const PUBLIC_PRESENTATION_HERO = "/images/businesses/pro-fab-specialty-services/cover.svg";
const PUBLIC_ROOFING_LOGO = "/images/businesses/la-plumbing-solutions/logo.jpg";
const PUBLIC_ROOFING_HERO = "/images/businesses/la-plumbing-solutions/hero.jpg";
const PUBLIC_GENERIC_MARK = "/images/businesses/jrs-auto-glass/logo.webp";
const JW_CATEGORY_PREVIEW_CASES = JW_STONE_PUBLIC_DISCOVERY_BLOCK.data.categories.map((config) => {
  const sourceCategory = JW_STONE_INVENTORY_CATEGORIES.find(
    (category) => category.categorySlug === config.sourceSlug
  );
  const leadStone = sourceCategory?.stones.find((stone) => stone.slug === config.leadItemSlug);
  if (!sourceCategory || !leadStone?.images[0]) {
    throw new Error(`Missing JW category preview fixture for ${config.publicSlug}`);
  }
  return {
    slug: config.publicSlug,
    name: config.title,
    itemCount: sourceCategory.stones.length,
    sourceImageUrl: new URL(leadStone.images[0], "https://www.thetradescout.com").toString(),
  };
});

describe("public profile social preview context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.getProfileBySlugPublic.mockResolvedValue({
      id: "profile-jw",
      slug: "jw-stone",
      displayName: "JW Stone LLC",
      headline: "Natural stone inventory",
      roleContext: "wholesaler",
      servicesDescription: "Browse current stone inventory.",
      businessId: "business-jw",
      updatedAt: "2026-07-28T12:00:00.000Z",
      seoMeta: {
        customDomain: "jwstonelogistics.com",
        imageUrl:
          "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png",
        faviconUrl: "https://www.thetradescout.com/images/businesses/jw-stone/favicon.png",
      },
      ctaConfig: {
        primary: {
          label: "Generic request",
          kind: "message",
          value: "private-routing-value",
        },
      },
      // These stale/unverified values must never override JW Stone's reconciled,
      // source-backed catalog when building a public social preview.
      contentBlocks: [
        JW_STONE_PUBLIC_DISCOVERY_BLOCK,
        {
          type: "profilePresentation",
          data: {
            social: {
              brandName: "JW Stone Logistics",
              logoUrl: "/images/businesses/jw-stone/logo.svg",
              profileImageUrl: "/images/businesses/jw-stone/video/hero-poster.jpg",
              accentColor: "#81904a",
              profileCta: "Explore inventory",
              inventoryCta: "View photos · Request pricing",
              galleryCta: "View project",
            },
          },
        },
        {
          type: "inventoryCatalog",
          data: {
            categories: [
              {
                category: "Quartzite",
                categorySlug: "quartzite",
                stones: [
                  {
                    name: "Blue Mare",
                    slug: "blue-mare",
                    images: ["/uploads/unverified-blue-mare.webp"],
                    finishes: ["Polished"],
                    pricePerSqFt: 16.5,
                    slabCounts: [25],
                    availability: "in_stock",
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    storageMocks.getBusinessPublicById.mockResolvedValue({
      id: "business-jw",
      name: "JW Stone LLC",
      categories: ["Stone wholesaler"],
      serviceAreas: ["Escambia County"],
      tradePartner: true,
      city: "Pensacola",
      stateCode: "FL",
      brandColors: {
        accent: "#81904a",
      },
    });
  });

  it("builds Blue Mare from verified context and asks for pricing without claiming it", async () => {
    const preview = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
      itemType: "inventory",
      itemSlug: "blue-mare",
      pageOrigin: "https://jwstonelogistics.com",
    });

    expect(preview).not.toBeNull();
    expect(preview?.context).toMatchObject({
      kind: "inventory",
      title: "Blue Mare",
      eyebrow: "Quartzite",
      brandName: "JW Stone Logistics",
      supportingText: "JW Stone Logistics",
      locationLabel: "Pensacola, FL",
      ctaLabel: "View photos · Request pricing",
      sourceImageUrl: BLUE_MARE_SOURCE_IMAGE,
      logoUrl: "https://www.thetradescout.com/images/businesses/jw-stone/logo.svg",
      accentColor: "#81904a",
    });
    expect(preview?.sourceImageUrl).toBe(BLUE_MARE_SOURCE_IMAGE);

    const previewUrl = new URL(preview!.previewImageUrl);
    expect(previewUrl.origin).toBe("https://www.thetradescout.com");
    expect(previewUrl.pathname).toBe("/images/social/profile/jw-stone/inventory/blue-mare.png");
    expect(previewUrl.searchParams.get("v")).toMatch(/^4-/);

    const visibleContext = Object.values(preview!.context)
      .filter((value): value is string => typeof value === "string")
      .join(" ");

    expect(visibleContext).not.toMatch(/\b(?:polished|honed|leathered|finish)\b/i);
    expect(visibleContext).not.toMatch(/\$\s*\d|\b\d+(?:\.\d+)?\s*(?:per|\/)\s*sq\.?\s*ft\b/i);
    expect(visibleContext).not.toMatch(/\b\d+\s+slabs?\b/i);
    expect(visibleContext).not.toMatch(/\b(?:in[- ]?stock|available now|currently available)\b/i);
    expect(visibleContext).not.toContain("private-routing-value");
    expect(visibleContext).not.toContain("Generic request");
  });

  it("keeps a synthetic JW inventory preview nameless while preserving its route and photo", async () => {
    const preview = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
      itemType: "inventory",
      itemSlug: "trending-selection-05",
    });

    expect(preview).not.toBeNull();
    expect(preview?.context).toMatchObject({
      kind: "inventory",
      title: "",
      eyebrow: "Trending at JW Stone",
      brandName: "JW Stone Logistics",
      supportingText: "JW Stone Logistics",
    });
    expect(preview?.previewImageUrl).toContain(
      "/images/social/profile/jw-stone/inventory/trending-selection-05.png"
    );
    expect(preview?.sourceImageUrl).toMatch(
      /^https:\/\/www\.thetradescout\.com\/images\/businesses\/jw-stone\/inventory-source\/.+\.webp$/
    );
    expect(JSON.stringify(preview?.context)).not.toMatch(/Unnamed slab|Trending Selection 05/);
  });

  it("uses the profile-owned card image without replacing exact inventory media", async () => {
    const profilePreview = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
    });
    const inventoryPreview = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
      itemType: "inventory",
      itemSlug: "blue-mare",
    });

    expect(profilePreview?.sourceImageUrl).toBe(
      "https://www.thetradescout.com/images/businesses/jw-stone/video/hero-poster.jpg"
    );
    expect(profilePreview?.context.layout).toBe("brand-hero");
    expect(inventoryPreview?.sourceImageUrl).toBe(BLUE_MARE_SOURCE_IMAGE);
    expect(inventoryPreview?.sourceImageUrl).not.toBe(profilePreview?.sourceImageUrl);
    expect(inventoryPreview?.context.layout).toBe("split");
  });

  it("keeps JW gallery cards on their exact photo, original logo, and split layout", async () => {
    const galleryBlock = {
      id: "recent-work",
      type: "gallery",
      data: {
        title: "Recent Work",
        images: [
          {
            id: "blue-stone-patio",
            url: new URL(BLUE_MARE_SOURCE_IMAGE).pathname,
            title: "Blue Stone Patio",
            caption: "A finished local patio installation.",
            alt: "Finished blue stone patio",
          },
        ],
      },
    };
    const profileRecord = await storageMocks.getProfileBySlugPublic();
    storageMocks.getProfileBySlugPublic.mockResolvedValueOnce({
      ...profileRecord,
      contentBlocks: [...profileRecord.contentBlocks, galleryBlock],
    });
    const galleryItem = listProfileGalleryItems([galleryBlock])[0];

    const preview = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
      itemType: "gallery",
      itemSlug: galleryItem.slug,
    });

    expect(preview?.context).toMatchObject({
      kind: "gallery",
      title: "Blue Stone Patio",
      sourceImageUrl: BLUE_MARE_SOURCE_IMAGE,
      logoUrl: "https://www.thetradescout.com/images/businesses/jw-stone/logo.svg",
      layout: "split",
    });
    expect(preview?.sourceImageUrl).toBe(BLUE_MARE_SOURCE_IMAGE);
  });

  it("uses a legacy presentation hero instead of treating the wide SEO logo as the profile photo", async () => {
    storageMocks.getProfileBySlugPublic.mockResolvedValueOnce({
      id: "profile-jw",
      slug: "jw-stone",
      displayName: "JW Stone LLC",
      headline: "Natural stone inventory",
      roleContext: "wholesaler",
      servicesDescription: "Browse current stone inventory.",
      businessId: "business-jw",
      updatedAt: "2026-07-28T21:01:33.152Z",
      seoMeta: {
        customDomain: "jwstonelogistics.com",
        imageUrl:
          "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png",
        faviconUrl: "https://www.thetradescout.com/images/businesses/jw-stone/favicon.png",
      },
      ctaConfig: {
        primary: {
          label: "Request trade pricing",
          kind: "message",
        },
      },
      contentBlocks: [JW_STONE_PUBLIC_DISCOVERY_BLOCK],
    });

    const preview = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
    });

    expect(preview?.context).toMatchObject({
      kind: "profile",
      sourceImageUrl:
        "https://www.thetradescout.com/images/businesses/jw-stone/video/hero-poster.jpg",
      logoUrl: "https://www.thetradescout.com/images/businesses/jw-stone/logo-social.svg",
      layout: "brand-hero",
    });
    expect(preview?.sourceImageUrl).not.toContain("logo-social-preview");
  });

  it("leaves every non-JW profile on its own social presentation", async () => {
    storageMocks.getProfileBySlugPublic.mockResolvedValueOnce({
      id: "profile-other",
      slug: "other-business",
      displayName: "Other Business",
      headline: "Its own profile",
      roleContext: "service provider",
      servicesDescription: "Its own services.",
      businessId: "business-other",
      updatedAt: "2026-07-30T12:00:00.000Z",
      seoMeta: {
        imageUrl: "https://www.thetradescout.com/images/businesses/other/seo-card.jpg",
      },
      ctaConfig: {
        primary: {
          label: "Start a request",
          kind: "message",
        },
      },
      contentBlocks: [
        {
          type: "profilePresentation",
          data: {
            social: {
              brandName: "Other Business",
              logoUrl: PUBLIC_PRESENTATION_LOGO,
              profileImageUrl: PUBLIC_PRESENTATION_HERO,
              accentColor: "#123456",
              profileCta: "View profile",
            },
          },
        },
      ],
    });
    storageMocks.getBusinessPublicById.mockResolvedValueOnce({
      id: "business-other",
      name: "Other Business",
      categories: ["Service provider"],
      serviceAreas: ["Tangipahoa Parish"],
      city: "Hammond",
      stateCode: "LA",
    });

    const preview = await resolvePublicProfileSocialPreview({
      profileSlug: "other-business",
    });

    expect(preview?.context).toMatchObject({
      brandName: "Other Business",
      sourceImageUrl: `https://www.thetradescout.com${PUBLIC_PRESENTATION_HERO}`,
      logoUrl: `https://www.thetradescout.com${PUBLIC_PRESENTATION_LOGO}`,
      accentColor: "#123456",
      layout: "split",
    });
    expect(preview?.sourceImageUrl).not.toContain("/jw-stone/");
  });

  it.each(JW_CATEGORY_PREVIEW_CASES)(
    "builds a stable category-specific card for JW $name",
    async ({ slug, name, itemCount, sourceImageUrl }) => {
      const request = {
        profileSlug: "jw-stone",
        itemType: "category" as const,
        itemSlug: slug,
        pageOrigin: "https://jwstonelogistics.com",
      };
      const preview = await resolvePublicProfileSocialPreview(request);
      const repeated = await resolvePublicProfileSocialPreview(request);

      expect(preview).not.toBeNull();
      expect(preview?.context).toMatchObject({
        kind: "category",
        title: name,
        eyebrow: `${itemCount} current ${itemCount === 1 ? "selection" : "selections"}`,
        brandName: "JW Stone Logistics",
        supportingText: "JW Stone Logistics",
        locationLabel: "Pensacola, FL",
        ctaLabel: "View photos · Request pricing",
        sourceImageUrl,
        logoUrl: "https://www.thetradescout.com/images/businesses/jw-stone/logo.svg",
        accentColor: "#81904a",
      });
      expect(preview?.sourceImageUrl).toBe(sourceImageUrl);
      expect(repeated?.fingerprint).toBe(preview?.fingerprint);
      expect(repeated?.previewImageUrl).toBe(preview?.previewImageUrl);

      const previewUrl = new URL(preview!.previewImageUrl);
      expect(previewUrl.origin).toBe("https://www.thetradescout.com");
      expect(previewUrl.pathname).toBe(`/images/social/profile/jw-stone/category/${slug}.png`);
      expect(previewUrl.searchParams.get("v")).toMatch(/^4-/);
    }
  );

  it("does not publish a preview for JW's excluded unconfirmed placeholder category", async () => {
    await expect(
      resolvePublicProfileSocialPreview({
        profileSlug: "jw-stone",
        itemType: "category",
        itemSlug: "unconfirmed",
        pageOrigin: "https://jwstonelogistics.com",
      })
    ).resolves.toBeNull();
  });

  it("uses the same stored presentation contract for an unrelated profile", async () => {
    storageMocks.getProfileBySlugPublic.mockResolvedValueOnce({
      id: "profile-roofing",
      slug: "blue-sky-roofing",
      displayName: "Blue Sky Roofing",
      headline: "Roofing for local homes",
      roleContext: "contractor",
      servicesDescription: "Roof repairs and replacement.",
      businessId: "business-roofing",
      updatedAt: "2026-07-28T13:00:00.000Z",
      seoMeta: {
        imageUrl: PUBLIC_ROOFING_HERO,
        faviconUrl: PUBLIC_ROOFING_LOGO,
      },
      ctaConfig: {
        primary: {
          label: "Request an estimate",
          kind: "message",
          value: "owner@private.example",
        },
      },
      contentBlocks: [
        {
          type: "profilePresentation",
          data: {
            social: {
              brandName: "Blue Sky Roofing Co.",
              logoUrl: PUBLIC_ROOFING_LOGO,
              profileImageUrl: PUBLIC_ROOFING_HERO,
              accentColor: "#2563eb",
              profileCta: "Plan a roof project",
            },
          },
        },
      ],
    });
    storageMocks.getBusinessPublicById.mockResolvedValueOnce({
      id: "business-roofing",
      name: "Blue Sky Roofing LLC",
      categories: ["Roofing contractor"],
      tradePartner: true,
      city: "Dallas",
      stateCode: "TX",
      brandColors: {
        primary: "#0f172a",
      },
    });

    const preview = await resolvePublicProfileSocialPreview({
      profileSlug: "blue-sky-roofing",
    });

    expect(preview?.context).toMatchObject({
      kind: "profile",
      title: "Blue Sky Roofing Co.",
      brandName: "Blue Sky Roofing Co.",
      eyebrow: "Roofing contractor",
      supportingText: "Roofing for local homes",
      locationLabel: "Dallas, TX",
      ctaLabel: "Plan a roof project",
      sourceImageUrl: `https://www.thetradescout.com${PUBLIC_ROOFING_HERO}`,
      logoUrl: `https://www.thetradescout.com${PUBLIC_ROOFING_LOGO}`,
      accentColor: "#2563eb",
    });
    expect(Object.values(preview!.context).join(" ")).not.toContain("owner@private.example");
    expect(preview?.previewImageUrl).toMatch(
      /^https:\/\/www\.thetradescout\.com\/images\/social\/profile\/blue-sky-roofing\.png\?v=4-/
    );
  });

  it("falls back to generic profile fields and rejects contact-bypass CTA copy", async () => {
    storageMocks.getProfileBySlugPublic.mockResolvedValueOnce({
      id: "profile-generic",
      slug: "generic-repair",
      displayName: "Generic Repair",
      headline: "Repairs done locally",
      roleContext: "contractor",
      servicesDescription: "General repairs.",
      businessId: "business-generic",
      updatedAt: "2026-07-28T14:00:00.000Z",
      seoMeta: {
        faviconUrl: PUBLIC_GENERIC_MARK,
      },
      ctaConfig: {
        primary: {
          label: "Call 214-555-0199",
          kind: "call",
          value: "214-555-0199",
        },
      },
      contentBlocks: [],
    });
    storageMocks.getBusinessPublicById.mockResolvedValueOnce({
      id: "business-generic",
      name: "Generic Repair LLC",
      categories: ["Repair service"],
      tradePartner: false,
      brandColors: {
        accent: "#16a34a",
      },
    });

    const preview = await resolvePublicProfileSocialPreview({
      profileSlug: "generic-repair",
    });

    expect(preview?.context).toMatchObject({
      brandName: "Generic Repair LLC",
      logoUrl: `https://www.thetradescout.com${PUBLIC_GENERIC_MARK}`,
      accentColor: "#16a34a",
      ctaLabel: "View profile · Direct Connect",
      locationLabel: "",
    });
    expect(Object.values(preview!.context).join(" ")).not.toContain("214-555-0199");
  });

  it("normalizes equivalent photo selectors before fingerprinting and URL generation", async () => {
    const omitted = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
      itemType: "inventory",
      itemSlug: "blue-mare",
    });
    const invalid = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
      itemType: "inventory",
      itemSlug: "blue-mare",
      photo: "random-cache-buster",
    });
    const outOfRange = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
      itemType: "inventory",
      itemSlug: "blue-mare",
      photo: "99",
    });

    expect(invalid?.fingerprint).toBe(omitted?.fingerprint);
    expect(outOfRange?.fingerprint).toBe(omitted?.fingerprint);
    expect(invalid?.previewImageUrl).toBe(omitted?.previewImageUrl);
    expect(outOfRange?.previewImageUrl).toBe(omitted?.previewImageUrl);
  });

  it("rejects malformed profile and unpublished item selectors", async () => {
    const malformedProfile = await resolvePublicProfileSocialPreview({
      profileSlug: "../../jw-stone",
      itemType: "inventory",
      itemSlug: "blue-mare",
    });

    expect(malformedProfile).toBeNull();
    expect(storageMocks.getProfileBySlugPublic).not.toHaveBeenCalled();

    const unknownItem = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
      itemType: "inventory",
      itemSlug: "private-draft",
    });

    expect(unknownItem).toBeNull();
  });

  it("does not place a non-partner business location on its profile card", async () => {
    storageMocks.getBusinessPublicById.mockResolvedValueOnce({
      id: "business-jw",
      name: "JW Stone LLC",
      categories: ["Stone wholesaler"],
      tradePartner: false,
      city: "Private City",
      stateCode: "FL",
    });

    const preview = await resolvePublicProfileSocialPreview({
      profileSlug: "jw-stone",
    });

    expect(preview?.context).toMatchObject({
      title: "JW Stone Logistics",
      brandName: "JW Stone Logistics",
      ctaLabel: "Explore inventory",
      locationLabel: "",
    });
    expect(Object.values(preview!.context).join(" ")).not.toContain("Private City");
  });
});
