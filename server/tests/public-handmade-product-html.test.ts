import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHandmadeProduct: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: { getHandmadeProduct: mocks.getHandmadeProduct },
}));

import { buildPublicHandmadeProductHtml } from "../publicHandmadeProductHtml";

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

describe("public Handmade product HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHandmadeProduct.mockResolvedValue({
      id: "oak-board-123",
      sellerId: "maker-1",
      title: "Oak Serving Board",
      description: "A hand-finished white oak serving board made by a local woodworker.",
      price: "84.00",
      currency: "USD",
      status: "active",
      inStock: true,
      primaryImageUrl: "/uploads/handmade/oak-serving-board.jpg",
      images: ["https://images.example.com/oak-board-detail.webp"],
      materials: ["White oak"],
      colors: ["Natural"],
    });
  });

  it("uses the exact product photo and canonical detail URL in crawler metadata", async () => {
    const html = await buildPublicHandmadeProductHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      productId: "oak-board-123",
    });

    expect(html).toContain('property="og:type" content="product"');
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/handmade/oak-serving-board.jpg"'
    );
    expect(html).toContain(
      'name="twitter:image" content="https://www.thetradescout.com/uploads/handmade/oak-serving-board.jpg"'
    );
    expect(html).toContain(
      'property="og:url" content="https://www.thetradescout.com/handmade/products/oak-board-123"'
    );
    expect(html).toContain(
      'link rel="canonical" href="https://www.thetradescout.com/handmade/products/oak-board-123"'
    );
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('"price":"84.00"');
    expect(html).not.toContain("maker-1");
  });

  it("does not publish metadata for draft or invalid products", async () => {
    mocks.getHandmadeProduct.mockResolvedValueOnce({
      id: "private-draft",
      title: "Private draft",
      status: "draft",
    });

    await expect(
      buildPublicHandmadeProductHtml({
        origin: "https://www.thetradescout.com",
        templateHtml,
        productId: "private-draft",
      })
    ).resolves.toBeNull();
    await expect(
      buildPublicHandmadeProductHtml({
        origin: "https://www.thetradescout.com",
        templateHtml,
        productId: "../private",
      })
    ).resolves.toBeNull();
  });
});
