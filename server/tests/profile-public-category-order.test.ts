import { describe, expect, it } from "vitest";
import { listProfileInventoryCategories } from "@shared/profileCategoryShare";

const stone = (slug: string) => ({
  name: slug,
  slug,
  images: [`/uploads/${slug}.jpg`],
});

describe("public profile category order", () => {
  it("puts explicitly configured categories first in profile-owned order", () => {
    const categories = [
      {
        category: "Alpha",
        categorySlug: "alpha",
        stones: [stone("alpha-item")],
      },
      {
        category: "Gamma",
        categorySlug: "gamma",
        stones: [stone("gamma-item")],
      },
      {
        category: "Beta",
        categorySlug: "beta",
        stones: [stone("beta-item")],
      },
      {
        category: "Delta",
        categorySlug: "delta",
        stones: [stone("delta-item")],
      },
    ];
    const contentBlocks = [
      {
        type: "publicDiscovery",
        data: {
          categories: [
            { sourceSlug: "beta", publicSlug: "second" },
            { sourceSlug: "alpha", publicSlug: "first" },
          ],
        },
      },
    ];

    expect(
      listProfileInventoryCategories(categories, contentBlocks).map((category) => ({
        slug: category.slug,
        sourceSlug: category.sourceSlug,
      }))
    ).toEqual([
      { slug: "second", sourceSlug: "beta" },
      { slug: "first", sourceSlug: "alpha" },
      { slug: "gamma", sourceSlug: "gamma" },
      { slug: "delta", sourceSlug: "delta" },
    ]);
  });
});
