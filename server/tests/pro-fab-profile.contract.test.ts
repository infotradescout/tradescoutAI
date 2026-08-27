import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROFILE_PUBLIC_MEDIA_MANIFEST,
  resolveProfilePublicMediaObjectKey,
} from "@shared/profilePublicMedia";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("Pro Fab Specialty Services public profile contract", () => {
  it("provisions a pending, unverified, non-discoverable profile with private routing data", () => {
    const provisioning = read("server/services/proFabProfileProvisioning.ts");
    const existingOwnerUpdate = provisioning.slice(
      provisioning.indexOf("? await tx"),
      provisioning.indexOf(": await tx", provisioning.indexOf("? await tx"))
    );

    expect(provisioning).toContain("PRO_FAB_PROFILE_SLUG");
    expect(provisioning).toContain('name: "Pro Fab Specialty Services LLC"');
    expect(provisioning).toContain('displayName: "Pro Fab Specialty Services LLC"');
    expect(provisioning).toContain('verificationStatus: "pending"');
    expect(provisioning).toContain("verifiedBadge: false");
    expect(provisioning).toContain("emailVerified: false");
    expect(provisioning).toContain("addressVerified: false");
    expect(existingOwnerUpdate).not.toContain("verificationStatus:");
    expect(existingOwnerUpdate).not.toContain("verifiedBadge:");
    expect(provisioning).toContain("publicDiscoveryEnabled: false");
    expect(provisioning).toContain('status: "active"');
    expect(provisioning).toContain('status: "published"');
    expect(provisioning).toContain('profileVisibility: "public"');
    expect(provisioning).toContain('claimStatus: existingBusiness?.claimStatus || "unclaimed"');
    expect(provisioning).toContain(
      "activeBusinessId: existingOwner?.activeBusinessId || business.id"
    );
    expect(provisioning).toContain("activeProfileId: existingOwner?.activeProfileId || profile.id");
    expect(provisioning).toContain("process.env.PRO_FAB_OWNER_EMAIL");
    expect(provisioning).toContain("process.env.PRO_FAB_ROUTING_PHONE");
    expect(provisioning).not.toContain("Buffer.from(");
    expect(provisioning).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(provisioning).not.toMatch(/\(?\d{3}\)?[- .]\d{3}[- .]\d{4}/);
  });

  it("creates one strictly matched, inactive recommendation compatibility target", () => {
    const provisioning = read("server/services/proFabProfileProvisioning.ts");
    const recommendationInsertStart = provisioning.indexOf(
      "} else if (hasNoRecommendationBinding)"
    );
    const recommendationUpdateStart = provisioning.indexOf(
      "} else {",
      recommendationInsertStart + 1
    );
    const recommendationBlockEnd = provisioning.indexOf(
      "const [existingProfile]",
      recommendationUpdateStart
    );
    const newCompatibilityRowPath = provisioning.slice(
      recommendationInsertStart,
      recommendationUpdateStart
    );
    const existingRecommendationTargetPath = provisioning.slice(
      recommendationUpdateStart,
      recommendationBlockEnd
    );

    expect(provisioning).toContain("contractors");
    expect(provisioning).toContain("eq(contractors.userId, owner.id)");
    expect(provisioning).toContain("eq(contractors.businessId, business.id)");
    expect(provisioning).toContain("hasNoRecommendationBinding");
    expect(provisioning).toContain("hasSingleExactRecommendationBinding");
    expect(provisioning).toContain("contractor binding is ambiguous or conflicting");
    expect(provisioning).not.toContain("ownerContractors");
    expect(provisioning).not.toContain(".where(eq(contractors.userId, owner.id));");
    expect(provisioning).not.toContain('throw new Error("Pro Fab contractor');
    expect(provisioning).toContain("businessId: business.id");
    expect(newCompatibilityRowPath).toContain("verifiedLicensed: false");
    expect(newCompatibilityRowPath).toContain("verifiedInsured: false");
    expect(newCompatibilityRowPath).toContain("isActive: false");
    expect(existingRecommendationTargetPath).not.toContain("verifiedLicensed:");
    expect(existingRecommendationTargetPath).not.toContain("verifiedInsured:");
    expect(existingRecommendationTargetPath).not.toContain("isActive:");
  });

  it("uses the explicit slug-and-source authority exception without asserting verification", () => {
    const authorityRegistry = read("shared/publicProfileExposureRegistry.ts");
    const authorityService = read("server/services/ownerConfirmedDirectProfile.ts");
    const provisioning = read("server/services/proFabProfileProvisioning.ts");

    expect(authorityRegistry).toContain('PRO_FAB_PROFILE_SLUG = "pro-fab-specialty-services"');
    expect(authorityRegistry).toContain(
      'ADMIN_MANAGED_PROFILE_SOURCE = "admin_provisioned_business_profile"'
    );
    expect(authorityRegistry).toContain("[PRO_FAB_PROFILE_SLUG]: ADMIN_MANAGED_PROFILE_SOURCE");
    expect(authorityService).toContain(
      '} from "@shared/publicProfileExposureRegistry";'
    );
    expect(authorityService).toContain("PRO_FAB_PROFILE_SLUG,");
    expect(authorityService).toContain("ADMIN_MANAGED_PROFILE_SOURCE,");
    expect(provisioning).toContain(
      "PRO_FAB_PROFILE_PROVISIONING_SOURCE = ADMIN_MANAGED_PROFILE_SOURCE"
    );
    expect(provisioning).not.toContain('verificationStatus: "approved"');
  });

  it("mounts the branded theme and Express Direct Connect on the canonical route", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const entry = read("server/index.ts");
    const proFabBranchStart = profileView.indexOf(
      'if (profile.slug === "pro-fab-specialty-services")'
    );
    const proFabBranchEnd = profileView.indexOf(
      "\n  if (\n    resolvedLocalServicePresentation",
      proFabBranchStart
    );
    const proFabBranch = profileView.slice(proFabBranchStart, proFabBranchEnd);
    const generalDirectConnectStart = profileView.indexOf(
      "const openGeneralDirectConnect = () => {"
    );
    const generalDirectConnectEnd = profileView.indexOf("};", generalDirectConnectStart);
    const generalDirectConnect = profileView.slice(
      generalDirectConnectStart,
      generalDirectConnectEnd
    );

    expect(profileView).not.toContain('import ProFabProfileTheme from');
    expect(profileView).toMatch(
      /const ProFabProfileTheme = lazy\(\(\) => import\("@\/pages\/profile-sites\/ProFabProfileTheme"\)\)/
    );
    expect(profileView).toContain('profile.slug === "pro-fab-specialty-services"');
    expect(proFabBranchStart).toBeGreaterThanOrEqual(0);
    expect(proFabBranchEnd).toBeGreaterThan(proFabBranchStart);
    expect(proFabBranch).toContain("<ProFabProfileTheme");
    expect(proFabBranch).toContain("<ProFabProfileBoundary>");
    expect(profileView).toContain('data-testid="pro-fab-profile-loading"');
    expect(profileView).toContain('role="status"');
    expect(profileView).toContain('aria-live="polite"');
    expect(proFabBranch.indexOf("<SEOHelmet")).toBeLessThan(
      proFabBranch.indexOf("<ProFabProfileBoundary>")
    );
    expect(proFabBranch.indexOf("{manageChrome}")).toBeLessThan(
      proFabBranch.indexOf("<ProFabProfileBoundary>")
    );
    expect(proFabBranch.indexOf("{templateIndependentInventoryContext}")).toBeLessThan(
      proFabBranch.indexOf("<ProFabProfileBoundary>")
    );
    expect(proFabBranch.indexOf("</ProFabProfileBoundary>")).toBeLessThan(
      proFabBranch.indexOf("<ExpressDirectConnectPanel")
    );
    expect(proFabBranch).toContain('trustActions={renderProfileTrustActions("dark")}');
    expect(proFabBranch).toContain("recommendationsDirectory={recommendationsDirectory}");
    expect(proFabBranch).toContain("onDirectConnect={openGeneralDirectConnect}");
    expect(proFabBranch).toContain(
      'requestMode={expressInventoryContext ? "materials" : "service"}'
    );
    expect(proFabBranch).toContain("initialStoneName={expressInventoryContext?.itemName}");
    expect(proFabBranch).toContain("initialItemId={expressInventoryContext?.itemId}");
    expect(proFabBranch).toContain(
      'initialRequestType={expressInventoryContext ? "request_material" : null}'
    );
    expect(generalDirectConnectStart).toBeGreaterThanOrEqual(0);
    expect(generalDirectConnect).toContain("setExpressInventoryContext(null)");
    expect(generalDirectConnect).toContain("setExpressPanelOpen(true)");
    expect(entry).toContain("import { provisionProFabProfile }");
    expect(entry).toContain('await provisionProfile("ProFab", provisionProFabProfile)');
  });

  it("renders honest business-name artwork, responsive DOM service cards, and community actions near the top", () => {
    const theme = read("client/src/pages/profile-sites/ProFabProfileTheme.tsx");
    const provisioning = read("server/services/proFabProfileProvisioning.ts");

    expect(theme).toContain("/images/businesses/pro-fab-specialty-services");
    expect(theme).toContain("logo.svg");
    expect(theme).toContain("cover.svg");
    expect(theme).toContain("capabilities.svg");
    for (const asset of ["logo.svg", "cover.svg", "capabilities.svg", "social-preview.jpg"]) {
      const publicPath = `/images/businesses/pro-fab-specialty-services/${asset}`;
      expect(resolveProfilePublicMediaObjectKey(publicPath)).toBe(`public-media${publicPath}`);
      expect(fs.existsSync(path.resolve(process.cwd(), `client/public${publicPath}`))).toBe(false);
      const manifestEntry = PROFILE_PUBLIC_MEDIA_MANIFEST.assets.find(
        (candidate) => candidate.publicPath === publicPath
      );
      expect(manifestEntry?.gitBlobSha).toMatch(/^[a-f0-9]{40}$/);
      expect(manifestEntry?.bytes).toBeGreaterThan(0);
    }
    expect(provisioning).toContain(
      "/images/businesses/pro-fab-specialty-services/social-preview.jpg"
    );
    expect(
      PROFILE_PUBLIC_MEDIA_MANIFEST.assets.find((asset) => asset.publicPath.endsWith("logo.svg"))
        ?.contentType
    ).toBe("image/svg+xml");
    expect(theme).toContain("services.map");
    expect(theme).toContain('className="hidden border-b border-white/10 px-6 py-7 md:block"');
    expect(theme.indexOf("{trustActions ?")).toBeLessThan(theme.indexOf("services.map"));
    expect(theme).toContain("Direct Connect with Pro Fab");
    expect(theme).toContain("bg-ts-orange");
  });

  it("publishes supplied scope without ratings, reviews, or verification claims", () => {
    const theme = read("client/src/pages/profile-sites/ProFabProfileTheme.tsx");

    expect(theme).toContain("Custom metal fabrication");
    expect(theme).toContain("Structural steel fabrication & installation");
    expect(theme).toContain("Pipe fabrication & process piping");
    expect(theme).toContain("MIG, TIG, stick & flux-core welding");
    expect(theme).toContain("Mobile on-site welding & field service");
    expect(theme).toContain("Equipment & heavy machinery repairs");
    expect(theme).toContain("Plant maintenance & shutdown support");
    expect(theme).toContain("Industrial maintenance & emergency repair");
    expect(theme).toContain("Hammond, Louisiana and surrounding areas");
    expect(theme.toLowerCase()).not.toContain("rating");
    expect(theme.toLowerCase()).not.toContain("review");
    expect(theme).not.toContain("Licensed");
    expect(theme).not.toContain("Insured");
    expect(theme).not.toContain("Verified");
    expect(theme).not.toContain("TradeScout Business CV");
  });
});
