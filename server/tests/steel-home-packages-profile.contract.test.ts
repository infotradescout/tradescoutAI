import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  JW_STONE_ANONYMOUS_CATALOG,
  JW_STONE_NAMED_CATALOG,
} from "../../client/src/features/jw-stone/catalog";
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
import { registerStoneDesignerImageRoutes } from "../routes/stone-designer-images";

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
  ownerRole: "super_admin",
  ownerRoles: ["super_admin"],
  ownerVerifiedBadge: true,
  ownerVerificationStatus: "approved",
  ownerPreferences: { profileVisibility: "public" },
};

describe("Steel Home Project Center unlisted profile contract", () => {
  it("centralizes the TradeScout-owned identity and keeps search-engine release off", () => {
    expect(identity).toMatchObject({
      slug: "steel-home-packages",
      temporarySlug: "steel-home-packages",
      displayLabel: "Steel Home Project Center",
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
      { ownerRole: "contractor", ownerRoles: [] },
      { ownerVerifiedBadge: false, ownerVerificationStatus: "pending" },
    ]) {
      expect(
        canServePublishedProfileAtDirectRoute({ ...safeUnlistedCandidate, ...unsafeChange })
      ).toBe(false);
    }
  });

  it("targets project review to TradeScout and leaves local labor location-routed", () => {
    const projectContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_START_REQUEST_PATH);
    expect(projectContext).toMatchObject({
      contextType: "profile",
      contextId: identity.slug,
      targetSelector: identity.slug,
      targetName: "Steel Home Project Center",
      source: "steel_home_project_center",
      subjectType: "product",
      title: "Steel-home project review",
    });
    expect(projectContext.description).toContain("Project location:");
    expect(getDirectConnectIntent(STEEL_HOME_PACKAGES_START_REQUEST_PATH)).toBeNull();

    const laborContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH);
    expect(laborContext).toMatchObject({
      source: "steel_home_project_tools_labor",
      subjectType: "service",
      title: "Steel-home local labor request",
    });
    expect(laborContext.contextType).toBeUndefined();
    expect(laborContext.contextId).toBeUndefined();
    expect(laborContext.targetSelector).toBeUndefined();
    expect(laborContext.targetUserId).toBeUndefined();
    expect(laborContext.targetProviderId).toBeUndefined();
    expect(getDirectConnectIntent(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH)).toBeNull();

    expect(
      parseDirectConnectEntryContext(
        "/direct-connect?subject=service&county=28059&state=MS&location=Ocean%20Springs"
      )
    ).toMatchObject({
      countyFips: "28059",
      stateCode: "MS",
      location: "Ocean Springs",
    });

    const laborParams = new URL(
      STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
      "https://www.thetradescout.com"
    ).searchParams;
    for (const forbiddenTarget of [
      "profile",
      "profileName",
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
    expect(composer).toContain("resolveDirectConnectEntryContext(directConnectLocation)");
    expect(composer).toContain('what: prefillTitle?.trim() || ""');
    expect(composer).toContain('details: prefillDescription?.trim() || ""');
    expect(composer).toContain('where: prefillLocation?.trim() || ""');
    expect(composer).toContain('when: prefillTiming?.trim() || ""');
  });

  it("locks public copy to three separate working tools with no fulfillment-company exposure", () => {
    expect(content.version).toBe(7);
    expect(content.tools.cards.map((item) => [item.key, item.title])).toEqual([
      ["building", "Building designer"],
      ["countertops", "Countertop designer"],
      ["cabinets", "Cabinet designer"],
    ]);

    const serialized = JSON.stringify(content);
    for (const requiredPublicTruth of [
      "owner-builders, builders, and contractors",
      "included roof",
      "real material photos",
      "selected surface",
      "planning range",
      "price after review",
      "mini-split",
      "tankless water",
      "appliances",
    ]) {
      expect(serialized.toLowerCase()).toContain(requiredPublicTruth.toLowerCase());
    }
    for (const forbiddenPublicCopy of [
      "Worldwide Steel Buildings",
      "JW Stone Logistics",
      "A+ Cabinets",
      "TradePartner",
      "Steel Home Studio",
      "one clear package",
      "one coordinated package",
      "one package quote",
      "complete home package",
      "turnkey home",
      "single-wide",
      "tiny home",
      "whole-home warranty",
      "HomeID",
    ]) {
      expect(serialized.toLowerCase()).not.toContain(forbiddenPublicCopy.toLowerCase());
    }
  });

  it("serves exact named catalog images through a neutral designer URL and denies anonymous records", async () => {
    const clientAlias = read(
      "client/src/pages/profile-sites/steel-home-project-tools/stoneDesignerImages.ts"
    );
    const route = read("server/routes/stone-designer-images.ts");
    const serverRoutes = read("server/routes.ts");

    expect(clientAlias).toContain('"/images/stone-designer"');
    expect(route).toContain('"/images/stone-designer/:stoneId/:imageNumber.webp"');
    expect(route).toContain("getCatalogItemById(stoneId)");
    expect(route).toContain("stone.anonymous");
    expect(route).toContain("stone.images[imageNumber - 1]");
    expect(serverRoutes).toContain("registerStoneDesignerImageRoutes(app)");

    for (const stone of JW_STONE_NAMED_CATALOG) {
      const sourceFile = path.resolve(
        process.cwd(),
        "client/public",
        stone.images[0].replace(/^\/+/, "")
      );
      expect(fs.existsSync(sourceFile), `${stone.id} needs its exact lead image`).toBe(true);
    }

    const selectedStone = JW_STONE_NAMED_CATALOG.find((stone) => stone.id === "cristallo");
    const anonymousStone = JW_STONE_ANONYMOUS_CATALOG[0];
    if (!selectedStone || !anonymousStone) throw new Error("Expected named and anonymous stones");

    const app = express();
    registerStoneDesignerImageRoutes(app);
    const expectedImage = fs.readFileSync(
      path.resolve(process.cwd(), "client/public", selectedStone.images[0].replace(/^\/+/, ""))
    );
    const response = await request(app)
      .get("/images/stone-designer/cristallo/1.webp")
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.body).toEqual(expectedImage);

    await request(app).get(`/images/stone-designer/${anonymousStone.id}/1.webp`).expect(404);
  });

  it("provisions an undiscoverable TradeScout tools profile without taking over steward state", () => {
    const source = read("server/services/steelHomePackagesProfileProvisioning.ts");
    expect(source).toContain('status: "draft" as const');
    expect(source).toContain("publicDiscoveryEnabled: false");
    expect(source).toContain("STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE");
    expect(source).toContain('status: "published" as const');
    expect(source).toContain("hasVerifiedTradeScoutAdminCustody");
    expect(source).toContain("owner must remain a verified TradeScout admin");
    expect(source).toContain('category: "Steel-home project center"');
    expect(source).toContain('"Steel building and roof planning"');
    expect(source).toContain('"Photographed stone selection and countertop planning"');
    expect(source).toContain('"Cabinet layout and budget planning"');
    expect(source).toContain('"Whole-home scope and local project review"');
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
    const directConnectRoutes = read("server/routes/direct-connect.ts");
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
    expect(repository).toContain("ownerRole: row.ownerRole");
    expect(directConnectRoutes).toContain("hasVerifiedTradeScoutAdminCustody");
    expect(directConnectRoutes).toContain("isSteelHomePackagesProfileSlug(targetProfile.slug)");
    expect(directConnectRoutes).toContain('code: "JOBSITE_LOCATION_MISMATCH"');
  });
});
