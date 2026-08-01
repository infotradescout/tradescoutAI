import { describe, expect, it } from "vitest";
import generatedJwStoneInventory from "../../client/src/data/jwStoneInventory.generated.json";
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
import { resolveAffiliateShareDestinationOrigin } from "../utils/affiliateShareDestination";

type RawStone = {
  name: string;
  slug: string;
  categorySlug: string;
  images: string[];
  shareImageOrder?: number[];
};

const origin = "https://jwstonelogistics.com";
const tradeScoutProfileUrl = "https://www.thetradescout.com/u/jw-stone";
const contentBlocks = [JW_STONE_PUBLIC_DISCOVERY_BLOCK];
const rawStones = generatedJwStoneInventory as RawStone[];
const inventoryCategories = inventoryCategoriesForProfile("jw-stone", contentBlocks);

function mappedRequest() {
  return {
    headers: { host: "jwstonelogistics.com" },
    protocol: "https",
    mappedProfileDomainHost: "jwstonelogistics.com",
    mappedProfileDomainSlug: "jw-stone",
  } as any;
}

describe("JW Stone public discovery coverage", () => {
  it("gives all 119 published stones and all 433 photos stable owner-domain URLs", () => {
    const normalizedItems = listProfileInventoryItems(inventoryCategories);
    const rawSlugs = new Set(rawStones.map((stone) => stone.slug));
    const normalizedSlugs = new Set(normalizedItems.map((stone) => stone.slug));

    expect(rawStones).toHaveLength(119);
    expect(normalizedItems).toHaveLength(119);
    expect(normalizedSlugs).toEqual(rawSlugs);
    expect(rawStones.reduce((total, stone) => total + stone.images.length, 0)).toBe(433);

    const anonymousItems = normalizedItems.filter((stone) => !stone.hasPublicName);
    expect(anonymousItems.map((stone) => stone.slug)).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `trending-selection-${String(index + 1).padStart(2, "0")}`
      )
    );
    expect(anonymousItems.every((stone) => stone.name === "")).toBe(true);
    expect(anonymousItems.reduce((total, stone) => total + stone.images.length, 0)).toBe(73);

    let checkedPhotos = 0;
    for (const stone of rawStones) {
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

      const shareOrder =
        Array.isArray(stone.shareImageOrder) && stone.shareImageOrder.length === stone.images.length
          ? stone.shareImageOrder
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
          profileInventoryShareIndexForDisplay(
            stone.images,
            stone.shareImageOrder,
            expectedDisplayIndex
          )
        ).toBe(shareIndex);
        checkedPhotos += 1;
      }
    }

    expect(checkedPhotos).toBe(433);
  });

  it("auto-populates the seven real JW material pages and excludes the placeholder group", () => {
    const categories = listProfileInventoryCategories(inventoryCategories, contentBlocks);
    expect(
      categories.map(({ slug, sourceSlug, itemCount }) => ({ slug, sourceSlug, itemCount }))
    ).toEqual([
      { slug: "granite", sourceSlug: "granite", itemCount: 23 },
      { slug: "marble", sourceSlug: "marble", itemCount: 23 },
      { slug: "quartzite", sourceSlug: "quartzite", itemCount: 21 },
      { slug: "engineered-quartz", sourceSlug: "quartz", itemCount: 6 },
      { slug: "onyx", sourceSlug: "onyx", itemCount: 1 },
      { slug: "soapstone", sourceSlug: "soapstone", itemCount: 1 },
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
