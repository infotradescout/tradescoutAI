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
  it("publishes only eligible public profiles and their public inventory routes", () => {
    const profile = {
      slug: "stone-and-tile",
      status: "published",
      contentBlocks: [inventoryBlock],
      privatePhone: "850-555-0100",
      rankingTier: "paid",
    };

    expect(collectProfileIndexNowUrls(profile, true)).toEqual([
      "/u/stone-and-tile",
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
