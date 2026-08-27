import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveProfilePublicMediaObjectKey } from "@shared/profilePublicMedia";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("LA Plumbing Solutions public profile contract", () => {
  it("provisions one sourced, claimed, published, verified profile", () => {
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
    expect(provisioning).not.toContain('"community_builder"');
    expect(provisioning).not.toContain('"Community Builder Badge"');
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
      entry.indexOf('await provisionProfile("LA Plumbing", provisionLaPlumbingProfile)')
    );
    expect(entry).toContain('await provisionProfile("LA Plumbing", provisionLaPlumbingProfile)');
    expect(sourceRecord).toContain("CVS 50 baseline");
    expect(sourceRecord).toContain("No external rating/review score was imported");
    expect(sourceRecord).toContain("internal-only for matching, deduplication");
    expect(sourceRecord).toContain("Required recheck cadence: every 90 days");
    expect(presentation).not.toContain("Pristine Plumbing");
  });

  it("renders a compact business profile instead of a long campaign landing page", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const theme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
    const presentation = read("shared/localServiceProfile.ts");

    expect(profileView).not.toMatch(/import LocalServiceProfileTheme(?:,| from)/);
    expect(profileView).toMatch(
      /const LocalServiceProfileTheme = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/LocalServiceProfileTheme"\)\s*\)/
    );
    expect(profileView).toContain('resolvedLocalServicePresentation.template === "local-service"');
    expect(profileView).toContain("<LocalServiceProfileBoundary>");
    expect(profileView).toContain("</LocalServiceProfileBoundary>");
    expect(profileView).toMatch(
      /data-testid="local-service-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-busy="true"/
    );
    expect(profileView).toContain("<LocalServiceProfileTheme");
    expect(theme).toContain('data-testid="local-service-profile-theme"');
    expect(theme).toContain('data-profile-layout="compact-business-profile"');
    expect(theme).toContain("{businessName}");
    expect(theme).toContain('id="services"');
    expect(theme).toContain('id="work"');
    expect(theme).toContain('id="company"');
    expect(theme).toContain('id="details"');
    expect(theme).toContain("What do you need?");
    expect(theme).toContain("Recent work");
    expect(theme).toContain("grid-cols-[minmax(0,1fr)_340px]");
    expect(theme).toContain("lg:sticky lg:top-24");
    expect(theme).toContain('openProtectedContact("request", "mobile_bar")');
    expect(theme).toContain("snap-x snap-mandatory");
    expect(theme).toContain("publicRecommendations.length > 0");
    expect(theme).not.toContain("0 customer recommendations have been published");
    expect(theme).not.toContain("min-h-[680px]");
    expect(theme).not.toContain("Choose how to start");
    expect(theme).not.toContain("Current source decision");
    expect(theme).not.toContain("One current record, not blended claims.");
    expect(theme).not.toContain("final_cta");
    expect(theme).not.toContain("presentation.sourceSummary");

    expect(presentation).toContain('primaryActionLabel: "Start a Request"');
    expect(presentation).toContain('callActionLabel: "Call LA Plumbing"');
    expect(presentation).toContain('directionsActionLabel: "Get Directions"');
    expect(presentation).toContain('websiteActionLabel: "Company Website"');
    expect(presentation).toContain(
      "Residential and commercial plumbing across southeast Louisiana."
    );
    expect(presentation).toContain("Financing available");
    expect(presentation).toContain('financingProvider: "Hearth"');
    expect(presentation).toContain("13073 Hwy 190 West, Hammond, LA 70401");
    expect(presentation).toContain("Monday–Friday · 7:00am–4:00pm");
    expect(presentation).toContain("Call to confirm availability outside regular office hours.");
    expect(presentation).not.toContain("Fox Hollow");
    expect(presentation).not.toContain("24/7");
    expect(presentation).not.toContain("legacy claims");
    expect(presentation).not.toContain("sourceSummary");
    expect(presentation).not.toContain("sourceCheckedAt");

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
      const publicPath = `/images/businesses/la-plumbing-solutions/${asset}`;
      expect(resolveProfilePublicMediaObjectKey(publicPath)).toBe(`public-media${publicPath}`);
      expect(fs.existsSync(path.resolve(process.cwd(), `client/public${publicPath}`))).toBe(false);
    }
  });

  it("keeps calling protected while making request, address, website, and directions useful", () => {
    const publicRoute = read("server/routes/profiles.ts");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const theme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
    const presentation = read("shared/localServiceProfile.ts");
    const provisioning = read("server/services/laPlumbingProfileProvisioning.ts");

    expect(publicRoute).toContain("directConnectOwnerUserId = ownerUserId");
    expect(publicRoute).toContain("call: hasGatedDirectConnectPhone");
    expect(publicRoute).toContain("hasDirectConnectPhone(gatedPhone)");
    expect(profileView).toContain("source=profile_site");
    expect(profileView).toContain("allowCall={canExpressCall}");
    expect(provisioning).toContain("LA_PLUMBING_ROUTING_PHONE");

    expect(theme).not.toContain("tel:");
    expect(theme).not.toContain("mailto:");
    expect(theme).toContain('openProtectedContact("call", "profile_header")');
    expect(theme).toContain('openProtectedContact("request", "profile_header")');
    expect(theme).toContain('openProtectedContact("call", "mobile_bar")');
    expect(theme).toContain('openProtectedContact("request", "mobile_bar")');
    expect(theme).toContain('action: "directions"');
    expect(theme).toContain('action: "website"');

    expect(presentation).toContain("https://www.laplumbingsolutions.com/");
    expect(presentation).toContain("https://www.google.com/maps/search/");
    expect(presentation).not.toContain("tracy@laplumbingsolutions.com");
    expect(presentation).not.toContain("(985) 551-0589");
  });

  it("keeps credential evidence available without leading with it", () => {
    const theme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
    const presentation = read("shared/localServiceProfile.ts");
    const sourceRecord = read("docs/profile-sources/LA_PLUMBING_SOLUTIONS.md");

    expect(presentation).toContain("Louisiana State Licensing Board for Contractors");
    expect(presentation).toContain("State Plumbing Board of Louisiana");
    expect(presentation).toContain("https://lslbc.louisiana.gov/verify-licensure/");
    expect(presentation).toContain("https://www.spbla.com/");
    expect(presentation).toContain('checkedAt: "August 18, 2026"');
    expect(presentation).toContain("Confirm current status with LSLBC");
    expect(presentation).toContain("Published by LA Plumbing; verify with the board");
    expect(presentation).toContain(
      "Confirm current status with the issuing authority before regulated work."
    );

    expect(theme).toContain("View credential numbers");
    expect(theme).toContain("Source reviewed {credential.checkedAt}");
    expect(theme).toContain("Credentials and trust");
    expect(theme).toContain("<details");
    expect(theme).toContain("Community Verification Score · {verificationScore}");

    expect(sourceRecord).toContain(
      "The profile must not claim that every credential is currently active"
    );
    expect(sourceRecord).toContain("TradeScout does not replace a current authority lookup");
    expect(sourceRecord).toContain("BBB is supporting evidence only");
  });

  it("records non-blocking profile action metadata without user-entered job or contact content", () => {
    const theme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
    const tracker = theme.slice(
      theme.indexOf("function trackProfileAction"),
      theme.indexOf("function externalActionProps")
    );

    expect(tracker).toContain('type: "public_profile_action_selected"');
    expect(tracker).toContain("profileSlug");
    expect(tracker).toContain("action");
    expect(tracker).toContain("surface");
    expect(tracker).toContain("detail");
    expect(tracker).toContain("deviceType");
    expect(tracker).toContain("ts");
    expect(tracker).toContain("navigator.sendBeacon");
    expect(tracker).toContain("keepalive: true");
    expect(tracker).toContain(".catch(() => undefined)");

    for (const forbidden of [
      "phone",
      "email",
      "address",
      "requestText",
      "messageText",
      "uploadedContent",
      "privateNotes",
      "window.location.href",
    ]) {
      expect(tracker).not.toContain(forbidden);
    }
  });

  it("supports sharing each completed-work photo with its own preview target", () => {
    const theme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");

    expect(theme).toContain("buildProfilePublicItemPath({");
    expect(theme).toContain('itemType: "gallery"');
    expect(theme).toContain("contentBlocks: publicRouteContentBlocks");
    expect(theme).toContain("profile-gallery-${item.slug}");
    expect(profileView).toContain("createProfileGalleryItemShareMetadata");
    expect(profileView).toContain("const pageOgType = inventoryItemShareMeta");
    expect(profileView).toContain(": galleryItemShareMeta");
    expect(profileView).toContain('? "article"');
    expect(profileView).toContain("ogType={pageOgType}");
  });
});
