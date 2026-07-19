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
    expect(renderProfileSource).not.toContain("stale-while-revalidate");
  });

  it("re-resolves root ownership instead of trusting the one-hour domain cache", () => {
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
      "const shouldRevalidateProfileDomain = isCustomDomainRootRequest(req)"
    );
    expect(middlewareSource).toContain(
      "if (shouldRevalidateProfileDomain) CUSTOM_DOMAIN_CACHE.delete(host)"
    );
    expect(middlewareSource).toContain(
      "const cached = shouldRevalidateProfileDomain ? undefined : CUSTOM_DOMAIN_CACHE.get(host)"
    );
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
    expect(customDomainSource).toContain("if (exactProfileDomains.length > 1) return next()");
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
});
