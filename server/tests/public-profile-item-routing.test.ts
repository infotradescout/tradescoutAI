import { describe, expect, it } from "vitest";
import { listProfileInventoryItems } from "@shared/profileItemShare";
import { inventoryCategoriesForProfile } from "../profileItemShareMetadata";
import {
  resolvePublicProfileCategoryRequest,
  resolvePublicProfileItemRequest,
} from "../publicProfileItemRouting";

const jwContentBlocks = [
  {
    type: "publicDiscovery",
    data: {
      routes: {
        inventory: "stones",
        categories: "materials",
      },
      categories: [
        {
          sourceSlug: "quartz",
          publicSlug: "engineered-quartz",
          title: "Engineered Quartz",
        },
      ],
    },
  },
];

describe("public Profile item request routing", () => {
  it("resolves every named JW inventory item on the JW-owned route", () => {
    const items = listProfileInventoryItems(
      inventoryCategoriesForProfile("jw-stone", jwContentBlocks)
    );
    const namedItems = items.filter((item) => item.hasPublicName);
    const anonymousItems = items.filter((item) => !item.hasPublicName);

    expect(items).toHaveLength(158);
    expect(namedItems).toHaveLength(120);
    expect(anonymousItems).toHaveLength(38);

    const canonicalPaths = new Set<string>();
    for (const item of namedItems) {
      const resolved = resolvePublicProfileItemRequest({
        profile: { slug: "jw-stone", contentBlocks: jwContentBlocks },
        pathname: `/stones/${item.slug}`,
        profileBasePath: "/",
      });
      expect(resolved).toMatchObject({
        kind: "item",
        source: "path",
        itemType: "inventory",
        itemSlug: item.slug,
        canonicalPath: `/stones/${item.slug}`,
      });
      if (resolved.kind === "item") canonicalPaths.add(resolved.canonicalPath);
    }

    expect(canonicalPaths.size).toBe(namedItems.length);
    expect([...canonicalPaths].some((path) => path.startsWith("/u/"))).toBe(false);

    for (const item of anonymousItems) {
      expect(
        resolvePublicProfileItemRequest({
          profile: { slug: "jw-stone", contentBlocks: jwContentBlocks },
          pathname: `/stones/${item.slug}`,
          profileBasePath: "/",
        })
      ).toEqual({ kind: "invalid-item-route" });
    }
  });

  it("canonicalizes every named legacy JW selector to the same owner-domain path", () => {
    const items = listProfileInventoryItems(
      inventoryCategoriesForProfile("jw-stone", jwContentBlocks)
    ).filter((item) => item.hasPublicName);
    for (const item of items) {
      expect(
        resolvePublicProfileItemRequest({
          profile: { slug: "jw-stone", contentBlocks: jwContentBlocks },
          pathname: "/",
          profileBasePath: "/",
          stone: item.slug,
        })
      ).toMatchObject({
        kind: "item",
        source: "legacy-query",
        itemSlug: item.slug,
        canonicalPath: `/stones/${item.slug}`,
      });
    }
  });

  it("keeps identical item slugs scoped to their owning profiles", () => {
    const contentBlocks = [
      {
        type: "inventoryCatalog",
        data: {
          categories: [
            {
              category: "Products",
              stones: [
                {
                  name: "Shared Name",
                  slug: "shared-name",
                  images: ["/uploads/shared.jpg"],
                },
              ],
            },
          ],
        },
      },
    ];

    for (const slug of ["supplier-a", "supplier-b"]) {
      expect(
        resolvePublicProfileItemRequest({
          profile: { slug, contentBlocks },
          pathname: `/u/${slug}/inventory/shared-name`,
          profileBasePath: `/u/${slug}`,
        })
      ).toMatchObject({
        kind: "item",
        itemSlug: "shared-name",
        canonicalPath: `/u/${slug}/inventory/shared-name`,
      });
    }
  });

  it("fails closed for unknown items and non-profile routes", () => {
    expect(
      resolvePublicProfileItemRequest({
        profile: { slug: "jw-stone", contentBlocks: jwContentBlocks },
        pathname: "/stones/not-a-real-jw-item",
        profileBasePath: "/",
      })
    ).toEqual({ kind: "invalid-item-route" });
    expect(
      resolvePublicProfileItemRequest({
        profile: { slug: "jw-stone", contentBlocks: jwContentBlocks },
        pathname: "/services/offer-1",
        profileBasePath: "/",
      })
    ).toEqual({ kind: "none" });
  });
});

describe("public profile category request routing", () => {
  it("resolves JW clean and legacy category destinations and rejects unknown categories", () => {
    expect(
      resolvePublicProfileCategoryRequest({
        profile: { slug: "jw-stone", contentBlocks: jwContentBlocks },
        pathname: "/materials/granite",
        profileBasePath: "/",
      })
    ).toMatchObject({
      kind: "category",
      source: "path",
      categorySlug: "granite",
      canonicalPath: "/materials/granite",
      category: {
        name: "Granite",
        slug: "granite",
        sourceSlug: "granite",
      },
    });

    expect(
      resolvePublicProfileCategoryRequest({
        profile: { slug: "jw-stone", contentBlocks: jwContentBlocks },
        pathname: "/",
        profileBasePath: "/",
        category: "engineered-quartz",
      })
    ).toMatchObject({
      kind: "category",
      source: "legacy-query",
      categorySlug: "engineered-quartz",
      canonicalPath: "/materials/engineered-quartz",
      category: {
        name: "Engineered Quartz",
        slug: "engineered-quartz",
        sourceSlug: "quartz",
      },
    });

    expect(
      resolvePublicProfileCategoryRequest({
        profile: { slug: "jw-stone", contentBlocks: jwContentBlocks },
        pathname: "/materials/not-a-real-category",
        profileBasePath: "/",
      })
    ).toEqual({ kind: "invalid-category-route" });
  });

  it("uses the generic /categories route when a profile has no route override", () => {
    const genericContentBlocks = [
      {
        type: "inventoryCatalog",
        data: {
          categories: [
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
          ],
        },
      },
    ];

    expect(
      resolvePublicProfileCategoryRequest({
        profile: {
          slug: "example-supplier",
          contentBlocks: genericContentBlocks,
        },
        pathname: "/u/example-supplier/categories/widgets",
        profileBasePath: "/u/example-supplier",
      })
    ).toMatchObject({
      kind: "category",
      source: "path",
      categorySlug: "widgets",
      canonicalPath: "/u/example-supplier/categories/widgets",
      category: {
        name: "Widgets",
        slug: "widgets",
        sourceSlug: "widgets",
      },
    });
  });
});
