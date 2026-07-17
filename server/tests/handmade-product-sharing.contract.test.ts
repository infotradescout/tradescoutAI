import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Handmade product sharing contract", () => {
  it("registers the missing public product page in the client and crawler HTML server", () => {
    const appRoutes = read("client/src/AppRoutes.tsx");
    const serverIndex = read("server/index.ts");

    expect(appRoutes).toContain('import("./pages/handmade-product-detail")');
    expect(appRoutes).toContain('<Route path="/handmade/products/:id">');
    expect(serverIndex).toContain('app.get("/handmade/products/:productId"');
    expect(serverIndex).toContain("buildPublicHandmadeProductHtml({");
  });

  it("gives Marketplace cards and member-profile products exact View and Share actions", () => {
    const marketplace = read("client/src/pages/handmade-marketplace.tsx");
    const profile = read("client/src/pages/PublicProfileView.tsx");

    for (const source of [marketplace, profile]) {
      expect(source).toContain("buildHandmadeProductPath(");
      expect(source).toContain("<ShareButton");
      expect(source).toContain("TradeScout Handmade");
    }
    expect(profile).toContain("listHandmadeProductImageUrls(product)[0]");
    expect(profile).toContain("renderSellerProductSummary");
  });

  it("keeps inactive products private and does not invent a purchase or contact bypass", () => {
    const serverRoutes = read("server/routes.ts");
    const detailPage = read("client/src/pages/handmade-product-detail.tsx");

    expect(serverRoutes).toContain('!product || product.status !== "active"');
    expect(serverRoutes).toContain("getHandmadeProducts({ sellerId: userId, limit: 100 })");
    expect(detailPage).toContain("Sharing this item does not expose");
    expect(detailPage).toContain("protected request path");
    expect(detailPage).not.toContain("/api/handmade/orders");
    expect(detailPage).not.toContain(">Buy<");
  });
});
