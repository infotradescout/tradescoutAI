import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME } from "../../shared/exchangeListingRules";
import { renderPublicExchangeListing, renderPublicExchangeDirectory, publicExchangeItemSchema, publicExchangePrice, exchangeSitemapXml, exchangeSitemapIndexXml, exchangeListingMarkdown } from "../publicExchangeDiscoveryHtml";
import type { PublicExchangeRecord } from "../services/exchangePublicDiscovery";
import { stonePublicReferenceSizes } from "../../shared/exchangeStonePublicReference";
import { stoneInquiryMessage } from "../../shared/exchangeStoneBuyerFlow";
vi.mock("../services/exchangePublicDiscovery", () => ({
  readPublicExchangeListing: vi.fn(), readPublicExchangePage: vi.fn(), readPublicExchangeIndex: vi.fn(), PUBLIC_EXCHANGE_SITEMAP_PAGE_SIZE: 1000,
  isPublicDiscoveryCategory: (value: string) => ["tools", "furniture", "building-materials", "vehicles", "electronics"].includes(value),
}));
vi.mock("../services/exchangeStoneCatalogReader", () => ({ readExchangeStoneCatalog: vi.fn(), readExchangeStonePhoto: vi.fn() }));
vi.mock("../utils/publicOrigin", () => ({ resolveMappedProfileShareSlug: () => null }));
vi.mock("../services/logger", () => ({ logger: { error: vi.fn() } }));
import { registerExchangePublicDiscoveryRoutes } from "../routes/exchange-public-discovery";
const template = '<!doctype html><html><head><title>Shell</title><meta name="robots" content="noindex"><link rel="canonical" href="https://example.invalid/"></head><body><div class="app-root" id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';
function listing(category = "tools", seller = "ordinary-seller"): PublicExchangeRecord {
  return { id: `${seller}-${category}`, title: `${category} listing from ${seller}`, sellerId: seller, sellerName: seller,
    category, description: "Published seller description with actual listing details.", price: 125.5, currency: "USD", condition: "good", images: ["/images/public-item.webp"],
    publicDetailPath: `/exchange/${category}/${seller}-${category}`, sourceType: "marketplace_listing", status: "active", isLocalPickupOnly: true };
}
describe("Shared public Exchange discovery", () => {
  it("uses the approved Honey reference consistently in public totals, facts and inquiry draft", () => {
    const item = { ...listing("building-materials"), id: "tradescout-stone-honey-onyx", title: "Honey Onyx", price: 47.25,
      specifications: { commerceChannel: "tradescout_stone_retail", priceUnit: "sqft" } };
    expect(stonePublicReferenceSizes(item)).toBe("121x65");
    const html = renderPublicExchangeListing(template, item);
    expect(html).toContain("$2,580.70"); expect(html).toContain("121x65");
    expect(stoneInquiryMessage(item, "availability")).toContain("$2,580.70");
    expect(publicExchangeItemSchema(item)).not.toHaveProperty("offers");
    const { price: _omittedPrice, ...unpriced } = item;
    expect(stonePublicReferenceSizes(unpriced)).toBeUndefined();
    expect(stonePublicReferenceSizes({ ...item, specifications: { ...item.specifications, referenceSizesInches: "100x60" } })).toBe("100x60");
    for (const other of [{ ...item, price: 40 }, { ...item, id: "tradescout-stone-other" }, { ...item, specifications: { ...item.specifications, commerceChannel: "private" } }, { ...item, specifications: { ...item.specifications, priceUnit: "slab" } }]) expect(stonePublicReferenceSizes(other)).toBeUndefined();
  });
  for (const category of Object.keys(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME)) {
    for (const seller of ["individual-free", "business-premium"]) it(`${category}: ${seller} gets the same indexable entity HTML`, () => {
      const item = listing(category, seller); const html = renderPublicExchangeListing(template, item);
      expect(html).toContain(`<h1>${item.title}</h1>`); expect(html).toContain(item.description); expect(html).toContain("$125.50");
      expect(html).toContain(`href="https://www.thetradescout.com${item.publicDetailPath}"`); expect(html).not.toContain("noindex");
      expect(html).toContain('class="app-root" id="root"'); expect(html).toContain('/assets/app.js'); expect(html).toContain("Local pickup only");
      expect(html).toContain('application/ld+json'); expect(html).toContain('/exchange/llms.txt');
    });
  }
  it("keeps retail reference totals distinct from a fixed slab Offer and exposes purchase details", () => {
    // Synthetic dimensions prove presentation arithmetic, not actual Honey Onyx inventory.
    const item = { ...listing("building-materials"), id: "tradescout-stone-honey-onyx",
      title: "Honey Onyx | TradeScout", price: 47.25, sellerName: "TradeScout", isLocalPickupOnly: false,
      publicDetailPath: "/exchange/building-materials/tradescout-stone-honey-onyx",
      specifications: { commerceChannel: "tradescout_stone_retail", priceUnit: "sqft", material: "Onyx", referenceSizesInches: "120x72" } };
    const html = renderPublicExchangeListing(template, item);
    expect(html).toContain("Estimated full slab material price: $2,835.00");
    expect(html).toContain("$47.25 / sq ft");
    expect(html).toContain("120x72");
    expect(html).toContain("Listed by TradeScout");
    expect(html).toContain("Delivery, fabrication and installation are separate.");
    expect(html).toContain("Confirm the selected slab and available quantity before purchase");
    expect(html).toContain('href="/exchange/building-materials/tradescout-stone-honey-onyx?inquiry=availability"');
    expect(publicExchangeItemSchema(item)).not.toHaveProperty("offers");
    expect(html).not.toContain("InStock");
    expect(html).not.toContain("noindex");
  });
  it("does not invent an InStock assertion from an active listing", () => {
    expect((publicExchangeItemSchema(listing()).offers as any).availability).toBeUndefined();
    expect((publicExchangeItemSchema({ ...listing(), inStock: false }).offers as any).availability).toBe("https://schema.org/OutOfStock");
  });
  it("distinguishes free items from unavailable or request-only prices", () => {
    expect(publicExchangePrice({ ...listing(), price: 0 }).primary).toBe("Free");
    expect(publicExchangePrice({ ...listing(), price: null }).primary).toBe("Request a price");
    expect(publicExchangePrice({ ...listing(), price: 0, pricingMode: "request_quote" }).primary).toBe("Request a price");
  });
  it("never renders raw contact or private cost specification fields", () => {
    const item = { ...listing(), specifications: { supplierCost: "SECRET-COST", password: "SECRET-PASS", phone: "SECRET-CONTACT", internalNotes: "SECRET-NOTES" } };
    expect(renderPublicExchangeListing(template, item)).not.toMatch(/SECRET-/);
  });
  it("escapes seller-controlled text in both visible HTML and structured data", () => {
    const html = renderPublicExchangeListing(template, { ...listing(), title: 'Knife <img src=x onerror=alert(1)>', description: '</script><script>alert("x")</script>' });
    expect(html).not.toContain('<img src=x onerror=alert(1)>'); expect(html).not.toContain('<script>alert("x")</script>');
  });
  it("requires an actual empty app root rather than reporting an unrendered shell as success", () => {
    expect(() => renderPublicExchangeListing(template.replace('<div class="app-root" id="root"></div>', ''), listing())).toThrow();
  });
  it("directory pagination supplies native links and its own canonical URL", () => {
    const html = renderPublicExchangeDirectory(template, { items: [listing()], page: 2, pageSize: 24, total: 61 });
    expect(html).toContain('href="https://www.thetradescout.com/exchange?page=2"'); expect(html).toContain('rel="prev" href="/exchange"'); expect(html).toContain('rel="next" href="/exchange?page=3"');
    expect(html).toContain(listing().publicDetailPath);
  });
  it("sitemap and text index retain canonical listing URLs and do not fabricate lastmod", () => {
    const item = { ...listing(), updatedAt: null };
    expect(exchangeSitemapXml([item])).not.toContain("<lastmod>");
    expect(exchangeSitemapXml([item])).toContain(item.publicDetailPath);
    expect(exchangeSitemapIndexXml(6)).toContain("?page=6");
    expect(exchangeListingMarkdown({ items: [item], page: 1, pageSize: 1000, total: 5001 })).toContain('/exchange/llms.txt?page=2');
  });
});
function appFor(overrides: Record<string, unknown> = {}) {
  const app = express();
  registerExchangePublicDiscoveryRoutes(app, {
    listing: async id => id === listing().id ? listing() : null,
    page: async (page, pageSize = 24) => ({ items: [listing()], page, pageSize, total: 49 }),
    index: async (page, pageSize = 1000) => ({ items: [{ ...listing(), updatedAt: null }], page, pageSize, total: 5001 }),
    template: () => template, media: async () => null, ...overrides,
  } as any);
  app.get('/robots.txt', (_req, res) => res.type('text').send('User-agent: *\nAllow: /exchange/\nDisallow: /admin/\nDisallow: /api/\n'));
  app.get('/llms.txt', (_req, res) => res.type('text').send('# TradeScout\nExisting public content\n'));
  return app;
}
describe("Native Express public route behavior", () => {
  it("is identical for browser and AI fetch agents without an account or selected location", async () => {
    const app = appFor();
    const a = await request(app).get(listing().publicDetailPath).set('Host', 'www.thetradescout.com').set('User-Agent', 'Mozilla/5.0');
    const b = await request(app).get(listing().publicDetailPath).set('Host', 'www.thetradescout.com').set('User-Agent', 'OAI-SearchBot');
    expect(a.status).toBe(200); expect(b.status).toBe(200); expect(a.text).toBe(b.text); expect(a.headers['x-robots-tag']).toContain('index, follow');
  });
  it("does not change custom-domain routing or publish an unknown item", async () => {
    expect((await request(appFor()).get(listing().publicDetailPath).set('Host','supplier.example')).status).toBe(404);
    const missing = await request(appFor()).get('/exchange/tools/unknown').set('Host','www.thetradescout.com');
    expect(missing.status).toBe(404); expect(missing.headers['x-robots-tag']).toContain('noindex');
  });
  it("canonicalizes a wrong category instead of creating duplicate listing addresses", async () => {
    const r = await request(appFor()).get(`/exchange/furniture/${listing().id}`).set('Host','www.thetradescout.com');
    expect(r.status).toBe(301); expect(r.headers.location).toBe(listing().publicDetailPath);
  });
  it("returns an unavailable response rather than an empty success or fake removal on reader failure", async () => {
    const r = await request(appFor({ listing: async () => { throw new Error('synthetic outage'); } })).get(listing().publicDetailPath).set('Host','www.thetradescout.com');
    expect(r.status).toBe(503); expect(r.headers['x-robots-tag']).toContain('noindex'); expect(r.headers['retry-after']).toBe('60');
  });
  it("advertises complete sitemap partitions without replacing existing robots or LLM information", async () => {
    const app = appFor();
    const robots = await request(app).get('/robots.txt').set('Host','www.thetradescout.com');
    expect(robots.text).toContain('Disallow: /admin/'); expect(robots.text).toContain('/exchange-sitemap-index.xml'); expect(robots.text).toContain('Allow: /api/exchange/public-listings/'); expect(robots.text).toContain('Disallow: /api/');
    const llms = await request(app).get('/llms.txt').set('Host','www.thetradescout.com');
    expect(llms.text).toContain('Existing public content'); expect(llms.text).toContain('/exchange/llms.txt');
    const index = await request(app).get('/exchange-sitemap-index.xml').set('Host','www.thetradescout.com');
    expect(index.text).toContain('?page=6');
    const page = await request(app).get('/sitemap-exchange-listings.xml?page=6').set('Host','www.thetradescout.com');
    expect(page.status).toBe(200); expect(page.text).toContain('<urlset');
  });
});
