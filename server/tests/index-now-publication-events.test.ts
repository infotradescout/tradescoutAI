import { describe, expect, it } from "vitest";
import {
  collectBusinessIndexNowUrls,
  collectProfileIndexNowUrls,
  collectProfileServiceOfferIndexNowUrls,
  combineIndexNowChangeUrls,
} from "../services/indexNowPublicationEvents";

const inventoryBlock = {
  type: "inventoryCatalog",
  data: {
    categories: [
      {
        category: "Granite",
        categorySlug: "granite",
        stones: [
          {
            name: "Blue Pearl",
            slug: "blue-pearl",
            images: ["/uploads/blue-pearl.webp"],
          },
        ],
      },
    ],
  },
};

describe("IndexNow public operating-system publication events", () => {
  it("publishes only eligible profiles and the same automatic child routes as the sitemap", () => {
    const profile = {
      slug: "stone-and-tile",
      status: "published",
      contentBlocks: [inventoryBlock],
      privatePhone: "850-555-0100",
      rankingTier: "paid",
    };

    expect(collectProfileIndexNowUrls(profile, true)).toEqual([
      "/u/stone-and-tile",
      "/u/stone-and-tile/categories/granite",
      "/u/stone-and-tile/inventory/blue-pearl",
    ]);
    expect(collectProfileIndexNowUrls({ ...profile, status: "draft" }, true)).toEqual([]);
    expect(collectProfileIndexNowUrls(profile, false)).toEqual([]);
    expect(
      collectProfileIndexNowUrls(
        { ...profile, seoMeta: { customDomain: "www.stone-and-tile.example" } },
        true
      )
    ).toEqual([]);
  });

  it("includes both old and new URLs for updates, unpublishes, and deletions", () => {
    expect(
      combineIndexNowChangeUrls(
        ["/u/old-slug", "/u/old-slug/inventory/retired-item"],
        ["/u/new-slug"]
      )
    ).toEqual(["/u/old-slug", "/u/old-slug/inventory/retired-item", "/u/new-slug"]);
  });

  it("uses configured route and category names without requiring a separate IndexNow rule", () => {
    const profile = {
      slug: "stone-and-tile",
      status: "published",
      contentBlocks: [
        {
          type: "publicDiscovery",
          data: {
            routes: {
              inventory: "materials",
              categories: "collections",
            },
            categories: [
              {
                sourceSlug: "granite",
                publicSlug: "natural-granite",
                title: "Natural Granite",
                summary: "Explore named natural granite materials published by Stone and Tile.",
                indexable: true,
              },
            ],
          },
        },
        inventoryBlock,
      ],
    };

    expect(collectProfileIndexNowUrls(profile, true)).toEqual([
      "/u/stone-and-tile",
      "/u/stone-and-tile/collections/natural-granite",
      "/u/stone-and-tile/materials/blue-pearl",
    ]);
  });

  it("notifies fact-bearing project pages and excludes generic or placeholder child records", () => {
    const profile = {
      slug: "source-backed-profile",
      status: "published",
      contentBlocks: [
        {
          type: "inventoryCatalog",
          data: {
            categories: [
              {
                category: "Stone",
                categorySlug: "stone",
                stones: [
                  {
                    name: "Internal placeholder",
                    nameStatus: "placeholder",
                    slug: "trending-selection-04",
                    images: ["/uploads/trending-selection-04.webp"],
                  },
                ],
              },
            ],
          },
        },
        {
          type: "gallery",
          data: {
            images: [
              "/uploads/generic-gallery-photo.webp",
              {
                imageUrl: "/uploads/completed-installation.webp",
                title: "Completed stone installation",
                description:
                  "A source-backed completed installation published by the profile owner.",
              },
            ],
          },
        },
      ],
    };

    const urls = collectProfileIndexNowUrls(profile, true);
    expect(urls[0]).toBe("/u/source-backed-profile");
    expect(urls).toHaveLength(2);
    expect(
      urls.some((url) =>
        url.includes("/u/source-backed-profile/gallery/completed-stone-installation-")
      )
    ).toBe(true);
    expect(urls.join("\n")).not.toContain("trending-selection-04");
    expect(urls.join("\n")).not.toContain("gallery-photo-1");
    expect(urls.join("\n")).not.toContain("/categories/stone");
  });

  it("keeps the profile root but honors explicit child sitemap opt-outs", () => {
    const profile = {
      slug: "stone-and-tile",
      status: "published",
      contentBlocks: [
        inventoryBlock,
        {
          type: "publicDiscovery",
          data: {
            sitemap: {
              inventory: false,
              categories: false,
              gallery: false,
            },
          },
        },
      ],
    };

    expect(collectProfileIndexNowUrls(profile, true)).toEqual(["/u/stone-and-tile"]);
  });

  it("publishes only public, authority-eligible business pages", () => {
    expect(
      collectBusinessIndexNowUrls({ slug: "local-electric", visibility: "public" }, true)
    ).toEqual(["/business/local-electric"]);
    expect(
      collectBusinessIndexNowUrls({ slug: "local-electric", visibility: "private" }, true)
    ).toEqual([]);
    expect(
      collectBusinessIndexNowUrls({ slug: "local-electric", visibility: "public" }, false)
    ).toEqual([]);
  });

  it("publishes active service offers only when exposure authority allows awareness", () => {
    const service = { id: "svc-123", offer_type: "service", is_active: true };
    expect(collectProfileServiceOfferIndexNowUrls(service, true)).toEqual(["/services/svc-123"]);
    expect(collectProfileServiceOfferIndexNowUrls(service, false)).toEqual([]);
    expect(collectProfileServiceOfferIndexNowUrls({ ...service, is_active: false }, true)).toEqual(
      []
    );
    expect(
      collectProfileServiceOfferIndexNowUrls(
        { id: "item-123", offer_type: "item", is_active: true },
        true
      )
    ).toEqual([]);
  });
});
