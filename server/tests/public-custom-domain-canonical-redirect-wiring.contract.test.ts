import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public custom-domain canonical redirect wiring", () => {
  it("registers canonical handling before application routes", () => {
    const server = read("server/index.ts");
    const middlewareRegistration = server.indexOf("app.use(landingContractHeaders);");
    const routeRegistration = server.indexOf("const server = await registerRoutes(app);");

    expect(middlewareRegistration).toBeGreaterThan(-1);
    expect(routeRegistration).toBeGreaterThan(middlewareRegistration);
  });

  it("resolves known aliases before any duplicate public renderer", () => {
    const middleware = read("server/middleware/landingContractHeaders.ts");
    const handlerCall = middleware.indexOf(
      "if (await handlePublicCustomDomainCanonicalRedirect(req, res)) return;"
    );
    const faviconCall = middleware.indexOf("if (handlePublicFaviconFallback(req, res)) return;");
    const imageFeedCall = middleware.indexOf(
      "if (await handlePublicProfileImageSitemapRequest(req, res)) return;"
    );
    const serviceAreaCall = middleware.indexOf(
      "if (isPublicProfileServiceAreaPath(requestPath))"
    );
    const serviceCall = middleware.indexOf("if (isPublicProfileServicePath(requestPath))");

    expect(middleware).toContain(
      'import { handlePublicCustomDomainCanonicalRedirect } from "../publicCustomDomainCanonicalRedirect";'
    );
    expect(handlerCall).toBeGreaterThan(-1);
    expect(faviconCall).toBeGreaterThan(handlerCall);
    expect(imageFeedCall).toBeGreaterThan(handlerCall);
    expect(serviceAreaCall).toBeGreaterThan(handlerCall);
    expect(serviceCall).toBeGreaterThan(handlerCall);
  });

  it("derives aliases from the governed public profile graph and fails closed", () => {
    const redirect = read("server/publicCustomDomainCanonicalRedirect.ts");

    expect(redirect).toContain("listPublicProfilesForSitemap");
    expect(redirect).toContain("collectPublicCustomDomainCanonicalAuditTargets");
    expect(redirect).toContain('canonical.protocol !== "https:"');
    expect(redirect).toContain("CANONICAL_TRADESCOUT_HOSTS");
    expect(redirect).toContain("hasLegacyRootSelector");
    expect(redirect).toContain('value === "stone" || value === "collection"');
    expect(redirect).toContain('value === "1"');
    expect(redirect).toContain('value === "signin"');
  });
});
