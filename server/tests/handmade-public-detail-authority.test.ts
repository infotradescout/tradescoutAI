import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  toPublicHandmadeProduct,
  toPublicHandmadeProductReview,
  toPublicHandmadeSellerProfile,
} from "../publicHandmadeProduct";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const product = {
  id: "stone-bowl-123",
  sellerId: "maker-123",
  categoryId: "decor",
  title: "Hand-carved stone bowl",
  description: "Text 555-867-5309 or stone@example.com for pickup at 123 Private Street.",
  price: "125.00",
  compareAtPrice: "150.00",
  currency: "USD",
  materials: ["Local stone"],
  colors: ["Gray"],
  primaryImageUrl: "/objects/stone-bowl.jpg",
  images: ["https://images.example.com/stone-bowl-side.jpg", "javascript:alert(1)"],
  city: "Example City",
  stateCode: "TX",
  countyFips: "48001",
  shippingFrom: "123 Private Street, Example City, TX 75000",
  seoTitle: "Call the maker",
  seoDescription: "Private search text",
  moderationNotes: "Internal note",
  status: "active",
  inStock: true,
  quantityAvailable: 2,
};

describe("public Handmade detail authority boundary", () => {
  it("preserves exact item photos and shopping facts through a public whitelist", () => {
    const result = toPublicHandmadeProduct(product) as Record<string, any>;

    expect(result.primaryImageUrl).toBe("/objects/stone-bowl.jpg");
    expect(result.images).toEqual([
      "/objects/stone-bowl.jpg",
      "https://images.example.com/stone-bowl-side.jpg",
    ]);
    expect(result.price).toBe("125.00");
    expect(result.shippingFrom).toBe("Example City, TX");
    expect(result.contactAccess).toEqual({
      mode: "profile_decision_card_required",
      profilePath: "/profile/maker-123",
    });
  });

  it("removes routing, exact-location, SEO, moderation, and direct-contact data", () => {
    const result = toPublicHandmadeProduct(product) as Record<string, any>;

    expect(result.description).toContain("Continue through TradeScout");
    expect(result.description).not.toContain("555-867-5309");
    expect(result.description).not.toContain("stone@example.com");
    expect(result).not.toHaveProperty("countyFips");
    expect(result).not.toHaveProperty("seoTitle");
    expect(result).not.toHaveProperty("seoDescription");
    expect(result).not.toHaveProperty("moderationNotes");
    expect(JSON.stringify(result)).not.toContain("123 Private Street");
  });

  it("removes external contact vectors from public maker profiles", () => {
    const result = toPublicHandmadeSellerProfile({
      userId: "maker-123",
      businessName: "Stone Works",
      bio: "Email stone@example.com for commissions",
      website: "https://stone.example.com",
      socialMediaLinks: { instagram: "stone-maker" },
      isVerified: true,
    }) as Record<string, any>;

    expect(result.bio).not.toContain("stone@example.com");
    expect(result).not.toHaveProperty("website");
    expect(result).not.toHaveProperty("socialMediaLinks");
    expect(result.profilePath).toBe("/profile/maker-123");
  });

  it("publishes review content without buyer, order, seller, or moderation identifiers", () => {
    const result = toPublicHandmadeProductReview({
      id: "review-1",
      productId: "stone-bowl-123",
      orderId: "private-order",
      buyerId: "private-buyer",
      sellerId: "maker-123",
      rating: 5,
      title: "Beautiful work",
      reviewText: "Call me at 555-111-2222",
      isPublic: true,
      moderationNotes: "Internal review note",
    }) as Record<string, any>;

    expect(result.reviewText).toContain("Continue through TradeScout");
    expect(result).not.toHaveProperty("orderId");
    expect(result).not.toHaveProperty("buyerId");
    expect(result).not.toHaveProperty("sellerId");
    expect(result).not.toHaveProperty("moderationNotes");
  });

  it("applies the whitelist and Trust/CVS boundary to every public Handmade read", () => {
    const routes = read("server/routes.ts");
    const html = read("server/publicHandmadeProductHtml.ts");

    expect(routes).toContain("buildAuthorizedPublicHandmadeProducts");
    expect(routes).toContain("toPublicHandmadeSellerProfile(profile)");
    expect(routes).toContain("reviews.map(toPublicHandmadeProductReview).filter(Boolean)");
    expect(routes).toContain("await hasExposureAuthority");
    expect(html).toContain("toPublicHandmadeProduct(product)");
    expect(html).toContain("hasExposureAuthority(String(product.sellerId");
  });
});
