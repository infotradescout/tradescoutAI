import { describe, expect, it } from "vitest";
import {
  buildProfileInventoryShareSearch,
  createProfileInventoryItemShareMetadata,
  normalizeProfileInventoryItemSlug,
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
      canonical: "https://example.com/?stone=sample-stone&photo=2",
    });
    expect(metadata?.description).toContain("protected TradeScout Direct Connect");
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
      canonical: "https://example.com/u/honey-onyx?stone=honey-onyx",
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
      contentBlocks: [],
      itemSlug: "amazonic-green",
    });

    expect(metadata).toMatchObject({
      itemName: "Amazonic Green",
      itemSlug: "amazonic-green",
      imageIndex: 0,
      canonical: "https://jwstonelogistics.com/?stone=amazonic-green",
    });
    expect(metadata?.imageUrl).toMatch(
      /^https:\/\/jwstonelogistics\.com\/images\/businesses\/jw-stone\/inventory-source\/.+\.webp$/
    );
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
