import { describe, expect, it } from "vitest";
import { buildPublicBusinessListingCards } from "@shared/publicBusinessListing";

describe("public business listing cards", () => {
  it("builds an exact Exchange item link without leaking seller or exact-location data", () => {
    const [card] = buildPublicBusinessListingCards({
      listings: [
        {
          id: "listing-1",
          sellerId: "private-owner-id",
          categoryId: "tools-category",
          title: "Milwaukee Contractor Bundle",
          description: "Eight-tool bundle with batteries and charger.",
          price: "850.00",
          county: "Travis County",
          state: "TX",
          zipCode: "78701",
          latitude: "30.2672",
          longitude: "-97.7431",
          images: [
            "/uploads/listings/milwaukee-main.webp",
            "/uploads/listings/milwaukee-detail.webp",
          ],
          primaryImageIndex: 0,
          createdAt: "2026-07-16T12:00:00.000Z",
        },
      ],
      categories: [{ id: "tools-category", name: "Tools & Hardware" }],
    });

    expect(card).toEqual({
      id: "listing-1",
      title: "Milwaukee Contractor Bundle",
      description: "Eight-tool bundle with batteries and charger.",
      price: "850.00",
      county: "Travis County",
      state: "TX",
      imageUrl: "/uploads/listings/milwaukee-main.webp",
      categoryName: "Tools & Hardware",
      categorySlug: "tools",
      detailPath: "/exchange/tools/listing-1",
      createdAt: "2026-07-16T12:00:00.000Z",
    });

    const serialized = JSON.stringify(card);
    expect(serialized).not.toContain("private-owner-id");
    expect(serialized).not.toContain("78701");
    expect(serialized).not.toContain("30.2672");
    expect(serialized).not.toContain("-97.7431");
  });

  it("rejects unsafe images and caps the embedded profile catalog", () => {
    const listings = Array.from({ length: 8 }, (_, index) => ({
      id: `listing-${index + 1}`,
      categoryId: "unknown-category",
      title: `Listing ${index + 1}`,
      description: "",
      price: index + 1,
      county: "",
      state: "",
      images: index === 0 ? ["javascript:alert(1)"] : [`/uploads/listings/${index}.webp`],
      primaryImageIndex: 0,
    }));

    const cards = buildPublicBusinessListingCards({ listings, categories: [] });

    expect(cards).toHaveLength(6);
    expect(cards[0]).toMatchObject({
      imageUrl: null,
      categorySlug: "other",
      detailPath: "/exchange/other/listing-1",
    });
  });
});
