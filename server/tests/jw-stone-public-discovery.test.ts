import { describe, expect, it } from "vitest";
import { JW_STONE_PUBLIC_DISCOVERY_BLOCK } from "../../client/src/data/jwStoneProfilePresentation";
import {
  createProfileInventoryItemShareMetadata,
  listProfileInventoryItems,
  profileInventoryShareIndexForDisplay,
  resolveProfileInventoryItem,
} from "@shared/profileItemShare";
import {
  buildProfilePublicCategoryUrl,
  buildProfilePublicItemUrl,
} from "@shared/profilePublicItemRoute";
import {
  createProfileInventoryCategoryShareMetadata,
  listProfileInventoryCategories,
} from "@shared/profileCategoryShare";
import { inventoryCategoriesForProfile } from "../profileItemShareMetadata";
import { JW_STONE_CANONICAL_INVENTORY_SUMMARY } from "../jwStoneCanonicalInventory";
import { resolveAffiliateShareDestinationOrigin } from "../utils/affiliateShareDestination";

const origin = "https://jwstonelogistics.com";
const tradeScoutProfileUrl = "https://www.thetradescout.com/u/jw-stone";
const contentBlocks = [JW_STONE_PUBLIC_DISCOVERY_BLOCK];
const inventoryCategories = inventoryCategoriesForProfile("jw-stone", contentBlocks) as Array<{
  categorySlug: string;
  stones: Array<{
    slug: string;
    images: string[];
    shareImageOrder?: number[];
    nameStatus?: string;
  }>;
}>;
const normalizedItems = listProfileInventoryItems(inventoryCategories);
const shareOrderBySlug = new Map(
  inventoryCategories.flatMap((category) =>
    category.stones.map((stone) => [stone.slug, stone.shareImageOrder] as const)
  )
);

function mappedRequest() {
  return {
    headers: { host: "jwstonelogistics.com" },
    protocol: "https",
    mappedProfileDomainHost: "jwstonelogistics.com",
    mappedProfileDomainSlug: "jw-stone",
  } as any;
}

describe("JW Stone public discovery coverage", () => {
  it("gives all reconciled stones and photos stable owner-domain URLs", () => {
    expect(JW_STONE_CANONICAL_INVENTORY_SUMMARY.stoneCount).toBe(158);
    expect(JW_STONE_CANONICAL_INVENTORY_SUMMARY.imageCount).toBe(443);
    expect(normalizedItems).toHaveLength(158);
    expect(normalizedItems.reduce((total, stone) => total + stone.images.length, 0)).toBe(443);

    const anonymousItems = normalizedItems.filter((stone) => !stone.hasPublicName);
    expect(anonymousItems).toHaveLength(38);
    expect(anonymousItems.every((stone) => stone.name === "")).toBe(true);
    expect(anonymousItems.every((stone) => /^trending-selection-\d+$/.test(stone.slug))).toBe(true);

    let checkedPhotos = 0;
    for (const stone of normalizedItems) {
      expect(
        buildProfilePublicItemUrl({
          profileUrl: `${origin}/`,
          itemType: "inventory",
          itemSlug: stone.slug,
          contentBlocks,
        })
      ).toBe(`${origin}/stones/${stone.slug}`);
      expect(
        buildProfilePublicItemUrl({
          profileUrl: tradeScoutProfileUrl,
          itemType: "inventory",
          itemSlug: stone.slug,
          contentBlocks,
        })
      ).toBe(`${tradeScoutProfileUrl}/stones/${stone.slug}`);

      expect(
        resolveAffiliateShareDestinationOrigin(
          mappedRequest(),
          "https://www.thetradescout.com",
          `/stones/${stone.slug}`,
          contentBlocks
        )
      ).toBe(origin);

      const rawShareOrder = shareOrderBySlug.get(stone.slug);
      const shareOrder =
        Array.isArray(rawShareOrder) && rawShareOrder.length === stone.images.length
          ? rawShareOrder
          : stone.images.map((_, index) => index);

      for (let shareIndex = 0; shareIndex < stone.images.length; shareIndex += 1) {
        const oneBasedPhoto = shareIndex + 1;
        const expectedCanonical =
          shareIndex === 0
            ? `${origin}/stones/${stone.slug}`
            : `${origin}/stones/${stone.slug}?photo=${oneBasedPhoto}`;
        const expectedDisplayIndex = shareOrder[shareIndex];
        const expectedImage = new URL(stone.images[expectedDisplayIndex], origin).toString();
        const resolved = resolveProfileInventoryItem(
          inventoryCategories,
          stone.slug,
          String(oneBasedPhoto)
        );
        const metadata = createProfileInventoryItemShareMetadata({
          profileName: "JW Stone Logistics",
          profileUrl: `${origin}/`,
          assetOrigin: `${origin}/`,
          categories: inventoryCategories,
          itemSlug: stone.slug,
          photo: String(oneBasedPhoto),
          publicRouteContentBlocks: contentBlocks,
        });
        const tradeScoutMetadata = createProfileInventoryItemShareMetadata({
          profileName: "JW Stone Logistics",
          profileUrl: tradeScoutProfileUrl,
          assetOrigin: "https://www.thetradescout.com/",
          categories: inventoryCategories,
          itemSlug: stone.slug,
          photo: String(oneBasedPhoto),
          publicRouteContentBlocks: contentBlocks,
        });
        const expectedTradeScoutCanonical =
          shareIndex === 0
            ? `${tradeScoutProfileUrl}/stones/${stone.slug}`
            : `${tradeScoutProfileUrl}/stones/${stone.slug}?photo=${oneBasedPhoto}`;

        expect(resolved).toMatchObject({
          hasPublicName: !stone.slug.startsWith("trending-selection-"),
          slug: stone.slug,
          imageIndex: expectedDisplayIndex,
          shareImageIndex: shareIndex,
        });
        expect(metadata).toMatchObject({
          hasPublicName: !stone.slug.startsWith("trending-selection-"),
          itemSlug: stone.slug,
          imageIndex: expectedDisplayIndex,
          shareImageIndex: shareIndex,
          imageUrl: expectedImage,
          canonical: expectedCanonical,
        });
        expect(tradeScoutMetadata).toMatchObject({
          hasPublicName: !stone.slug.startsWith("trending-selection-"),
          itemSlug: stone.slug,
          imageIndex: expectedDisplayIndex,
          shareImageIndex: shareIndex,
          canonical: expectedTradeScoutCanonical,
        });
        expect(
          profileInventoryShareIndexForDisplay(stone.images, rawShareOrder, expectedDisplayIndex)
        ).toBe(shareIndex);
        checkedPhotos += 1;
      }
    }

    expect(checkedPhotos).toBe(443);
  });

  it("auto-populates the seven real JW material pages and excludes the placeholder group", () => {
    const categories = listProfileInventoryCategories(inventoryCategories, contentBlocks);
    expect(
      categories.map(({ slug, sourceSlug, itemCount }) => ({ slug, sourceSlug, itemCount }))
    ).toEqual([
      { slug: "granite", sourceSlug: "granite", itemCount: 26 },
      { slug: "marble", sourceSlug: "marble", itemCount: 27 },
      { slug: "quartzite", sourceSlug: "quartzite", itemCount: 25 },
      { slug: "engineered-quartz", sourceSlug: "quartz", itemCount: 9 },
      { slug: "onyx", sourceSlug: "onyx", itemCount: 1 },
      { slug: "soapstone", sourceSlug: "soapstone", itemCount: 2 },
      { slug: "basalt", sourceSlug: "basalt", itemCount: 1 },
    ]);
    expect(categories.some((category) => category.sourceSlug === "unconfirmed")).toBe(false);

    for (const category of categories) {
      const canonical = `${origin}/materials/${category.slug}`;
      expect(
        buildProfilePublicCategoryUrl({
          profileUrl: `${origin}/`,
          categorySlug: category.slug,
          contentBlocks,
        })
      ).toBe(canonical);
      expect(
        buildProfilePublicCategoryUrl({
          profileUrl: "https://www.thetradescout.com/u/jw-stone",
          categorySlug: category.slug,
          contentBlocks,
        })
      ).toBe(`https://www.thetradescout.com/u/jw-stone/materials/${category.slug}`);
      expect(
        createProfileInventoryCategoryShareMetadata({
          profileName: "JW Stone Logistics",
          profileUrl: `${origin}/`,
          assetOrigin: `${origin}/`,
          categories: inventoryCategories,
          categorySlug: category.slug,
          publicRouteContentBlocks: contentBlocks,
        })
      ).toMatchObject({
        categorySlug: category.slug,
        sourceCategorySlug: category.sourceSlug,
        itemCount: category.itemCount,
        indexable: true,
        canonical,
      });
    }
  });

  it("uses the same auto-population contract for an unrelated public profile", () => {
    const genericCategories = [
      {
        category: "Widgets",
        categorySlug: "widgets",
        stones: [
          {
            name: "Blue Widget",
            slug: "blue-widget",
            images: ["/uploads/blue-widget.webp"],
          },
        ],
      },
    ];
    const categories = listProfileInventoryCategories(genericCategories, []);

    expect(categories).toMatchObject([
      {
        name: "Widgets",
        slug: "widgets",
        sourceSlug: "widgets",
        itemCount: 1,
        itemSlugs: ["blue-widget"],
        indexable: true,
      },
    ]);
    expect(
      buildProfilePublicCategoryUrl({
        profileUrl: "https://example-supplier.com/",
        categorySlug: categories[0].slug,
      })
    ).toBe("https://example-supplier.com/categories/widgets");
    expect(
      buildProfilePublicCategoryUrl({
        profileUrl: "https://www.thetradescout.com/u/example-supplier",
        categorySlug: categories[0].slug,
      })
    ).toBe("https://www.thetradescout.com/u/example-supplier/categories/widgets");
  });
});
