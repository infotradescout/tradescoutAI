import { describe, expect, it } from "vitest";
import {
  buildProfileGalleryShareSearch,
  createProfileGalleryItemShareMetadata,
  listProfileGalleryItems,
  resolveProfileGalleryItem,
} from "@shared/profileGalleryShare";

const contentBlocks = [
  {
    id: "recent-work",
    type: "gallery",
    data: {
      title: "Recent Work",
      description: "Selected project work completed for local homeowners.",
      images: [
        {
          id: "blue-stone-patio",
          url: "/uploads/profiles/blue-stone-patio.jpg",
          title: "Blue Stone Patio",
          caption: "A finished patio installation with natural blue stone.",
          alt: "Finished blue stone patio",
        },
        "https://images.example.com/custom-kitchen.webp",
        "javascript:alert(1)",
      ],
    },
  },
];

describe("profile gallery item sharing metadata", () => {
  it("creates stable, individually addressable gallery items", () => {
    const firstPass = listProfileGalleryItems(contentBlocks);
    const secondPass = listProfileGalleryItems(contentBlocks);

    expect(firstPass).toHaveLength(2);
    expect(secondPass.map((item) => item.slug)).toEqual(firstPass.map((item) => item.slug));
    expect(firstPass[0]).toMatchObject({
      itemType: "gallery",
      title: "Blue Stone Patio",
      hasPublicTitle: true,
      description: "A finished patio installation with natural blue stone.",
      imageUrl: "/uploads/profiles/blue-stone-patio.jpg",
      imageAlt: "Finished blue stone patio",
      blockIndex: 0,
      imageIndex: 0,
    });
    expect(firstPass[0].slug).toMatch(/^blue-stone-patio-[a-z0-9]{7}$/);
    expect(firstPass[1].title).toBe("Recent Work photo 2");
    expect(firstPass[1].hasPublicTitle).toBe(false);
    expect(resolveProfileGalleryItem(contentBlocks, firstPass[0].slug)).toEqual(firstPass[0]);
  });

  it("keeps duplicate gallery positions individually shareable", () => {
    const duplicateItems = listProfileGalleryItems([
      {
        type: "gallery",
        data: { images: ["/uploads/profiles/repeated.jpg", "/uploads/profiles/repeated.jpg"] },
      },
    ]);

    expect(duplicateItems).toHaveLength(2);
    expect(duplicateItems[0].slug).not.toBe(duplicateItems[1].slug);
  });

  it("uses the exact gallery image and query in social metadata", () => {
    const item = listProfileGalleryItems(contentBlocks)[0];
    const metadata = createProfileGalleryItemShareMetadata({
      profileName: "River City Masonry",
      profileUrl: "https://www.thetradescout.com/u/river-city-masonry",
      assetOrigin: "https://www.thetradescout.com",
      contentBlocks,
      itemSlug: item.slug,
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        itemType: "gallery",
        itemTitle: "Blue Stone Patio",
        itemSlug: item.slug,
        title: "Blue Stone Patio | River City Masonry",
        imageUrl: "https://www.thetradescout.com/uploads/profiles/blue-stone-patio.jpg",
        imageAlt: "Finished blue stone patio",
        canonical: `https://www.thetradescout.com/u/river-city-masonry/gallery/${item.slug}`,
      })
    );
    expect(metadata?.description).toContain("View Blue Stone Patio from River City Masonry.");
    expect(metadata?.description).not.toContain("contact details");
    expect(metadata?.description.length).toBeLessThanOrEqual(160);
    expect(buildProfileGalleryShareSearch(item.slug)).toBe(`?gallery=${item.slug}`);
  });

  it("keeps long factual descriptions inside the social description limit", () => {
    const longBlocks = [
      {
        type: "gallery",
        data: {
          images: [
            {
              url: "/uploads/profiles/long-title.jpg",
              title: "Detailed project title ".repeat(20),
              description: "Long project description ".repeat(20),
            },
          ],
        },
      },
    ];
    const item = listProfileGalleryItems(longBlocks)[0];
    const metadata = createProfileGalleryItemShareMetadata({
      profileName: "Long Business Name ".repeat(10),
      profileUrl: "https://www.thetradescout.com/u/long-business",
      assetOrigin: "https://www.thetradescout.com",
      contentBlocks: longBlocks,
      itemSlug: item.slug,
    });

    expect(metadata?.description.length).toBeLessThanOrEqual(160);
    expect(metadata?.description).not.toContain("contact details");
  });

  it("preserves custom-domain roots and rejects unsafe or unknown item selectors", () => {
    const item = listProfileGalleryItems(contentBlocks)[1];
    const metadata = createProfileGalleryItemShareMetadata({
      profileName: "River City Masonry",
      profileUrl: "https://rivercity.example/",
      assetOrigin: "https://rivercity.example",
      contentBlocks,
      itemSlug: item.slug,
    });

    expect(metadata?.canonical).toBe(`https://rivercity.example/gallery/${item.slug}`);
    expect(
      createProfileGalleryItemShareMetadata({
        profileName: "River City Masonry",
        profileUrl: "https://rivercity.example/",
        assetOrigin: "https://rivercity.example",
        contentBlocks,
        itemSlug: "unknown-item",
      })
    ).toBeNull();
    expect(resolveProfileGalleryItem(contentBlocks, "../unsafe")).toBeNull();
    expect(buildProfileGalleryShareSearch("../unsafe")).toBe("");
  });
});
