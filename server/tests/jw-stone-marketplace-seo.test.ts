import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPublicJwStoneMarketplaceHtml,
  JW_STONE_MARKETPLACE_CANONICAL_URL,
} from "../publicJwStoneMarketplaceHtml";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const templateHtml = `<!doctype html>
<html lang="en">
  <head>
    <title>TradeScout</title>
    <meta name="description" content="Default description" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="Default description" />
    <meta property="og:url" content="https://www.thetradescout.com/" />
    <meta property="og:image" content="https://www.thetradescout.com/default.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="Default description" />
    <meta name="twitter:image" content="https://www.thetradescout.com/default.png" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("JW Stone 2.0 public SEO shell", () => {
  it("uses one fixed platform canonical and truthful JW Stone metadata", () => {
    const html = buildPublicJwStoneMarketplaceHtml(templateHtml);

    expect(JW_STONE_MARKETPLACE_CANONICAL_URL).toBe("https://www.thetradescout.com/jw-stone");
    expect(html).toContain(
      '<link rel="canonical" href="https://www.thetradescout.com/jw-stone" />'
    );
    expect(html).toContain(
      '<meta property="og:url" content="https://www.thetradescout.com/jw-stone" />'
    );
    expect(html).toContain("Guided Natural Stone Discovery | JW Stone");
    expect(html).toContain("JW Stone's photographed stone collection");
    expect(html).toContain(
      "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png"
    );
    expect(html).not.toContain("jwstonelogistics.com");
  });

  it("injects a crawlable buyer-first fallback without invented product facts", () => {
    const html = buildPublicJwStoneMarketplaceHtml(templateHtml);

    expect(html).toContain('<main data-seo-jw-stone="marketplace"');
    for (const buyer of ["Fabricator", "Builder", "Designer", "Homeowner"]) {
      expect(html).toContain(`<li>${buyer}</li>`);
    }
    expect(html).toContain("Contact starts only when you choose Direct Connect.");
    expect(html).toContain('"@type":"WebPage"');
    expect(html).not.toMatch(/"@type":"Product"/i);
    expect(html).not.toMatch(/\bprice(?:s|d|ing)?\b/i);
    expect(html).not.toContain("Dual Finish");
    expect(html).not.toContain("Name not confirmed");
    expect(html).not.toContain("Finish not confirmed");
    expect(html).not.toContain("Unnamed slab");
  });

  it("registers only the platform route after custom-domain handling and before static HTML", () => {
    const server = read("server/index.ts");
    const customDomainFunctionIndex = server.indexOf(
      "async function serveCustomDomainProfilePath("
    );
    const customDomainMiddlewareIndex = server.indexOf(
      "app.use(async (req, res, next) => {",
      customDomainFunctionIndex
    );
    const jwStoneRouteIndex = server.indexOf('app.get("/jw-stone"');
    const staticIndex = server.indexOf("express.static(publicDistPath");

    expect(customDomainFunctionIndex).toBeGreaterThan(-1);
    expect(customDomainMiddlewareIndex).toBeGreaterThan(customDomainFunctionIndex);
    expect(jwStoneRouteIndex).toBeGreaterThan(customDomainMiddlewareIndex);
    expect(staticIndex).toBeGreaterThan(jwStoneRouteIndex);
    expect(server).toContain('app.get(["/u/:slug", "/p/:slug"]');
    expect(server.match(/app\.get\("\/jw-stone"/g)).toHaveLength(1);
  });

  it("keeps the client marketplace separate from the approved profile and custom-domain shell", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const customDomainBranch = routes.indexOf("{isCustomDomainProfileRoute ? (");
    const marketplaceBranch = routes.indexOf(") : isJwStoneExperienceRoute ? (");
    const existingProfileBranch = routes.indexOf(") : isStandaloneProfileRoute ? (");

    expect(routes).toContain('() => import("./pages/jw-stone-2/JwStoneMarketplacePage")');
    expect(customDomainBranch).toBeGreaterThan(-1);
    expect(marketplaceBranch).toBeGreaterThan(customDomainBranch);
    expect(existingProfileBranch).toBeGreaterThan(marketplaceBranch);
    expect(routes).toContain('<Route path="/jw-stone">');
    expect(routes).toContain('<Route path="/u/:slug">');
    expect(routes).toContain("<LazyPage Component={ProfileSiteView} />");
  });

  it("introduces no JW Stone 2.0 presentation migration", () => {
    const migrationRoot = path.resolve(process.cwd(), "migrations");
    const migrationText = fs
      .readdirSync(migrationRoot)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => fs.readFileSync(path.join(migrationRoot, name), "utf8"))
      .join("\n");

    expect(migrationText).not.toContain("jw-stone-2");
    expect(migrationText).not.toMatch(/presentationMode[^\n]+jw-stone/i);
  });

  it("publishes the route through the conservative static sitemap", () => {
    const generator = read("scripts/generate-sitemap.mjs");
    const sitemap = read("client/public/sitemap.xml");

    expect(generator).toMatch(
      /\{\s*path:\s*["']\/jw-stone["'],\s*priority:\s*0\.9,\s*changefreq:\s*["']weekly["']\s*\}/
    );
    expect(sitemap).toContain("<loc>https://www.thetradescout.com/jw-stone</loc>");
  });
});
