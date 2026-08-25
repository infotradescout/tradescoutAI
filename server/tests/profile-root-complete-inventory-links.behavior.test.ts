import { describe, expect, it, vi } from "vitest";

const inventoryItems = Array.from({ length: 14 }, (_, index) => ({
  name: `Published Item ${index + 1}`,
  slug: `published-item-${index + 1}`,
  images: [`/images/future/published-item-${index + 1}.jpg`],
}));

const profileRecord = {
  id: "profile-complete-inventory",
  slug: "complete-inventory-profile",
  displayName: "Complete Inventory Profile",
  headline: "Published inventory.",
  roleContext: "business_owner",
  servicesDescription: "A complete public inventory graph.",
  businessId: null,
  updatedAt: "2026-08-25T00:00:00.000Z",
  seoMeta: {
    title: "Complete Inventory Profile",
    description: "Published inventory from Complete Inventory Profile.",
  },
  ctaConfig: { primary: { label: "Start a Request" } },
  profileBooking: null,
  contentBlocks: [
    {
      type: "inventoryCatalog",
      data: {
        categories: [
          {
            category: "Products",
            categorySlug: "products",
            stones: inventoryItems,
          },
        ],
      },
    },
  ],
};

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: vi.fn(async () => profileRecord),
    getBusinessPublicById: vi.fn(async () => null),
  },
}));

import { buildPublicProfileHtml } from "../publicProfileHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("complete public profile inventory link graph", () => {
  it("links every public inventory child instead of stopping at twelve", async () => {
    const html = await buildPublicProfileHtml({
      slug: "complete-inventory-profile",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    for (const item of inventoryItems) {
      expect(html).toContain(
        `href="https://www.thetradescout.com/u/complete-inventory-profile/inventory/${item.slug}"`
      );
    }
    expect(html).toContain("Published inventory");
    expect(html?.match(/\/inventory\/published-item-/g)).toHaveLength(14);
  });
});
