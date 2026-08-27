import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildJwStoneMarketplaceLlmsText,
  buildJwStoneMarketplaceSitemapXml,
  buildPublicJwStoneMarketplaceHtml,
  JW_STONE_MARKETPLACE_CANONICAL_URL,
} from "../publicJwStoneMarketplaceHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="generic" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="generic" />
    <meta property="og:url" content="https://www.thetradescout.com/" />
    <meta property="og:image" content="https://www.thetradescout.com/generic.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="generic" />
    <meta name="twitter:image" content="https://www.thetradescout.com/generic.png" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("JW Stone marketplace public HTML", () => {
  it("uses one stable canonical URL and the real JW Stone share image", () => {
    const html = buildPublicJwStoneMarketplaceHtml({ templateHtml });

    expect(JW_STONE_MARKETPLACE_CANONICAL_URL).toBe("https://www.thetradescout.com/jw-stone");
    expect(html).toContain(
      '<link rel="canonical" href="https://www.thetradescout.com/jw-stone" />'
    );
    expect(html).toContain('property="og:url" content="https://www.thetradescout.com/jw-stone"');
    expect(html).toContain(
      "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png"
    );
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
  });

  it("publishes the company identity without bypassing Express contact gating", () => {
    const html = buildPublicJwStoneMarketplaceHtml({ templateHtml });
    const scripts = Array.from(
      html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    );

    expect(scripts).toHaveLength(1);
    const jsonLd = JSON.parse(scripts[0][1]);
    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Natural stone slabs in Pensacola, FL | JW Stone Logistics",
      description:
        "Natural stone slabs in Pensacola, Florida: browse named granite, marble, quartzite, engineered quartz, onyx, soapstone and basalt materials from JW Stone Logistics.",
      url: "https://www.thetradescout.com/jw-stone",
      image: "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png",
      mainEntity: {
        "@type": "Organization",
        name: "JW Stone Logistics",
        description:
          "Founded in 2017 by Jared and Wagner, JW Stone gives customers direct access to hand-selected natural stone, with one expert overseeing the journey from quarry selection through processing and delivery. Based in Pensacola, FL, JW Stone works with fabricators, builders, architects, designers and homeowners across the Gulf South and beyond.",
        url: "https://www.thetradescout.com/jw-stone",
        address: {
          "@type": "PostalAddress",
          streetAddress: "2103 W Herman Ave",
          addressLocality: "Pensacola",
          addressRegion: "FL",
          postalCode: "32505",
          addressCountry: "US",
        },
        sameAs: [
          "https://www.instagram.com/jwstonellc/",
          "https://www.facebook.com/people/JW-Stone-Logistics/100094713955142/",
          "https://www.youtube.com/@JWStoneLogistics",
        ],
      },
    });

    const serialized = JSON.stringify(jsonLd);
    expect(serialized).not.toMatch(/Product|Offer|ItemList|price|priceRange|availability/i);
    expect(serialized).not.toMatch(/Trending Selection|Unnamed slab|First Cut|countryOfOrigin/i);
    expect(serialized).not.toMatch(/telephone|email|contactPoint/i);
    expect(serialized).not.toContain("wagner@jwstonellc.com");
  });

  it("renders useful inventory crawl paths and an Express-gated request path", () => {
    const html = buildPublicJwStoneMarketplaceHtml({ templateHtml });

    expect(html).toContain('data-seo-jw-stone-marketplace="true"');
    expect(html).toContain('data-seo-jw-stone-company="true"');
    expect(html).toContain("Material Library");
    expect(html).toContain("Browse named stone materials");
    expect(html).toContain("/stones/arizona-gold");
    expect(html).toContain("Natural stone slabs in Pensacola, Florida");
    expect(html).toContain("fabricators, builders, architects, designers, and homeowners");
    expect(html).toContain("not a claim of confirmed physical stock");
    expect(html).not.toContain("Browse current selections by photo");
    expect(html).toContain("by material, aesthetic, or color");
    expect(html).toContain("Saving never starts a request");
    expect(html).toContain("About JW Stone");
    expect(html).toContain(
      "Founded in 2017 by Jared and Wagner, JW Stone gives customers direct access to hand-selected natural stone"
    );
    expect(html).toContain("Browse by material");
    expect(html).toContain("/jw-stone/materials/granite");
    expect(html).toContain("request=collection");
    expect(html).toContain("Start a JW Stone request");
    expect(html).toContain("2103 W Herman Ave, Pensacola, FL 32505");
    expect(html).toContain("Instagram: @jwstonellc");
    expect(html).toContain("Facebook: JW Stone Logistics");
    expect(html).toContain("YouTube: @JWStoneLogistics");
    expect(html).not.toContain('<a href="https://www.instagram.com/jwstonellc/"');
    expect(html).not.toContain(
      '<a href="https://www.facebook.com/people/JW-Stone-Logistics/100094713955142/"'
    );
    expect(html).not.toContain('<a href="https://www.youtube.com/@JWStoneLogistics"');
    expect(html).not.toContain("New Arrivals");
    expect(html).not.toContain("Learn about stone");
    expect(html).not.toContain("Call for availability");
    expect(html).not.toContain("Phone: (850) 543-0748");
    expect(html).not.toContain("Email: contact@thetradescout.com");
    expect(html).not.toMatch(/href=["'](?:tel:|mailto:)/i);
    expect(html).not.toContain("wagner@jwstonellc.com");
    expect(html).not.toMatch(/Trending Selection|Unnamed slab|Name not confirmed/i);
  });

  it("keeps company identity and the gated request method in the LLM discovery file", () => {
    const text = buildJwStoneMarketplaceLlmsText("https://jwstonelogistics.com");

    expect(text).toContain("Founded in 2017 by Jared and Wagner");
    expect(text).toContain("Useful customer entry points:");
    expect(text).toContain("- Granite slabs: https://jwstonelogistics.com/materials/granite");
    expect(text).toContain("- Marble slabs: https://jwstonelogistics.com/materials/marble");
    expect(text).toContain("- Quartzite slabs: https://jwstonelogistics.com/materials/quartzite");
    expect(text).toContain("Individual named materials:");
    expect(text).toContain("Named material pages:");
    expect(text).toContain("Arizona Gold");
    expect(text).toContain("https://jwstonelogistics.com/stones/{slug}");
    expect(text).toContain("Address: 2103 W Herman Ave, Pensacola, FL 32505");
    expect(text).toContain("Instagram: @jwstonellc");
    expect(text).toContain("Facebook: JW Stone Logistics");
    expect(text).toContain("YouTube: @JWStoneLogistics");
    expect(text).toContain(
      "Calls and requests are available through Express Direct Connect on the profile."
    );
    expect(text).not.toContain("(850) 543-0748");
    expect(text).not.toContain("contact@thetradescout.com");
    expect(text).not.toContain("wagner@jwstonellc.com");
  });

  it("publishes stone OG metadata for shareable marketplace stone URLs", () => {
    const html = buildPublicJwStoneMarketplaceHtml({
      templateHtml,
      origin: "https://jwstonelogistics.com",
      collectionUrl: "https://jwstonelogistics.com/",
      marketplaceDomainSurface: true,
      stoneSlug: "amazonic-green",
    });

    expect(html).toContain("window.__TS_JW_STONE_MARKETPLACE_SURFACE__=true");
    expect(html).toContain('data-seo-jw-stone-item="amazonic-green"');
    expect(html).toContain(
      'link rel="canonical" href="https://jwstonelogistics.com/stones/amazonic-green"'
    );
    expect(html).toContain(
      'property="og:url" content="https://jwstonelogistics.com/stones/amazonic-green"'
    );
    expect(html).toMatch(/Amazonic Green/);
    expect(html).toContain("Pensacola, Florida");
    expect(html).toContain("Material collection:");
    expect(html).toContain("stones/amazonic-green?request=stone");
    expect(html).toContain("Ask about Amazonic Green");

    const scripts = Array.from(
      html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    );
    const jsonLd = JSON.parse(scripts[0][1]);
    expect(jsonLd.mainEntity).toMatchObject({
      "@type": "Product",
      name: "Amazonic Green",
      brand: { "@type": "Brand", name: "JW Stone Logistics" },
    });
    expect(JSON.stringify(jsonLd)).not.toMatch(/price|availability|telephone|email/i);
  });

  it("keeps platform deep-page schema factual without losing the buyer-facing description", () => {
    const html = buildPublicJwStoneMarketplaceHtml({
      templateHtml,
      stoneSlug: "amazonic-green",
    });

    const scripts = Array.from(
      html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    );
    const jsonLd = JSON.parse(scripts[0][1]);

    expect(html).toContain("Ask whether it is currently available");
    expect(JSON.stringify(jsonLd)).not.toMatch(/price|priceRange|offers|availability|telephone|email/i);
  });

  it("links material collections to named stone pages with ItemList schema", () => {
    const html = buildPublicJwStoneMarketplaceHtml({
      templateHtml,
      origin: "https://jwstonelogistics.com",
      collectionUrl: "https://jwstonelogistics.com/",
      marketplaceDomainSurface: true,
      materialSlug: "granite",
    });

    expect(html).toContain('data-seo-jw-stone-category="granite"');
    expect(html).toContain("Browse Granite selections");
    expect(html).toContain("/stones/blue-dunes");
    expect(html).toContain("Blue Dunes");

    const scripts = Array.from(
      html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    );
    const jsonLd = JSON.parse(scripts[0][1]);
    expect(jsonLd.mainEntity).toMatchObject({
      "@type": "ItemList",
    });
    expect(jsonLd.mainEntity.numberOfItems).toBeGreaterThan(0);
  });

  it("noindexes placeholder selections and omits them from the stone sitemap", () => {
    const html = buildPublicJwStoneMarketplaceHtml({
      templateHtml,
      origin: "https://jwstonelogistics.com",
      collectionUrl: "https://jwstonelogistics.com/",
      marketplaceDomainSurface: true,
      stoneSlug: "trending-selection-01",
    });
    const sitemap = buildJwStoneMarketplaceSitemapXml("https://jwstonelogistics.com");

    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html).not.toContain("Ask about Trending Selection");
    expect(sitemap).toContain("/materials/granite");
    expect(sitemap).toContain("/stones/blue-dunes");
    expect(sitemap).not.toContain("trending-selection");
  });

  it.each([
    ["soapstone", "marina-black-soapstone", "Marina Black"],
    ["carrara-white-brazil", "bianco-carrara", "Bianco Carrara"],
  ])("preserves released stone identity for legacy slug %s", (legacy, canonical, name) => {
    const html = buildPublicJwStoneMarketplaceHtml({
      templateHtml,
      origin: "https://jwstonelogistics.com",
      collectionUrl: "https://jwstonelogistics.com/",
      marketplaceDomainSurface: true,
      stoneSlug: legacy,
    });

    expect(html).toContain(`data-seo-jw-stone-item="${canonical}"`);
    expect(html).toContain(
      `link rel="canonical" href="https://jwstonelogistics.com/stones/${canonical}"`
    );
    expect(html).toContain(name);
  });

  it("routes JW custom-domain feeds through the JW inventory discovery graph", () => {
    const source = read("server/index.ts");

    expect(source).toContain("buildJwStoneMarketplaceSitemapXml");
    expect(source).toContain("buildJwStoneMarketplaceLlmsText");
    expect(source).toContain("slug.trim().toLowerCase() === JW_STONE_PROFILE_SLUG");
  });

  it("registers legacy marketplace aliases after custom-domain authority and before the SPA catch-all", () => {
    const source = read("server/index.ts");
    const customDomainMarker = source.indexOf("const CUSTOM_DOMAIN_CACHE");
    const customDomainMiddleware = source.indexOf(
      "app.use(async (req, res, next) =>",
      customDomainMarker
    );
    const marketplaceRoute = source.indexOf('app.get("/jw-stone"');
    const stoneRoute = source.indexOf('app.get("/jw-stone/stones/:stoneSlug"');
    const catchAllRoute = source.indexOf('app.get("*"');

    expect(customDomainMarker).toBeGreaterThan(-1);
    expect(customDomainMiddleware).toBeGreaterThan(customDomainMarker);
    expect(marketplaceRoute).toBeGreaterThan(customDomainMiddleware);
    expect(stoneRoute).toBeGreaterThan(marketplaceRoute);
    expect(catchAllRoute).toBeGreaterThan(stoneRoute);
    expect(source).toContain("`${origin}/u/${JW_STONE_PROFILE_SLUG}`");
    expect(source).not.toContain("serveJwStoneMarketplaceCustomDomainPath");
  });
});