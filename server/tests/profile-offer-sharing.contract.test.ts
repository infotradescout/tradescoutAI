import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile offer sharing contract", () => {
  it("gives profile item offers exact View and Share actions", () => {
    const profileView = read("client/src/pages/PublicProfileView.tsx");

    expect(profileView).toContain("buildProfileOfferExchangePath(");
    expect(profileView).toContain('offer.offerType === "item"');
    expect(profileView).toContain("navigate(offerDetailPath)");
    expect(profileView).toContain("destination={offerDetailPath}");
    expect(profileView).toContain("<ShareButton");
    expect(profileView).toContain("openPurchaseDialog(offer)");
    expect(profileView).toContain("handlePurchaseProfileOffer(offer)");
  });

  it("uses current and legacy profile-offer images in API and crawler previews", () => {
    const exchangeHtml = read("server/publicExchangeListingHtml.ts");
    const exchangeRoutes = read("server/routes.ts");

    expect(exchangeHtml).toContain("listProfileOfferImageUrls(metadata)");
    expect(exchangeRoutes).toContain("listProfileOfferImageUrls(metadata)");
    expect(exchangeHtml).toContain("getProfileOfferExchangeListing");
    expect(exchangeHtml).toContain("og:image");
    expect(exchangeRoutes).toContain('sourceType: "profile_offer"');
  });

  it("keeps purchase review and protected-contact boundaries intact", () => {
    const profileView = read("client/src/pages/PublicProfileView.tsx");
    const offerRouter = read("server/invoicingDocumentsRouter.ts");

    expect(profileView).toContain("No payment, contact release, posting, or shipping");
    expect(offerRouter).toContain("contactBoundary");
    expect(offerRouter).toContain(
      "User review is required before posting, sending invoices, marking paid, shipping, contact release, or moving money."
    );
  });
});
