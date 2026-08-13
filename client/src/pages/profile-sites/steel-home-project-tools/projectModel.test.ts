import { describe, expect, it } from "vitest";
import {
  JW_STONE_ANONYMOUS_CATALOG,
  JW_STONE_NAMED_CATALOG,
  getCatalogItemById,
} from "@/features/jw-stone/catalog";
import {
  ADDITIONAL_PROJECT_SCOPE_OPTIONS,
  PROJECT_ROLE_OPTIONS,
  STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
  STEEL_HOME_PROJECT_DRAFT_VERSION,
  buildSteelHomeLaborRequestHref,
  buildSteelHomeProjectDescription,
  buildSteelHomeProjectRequestHref,
  calculateBuildingPlanningEstimate,
  calculateCabinetPlanningEstimate,
  calculateCabinetPlannedWidth,
  calculateCountertopSquareFeet,
  clearSteelHomeProjectDraft,
  createEmptySteelHomeProjectDraft,
  formatPlanningRange,
  getSteelHomeProjectEstimateSummary,
  getSteelHomeProjectReadiness,
  loadSteelHomeProjectDraft,
  reconcileSteelHomeProjectDraft,
  saveSteelHomeProjectDraft,
  type SteelHomeProjectStorage,
} from "./projectModel";
import { buildStoneDesignerImageHref } from "./stoneDesignerImages";

const FORBIDDEN_PUBLIC_NAMES = [
  "Worldwide Steel Buildings",
  "JW Stone Logistics",
  "A+ Cabinets",
  "TradePartner",
];

const FORBIDDEN_PUBLIC_PRICING_TERMS = [
  "supplier cost",
  "wholesale cost",
  "markup",
  "margin",
  "commission",
];

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: SteelHomeProjectStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  return { storage, values };
}

describe("steel-home project model", () => {
  it("reconciles bounds, enums, and unnamed stone records to safe planning defaults", () => {
    const anonymousStone = JW_STONE_ANONYMOUS_CATALOG[0];
    expect(anonymousStone).toBeDefined();

    const reconciled = reconcileSteelHomeProjectDraft({
      version: 99,
      location: `  ${"x".repeat(220)}  `,
      stateCode: "TX",
      countyFips: "28059",
      countyName: "invented name",
      timing: "Yesterday",
      projectRole: "owner-builder",
      additionalScopes: ["insulation", "unknown-package", "mini-split-hvac", "insulation"],
      building: {
        widthFt: 999,
        lengthFt: -50,
        eaveHeightFt: "18",
        roofStyle: "round",
      },
      countertops: {
        stoneId: anonymousStone?.id,
        wallAIn: 8,
      },
      cabinets: {
        upperHeightIn: 31,
        pantryCount: 99,
      },
      labor: {
        trades: ["Stone fabrication", "Stone fabrication", "Unknown work"],
      },
    });

    expect(reconciled.version).toBe(STEEL_HOME_PROJECT_DRAFT_VERSION);
    expect(reconciled.location).toHaveLength(160);
    expect(reconciled).toMatchObject({
      stateCode: "MS",
      countyFips: "28059",
      countyName: "Jackson County",
    });
    expect(reconciled.timing).toBe("");
    expect(reconciled.projectRole).toBe("owner-builder");
    expect(reconciled.additionalScopes).toEqual(["insulation", "mini-split-hvac"]);
    expect(reconciled.building).toMatchObject({
      widthFt: 200,
      lengthFt: 20,
      eaveHeightFt: 18,
      roofStyle: "gable",
    });
    expect(reconciled.countertops.stoneId).toBe("cristallo");
    expect(reconciled.countertops.wallAIn).toBe(24);
    expect(reconciled.cabinets.upperHeightIn).toBe(36);
    expect(reconciled.cabinets.pantryCount).toBe(4);
    expect(reconciled.labor.trades).toEqual(["Stone fabrication"]);
  });

  it("provides complete customer-facing role and quote-only scope option records", () => {
    expect(PROJECT_ROLE_OPTIONS.map((option) => option.value)).toEqual([
      "owner-builder",
      "has-builder",
      "builder-or-contractor",
      "whole-build-help",
    ]);
    expect(ADDITIONAL_PROJECT_SCOPE_OPTIONS.length).toBeGreaterThanOrEqual(12);
    expect(ADDITIONAL_PROJECT_SCOPE_OPTIONS.map((option) => option.value)).toEqual(
      expect.arrayContaining([
        "house-plans-and-layout",
        "interior-framing-and-drywall",
        "mini-split-hvac",
        "tankless-water-heating",
        "appliances",
        "home-and-systems-protection",
      ])
    );

    for (const option of [...PROJECT_ROLE_OPTIONS, ...ADDITIONAL_PROJECT_SCOPE_OPTIONS]) {
      expect(option.value).toMatch(/^[a-z0-9-]+$/);
      expect(option.label.trim()).not.toBe("");
      expect(option.description.trim()).not.toBe("");
    }

    const invalid = reconcileSteelHomeProjectDraft({
      projectRole: "affiliate",
      additionalScopes: [null, 7, "not-a-scope"],
    });
    expect(invalid.projectRole).toBe("");
    expect(invalid.additionalScopes).toEqual([]);
  });

  it("persists only the current version and recovers from corrupt browser storage", () => {
    const { storage, values } = memoryStorage();
    const draft = createEmptySteelHomeProjectDraft();
    expect(STEEL_HOME_PROJECT_DRAFT_VERSION).toBe(4);
    expect(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY).toBe(
      "tradescout:steel-home-project-tools:draft:v4"
    );
    draft.location = "39564";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.projectRole = "has-builder";
    draft.additionalScopes = ["windows-and-doors", "appliances"];
    draft.countertops.included = true;
    draft.countertops.stoneId = "taj-mahal";

    expect(saveSteelHomeProjectDraft(storage, draft)).toBe(true);
    expect(loadSteelHomeProjectDraft(storage)).toMatchObject({
      location: "39564",
      stateCode: "MS",
      countyFips: "28059",
      countyName: "Jackson County",
      projectRole: "has-builder",
      additionalScopes: ["windows-and-doors", "appliances"],
      countertops: { included: true, stoneId: "taj-mahal" },
    });

    values.set(
      STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...draft, version: STEEL_HOME_PROJECT_DRAFT_VERSION - 1 })
    );
    expect(loadSteelHomeProjectDraft(storage).location).toBe("");

    values.set(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY, "{not-json");
    expect(loadSteelHomeProjectDraft(storage)).toEqual(createEmptySteelHomeProjectDraft());
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(false);

    saveSteelHomeProjectDraft(storage, draft);
    clearSteelHomeProjectDraft(storage);
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(false);
  });

  it("migrates the prior browser draft without losing completed designs", () => {
    const legacyKey = "tradescout:steel-home-project-tools:draft:v3";
    const legacyDraft = createEmptySteelHomeProjectDraft();
    legacyDraft.location = "Biloxi, MS";
    legacyDraft.stateCode = "MS";
    legacyDraft.countyFips = "28047";
    legacyDraft.countyName = "Harrison County";
    legacyDraft.building.included = true;
    legacyDraft.building.widthFt = 54;
    legacyDraft.cabinets.primaryWallIn = 144;
    const { storage, values } = memoryStorage({
      [legacyKey]: JSON.stringify({
        ...legacyDraft,
        version: 3,
        projectRole: undefined,
        additionalScopes: undefined,
      }),
    });

    expect(loadSteelHomeProjectDraft(storage)).toMatchObject({
      version: STEEL_HOME_PROJECT_DRAFT_VERSION,
      location: "Biloxi, MS",
      projectRole: "",
      additionalScopes: [],
      building: { included: true, widthFt: 54 },
      cabinets: { primaryWallIn: 216 },
    });
    expect(values.has(legacyKey)).toBe(false);
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(true);

    const customizedLegacy = {
      ...legacyDraft,
      version: 3,
      cabinets: { ...legacyDraft.cabinets, primaryWallIn: 168 },
    };
    const customizedStorage = memoryStorage({
      [legacyKey]: JSON.stringify(customizedLegacy),
    }).storage;
    expect(loadSteelHomeProjectDraft(customizedStorage).cabinets.primaryWallIn).toBe(168);
  });

  it("uses every real named catalog record and a vendor-neutral alias for its exact photo", () => {
    expect(JW_STONE_NAMED_CATALOG.length).toBeGreaterThan(20);
    for (const stone of JW_STONE_NAMED_CATALOG) {
      expect(stone.anonymous).toBe(false);
      expect(stone.nameStatus).not.toBe("placeholder");
      expect(stone.publicLabel.trim()).not.toBe("");
      expect(stone.images[0]).toMatch(/^\/images\//);
      expect(getCatalogItemById(stone.id)).toBe(stone);
      const designerImage = buildStoneDesignerImageHref(stone.id);
      expect(designerImage).toBe(`/images/stone-designer/${stone.id}/1.webp`);
      expect(designerImage.toLowerCase()).not.toContain("jw-stone");
    }
  });

  it("calculates honest planning quantities without presenting a final field measure", () => {
    const draft = createEmptySteelHomeProjectDraft();
    expect(calculateCountertopSquareFeet(draft.countertops)).toBe(58.2);
    expect(calculateCabinetPlannedWidth(draft.cabinets)).toBe(198);
    expect(draft.cabinets.primaryWallIn - calculateCabinetPlannedWidth(draft.cabinets)).toBe(18);
    expect(
      draft.cabinets.primaryWallIn - calculateCabinetPlannedWidth(draft.cabinets)
    ).toBeGreaterThanOrEqual(0);

    draft.countertops.layout = "straight";
    draft.countertops.island = false;
    draft.countertops.wallAIn = 120;
    expect(calculateCountertopSquareFeet(draft.countertops)).toBe(21.3);
  });

  it("builds an itemized provisional building range with the base roof included once", () => {
    const draft = createEmptySteelHomeProjectDraft();
    const estimate = calculateBuildingPlanningEstimate(draft.building);

    expect(estimate).toMatchObject({
      key: "building",
      label: "Building package planning estimate",
      range: { lower: 80400, high: 124050 },
    });
    expect(formatPlanningRange(estimate.range)).toBe("$80,400–$124,050");
    expect(estimate.breakdown[0]).toMatchObject({
      key: "building-shell-with-roof",
      label: "Building shell with base roof",
      quantity: 2400,
      unit: "sq. ft.",
      range: { lower: 64800, high: 96000 },
    });
    expect(
      estimate.breakdown.filter((line) => line.key === "building-shell-with-roof")
    ).toHaveLength(1);
    expect(estimate.breakdown.find((line) => line.key === "roof-options")?.detail).toContain(
      "not a second roof charge"
    );
    expect(estimate.range).toEqual(
      estimate.breakdown.reduce(
        (total, line) => ({
          lower: total.lower + line.range.lower,
          high: total.high + line.range.high,
        }),
        { lower: 0, high: 0 }
      )
    );

    const publicEstimateText = JSON.stringify(estimate).toLowerCase();
    for (const forbidden of [...FORBIDDEN_PUBLIC_NAMES, ...FORBIDDEN_PUBLIC_PRICING_TERMS]) {
      expect(publicEstimateText).not.toContain(forbidden.toLowerCase());
    }
  });

  it("uses cabinet linear and per-module allowances in a fully itemized planning range", () => {
    const draft = createEmptySteelHomeProjectDraft();
    const estimate = calculateCabinetPlanningEstimate(draft.cabinets);

    expect(estimate).toMatchObject({
      key: "cabinets",
      label: "Cabinet planning estimate",
      range: { lower: 15650, high: 26950 },
    });
    expect(formatPlanningRange(estimate.range)).toBe("$15,650–$26,950");
    expect(estimate.breakdown.find((line) => line.key === "standard-cabinet-run")).toMatchObject({
      quantity: 13.5,
      unit: "linear ft.",
    });
    expect(estimate.breakdown.find((line) => line.key === "pantry-modules")).toMatchObject({
      quantity: 1,
      unit: "module",
      range: { lower: 950, high: 1650 },
    });
    expect(estimate.breakdown.find((line) => line.key === "drawer-base-modules")).toMatchObject({
      quantity: 2,
      unit: "modules",
      range: { lower: 1600, high: 2700 },
    });
    expect(estimate.range).toEqual(
      estimate.breakdown.reduce(
        (total, line) => ({
          lower: total.lower + line.range.lower,
          high: total.high + line.range.high,
        }),
        { lower: 0, high: 0 }
      )
    );

    const smaller = calculateCabinetPlanningEstimate({
      ...draft.cabinets,
      layout: "one-wall",
      primaryWallIn: 120,
      pantryCount: 0,
      drawerBaseCount: 0,
      island: false,
    });
    expect(smaller.range.lower).toBeLessThan(estimate.range.lower);
    expect(smaller.range.high).toBeLessThan(estimate.range.high);

    const publicEstimateText = JSON.stringify(estimate).toLowerCase();
    for (const forbidden of [...FORBIDDEN_PUBLIC_NAMES, ...FORBIDDEN_PUBLIC_PRICING_TERMS]) {
      expect(publicEstimateText).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps quote-required stone and added categories outside the numeric planning total", () => {
    const draft = createEmptySteelHomeProjectDraft();
    expect(getSteelHomeProjectEstimateSummary(draft)).toMatchObject({
      planningRange: null,
      planningEstimates: [],
      quoteRequired: [],
    });

    draft.building.included = true;
    draft.cabinets.included = true;
    draft.countertops.included = true;
    draft.countertops.stoneId = "taj-mahal";
    draft.additionalScopes = ["insulation", "mini-split-hvac", "foundation-and-site-work"];

    const summary = getSteelHomeProjectEstimateSummary(draft);
    expect(summary.planningEstimates.map((estimate) => estimate.key)).toEqual([
      "building",
      "cabinets",
    ]);
    expect(summary.planningRange).toEqual({ lower: 96050, high: 151000 });
    expect(summary.quoteRequired).toEqual([
      "Taj Mahal: material, fabrication, edge work, cutouts, delivery, and installation",
      "Insulation",
      "Mini-split heating and cooling",
      "Foundation and site work",
    ]);
    expect(JSON.stringify(summary.quoteRequired)).not.toContain("$0");
    expect(summary.disclaimer).toContain("not included in the planning total");
    expect(calculateBuildingPlanningEstimate(draft.building).disclaimer).toContain(
      "Site work, foundation, engineering, taxes, and installation are not included"
    );
    expect(calculateCabinetPlanningEstimate(draft.cabinets).disclaimer).toContain(
      "countertops, field measurement, taxes, and installation are not included"
    );

    const quoteOnlyDraft = createEmptySteelHomeProjectDraft();
    quoteOnlyDraft.countertops.included = true;
    quoteOnlyDraft.additionalScopes = ["appliances"];
    const quoteOnlySummary = getSteelHomeProjectEstimateSummary(quoteOnlyDraft);
    expect(quoteOnlySummary.planningRange).toBeNull();
    expect(quoteOnlySummary.quoteRequired).toHaveLength(2);
  });

  it("requires a role and location but accepts an added whole-home scope without a designer", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "Ocean Springs, MS";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.additionalScopes = ["mini-split-hvac"];

    expect(getSteelHomeProjectReadiness(draft)).toMatchObject({
      projectReady: false,
      needsRole: true,
      needsLocation: false,
      needsDesign: false,
      additionalScopeLabels: ["Mini-split heating and cooling"],
    });

    draft.projectRole = "owner-builder";
    expect(getSteelHomeProjectReadiness(draft)).toMatchObject({
      projectReady: true,
      needsRole: false,
      needsLocation: false,
      needsDesign: false,
    });
  });

  it("carries exact completed designs and the selected photographed surface into review", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "Ocean Springs, MS 39564";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.timing = "Within 6 months";
    draft.projectRole = "owner-builder";
    draft.additionalScopes = ["insulation", "tankless-water-heating"];
    draft.building.included = true;
    draft.building.widthFt = 54;
    draft.countertops.included = true;
    draft.countertops.stoneId = "taj-mahal";
    draft.countertops.wallAIn = 132;
    draft.cabinets.included = true;
    draft.cabinets.doorStyle = "Slab";

    const description = buildSteelHomeProjectDescription(draft);
    expect(description).toContain("54' wide × 60' long × 14' eave");
    expect(description).toContain("Project location: Ocean Springs, MS 39564 — Jackson County, MS");
    expect(description).toContain("Project role: I'm owner-building");
    expect(description).toMatch(/Visible planning range: \$[\d,]+–\$[\d,]+/);
    expect(description).toContain("Price after review: Taj Mahal:");
    expect(description).toContain("Insulation");
    expect(description).toContain("Tankless water heating");
    expect(description).toContain("Taj Mahal — Quartzite");
    expect(description).not.toContain("Stone record:");
    expect(description).not.toContain("Stone image:");
    expect(description).toContain('Wall runs: 132" × 96"');
    expect(description).toContain("Style: Slab");
    expect(description).toContain("Final field measurements");
    expect(description.length).toBeLessThanOrEqual(5000);

    const href = buildSteelHomeProjectRequestHref(
      "/direct-connect?target=old-target&intent=hire&contractorId=old-contractor",
      draft
    );
    const url = new URL(href, "https://www.thetradescout.com");
    expect(url.pathname).toBe("/direct-connect");
    expect(url.searchParams.get("profile")).toBe("steel-home-packages");
    expect(url.searchParams.get("profileName")).toBe("Steel Home Project Center");
    expect(url.searchParams.get("source")).toBe("steel_home_project_center");
    expect(url.searchParams.get("subject")).toBe("product");
    expect(url.searchParams.get("title")).toBe(
      "Steel-home project review: Building + roof + Stone + quartz + Cabinets"
    );
    expect(url.searchParams.get("description")).toBe(description);
    expect(url.searchParams.get("location")).toBe("Ocean Springs, MS 39564");
    expect(url.searchParams.get("county")).toBe("28059");
    expect(url.searchParams.get("state")).toBe("MS");
    expect(url.searchParams.get("when")).toBe("Within 6 months");
    expect(url.searchParams.has("target")).toBe(false);
    expect(url.searchParams.has("intent")).toBe(false);
    expect(url.searchParams.has("contractorId")).toBe(false);

    for (const forbidden of FORBIDDEN_PUBLIC_NAMES) {
      expect(href.toLowerCase()).not.toContain(forbidden.toLowerCase());
      expect(description.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps every selected design, full notes, and the disclaimer in the bounded handoff brief", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "X".repeat(160);
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.timing = "As soon as practical";
    draft.projectRole = "owner-builder";
    draft.additionalScopes = ADDITIONAL_PROJECT_SCOPE_OPTIONS.map((option) => option.value);
    draft.building.included = true;
    draft.countertops.included = true;
    draft.cabinets.included = true;
    draft.building.notes = `BUILD-${"B".repeat(234)}`;
    draft.countertops.notes = `STONE-${"S".repeat(234)}`;
    draft.cabinets.notes = `CABINET-${"C".repeat(232)}`;

    const description = buildSteelHomeProjectDescription(draft);
    expect(description).toContain("BUILDING CONCEPT");
    expect(description).toContain("COUNTERTOP CONCEPT");
    expect(description).toContain("CABINET CONCEPT");
    expect(description).toContain(draft.building.notes);
    expect(description).toContain(draft.countertops.notes);
    expect(description).toContain(draft.cabinets.notes);
    expect(description).toContain("Planning concept only.");
    expect(description).toContain("Installation and trade support");
    expect(description.length).toBeLessThanOrEqual(5000);
  });

  it("keeps local labor untargeted while retaining related design context", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "Biloxi, MS";
    draft.stateCode = "MS";
    draft.countyFips = "28047";
    draft.countyName = "Harrison County";
    draft.projectRole = "has-builder";
    draft.additionalScopes = ["windows-and-doors", "appliance-protection"];
    draft.countertops.included = true;
    draft.countertops.stoneId = "cristallo";
    draft.labor.trades = ["Stone fabrication", "Countertop installation"];

    const href = buildSteelHomeLaborRequestHref(
      "/direct-connect?profile=steel-home-packages&target=someone&targetProviderId=provider",
      draft
    );
    const url = new URL(href, "https://www.thetradescout.com");
    expect(url.searchParams.get("subject")).toBe("service");
    expect(url.searchParams.get("source")).toBe("steel_home_project_tools_labor");
    expect(url.searchParams.get("county")).toBe("28047");
    expect(url.searchParams.get("state")).toBe("MS");
    expect(url.searchParams.get("description")).toContain(
      "Countertop concept: Kitchen; Cristallo; 58.2 sq. ft. approximate"
    );
    expect(url.searchParams.get("description")).toContain("Project role: I already have a builder");
    expect(url.searchParams.get("description")).toContain(
      "Additional scopes needing a quote: Windows and exterior doors, Appliance protection"
    );
    for (const target of ["profile", "profileName", "target", "targetProviderId", "contractorId"]) {
      expect(url.searchParams.has(target)).toBe(false);
    }
  });
});
