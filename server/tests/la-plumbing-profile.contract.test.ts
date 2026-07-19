import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("LA Plumbing Solutions public profile contract", () => {
  it("provisions one sourced, claimed, published, fully verified profile", () => {
    const provisioning = read("server/services/laPlumbingProfileProvisioning.ts");
    const presentation = read("shared/localServiceProfile.ts");
    const entry = read("server/index.ts");
    const sourceRecord = read("docs/profile-sources/LA_PLUMBING_SOLUTIONS.md");
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

    expect(presentation).toContain(
      'export const LA_PLUMBING_PROFILE_SLUG = "la-plumbing-solutions"'
    );
    expect(provisioning).toContain('verificationStatus: "approved"');
    expect(provisioning).toContain("verifiedBadge: true");
    expect(provisioning).toContain('status: "published"');
    expect(provisioning).toContain('claimStatus: "claimed"');
    expect(provisioning).toContain("publicDiscoveryEnabled: true");
    expect(provisioning).toContain('"community_builder"');
    expect(provisioning).toContain('"Community Builder Badge"');
    expect(provisioning).toContain("show: shouldShowBadges");
    expect(provisioning).toContain("rolesAndBadges: shouldShowRolesAndBadges");
    expect(provisioning).toContain("communityActivity: true");
    expect(provisioning).toContain("verifiedBaseline: 50");
    expect(provisioning).toContain('policyKey: "verified_profile_launch"');
    expect(provisioning).toContain('policyKey: "operator_firsthand_attestation"');
    expect(provisioning).toContain('policyKey: "verified_portfolio_evidence"');
    expect(provisioning).toContain('relationshipType: "personal_knowledge"');
    expect(provisioning).toContain('classification: "completed_work_not_inventory"');
    expect(provisioning).toContain(
      'export const LA_PLUMBING_INTERNAL_FORMER_NAME = "Pristine Plumbing"'
    );
    expect(provisioning).toContain('former_business_name_visibility: "internal_only"');
    expect(provisioning).toContain("noPaidBoost: true");
    expect(provisioning).toContain("runTrustSnapshotForUser");
    expect(provisioning).toContain("eq(contractors.userId, owner.id)");
    expect(provisioning).toContain("eq(contractors.businessId, business.id)");
    expect(provisioning).toContain("hasNoRecommendationBinding");
    expect(provisioning).toContain("hasSingleExactRecommendationBinding");
    expect(provisioning).toContain("contractor binding is ambiguous or conflicting");
    expect(provisioning).not.toContain('throw new Error("LA Plumbing contractor');
    expect(provisioning).not.toContain('throw new Error("LA Plumbing has multiple contractor');
    expect(newCompatibilityRowPath).toContain("verifiedLicensed: false");
    expect(newCompatibilityRowPath).toContain("verifiedInsured: false");
    expect(newCompatibilityRowPath).toContain("isActive: false");
    expect(existingRecommendationTargetPath).not.toContain("verifiedLicensed:");
    expect(existingRecommendationTargetPath).not.toContain("verifiedInsured:");
    expect(existingRecommendationTargetPath).not.toContain("isActive:");
    expect(provisioning).not.toContain("trustScore: 100");
    expect(entry).toContain("await ensureTrustLedgerEventsTable()");
    expect(entry.indexOf("await ensureTrustLedgerEventsTable()")).toBeLessThan(
      entry.indexOf("await provisionLaPlumbingProfile()")
    );
    expect(entry).toContain("await provisionLaPlumbingProfile()");
    expect(sourceRecord).toContain("CVS 50 baseline");
    expect(sourceRecord).toContain("No external rating/review score was imported");
    expect(sourceRecord).toContain("internal matching, deduplication");
    expect(presentation).not.toContain("Pristine Plumbing");
    expect(presentation).toContain(
      "Historical jobs, reviews, and recommendations have not yet been imported"
    );
  });

  it("renders the reusable local-service theme with real LA Plumbing assets", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const theme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
    const presentation = read("shared/localServiceProfile.ts");

    expect(profileView).toContain("import LocalServiceProfileTheme");
    expect(profileView).toContain('localServicePresentation?.template === "local-service"');
    expect(profileView).toContain("<LocalServiceProfileTheme");
    expect(theme).toContain('data-testid="local-service-profile-theme"');
    expect(theme.match(/Direct Connect/g)?.length || 0).toBeGreaterThanOrEqual(4);
    expect(theme).toContain("Verified by TradeScout");
    expect(profileView).toContain("communityVerification={business?.communityVerification}");
    expect(theme).toContain('data-testid="community-verification-card"');
    expect(theme).toContain("Community Verification Score");
    expect(theme).toContain("30-day history unavailable");
    expect(theme).toContain("Lifetime score change");
    expect(theme).toContain("30-day score change");
    expect(theme).toContain("Active boosts");
    expect(theme).toContain("Profile badges");
    expect(theme).toContain("0 customer recommendations have been published");
    expect(theme).not.toContain("TradeScout trust snapshot");
    expect(theme).not.toContain("CVS {normalizedCvsScore}");
    expect(theme).not.toContain("You&apos;re here early");
    expect(theme).not.toContain("Request service");
    expect(theme).not.toContain("Contact now");
    expect(theme).not.toContain("window.history.back()");
    expect(presentation).toContain("LA Plumbing Solutions on the job.");
    expect(presentation).toContain("Selected residential, commercial, renovation");
    expect(presentation).not.toContain("See their plumbing work.");
    expect(presentation).toContain(
      'heroImage: "/images/businesses/la-plumbing-solutions/hero.jpg"'
    );
    expect(presentation).toContain("Master licensed plumbers");
    expect(presentation).toContain("Your comfort is our mission.");
    expect(presentation).toContain("serviceGroups:");
    expect(theme).toContain('id="work"');
    expect(theme).toContain('id="story"');
    expect(theme).toContain('id="services"');
    expect(theme).toContain('id="trust"');
    expect(theme).toContain("Open any photo full screen");
    expect(presentation).toContain("Flexible project financing");

    for (const asset of [
      "logo.jpg",
      "social-preview.jpg",
      "hero.jpg",
      "family.jpg",
      "new-construction.jpg",
      "bathroom.jpg",
      "commercial-restroom.jpg",
      "tankless.jpg",
      "underground.jpg",
      "trench.jpg",
      "mechanical-room.jpg",
      "water-heaters.jpg",
    ]) {
      expect(
        fs.existsSync(
          path.resolve(
            process.cwd(),
            `client/public/images/businesses/la-plumbing-solutions/${asset}`
          )
        )
      ).toBe(true);
    }
  });

  it("keeps all contact inside targeted Direct Connect", () => {
    const publicRoute = read("server/routes/profiles.ts");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const theme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
    const presentation = read("shared/localServiceProfile.ts");
    const provisioning = read("server/services/laPlumbingProfileProvisioning.ts");

    expect(publicRoute).toContain("directConnectOwnerUserId = ownerUserId");
    expect(publicRoute).toContain("call: hasGatedDirectConnectPhone");
    expect(publicRoute).toContain("hasDirectConnectPhone(gatedPhone)");
    expect(publicRoute).toContain("verificationStatus: publicVerificationStatus");
    expect(publicRoute).toContain("cvsScore: publicCvsScore");
    expect(profileView).toContain("source=profile_site");
    expect(profileView).toContain("allowCall={canExpressCall}");
    expect(provisioning).toContain("LA_PLUMBING_ROUTING_PHONE");
    expect(presentation).toContain("Form details stay private");
    expect(theme).not.toContain("tel:");
    expect(theme).not.toContain("mailto:");
    expect(theme).toContain("Call or send the job details privately");
  });

  it("supports sharing each completed-work photo with its own preview target", () => {
    const theme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");

    expect(theme).toContain("buildProfileGalleryShareSearch(item.slug)");
    expect(theme).toContain("profile-gallery-${item.slug}");
    expect(profileView).toContain("createProfileGalleryItemShareMetadata");
    expect(profileView).toContain('ogType={galleryItemShareMeta ? "article" : "profile"}');
  });
});
