import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isJwStonePublicDiscoveryHtml,
  preparePublicSeoHtmlForResponse,
  preparePublicSeoHtmlForUserAgent,
  publicSocialMetadataCacheControl,
  isFactBearingPublicDiscoveryHtml,
  stripPublicSeoBootPlaceholders,
  suppressJwStoneSeoSummaryPaint,
} from "../publicSeoHtml";
import { buildPublicFindLocalBusinessesHtml } from "../publicLandingHtml";
import { LOCAL_BUSINESS_DISCOVERY } from "../../client/src/lib/popularSearchQueries";

const templateHtml = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");
const landingTemplateHtml = fs.readFileSync(
  path.resolve(process.cwd(), "client/landing.html"),
  "utf8"
);
const seoHtml = templateHtml.replace(
  '<div id="root"></div>',
  '<div id="root"><main data-seo-profile="true"><h1>Verified profile</h1></main></div>'
);

describe("public SEO response HTML", () => {
  it("prepares every server-rendered SEO response through the shared boundary", () => {
    const serverSource = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");

    expect(serverSource).toContain("preparePublicSeoHtmlForUserAgent(");
    expect(serverSource).toContain("existingCacheControl");
    expect(serverSource).toContain("!\/\\b(?:no-store|private)\\b\/i.test(existingCacheControl)");
    expect(serverSource).toContain('String(req.headers["user-agent"] || "")');
    expect(serverSource).toContain('res.vary("User-Agent")');
  });

  it("removes boot failure placeholders while retaining crawlable SSR content", () => {
    const html = preparePublicSeoHtmlForResponse(seoHtml, { retainSeoSummary: true });

    expect(html).toContain('<main data-seo-profile="true">');
    expect(html).toContain("Verified profile");
    expect(html).not.toContain("TradeScout encountered a startup issue");
    expect(html).not.toContain("JavaScript is required");
    expect(html).not.toContain('id="ts-boot-fallback"');
    expect(html).not.toContain('id="ts-boot-fallback-noscript"');
  });

  it("keeps browser recovery placeholders while removing the SSR summary for people", () => {
    const html = preparePublicSeoHtmlForResponse(seoHtml, { retainSeoSummary: false });

    expect(html).toContain('<div id="root"></div>');
    expect(html).not.toContain("Verified profile");
    expect(html).toContain("TradeScout encountered a startup issue");
    expect(html).toContain("JavaScript is required");
  });

  it.each([
    [
      "Google-InspectionTool",
      "Mozilla/5.0 (compatible; Google-InspectionTool/1.0; +https://support.google.com/webmasters/answer/9012289)",
    ],
    ["GoogleOther", "Mozilla/5.0 AppleWebKit/537.36 (compatible; GoogleOther)"],
    ["Google-Extended", "Google-Extended"],
    ["Claude-User", "Claude-User/1.0"],
    ["Anthropic-AI", "anthropic-ai"],
    ["Cohere-AI", "cohere-ai"],
    ["Perplexity-User", "Perplexity-User/1.0"],
    ["MistralAI-User", "MistralAI-User/1.0"],
  ])("retains SSR and removes boot placeholders for %s", (_name, userAgent) => {
    const html = preparePublicSeoHtmlForUserAgent(
      seoHtml.replace(
        "</body>",
        '<script type="module" crossorigin src="/assets/index-test.js"></script></body>'
      ),
      userAgent
    );

    expect(html).toContain('<main data-seo-profile="true">');
    expect(html).toContain("Verified profile");
    expect(html).not.toContain("TradeScout encountered a startup issue");
    expect(html).not.toContain("JavaScript is required");
    expect(html).not.toContain('src="/assets/index-test.js"');
  });

  it("keeps the browser recovery path for an ordinary human user agent", () => {
    const html = preparePublicSeoHtmlForUserAgent(
      seoHtml,
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
    );

    expect(html).toContain('data-seo-profile="true"');
    expect(html).toContain("Verified profile");
    expect(html).toContain("clip:rect(0,0,0,0)");
    expect(html).toContain('type="module"');
    expect(html).toContain("TradeScout encountered a startup issue");
    expect(html).toMatch(/id="ts-boot-fallback"[^>]*\bdata-nosnippet\b/);
    expect(html).toMatch(/id="ts-boot-fallback-noscript"[^>]*\bdata-nosnippet\b/);
  });

  it.each(["trade", "county", "city", "trade-city", "best", "recent"])(
    "keeps approved %s facts and links in every initial response without changing indexability",
    (marker) => {
      const raw = templateHtml
        .replace(
          '<div id="root"></div>',
          `<div id="root"><main data-seo-${marker}="true"><h1>Local businesses</h1><a href="/u/example">Published business</a></main></div>`
        )
        .replace('content="index, follow"', 'content="noindex, follow"');
      for (const userAgent of [
        "Mozilla/5.0 Chrome/126.0",
        "UnlistedReader/1.0",
        "",
        "Googlebot/2.1",
        "OAI-SearchBot/1.0",
      ]) {
        const html = preparePublicSeoHtmlForUserAgent(raw, userAgent);
        expect(html).toContain("<h1>Local businesses</h1>");
        expect(html).toContain('href="/u/example"');
        expect(html).toContain('content="noindex, follow"');
        expect(html).not.toContain("clip:rect(0,0,0,0)");
        expect(html).not.toContain("JavaScript is required");
        expect(isFactBearingPublicDiscoveryHtml(html)).toBe(false);
        expect(html).not.toContain('name="tradescout-discovery-attribution"');
      }
      expect(preparePublicSeoHtmlForUserAgent(raw, "Mozilla/5.0 Chrome/126.0")).toContain(
        'type="module"'
      );
      expect(preparePublicSeoHtmlForUserAgent(raw, "OAI-SearchBot/1.0")).not.toContain(
        'type="module"'
      );
    }
  );

  it("serves the business finder with its real identity and local paths before JavaScript", () => {
    const raw = buildPublicFindLocalBusinessesHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
    });
    for (const userAgent of [
      "Mozilla/5.0 Chrome/126.0",
      "UnlistedReader/1.0",
      "Googlebot/2.1",
      "OAI-SearchBot/1.0",
    ]) {
      const html = preparePublicSeoHtmlForUserAgent(raw, userAgent);
      expect(html).toContain(`<h1>${LOCAL_BUSINESS_DISCOVERY.heading}</h1>`);
      expect(html).toContain(LOCAL_BUSINESS_DISCOVERY.introduction);
      expect(html).not.toContain("clip:rect(0,0,0,0)");
      expect(html).not.toContain("JavaScript is required");
      expect(html).toContain(
        '<link rel="canonical" href="https://www.thetradescout.com/find-local-businesses"'
      );
      expect(html).toContain(`<title>${LOCAL_BUSINESS_DISCOVERY.title}</title>`);
      for (const item of LOCAL_BUSINESS_DISCOVERY.browseLinks) {
        expect(html).toContain(`href="${item.href}">${item.label}</a>`);
      }
      expect(html).toContain('href="/county/la/tangipahoa-parish/recent"');
      expect(html).not.toContain('href="/county/la/tangipahoa/recent"');
      expect(html).toContain(
        'href="/direct-connect?county=22105&amp;source=tangipahoa-launch&amp;intent=local_search">Start a Request</a>'
      );
      expect(html).not.toMatch(/href="(?:tel:|mailto:)/);
    }
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");
    expect(source.indexOf('app.get("/find-local-businesses"')).toBeGreaterThan(0);
    expect(source.indexOf('app.get("/find-local-businesses"')).toBeLessThan(
      source.indexOf("express.static(publicDistPath")
    );
  });

  it("retains JW Stone public discovery facts for a generic browser user agent", () => {
    const jwHtml = templateHtml.replace(
      '<div id="root"></div>',
      `<div id="root"><main data-seo-jw-stone-marketplace="true" style="padding:1rem;"><h1>Natural stone, selected at the source.</h1><p>Browse JW Stone's stone collection</p></main></div>`
    );
    const withModule = jwHtml.replace(
      "</body>",
      '<script type="module" crossorigin src="/assets/index-test.js"></script></body>'
    );

    expect(isJwStonePublicDiscoveryHtml(jwHtml)).toBe(true);

    const browserHtml = preparePublicSeoHtmlForUserAgent(
      withModule,
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
    );
    const botHtml = preparePublicSeoHtmlForUserAgent(
      withModule,
      "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2; +https://openai.com/gptbot)"
    );

    expect(browserHtml).toContain("Natural stone, selected at the source.");
    expect(browserHtml).toContain('data-seo-jw-stone-marketplace="true"');
    expect(browserHtml).toContain('src="/assets/index-test.js"');
    expect(browserHtml).toContain("clip:rect(0,0,0,0)");
    expect(botHtml).toContain("Natural stone, selected at the source.");
    expect(botHtml).not.toContain('src="/assets/index-test.js"');
    expect(botHtml).not.toContain("clip:rect(0,0,0,0)");
    expect(suppressJwStoneSeoSummaryPaint(jwHtml)).toContain("clip:rect(0,0,0,0)");
  });

  it("leaves ordinary non-SEO HTML unchanged", () => {
    const html = '<html><body><main id="content">Ordinary page</main></body></html>';

    expect(stripPublicSeoBootPlaceholders(html)).toBe(html);
  });

  it("removes the lightweight landing recovery placeholder from crawler responses", () => {
    const html = preparePublicSeoHtmlForResponse(landingTemplateHtml, {
      retainSeoSummary: true,
    });

    expect(html).not.toContain('id="ts-landing-fallback"');
    expect(html).not.toContain('src="/src/landing-main.tsx"');
  });

  it("aligns signed-card HTML caching with the short opaque-token lifetime", () => {
    expect(
      publicSocialMetadataCacheControl(
        '<meta property="og:image" content="/images/social/card/opaque.png" />'
      )
    ).toBe("public, max-age=60, must-revalidate");
    expect(
      publicSocialMetadataCacheControl(
        '<meta property="og:image" content="/images/social/profile/example.png" />'
      )
    ).toBeNull();
  });
});
