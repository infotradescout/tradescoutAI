/**
 * Contract tests for Exchange metadata, category routes and canonical item sharing.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { runInNewContext } from "node:vm";

const ROOT = path.resolve(__dirname, "../..");
const SERVER_DIR = path.resolve(ROOT, "server");
const CLIENT_DIR = path.resolve(ROOT, "client/src");
function readFile(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), "utf-8").replace(/\r\n/g, "\n");
}
function readServerFile(name: string): string {
  return fs.readFileSync(path.resolve(SERVER_DIR, name), "utf-8").replace(/\r\n/g, "\n");
}
function readClientFile(relPath: string): string {
  return fs.readFileSync(path.resolve(CLIENT_DIR, relPath), "utf-8").replace(/\r\n/g, "\n");
}

describe("publicExchangeHtml.ts", () => {
  const src = readServerFile("publicExchangeHtml.ts");
  it("exports buildPublicExchangeHtml", () => { expect(src).toContain("export async function buildPublicExchangeHtml"); });
  it("sets og:url to the canonical exchange URL", () => { expect(src).toContain("og:url"); expect(src).toContain("canonical"); });
  it("handles per-category slug", () => { expect(src).toContain("categorySlug"); expect(src).toContain("/exchange/"); });
  it("handles item deep-link via ?item= param", () => { expect(src).toContain("itemId"); expect(src).toContain("item="); });
  it("handles promo deep-link via ?promo= param", () => { expect(src).toContain("promoSlug"); expect(src).toContain("promo="); });
  it("handles company promo deep-link via ?companyPromo= param", () => { expect(src).toContain("companyPromoSlug"); expect(src).toContain("companyPromo="); });
  it("injects twitter:card summary_large_image", () => { expect(src).toContain("summary_large_image"); });
  it("injects JSON-LD structured data", () => { expect(src).toContain("application/ld+json"); expect(src).toContain("WebPage"); });
  it("has per-category descriptions for all 13 categories", () => {
    for (const slug of ["business", "vehicles", "construction", "tools", "furniture", "farm", "business-equipment", "electronics", "sports", "collectibles", "jewelry", "local-food", "other"]) {
      expect(src.includes(`${slug}:`) || src.includes(`"${slug}"`)).toBe(true);
    }
  });
});

describe("server/index.ts exchange routes", () => {
  const src = readServerFile("index.ts");
  it("imports buildPublicExchangeHtml", () => { expect(src).toContain("buildPublicExchangeHtml"); expect(src).toContain("./publicExchangeHtml"); });
  it("registers /exchange route", () => { expect(src).toContain('"/exchange"'); expect(src).toContain("buildPublicExchangeHtml"); });
  it("registers /exchange/:category route", () => { expect(src).toContain('"/exchange/:category"'); });
  it("passes categorySlug from req.params.category", () => { expect(src).toContain("req.params.category"); expect(src).toContain("categorySlug"); });
  it("falls back to SPA on error instead of 500", () => {
    const block = src.slice(src.indexOf("Exchange pages: inject correct OG tags"), src.indexOf("Exchange pages: inject correct OG tags") + 2000);
    expect(block).toContain("catch"); expect(block).toContain("sendFile");
  });
});

describe("client/AppRoutes.tsx per-category routes", () => {
  const src = readClientFile("AppRoutes.tsx");
  for (const route of ["/exchange/business", "/exchange/vehicles", "/exchange/construction", "/exchange/tools", "/exchange/furniture", "/exchange/farm", "/exchange/business-equipment", "/exchange/electronics", "/exchange/sports", "/exchange/collectibles", "/exchange/jewelry", "/exchange/local-food", "/exchange/other"]) {
    it(`registers route ${route}`, () => { expect(src).toContain(`"${route}"`); });
  }
  it("lazy-imports all 13 category page components", () => {
    for (const component of ["ExchangeCategoryBusiness", "ExchangeCategoryVehicles", "ExchangeCategoryConstruction", "ExchangeCategoryTools", "ExchangeCategoryFurniture", "ExchangeCategoryFarm", "ExchangeCategoryBusinessEquipment", "ExchangeCategoryElectronics", "ExchangeCategorySports", "ExchangeCategoryCollectibles", "ExchangeCategoryJewelry", "ExchangeCategoryLocalFood", "ExchangeCategoryOther"]) expect(src).toContain(component);
  });
  it("category routes appear before the catch-all /exchange route", () => {
    const vehiclesIdx = src.indexOf('"/exchange/vehicles"'); const mainIdx = src.indexOf('path="/exchange"');
    expect(vehiclesIdx).toBeGreaterThan(0); expect(mainIdx).toBeGreaterThan(vehiclesIdx);
  });
});

describe("client/exchange.tsx getCategoryHref", () => {
  const src = readClientFile("pages/exchange.tsx");
  // Execute the current production component's initializer, not a copied routing formula.
  const declaration = /const detailPath\s*=\s*([\s\S]*?);/.exec(src);
  const destination = (item: Record<string, unknown>, isProfileCatalog = false) => {
    expect(declaration).not.toBeNull();
    return runInNewContext(`(${declaration![1]})`, { item, isProfileCatalog, detailCategory: item.category || "other", encodeURIComponent }, { timeout: 1000 });
  };
  it("shares each listing's already-computed canonical detail path", () => {
    expect(declaration).not.toBeNull();
    const block = src.slice(declaration!.index, declaration!.index + 10000);
    expect(block).toMatch(/shareLink\(\s*detailPath\s*,/);
    expect(block).not.toContain("`/exchange?item=${encodeURIComponent(item.id)}`");
    expect(destination({ id: "native-listing", category: "tools" })).toBe("/exchange/tools/native-listing");
  });
  it("encodes native IDs rather than changing the destination's path or query", () => {
    expect(destination({ id: "listing/with?reserved#characters", category: "tools" })).toBe("/exchange/tools/listing%2Fwith%3Freserved%23characters");
  });
  it("shares an individual catalog item's exact public destination", () => {
    expect(destination({ id: "catalog:blue-dunes", category: "building-materials", profileItemSlug: "blue-dunes", publicProfilePath: "/u/jw-stone-logistics/items/blue-dunes" }, true)).toBe("/u/jw-stone-logistics/items/blue-dunes");
  });
  it("retains native and incomplete-catalog fallback destinations", () => {
    expect(destination({ id: "native", publicProfilePath: "/u/unrelated", profileItemSlug: "unrelated" })).toBe("/exchange/other/native");
    expect(destination({ id: "catalog", category: "building-materials", publicProfilePath: "/u/catalog" }, true)).toBe("/exchange/building-materials/catalog");
    expect(destination({ id: "catalog", category: "building-materials", profileItemSlug: "item" }, true)).toBe("/exchange/building-materials/catalog");
  });
  it("routes vehicles to /exchange/vehicles", () => { const block = src.slice(src.indexOf("getCategoryHref"), src.indexOf("getCategoryHref") + 600); expect(block).toContain('"vehicles"'); expect(block).toContain("/exchange/"); });
  it("routes construction to /exchange/construction", () => { const block = src.slice(src.indexOf("getCategoryHref"), src.indexOf("getCategoryHref") + 600); expect(block).toContain('"construction"'); expect(block).toContain("/exchange/"); });
  it("routes business to /exchange/business", () => { const block = src.slice(src.indexOf("getCategoryHref"), src.indexOf("getCategoryHref") + 600); expect(block).toContain('"business"'); expect(block).toContain("/exchange/"); });
  it("still routes real-estate to /homescout-listings", () => { expect(src).toContain('"/homescout-listings"'); });
  it("still routes metals to /exchange/metals", () => { expect(src).toContain('"/exchange/metals"'); });
});

describe("ExchangeCategoryPage.tsx", () => {
  const src = readClientFile("pages/exchange/ExchangeCategoryPage.tsx");
  it("exports ExchangeCategoryPage", () => { expect(src).toContain("export function ExchangeCategoryPage"); });
  it("has mobile filter sheet (bottom sheet)", () => { expect(src).toContain("Sheet"); expect(src).toContain('side="bottom"'); });
  it("has desktop sidebar filter panel", () => { expect(src).toContain("hidden xl:block"); expect(src).toContain("xl:sticky"); });
  it("has search scope toggle (local/state/nationwide)", () => { expect(src).toContain("local"); expect(src).toContain("state"); expect(src).toContain("nationwide"); });
  it("has share button for individual items", () => {
    expect(src).toContain("handleShare"); expect(src).toContain("Share2");
    expect(src).toContain("path: `/exchange/${config.slug}/${encodeURIComponent(item.id)}`");
    expect(src).not.toContain("path: `/exchange/${config.slug}?item=${encodeURIComponent(item.id)}`");
  });
  it("has share button for the category itself", () => { expect(src).toContain("handleShareCategory"); });
  it("uses SEOHelmet with canonical URL", () => { expect(src).toContain("SEOHelmet"); expect(src).toContain("canonical"); expect(src).toContain("/exchange/"); });
  it("has inquiry/contact dialog", () => { expect(src).toContain("contactItem"); expect(src).toContain("inquire"); });
  it("has favorite toggle", () => { expect(src).toContain("toggleFavoriteMutation"); expect(src).toContain("favoriteSet"); });
  it("has loading skeleton", () => { expect(src).toContain("animate-pulse"); });
  it("has empty state with list action", () => { expect(src).toContain("EmptyState"); expect(src).toContain("List something"); });
});

describe("categoryConfigs.tsx", () => {
  const src = readClientFile("pages/exchange/categoryConfigs.tsx");
  it("exports CATEGORY_CONFIGS", () => { expect(src).toContain("export const CATEGORY_CONFIGS"); });
  for (const slug of ["business", "vehicles", "construction", "tools", "furniture", "farm", "business-equipment", "electronics", "sports", "collectibles", "jewelry", "local-food", "other"]) it(`has config for ${slug}`, () => { expect(src).toContain(`"${slug}"`); });
  it("each config has extraFilters", () => { expect(src).toContain("extraFilters"); });
  it("each config has priceRanges", () => { expect(src).toContain("priceRanges"); });
});

describe("per-category thin wrapper pages", () => {
  for (const page of ["ExchangeBusinessPage", "ExchangeVehiclesPage", "ExchangeConstructionPage", "ExchangeToolsPage", "ExchangeFurniturePage", "ExchangeFarmPage", "ExchangeBusinessEquipmentPage", "ExchangeElectronicsPage", "ExchangeSportsPage", "ExchangeCollectiblesPage", "ExchangeJewelryPage", "ExchangeLocalFoodPage", "ExchangeOtherPage"]) {
    it(`${page}.tsx exists and exports default`, () => {
      const filePath = path.resolve(CLIENT_DIR, `pages/exchange/${page}.tsx`);
      expect(fs.existsSync(filePath)).toBe(true);
      const src = fs.readFileSync(filePath, "utf-8");
      expect(src).toContain(`export default function ${page}`); expect(src).toContain("ExchangeCategoryPage"); expect(src).toContain("CATEGORY_CONFIGS");
    });
  }
});
