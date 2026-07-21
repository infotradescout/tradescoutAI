import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HONEY_ONYX_DISTRIBUTOR_NAME,
  HONEY_ONYX_PROFILE_CONTENT_BLOCKS,
  HONEY_ONYX_PROFILE_IMAGES,
  HONEY_ONYX_PROFILE_SLUG,
} from "@shared/honeyOnyxProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Honey Onyx standalone public profile contract", () => {
  it("publishes Honey Onyx separately while keeping JW Stone as distributor only", () => {
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

    expect(HONEY_ONYX_PROFILE_SLUG).toBe("honey-onyx");
    expect(HONEY_ONYX_DISTRIBUTOR_NAME).toBe("JW Stone");
    expect(provisioner).toContain('product_ownership: "independent_from_distributor"');
    expect(provisioner).toContain(
      'distributor_relationship: "distribution_and_availability_contact"'
    );
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
    expect(provisioner).not.toContain('throw new Error("Honey Onyx contractor');
    expect(provisioner).toContain("userId: profileOwnerUserId");
    expect(newCompatibilityRowPath).toContain("verifiedLicensed: false");
    expect(newCompatibilityRowPath).toContain("verifiedInsured: false");
    expect(newCompatibilityRowPath).toContain("isActive: false");
    expect(existingRecommendationTargetPath).not.toContain("verifiedLicensed:");
    expect(existingRecommendationTargetPath).not.toContain("verifiedInsured:");
    expect(existingRecommendationTargetPath).not.toContain("isActive:");
    expect(provisioner).not.toContain("activeBusinessId");
    expect(provisioner).not.toContain("activeProfileId");
    expect(entry).toContain('await provisionProfile("Honey Onyx", provisionHoneyOnyxProfile)');
  });

  it("uses all six real product photos on the standalone profile", () => {
    expect(HONEY_ONYX_PROFILE_IMAGES).toHaveLength(6);
    expect(new Set(HONEY_ONYX_PROFILE_IMAGES).size).toBe(6);

    for (const image of HONEY_ONYX_PROFILE_IMAGES) {
      expect(
        fs.existsSync(path.resolve(process.cwd(), "client/public", image.replace(/^\//, ""))),
        image
      ).toBe(true);
    }

    const inventoryBlock = HONEY_ONYX_PROFILE_CONTENT_BLOCKS.find(
      (block) => block.type === "inventoryCatalog"
    );
    expect((inventoryBlock?.data as any)?.categories?.[0]?.stones?.[0]?.images).toHaveLength(6);
  });

  it("uses the reusable editorial product template below the hero", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const sections = read("client/src/pages/profile-sites/PremiumProductProfileSections.tsx");
    const premiumBlock = HONEY_ONYX_PROFILE_CONTENT_BLOCKS.find(
      (block) => block.type === "premiumProduct"
    );

    expect((premiumBlock?.data as any)?.variant).toBe("editorial-product");
    expect(theme).toContain("isPremiumProductProfileData");
    expect(theme).toContain("<PremiumProductProfileSections");
    expect(JSON.stringify(premiumBlock)).toContain("One stone. Two atmospheres.");
    expect((premiumBlock?.data as any)?.gallery?.title).toBe("See what backlighting changes.");
    expect((premiumBlock?.data as any)?.gallery?.photos).toHaveLength(6);
    expect((premiumBlock?.data as any)?.gallery?.photos?.map((photo: any) => photo.label)).toEqual([
      "Backlit",
      "Backlit",
      "Natural light",
      "Natural light",
      "Natural light",
      "Low natural light",
    ]);
    expect(sections).toContain("buildProfileInventoryShareSearch");
    expect(sections).toContain("data.gallery.photos?.[index]");
    expect(sections).toContain("activePhotoDetail.body");
    expect(sections).toContain("<TradeScoutProfileHandoff");
  });

  it("keeps market-facing copy focused on the product and Direct Connect", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
    const profileCopy = JSON.stringify(HONEY_ONYX_PROFILE_CONTENT_BLOCKS);

    expect(profileCopy).toContain("Six real material photos");
    expect(profileCopy).toContain("Private Direct Connect");
    expect(profileCopy).toContain('"hideFinishDetails":true');
    expect(profileCopy).not.toMatch(/independent|ownership|distribut(?:or|ed|ion)/i);
    expect(profileCopy).not.toContain("JW Stone");
    expect(profileCopy).toContain("actual material");
    expect(profileCopy).not.toContain("Pick the view that stopped you.");
    expect(profileCopy).not.toMatch(/\bbuilt (?:for|to|around)\b/i);
    expect(theme).toContain("text={`${stone.name} from ${displayName}`}");
    expect(theme).toContain("{ctaHeading}");
    expect(theme).toContain("contactOperatorName={contactOperatorName || undefined}");
    expect(theme).toContain("!stone.hideFinishDetails");
    expect(theme).toContain("!openStone.hideFinishDetails");
    expect(theme).not.toContain("Finish not confirmed — ask JW Stone");
    expect(panel).toContain("hasSeparateOperator");
    expect(panel).toContain("Your ${businessName} request was sent to ${operatorName}.");
  });

  it("restores all six Honey Onyx photos to the JW Stone distributor catalog", () => {
    const generated = JSON.parse(read("client/src/data/jwStoneInventory.generated.json"));
    const honeyOnyx = generated.find((stone: any) => stone.slug === "honey-onyx");

    expect(honeyOnyx?.categorySlug).toBe("onyx");
    expect(honeyOnyx?.images).toHaveLength(6);
    expect(honeyOnyx?.sourceFileIds).toHaveLength(6);
  });
});
