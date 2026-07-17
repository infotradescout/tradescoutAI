import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isPublicExchangeListingAvailable,
  toPublicExchangeListing,
} from "../publicExchangeListing";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const activeListing = {
  id: "listing-1",
  sellerId: "seller-1",
  categoryId: "category-1",
  status: "active",
  title: "Stone patio set",
  description: "Text 555-867-5309 or stone@example.com for the exact address",
  price: "1250.00",
  county: "Example County",
  state: "TX",
  city: "Example City",
  zipCode: "75000",
  latitude: "32.123456",
  longitude: "-97.123456",
  moderationNotes: "private moderation note",
  images: ["/objects/stone-set.jpg", "javascript:alert(1)"],
  primaryImageIndex: 0,
  condition: "excellent",
  specifications: {
    material: "limestone",
    sellerPhone: "555-111-2222",
    pickupAddress: "123 Private Street",
  },
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("public Exchange listing authority boundary", () => {
  it("allows only active, unexpired listings", () => {
    const now = new Date("2026-07-16T00:00:00.000Z");
    expect(isPublicExchangeListingAvailable(activeListing, now)).toBe(true);
    expect(isPublicExchangeListingAvailable({ ...activeListing, status: "draft" }, now)).toBe(
      false
    );
    expect(
      isPublicExchangeListingAvailable(
        { ...activeListing, expiresAt: "2026-07-15T00:00:00.000Z" },
        now
      )
    ).toBe(false);
  });

  it("whitelists public fields, exact images, and area-level location only", () => {
    const listing = toPublicExchangeListing(activeListing) as Record<string, any>;

    expect(listing.images).toEqual(["/objects/stone-set.jpg"]);
    expect(listing.description).toContain("Continue through TradeScout");
    expect(listing.description).not.toContain("555-867-5309");
    expect(listing.description).not.toContain("stone@example.com");
    expect(listing).not.toHaveProperty("zipCode");
    expect(listing).not.toHaveProperty("latitude");
    expect(listing).not.toHaveProperty("longitude");
    expect(listing).not.toHaveProperty("moderationNotes");
    expect(listing.specifications).toEqual({ material: "limestone" });
    expect(listing.contactAccess).toEqual({
      mode: "decision_card_required",
      decisionScope: "marketplace_listing:listing-1",
    });
  });

  it("gates public list, search, ID, slug, and profile-offer reads through Trust/CVS", () => {
    const routes = read("server/routes.ts");

    expect(routes).toContain('status: "active"');
    expect(routes).toContain("toPublicExchangeListing(listing)");
    expect(routes).toContain('buildExposureAuthorityMap([String(listing.sellerId || "")])');
    expect(routes).toContain('authority[String(row.seller_user_id || "").trim()] !== true');
    expect(routes).toContain('app.get("/api/marketplace/listings/slug/:slug"');
  });

  it("requires a matching durable Decision Card before an inquiry or conversation", () => {
    const routes = read("server/routes.ts");
    const page = read("client/src/pages/exchange/ExchangeListingDetail.tsx");
    const legacyStarter = read("client/src/components/conversation-starter.tsx");

    expect(routes).toContain('authorityGate: z.literal("decision_card")');
    expect(routes).toContain("eq(decisionCards.id, validatedData.sourceDecisionCardId)");
    expect(routes).toContain('decision.intent !== "collaborate"');
    expect(routes).toContain('authorityGate: "decision_card"');
    expect(routes).toContain("sourceDecisionCardId: validatedData.sourceDecisionCardId");
    expect(page).toContain('apiRequest("POST", "/api/decision-cards"');
    expect(page).toContain('authorityGate: "decision_card"');
    expect(page).toContain("Exchange Decision Card");
    expect(page).not.toContain("Contact Seller");
    expect(legacyStarter).toContain('apiRequest("POST", "/api/decision-cards"');
    expect(legacyStarter).toContain('authorityGate: "decision_card"');
    expect(routes).not.toContain('authorityGate: "scout_recommendation"');
  });

  it("applies the same authority and sanitized metadata boundary to social previews", () => {
    const html = read("server/publicExchangeListingHtml.ts");

    expect(html).toContain("toPublicExchangeListing(listing)");
    expect(html).toContain("hasExposureAuthority(authorityUserId)");
    expect(html).toContain("toPublicProfileOffer(row)");
    expect(html).toContain("sanitizePublicListingText(listing.description, 160)");
    expect(html).toContain("new URL(primaryImage, origin).toString()");
  });
});
