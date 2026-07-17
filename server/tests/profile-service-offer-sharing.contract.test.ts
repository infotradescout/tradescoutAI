import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("profile service offer sharing contract", () => {
  it("gives service cards durable View and Share actions", () => {
    const profile = read("client/src/pages/PublicProfileView.tsx");

    expect(profile).toContain("buildProfileServiceOfferPath(offer.id)");
    expect(profile).toContain("navigate(offerDetailPath)");
    expect(profile).toContain("destination={offerDetailPath}");
    expect(profile).toContain("handlePurchaseProfileOffer(offer)");
  });

  it("provides a public service page with exact crawler metadata", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const page = read("client/src/pages/profile-service-offer-detail.tsx");
    const serverIndex = read("server/index.ts");
    const html = read("server/publicProfileServiceOfferHtml.ts");

    expect(routes).toContain('<Route path="/services/:offerId">');
    expect(page).toContain("createProfileServiceOfferShareMetadata");
    expect(page).toContain("listProfileOfferImageUrls(offer.metadata)");
    expect(page).toContain("<ShareButton");
    expect(serverIndex).toContain('app.get("/services/:offerId"');
    expect(html).toContain('"@type": "Service"');
    expect(html).toContain("createProfileServiceOfferShareMetadata");
  });

  it("keeps service actions inside the existing protected purchase path", () => {
    const page = read("client/src/pages/profile-service-offer-detail.tsx");
    const profile = read("client/src/pages/PublicProfileView.tsx");
    const authority = read("client/src/lib/profileOfferAuthority.ts");
    const offerRouter = read("server/invoicingDocumentsRouter.ts");

    expect(page).toContain("Start protected job");
    expect(page).toContain("not release contact details");
    expect(page).toContain("/purchase");
    expect(page).toContain("createProfileServiceOfferDecisionAuthority");
    expect(profile).toContain("createProfileServiceOfferDecisionAuthority");
    expect(authority).toContain('intent: "hire"');
    expect(authority).toContain('authorityGate: "decision_card"');
    expect(offerRouter).toContain("contactBoundary");
    expect(offerRouter).toContain("'draft', 'private', 'guided', 'none'");
    expect(offerRouter).toContain("getPublicProfileServiceOffer");
    expect(offerRouter).toContain("PROFILE_SERVICE_DECISION_CARD_REQUIRED");
    expect(offerRouter).toContain("FROM decision_cards");
    expect(offerRouter).toContain('String(decision.intent) !== "hire"');
    expect(offerRouter).toContain("SET status = 'completed'");
  });

  it("whitelists public offer data while leaving owner data unchanged", () => {
    const publicOffer = read("server/publicProfileOffer.ts");
    const offerRouter = read("server/invoicingDocumentsRouter.ts");

    expect(publicOffer).toContain("sanitizePublicProfileOfferText");
    expect(publicOffer).toContain("listProfileOfferImageUrls(metadata)");
    expect(publicOffer).not.toContain("...metadata");
    expect(publicOffer).toContain("hasExposureAuthority(offer.sellerUserId)");
    expect(offerRouter).toContain("hasExposureAuthority(sellerUserId)");
    expect(offerRouter).toContain("offers.rows.map(mapProfileOffer)");
    expect(offerRouter).toContain("offers.rows");
    expect(offerRouter).toContain(".map(toPublicProfileOffer)");
  });
});
