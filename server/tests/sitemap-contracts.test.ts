import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

const expectedSitemapLocs = [
  "https://www.thetradescout.com/sitemap-core.xml",
  "https://www.thetradescout.com/sitemap-u-profiles.xml",
  "https://www.thetradescout.com/sitemap-business-profiles.xml",
  "https://www.thetradescout.com/sitemap-directory-businesses.xml",
  "https://www.thetradescout.com/sitemap-homescout-counties.xml",
  "https://www.thetradescout.com/sitemap-homescout-listings.xml",
  "https://www.thetradescout.com/sitemap-tradepartners.xml",
  "https://www.thetradescout.com/sitemap-directory-counties.xml",
  "https://www.thetradescout.com/sitemap-directory-trade-navigation.xml",
  "https://www.thetradescout.com/sitemap-directory-trades.xml",
  "https://www.thetradescout.com/sitemap-directory-cities.xml",
  "https://www.thetradescout.com/sitemap-directory-trade-cities.xml",
  "https://www.thetradescout.com/sitemap-best-pages.xml",
  "https://www.thetradescout.com/sitemap-recent-activity.xml",
  "https://www.thetradescout.com/sitemap-exchange-listings.xml",
];

const restoredPublicDetailSitemapLocs = [
  "https://www.thetradescout.com/sitemap-handmade-products.xml",
  "https://www.thetradescout.com/sitemap-profile-service-offers.xml",
];

const expectedStaticPublicRoutes = [
  "https://www.thetradescout.com/",
  "https://www.thetradescout.com/jw-stone",
  "https://www.thetradescout.com/direct-connect",
  "https://www.thetradescout.com/community",
  "https://www.thetradescout.com/how-it-works",
  "https://www.thetradescout.com/trade-up-for-trade-schools",
  "https://www.thetradescout.com/trust-model",
  "https://www.thetradescout.com/direct-connect-info",
  "https://www.thetradescout.com/compare",
  "https://www.thetradescout.com/compare/home-services",
  "https://www.thetradescout.com/compare/real-estate",
  "https://www.thetradescout.com/compare/community",
  "https://www.thetradescout.com/compare/local-business",
  "https://www.thetradescout.com/compare/coordination",
  "https://www.thetradescout.com/compare/lead-generation",
  "https://www.thetradescout.com/privacy",
  "https://www.thetradescout.com/compliance",
];

describe("sitemap contracts", () => {
  it("dynamic sitemap index includes the crawler-facing directory, best, and recent feeds", () => {
    const source = read("server/routes/profiles.ts");

    for (const loc of [...expectedSitemapLocs, ...restoredPublicDetailSitemapLocs]) {
      expect(source).toContain(loc.replace("https://www.thetradescout.com", "${baseUrl}"));
    }
  });

  it("submits restored public detail feeds through the advertised static sitemap index", () => {
    const staticIndex = read("client/public/sitemap-index.xml");
    const generator = read("scripts/generate-sitemap-core.mjs");
    const guard = read("scripts/guard-sitemap-integrity.mjs");

    for (const loc of restoredPublicDetailSitemapLocs) {
      expect(staticIndex).toContain(`<loc>${loc}</loc>`);
      const target = loc.replace("https://www.thetradescout.com", "");
      expect(generator).toContain(`'${target}'`);
      expect(guard).toContain(`"${target.slice(1)}"`);
    }
  });

  it("keeps platform profile sitemaps same-host and omits custom-domain aliases", () => {
    const source = read("server/routes/profiles.ts");

    expect(source).toContain("canonicalPublishedProfileSitemapLoc");
    expect(source).toContain("canonicalBusinessPresenceSitemapLoc");
    expect(source).toContain("p.status = 'published'");
    expect(source).toContain("p.id AS profile_id");
    expect(source).toContain("p.content_blocks");
    expect(source).toContain("isPublishedProfileSitemapTargetPublic(row)");
    expect(source).toContain("buildOptInProfileSitemapUrls({");
    expect(source).toContain("profileUrl: profileLoc");
    expect(source).toContain("if (args.linkedProfile?.isPublic)");
    expect(source).toContain("if (target.customDomain) return null");
    expect(source).toContain("return `${baseUrl}/u/${encodeURIComponent(target.profileSlug)}`");
    expect(source).toContain(
      "return `${args.baseUrl}/business/${encodeURIComponent(args.businessSlug)}`"
    );
    expect(source).not.toContain("`https://${target.customDomain}/`");
  });

  it("leaves custom-domain discovery to the existing host-local robots and sitemap", () => {
    const serverIndex = read("server/index.ts");
    const publicProfileHtml = read("server/publicProfileHtml.ts");

    expect(serverIndex).toContain('if (path === "/robots.txt")');
    expect(serverIndex).toContain("Sitemap: https://${host}/sitemap.xml");
    expect(serverIndex).toContain('if (path === "/sitemap.xml")');
    expect(serverIndex).toContain("buildPublicProfileSitemapXml");
    expect(publicProfileHtml).toContain("`${publicOrigin}/`");
  });

  it("scopes paged directory canonical lookups to only businesses on that page", () => {
    const source = read("server/routes/profiles.ts");
    const routeStart = source.indexOf(
      'router.get("/sitemap-directory-businesses-:page(\\\\d+).xml"'
    );
    const routeEnd = source.indexOf("const DIRECTORY_TRADE_SITEMAP_PAGE_SIZE", routeStart);
    const route = source.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(route).toContain("const businessSlugs = Array.from(");
    expect(route).toContain("listPublishedProfileSitemapTargets(businessSlugs)");
    expect(route).not.toContain("listPublishedProfileSitemapTargets(),");
    expect(route).not.toContain("listPublicBusinessPresenceSitemapRows(");
    expect(source).toContain(
      'const businessScope = businessSlugs ? "AND b.slug = ANY($1::text[])"'
    );
    expect(source).toContain("businessSlugs ? [businessSlugs] : []");
  });

  it("selects one newest public linked profile and preserves private-linked business pages", () => {
    const sitemapSource = read("server/routes/profiles.ts");
    const serverIndex = read("server/index.ts");
    const canonicalRoute = read("server/services/canonicalBusinessProfileRoute.ts");

    expect(sitemapSource).toContain("indexPublicLinkedProfilesByBusinessSlug");
    expect(sitemapSource).toContain("!target.isPublic || indexed.has(target.businessSlug)");
    expect(sitemapSource).toContain("p.updated_at DESC NULLS LAST");
    expect(sitemapSource).toContain("p.created_at DESC NULLS LAST");
    expect(sitemapSource).toContain("p.slug ASC");
    expect(sitemapSource).toContain("if (args.linkedProfile?.isPublic)");
    expect(sitemapSource).toContain(
      "return `${args.baseUrl}/business/${encodeURIComponent(args.businessSlug)}`"
    );

    expect(serverIndex).toContain("resolveCanonicalBusinessProfileRoute(slug)");
    expect(canonicalRoute).toContain(".innerJoin(users, eq(users.id, profiles.ownerUserId))");
    expect(canonicalRoute).toContain("canDiscoverPublishedProfilePublicly({");
    expect(canonicalRoute).toContain("profileId: profiles.id");
    expect(canonicalRoute).toContain("${profiles.updatedAt} DESC NULLS LAST");
    expect(canonicalRoute).toContain("${profiles.createdAt} DESC NULLS LAST");
    expect(canonicalRoute).toContain("asc(profiles.slug)");
  });

  it("restores existing Handmade product detail routes to a public-gated XML sitemap", () => {
    const source = read("server/routes/profiles.ts");
    const marker = 'router.get("/sitemap-handmade-products.xml"';
    const route = source.slice(
      source.indexOf(marker),
      source.indexOf('router.get("/sitemap-profile-service-offers.xml"')
    );

    expect(source).toContain(marker);
    expect(route).toContain("storage.getHandmadeProducts({ limit: 50_000, offset: 0 })");
    expect(route).toContain('String(product.status || "") === "active"');
    expect(route).toContain("buildExposureAuthorityMap");
    expect(route).toContain("buildHandmadeProductPath(product.id)");
    expect(route).toContain("res.send(buildUrlSet(urls))");
  });

  it("restores existing profile service detail routes to a public-gated XML sitemap", () => {
    const source = read("server/routes/profiles.ts");
    const marker = 'router.get("/sitemap-profile-service-offers.xml"';
    const route = source.slice(
      source.indexOf(marker),
      source.indexOf('router.get("/sitemap-exchange-listings.xml"')
    );

    expect(source).toContain(marker);
    expect(route).toContain("WHERE is_active = true");
    expect(route).toContain("AND offer_type = 'service'");
    expect(route).toContain("buildExposureAuthorityMap");
    expect(route).toContain("buildProfileServiceOfferPath(offer.id)");
    expect(route).toContain("res.send(buildUrlSet(urls))");
  });

  it("keeps every Exchange sitemap URL behind the renderer's exposure-authority gate", () => {
    const routeSource = read("server/routes/profiles.ts");
    const repositorySource = read("server/repositories/sitemapRepository.ts");
    const marker = 'router.get("/sitemap-exchange-listings.xml"';
    const route = routeSource.slice(routeSource.indexOf(marker));

    expect(routeSource).toContain(marker);
    expect(repositorySource).toContain("sellerUserId: marketplaceListings.sellerId");
    expect(route).toContain("SELECT id, seller_user_id,");
    expect(route).toContain('sellerUserId: String(offer.seller_user_id || "").trim()');
    expect(route).toContain("const exposureAuthority = await buildExposureAuthorityMap(");
    expect(route).toContain("[...listings, ...profileOfferItems]");
    expect(route).toContain("exposureAuthority[listing.sellerUserId] === true");
  });

  it("keeps sitemap values behind the shared XML escaping boundary", () => {
    const source = read("server/routes/profiles.ts");

    expect(source).toContain("<loc>${xmlEscape(entry.loc)}</loc>");
    expect(source).toContain("<lastmod>${xmlEscape(entry.lastmod)}</lastmod>");
  });

  it("static sitemap.xml remains a conservative canonical urlset", () => {
    const source = read("client/public/sitemap.xml");

    expect(source).toContain("<urlset");
    expect(source).not.toContain("<sitemapindex");
    for (const loc of expectedStaticPublicRoutes) {
      expect(source).toContain(`<loc>${loc}</loc>`);
    }
  });

  it("static sitemap-index.xml mirrors the submitted sitemap index targets", () => {
    const source = read("client/public/sitemap-index.xml");

    expect(source).toContain("<sitemapindex");
    expect(source).not.toContain("sitemap-contractors.xml");
    expect(source).not.toContain("sitemap-community.xml");
    for (const loc of expectedSitemapLocs) {
      expect(source).toContain(`<loc>${loc}</loc>`);
    }
  });

  it("trade navigation sitemap is driven by indexed snapshot coverage, not every trade/state combo", () => {
    const source = read("server/routes/profiles.ts");

    expect(source).toContain("ensureSeoDirectoryScopeSnapshotTables()");
    expect(source).toContain("with trade_state_pairs as (");
    expect(source).toContain("from ts_seo_trade_county_pages");
    expect(source).toContain("from ts_seo_trade_city_pages");
    expect(source).toContain(
      "activeTradeSlugs.length > 0 ? activeTradeSlugs : PRIMARY_TRADE_SLUGS"
    );
    expect(source).not.toContain("PRIMARY_TRADE_SLUGS.flatMap");
  });
});
