import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");
}

describe("profile custom-domain authority contract", () => {
  it("keeps customDomain out of generic profile writes and preserves the server-owned value", () => {
    const routes = source("server/routes/profiles.ts");
    const seoStart = routes.indexOf("const profileSeoSchema = z");
    const seoEnd = routes.indexOf("const createProfileSchema", seoStart);
    const seoSchema = routes.slice(seoStart, seoEnd);
    const updateStart = routes.indexOf('router.put("/api/profiles/:id"');
    const updateEnd = routes.indexOf("router.delete(", updateStart);
    const updateRoute = routes.slice(updateStart, updateEnd);

    expect(seoSchema).toContain(".strict()");
    expect(seoSchema).not.toContain("customDomain");
    expect(updateRoute).toContain("const existingCustomDomain");
    expect(updateRoute).toContain(
      "...(existingCustomDomain ? { customDomain: existingCustomDomain } : {})"
    );
  });

  it("uses owner preferences for profile-scoped status and has no business-presence prerequisite", () => {
    const routes = source("server/routes/business-profile.ts");
    const domainStart = routes.indexOf('app.get(\n    "/api/business-profile/domain/status"');
    const domainEnd = routes.indexOf("POST /api/scout/copy-assist", domainStart);
    const domainRoutes = routes.slice(domainStart, domainEnd);

    expect(domainRoutes).toContain('const profileId = String(req.query.profileId || "").trim()');
    expect(domainRoutes).toContain("storage.getProfileByIdForOwner(userId, profileId)");
    expect(domainRoutes).toContain("profileDomainStatus(profileId, targetProfile");
    expect(domainRoutes).toContain("buildPreferencesWithProfileDomainState({");
    expect(routes).toContain("preferences.profileDomainStates = nextStates");
    expect(domainRoutes).not.toContain("getBusinessProfileByUserId");
    expect(domainRoutes).not.toContain("saveBusinessProfile");
  });

  it("keeps TXT ownership separate from operator-controlled hosting activation", () => {
    const routes = source("server/routes/business-profile.ts");
    const verifyStart = routes.indexOf('"/api/business-profile/domain/verify"');
    const verifyEnd = routes.indexOf("DELETE /api/business-profile/domain", verifyStart);
    const verifyRoute = routes.slice(verifyStart, verifyEnd);

    expect(verifyRoute).toContain("pg_advisory_xact_lock(hashtext(${domainLockKey}))");
    expect(verifyRoute).toContain("TXT proof");
    expect(verifyRoute).toContain("deliberately never writes profiles.seoMeta.customDomain");
    expect(verifyRoute).toContain("activationPending: ownershipVerified");
    expect(verifyRoute).not.toContain("fetch(");
    expect(verifyRoute).not.toContain("isCustomDomainRoutingReady");
    expect(verifyRoute).not.toContain("customDomain: domain");
  });

  it("places publishing controls only in the rich profile editor", () => {
    const profileEditor = source("client/src/pages/ProfileSiteEditor.tsx");
    const businessEditor = source("client/src/pages/BusinessProfileEditor.tsx");

    expect(profileEditor).toContain("/api/business-profile/domain/status?profileId=");
    expect(profileEditor).toContain("delete (seoMetaFromText as any).customDomain");
    expect(profileEditor).toContain('data-testid="profile-editor-domain-start"');
    expect(profileEditor).toContain("Start ownership check");
    expect(profileEditor).toContain("hosting and TLS");
    expect(businessEditor).toContain('data-testid="business-profile-domain-authority-notice"');
    expect(businessEditor).not.toContain("/api/business-profile/domain/start");
    expect(businessEditor).not.toContain("/api/business-profile/domain/verify");
  });
});
