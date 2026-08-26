import { describe, expect, it } from "vitest";
import {
  buildJwStoneMarketplaceLlmsText,
  buildPublicJwStoneMarketplaceHtml,
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

function buildCustomDomainHtml(options: { stoneSlug?: string; materialSlug?: string } = {}) {
  return buildPublicJwStoneMarketplaceHtml({
    templateHtml,
    origin: "https://jwstonelogistics.com",
    collectionUrl: "https://jwstonelogistics.com/",
    marketplaceDomainSurface: true,
    ...options,
  });
}

function readJsonLd(html: string) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match?.[1]) throw new Error("Expected JSON-LD");
  return JSON.parse(match[1]);
}

describe("JW Stone custom-domain discovery authority", () => {
  it("targets Pensacola natural-stone intent and reconciles the business identity", () => {
    const html = buildCustomDomainHtml();
    const jsonLd = readJsonLd(html);

    expect(html).toContain(
      "<title>Natural Stone Slabs in Pensacola, FL | JW Stone Logistics</title>"
    );
    expect(html).toContain(
      'meta property="og:site_name" content="JW Stone Logistics"'
    );
    expect(html).toContain(
      "Natural stone slabs in Pensacola, selected at the source."
    );
    expect(html).toContain(
      "Granite, marble, quartzite and specialty slabs for the Gulf Coast"
    );

    expect(jsonLd.mainEntity).toMatchObject({
      "@type": "Store",
      name: "JW Stone Logistics",
      alternateName: ["JW Stone", "JW Stone LLC"],
      foundingDate: "2017",
      address: {
        addressLocality: "Pensacola",
        addressRegion: "FL",
      },
    });
    expect(jsonLd.mainEntity.sameAs).toContain("https://jwstonellc.com/");
    expect(JSON.stringify(jsonLd)).not.toMatch(/telephone|email|contactPoint|price|availability/i);
  });

  it("gives stone pages local buyer-intent titles without claiming availability", () => {
    const html = buildCustomDomainHtml({ stoneSlug: "amazonic-green" });
    const jsonLd = readJsonLd(html);

    expect(html).toContain("Amazonic Green");
    expect(html).toContain("Slabs | JW Stone Pensacola");
    expect(html).toContain("slab photos from JW Stone Logistics in Pensacola, Florida");
    expect(html).toContain("Ask whether it is currently available");
    expect(jsonLd.mainEntity).toMatchObject({
      "@type": "Product",
      name: "Amazonic Green",
    });
    expect(JSON.stringify(jsonLd)).not.toMatch(/price|priceRange|offers|availability/i);
  });

  it("gives material pages local intent and keeps their real stone links", () => {
    const html = buildCustomDomainHtml({ materialSlug: "granite" });

    expect(html).toContain("Granite Slabs in Pensacola, FL | JW Stone Logistics");
    expect(html).toContain("Granite slabs in Pensacola, Florida");
    expect(html).toContain("/stones/blue-dunes");
  });

  it("consolidates placeholder URLs back to the collection", () => {
    const html = buildCustomDomainHtml({ stoneSlug: "trending-selection-01" });

    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
    expect(html).toContain(
      '<link rel="canonical" href="https://jwstonelogistics.com/" />'
    );
  });

  it("publishes useful local material context in the LLM discovery file", () => {
    const text = buildJwStoneMarketplaceLlmsText("https://jwstonelogistics.com");

    expect(text).toContain("Natural stone supplier in Pensacola, Florida");
    expect(text).toContain("granite, marble, quartzite, onyx, soapstone and engineered quartz");
  });
});
