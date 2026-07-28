/**
 * exchange-og-and-category-routing.contract.test.ts
 *
 * Contract tests for:
 * 1. publicExchangeHtml.ts — correct OG/meta injection per route variant
 * 2. server/index.ts — /exchange and /exchange/:category routes registered
 * 3. client/AppRoutes.tsx — 13 per-category routes registered
 * 4. client/exchange.tsx — getCategoryHref routes categories to dedicated pages
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../..");
const SERVER_DIR = path.resolve(ROOT, "server");
const CLIENT_DIR = path.resolve(ROOT, "client/src");

// ─── helpers ─────────────────────────────────────────────────────────────────

function readFile(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), "utf-8");
}

function readServerFile(name: string): string {
  return fs.readFileSync(path.resolve(SERVER_DIR, name), "utf-8");
}

function readClientFile(relPath: string): string {
  return fs.readFileSync(path.resolve(CLIENT_DIR, relPath), "utf-8");
}

// ─── 1. publicExchangeHtml.ts ─────────────────────────────────────────────────

describe("publicExchangeHtml.ts", () => {
  const src = readServerFile("publicExchangeHtml.ts");

  it("exports buildPublicExchangeHtml", () => {
    expect(src).toContain("export async function buildPublicExchangeHtml");
  });

  it("sets og:url to the canonical exchange URL", () => {
    expect(src).toContain("og:url");
    expect(src).toContain("canonical");
  });

  it("handles per-category slug", () => {
    expect(src).toContain("categorySlug");
    expect(src).toContain("/exchange/");
  });

  it("handles item deep-link via ?item= param", () => {
    expect(src).toContain("itemId");
    expect(src).toContain("item=");
  });

  it("handles promo deep-link via ?promo= param", () => {
    expect(src).toContain("promoSlug");
    expect(src).toContain("promo=");
  });

  it("handles company promo deep-link via ?companyPromo= param", () => {
    expect(src).toContain("companyPromoSlug");
    expect(src).toContain("companyPromo=");
  });

  it("injects twitter:card summary_large_image", () => {
    expect(src).toContain("summary_large_image");
  });

  it("injects JSON-LD structured data", () => {
    expect(src).toContain("application/ld+json");
    expect(src).toContain("WebPage");
  });

  it("has per-category descriptions for all 13 categories", () => {
    const slugs = [
      "business",
      "vehicles",
      "construction",
      "tools",
      "furniture",
      "farm",
      "business-equipment",
      "electronics",
      "sports",
      "collectibles",
      "jewelry",
      "local-food",
      "other",
    ];
    for (const slug of slugs) {
      // Slugs appear as unquoted keys (business:) or quoted keys ("business-equipment":)
      const presentUnquoted = src.includes(`${slug}:`);
      const presentQuoted = src.includes(`"${slug}"`);
      expect(presentUnquoted || presentQuoted).toBe(true);
    }
  });
});

// ─── 2. server/index.ts — exchange routes registered ─────────────────────────

describe("server/index.ts exchange routes", () => {
  const src = readServerFile("index.ts");

  it("imports buildPublicExchangeHtml", () => {
    expect(src).toContain("buildPublicExchangeHtml");
    expect(src).toContain("./publicExchangeHtml");
  });

  it("registers /exchange route", () => {
    expect(src).toContain('"/exchange"');
    expect(src).toContain("buildPublicExchangeHtml");
  });

  it("registers /exchange/:category route", () => {
    expect(src).toContain('"/exchange/:category"');
  });

  it("passes categorySlug from req.params.category", () => {
    expect(src).toContain("req.params.category");
    expect(src).toContain("categorySlug");
  });

  it("falls back to SPA on error instead of 500", () => {
    // Should have a try/catch that falls through to sendFile on error
    const exchangeBlock = src.slice(src.indexOf("Exchange pages: inject correct OG tags"));
    expect(exchangeBlock.slice(0, 2000)).toContain("catch");
    expect(exchangeBlock.slice(0, 2000)).toContain("sendFile");
  });
});

// ─── 3. client/AppRoutes.tsx — 13 per-category routes ────────────────────────

describe("client/AppRoutes.tsx per-category routes", () => {
  const src = readClientFile("AppRoutes.tsx");

  const expectedRoutes = [
    "/exchange/business",
    "/exchange/vehicles",
    "/exchange/construction",
    "/exchange/tools",
    "/exchange/furniture",
    "/exchange/farm",
    "/exchange/business-equipment",
    "/exchange/electronics",
    "/exchange/sports",
    "/exchange/collectibles",
    "/exchange/jewelry",
    "/exchange/local-food",
    "/exchange/other",
  ];

  for (const route of expectedRoutes) {
    it(`registers route ${route}`, () => {
      expect(src).toContain(`"${route}"`);
    });
  }

  it("lazy-imports all 13 category page components", () => {
    const components = [
      "ExchangeCategoryBusiness",
      "ExchangeCategoryVehicles",
      "ExchangeCategoryConstruction",
      "ExchangeCategoryTools",
      "ExchangeCategoryFurniture",
      "ExchangeCategoryFarm",
      "ExchangeCategoryBusinessEquipment",
      "ExchangeCategoryElectronics",
      "ExchangeCategorySports",
      "ExchangeCategoryCollectibles",
      "ExchangeCategoryJewelry",
      "ExchangeCategoryLocalFood",
      "ExchangeCategoryOther",
    ];
    for (const comp of components) {
      expect(src).toContain(comp);
    }
  });

  it("category routes appear before the catch-all /exchange route", () => {
    const vehiclesIdx = src.indexOf('"/exchange/vehicles"');
    const mainIdx = src.indexOf('path="/exchange"');
    expect(vehiclesIdx).toBeGreaterThan(0);
    expect(mainIdx).toBeGreaterThan(vehiclesIdx);
  });
});

// ─── 4. client/exchange.tsx — getCategoryHref routes to dedicated pages ───────

describe("client/exchange.tsx getCategoryHref", () => {
  const src = readClientFile("pages/exchange.tsx");

  it("shares each listing's already-computed canonical detail path", () => {
    const detailPathIndex = src.indexOf(
      "const detailPath = `/exchange/${detailCategory}/${item.id}`"
    );
    expect(detailPathIndex).toBeGreaterThan(-1);
    expect(src.slice(detailPathIndex, detailPathIndex + 8_000)).toContain(
      "shareLink(\n                                      detailPath,"
    );
    expect(src.slice(detailPathIndex, detailPathIndex + 8_000)).not.toContain(
      "`/exchange?item=${encodeURIComponent(item.id)}`"
    );
  });

  it("routes vehicles to /exchange/vehicles", () => {
    const block = src.slice(src.indexOf("getCategoryHref"), src.indexOf("getCategoryHref") + 600);
    expect(block).toContain('"vehicles"');
    expect(block).toContain("/exchange/");
  });

  it("routes construction to /exchange/construction", () => {
    const block = src.slice(src.indexOf("getCategoryHref"), src.indexOf("getCategoryHref") + 600);
    expect(block).toContain('"construction"');
    expect(block).toContain("/exchange/");
  });

  it("routes business to /exchange/business", () => {
    // business slug is in the dedicatedSlugs array
    const block = src.slice(src.indexOf("getCategoryHref"), src.indexOf("getCategoryHref") + 600);
    expect(block).toContain('"business"');
    expect(block).toContain("/exchange/");
  });

  it("still routes real-estate to /homescout-listings", () => {
    expect(src).toContain('"/homescout-listings"');
  });

  it("still routes metals to /exchange/metals", () => {
    expect(src).toContain('"/exchange/metals"');
  });
});

// ─── 5. ExchangeCategoryPage.tsx — core component structure ──────────────────

describe("ExchangeCategoryPage.tsx", () => {
  const src = readClientFile("pages/exchange/ExchangeCategoryPage.tsx");

  it("exports ExchangeCategoryPage", () => {
    expect(src).toContain("export function ExchangeCategoryPage");
  });

  it("has mobile filter sheet (bottom sheet)", () => {
    expect(src).toContain("Sheet");
    expect(src).toContain('side="bottom"');
  });

  it("has desktop sidebar filter panel", () => {
    expect(src).toContain("hidden xl:block");
    expect(src).toContain("xl:sticky");
  });

  it("has search scope toggle (local/state/nationwide)", () => {
    expect(src).toContain("local");
    expect(src).toContain("state");
    expect(src).toContain("nationwide");
  });

  it("has share button for individual items", () => {
    expect(src).toContain("handleShare");
    expect(src).toContain("Share2");
    expect(src).toContain("path: `/exchange/${config.slug}/${encodeURIComponent(item.id)}`");
    expect(src).not.toContain(
      "path: `/exchange/${config.slug}?item=${encodeURIComponent(item.id)}`"
    );
  });

  it("has share button for the category itself", () => {
    expect(src).toContain("handleShareCategory");
  });

  it("uses SEOHelmet with canonical URL", () => {
    expect(src).toContain("SEOHelmet");
    expect(src).toContain("canonical");
    expect(src).toContain("/exchange/");
  });

  it("has inquiry/contact dialog", () => {
    expect(src).toContain("contactItem");
    expect(src).toContain("inquire");
  });

  it("has favorite toggle", () => {
    expect(src).toContain("toggleFavoriteMutation");
    expect(src).toContain("favoriteSet");
  });

  it("has loading skeleton", () => {
    expect(src).toContain("animate-pulse");
  });

  it("has empty state with list action", () => {
    expect(src).toContain("EmptyState");
    expect(src).toContain("List something");
  });
});

// ─── 6. categoryConfigs.tsx — all 13 configs present ─────────────────────────

describe("categoryConfigs.tsx", () => {
  const src = readClientFile("pages/exchange/categoryConfigs.tsx");

  it("exports CATEGORY_CONFIGS", () => {
    expect(src).toContain("export const CATEGORY_CONFIGS");
  });

  const slugs = [
    "business",
    "vehicles",
    "construction",
    "tools",
    "furniture",
    "farm",
    "business-equipment",
    "electronics",
    "sports",
    "collectibles",
    "jewelry",
    "local-food",
    "other",
  ];

  for (const slug of slugs) {
    it(`has config for ${slug}`, () => {
      expect(src).toContain(`"${slug}"`);
    });
  }

  it("each config has extraFilters", () => {
    expect(src).toContain("extraFilters");
  });

  it("each config has priceRanges", () => {
    expect(src).toContain("priceRanges");
  });
});

// ─── 7. Thin wrapper pages — all 13 exist ────────────────────────────────────

describe("per-category thin wrapper pages", () => {
  const pages = [
    "ExchangeBusinessPage",
    "ExchangeVehiclesPage",
    "ExchangeConstructionPage",
    "ExchangeToolsPage",
    "ExchangeFurniturePage",
    "ExchangeFarmPage",
    "ExchangeBusinessEquipmentPage",
    "ExchangeElectronicsPage",
    "ExchangeSportsPage",
    "ExchangeCollectiblesPage",
    "ExchangeJewelryPage",
    "ExchangeLocalFoodPage",
    "ExchangeOtherPage",
  ];

  for (const page of pages) {
    it(`${page}.tsx exists and exports default`, () => {
      const filePath = path.resolve(CLIENT_DIR, `pages/exchange/${page}.tsx`);
      expect(fs.existsSync(filePath)).toBe(true);
      const src = fs.readFileSync(filePath, "utf-8");
      expect(src).toContain(`export default function ${page}`);
      expect(src).toContain("ExchangeCategoryPage");
      expect(src).toContain("CATEGORY_CONFIGS");
    });
  }
});
