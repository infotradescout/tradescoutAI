import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { attachDiscoveryAttributionMeta, preparePublicSeoHtmlForUserAgent } from "../publicSeoHtml";
import { verifyDiscoveryAttributionToken } from "../utils/discoveryAttribution";

process.env.DISCOVERY_ATTRIBUTION_SECRET = "discovery-html-contract-secret";

const templateHtml = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");
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

const customDomainProfileHtml = templateHtml
  .replace(
    '<div id="root"></div>',
    `<div id="root"><main data-seo-profile="true"><h1>Example Profile</h1></main></div>`
  )
  .replace(
    "</head>",
    `<link rel="canonical" href="https://example-profile.test/" />
<meta name="tradescout-business-slug" content="example-profile" />
<meta name="tradescout-business-entity-type" content="business_profile" />
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

  it("binds a custom-domain root landing to its profile-scoped route", () => {
    const html = attachDiscoveryAttributionMeta(customDomainProfileHtml);
    const match = html.match(/<meta name="tradescout-discovery-attribution" content="([^"]+)" \/>/);

    expect(match?.[1]).toBeTruthy();
    expect(verifyDiscoveryAttributionToken(match?.[1])).toMatchObject({
      businessSlug: "example-profile",
      entityType: "business_profile",
      canonicalRoute: "/u/example-profile",
    });
  });
});
