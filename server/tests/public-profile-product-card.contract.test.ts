import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile product-card contract", () => {
  const card = read("client/src/components/profile/PublicProfileProductCard.tsx");
  const items = read("client/src/components/profile/PublicProfileItems.tsx");
  const stone = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
  const autoGlass = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");

  it("uses one image-forward card for things that are actually inventory", () => {
    expect(card).toContain('data-testid="public-profile-product-card"');
    expect(card).toContain("Photo coming soon");
    expect(card).toContain("<ShareButton");
    expect(card).toContain('actionLabel = "View item"');
    expect(items).toContain("const serviceOffers = offers.filter");
    expect(items).toContain("const productOffers = offers.filter");
    expect(items).toContain("Products &amp; inventory");
    expect(items.match(/<PublicProfileProductCard/g)?.length || 0).toBe(3);
  });

  it("gives JW Stone inventory exact sharing, details, and protected request entry", () => {
    expect(stone).toContain('data-testid="jw-stone-inventory-card"');
    expect(stone).toContain('data-testid="jw-stone-featured-product-card"');
    expect(stone).toContain("buildProfileInventoryShareSearch(stone.slug)");
    expect(stone).toContain("View details");
    expect(stone).toContain('startDirectConnect(stone.name, "request_material")');
    expect(stone).toContain("Make A Request");
  });

  it("keeps JR's before-and-after proof separate from product inventory", () => {
    expect(autoGlass).toContain("Recent work");
    expect(autoGlass).toContain("Before and after");
    expect(autoGlass).toContain("buildProfileGalleryShareSearch(item.slug)");
    expect(autoGlass).not.toContain("PublicProfileProductCard");
    expect(autoGlass).not.toContain("inventory-card");
  });
});

describe("public profile Direct Connect entry contract", () => {
  const profile = read("client/src/pages/ProfileSiteView.tsx");
  const stone = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
  const autoGlass = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
  const express = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
  const directConnect = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

  it("names request-entry buttons only Make A Request and keeps the product name Direct Connect", () => {
    expect(profile).toContain("Make A Request");
    expect(stone.match(/Make A Request/g)?.length || 0).toBeGreaterThanOrEqual(8);
    expect(autoGlass.match(/Make A Request/g)?.length || 0).toBeGreaterThanOrEqual(3);
    expect(express.match(/choiceLabel: "Make A Request"/g)?.length || 0).toBe(3);
    expect(express).toContain("Direct Connect");
    expect(directConnect).toContain("Make A Request");
    expect(directConnect).not.toContain("Start request\n            </Button>");

    for (const source of [stone, autoGlass]) {
      expect(source).not.toContain("Request material");
      expect(source).not.toContain("Request service");
      expect(source).not.toContain("Send request");
      expect(source).not.toContain("Contact now");
    }
  });

  it("guards browser Back and explicit exits inside TradeScout", () => {
    expect(profile).toContain("__tradeScoutProfileHistoryBoundary");
    expect(profile).toContain('window.addEventListener("popstate", handlePopState)');
    expect(profile).toContain("window.location.replace(safeReturnHref)");
    expect(profile).toContain("tradeScoutReturnHref={tradeScoutReturnHref}");
    expect(stone).not.toContain("window.history.back()");
    expect(autoGlass).not.toContain("window.history.back()");
  });
});
