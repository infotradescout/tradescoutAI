import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ISSA_BUILD_BUSINESS_NAME,
  ISSA_BUILD_HERO_POSTER,
  ISSA_BUILD_HERO_VIDEO,
  ISSA_BUILD_LEGACY_PROFILE_SLUG,
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
  ISSA_BUILD_PROFILE_IMAGES,
  ISSA_BUILD_PROFILE_SLUG,
  isIssaBuildProfileSlug,
} from "@shared/issaBuildProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("ISSA Build public profile contract", () => {
  it("provisions ISSA Build as its own business without borrowing another company's contact", () => {
    const provisioner = read("server/services/honeyOnyxProfileProvisioning.ts");
    const entry = read("server/index.ts");
    const recommendationInsertStart = provisioner.indexOf("} else if (hasNoRecommendationBinding)");
    const recommendationUpdateStart = provisioner.indexOf(
      "} else {",
      recommendationInsertStart + 1
    );
    const recommendationBlockEnd = provisioner.indexOf(
      "const profileValues",
      recommendationUpdateStart
    );
    const newCompatibilityRowPath = provisioner.slice(
      recommendationInsertStart,
      recommendationUpdateStart
    );
    const existingRecommendationTargetPath = provisioner.slice(
      recommendationUpdateStart,
      recommendationBlockEnd
    );

    expect(ISSA_BUILD_PROFILE_SLUG).toBe("issa-build");
    expect(ISSA_BUILD_LEGACY_PROFILE_SLUG).toBe("honey-onyx");
    expect(ISSA_BUILD_BUSINESS_NAME).toBe("ISSA Build");
    expect(isIssaBuildProfileSlug("issa-build")).toBe(true);
    expect(isIssaBuildProfileSlug("honey-onyx")).toBe(true);
    expect(isIssaBuildProfileSlug("jw-stone")).toBe(false);

    expect(provisioner).toContain('ownership: "independent_business"');
    expect(provisioner).not.toContain("distributorBusiness");
    expect(provisioner).not.toContain("JW_STONE_PROFILE_SLUG");
    expect(provisioner).not.toContain("distributorPhone");
    expect(provisioner).not.toMatch(/distributor_name:\s*HONEY|distributor_name:\s*ISSA/);
    expect(provisioner).toContain("tradescout_admin_pending_owner_account_transfer");
    expect(provisioner).toContain("claimStatus:");
    expect(provisioner).toContain('status: "published"');
    expect(provisioner).toContain("publicDiscoveryEnabled: true");
    expect(provisioner).toContain('profileVisibility: "public"');
    expect(provisioner).toContain("profileOwnerUserId === String(steward.id)");
    expect(provisioner).toContain("eq(contractors.userId, profileOwnerUserId)");
    expect(provisioner).toContain("eq(contractors.businessId, business.id)");
    expect(provisioner).toContain("hasNoRecommendationBinding");
    expect(provisioner).toContain("hasSingleExactRecommendationBinding");
    expect(provisioner).toContain("contractor binding is ambiguous or conflicting");
    expect(provisioner).toContain("userId: profileOwnerUserId");
    expect(newCompatibilityRowPath).toContain("verifiedLicensed: false");
    expect(newCompatibilityRowPath).toContain("verifiedInsured: false");
    expect(newCompatibilityRowPath).toContain("isActive: false");
    expect(existingRecommendationTargetPath).not.toContain("verifiedLicensed:");
    expect(existingRecommendationTargetPath).not.toContain("verifiedInsured:");
    expect(existingRecommendationTargetPath).not.toContain("isActive:");
    expect(provisioner).not.toContain("activeBusinessId");
    expect(provisioner).not.toContain("activeProfileId");
    expect(entry).toContain('await provisionProfile("ISSA Build", provisionIssaBuildProfile)');
  });

  it("uses ISSA Build application photos on the public profile", () => {
    expect(ISSA_BUILD_PROFILE_IMAGES).toHaveLength(6);
    expect(new Set(ISSA_BUILD_PROFILE_IMAGES).size).toBe(6);

    for (const image of ISSA_BUILD_PROFILE_IMAGES) {
      expect(
        fs.existsSync(path.resolve(process.cwd(), "client/public", image.replace(/^\//, ""))),
        image
      ).toBe(true);
    }

    const inventoryBlock = ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find(
      (block) => block.type === "inventoryCatalog"
    );
    expect(
      (inventoryBlock?.data as any)?.categories?.[0]?.stones?.[0]?.images.length
    ).toBeGreaterThanOrEqual(6);
  });

  it("uses the dedicated ISSA Build hero video", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");

    expect(ISSA_BUILD_HERO_VIDEO).toBe("/images/businesses/issa-build/video/hero.mp4");
    expect(ISSA_BUILD_HERO_POSTER).toBe("/images/businesses/issa-build/video/hero-poster.jpg");
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "client/public", ISSA_BUILD_HERO_VIDEO.replace(/^\//, ""))
      )
    ).toBe(true);
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "client/public", ISSA_BUILD_HERO_POSTER.replace(/^\//, ""))
      )
    ).toBe(true);
    expect(theme).toContain("ISSA_BUILD_HERO_VIDEO");
    expect(theme).toContain("ISSA_BUILD_HERO_POSTER");
    expect(theme).toContain("isIssaBuildProfileSlug");
    expect(theme).toContain('src: "/images/businesses/jw-stone/video/hero.mp4"');
    expect(theme.indexOf("ISSA_BUILD_HERO_VIDEO")).toBeLessThan(
      theme.indexOf('src: "/images/businesses/jw-stone/video/hero.mp4"')
    );
  });

  it("uses the reusable editorial product template below the hero", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const sections = read("client/src/pages/profile-sites/PremiumProductProfileSections.tsx");
    const premiumBlock = ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find(
      (block) => block.type === "premiumProduct"
    );

    expect((premiumBlock?.data as any)?.variant).toBe("editorial-product");
    expect(theme).toContain("isPremiumProductProfileData");
    expect(theme).toContain("<PremiumProductProfileSections");
    expect(theme).toContain("<TradeScoutProfileHandoff");
    expect(JSON.stringify(premiumBlock)).toContain("Honey and jade. Day and night.");
    expect((premiumBlock?.data as any)?.gallery?.photos).toHaveLength(6);
    expect(sections).toContain("buildProfileInventoryShareSearch");
    expect(sections).not.toContain("<TradeScoutProfileHandoff");
  });

  it("keeps public copy on ISSA Build product and Direct Connect only", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
    const profileCopy = JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);

    expect(profileCopy).toContain("Private Direct Connect");
    expect(profileCopy).toContain("ISSA Build");
    expect(profileCopy).toContain('"hideFinishDetails":true');
    expect(profileCopy).not.toMatch(/distribut(?:or|ed|ion)/i);
    expect(profileCopy).not.toContain("JW Stone");
    expect(profileCopy).not.toMatch(/co-?locat|same lot|share(?:s|d)? space/i);
    expect(profileCopy).not.toMatch(/850-|issaichev|@gmail\.com|password/i);
    expect(theme).toContain("text={`${stone.name} from ${displayName}`}");
    expect(theme).toContain("{ctaHeading}");
    expect(theme).toContain("contactOperatorName={contactOperatorName || undefined}");
    expect(panel).toContain("hasSeparateOperator");
  });
});
