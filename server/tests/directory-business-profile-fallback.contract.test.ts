import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("directory business profile fallback", () => {
  it("renders active imported directory businesses instead of hard-failing SEO publication checks", () => {
    const routeSource = read("server/routes/business-directory-public.ts");

    expect(routeSource).toContain('router.get("/api/public/businesses/:slug"');
    expect(routeSource).toContain("publication: {");
    expect(routeSource).toContain("crawlable: pub.ok");
    expect(routeSource).toContain("reason: pub.reason || null");
    expect(routeSource).not.toContain(
      'if (!pub.ok) return res.status(410).json({ message: "Listing inactive/out of date" });'
    );
  });

  it("carries rating evidence without exposing imported contact or direct-link vectors", () => {
    const routeSource = read("server/routes/business-directory-public.ts");
    const presentationSource = read("server/services/publicDirectoryBusinessPresentation.ts");
    const viewSource = read("client/src/pages/BusinessProfileView.tsx");

    expect(presentationSource).toContain("average_rating");
    expect(presentationSource).toContain("review_count");
    expect(presentationSource).not.toContain("google_maps_url");
    expect(presentationSource).not.toContain("review_url");
    expect(routeSource).not.toContain("address: typeof raw.address");
    expect(routeSource).not.toContain("zipCode: typeof raw.zipCode");
    expect(presentationSource).toContain('source: "google_import"');
    expect(viewSource).toContain("googleRating");
    expect(viewSource).toContain("googleReviewCount");
    expect(viewSource).toContain("address: null");
    expect(viewSource).toContain("zipCode: null");
    expect(viewSource).toContain("googleMapsUrl: null");
    expect(viewSource).not.toContain("Google-imported fields queued for enrichment");
    expect(viewSource).toContain("Call after decision card");
  });

  it("uses legacy fallback only after an authoritative directory 404", () => {
    const viewSource = read("client/src/pages/BusinessProfileView.tsx");
    const directoryLookup = viewSource.slice(
      viewSource.indexOf("const directoryRes = await fetch"),
      viewSource.indexOf('setProfileSource("published")')
    );
    expect(directoryLookup).toContain("if (directoryRes.status !== 404)");
    expect(directoryLookup).toContain("throw new Error(`Directory profile lookup failed");
    expect(directoryLookup.indexOf("directoryRes.status !== 404")).toBeLessThan(
      directoryLookup.indexOf("if (!response.ok)")
    );
  });

  it("uses the canonical county slug helper for hydrated directory links", () => {
    const viewSource = read("client/src/pages/BusinessProfileView.tsx");
    expect(viewSource).toContain(
      "slugifyCountyName(stripCountySuffix(profile.countyName) || profile.countyName)"
    );
    expect(
      viewSource.match(
        /\/county\/\$\{profile\.stateCode\.toLowerCase\(\)\}\/\$\{publicCountySlug\}/g
      )
    ).toHaveLength(2);
    expect(viewSource).not.toContain('profile.countyName.toLowerCase().replace(/\\s+/g, "-")');
  });

  it("records signed acquisition milestones only for an authoritatively crawlable directory", () => {
    const viewSource = read("client/src/pages/BusinessProfileView.tsx");
    expect(viewSource).toContain('profileSource === "directory"');
    expect(viewSource).toContain("directoryPublication?.crawlable === true");
    expect(viewSource).toContain("void trackDiscoveryLandingOnce({");
    expect(viewSource).toContain('trackDirectoryCta("direct_connect")');
    expect(viewSource).toContain('trackDirectoryCta("business_claim")');
    expect(viewSource).toContain('trackDirectoryCta("account_create")');
    expect(viewSource).toContain('trackDirectoryCta("booking_request")');
    expect(viewSource).toContain("appendDiscoveryAttributionHandoff(");

    const dialogSource = read("client/src/components/profile/ProfileBookingRequestDialog.tsx");
    expect(dialogSource).toContain("onAccountCreate?.();");
    expect(dialogSource).toContain("onBookingRequest?.();");
    expect(dialogSource.indexOf("onBookingRequest?.();")).toBeLessThan(
      dialogSource.indexOf("if (!hasViewerSession)")
    );
    expect(dialogSource.indexOf("onAccountCreate?.();")).toBeLessThan(
      dialogSource.indexOf("window.location.assign(signInHref)")
    );
  });

  it("keeps the public repository active-only and fails closed on consent-schema drift", () => {
    const repositorySource = read("server/repositories/businessRepository.ts");
    const method = repositorySource.slice(
      repositorySource.indexOf("async getBusinessBySlugPublic"),
      repositorySource.indexOf("async getBusinessPublicById")
    );
    expect(method).toContain('eq(businesses.status, "active" as any)');
    expect(method).toContain("throw error;");
    expect(method).not.toContain('true as "publicDiscoveryEnabled"');
    expect(method).not.toContain("b.status <> 'suspended'");

    const routeSource = read("server/routes/business-directory-public.ts");
    const ssrSource = read("server/publicBusinessHtml.ts");
    expect(routeSource).toContain("new Date(Number.NaN)");
    expect(ssrSource).toContain("new Date(Number.NaN)");
  });
});
