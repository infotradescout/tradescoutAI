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
import {
  buildNamedStoneDesignerImageHref,
  buildStoneDesignerPhotoKey,
} from "../../client/src/pages/profile-sites/steel-home-project-tools/stoneDesignerImages";
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
      displayLabel: "Steel Home Planning Tools",
      publicRoute: "/u/steel-home-packages",
      releaseState: "unlisted",
      publiclyReleased: false,
    });
    expect(shouldIndexPublicProfileSlug(identity.slug)).toBe(false);
    expect(STEEL_HOME_PACKAGES_REQUEST_SOURCE).toBe("steel_home_planning_tools");
    expect(STEEL_HOME_PACKAGES_LABOR_REQUEST_SOURCE).toBe("steel_home_planning_tools_labor");
  });

  it("keeps the exact route reviewable without granting discovery authority", () => {
    expect(canServePublishedProfileAtDirectRoute(safeUnlistedCandidate)).toBe(true);
    expect(canExposePublishedProfilePublicly(safeUnlistedCandidate)).toBe(false);
    expect(isSteelHomePackagesUnlistedDirectProfile(safeUnlistedCandidate)).toBe(true);

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

  it("targets product requests to TradeScout and leaves local trade help location-routed", () => {
    const projectContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_START_REQUEST_PATH);
    expect(projectContext).toMatchObject({
      contextType: "profile",
      contextId: identity.slug,
      targetSelector: identity.slug,
      targetName: "Steel Home Planning Tools",
      source: "steel_home_planning_tools",
      subjectType: "product",
      title: "Steel home planner request",
    });
    expect(projectContext.description).toContain("Planner:");
    expect(projectContext.description).toContain("Project location:");
    expect(getDirectConnectIntent(STEEL_HOME_PACKAGES_START_REQUEST_PATH)).toBeNull();

    const laborContext = parseDirectConnectEntryContext(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH);
    expect(laborContext).toMatchObject({
      source: "steel_home_planning_tools_labor",
      subjectType: "service",
      title: "Steel home local trade request",
    });
    expect(laborContext.targetSelector).toBeUndefined();
    expect(getDirectConnectIntent(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH)).toBeNull();

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

  it("publishes exactly three independent measured planners with quote-required truth", () => {
    expect(content.version).toBe(15);
    expect(content.header.navigation.map((item) => [item.key, item.label])).toEqual([
      ["countertops", "Countertops"],
      ["cabinets", "Cabinets"],
      ["building", "Metal Buildings"],
    ]);
    expect(content.tools.cards.map((item) => [item.key, item.title, item.action])).toEqual([
      ["countertops", "Countertop Planner", "Open Countertop Planner"],
      ["cabinets", "Cabinet Planner", "Open Cabinet Planner"],
      ["building", "Metal Building Planner", "Open Metal Building Planner"],
    ]);
    expect(content.hero.body).toContain("three stand-alone planners");
    expect(content.hero.body).toContain("Open any one without starting or completing another");

    const customerCopy = collectStringValues(content).join("\n").toLowerCase();
    for (const requiredTruth of [
      "self-contracted homeowners, builders, and contractors",
      "measured top-down plan",
      "reference evidence",
      "only a verified stone-only crop may be projected",
      "stone ordering and countertop fabrication stay separate",
      "room measurements, fixed features, placed modules",
      "use, structure, roof, measurements, placed openings",
      "professional review and quote",
      "price require a quote",
    ]) {
      expect(customerCopy).toContain(requiredTruth.toLowerCase());
    }

    for (const forbiddenCopy of [
      "early price estimate",
      "early price estimates",
      "planning range",
      "planning estimate",
      "owner-built",
      "owner built",
      "owner-builder",
      "owner builder",
      "worldwide steel buildings",
      "a+ cabinets",
      "commission",
      "markup",
      "supplier cost",
    ]) {
      expect(customerCopy).not.toContain(forbiddenCopy);
    }
  });

  it("makes the countertop plan primary and keeps raw inventory photography off room finishes", () => {
    const designer = read(
      "client/src/pages/profile-sites/steel-home-project-tools/MeasuredCountertopDesigner.tsx"
    );
    const safety = read(
      "client/src/pages/profile-sites/steel-home-project-tools/stoneProjectionSafety.ts"
    );
    const visualizer = read(
      "client/src/pages/profile-sites/steel-home-project-tools/StoneVisualizer3D.tsx"
    );

    expect(designer).toContain('type ViewMode = "plan" | "3d"');
    expect(designer).toContain('useState<ViewMode>("plan")');
    expect(designer).toContain('data-testid="steel-home-countertop-view-plan"');
    expect(designer).toContain('data-testid="steel-home-countertop-view-3d"');
    expect(designer).toContain("floorStone: false");
    expect(designer).toContain("Raw inventory photography is not stretched across the room");
    expect(safety).toContain("Only an explicitly prepared stone-only texture asset");
    expect(safety).toContain('normalized.includes("/stone-textures/clean/")');
    expect(safety).toContain("reference-only");
    expect(visualizer).not.toContain("bathroom-toilet");
    expect(visualizer).not.toContain("bathroom-tub");
    expect(visualizer).not.toContain("addBathroomDecor");
  });

  it("serves exact named catalog photos through a neutral URL and denies anonymous records", async () => {
    const clientAlias = read(
      "client/src/pages/profile-sites/steel-home-project-tools/stoneDesignerImages.ts"
    );
    const route = read("server/routes/stone-designer-images.ts");
    const serverRoutes = read("server/routes.ts");

    expect(clientAlias).toContain('"/images/stone-designer"');
    expect(route).toContain('"/images/stone-designer/:stoneId/:imageNumber.webp"');
    expect(route).toContain('"/images/stone-designer/named/:stoneShareSlug/:photoKey.webp"');
    expect(route).toContain("stone.anonymous");
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
    expect(response.body).toEqual(expectedImage);

    const stableHref = buildNamedStoneDesignerImageHref(
      selectedStone.shareSlug!,
      selectedStone.images[0]!
    );
    expect(stableHref).toBeTruthy();
    await request(app).get(stableHref!).expect(200);

    await request(app)
      .get(
        `/images/stone-designer/named/${selectedStone.shareSlug}/${buildStoneDesignerPhotoKey(
          anonymousStone.images[0]!
        )}.webp`
      )
      .expect(404);
    await request(app).get(`/images/stone-designer/${anonymousStone.id}/1.webp`).expect(404);
  });

  it("provisions an undiscoverable measured-planner profile without unsupported pricing copy", () => {
    const source = read("server/services/steelHomePackagesProfileProvisioning.ts");
    expect(source).toContain('status: "draft" as const');
    expect(source).toContain("publicDiscoveryEnabled: false");
    expect(source).toContain("STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE");
    expect(source).toContain('status: "published" as const');
    expect(source).toContain("hasVerifiedTradeScoutAdminCustody");
    expect(source).toContain('category: "Steel-home planning tools"');
    expect(source).toContain('"Countertop measured planner and stone reference review"');
    expect(source).toContain('"Cabinet measured room planner and quote review"');
    expect(source).toContain('"Metal building measured planner and quote review"');
    expect(source.toLowerCase()).not.toContain("early price estimate");
  });

  it("keeps all three planner implementations free of unsupported early-price language", () => {
    const source = [
      read("client/src/pages/profile-sites/steel-home-project-tools/MeasuredCountertopDesigner.tsx"),
      read("client/src/pages/profile-sites/steel-home-project-tools/CabinetDesigner.tsx"),
      read("client/src/pages/profile-sites/steel-home-project-tools/BuildingDesigner.tsx"),
      read("client/src/pages/profile-sites/steel-home-project-tools/PlanningEstimateCard.tsx"),
    ]
      .join("\n")
      .toLowerCase();
    expect(source).not.toContain("early price estimate");
    expect(source).toContain("quote required");
  });
});
