import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHomeScoutListing: vi.fn(),
  hasExposureAuthority: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: { getHomeScoutListing: mocks.getHomeScoutListing },
}));

vi.mock("../services/exposureAuthority", () => ({
  hasExposureAuthority: mocks.hasExposureAuthority,
}));

import { buildPublicHomeScoutListingHtml } from "../publicHomeScoutListingHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta property="og:image:secure_url" content="/tradescout-social-preview.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("public HomeScout listing HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasExposureAuthority.mockResolvedValue(true);
    mocks.getHomeScoutListing.mockResolvedValue({
      id: "listing-123",
      status: "active",
      title: "Stone cottage",
      description: "Call 850-555-0188 to tour this updated home.",
      price: "425000.00",
      propertyType: "house",
      beds: 3,
      baths: "2.0",
      sqft: 1840,
      city: "Pensacola",
      stateCode: "FL",
      countyFips: "12033",
      photos: ["/uploads/homescout/stone-cottage.webp"],
      sellerUserId: "private-owner-id",
      contactUserId: "authority-user-id",
    });
  });

  it("uses the exact property photo and protected canonical metadata", async () => {
    const html = await buildPublicHomeScoutListingHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      listingId: "listing-123",
    });

    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/homescout/stone-cottage.webp"'
    );
    expect(html).toContain(
      'name="twitter:image" content="https://www.thetradescout.com/uploads/homescout/stone-cottage.webp"'
    );
    expect(html).toContain(
      'property="og:url" content="https://www.thetradescout.com/homescout/listings/listing-123"'
    );
    expect(html).toContain('"@type":"SingleFamilyResidence"');
    expect(html).toContain('"price":"425000.00"');
    expect(html).toContain("Continue through TradeScout");
    expect(html).not.toContain("850-555-0188");
    expect(html).not.toContain("private-owner-id");
    expect(html).not.toContain("authority-user-id");
    expect(html).not.toContain('property="og:image:width"');
  });

  it("does not publish metadata for inactive, untrusted, or invalid listings", async () => {
    mocks.getHomeScoutListing.mockResolvedValueOnce({ id: "draft", status: "pending_review" });
    await expect(
      buildPublicHomeScoutListingHtml({
        origin: "https://www.thetradescout.com",
        templateHtml,
        listingId: "draft",
      })
    ).resolves.toBeNull();

    mocks.hasExposureAuthority.mockResolvedValueOnce(false);
    await expect(
      buildPublicHomeScoutListingHtml({
        origin: "https://www.thetradescout.com",
        templateHtml,
        listingId: "listing-123",
      })
    ).resolves.toBeNull();

    await expect(
      buildPublicHomeScoutListingHtml({
        origin: "https://www.thetradescout.com",
        templateHtml,
        listingId: "../private",
      })
    ).resolves.toBeNull();
  });
});
