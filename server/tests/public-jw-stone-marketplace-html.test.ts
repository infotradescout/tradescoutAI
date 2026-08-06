import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
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

  it("publishes collection metadata without product, offer, inventory-list, or price entities", () => {
    const html = buildPublicJwStoneMarketplaceHtml({ templateHtml });
    const scripts = Array.from(
      html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    );

    expect(scripts).toHaveLength(1);
    const jsonLd = JSON.parse(scripts[0][1]);
    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "JW Stone | Stone Discovery",
      description:
        "Browse JW Stone's stone collection, open full photo galleries, save selections, and ask about a material when you are ready.",
      url: "https://www.thetradescout.com/jw-stone",
      image: "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png",
    });

    const serialized = JSON.stringify(jsonLd);
    expect(serialized).not.toMatch(/Product|Offer|ItemList|price|priceRange|availability/i);
    expect(serialized).not.toMatch(/Trending Selection|Unnamed slab|First Cut|countryOfOrigin/i);
  });

  it("renders a safe crawler summary without exposing invented contact claims", () => {
    const html = buildPublicJwStoneMarketplaceHtml({ templateHtml });

    expect(html).toContain('data-seo-jw-stone-marketplace="true"');
    expect(html).toContain("Current Inventory");
    expect(html).toContain("Filter by aesthetic or color");
    expect(html).toContain("Saving never starts a request");
    expect(html).not.toContain("New Arrivals");
    expect(html).not.toContain("Learn about stone");
    expect(html).not.toContain("Call for availability");
    expect(html).not.toMatch(/Trending Selection|Unnamed slab|Name not confirmed/i);
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
  });

  it("registers marketplace routes after custom-domain authority and before the SPA catch-all", () => {
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

    expect(source).toContain("serveJwStoneMarketplaceCustomDomainPath");
    expect(source).toContain("buildPublicJwStoneMarketplaceHtml");
    expect(source).toContain("jwstonelogistics.com");
  });
});
