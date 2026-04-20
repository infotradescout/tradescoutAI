/**
 * exchange-listing-seo.contract.test.ts
 *
 * Contract tests for Phase 4 SEO / crawlability improvements:
 *
 * 1. publicExchangeListingHtml.ts — module exists and exports the builder
 * 2. server/index.ts — /exchange/:category/:listingId route registered before /exchange/:category
 * 3. server/routes/profiles.ts — sitemap-exchange-listings.xml route registered
 * 4. server/routes/profiles.ts — sitemap-index.xml includes sitemap-exchange-listings.xml
 * 5. server/routes/profiles.ts — robots.txt includes Allow: /exchange/
 * 6. server/routes/profiles.ts — CORE_STATIC_PATHS includes all 15 exchange category pages
 * 7. publicExchangeHtml.ts — BreadcrumbList JSON-LD injected for per-category pages
 * 8. client/public/robots.txt — static robots.txt includes Allow: /exchange/
 * 9. client/public/sitemap-index.xml — static sitemap-index.xml includes sitemap-exchange-listings.xml
 * 10. scripts/generate-sitemap.mjs — all 15 exchange category paths included
 * 11. server/storage.ts — IStorage interface declares listActiveExchangeListingsForSitemap
 * 12. server/repositories/sitemapRepository.ts — SitemapRepository has listActiveExchangeListingsForSitemap
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../..");
const SERVER_DIR = path.resolve(ROOT, "server");
const CLIENT_PUBLIC_DIR = path.resolve(ROOT, "client/public");
const SCRIPTS_DIR = path.resolve(ROOT, "scripts");

function readFile(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), "utf-8");
}

function readServerFile(name: string): string {
  return fs.readFileSync(path.resolve(SERVER_DIR, name), "utf-8");
}

// ─── 1. publicExchangeListingHtml.ts ─────────────────────────────────────────

describe("publicExchangeListingHtml.ts", () => {
  const src = readServerFile("publicExchangeListingHtml.ts");

  it("exports buildPublicExchangeListingHtml", () => {
    expect(src).toContain("export async function buildPublicExchangeListingHtml");
  });

  it("accepts categoryParam and listingId options", () => {
    expect(src).toContain("categoryParam");
    expect(src).toContain("listingId");
  });

  it("fetches the listing via storage.getMarketplaceListing", () => {
    expect(src).toContain("storage.getMarketplaceListing");
  });

  it("injects og:url canonical URL", () => {
    expect(src).toContain("og:url");
    expect(src).toContain("canonical");
  });

  it("injects og:image", () => {
    expect(src).toContain("og:image");
  });

  it("injects og:type product", () => {
    expect(src).toContain("og:type");
    expect(src).toContain("product");
  });

  it("injects twitter:card summary_large_image", () => {
    expect(src).toContain("summary_large_image");
  });

  it("emits BreadcrumbList JSON-LD", () => {
    expect(src).toContain("BreadcrumbList");
    expect(src).toContain("ListItem");
  });

  it("emits Car JSON-LD for vehicles category", () => {
    expect(src).toContain('"Car"');
    expect(src).toContain("vehicles");
  });

  it("emits Product JSON-LD for non-vehicle categories", () => {
    expect(src).toContain('"Product"');
  });

  it("emits real-estate JSON-LD schema", () => {
    expect(src).toContain("SingleFamilyResidence");
    expect(src).toContain("real-estate");
  });

  it("falls back to SPA when listing is not found (returns null)", () => {
    expect(src).toContain("return null");
  });

  it("includes Offer with price and priceCurrency", () => {
    expect(src).toContain('"Offer"');
    expect(src).toContain("priceCurrency");
    expect(src).toContain("USD");
  });
});

// ─── 2. server/index.ts — /exchange/:category/:listingId route ────────────────

describe("server/index.ts exchange listing detail route", () => {
  const src = readServerFile("index.ts");

  it("imports buildPublicExchangeListingHtml", () => {
    expect(src).toContain("buildPublicExchangeListingHtml");
    expect(src).toContain("./publicExchangeListingHtml");
  });

  it("registers /exchange/:category/:listingId route", () => {
    expect(src).toContain('"/exchange/:category/:listingId"');
  });

  it("passes categoryParam and listingId to buildPublicExchangeListingHtml", () => {
    const block = src.slice(src.indexOf('"/exchange/:category/:listingId"'));
    expect(block.slice(0, 1500)).toContain("categoryParam");
    expect(block.slice(0, 1500)).toContain("listingId");
    expect(block.slice(0, 1500)).toContain("buildPublicExchangeListingHtml");
  });

  it("/exchange/:category/:listingId is registered BEFORE /exchange/:category", () => {
    const listingDetailIdx = src.indexOf('"/exchange/:category/:listingId"');
    const categoryIdx = src.indexOf('"/exchange/:category"');
    expect(listingDetailIdx).toBeGreaterThan(0);
    expect(categoryIdx).toBeGreaterThan(0);
    expect(listingDetailIdx).toBeLessThan(categoryIdx);
  });

  it("falls back to sendFile on error for listing detail route", () => {
    const block = src.slice(src.indexOf('"/exchange/:category/:listingId"'));
    expect(block.slice(0, 1500)).toContain("catch");
    expect(block.slice(0, 1500)).toContain("sendFile");
  });

  it("sets cache-control header for found listings", () => {
    const block = src.slice(src.indexOf('"/exchange/:category/:listingId"'));
    expect(block.slice(0, 1500)).toContain("Cache-Control");
    expect(block.slice(0, 1500)).toContain("max-age=120");
  });
});

// ─── 3. server/routes/profiles.ts — sitemap-exchange-listings.xml ────────────

describe("server/routes/profiles.ts sitemap-exchange-listings.xml", () => {
  const src = readFile("server/routes/profiles.ts");
  // The route is registered as: router.get("/sitemap-exchange-listings.xml", ...)
  const ROUTE_MARKER = '"/sitemap-exchange-listings.xml"';

  it("registers /sitemap-exchange-listings.xml route", () => {
    expect(src).toContain(ROUTE_MARKER);
  });

  it("calls storage.listActiveExchangeListingsForSitemap", () => {
    expect(src).toContain("listActiveExchangeListingsForSitemap");
  });

  it("uses getExchangeCategorySlugFromMarketplaceCategoryName to resolve slugs", () => {
    expect(src).toContain("getExchangeCategorySlugFromMarketplaceCategoryName");
  });

  it("builds URLs in /exchange/:categorySlug/:id format", () => {
    const routeIdx = src.indexOf(ROUTE_MARKER);
    const block = src.slice(routeIdx);
    expect(block.slice(0, 1500)).toContain("/exchange/");
    expect(block.slice(0, 1500)).toContain("encodeURIComponent");
  });

  it("falls back to sendSitemapFallback on error", () => {
    const routeIdx = src.indexOf(ROUTE_MARKER);
    const block = src.slice(routeIdx);
    expect(block.slice(0, 3000)).toContain("sendSitemapFallback");
  });
});

// ─── 4. server/routes/profiles.ts — sitemap-index.xml includes exchange ──────

describe("server/routes/profiles.ts sitemap-index.xml includes exchange listings", () => {
  const src = readFile("server/routes/profiles.ts");

  it("sitemap-index.xml template includes sitemap-exchange-listings.xml", () => {
    expect(src).toContain("sitemap-exchange-listings.xml");
  });
});

// ─── 5. server/routes/profiles.ts — robots.txt includes Allow: /exchange/ ────

describe("server/routes/profiles.ts robots.txt", () => {
  const src = readFile("server/routes/profiles.ts");

  it("robots.txt handler includes Allow: /exchange/", () => {
    expect(src).toContain("Allow: /exchange/");
  });
});

// ─── 6. CORE_STATIC_PATHS includes all 15 exchange category pages ─────────────

describe("server/routes/profiles.ts CORE_STATIC_PATHS", () => {
  const src = readFile("server/routes/profiles.ts");

  const expectedCategoryPaths = [
    "/exchange/vehicles",
    "/exchange/business",
    "/exchange/real-estate",
    "/exchange/construction",
    "/exchange/tools",
    "/exchange/furniture",
    "/exchange/farm",
    "/exchange/business-equipment",
    "/exchange/electronics",
    "/exchange/sports",
    "/exchange/collectibles",
    "/exchange/jewelry",
    "/exchange/metals",
    "/exchange/local-food",
    "/exchange/other",
  ];

  for (const p of expectedCategoryPaths) {
    it(`CORE_STATIC_PATHS includes ${p}`, () => {
      expect(src).toContain(`"${p}"`);
    });
  }
});

// ─── 7. publicExchangeHtml.ts — BreadcrumbList JSON-LD for category pages ────

describe("publicExchangeHtml.ts BreadcrumbList JSON-LD", () => {
  const src = readServerFile("publicExchangeHtml.ts");

  it("injects BreadcrumbList JSON-LD for per-category pages", () => {
    expect(src).toContain("BreadcrumbList");
  });

  it("BreadcrumbList includes Home, Exchange, and category breadcrumbs", () => {
    const block = src.slice(src.indexOf("BreadcrumbList"));
    expect(block.slice(0, 800)).toContain("Home");
    expect(block.slice(0, 800)).toContain("Exchange");
    expect(block.slice(0, 800)).toContain("/exchange");
  });

  it("only injects BreadcrumbList when categorySlug is present", () => {
    // The condition guard should be present
    expect(src).toContain("EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME");
    expect(src).toContain("if (slug && slug in EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME)");
  });
});

// ─── 8. client/public/robots.txt — static file includes Allow: /exchange/ ────

describe("client/public/robots.txt", () => {
  const src = fs.readFileSync(path.resolve(CLIENT_PUBLIC_DIR, "robots.txt"), "utf-8");

  it("includes Allow: /exchange/", () => {
    expect(src).toContain("Allow: /exchange/");
  });
});

// ─── 9. client/public/sitemap-index.xml — includes sitemap-exchange-listings ─

describe("client/public/sitemap-index.xml", () => {
  const src = fs.readFileSync(path.resolve(CLIENT_PUBLIC_DIR, "sitemap-index.xml"), "utf-8");

  it("includes sitemap-exchange-listings.xml", () => {
    expect(src).toContain("sitemap-exchange-listings.xml");
  });
});

// ─── 10. scripts/generate-sitemap.mjs — all 15 exchange category paths ────────

describe("scripts/generate-sitemap.mjs", () => {
  const src = fs.readFileSync(path.resolve(SCRIPTS_DIR, "generate-sitemap.mjs"), "utf-8");

  const expectedPaths = [
    "/exchange/vehicles",
    "/exchange/business",
    "/exchange/real-estate",
    "/exchange/construction",
    "/exchange/tools",
    "/exchange/furniture",
    "/exchange/farm",
    "/exchange/business-equipment",
    "/exchange/electronics",
    "/exchange/sports",
    "/exchange/collectibles",
    "/exchange/jewelry",
    "/exchange/metals",
    "/exchange/local-food",
    "/exchange/other",
  ];

  for (const p of expectedPaths) {
    it(`STATIC_PUBLIC_ROUTES includes ${p}`, () => {
      expect(src).toContain(`'${p}'`);
    });
  }
});

// ─── 11. server/storage.ts — IStorage interface ───────────────────────────────

describe("server/storage.ts IStorage interface", () => {
  const src = readServerFile("storage.ts");

  it("declares listActiveExchangeListingsForSitemap in IStorage", () => {
    expect(src).toContain("listActiveExchangeListingsForSitemap");
  });

  it("returns Array<{ id: string; categoryName: string; updatedAt: Date | null }>", () => {
    expect(src).toContain("categoryName: string");
  });
});

// ─── 12. sitemapRepository.ts — has listActiveExchangeListingsForSitemap ──────

describe("server/repositories/sitemapRepository.ts", () => {
  const src = readFile("server/repositories/sitemapRepository.ts");

  it("imports marketplaceListings from @shared/schema", () => {
    expect(src).toContain("marketplaceListings");
  });

  it("imports marketplaceCategories from @shared/schema", () => {
    expect(src).toContain("marketplaceCategories");
  });

  it("has listActiveExchangeListingsForSitemap method", () => {
    expect(src).toContain("listActiveExchangeListingsForSitemap");
  });

  it("joins marketplaceCategories to resolve category name", () => {
    const block = src.slice(src.indexOf("listActiveExchangeListingsForSitemap"));
    expect(block.slice(0, 1000)).toContain("leftJoin");
    expect(block.slice(0, 1000)).toContain("marketplaceCategories");
  });

  it("filters by status active", () => {
    const block = src.slice(src.indexOf("listActiveExchangeListingsForSitemap"));
    expect(block.slice(0, 1000)).toContain("active");
  });
});
