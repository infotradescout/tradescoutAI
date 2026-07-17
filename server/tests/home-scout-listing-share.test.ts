import { describe, expect, it } from "vitest";
import {
  buildHomeScoutListingPath,
  buildPublicHomeScoutListingCards,
  createHomeScoutListingShareMetadata,
  listHomeScoutListingPhotoUrls,
} from "@shared/homeScoutListingShare";

describe("HomeScout listing sharing", () => {
  it("builds a compact profile card without owner, contact, or exact-address fields", () => {
    const [card] = buildPublicHomeScoutListingCards([
      {
        id: "property-123",
        title: "Stone cottage — call 850-555-0188",
        description: "Email owner@example.com for a private tour",
        price: "425000.00",
        propertyType: "house",
        beds: 3,
        baths: "2.0",
        sqft: 1840,
        countyFips: "12033",
        stateCode: "FL",
        city: "Pensacola",
        address1: "100 Private Way",
        zipCode: "32501",
        latitude: "30.4213",
        longitude: "-87.2169",
        sellerUserId: "private-seller",
        contactUserId: "private-contact",
        photos: ["/uploads/homescout/stone-cottage.webp"],
        listedAt: "2026-07-16T12:00:00.000Z",
      },
    ]);

    expect(card).toMatchObject({
      id: "property-123",
      title: "Stone cottage — call Continue through TradeScout",
      description: "Email Continue through TradeScout for a private tour",
      price: "425000.00",
      imageUrl: "/uploads/homescout/stone-cottage.webp",
      detailPath: "/homescout/listings/property-123",
    });
    const serialized = JSON.stringify(card);
    expect(serialized).not.toContain("100 Private Way");
    expect(serialized).not.toContain("32501");
    expect(serialized).not.toContain("private-seller");
    expect(serialized).not.toContain("private-contact");
  });

  it("uses the exact first safe property photo for the durable shared URL", () => {
    const meta = createHomeScoutListingShareMetadata({
      listing: {
        id: "property_456",
        title: "Downtown bungalow",
        description: "Renovated home near the county core.",
        stateCode: "FL",
        city: "Pensacola",
        photos: ["javascript:alert(1)", "/uploads/homescout/bungalow.jpg"],
      },
      origin: "https://www.thetradescout.com",
    });

    expect(buildHomeScoutListingPath("property_456")).toBe("/homescout/listings/property_456");
    expect(listHomeScoutListingPhotoUrls(["javascript:bad", "/safe.webp"])).toEqual(["/safe.webp"]);
    expect(meta).toMatchObject({
      canonical: "https://www.thetradescout.com/homescout/listings/property_456",
      imageUrl: "https://www.thetradescout.com/uploads/homescout/bungalow.jpg",
      imageAlt: "Downtown bungalow property photo",
    });
  });

  it("rejects path traversal identifiers", () => {
    expect(buildHomeScoutListingPath("../private-property")).toBeNull();
    expect(buildHomeScoutListingPath("property/123")).toBeNull();
  });
});
