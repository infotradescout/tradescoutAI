import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicProfileCatalogExchangeItem: vi.fn(),
  getMarketplaceListing: vi.fn(),
  toPublicExchangeListing: vi.fn(),
  hasExposureAuthority: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../profileCatalogExchange", () => ({
  getPublicProfileCatalogExchangeItem: mocks.getPublicProfileCatalogExchangeItem,
}));
vi.mock("../storage", () => ({ storage: { getMarketplaceListing: mocks.getMarketplaceListing } }));
vi.mock("../publicExchangeListing", () => ({
  toPublicExchangeListing: mocks.toPublicExchangeListing,
}));
vi.mock("../services/exposureAuthority", () => ({
  hasExposureAuthority: mocks.hasExposureAuthority,
}));
vi.mock("../db", () => ({ pool: { query: mocks.query } }));

import {
  buildExchangeOfferJsonLd,
  buildProductJsonLd,
  buildPublicExchangeListingHtml,
} from "../publicExchangeListingHtml";
import { stoneAudience, withStoneDiscovery, type StoneMarket } from "../services/exchangeStoneDiscovery";

const origin = "https://www.thetradescout.com";
const listingUrl = `${origin}/exchange/building-materials/tradescout-stone-aj-quartz`;
const templateHtml =
  "<!doctype html><html><head><title>TradeScout</title><meta name=\"robots\" content=\"index, follow\"><link rel=\"canonical\" href=\"https://www.thetradescout.com/\"></head><body><div id=\"root\"></div></body></html>";

function buildStoneHtml(referenceSizesInches: string | null, market: StoneMarket = { state: "TX", country: "US" }) {
  mocks.getMarketplaceListing.mockResolvedValue(stone(referenceSizesInches));
  return withStoneDiscovery({
    audience: stoneAudience(market),
    items: [],
    query: {},
    feed: false,
    publicationReady: true,
  }, () => buildPublicExchangeListingHtml({
    origin,
    templateHtml,
    categoryParam: "building-materials",
    listingId: "tradescout-stone-aj-quartz",
  }));
}

const stone = (referenceSizesInches: string | null) => ({
  id: "tradescout-stone-aj-quartz",
  sellerId: "tradescout-seller",
  sourceType: "marketplace_listing",
  category: "building-materials",
  title: "AJ Quartz | TradeScout",
  description: "AJ Quartz stone material; confirm the selected slab and delivery with TradeScout.",
  price: 30,
  currency: "USD",
  images: ["/api/exchange/stone-media/tradescout-stone-aj-quartz"],
  availability: "confirm_before_purchase",
  specifications: {
    commerceChannel: "tradescout_stone_retail",
    priceUnit: "sqft",
    referenceSizesInches,
  },
});

function productJsonLd(html: string): Record<string, any> {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)];
  const product = scripts.map((script) => JSON.parse(script[1])).find((value) => value["@type"] === "Product");
  if (!product) throw new Error("Expected public Product JSON-LD");
  return product;
}

describe("public retail stone detail price truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicProfileCatalogExchangeItem.mockResolvedValue(null);
    mocks.hasExposureAuthority.mockResolvedValue(true);
    mocks.toPublicExchangeListing.mockImplementation((value) => value);
  });

  it("leads crawler content with the full-slab estimate and labels the square-foot rate", async () => {
    const html = await buildStoneHtml("120x80");
    if (!html) throw new Error("Expected public stone HTML");

    expect(html).toContain("<title>$2,000.00 estimated full slab — AJ Quartz | TradeScout</title>");
    expect(html).toContain("Estimated full slab material price: $2,000.00; material rate $30.00 / sq ft.");
    expect(html).toContain("<p>Estimated full slab material price</p><p><strong>$2,000.00</strong></p><p>Material rate: $30.00 / sq ft</p>");
    expect(html).not.toContain("<p>$30</p>");
    const product = productJsonLd(html);
    expect(product.description).toContain("Estimated full slab material price: $2,000.00; material rate $30.00 / sq ft.");
    expect(product).not.toHaveProperty("offers");
    expect(product.url).toBe(`${listingUrl}?audienceState=TX&audienceCountry=US`);
    expect(product.image).toBe(`${origin}/api/exchange/stone-media/tradescout-stone-aj-quartz?audienceState=TX&audienceCountry=US`);
    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html).not.toMatch(/<link\s+rel="canonical"/i);
    expect(html).toContain(`property="og:url" content="${listingUrl}?audienceState=TX&amp;audienceCountry=US"`);
    expect(html).toContain(`property="og:image" content="${origin}/api/exchange/stone-media/tradescout-stone-aj-quartz?audienceState=TX&amp;audienceCountry=US"`);
    expect(html).toContain(`src="${origin}/api/exchange/stone-media/tradescout-stone-aj-quartz?audienceState=TX&amp;audienceCountry=US"`);
    const breadcrumb = [...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)]
      .map((script) => JSON.parse(script[1]))
      .find((value) => value["@type"] === "BreadcrumbList");
    expect(breadcrumb.itemListElement.at(-1).item).toBe(product.url);
    expect(buildExchangeOfferJsonLd(stone("120x80"), listingUrl)).toBeNull();
  });

  it("says slab price TBD for missing dimensions and never marks the rate as a slab Offer", async () => {
    const html = await buildStoneHtml(null);
    if (!html) throw new Error("Expected public stone HTML");

    expect(html).toContain("<title>Slab price TBD — AJ Quartz | TradeScout</title>");
    expect(html).toContain("Slab price TBD. Published material rate: $30.00 / sq ft.");
    expect(html).toContain("<p><strong>Slab price TBD</strong></p><p>Published material rate: $30.00 / sq ft</p>");
    expect(html).not.toContain('"price":"30.00"');
    const product = productJsonLd(html);
    expect(product.description).toContain("Slab price TBD. Published material rate: $30.00 / sq ft.");
    expect(product).not.toHaveProperty("offers");
  });

  it("keeps the entire recorded slab range ahead of the rate", async () => {
    const html = await buildStoneHtml("120x80,126x78");
    if (!html) throw new Error("Expected public stone HTML");

    expect(html).toContain("Estimated full slab material price: $2,000.00–$2,047.50; material rate $30.00 / sq ft.");
    expect(html).toContain("<strong>$2,000.00–$2,047.50</strong>");
    expect(productJsonLd(html)).not.toHaveProperty("offers");
  });

  it("keeps Florida city in valid public links and denies unknown or excluded markets", async () => {
    const tampa = await buildStoneHtml("120x80", { city: "Tampa", state: "FL", country: "US" });
    expect(tampa).toContain(`${listingUrl}?audienceState=FL&amp;audienceCity=Tampa&amp;audienceCountry=US`);
    expect(tampa).not.toMatch(/<link\s+rel="canonical"/i);
    expect(await buildStoneHtml("120x80", { state: "FL", country: "US" })).toBeNull();
    expect(await buildStoneHtml("120x80", { city: "Pensacola", state: "FL", country: "US" })).toBeNull();
    expect(await buildStoneHtml("120x80", { state: "TX", country: "CA" })).toBeNull();
  });

  it("keeps a real non-stone fixed-price Offer", () => {
    const product = buildProductJsonLd(
      { id: "pump-1", title: "Pump", description: "Water pump", price: 425 },
      origin,
      `${origin}/exchange/tools/pump-1`,
      `${origin}/pump.jpg`
    );
    expect(product?.offers?.price).toBe("425.00");
  });
});
