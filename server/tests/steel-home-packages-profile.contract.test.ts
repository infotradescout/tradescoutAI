import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY as identity,
  STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE,
  STEEL_HOME_PACKAGES_START_REQUEST_PATH,
} from "@shared/steelHomePackagesProfile";
import { shouldIndexPublicProfileSlug } from "@shared/publicProfileIndexing";
import {
  canExposePublishedProfilePublicly,
  canServePublishedProfileAtDirectRoute,
  isSteelHomePackagesUnlistedDirectProfile,
} from "../services/ownerConfirmedDirectProfile";
import {
  getDirectConnectIntent,
  parseDirectConnectEntryContext,
} from "../../client/src/pages/direct-connect/directConnectEntryContext";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const safeUnlistedCandidate = {
  profileId: "steel-profile",
  businessId: "steel-business",
  profileSlug: identity.slug,
  profileStatus: "published",
  profileOwnerUserId: "steward-user",
  businessStatus: "draft",
  businessOwnerUserId: "steward-user",
  publicDiscoveryEnabled: false,
  businessSources: [STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE],
  businessClaimStatus: "unclaimed",
  ownerVerifiedBadge: true,
  ownerVerificationStatus: "approved",
  ownerPreferences: { profileVisibility: "public" },
};

describe("Steel Home Packages unlisted profile contract", () => {
  it("centralizes the temporary identity and keeps search-engine release off", () => {
    expect(identity).toMatchObject({
      slug: "steel-home-packages",
      temporarySlug: "steel-home-packages",
      displayLabel: "Steel Home Packages",
      publicRoute: "/u/steel-home-packages",
      releaseState: "unlisted",
      publiclyReleased: false,
    });
    expect(shouldIndexPublicProfileSlug(identity.slug)).toBe(false);
  });

  it("keeps the exact URL reviewable without granting public discovery authority", () => {
    expect(canServePublishedProfileAtDirectRoute(safeUnlistedCandidate)).toBe(true);
    expect(canExposePublishedProfilePublicly(safeUnlistedCandidate)).toBe(false);

    expect(
      isSteelHomePackagesUnlistedDirectProfile({
        ...safeUnlistedCandidate,
        profileSlug: "steel-home-packages-lookalike",
      })
    ).toBe(false);

    for (const unsafeChange of [
      { profileStatus: "draft" },
      { businessStatus: "active" },
      { businessOwnerUserId: "another-user" },
      { publicDiscoveryEnabled: true },
      { businessSources: [] },
    ]) {
      expect(
        canServePublishedProfileAtDirectRoute({ ...safeUnlistedCandidate, ...unsafeChange })
      ).toBe(false);
    }
  });

  it("separates the targeted package request from the location-routed labor request", () => {
    const packageContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_START_REQUEST_PATH);
    expect(packageContext).toMatchObject({
      contextType: "profile",
      contextId: identity.slug,
      targetSelector: identity.slug,
      targetName: identity.displayLabel,
      source: "steel_home_packages_phase1",
      subjectType: "product",
      title: "Steel home structure, stone, and cabinet package",
    });
    expect(getDirectConnectIntent(STEEL_HOME_PACKAGES_START_REQUEST_PATH)).toBeNull();

    const laborContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH);
    expect(laborContext).toMatchObject({
      source: "steel_home_packages_phase1_labor",
      subjectType: "service",
      title: "Steel-home labor or installation request",
    });
    expect(laborContext.contextType).toBeUndefined();
    expect(laborContext.contextId).toBeUndefined();
    expect(laborContext.targetSelector).toBeUndefined();
    expect(laborContext.targetUserId).toBeUndefined();
    expect(laborContext.targetProviderId).toBeUndefined();
    expect(getDirectConnectIntent(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH)).toBeNull();

    const laborParams = new URL(
      STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
      "https://www.thetradescout.com"
    ).searchParams;
    for (const forbiddenTarget of [
      "profile",
      "target",
      "targetProviderId",
      "contractorId",
      "prefill_businessSlug",
    ]) {
      expect(laborParams.has(forbiddenTarget)).toBe(false);
    }
  });

  it("renders express URL prefill inside the intent-specific request fields", () => {
    const composer = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(composer).toContain('what: prefillTitle?.trim() || ""');
    expect(composer).toContain('details: prefillDescription?.trim() || ""');
    expect(composer).toContain('where: prefillLocation?.trim() || ""');
    expect(composer).toContain('when: prefillTiming?.trim() || ""');
  });

  it("locks the public package to three TradeScout-coordinated material choices", () => {
    expect(content.version).toBe(4);
    expect(content.package.items.map((item) => [item.key, item.label])).toEqual([
      ["structure", "01 • Metal structure"],
      ["stone", "02 • Natural stone"],
      ["cabinets", "03 • Cabinets"],
    ]);

    const serialized = JSON.stringify(content);
    for (const privateRelationshipCopy of [
      "Worldwide Steel Buildings",
      "JW Stone Logistics",
      "A+ Cabinets",
      "Ocean Springs",
      "partner",
      "supplier",
      "affiliate",
      "referral",
    ]) {
      expect(serialized.toLowerCase()).not.toContain(privateRelationshipCopy.toLowerCase());
    }
    for (const futurePhaseCopy of [
      "single-wide",
      "tiny home",
      "mini-split",
      "tankless",
      "appliance package",
      "whole-home warranty",
      "HomeID",
    ]) {
      expect(serialized.toLowerCase()).not.toContain(futurePhaseCopy.toLowerCase());
    }
  });

  it("provisions a draft linked business without taking over steward account state", () => {
    const source = read("server/services/steelHomePackagesProfileProvisioning.ts");
    expect(source).toContain('status: "draft" as const');
    expect(source).toContain("publicDiscoveryEnabled: false");
    expect(source).toContain("STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE");
    expect(source).toContain('status: "published" as const');
    expect(source).toContain('category: "Steel home material packages"');
    expect(source).toContain(
      'services: ["Custom metal structure", "Natural stone", "Cabinet packages"]'
    );
    expect(source).not.toContain("Worldwide Steel Buildings");
    expect(source).not.toContain("JW Stone Logistics");
    expect(source).not.toContain("A+ Cabinets");
    expect(source).not.toContain(".update(users)");
    expect(source).not.toContain("activeProfileId");
    expect(source).not.toContain("activeBusinessId");
  });

  it("blocks search, sitemap, llms, map, and structured-data discovery surfaces", () => {
    const repository = read("server/repositories/profileRepository.ts");
    const html = read("server/publicProfileHtml.ts");
    const route = read("server/routes/profiles.ts");
    const appRoutes = read("server/routes.ts");
    const referralAttributionBlock = appRoutes.slice(
      appRoutes.indexOf("// Referral attribution middleware:"),
      appRoutes.indexOf("// Locality tracking middleware")
    );
    const view = read("client/src/pages/ProfileSiteView.tsx");

    expect(repository).toContain("publicProfileReleaseExposurePredicate()");
    expect(repository).toContain("canServePublishedProfileAtDirectRoute");
    expect(repository).toContain("canExposeProviderProfileOnPublicMap");
    expect(html.match(/if \(!shouldIndexPublicProfileSlug\(slug\)\) return null;/g)).toHaveLength(
      2
    );
    expect(html).toContain("if (shouldIndexProfile) {");
    expect(html).toContain("html = injectJsonLd(html, jsonLd);");
    expect(route).toContain("unlistedSteelHomeDirectProfile");
    expect(route).toContain("isSteelHomePackagesUnlistedDirectProfile");
    expect(route).toContain("Temporary admin stewardship is not evidence");
    expect(appRoutes).toContain("if (!shouldIndexPublicProfileSlug(slug)) return next();");
    expect(
      referralAttributionBlock.indexOf("handleExplicitOrExistingReferral(req, res)")
    ).toBeLessThan(
      referralAttributionBlock.indexOf("if (!shouldIndexPublicProfileSlug(slug)) return next();")
    );
    expect(view).toContain("if (isSteelHomePackagesProfileSlug(profile.slug))");
    expect(view).toContain("noIndex");
    expect(view).not.toContain("steelHomeStructuredData");
  });
});
