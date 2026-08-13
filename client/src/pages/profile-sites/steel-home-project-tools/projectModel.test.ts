import { describe, expect, it } from "vitest";
import {
  JW_STONE_ANONYMOUS_CATALOG,
  JW_STONE_NAMED_CATALOG,
  getCatalogItemById,
} from "@/features/jw-stone/catalog";
import {
  ADDITIONAL_PROJECT_SCOPE_OPTIONS,
  PROJECT_ROLE_OPTIONS,
  PROJECT_TIMING_OPTIONS,
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

const FORBIDDEN_CURRENT_CUSTOMER_TERMS = [
  "owner-builder",
  "owner-building",
  "scope",
  "brief",
  "handoff",
  "staged",
  "payload",
  "context",
  "target provider",
  "provider id",
  "profile slug",
  "release state",
  "fips",
  "record id",
  "fulfillment",
  "planning range",
  "planning estimate",
  "allowance",
  "concept",
  "local review",
  "price after review",
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
  it("reconciles bounds, old role data, and unnamed stone records to safe defaults", () => {
    const anonymousStone = JW_STONE_ANONYMOUS_CATALOG[0];
    expect(anonymousStone).toBeDefined();

    const reconciled = reconcileSteelHomeProjectDraft({
      version: 99,
      location: `  ${"x".repeat(220)}  `,
      stateCode: "TX",
      countyFips: "28059",
      countyName: "invented name",
      timing: "Yesterday",
      projectRole: "self-contracted",
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
    expect(reconciled.projectRole).toBe("self-contracted");
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

  it("provides complete customer-facing role and quote-only home-need records", () => {
    expect(PROJECT_ROLE_OPTIONS.map((option) => option.value)).toEqual([
      "self-contracted",
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
    expect(PROJECT_ROLE_OPTIONS[0]).toMatchObject({
      value: "self-contracted",
      label: "Self-contracted homeowner",
      description: "Plan the packages and list the trades you need.",
    });
    expect(PROJECT_ROLE_OPTIONS.map(({ label, description }) => ({ label, description }))).toEqual([
      {
        label: "Self-contracted homeowner",
        description: "Plan the packages and list the trades you need.",
      },
      {
        label: "Homeowner with a builder",
        description: "Plan the packages to review with your builder.",
      },
      {
        label: "Builder or contractor",
        description: "Plan the packages for your customer's project.",
      },
      {
        label: "Need help managing the full build",
        description: "Include the packages and local trades the project needs.",
      },
    ]);
    expect(PROJECT_TIMING_OPTIONS).toEqual([
      "As soon as possible",
      "Within 3 months",
      "Within 6 months",
      "Within 12 months",
      "More than 12 months away",
    ]);
    const currentOptionCopy = JSON.stringify([
      ...PROJECT_ROLE_OPTIONS,
      ...ADDITIONAL_PROJECT_SCOPE_OPTIONS,
    ]).toLowerCase();
    expect(currentOptionCopy).not.toContain("owner-builder");
    expect(currentOptionCopy).not.toContain("owner-building");

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
    expect(STEEL_HOME_PROJECT_DRAFT_VERSION).toBe(5);
    expect(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY).toBe(
      "tradescout:steel-home-project-tools:draft:v5"
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

  it("migrates the v4 role language without losing any completed design", () => {
    const legacyKey = "tradescout:steel-home-project-tools:draft:v4";
    const legacyDraft = createEmptySteelHomeProjectDraft();
    legacyDraft.location = "Biloxi, MS";
    legacyDraft.stateCode = "MS";
    legacyDraft.countyFips = "28047";
    legacyDraft.countyName = "Harrison County";
    legacyDraft.building.included = true;
    legacyDraft.building.widthFt = 54;
    legacyDraft.building.notes = "Keep this building";
    legacyDraft.countertops.included = true;
    legacyDraft.countertops.stoneId = "taj-mahal";
    legacyDraft.countertops.wallAIn = 132;
    legacyDraft.cabinets.included = true;
    legacyDraft.cabinets.primaryWallIn = 168;
    legacyDraft.cabinets.doorStyle = "Slab";
    legacyDraft.additionalScopes = ["insulation", "mini-split-hvac"];
    const { storage, values } = memoryStorage({
      [legacyKey]: JSON.stringify({
        ...legacyDraft,
        version: 4,
        projectRole: "owner-builder",
        timing: "Planning ahead",
      }),
    });

    expect(loadSteelHomeProjectDraft(storage)).toMatchObject({
      version: STEEL_HOME_PROJECT_DRAFT_VERSION,
      location: "Biloxi, MS",
      projectRole: "self-contracted",
      timing: "More than 12 months away",
      additionalScopes: ["insulation", "mini-split-hvac"],
      building: { included: true, widthFt: 54, notes: "Keep this building" },
      countertops: { included: true, stoneId: "taj-mahal", wallAIn: 132 },
      cabinets: { included: true, primaryWallIn: 168, doorStyle: "Slab" },
    });
    expect(values.has(legacyKey)).toBe(false);
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(true);

    const deployedV3 = {
      ...legacyDraft,
      version: 3,
      projectRole: undefined,
      additionalScopes: undefined,
      countertops: { ...legacyDraft.countertops, included: false },
      cabinets: { ...legacyDraft.cabinets, included: false, primaryWallIn: 144 },
    };
    const deployedV3Storage = memoryStorage({
      "tradescout:steel-home-project-tools:draft:v3": JSON.stringify(deployedV3),
    }).storage;
    expect(loadSteelHomeProjectDraft(deployedV3Storage).cabinets.primaryWallIn).toBe(216);
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

  it("calculates honest early quantities without presenting a final field measure", () => {
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

  it("builds an itemized early building estimate with the base roof included once", () => {
    const draft = createEmptySteelHomeProjectDraft();
    const estimate = calculateBuildingPlanningEstimate(draft.building);

    expect(estimate).toMatchObject({
      key: "building",
      label: "Building package early estimate",
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
    for (const forbidden of [
      ...FORBIDDEN_PUBLIC_NAMES,
      ...FORBIDDEN_PUBLIC_PRICING_TERMS,
      ...FORBIDDEN_CURRENT_CUSTOMER_TERMS,
    ]) {
      expect(publicEstimateText).not.toContain(forbidden.toLowerCase());
    }
  });

  it("uses cabinet linear and per-module prices in a fully itemized early estimate", () => {
    const draft = createEmptySteelHomeProjectDraft();
    const estimate = calculateCabinetPlanningEstimate(draft.cabinets);

    expect(estimate).toMatchObject({
      key: "cabinets",
      label: "Cabinet early estimate",
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
    for (const forbidden of [
      ...FORBIDDEN_PUBLIC_NAMES,
      ...FORBIDDEN_PUBLIC_PRICING_TERMS,
      ...FORBIDDEN_CURRENT_CUSTOMER_TERMS,
    ]) {
      expect(publicEstimateText).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps quote-needed stone and added categories outside the numeric estimated total", () => {
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
    expect(summary.disclaimer).toContain("not included in the estimated total");
    expect(calculateBuildingPlanningEstimate(draft.building).disclaimer).toContain(
      "Site work, foundation, engineering, taxes, and installation are not included"
    );
    expect(calculateCabinetPlanningEstimate(draft.cabinets).disclaimer.toLowerCase()).toContain(
      "countertops, field measurement, taxes, and installation are not included"
    );

    const quoteOnlyDraft = createEmptySteelHomeProjectDraft();
    quoteOnlyDraft.countertops.included = true;
    quoteOnlyDraft.additionalScopes = ["appliances"];
    const quoteOnlySummary = getSteelHomeProjectEstimateSummary(quoteOnlyDraft);
    expect(quoteOnlySummary.planningRange).toBeNull();
    expect(quoteOnlySummary.quoteRequired).toHaveLength(2);
  });

  it("requires a role and location but accepts an added home need without a designer", () => {
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

    draft.projectRole = "self-contracted";
    expect(getSteelHomeProjectReadiness(draft)).toMatchObject({
      projectReady: true,
      needsRole: false,
      needsLocation: false,
      needsDesign: false,
    });
  });

  it("carries exact completed designs and the selected photographed surface into the summary", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "Ocean Springs, MS 39564";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.timing = "Within 6 months";
    draft.projectRole = "self-contracted";
    draft.additionalScopes = ["insulation", "tankless-water-heating"];
    draft.building.included = true;
    draft.building.widthFt = 54;
    draft.countertops.included = true;
    draft.countertops.stoneId = "taj-mahal";
    draft.countertops.wallAIn = 132;
    draft.cabinets.included = true;
    draft.cabinets.doorStyle = "Slab";

    const description = buildSteelHomeProjectDescription(draft);
    expect(description).toMatch(/^TradeScout Steel Home Project Request\n/);
    expect(description).toContain("54' wide × 60' long × 14' eave");
    expect(description).toContain("Project location: Ocean Springs, MS 39564 — Jackson County, MS");
    expect(description).toContain("Contracting setup: Self-contracted homeowner");
    expect(description).toMatch(/Early estimated total: \$[\d,]+–\$[\d,]+/);
    expect(description).toContain("Quote needed: Taj Mahal:");
    expect(description).toContain("Insulation");
    expect(description).toContain("Tankless water heating");
    expect(description).toContain("Taj Mahal — Quartzite");
    expect(description).toContain("Selected packages: Building + roof, Countertops, Cabinets");
    expect(description).not.toContain("Stone record:");
    expect(description).not.toContain("Stone image:");
    expect(description).toContain('Wall runs: 132" × 96"');
    expect(description).toContain("Style: Slab");
    expect(description).toContain("Building + Roof Details");
    expect(description).toContain("Cabinet Details");
    expect(description).toContain('Main wall used: 198" of 216"');
    expect(description).toContain("Estimated area: About 60.4 sq. ft.");
    expect(description).toContain(
      "This request is not a quote. Final pricing depends on field measurements, engineering, site and permit requirements, product availability, tax, delivery, fabrication, and installation."
    );
    expect(description.length).toBeLessThanOrEqual(5000);

    const engineeredQuartzDraft = createEmptySteelHomeProjectDraft();
    engineeredQuartzDraft.countertops.included = true;
    engineeredQuartzDraft.countertops.stoneId = "aj-quartz";
    const engineeredQuartzDescription = buildSteelHomeProjectDescription(engineeredQuartzDraft);
    expect(engineeredQuartzDescription).toContain(
      "Selected surface: AJ Quartz — Engineered Quartz"
    );
    expect(engineeredQuartzDescription).toContain("Selected packages: Countertops");
    expect(engineeredQuartzDescription).not.toContain("Stone + quartz");

    const graniteDraft = createEmptySteelHomeProjectDraft();
    graniteDraft.countertops.included = true;
    graniteDraft.countertops.stoneId = "blue-goias";
    const graniteDescription = buildSteelHomeProjectDescription(graniteDraft);
    expect(graniteDescription).toContain("Selected packages: Countertops");
    expect(graniteDescription).toContain("Selected surface: Blue Goias — Granite");
    expect(graniteDescription).not.toContain("Quartzite / engineered quartz");

    const href = buildSteelHomeProjectRequestHref(
      "/direct-connect?target=old-target&intent=hire&contractorId=old-contractor",
      draft
    );
    const url = new URL(href, "https://www.thetradescout.com");
    expect(url.pathname).toBe("/direct-connect");
    expect(url.searchParams.get("profile")).toBe("steel-home-packages");
    expect(url.searchParams.get("profileName")).toBe("Steel Home Project Workspace");
    expect(url.searchParams.get("source")).toBe("steel_home_project_center");
    expect(url.searchParams.get("subject")).toBe("product");
    expect(url.searchParams.get("title")).toBe(
      "TradeScout Steel Home Project Request — Building + roof, Countertops, Cabinets"
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
    for (const forbidden of FORBIDDEN_CURRENT_CUSTOMER_TERMS) {
      expect(description.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps every selected design, full notes, and the disclaimer in the bounded summary", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "X".repeat(160);
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.timing = "As soon as possible";
    draft.projectRole = "self-contracted";
    draft.additionalScopes = ADDITIONAL_PROJECT_SCOPE_OPTIONS.map((option) => option.value);
    draft.building.included = true;
    draft.countertops.included = true;
    draft.cabinets.included = true;
    draft.building.notes = `BUILD-${"B".repeat(234)}`;
    draft.countertops.notes = `STONE-${"S".repeat(234)}`;
    draft.cabinets.notes = `CABINET-${"C".repeat(232)}`;

    const description = buildSteelHomeProjectDescription(draft);
    expect(description).toContain("Building + Roof Details");
    expect(description).toContain("Countertop Details");
    expect(description).toContain("Cabinet Details");
    expect(description).toContain(draft.building.notes);
    expect(description).toContain(draft.countertops.notes);
    expect(description).toContain(draft.cabinets.notes);
    expect(description).toContain("This request is not a quote");
    expect(description).toContain("Installation and trade work");
    expect(description.length).toBeLessThanOrEqual(5000);
  });

  it("keeps local trade help untargeted while retaining related design context", () => {
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
      "Countertop details: Kitchen; Cristallo — Quartzite; About 58.2 sq. ft."
    );
    expect(url.searchParams.get("description")).toMatch(/^TradeScout Local Trade Request\n/);
    expect(url.searchParams.get("title")).toBe(
      "TradeScout Local Trade Request — Stone fabrication, Countertop installation"
    );
    expect(url.searchParams.get("description")).toContain(
      "Work needed: Stone fabrication, Countertop installation"
    );
    expect(url.searchParams.get("description")).toContain(
      "Contracting setup: Homeowner with a builder"
    );
    expect(url.searchParams.get("description")).toContain(
      "Other home needs requiring a quote: Windows and exterior doors, Appliance warranty or service plan"
    );
    expect(url.searchParams.get("description")).toContain("Related packages: Countertops");
    expect(url.searchParams.get("title")?.toLowerCase()).not.toContain("labor");
    expect(url.searchParams.get("description")?.toLowerCase()).not.toContain("labor");
    for (const target of ["profile", "profileName", "target", "targetProviderId", "contractorId"]) {
      expect(url.searchParams.has(target)).toBe(false);
    }
  });
});
