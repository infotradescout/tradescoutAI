import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile product-card contract", () => {
  const card = read("client/src/components/profile/PublicProfileProductCard.tsx");
  const items = read("client/src/components/profile/PublicProfileItems.tsx");
  const stone = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
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

  it("gives profile inventory exact sharing, details, and protected request entry", () => {
    expect(stone).toContain('data-testid="profile-inventory-card"');
    expect(stone).toContain('data-testid="profile-featured-product-card"');
    expect(stone).toContain("profileInventoryShareIndexForDisplay(");
    expect(stone).toContain("buildProfilePublicItemPath({");
    expect(stone).toContain('itemType: "inventory"');
    expect(stone).toContain("View details");
    expect(stone).toMatch(
      /startDirectConnect\(\s*getStoneDisplayName\(stone\),\s*"request_material",\s*stone\.slug/
    );
    expect(stone).toContain("Ask about {getStoneDisplayName(stone)}");
  });

  it("keeps JR's before-and-after proof separate from product inventory", () => {
    expect(autoGlass).toContain("Recent work");
    expect(autoGlass).toContain("Before and after");
    expect(autoGlass).toContain("buildProfilePublicItemPath({");
    expect(autoGlass).toContain('itemType: "gallery"');
    expect(autoGlass).not.toContain("PublicProfileProductCard");
    expect(autoGlass).not.toContain("inventory-card");
  });
});

describe("public profile Direct Connect entry contract", () => {
  const profile = read("client/src/pages/ProfileSiteView.tsx");
  const defaultTheme = read("client/src/pages/profile-sites/DefaultProfileTheme.tsx");
  const stone = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
  const autoGlass = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
  const express = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
  const directConnect = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

  it("limits request entry to Direct Connect or Make A Request and opens call-or-form choices", () => {
    expect(profile).toContain("onDirectConnect={openServiceDirectConnect}");
    expect(defaultTheme).toContain("Direct Connect");
    // "Direct Connect" labels the general, no-context entry points (nav
    // references, and any button that opens the flow with no specific item
    // attached). Buttons that carry something specific forward -- a stone
    // name, a search term -- get a contextual label instead of the generic
    // phrase repeated on every card and CTA.
    expect(stone.match(/Direct Connect/g)?.length || 0).toBeGreaterThanOrEqual(5);
    expect(autoGlass.match(/Direct Connect/g)?.length || 0).toBeGreaterThanOrEqual(3);
    expect(express).toContain("Direct Connect");
    expect(express).toContain("Make A Request");
    expect(express).toContain("Call");
    expect(express).toContain("Fill out the form");
    expect(directConnect).toContain("Direct Connect");
    for (const source of [profile, defaultTheme, autoGlass, directConnect]) {
      expect(source).not.toContain("Make A Request");
    }
    expect(directConnect).not.toContain("Start request\n            </Button>");

    // Wholesaler product cards use a contextual label only when the button
    // actually carries something specific forward (a stone name, a search
    // term). General entry points with no attached context stay "Direct
    // Connect" rather than being given a label that overpromises specificity.
    expect(stone).toMatch(
      /startDirectConnect\(\s*getStoneDisplayName\(stone\),\s*"request_material",\s*stone\.slug/
    );
    expect(stone).toContain("Ask about {getStoneDisplayName(stone)}");
    expect(stone).toContain('startDirectConnect(stoneName, "request_material", stoneSlug)');
    expect(stone).toContain("Ask about this stone");
    expect(stone).toContain("startDirectConnect(inventorySearch.trim()");
    expect(stone).toContain("Request this stone");
    expect(stone).not.toContain("Request material");
    expect(stone).not.toContain("Send request");
    expect(stone).not.toContain("Get started");

    for (const source of [autoGlass]) {
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
