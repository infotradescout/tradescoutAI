import { describe, expect, it } from "vitest";
import {
  buildProfileOfferExchangePath,
  listProfileOfferImageUrls,
  normalizeProfileOfferExchangeCategory,
} from "@shared/profileOfferShare";

describe("profile offer item sharing", () => {
  it("builds the existing Exchange detail route for a profile item offer", () => {
    expect(buildProfileOfferExchangePath("offer-123", "tools")).toBe(
      "/exchange/tools/profile-offer-offer-123"
    );
    expect(buildProfileOfferExchangePath("offer_456", "not-a-real-category")).toBe(
      "/exchange/other/profile-offer-offer_456"
    );
    expect(normalizeProfileOfferExchangeCategory("FURNITURE")).toBe("furniture");
    expect(normalizeProfileOfferExchangeCategory("building-materials")).toBe("other");
  });

  it("rejects unsafe or malformed offer identifiers", () => {
    expect(buildProfileOfferExchangePath("../offer", "tools")).toBeNull();
    expect(buildProfileOfferExchangePath("offer/123", "tools")).toBeNull();
    expect(buildProfileOfferExchangePath("", "tools")).toBeNull();
  });

  it("uses both current and legacy image metadata without unsafe URLs or duplicates", () => {
    expect(
      listProfileOfferImageUrls({
        images: ["/uploads/items/current.jpg", "javascript:alert(1)"],
        imageUrls: [
          "/uploads/items/current.jpg",
          "https://images.example.com/legacy.webp",
          "//unsafe.example.com/image.jpg",
        ],
      })
    ).toEqual(["/uploads/items/current.jpg", "https://images.example.com/legacy.webp"]);
  });
});
