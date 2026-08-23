import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  attachDiscoveryAttributionMeta,
  DISCOVERY_ATTRIBUTION_CACHE_CONTROL,
  enforceDiscoveryAttributionResponsePrivacy,
  enforcePublicSeoUserAgentVariation,
  preparePublicSeoHtmlForUserAgent,
} from "../publicSeoHtml";
import { verifyDiscoveryAttributionToken } from "../utils/discoveryAttribution";

process.env.DISCOVERY_ATTRIBUTION_SECRET = "discovery-html-contract-secret";

const templateHtml = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");
const serverIndexSource = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");
const jwHtml = templateHtml
  .replace(
    '<div id="root"></div>',
    `<div id="root"><main data-seo-jw-stone-marketplace="true"><h1>JW Stone</h1></main></div>`
  )
  .replace(
    "</head>",
    `<link rel="canonical" href="/jw-stone" />
<meta name="tradescout-business-slug" content="jw-stone" />
<meta name="tradescout-business-entity-type" content="business_marketplace" />
</head>`
  );

describe("server-issued discovery attribution HTML", () => {
  it("issues a signed envelope independent of the HTTP request id", () => {
    const html = attachDiscoveryAttributionMeta(jwHtml);
    const match = html.match(/<meta name="tradescout-discovery-attribution" content="([^"]+)" \/>/);
    expect(match?.[1]).toBeTruthy();

    const verified = verifyDiscoveryAttributionToken(match?.[1]);
    expect(verified).toMatchObject({
      businessSlug: "jw-stone",
      entityType: "business_marketplace",
      canonicalRoute: "/jw-stone",
    });
    expect(verified?.entryRequestId).not.toBe("incoming-http-request-id");
  });

  it("keeps the envelope when the shared response boundary prepares browser HTML", () => {
    const html = preparePublicSeoHtmlForUserAgent(jwHtml, "Mozilla/5.0");
    expect(html).toContain('name="tradescout-discovery-attribution"');
    expect(html).not.toContain('name="tradescout-entry-request-id"');
  });

  it("overrides an earlier public cache policy whenever a per-entry token is attached", () => {
    const html = preparePublicSeoHtmlForUserAgent(jwHtml, "Mozilla/5.0");
    const headers = new Map<string, string>([
      ["cache-control", "public, max-age=300, stale-while-revalidate=86400"],
      ["cdn-cache-control", "public, max-age=300"],
      ["surrogate-control", "public, max-age=300"],
    ]);
    const response = {
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      },
    };

    expect(enforceDiscoveryAttributionResponsePrivacy(html, response)).toBe(true);
    expect(headers.get("cache-control")).toBe(DISCOVERY_ATTRIBUTION_CACHE_CONTROL);
    expect(headers.get("cdn-cache-control")).toBe("no-store");
    expect(headers.get("surrogate-control")).toBe("no-store");

    const userAgentVariation = serverIndexSource.indexOf("enforcePublicSeoUserAgentVariation(res)");
    const preparation = serverIndexSource.indexOf("preparePublicSeoHtmlForUserAgent(");
    const privacyOverride = serverIndexSource.indexOf(
      "enforceDiscoveryAttributionResponsePrivacy(",
      preparation
    );
    const send = serverIndexSource.indexOf("return originalSend(prepared)", privacyOverride);
    expect(userAgentVariation).toBeGreaterThan(-1);
    expect(preparation).toBeGreaterThan(userAgentVariation);
    expect(preparation).toBeGreaterThan(-1);
    expect(privacyOverride).toBeGreaterThan(preparation);
    expect(send).toBeGreaterThan(privacyOverride);
  });

  it("keeps crawler HTML stable and publicly cacheable while browser HTML stays per-entry", () => {
    const browserHtml = preparePublicSeoHtmlForUserAgent(jwHtml, "Mozilla/5.0 Chrome/126.0");
    const googlebotUa = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const firstCrawlerHtml = preparePublicSeoHtmlForUserAgent(jwHtml, googlebotUa);
    const secondCrawlerHtml = preparePublicSeoHtmlForUserAgent(jwHtml, googlebotUa);

    expect(browserHtml).toContain('name="tradescout-discovery-attribution"');
    expect(firstCrawlerHtml).not.toContain('name="tradescout-discovery-attribution"');
    expect(secondCrawlerHtml).toBe(firstCrawlerHtml);
    expect(firstCrawlerHtml).toContain('type="module"');

    const headers = new Map<string, string>([
      ["cache-control", "public, max-age=300, stale-while-revalidate=86400"],
      ["cdn-cache-control", "public, max-age=300"],
    ]);
    const response = {
      getHeader(name: string) {
        return headers.get(name.toLowerCase());
      },
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      },
    };
    enforcePublicSeoUserAgentVariation(response);
    expect(enforceDiscoveryAttributionResponsePrivacy(firstCrawlerHtml, response)).toBe(false);
    expect(headers.get("cache-control")).toBe("public, max-age=300, stale-while-revalidate=86400");
    expect(headers.get("cdn-cache-control")).toBe("public, max-age=300");
    expect(headers.get("vary")).toBe("User-Agent");

    // Even if a non-compliant cache replays crawler HTML to a person, the
    // application bootstrap remains present. A compliant cache varies the
    // request and serves the browser's per-entry, no-store envelope instead.
    const browserHeaders = new Map<string, string>();
    const browserResponse = {
      getHeader(name: string) {
        return browserHeaders.get(name.toLowerCase());
      },
      setHeader(name: string, value: string) {
        browserHeaders.set(name.toLowerCase(), value);
      },
    };
    enforcePublicSeoUserAgentVariation(browserResponse);
    expect(enforceDiscoveryAttributionResponsePrivacy(browserHtml, browserResponse)).toBe(true);
    expect(browserHeaders.get("vary")).toBe("User-Agent");
    expect(browserHeaders.get("cache-control")).toBe(DISCOVERY_ATTRIBUTION_CACHE_CONTROL);
  });
});
