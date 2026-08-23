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
import {
  buildExchangeOfferJsonLd,
  buildProductJsonLd,
  resolvePersistedExchangeCategorySlug,
} from "../publicExchangeListingHtml";
import { toPublicExchangeListing } from "../publicExchangeListing";

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

  it("loads profile offer item detail pages for Exchange SEO", () => {
    expect(src).toContain("profile-offer-");
    expect(src).toContain("getProfileOfferExchangeListing");
    expect(src).toContain("profile_offers");
    expect(src).toContain("offer_type = 'item'");
  });

  it("carries profile offer product metadata into Product JSON-LD", () => {
    expect(src).toContain("additionalProperty");
    expect(src).toContain("Item category");
    expect(src).toContain("Tax category");
    expect(src).toContain("Fulfillment policy");
    expect(src).toContain("Return policy");
  });

  it("includes Offer with price and priceCurrency", () => {
    expect(src).toContain('"Offer"');
    expect(src).toContain("priceCurrency");
    expect(src).toContain("USD");
  });

  it("uses the listing's real commerce data in Product and Offer JSON-LD", () => {
    const listingUrl = "https://tradescout.com/exchange/tools/pump-7";
    const listing = toPublicExchangeListing({
      id: "pump-7",
      sellerId: "seller-9",
      status: "active",
      title: "Transfer pump",
      description: "Commercial transfer pump with hose kit.",
      price: 425,
      currency: "CAD",
      itemSku: "PUMP-7-CAD",
      itemStockQuantity: 0,
      condition: "new",
      businessName: "North Ridge Pump Supply",
      willShip: true,
      shippingCost: 31.25,
      shippingQuote: {
        destinationCountry: "CA",
        estimatedDaysMin: 2,
        estimatedDaysMax: 5,
        buyerPays: true,
      },
    });
    expect(listing).not.toBeNull();
    const product = buildProductJsonLd(
      listing,
      "https://tradescout.com",
      listingUrl,
      "https://tradescout.com/pump.jpg"
    );
    if (!product) throw new Error("Expected Product JSON-LD for a listing with a real image");

    expect(product.sku).toBe("PUMP-7-CAD");
    expect(product.offers).toMatchObject({
      "@type": "Offer",
      price: "425.00",
      priceCurrency: "CAD",
      availability: "https://schema.org/OutOfStock",
      url: listingUrl,
      seller: {
        "@type": "Organization",
        name: "North Ridge Pump Supply",
      },
      availableDeliveryMethod: "https://schema.org/ParcelService",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "31.25",
          currency: "CAD",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 2,
            maxValue: 5,
            unitCode: "DAY",
          },
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "CA",
        },
      },
    });
  });

  it("derives schema and canonical category from persisted data, never the request path", () => {
    expect(
      resolvePersistedExchangeCategorySlug(
        { specifications: { itemCategory: "Tools & Hardware" } },
        undefined
      )
    ).toBe("tools");
    expect(resolvePersistedExchangeCategorySlug({ categoryId: "category-1" }, "Vehicles")).toBe(
      "vehicles"
    );
    expect(src).not.toContain('categoryParam === "vehicles"');
    expect(src).not.toContain('categoryParam === "real-estate"');
  });

  it("withholds merchant Product markup when the listing has no real item image", () => {
    expect(
      buildProductJsonLd(
        { title: "No-photo tool", price: 80 },
        "https://www.thetradescout.com",
        "https://www.thetradescout.com/exchange/tools/no-photo",
        null
      )
    ).toBeNull();
  });

  it("withholds incomplete merchant shipping markup while retaining the real delivery method", () => {
    const offer = buildExchangeOfferJsonLd(
      {
        title: "Transfer pump",
        price: 425,
        currency: "CAD",
        willShip: true,
        shippingCost: 31.25,
        shippingQuote: { estimatedDaysMin: 2, estimatedDaysMax: 5 },
      },
      "https://tradescout.com/exchange/tools/pump-7"
    );

    expect(offer).toMatchObject({
      availableDeliveryMethod: "https://schema.org/ParcelService",
    });
    expect(offer).not.toHaveProperty("shippingDetails");
  });

  it("normalizes reversed delivery estimates before publishing merchant markup", () => {
    const offer = buildExchangeOfferJsonLd(
      {
        title: "Transfer pump",
        price: 425,
        willShip: true,
        shippingCost: 20,
        shippingQuote: {
          destinationCountry: "US",
          estimatedDaysMin: 7,
          estimatedDaysMax: 3,
        },
      },
      "https://www.thetradescout.com/exchange/tools/pump-7"
    );

    expect(offer?.shippingDetails?.deliveryTime?.transitTime).toMatchObject({
      minValue: 3,
      maxValue: 7,
    });
  });

  it("keeps active-listing fallbacks without fabricating a seller or shipping promise", () => {
    const offer = buildExchangeOfferJsonLd(
      { title: "Legacy active listing", price: 80 },
      "https://tradescout.com/exchange/other/legacy-1"
    );

    expect(offer).toMatchObject({
      price: "80.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    });
    expect(offer).not.toHaveProperty("seller");
    expect(offer).not.toHaveProperty("shippingDetails");
    expect(offer).not.toHaveProperty("availableDeliveryMethod");
  });

  it("carries profile-offer commerce fields into the Exchange listing mapper", () => {
    expect(src).toContain("currency: offer.currency");
    expect(src).toContain("itemSku: offer.itemSku");
    expect(src).toContain("itemStockQuantity: offer.itemStockQuantity");
    expect(src).toContain('offer.fulfillmentMode === "shipping"');
    expect(src).not.toContain("u.active_business_id");
    expect(src).not.toContain("row.business_name");
  });

  it("injects a crawlable listing summary for non-JavaScript consumers", () => {
    expect(src).toContain('data-seo-exchange-listing="true"');
    expect(src).toContain("Continue through TradeScout to review the listing");
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

  it("returns terminal non-indexable responses instead of a soft-404 SPA", () => {
    const block = src.slice(src.indexOf('"/exchange/:category/:listingId"'));
    const route = block.slice(0, 1700);
    expect(route).toContain("sendPublicPageNotFound");
    expect(route).toContain("sendPublicPageRenderFailure");
    expect(route).not.toContain("sendFile");
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

  it("includes active profile item offers in the Exchange listing sitemap", () => {
    expect(src).toContain("profile_offers");
    expect(src).toContain("profile-offer-");
    expect(src).toContain("offer_type = 'item'");
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
    expect(block).toContain("sendSitemapFallback");
  });
});

// ─── 4. server/routes/profiles.ts — governed index omits unproven Exchange ──

describe("server/routes/profiles.ts governed sitemap index", () => {
  const src = readFile("server/routes/profiles.ts");

  it("does not advertise the Exchange feed until every emitted listing has renderer parity", () => {
    const rootIndex = src.slice(
      src.indexOf('router.get("/sitemap.xml"'),
      src.indexOf('router.get("/sitemap-core.xml"')
    );
    expect(rootIndex).not.toContain("sitemap-exchange-listings.xml");
  });
});

// ─── 5. server/routes/profiles.ts — robots.txt includes Allow: /exchange/ ────

describe("server/routes/profiles.ts robots.txt", () => {
  const src = readFile("server/routes/profiles.ts");

  it("robots.txt handler includes Allow: /exchange/", () => {
    expect(src).toContain("Allow: /exchange/");
  });
});

// ─── 6. CORE_STATIC_PATHS excludes SPA-shell Exchange categories ─────────────

describe("server/routes/profiles.ts CORE_STATIC_PATHS", () => {
  const src = readFile("server/routes/profiles.ts");
  const coreStaticPaths = src.slice(
    src.indexOf("const CORE_STATIC_PATHS"),
    src.indexOf("const COUNTY_SLUG_PATTERN")
  );

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
    it(`CORE_STATIC_PATHS omits ${p}`, () => {
      expect(coreStaticPaths).not.toContain(`"${p}"`);
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

// ─── 9. client/public/sitemap-index.xml — omits Exchange until parity ────────

describe("client/public/sitemap-index.xml", () => {
  const src = fs.readFileSync(path.resolve(CLIENT_PUBLIC_DIR, "sitemap-index.xml"), "utf-8");

  it("does not advertise sitemap-exchange-listings.xml", () => {
    expect(src).not.toContain("sitemap-exchange-listings.xml");
  });
});

// ─── 10. scripts/generate-sitemap.mjs — omits SPA-shell Exchange paths ───────

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
    it(`STATIC_PUBLIC_ROUTES omits ${p}`, () => {
      expect(src).not.toContain(`'${p}'`);
    });
  }
});

// ─── 11. server/storage.ts — IStorage interface ───────────────────────────────

describe("server/storage.ts IStorage interface", () => {
  const src = readServerFile("storage.ts");

  it("declares listActiveExchangeListingsForSitemap in IStorage", () => {
    expect(src).toContain("listActiveExchangeListingsForSitemap");
  });

  it("returns seller identity with each sitemap listing for exposure gating", () => {
    expect(src).toContain("sellerUserId: string");
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
