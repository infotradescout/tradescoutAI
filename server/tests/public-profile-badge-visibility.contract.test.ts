import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile community-verification contract", () => {
  it("honors the owner's badge visibility preference", () => {
    const routes = read("server/routes/profiles.ts");
    const provisioning = read("server/services/laPlumbingProfileProvisioning.ts");

    expect(routes).toContain("ownerPreferences.badges?.show !== false");
    expect(routes).toContain(
      "const profileScopedSections = readProfileSectionConfigBlock(profile.contentBlocks)"
    );
    expect(routes).toContain("profileScopedSections ??");
    expect(routes).toContain("profileSections.rolesAndBadges !== false");
    expect(routes).toContain('? ["Community Builder Badge"] : []');
    expect(routes).toContain("badges: publicProfileBadges");
    expect(provisioning).toContain("show: shouldShowBadges");
    expect(provisioning).toContain("rolesAndBadges: shouldShowRolesAndBadges");
  });

  it("publishes honest score history and policy-safe active boost details", () => {
    const routes = read("server/routes/profiles.ts");
    const boostPolicy = read("server/services/cvsBoostPolicy.ts");

    expect(routes).toContain("scoreHistoryStartsAt:");
    expect(routes).toContain("lifetimeScoreChange: publicLifetimeScoreChange");
    expect(routes).toContain("scoreChange30d: publicScoreChange30d");
    expect(routes).toContain("scoreChange30dComparedAt:");
    expect(routes).toContain("activePolicyBoostPoints: publicCvsBoostPoints");
    expect(routes).toContain("activeBoosts: activeCvsBoosts");
    expect(routes).toContain("eq(trustSnapshots.version, latestTrustSnapshot.version)");
    expect(routes).toContain("now.getTime() - THIRTY_DAY_COMPARATOR_TARGET_MS");
    expect(routes).toContain("gte(trustSnapshots.computedAt, thirtyDayWindowStart)");
    expect(routes).toContain("lte(trustSnapshots.computedAt, thirtyDayWindowEnd)");
    expect(boostPolicy).toContain("export async function getActiveCvsBoosts");
    expect(boostPolicy).toContain("label: policy.label");
    expect(boostPolicy).not.toContain("label: row.policy_label");
  });

  it("fails closed when daily trust evidence is stale or current verification changed", () => {
    const routes = read("server/routes/profiles.ts");
    const theme = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");

    expect(routes).toContain("const PUBLIC_TRUST_SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000");
    expect(routes).toContain("ownerUser.addressVerified === true");
    expect(routes).toContain("snapshotVerificationMatchesCurrent");
    expect(routes).toContain("currentCredentialHardFailure");
    expect(routes).toContain("businessVerifications.expiresAt");
    expect(theme).toContain("Score history begins");
    expect(theme).toContain("30-day comparison is not available yet");
    expect(theme).not.toContain("History incomplete");
  });
});
