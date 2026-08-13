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
  STEEL_HOME_PACKAGES_LABOR_REQUEST_SOURCE,
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE,
  STEEL_HOME_PACKAGES_REQUEST_SOURCE,
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

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringValues);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectStringValues);
  }
  return [];
}

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

describe("Steel Home Planning Tools unlisted profile contract", () => {
  it("centralizes the TradeScout-owned identity and keeps search-engine release off", () => {
    expect(identity).toMatchObject({
      slug: "steel-home-packages",
      temporarySlug: "steel-home-packages",
      displayLabel: "Steel Home Planning Tools",
      publicRoute: "/u/steel-home-packages",
      releaseState: "unlisted",
      publiclyReleased: false,
    });
    expect(shouldIndexPublicProfileSlug(identity.slug)).toBe(false);
    expect(STEEL_HOME_PACKAGES_REQUEST_SOURCE).toBe("steel_home_planning_tools");
    expect(STEEL_HOME_PACKAGES_LABOR_REQUEST_SOURCE).toBe("steel_home_planning_tools_labor");
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

  it("targets the package request to TradeScout and leaves local trade help location-routed", () => {
    const projectContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_START_REQUEST_PATH);
    expect(projectContext).toMatchObject({
      contextType: "profile",
      contextId: identity.slug,
      targetSelector: identity.slug,
      targetName: "Steel Home Planning Tools",
      source: "steel_home_planning_tools",
      subjectType: "product",
      title: "Steel home builder request",
    });
    expect(projectContext.description).toContain("Builder:");
    expect(projectContext.description).toContain("Project location:");
    expect(getDirectConnectIntent(STEEL_HOME_PACKAGES_START_REQUEST_PATH)).toBeNull();

    const laborContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH);
    expect(laborContext).toMatchObject({
      source: "steel_home_planning_tools_labor",
      subjectType: "service",
      title: "Steel home local trade request",
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

  it("locks exactly three independent builders without exposing future or internal language", () => {
    expect(content.version).toBe(14);
    expect(content.header.navigation.map((item) => [item.key, item.label])).toEqual([
      ["countertops", "Countertops"],
      ["cabinets", "Cabinets"],
      ["building", "Metal Buildings"],
    ]);
    expect(content.header.navigation.every((item) => !("href" in item))).toBe(true);
    expect(content.tools.cards.map((item) => [item.key, item.title])).toEqual([
      ["countertops", "Countertop Builder"],
      ["cabinets", "Cabinet Builder"],
      ["building", "Metal Building Builder"],
    ]);
    expect(content.tools.cards.map((item) => item.action)).toEqual([
      "Open Countertop Builder",
      "Open Cabinet Builder",
      "Open Metal Building Builder",
    ]);
    expect(content.tools.cards.every((item) => !("number" in item))).toBe(true);
    expect(content.tools.cards.find((item) => item.key === "countertops")?.label).toBe(
      "Countertops"
    );
    expect(content.header.label).toBe("Steel Home Planning Tools");
    expect(content.hero.body).toBe(
      "Countertops, Cabinets, and Metal Buildings are three stand-alone builders. Open any one without starting or completing another."
    );

    const projectContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_START_REQUEST_PATH);
    const laborContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH);
    const customerCopy = [
      ...collectStringValues(content),
      projectContext.title,
      projectContext.description,
      laborContext.title,
      laborContext.description,
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n");

    for (const requiredPublicTruth of [
      "self-contracted homeowners, builders, and contractors",
      "Start a Request",
      "three stand-alone builders",
      "Open any one without starting or completing another",
      "Countertop Builder",
      "Cabinet Builder",
      "Metal Building Builder",
      "real photos",
      "Quartzite, Engineered Quartz",
      "early price estimate",
      "Stone ordering and countertop fabrication are separate",
      "TradeScout and the stone supplier do not template, fabricate, finish, or install countertops",
      "separate independent fabricator",
    ]) {
      expect(customerCopy.toLowerCase()).toContain(requiredPublicTruth.toLowerCase());
    }

    const countertopDesigner = read(
      "client/src/pages/profile-sites/steel-home-project-tools/CountertopDesigner.tsx"
    );
    expect(content.tools.countertops.body).toContain("material supply only");
    expect(content.tools.countertops.body).toContain("separate independent fabricator");
    expect(countertopDesigner).toContain("Stone quote needed");
    expect(content.disclosure).toContain(
      "Countertop-top area is approximate, excludes backsplash, and is not a price or final template."
    );
    expect(content.disclosure).toContain(
      "Cabinet and metal-building early price estimates are not quotes"
    );
    for (const forbiddenPublicCopy of [
      "Worldwide Steel Buildings",
      "JW Stone Logistics",
      "A+ Cabinets",
      "TradePartner",
      "Steel Home Studio",
      "Steel Home Project Workspace",
      "Project Setup",
      "Whole Home",
      "Summary & Request",
      "one clear package",
      "one coordinated package",
      "one package quote",
      "complete home package",
      "turnkey home",
      "single-wide",
      "tiny home",
      "whole-home warranty",
      "HomeID",
      "owner-builder",
      "owner builder",
      "owner-building",
      "owner building",
      "owner-built",
      "project brief",
      "scope",
      "scopes",
      "handoff",
      "staged",
      "payload",
      "context",
      "target provider",
      "provider ID",
      "profile slug",
      "release state",
      "FIPS",
      "record ID",
      "fulfillment",
      "supplier cost",
      "wholesale cost",
      "markup",
      "commission",
      "planning range",
      "planning estimate",
      "allowance",
      "concept",
      "local review",
      "price after review",
      "stone or quartz",
      "stone + quartz",
      "stone-and-quartz",
    ]) {
      expect(customerCopy.toLowerCase()).not.toContain(forbiddenPublicCopy.toLowerCase());
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
    expect(source).toContain('category: "Steel-home planning tools"');
    expect(source).toContain('"Metal building planner and early price estimates"');
    expect(source).toContain('"Countertop planner and area estimates"');
    expect(source).toContain('"Cabinet planner and early price estimates"');
    expect(source).not.toContain('"Other home needs and location requirements"');
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
