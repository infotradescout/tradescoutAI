import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("custom-domain profile cache contract", () => {
  it("revalidates profile HTML so published edits do not remain stale", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf-8");
    const start = source.indexOf("async function renderProfileOnCustomDomain(");
    const end = source.indexOf("async function serveCustomDomainProfilePath(", start);
    const renderProfileSource = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(renderProfileSource).toContain(
      'res.setHeader("Cache-Control", "no-cache, must-revalidate")'
    );
    expect(renderProfileSource).toContain("const origin = `https://${host}`");
    expect(renderProfileSource).not.toContain("resolvePublicOrigin(req)");
    expect(renderProfileSource).toContain(
      "const canonicalProfilePath = `/u/${encodeURIComponent(slug)}`"
    );
    expect(renderProfileSource).toContain("const crawlerPathOverride = itemRequest");
    expect(renderProfileSource).toContain("pathOverride: crawlerPathOverride");
    expect(renderProfileSource).not.toContain("stale-while-revalidate");
  });

  it("re-resolves authority documents instead of trusting the one-hour domain cache", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf-8");
    const middlewareStart = source.indexOf(
      "app.use(async (req, res, next) => {",
      source.indexOf("CUSTOM_DOMAIN_CACHE")
    );
    const middlewareEnd = source.indexOf("// Core allowed origins", middlewareStart);
    const middlewareSource = source.slice(middlewareStart, middlewareEnd);

    expect(middlewareStart).toBeGreaterThanOrEqual(0);
    expect(middlewareEnd).toBeGreaterThan(middlewareStart);
    expect(middlewareSource).toContain(
      "const shouldRevalidateProfileDomain = isCustomDomainAuthorityRequest(req)"
    );
    expect(middlewareSource).toContain(
      "if (shouldRevalidateProfileDomain) CUSTOM_DOMAIN_CACHE.delete(host)"
    );
    expect(middlewareSource).toContain(
      "const cached = shouldRevalidateProfileDomain ? undefined : CUSTOM_DOMAIN_CACHE.get(host)"
    );

    const helperStart = source.indexOf("function isCustomDomainAuthorityRequest(");
    const helperEnd = source.indexOf("function redirectToCanonicalCustomDomain(", helperStart);
    const helperSource = source.slice(helperStart, helperEnd);
    expect(helperSource).toContain('requestPath === "/"');
    expect(helperSource).toContain('requestPath === "/robots.txt"');
    expect(helperSource).toContain('requestPath === "/sitemap.xml"');
    expect(helperSource).toContain('requestPath === "/llms.txt"');
    expect(helperSource).toContain('requestPath.startsWith("/api/")');
    expect(helperSource).toContain('requestPath.startsWith("/u/")');
  });

  it("serves host-local sitemap and LLM guidance from the published profile source", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf-8");
    const start = source.indexOf("async function serveCustomDomainProfilePath(");
    const end = source.indexOf("app.use(async (req, res, next) => {", start);
    const handlerSource = source.slice(start, end);

    expect(handlerSource).toContain('path === "/sitemap.xml"');
    expect(handlerSource).toContain("buildPublicProfileSitemapXml({");
    expect(handlerSource).toContain('path === "/llms.txt"');
    expect(handlerSource).toContain("buildPublicProfileLlmsText({");
    expect(handlerSource).toContain("origin: `https://${host}`");
    expect(handlerSource).not.toContain("resolvePublicOrigin(req)");
    expect(handlerSource).not.toContain("new Date().toISOString().slice(0, 10)");
    expect(handlerSource).toContain(
      'sendPublicPageRenderFailure(res, "Unable to render profile item")'
    );
    expect(handlerSource).toContain(
      'sendPublicPageRenderFailure(res, "Unable to render profile category")'
    );
    expect(handlerSource).toContain(
      'sendPublicPageRenderFailure(res, "Unable to render profile")'
    );
    expect(handlerSource).not.toContain(
      "`https://${CANONICAL_WEB_HOST}/u/${encodeURIComponent(slug)}${requestSearchSuffix(req)}`"
    );
    expect(handlerSource).toContain("Allow: /\\nAllow: /llms.txt");
    for (const privatePath of [
      "/api/",
      "/admin/",
      "/dashboard/",
      "/scout/",
      "/messages/",
      "/settings/",
      "/auth/",
    ]) {
      expect(handlerSource).toContain(`Disallow: ${privatePath}`);
    }
    expect(handlerSource).toContain("Sitemap: https://${host}/sitemap.xml");
  });

  it("redirects an apex/www alias to the configured host with path and query intact", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf-8");
    const helperStart = source.indexOf("function alternateCustomDomainHost(");
    const middlewareEnd = source.indexOf("// Core allowed origins", helperStart);
    const customDomainSource = source.slice(helperStart, middlewareEnd);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(middlewareEnd).toBeGreaterThan(helperStart);
    expect(customDomainSource).toContain('host.startsWith("www.") ? host.slice(4)');
    expect(customDomainSource).toContain("`www.${host}`");
    expect(customDomainSource).toContain('req.originalUrl || req.url || "/"');
    expect(customDomainSource).toContain(
      "return res.redirect(301, `https://${canonicalHost}${normalizedPathAndQuery}`)"
    );
    expect(customDomainSource).toContain("exactProfileDomains.length === 1");
    expect(customDomainSource).toContain("aliasProfileDomains.length === 1");
    expect(customDomainSource).toContain("if (exactProfileDomains.length > 1) {");
    expect(customDomainSource).toContain(
      "return redirectToCanonicalCustomDomain(req, res, aliasCanonicalHost)"
    );
    expect(customDomainSource.indexOf("const [businessDomain]")).toBeLessThan(
      customDomainSource.indexOf("const aliasProfileSlug")
    );
    expect(customDomainSource.indexOf("const [account]")).toBeLessThan(
      customDomainSource.indexOf("const aliasProfileSlug")
    );
  });

  it("does not let a profile host become a canonical mirror of platform pages", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/index.ts"), "utf-8");
    const helperStart = source.indexOf("function isCustomDomainMechanicsPath(");
    const middlewareEnd = source.indexOf("// Core allowed origins", helperStart);
    const customDomainSource = source.slice(helperStart, middlewareEnd);
    const profileFallbackStart = source.indexOf(
      "function redirectUnhandledCustomProfilePath("
    );
    const profileFallbackEnd = source.indexOf(
      "// A configured profile custom domain",
      profileFallbackStart
    );
    const profileFallbackSource = source.slice(profileFallbackStart, profileFallbackEnd);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(profileFallbackStart).toBeGreaterThanOrEqual(0);
    expect(profileFallbackEnd).toBeGreaterThan(profileFallbackStart);
    expect(customDomainSource).toContain('requestPath.startsWith("/api/")');
    expect(customDomainSource).toContain('"/assets/"');
    expect(customDomainSource).toContain('"/uploads/"');
    expect(customDomainSource).toContain('"/images/"');
    expect(customDomainSource).toContain('"/offline.html"');
    expect(customDomainSource).toContain('requestPath.startsWith("/auth/")');
    expect(customDomainSource).toContain(
      'return requestPath === "/community-feed"'
    );
    expect(profileFallbackSource).toContain(
      "isCustomDomainProfileRootCompatibilityPath(requestPath, slug)"
    );
    expect(profileFallbackSource).toContain("res.redirect(301, `https://${host}/${suffix}`)");
    expect(profileFallbackSource).toContain(
      'sendPublicPageNotFound(res, "Profile page not found")'
    );
    expect(profileFallbackSource).not.toContain("redirectPublicRequestToPlatform");
    expect(profileFallbackSource).not.toContain("CANONICAL_WEB_HOST");
    expect(customDomainSource).toContain(
      "if (redirectUnhandledCustomProfilePath(req, res, host, cached.slug)) return"
    );
    expect(customDomainSource).toContain(
      "if (redirectUnhandledCustomProfilePath(req, res, host, profileSlug)) return"
    );
    expect(customDomainSource).toContain("if (redirectPublicRequestToPlatform(req, res)) return");
    expect(customDomainSource).toContain('host === "thetradescout.com"');
    expect(customDomainSource).toContain("host === CANONICAL_WEB_HOST");
    expect(customDomainSource).toContain('host === "tradescoutai.onrender.com"');
    expect(customDomainSource).not.toContain('host.endsWith("thetradescout.com")');
    expect(customDomainSource).not.toContain('host.includes("onrender.com")');
    expect(customDomainSource).toContain(
      "markMappedProfileDomainRequest(req, host, cached.slug)"
    );
    expect(customDomainSource).toContain(
      "markMappedProfileDomainRequest(req, host, profileSlug)"
    );

    const canonicalStart = source.indexOf("// Force canonical host:");
    const canonicalEnd = source.indexOf("// Custom domains:", canonicalStart);
    const canonicalSource = source.slice(canonicalStart, canonicalEnd);
    expect(canonicalSource).toContain('host === "tradescoutai.onrender.com"');
    expect(canonicalSource).not.toContain('host.includes("tradescoutai.onrender.com")');

    const corsStart = source.indexOf("function corsOptionsForRequest(");
    const corsEnd = source.indexOf("const corsOptionsDelegate", corsStart);
    const corsSource = source.slice(corsStart, corsEnd);
    expect(corsSource).toContain("isCorsNeutralPublicAssetRequest(req.method, req.path)");
    expect(corsSource).toContain("return callback(null, false)");
  });
});
