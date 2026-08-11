import { describe, expect, it } from "vitest";
import {
  buildProfileInventoryShareSearch,
  createProfileInventoryItemShareMetadata,
  listProfileInventoryItems,
  normalizeProfileInventoryItemSlug,
  profileInventoryShareIndexForDisplay,
} from "@shared/profileItemShare";
import { resolveProfileItemShareMetadata } from "../profileItemShareMetadata";

const inventoryCategoriesFixture = [
  {
    category: "Quartzite",
    categorySlug: "quartzite",
    stones: [
      {
        name: "Sample Stone",
        slug: "sample-stone",
        images: ["/images/sample-one.webp", "javascript:alert(1)", "/images/sample-two.webp"],
      },
    ],
  },
];

describe("profile inventory item sharing", () => {
  it("builds stable item URLs and preserves an explicitly selected photo", () => {
    expect(buildProfileInventoryShareSearch("sample-stone")).toBe("?stone=sample-stone");
    expect(buildProfileInventoryShareSearch("sample-stone", 2)).toBe("?stone=sample-stone&photo=3");
  });

  it("rejects malformed item slugs", () => {
    expect(normalizeProfileInventoryItemSlug("../../admin")).toBeNull();
    expect(normalizeProfileInventoryItemSlug("sample-stone")).toBe("sample-stone");
  });

  it("uses the selected safe product photo in canonical and social metadata", () => {
    const metadata = createProfileInventoryItemShareMetadata({
      profileName: "Example Supply",
      profileUrl: "https://example.com/",
      assetOrigin: "https://example.com/",
      categories: inventoryCategoriesFixture,
      itemSlug: "sample-stone",
      // The unsafe middle entry is discarded, so photo 2 selects sample-two.
      photo: "2",
    });

    expect(metadata).toMatchObject({
      itemName: "Sample Stone",
      category: "Quartzite",
      imageIndex: 1,
      title: "Sample Stone at Example Supply",
      imageUrl: "https://example.com/images/sample-two.webp",
      canonical: "https://example.com/inventory/sample-stone?photo=2",
    });
    expect(metadata?.description).toBe(
      "View Sample Stone (Quartzite) in Example Supply's current inventory. See this photo."
    );
    expect(metadata?.description).not.toContain("protected");
  });

  it("uses profile-owned offering language without inventing inventory availability", () => {
    const metadata = createProfileInventoryItemShareMetadata({
      profileName: "ISSA Build",
      profileUrl: "https://www.thetradescout.com/u/issa-build",
      assetOrigin: "https://www.thetradescout.com",
      categories: [
        {
          category: "Onyx",
          categorySlug: "onyx",
          stones: [
            {
              name: "Honey Onyx",
              slug: "honey-onyx",
              images: ["/images/businesses/issa-build/applications/03.jpg"],
              publicKind: "offering",
              publicSummary:
                "Warm amber, translucent Honey Onyx from ISSA Build for custom backlit interiors.",
            },
          ],
        },
      ],
      itemSlug: "honey-onyx",
    });

    expect(metadata).toMatchObject({
      itemName: "Honey Onyx",
      description:
        "Warm amber, translucent Honey Onyx from ISSA Build for custom backlit interiors.",
      imageAlt: "Honey Onyx — ISSA Build material photo 1",
      hasPublicSummary: true,
      publicKind: "offering",
    });
    expect(metadata?.description).not.toMatch(/current inventory|pricing|availability/i);
  });

  it("keeps exact-photo URLs stable when presentation order changes", () => {
    const displayImages = ["/images/full-slab.webp", "/images/detail.webp", "/images/yard.webp"];
    const shareImageOrder = [1, 2, 0];
    const metadata = createProfileInventoryItemShareMetadata({
      profileName: "Example Supply",
      profileUrl: "https://example.com/",
      assetOrigin: "https://example.com/",
      categories: [
        {
          category: "Quartzite",
          stones: [
            {
              name: "Stable Stone",
              slug: "stable-stone",
              images: displayImages,
              shareImageOrder,
            },
          ],
        },
      ],
      itemSlug: "stable-stone",
      photo: "2",
    });

    expect(metadata).toMatchObject({
      imageIndex: 2,
      imageUrl: "https://example.com/images/yard.webp",
      canonical: "https://example.com/inventory/stable-stone?photo=2",
    });
    expect(profileInventoryShareIndexForDisplay(displayImages, shareImageOrder, 0)).toBe(2);
    expect(buildProfileInventoryShareSearch("stable-stone", 2)).toBe("?stone=stable-stone&photo=3");
  });

  it("carries stable share ordinals into crawler inventory listings", () => {
    expect(
      listProfileInventoryItems([
        {
          category: "Quartzite",
          stones: [
            {
              name: "Stable Stone",
              slug: "stable-stone",
              images: ["/images/full-slab.webp", "/images/detail.webp", "/images/yard.webp"],
              shareImageOrder: [1, 2, 0],
            },
          ],
        },
      ])
    ).toEqual([
      {
        name: "Stable Stone",
        hasPublicName: true,
        slug: "stable-stone",
        category: "Quartzite",
        images: ["/images/full-slab.webp", "/images/detail.webp", "/images/yard.webp"],
        imageIndex: 1,
        shareImageIndex: 0,
      },
    ]);
  });

  it("does not describe a standalone product profile as its own inventory", () => {
    const metadata = createProfileInventoryItemShareMetadata({
      profileName: "Honey Onyx",
      profileUrl: "https://example.com/u/honey-onyx",
      assetOrigin: "https://example.com/",
      categories: [
        {
          category: "Onyx",
          categorySlug: "onyx",
          stones: [
            {
              name: "Honey Onyx",
              slug: "honey-onyx",
              images: ["/images/businesses/honey-onyx/2.jpg"],
            },
          ],
        },
      ],
      itemSlug: "honey-onyx",
    });

    expect(metadata).toMatchObject({
      title: "Honey Onyx | TradeScout",
      imageUrl: "https://example.com/images/businesses/honey-onyx/2.jpg",
      canonical: "https://example.com/u/honey-onyx/inventory/honey-onyx",
    });
    expect(metadata?.description).not.toContain("Honey Onyx's current inventory");
    expect(metadata?.imageAlt).toBe("Honey Onyx material photo 1");
  });

  it("resolves JW Stone shares from the reconciled catalog instead of stale profile data", () => {
    const metadata = resolveProfileItemShareMetadata({
      profileSlug: "jw-stone",
      profileName: "JW Stone LLC",
      profileUrl: "https://jwstonelogistics.com/",
      assetOrigin: "https://jwstonelogistics.com/",
      contentBlocks: [
        {
          type: "publicDiscovery",
          data: { routes: { inventory: "stones" } },
        },
      ],
      itemSlug: "amazonic-green",
    });

    expect(metadata).toMatchObject({
      itemName: "Amazonic Green",
      itemSlug: "amazonic-green",
      imageIndex: 0,
      canonical: "https://jwstonelogistics.com/stones/amazonic-green",
    });
    expect(metadata?.imageUrl).toMatch(
      /^https:\/\/jwstonelogistics\.com\/images\/businesses\/jw-stone\/inventory-source\/.+\.webp$/
    );
  });

  it("keeps synthetic JW Stone reconciliation groups publicly nameless", () => {
    const metadata = resolveProfileItemShareMetadata({
      profileSlug: "jw-stone",
      profileName: "JW Stone LLC",
      profileUrl: "https://jwstonelogistics.com/",
      assetOrigin: "https://jwstonelogistics.com/",
      contentBlocks: [],
      itemSlug: "trending-selection-05",
    });

    expect(metadata).toMatchObject({
      itemName: "",
      hasPublicName: false,
      itemSlug: "trending-selection-05",
      title: "Current stone selection | JW Stone LLC",
      canonical: "https://jwstonelogistics.com/inventory/trending-selection-05",
    });
    expect(metadata?.description).toContain("See this photo.");
    expect(metadata?.description).not.toContain("request current availability");
    expect(metadata?.imageAlt).toContain("JW Stone LLC inventory photo");
    expect(JSON.stringify(metadata)).not.toMatch(/Unnamed slab|Trending Selection 05/);
  });

  it("falls back to profile metadata when the requested item is not in that profile inventory", () => {
    expect(
      resolveProfileItemShareMetadata({
        profileSlug: "jw-stone",
        profileName: "JW Stone LLC",
        profileUrl: "https://jwstonelogistics.com/",
        assetOrigin: "https://jwstonelogistics.com/",
        contentBlocks: [],
        itemSlug: "not-a-real-stone",
      })
    ).toBeNull();
  });
});
