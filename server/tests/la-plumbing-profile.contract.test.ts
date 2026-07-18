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

    expect(presentation).toContain(
      'export const LA_PLUMBING_PROFILE_SLUG = "la-plumbing-solutions"'
    );
    expect(provisioning).toContain('verificationStatus: "approved"');
    expect(provisioning).toContain("verifiedBadge: true");
    expect(provisioning).toContain('status: "published"');
    expect(provisioning).toContain('claimStatus: "claimed"');
    expect(provisioning).toContain("publicDiscoveryEnabled: true");
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
    expect(theme).toContain("TradeScout trust snapshot");
    expect(theme).toContain("CVS {normalizedCvsScore}");
    expect(theme).toContain("You&apos;re here early");
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
    expect(publicRoute).toContain("cvsScore: Number.isFinite(publicCvsScore)");
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
