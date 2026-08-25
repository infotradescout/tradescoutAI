import { describe, expect, it } from "vitest";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";
import {
  resolvePublicProfileCategoryRequest,
  resolvePublicProfileItemRequest,
} from "../publicProfileItemRouting";

const profileBasePath = "/u/future-profile";
const defaultBlocks = [
  {
    type: "inventoryCatalog",
    data: {
      categories: [
        {
          category: "Stone",
          categorySlug: "stone",
          stones: [
            {
              name: "Named Stone",
              slug: "named-stone",
              images: ["/images/named-stone.jpg"],
            },
            {
              name: "Internal placeholder",
              nameStatus: "placeholder",
              slug: "trending-selection-04",
              images: ["/images/trending-selection-04.jpg"],
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
        "/images/generic-gallery-photo.jpg",
        {
          imageUrl: "/images/completed-stone-installation.jpg",
          title: "Completed stone installation",
          description:
            "A source-backed completed project record published by the public profile owner.",
        },
      ],
    },
  },
] as const;

function itemPath(collection: string, itemSlug: string) {
  return `${profileBasePath}/${collection}/${itemSlug}`;
}

describe("public profile child route publication parity", () => {
  it("serves only the same fact-bearing records that automatic discovery publishes", () => {
    const gallery = listProfileGalleryItems(defaultBlocks);
    const genericGallery = gallery[0];
    const completedProject = gallery[1];
    expect(genericGallery).toBeTruthy();
    expect(completedProject).toBeTruthy();

    expect(
      resolvePublicProfileItemRequest({
        profile: { slug: "future-profile", contentBlocks: defaultBlocks },
        pathname: itemPath("inventory", "named-stone"),
        profileBasePath,
      })
    ).toMatchObject({ kind: "item", itemSlug: "named-stone" });

    expect(
      resolvePublicProfileItemRequest({
        profile: { slug: "future-profile", contentBlocks: defaultBlocks },
        pathname: itemPath("inventory", "trending-selection-04"),
        profileBasePath,
      })
    ).toEqual({ kind: "invalid-item-route" });

    expect(
      resolvePublicProfileItemRequest({
        profile: { slug: "future-profile", contentBlocks: defaultBlocks },
        pathname: itemPath("gallery", genericGallery.slug),
        profileBasePath,
      })
    ).toEqual({ kind: "invalid-item-route" });

    expect(
      resolvePublicProfileItemRequest({
        profile: { slug: "future-profile", contentBlocks: defaultBlocks },
        pathname: itemPath("gallery", completedProject.slug),
        profileBasePath,
      })
    ).toMatchObject({ kind: "item", itemSlug: completedProject.slug });

    expect(
      resolvePublicProfileCategoryRequest({
        profile: { slug: "future-profile", contentBlocks: defaultBlocks },
        pathname: `${profileBasePath}/categories/stone`,
        profileBasePath,
      })
    ).toMatchObject({ kind: "category", categorySlug: "stone" });

    const urls = buildOptInProfileSitemapUrls({
      profileSlug: "future-profile",
      profileUrl: "https://www.thetradescout.com/u/future-profile",
      contentBlocks: defaultBlocks,
    });
    expect(urls).toHaveLength(3);
    expect(urls).toContain("https://www.thetradescout.com/u/future-profile/categories/stone");
    expect(urls).toContain(
      "https://www.thetradescout.com/u/future-profile/inventory/named-stone"
    );
    expect(urls.some((url) => url.endsWith(`/gallery/${completedProject.slug}`))).toBe(true);
    expect(urls.join("\n")).not.toContain("trending-selection-04");
    expect(urls.join("\n")).not.toContain(genericGallery.slug);
  });

  it("returns an invalid category route when every child is an unpublished placeholder", () => {
    const placeholderOnlyBlocks = [
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
                  images: ["/images/trending-selection-04.jpg"],
                },
              ],
            },
          ],
        },
      },
    ] as const;

    expect(
      resolvePublicProfileCategoryRequest({
        profile: { slug: "future-profile", contentBlocks: placeholderOnlyBlocks },
        pathname: `${profileBasePath}/categories/stone`,
        profileBasePath,
      })
    ).toEqual({ kind: "invalid-category-route" });

    expect(
      buildOptInProfileSitemapUrls({
        profileSlug: "future-profile",
        profileUrl: "https://www.thetradescout.com/u/future-profile",
        contentBlocks: placeholderOnlyBlocks,
      })
    ).toEqual([]);
  });

  it("honors explicit publication of otherwise-valid generic records", () => {
    const explicitBlocks = [
      ...defaultBlocks,
      {
        type: "publicDiscovery",
        data: {
          sitemap: { inventory: true, gallery: true },
        },
      },
    ] as const;
    const genericGallery = listProfileGalleryItems(explicitBlocks)[0];

    expect(
      resolvePublicProfileItemRequest({
        profile: { slug: "future-profile", contentBlocks: explicitBlocks },
        pathname: itemPath("inventory", "trending-selection-04"),
        profileBasePath,
      })
    ).toMatchObject({ kind: "item", itemSlug: "trending-selection-04" });

    expect(
      resolvePublicProfileItemRequest({
        profile: { slug: "future-profile", contentBlocks: explicitBlocks },
        pathname: itemPath("gallery", genericGallery.slug),
        profileBasePath,
      })
    ).toMatchObject({ kind: "item", itemSlug: genericGallery.slug });
  });

  it("lets a named deliberate route remain while sitemap enrollment is disabled", () => {
    const noSitemapBlocks = [
      ...defaultBlocks,
      {
        type: "publicDiscovery",
        data: {
          sitemap: { inventory: false, categories: false, gallery: false },
        },
      },
    ] as const;

    expect(
      resolvePublicProfileItemRequest({
        profile: { slug: "future-profile", contentBlocks: noSitemapBlocks },
        pathname: itemPath("inventory", "named-stone"),
        profileBasePath,
      })
    ).toMatchObject({ kind: "item", itemSlug: "named-stone" });

    expect(
      buildOptInProfileSitemapUrls({
        profileSlug: "future-profile",
        profileUrl: "https://www.thetradescout.com/u/future-profile",
        contentBlocks: noSitemapBlocks,
      })
    ).toEqual([]);
  });
});
