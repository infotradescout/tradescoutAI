import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getMarketplaceListing: vi.fn(),
  hasExposureAuthority: vi.fn(),
}));

vi.mock("../db", () => ({
  pool: { query: mocks.query },
}));

vi.mock("../storage", () => ({
  storage: { getMarketplaceListing: mocks.getMarketplaceListing },
}));

vi.mock("../services/exposureAuthority", () => ({
  hasExposureAuthority: mocks.hasExposureAuthority,
}));

import { buildPublicExchangeListingHtml } from "../publicExchangeListingHtml";

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
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("public profile offer Exchange HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMarketplaceListing.mockResolvedValue(null);
    mocks.hasExposureAuthority.mockResolvedValue(true);
  });

  it("uses a legacy imageUrls product photo as the exact social preview", async () => {
    mocks.query.mockResolvedValue({
      rows: [
        {
          id: "offer-123",
          seller_user_id: "seller-123",
          is_active: true,
          offer_type: "item",
          title: "Handmade Walnut Table",
          description: "A locally made solid walnut dining table.",
          price: "1200",
          city: "Chattanooga",
          state_code: "TN",
          first_name: "Alex",
          last_name: "Maker",
          fulfillment_mode: "pickup",
          metadata: {
            exchangeCategorySlug: "furniture",
            imageUrls: ["https://images.example.com/walnut-table.jpg"],
          },
        },
      ],
    });

    const html = await buildPublicExchangeListingHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      categoryParam: "furniture",
      listingId: "profile-offer-offer-123",
    });

    expect(html).toContain(
      'property="og:image" content="https://images.example.com/walnut-table.jpg"'
    );
    expect(html).toContain(
      'property="og:url" content="https://www.thetradescout.com/exchange/furniture/profile-offer-offer-123"'
    );
    expect(html).toContain('property="og:type" content="product"');
    expect(html).toContain(
      'name="twitter:image" content="https://images.example.com/walnut-table.jpg"'
    );
    expect(html).toContain('"@type":"Product"');
  });
});
