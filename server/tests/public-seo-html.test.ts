import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  preparePublicSeoHtmlForResponse,
  preparePublicSeoHtmlForUserAgent,
  stripPublicSeoBootPlaceholders,
} from "../publicSeoHtml";

const templateHtml = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");
const seoHtml = templateHtml.replace(
  '<div id="root"></div>',
  '<div id="root"><main data-seo-profile="true"><h1>Verified profile</h1></main></div>'
);

describe("public SEO response HTML", () => {
  it("prepares every server-rendered SEO response through the shared boundary", () => {
    const serverSource = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf8");

    expect(serverSource).toContain("preparePublicSeoHtmlForUserAgent(body");
    expect(serverSource).toContain('String(req.headers["user-agent"] || "")');
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
    const html = preparePublicSeoHtmlForUserAgent(seoHtml, userAgent);

    expect(html).toContain('<main data-seo-profile="true">');
    expect(html).toContain("Verified profile");
    expect(html).not.toContain("TradeScout encountered a startup issue");
    expect(html).not.toContain("JavaScript is required");
  });

  it("keeps the browser recovery path for an ordinary human user agent", () => {
    const html = preparePublicSeoHtmlForUserAgent(
      seoHtml,
      "Mozilla/5.0 AppleWebKit/537.36 Chrome/126.0 Safari/537.36"
    );

    expect(html).toContain('<div id="root"></div>');
    expect(html).not.toContain("Verified profile");
    expect(html).toContain("TradeScout encountered a startup issue");
  });

  it("leaves ordinary non-SEO HTML unchanged", () => {
    const html = '<html><body><main id="content">Ordinary page</main></body></html>';

    expect(stripPublicSeoBootPlaceholders(html)).toBe(html);
  });
});
