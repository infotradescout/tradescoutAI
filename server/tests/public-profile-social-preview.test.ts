import { beforeEach, describe, expect, it, vi } from "vitest";

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
        faviconUrl: "https://www.thetradescout.com/images/businesses/jw-stone/favicon.png",
      },
      // These stale/unverified values must never override JW Stone's reconciled,
      // source-backed catalog when building a public social preview.
      contentBlocks: [
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
    expect(previewUrl.searchParams.get("v")).toMatch(/^3-/);

    const visibleContext = Object.values(preview!.context)
      .filter((value): value is string => typeof value === "string")
      .join(" ");

    expect(visibleContext).not.toMatch(/\b(?:polished|honed|leathered|finish)\b/i);
    expect(visibleContext).not.toMatch(/\$\s*\d|\b\d+(?:\.\d+)?\s*(?:per|\/)\s*sq\.?\s*ft\b/i);
    expect(visibleContext).not.toMatch(/\b\d+\s+slabs?\b/i);
    expect(visibleContext).not.toMatch(/\b(?:in[- ]?stock|available now|currently available)\b/i);
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

    expect(preview?.context.locationLabel).toBe("");
    expect(Object.values(preview!.context).join(" ")).not.toContain("Private City");
  });
});
