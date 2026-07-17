import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicProfileServiceOffer: vi.fn(),
}));

vi.mock("../db", () => ({ pool: {} }));
vi.mock("../publicProfileOffer", () => ({
  getPublicProfileServiceOffer: mocks.getPublicProfileServiceOffer,
}));

import { buildPublicProfileServiceOfferHtml } from "../publicProfileServiceOfferHtml";

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
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const offer = {
  id: "service-123",
  sellerUserId: "seller-1",
  title: "Natural stone consultation",
  description: "Review materials and measurements before work begins.",
  offerType: "service",
  price: 125,
  currency: "USD",
  serviceCategory: "Stone planning",
  serviceDurationMinutes: 60,
  itemSku: null,
  itemStockQuantity: null,
  fulfillmentMode: "scheduled_service",
  shippingCost: 0,
  isActive: true,
  metadata: {
    imageUrls: ["/uploads/services/stone.webp"],
    images: ["/uploads/services/stone.webp"],
    visibilityBoundary: "Profile visibility does not grant contact.",
  },
  createdAt: new Date("2026-07-01T00:00:00Z"),
  updatedAt: new Date("2026-07-02T00:00:00Z"),
};

describe("public profile service offer HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicProfileServiceOffer.mockResolvedValue(offer);
  });

  it("uses the exact service image and protected canonical URL", async () => {
    const html = await buildPublicProfileServiceOfferHtml({
      offerId: "service-123",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('property="og:type" content="product"');
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/services/stone.webp"'
    );
    expect(html).toContain(
      'name="twitter:image" content="https://www.thetradescout.com/uploads/services/stone.webp"'
    );
    expect(html).toContain(
      'property="og:url" content="https://www.thetradescout.com/services/service-123"'
    );
    expect(html).toContain('"@type":"Service"');
    expect(html).toContain('content="protected-request-only"');
    expect(html).not.toContain('property="og:image:width"');
    expect(html).not.toContain('property="og:image:height"');
  });

  it("does not render missing or unavailable services", async () => {
    mocks.getPublicProfileServiceOffer.mockResolvedValueOnce(null);
    await expect(
      buildPublicProfileServiceOfferHtml({
        offerId: "service-123",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();
  });
});
