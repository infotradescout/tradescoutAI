import { describe, expect, it } from "vitest";
import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";

const futureProfileBlocks = [
  {
    type: "inventoryCatalog",
    data: {
      categories: [
        {
          category: "Roofing",
          categorySlug: "roofing",
          stones: [
            {
              name: "Standing Seam Roof Package",
              slug: "standing-seam-roof-package",
              images: ["/images/future/standing-seam-roof.jpg"],
              publicKind: "offering",
              publicSummary:
                "A source-backed standing-seam roof package published by the profile owner.",
            },
          ],
        },
      ],
    },
  },
  {
    type: "gallery",
    data: {
      title: "Completed work",
      description: "Work records published by the profile owner.",
      images: [
        {
          id: "completed-standing-seam-roof",
          imageUrl: "/images/future/completed-standing-seam-roof.jpg",
          title: "Completed standing-seam roof",
          description: "A completed roof record published on the public profile.",
        },
      ],
    },
  },
] as const;

describe("automatic public profile child discovery", () => {
  it("enrolls valid inventory, category, and gallery pages without a per-profile flag", () => {
    const urls = buildOptInProfileSitemapUrls({
      profileSlug: "future-public-profile",
      profileUrl: "https://www.thetradescout.com/u/future-public-profile",
      contentBlocks: futureProfileBlocks,
    });

    expect(urls).toHaveLength(3);
    expect(urls).toContain(
      "https://www.thetradescout.com/u/future-public-profile/categories/roofing"
    );
    expect(urls).toContain(
      "https://www.thetradescout.com/u/future-public-profile/inventory/standing-seam-roof-package"
    );
    expect(
      urls.some((url) =>
        url.includes("/u/future-public-profile/gallery/completed-standing-seam-roof-")
      )
    ).toBe(true);
  });

  it("does not create child pages from empty or malformed records", () => {
    expect(
      buildOptInProfileSitemapUrls({
        profileSlug: "empty-future-profile",
        profileUrl: "https://www.thetradescout.com/u/empty-future-profile",
        contentBlocks: [
          { type: "inventoryCatalog", data: { categories: [] } },
          { type: "gallery", data: { images: [{ title: "Missing image" }] } },
        ],
      })
    ).toEqual([]);
  });

  it("keeps unnamed inventory and generic gallery photos out of automatic indexing", () => {
    const urls = buildOptInProfileSitemapUrls({
      profileSlug: "thin-future-profile",
      profileUrl: "https://www.thetradescout.com/u/thin-future-profile",
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
                    slug: "unnamed-stone",
                    images: ["/images/future/unnamed-stone.jpg"],
                  },
                ],
              },
            ],
          },
        },
        {
          type: "gallery",
          data: {
            images: ["/images/future/generic-gallery-photo.jpg"],
          },
        },
      ],
    });

    expect(urls).toEqual([
      "https://www.thetradescout.com/u/thin-future-profile/categories/stone",
    ]);
  });

  it("allows an explicit profile decision to publish otherwise-valid generic records", () => {
    const urls = buildOptInProfileSitemapUrls({
      profileSlug: "explicit-future-profile",
      profileUrl: "https://www.thetradescout.com/u/explicit-future-profile",
      contentBlocks: [
        {
          type: "gallery",
          data: {
            images: ["/images/future/generic-gallery-photo.jpg"],
          },
        },
        {
          type: "publicDiscovery",
          data: {
            sitemap: { gallery: true },
          },
        },
      ],
    });

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/u/explicit-future-profile/gallery/gallery-photo-1-");
  });
});
