import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveProfilePublicMediaObjectKey } from "@shared/profilePublicMedia";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("JR's Auto Glass public profile contract", () => {
  it("provisions the confirmed owner, business, and published profile at production boot", () => {
    const provisioning = read("server/services/jrsAutoGlassProfileProvisioning.ts");
    const profileContent = read("shared/jrsAutoGlassProfile.ts");
    const authority = read("shared/publicProfileExposureRegistry.ts");
    const authorityService = read("server/services/ownerConfirmedDirectProfile.ts");
    const entry = read("server/index.ts");
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

    expect(authority).toContain('export const JRS_PROFILE_SLUG = "jrs-auto-glass"');
    expect(authority).toContain('OWNER_CONFIRMED_PROFILE_SOURCE = "owner_confirmed_profile"');
    expect(authority).toContain("[JRS_PROFILE_SLUG]: OWNER_CONFIRMED_PROFILE_SOURCE");
    expect(authorityService).toContain('from "@shared/publicProfileExposureRegistry"');
    expect(provisioning).toContain('displayName: "JR\'s Auto Glass"');
    expect(provisioning).toContain('status: "published"');
    expect(provisioning).toContain('profileVisibility: "public"');
    expect(provisioning).toContain("activeBusinessId: business.id");
    expect(provisioning).toContain("activeProfileId: profile.id");
    expect(provisioning).toContain("...existingProfileData");
    expect(provisioning).toContain(
      "notificationEmail: existingNotificationEmail || normalizedEmail"
    );
    expect(provisioning).toContain("/images/businesses/jrs-auto-glass/social-preview.jpg");
    expect(provisioning).toContain("/images/businesses/jrs-auto-glass/logo.webp");
    expect(provisioning).toContain("contentBlocks: JRS_AUTO_GLASS_GALLERY_BLOCKS");
    expect(provisioning).toContain("contractors");
    expect(provisioning).toContain("eq(contractors.userId, owner.id)");
    expect(provisioning).toContain("eq(contractors.businessId, business.id)");
    expect(provisioning).toContain("hasNoRecommendationBinding");
    expect(provisioning).toContain("hasSingleExactRecommendationBinding");
    expect(provisioning).toContain("contractor binding is ambiguous or conflicting");
    expect(provisioning).not.toContain("ownerContractors");
    expect(provisioning).not.toContain(".where(eq(contractors.userId, owner.id));");
    expect(provisioning).not.toContain("throw new Error(\"JR's Auto Glass contractor");
    expect(provisioning).toContain("businessId: business.id");
    expect(newCompatibilityRowPath).toContain("verifiedLicensed: false");
    expect(newCompatibilityRowPath).toContain("verifiedInsured: false");
    expect(newCompatibilityRowPath).toContain("isActive: false");
    expect(existingRecommendationTargetPath).not.toContain("verifiedLicensed:");
    expect(existingRecommendationTargetPath).not.toContain("verifiedInsured:");
    expect(existingRecommendationTargetPath).not.toContain("isActive:");
    expect(profileContent).toContain('type: "gallery"');
    expect(profileContent).toContain('id: "windshield-before"');
    expect(profileContent).toContain('id: "windshield-after"');
    expect(profileContent).toContain("/images/businesses/jrs-auto-glass/before.webp");
    expect(profileContent).toContain("/images/businesses/jrs-auto-glass/after.webp");
    expect(entry).toContain(
      'await provisionProfile("JR\'s Auto Glass", provisionJrsAutoGlassProfile)'
    );
  });

  it("mounts the branded theme on the canonical dynamic route", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const theme = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
    const profileContent = read("shared/jrsAutoGlassProfile.ts");

    expect(profileView).not.toMatch(/import JrsAutoGlassProfileTheme from/);
    expect(profileView).toMatch(
      /const JrsAutoGlassProfileTheme = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/JrsAutoGlassProfileTheme"\)\s*\)/
    );
    expect(profileView).toContain('profile.slug === "jrs-auto-glass"');
    expect(profileView).toContain('siteTemplate === "auto-glass"');
    expect(profileView).toContain("<JrsAutoGlassProfileBoundary>");
    expect(profileView).toContain("</JrsAutoGlassProfileBoundary>");
    expect(profileView).toMatch(
      /data-testid="jrs-auto-glass-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"/
    );
    expect(profileView).toContain("<JrsAutoGlassProfileTheme");
    expect(theme).toContain("/images/businesses/jrs-auto-glass");
    expect(theme).toContain("logo.webp");
    expect(theme).toContain("cover.webp");
    expect(profileContent).toContain("before.webp");
    expect(profileContent).toContain("after.webp");
    for (const asset of ["cover.webp", "logo.webp", "social-preview.jpg"]) {
      const publicPath = `/images/businesses/jrs-auto-glass/${asset}`;
      expect(resolveProfilePublicMediaObjectKey(publicPath)).toBe(`public-media${publicPath}`);
      expect(fs.existsSync(path.resolve(process.cwd(), `client/public${publicPath}`))).toBe(false);
    }
    expect(theme.match(/Direct Connect/g)?.length || 0).toBeGreaterThanOrEqual(3);
    expect(theme).not.toContain("Request auto glass service");
    expect(theme).not.toContain("Send job details");
    expect(profileView).toContain("recommendationsDirectory={recommendationsDirectory}");
    expect(profileView).toContain("galleryItems={galleryItems}");
    expect(profileView).toContain("sharedGallerySlug={sharedGallerySlug}");
    expect(theme).toContain("buildProfilePublicItemPath({");
    expect(theme).toContain('itemType: "gallery"');
    expect(theme).toContain("contentBlocks: publicRouteContentBlocks");
    expect(theme).toContain("listProfileGalleryItems(JRS_AUTO_GLASS_GALLERY_BLOCKS)");
    expect(theme).toContain("defaultRecentWork");
    expect(profileView).toContain("...JRS_AUTO_GLASS_GALLERY_BLOCKS");
    expect(theme).toContain("profile-gallery-${item.slug}");
    expect(theme).toContain("<ShareButton");
    expect(theme).toContain("Customer recommendations");
    expect(theme).toContain("Recent work");
    expect(theme).toContain("Before and after");
    expect(theme).not.toContain("PublicProfileProductCard");
    expect(theme).not.toContain("You&apos;re here early");
    expect(theme).toContain("0 customer recommendations have been published.");
    expect(theme).not.toContain("Your contact details stay private");
    expect(theme).not.toContain("TradeScout Business CV");
    expect(theme).not.toContain("Recommendations and completed activity");
    expect(theme).not.toContain("Contact information remains protected");
    expect(theme).not.toContain("Skip the national-chain runaround.");
    expect(theme).not.toContain("Auto glass, wherever the vehicle is");
    expect(theme).not.toContain("Damage in. Clear glass out.");
    expect(theme).not.toContain("A trust record built from real activity.");
    expect(theme).not.toContain("min-h-[610px]");
    expect(theme).not.toContain("sm:-mt-8");
    expect(theme).not.toContain("shadow-2xl");
    expect(theme).not.toContain("<footer");
    expect(
      fs.existsSync(path.resolve(process.cwd(), "client/public/u/jrs-auto-glass/index.html"))
    ).toBe(false);
  });

  it("publishes confirmed public proof without exposing direct contact details", () => {
    const theme = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
    const provisioning = read("server/services/jrsAutoGlassProfileProvisioning.ts");
    const publicSurface = `${theme}\n${provisioning}`;

    expect(publicSurface).toContain("Ponchatoula");
    expect(theme).toContain("Mobile auto glass");
    expect(theme).toContain("Windshield replacement");
    expect(theme.toLowerCase()).not.toContain("review");
    expect(theme.toLowerCase()).not.toContain("rating");
    expect(publicSurface).not.toContain("4.8");
    expect(publicSurface).not.toContain("985");
    expect(publicSurface).not.toContain("S Range Rd");
    expect(publicSurface).not.toContain("jrs.autoglass3");
    expect(theme).not.toContain("Affordable pricing");
  });

  it("routes a profile CTA to its owner through a private Direct Connect assignment", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const publicRoute = read("server/routes/profiles.ts");
    const expressRoute = read("server/routes/tradepartner-express.ts");
    const composer = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const route = read("server/routes/direct-connect.ts");
    const profileTargeting = read("server/services/directConnectProfileTargetingService.ts");

    expect(profileView).toContain(
      "const jrsDirectConnectTarget = business?.directConnectOwnerUserId"
    );
    expect(profileView).toContain(
      "target=${encodeURIComponent(business.directConnectOwnerUserId)}"
    );
    expect(profileView).toContain("Vehicle year, make, model, and VIN (if available)");
    expect(profileView).toContain("Camera or sensors near the glass");
    expect(profileView).toContain("Insurance claim or self-pay");
    expect(composer).toContain("const targetProfileSlug = prefillContextId.trim()");
    expect(composer).toContain("payload.targetProfileSlug = targetProfileSlug");
    expect(route).toContain("targetProfileSlug:");
    expect(route).toContain("await storage.getProfileBySlugPublic(body.targetProfileSlug)");
    expect(route).toContain('scope: isExplicitTarget ? "personal" : "community"');
    expect(route).toContain('visibility: isExplicitTarget ? "private" : "community"');
    expect(profileTargeting).toContain("responderUserId: args.targetProfileOwnerUserId");
    expect(profileTargeting).toContain('routingMode: "profile_direct_connect"');
    expect(profileTargeting).toContain('source: "profile_direct_connect"');
    expect(publicRoute).toContain("isOwnerConfirmedDirectProfile({");
    expect(expressRoute).toContain("const directProfileCandidate = {");
    expect(expressRoute).toContain("canExposePublishedProfilePublicly({");
    expect(expressRoute).toContain("...directProfileCandidate");
    expect(publicRoute).toContain("expressContactCapabilities");
    expect(profileView).toContain("allowCall={canExpressCall}");
  });
});
