import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRECISION_AERIAL_BUSINESS_NAME,
  PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS,
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_PUBLIC_SOURCES,
  PRECISION_AERIAL_STEWARD_PROVIDER,
} from "@shared/precisionAerialProfile";
import { userRoleEnum } from "@shared/schema";
import {
  ADMIN_MANAGED_PROFILE_SOURCE,
  hasTradeScoutPendingOwnerCustody,
  isOwnerConfirmedDirectProfile,
} from "../services/ownerConfirmedDirectProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Precision Aerial production profile contract", () => {
  it("keeps the public identity plain, media-first, and limited to supported work", () => {
    const publicCopy = JSON.stringify(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS).toLowerCase();
    const hero = PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS.find((block) => block.type === "hero");

    expect(PRECISION_AERIAL_PROFILE_SLUG).toBe("precision-aerial-services");
    expect(PRECISION_AERIAL_BUSINESS_NAME).toBe("Precision Aerial Services");
    expect(hero?.data.title).toBe("A better view.");
    expect(hero?.data.text).toBe("Drone photo and video.");
    expect(PRECISION_AERIAL_PUBLIC_SOURCES).toContain(
      "https://www.instagram.com/precisionaerialservice/"
    );
    for (const unsupported of [
      "certified",
      "certification",
      "inspection",
      "survey",
      "mapping",
      "thermal",
      "lidar",
      "fleet",
      "insurance",
    ]) {
      expect(publicCopy).not.toContain(unsupported);
    }
  });

  it("uses a dedicated internal steward and fails closed on ownership or claim collisions", () => {
    const source = read("server/services/precisionAerialProfileProvisioning.ts");

    expect(source).toContain('if (process.env.NODE_ENV !== "production") return');
    expect(PRECISION_AERIAL_STEWARD_PROVIDER).toBe("admin_provisioned_profile_steward");
    expect(userRoleEnum.enumValues).toContain("content_creator");
    expect(source).toContain('role: "content_creator"');
    expect(source).not.toContain('"photographer_videographer"');
    expect(source).toContain("@profile-steward.invalid");
    expect(source).not.toContain("MASTER_ADMIN_EMAIL");
    expect(source).not.toContain("MASTER_ADMIN_PASSWORD");
    expect(source).toContain("internalProfileSteward");
    expect(source).toContain('profileVisibility: "public"');
    for (const section of [
      "about",
      "rolesAndBadges",
      "stats",
      "services",
      "marketplaceListings",
      "reviews",
      "communityActivity",
      "contactCard",
    ]) {
      expect(source).toContain(`${section}: false`);
    }
    expect(source).toContain('claimStatus: "unclaimed"');
    expect(source).toContain("publicDiscoveryEnabled: false");
    expect(source).toContain('status: "active"');
    expect(source).toContain('status: "published"');
    expect(source).toContain("PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS");
    expect(source).toContain("PRECISION_AERIAL_PROFILE_PROVISIONING_SOURCE");
    expect(source).toContain("business is claimed; provisioning will not overwrite it");
    expect(source).toContain("business slug is owned by a non-steward account");
    expect(source).toContain("profile slug is owned by a non-steward account");
    expect(source).toContain("profile is unpublished; provisioning will not republish it");
    expect(source).not.toMatch(/\b(phone|address):\s*["'`]/i);
    expect(source).not.toContain('verificationStatus: "approved"');
    expect(source).not.toContain("verifiedBadge: true");
  });

  it("grants Direct Connect authority only for the exact slug, source, and owner match", () => {
    const valid = {
      profileSlug: PRECISION_AERIAL_PROFILE_SLUG,
      profileStatus: "published",
      profileOwnerUserId: "steward-user",
      businessStatus: "active",
      businessOwnerUserId: "steward-user",
      publicDiscoveryEnabled: false,
      businessSources: [ADMIN_MANAGED_PROFILE_SOURCE, ...PRECISION_AERIAL_PUBLIC_SOURCES],
      businessClaimStatus: "unclaimed",
      ownerProvider: PRECISION_AERIAL_STEWARD_PROVIDER,
      ownerPreferences: {
        internalProfileSteward: {
          profileSlug: PRECISION_AERIAL_PROFILE_SLUG,
          source: ADMIN_MANAGED_PROFILE_SOURCE,
        },
      },
    };

    expect(isOwnerConfirmedDirectProfile(valid)).toBe(true);
    expect(hasTradeScoutPendingOwnerCustody(valid)).toBe(true);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        profileSlug: "another-drone-profile",
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        businessOwnerUserId: "someone-else",
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        businessSources: [...PRECISION_AERIAL_PUBLIC_SOURCES],
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        publicDiscoveryEnabled: true,
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        businessClaimStatus: "claimed",
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        ownerProvider: "google",
      })
    ).toBe(false);
    expect(
      isOwnerConfirmedDirectProfile({
        ...valid,
        ownerPreferences: {},
      })
    ).toBe(false);
  });

  it("runs through the non-fatal startup wrapper and allows approved profile media", () => {
    const entry = read("server/index.ts");
    const theme = read("client/src/pages/profile-sites/VideographerProfileTheme.tsx");

    expect(entry).toContain(
      'import { provisionPrecisionAerialProfile } from "./services/precisionAerialProfileProvisioning"'
    );
    expect(entry).toContain(
      'await provisionProfile("Precision Aerial", provisionPrecisionAerialProfile)'
    );
    expect(entry).not.toMatch(/await provisionPrecisionAerialProfile\(\);/);
    expect(entry).toContain('"https://www.instagram.com"');
    expect(entry).toContain('"media-src": [');
    expect(entry).toContain('"https://www.thetradescout.com"');
    expect(theme).toContain("instagramEmbedLoaded");
    expect(theme).toContain("Playing loads Instagram content and shares browser data with Meta.");
    expect(theme).toContain('referrerPolicy="no-referrer"');
    expect(theme).not.toContain('loading="eager"');
  });

  it("discloses TradeScout custody before and after a pre-owner request", () => {
    const expressRoute = read("server/routes/tradepartner-express.ts");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
    const publicRoute = read("server/routes/profiles.ts");

    expect(expressRoute).toContain('deliveryCustody: "business" | "tradescout_pending_owner"');
    expect(expressRoute).toContain(
      'delivered: target.deliveryCustody === "business"'
    );
    expect(expressRoute).toContain(
      "TradeScout received your request for ${target.businessName}"
    );
    expect(panel).toContain(
      "TradeScout is receiving requests for ${businessName} until the owner connects this profile."
    );
    expect(panel).toContain(
      "TradeScout received your request for ${businessName}. The owner has not connected this profile yet."
    );
    expect(panel).toContain(
      "TradeScout is receiving requests for ${businessName} until the owner connects this profile."
    );
    expect(read("client/src/pages/profile-sites/VideographerProfileTheme.tsx")).toContain(
      "This profile is not yet connected to its owner. TradeScout holds requests until"
    );
    expect(publicRoute).toContain(
      "deliveryCustody: directConnectDeliveryCustody"
    );
  });
});
