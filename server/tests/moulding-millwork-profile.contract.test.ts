import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { userRoleEnum } from "@shared/schema";
import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_CONTENT_BLOCKS,
  MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
  MOULDING_MILLWORK_PUBLIC_SOURCES,
} from "@shared/mouldingMillworkProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Moulding & Millwork Supply public profile contract", () => {
  it("boots the provisioner and wires it into server startup", () => {
    const provisioner = read("server/services/mouldingMillworkProfileProvisioning.ts");
    const authority = read("server/services/operatorConfirmedTradePartnerProfile.ts");
    const profileRoute = read("server/routes/profiles.ts");
    const expressRoute = read("server/routes/tradepartner-express.ts");
    const directConnectRoute = read("server/routes/direct-connect.ts");
    const publicProfileHtml = read("server/publicProfileHtml.ts");
    const serverEntry = read("server/index.ts");
    const launchCheck = read("scripts/checkProfileLaunch.mjs");
    const entry = read("server/index.ts");

    expect(MOULDING_MILLWORK_PROFILE_SLUG).toBe("moulding-millwork-supply");
    expect(provisioner).toContain("slug: MOULDING_MILLWORK_PROFILE_SLUG");
    expect(provisioner).toContain('existingBusiness?.claimStatus || "claimed"');
    expect(provisioner).toContain('existingBusiness?.status || ("active" as const)');
    expect(provisioner).toContain('existingProfile?.status || ("published" as const)');
    expect(provisioner).toContain("existingBusiness.publicDiscoveryEnabled");
    expect(provisioner).toContain("tradePartner: true");
    expect(MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE).toBe(
      "operator_confirmed_tradepartner_profile"
    );
    expect(MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE).toBe(
      "operator_confirmed_tradepartner_profile_revoked"
    );
    expect(provisioner).toContain("MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE");
    expect(authority).toContain("MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE");
    expect(authority).toContain("businessProfileData.tradePartner === true");
    expect(profileRoute).toContain("resolveAuthorizedPublicProfileBySlug(slug)");
    expect(profileRoute.match(/isBusinessOwnedByProfileOwner\(/g)).toHaveLength(4);
    expect(profileRoute).toContain("Not authorized to link this business");
    expect(profileRoute).toContain("Not authorized to publish this business profile");
    expect(expressRoute).toContain("resolveAuthorizedPublicProfileBySlug(normalizedSlug)");
    expect(directConnectRoute).toContain(
      "await resolveAuthorizedPublicProfileBySlug(body.targetProfileSlug)"
    );
    expect(publicProfileHtml.match(/resolveAuthorizedPublicProfileBySlug\(slug\)/g)).toHaveLength(
      3
    );
    expect(serverEntry).toContain("resolveAuthorizedPublicProfileBySlug(slug)");
    expect(launchCheck).toContain("/api/u/${encodeURIComponent(slug)}");
    expect(launchCheck).toContain("profileApiCheck.payload?.profile?.slug");
    expect(launchCheck).toContain("Canonical profile API returns the expected hydrated profile");
    expect(entry).toContain(
      'import { provisionMouldingMillworkProfile } from "./services/mouldingMillworkProfileProvisioning";'
    );
    expect(entry).toContain(
      'await provisionProfile("Moulding & Millwork Supply", provisionMouldingMillworkProfile)'
    );
  });

  it("fails closed on squatted ownership and preserves later privacy or revocation", () => {
    const provisioner = read("server/services/mouldingMillworkProfileProvisioning.ts");
    const authority = read("server/services/operatorConfirmedTradePartnerProfile.ts");

    expect(provisioner).toContain("isProvisionedProfileAccountControlConfirmed({");
    expect(provisioner).toContain("owner provisioning refused an unconfirmed pre-existing account");
    expect(provisioner).toContain("existingOwner?.profileVisibility");
    expect(provisioner).toContain("existingPreferences.profileVisibility");
    expect(provisioner).toContain("operatorProfileAuthorityRevoked");
    expect(provisioner).toContain("MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE");
    expect(provisioner).toContain(
      "businessSources.delete(MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE)"
    );
    expect(authority).toContain(
      "!candidate.businessSources.includes(MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE)"
    );
  });

  it("only ever assigns a role that actually exists in the user_role Postgres enum", () => {
    // Regression: this provisioner previously wrote role/activeRole: "seller",
    // which is not a member of user_role and threw invalid input value for
    // enum user_role: "seller" at runtime (22P02) on every provisioning
    // attempt in production. Assert against the real enum, not a hardcoded
    // string, so a future rename/addition can't silently drift this test.
    const provisioner = read("server/services/mouldingMillworkProfileProvisioning.ts");
    const validRoles = userRoleEnum.enumValues;

    const roleMatch = provisioner.match(/role: "([^"]+)" as const/);
    const activeRoleMatch = provisioner.match(/activeRole: "([^"]+)"/);

    expect(roleMatch, 'expected a role: "..." as const literal').not.toBeNull();
    expect(activeRoleMatch, 'expected an activeRole: "..." literal').not.toBeNull();
    expect(validRoles).toContain(roleMatch![1]);
    expect(validRoles).toContain(activeRoleMatch![1]);
    expect(provisioner).not.toContain('"seller"');
  });

  it("never asserts license, insurance, verification, or CVS-boost claims that were not authorized", () => {
    const provisioner = read("server/services/mouldingMillworkProfileProvisioning.ts");

    // The Selective Inheritance source packet explicitly excludes these from
    // publication. This profile must never assert them, unlike LA Plumbing
    // (which had confirmed license/insurance evidence and operator
    // attestation) or a CVS-boosted launch.
    expect(provisioner).not.toContain("verifiedBadge");
    expect(provisioner).not.toMatch(/verificationStatus:\s*["']/);
    expect(provisioner).not.toContain("verificationRequirements");
    expect(provisioner).not.toContain("verifiedLicensed: true");
    expect(provisioner).not.toContain("verifiedInsured: true");
    expect(provisioner).not.toContain("license_verified");
    expect(provisioner).not.toContain("insurance_verified");
    expect(provisioner).not.toContain("ensureCvsPolicyBoost");
    expect(provisioner).not.toContain("trustLedgerEvents");
    expect(provisioner).not.toContain("trustScore");
    expect(provisioner).not.toContain("CVS_BOOST_POLICIES");
  });

  it("keeps Brian Koontz's confirmed contact role internal, never a public ownership claim", () => {
    const provisioner = read("server/services/mouldingMillworkProfileProvisioning.ts");
    const publicCopy = JSON.stringify(MOULDING_MILLWORK_PROFILE_CONTENT_BLOCKS);

    // He is recorded as an internal, non-public contact annotation only.
    expect(provisioner).toContain("legal_ownership_claim");
    expect(provisioner).toContain('"not_asserted"');
    expect(publicCopy).not.toContain("Brian");
    expect(publicCopy).not.toContain("Koontz");
    expect(publicCopy).not.toMatch(/\bowner\b/i);
  });

  it("publishes only sourced facts: no fabricated ratings, reviews, or guaranteed pricing/inventory", () => {
    const publicCopy = JSON.stringify(MOULDING_MILLWORK_PROFILE_CONTENT_BLOCKS).toLowerCase();

    expect(publicCopy).not.toContain("star rating");
    expect(publicCopy).not.toMatch(/customer review/);
    expect(publicCopy).not.toContain("guarantee");
    expect(publicCopy).not.toContain("licensed");
    expect(publicCopy).not.toContain("insured");
    expect(publicCopy).toContain("450+ moulding profiles stocked");
    expect(publicCopy).toContain("harahan, la");
  });

  it("uses real catalog photos from the business's own site for the inventory blocks", () => {
    const inventoryBlock = MOULDING_MILLWORK_PROFILE_CONTENT_BLOCKS.find(
      (block) => block.type === "inventoryCatalog"
    );
    const categories = (inventoryBlock?.data as any)?.categories;

    expect(Array.isArray(categories)).toBe(true);
    expect(categories).toHaveLength(2);
    for (const category of categories) {
      const images: string[] = category.stones[0].images;
      expect(images.length).toBeGreaterThan(0);
      for (const image of images) {
        expect(image).toMatch(/^https:\/\/mouldingmillworksupply\.com\//);
      }
      expect(category.stones[0].materialStatus).toBe("source_folder");
    }
  });

  it("cites only the approved primary sources", () => {
    for (const source of MOULDING_MILLWORK_PUBLIC_SOURCES) {
      expect(source).toMatch(/^https:\/\/(www\.)?(mouldingmillworksupply\.com|loewen\.com)\//);
    }
  });
});
