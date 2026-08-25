import { describe, expect, it } from "vitest";
import { listProfileDiscoveryNavigationLinks } from "../profileDiscoveryNavigation";

const blocks = [
  {
    type: "inventoryCatalog",
    data: {
      categories: [
        {
          category: "Quartzite",
          categorySlug: "quartzite",
          stones: [
            {
              name: "Taj Mahal",
              slug: "taj-mahal",
              images: ["/images/taj-mahal.jpg"],
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
      description: "Source-backed completed work published by the profile.",
      images: [
        {
          imageUrl: "/images/completed-kitchen.jpg",
          title: "Completed quartzite kitchen",
          description: "A completed quartzite kitchen published by the profile owner.",
        },
      ],
    },
  },
] as const;

describe("profile discovery navigation", () => {
  it("returns the exact category, inventory, and project links used by discovery", () => {
    const links = listProfileDiscoveryNavigationLinks({
      profileSlug: "future-profile",
      profileUrl: "https://www.thetradescout.com/u/future-profile",
      contentBlocks: blocks,
    });

    expect(links.map((link) => link.kind)).toEqual(["category", "inventory", "gallery"]);
    expect(links[0]?.url).toBe(
      "https://www.thetradescout.com/u/future-profile/categories/quartzite"
    );
    expect(links[1]?.url).toBe(
      "https://www.thetradescout.com/u/future-profile/inventory/taj-mahal"
    );
    expect(links[2]?.url).toContain(
      "/u/future-profile/gallery/completed-quartzite-kitchen-"
    );
  });

  it("honors explicit opt-outs", () => {
    const links = listProfileDiscoveryNavigationLinks({
      profileSlug: "future-profile",
      profileUrl: "https://www.thetradescout.com/u/future-profile",
      contentBlocks: [
        ...blocks,
        {
          type: "publicDiscovery",
          data: { sitemap: { inventory: false, gallery: false } },
        },
      ],
    });

    expect(links.map((link) => link.kind)).toEqual(["category"]);
  });
});
