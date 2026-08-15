import { describe, expect, it } from "vitest";
import {
  JW_STONE_ANONYMOUS_CATALOG,
  JW_STONE_NAMED_CATALOG,
  getCatalogItemById,
} from "@/features/jw-stone/catalog";
import {
  ADDITIONAL_PROJECT_SCOPE_OPTIONS,
  COUNTERTOP_BACKSPLASH_OPTIONS,
  PROJECT_ROLE_OPTIONS,
  PROJECT_TIMING_OPTIONS,
  STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
  STEEL_HOME_PROJECT_DRAFT_VERSION,
  buildCountertopFabricatorRequestDescription,
  buildCountertopFabricatorRequestHref,
  buildCountertopStoneRequestDescription,
  buildCountertopStoneRequestHref,
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
  formatCountertopOpeningSchedule,
  getAvailableCountertopCutoutRuns,
  getCountertopCutoutRunDepth,
  getCountertopOpeningFrontBounds,
  getCountertopOpeningSchedule,
  getCountertopPlacementProblems,
  getSteelHomeProjectEstimateSummary,
  getSteelHomeProjectReadiness,
  loadSteelHomeProjectDraft,
  reconcileSteelHomeProjectDraft,
  saveSteelHomeProjectDraft,
  type SteelHomeProjectStorage,
} from "./projectModel";
import {
  buildNamedStoneDesignerImageHref,
  buildStoneDesignerImageHref,
  buildStoneDesignerPhotoKey,
} from "./stoneDesignerImages";
import {
  createBlankCabinetPlannerExtension,
  createCabinetPlannerModule,
  type CabinetPlannerExtensionV1,
} from "./cabinetPlannerModel";
import {
  createEmptyBuildingPlannerExtension,
  type BuildingPlannerExtensionV1,
} from "./buildingPlannerModel";

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

function measuredCabinetPlanner(notes = ""): CabinetPlannerExtensionV1 {
  return {
    ...createBlankCabinetPlannerExtension(),
    starter: "kitchen",
    shell: {
      widthIn: 144,
      depthIn: 120,
      heightIn: 96,
      measurementsReviewed: true,
    },
    modules: [
      {
        ...createCabinetPlannerModule("base-cabinet", "base-1"),
        label: "Sink base",
        offsetIn: 18,
        widthIn: 36,
      },
    ],
    notes,
  };
}

function measuredBuildingPlanner(
  options: { widthFt?: number; notes?: string } = {}
): BuildingPlannerExtensionV1 {
  return {
    ...createEmptyBuildingPlannerExtension(),
    useId: "home-with-shop",
    systemId: "open-web-truss",
    widthFt: options.widthFt ?? 40,
    lengthFt: 60,
    eaveHeightFt: 14,
    roofId: "gable",
    roofPitchRise12: 4,
    colors: { wall: "polar-white", roof: "charcoal", trim: "bronze" },
    notes: options.notes ?? "",
  };
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
    expect(reconciled.countertops.stoneId).toBe("");
    expect(reconciled.countertops.wallAIn).toBe(26);
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
      description: "Use the planners while managing the project yourself.",
    });
    expect(PROJECT_ROLE_OPTIONS.map(({ label, description }) => ({ label, description }))).toEqual([
      {
        label: "Self-contracted homeowner",
        description: "Use the planners while managing the project yourself.",
      },
      {
        label: "Homeowner with a builder",
        description: "Use the planners to prepare choices for your builder.",
      },
      {
        label: "Builder or contractor",
        description: "Use the planners to prepare choices for your customer's project.",
      },
      {
        label: "Need help managing the project",
        description: "Use the planners first, then explain the management help you need.",
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

  it("round-trips only the current v9 schema and recovers from corrupt browser storage", () => {
    const { storage, values } = memoryStorage();
    const draft = createEmptySteelHomeProjectDraft();
    expect(STEEL_HOME_PROJECT_DRAFT_VERSION).toBe(9);
    expect(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY).toBe(
      "tradescout:steel-home-project-tools:draft:v9"
    );
    draft.location = "39564";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.projectRole = "has-builder";
    draft.additionalScopes = ["windows-and-doors", "appliances"];
    draft.countertops.included = true;
    draft.countertops.island = true;
    draft.countertops.stoneId = "taj-mahal";
    draft.countertops.wallDepthIn = 22;
    draft.countertops.sink = "Farmhouse";
    draft.countertops.sinkRun = "main";
    draft.countertops.sinkPositionIn = 48;
    draft.countertops.sinkFrontPositionIn = 13;
    draft.countertops.cooktop = "36-inch cooktop cutout";
    draft.countertops.cooktopRun = "left-return";
    draft.countertops.cooktopPositionIn = 52;
    draft.countertops.cooktopFrontPositionIn = 13;
    draft.countertops.otherCutouts = [
      {
        id: "outlet",
        type: "Pop-up outlet",
        label: "",
        run: "island",
        positionIn: 42,
        frontPositionIn: 21,
        widthIn: 4,
        depthIn: 4,
      },
    ];

    expect(saveSteelHomeProjectDraft(storage, draft)).toBe(true);
    expect(loadSteelHomeProjectDraft(storage)).toMatchObject({
      location: "39564",
      stateCode: "MS",
      countyFips: "28059",
      countyName: "Jackson County",
      projectRole: "has-builder",
      additionalScopes: ["windows-and-doors", "appliances"],
      countertops: {
        included: true,
        stoneId: "taj-mahal",
        wallDepthIn: 22,
        sinkFrontPositionIn: 13,
        cooktopFrontPositionIn: 13,
        otherCutouts: [{ id: "outlet", frontPositionIn: 21 }],
      },
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
    values.set("tradescout:steel-home-project-tools:draft:v7", JSON.stringify(draft));
    clearSteelHomeProjectDraft(storage);
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(false);
    expect(values.has("tradescout:steel-home-project-tools:draft:v7")).toBe(false);
  });

  it("migrates a v8 design into the spatial-studio v9 defaults", () => {
    const legacyKey = "tradescout:steel-home-project-tools:draft:v8";
    const legacyDraft = createEmptySteelHomeProjectDraft();
    const legacyCountertops = { ...legacyDraft.countertops } as Record<string, unknown>;
    for (const key of [
      "textureImageIndex",
      "texturePhotoKey",
      "textureOffsetX",
      "textureOffsetY",
      "textureScale",
      "veinRotation",
      "cameraPreset",
      "floorStone",
      "showSeams",
      "waterfall",
    ]) {
      delete legacyCountertops[key];
    }
    const { storage, values } = memoryStorage({
      [legacyKey]: JSON.stringify({ ...legacyDraft, version: 8, countertops: legacyCountertops }),
    });

    expect(loadSteelHomeProjectDraft(storage)).toMatchObject({
      version: 9,
      countertops: {
        textureImageIndex: 0,
        texturePhotoKey: "",
        textureOffsetX: 0,
        textureOffsetY: 0,
        textureScale: 1,
        veinRotation: 0,
        cameraPreset: "Perspective",
        floorStone: false,
        showSeams: false,
        waterfall: "None",
        sink: "None",
        cooktop: "None",
      },
    });
    expect(values.has(legacyKey)).toBe(false);
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(true);
  });

  it("defaults to only the primary countertop surface and no optional fabrication", () => {
    expect(createEmptySteelHomeProjectDraft().countertops).toMatchObject({
      island: false,
      backsplash: "None",
      floorStone: false,
      sink: "None",
      cooktop: "None",
      otherCutouts: [],
      showSeams: false,
      waterfall: "None",
      edge: "None",
    });
  });

  it("keeps the selected inventory photo within that stone's real image set", () => {
    const draft = createEmptySteelHomeProjectDraft();
    const alabamaWhite = getCatalogItemById("alabama-white")!;
    const lastAlabamaPhotoKey = buildStoneDesignerPhotoKey(alabamaWhite.images[40])!;
    draft.countertops.stoneId = "alabama-white";
    draft.countertops.textureImageIndex = 0;
    draft.countertops.texturePhotoKey = lastAlabamaPhotoKey;
    expect(reconcileSteelHomeProjectDraft(draft).countertops).toMatchObject({
      textureImageIndex: 40,
      texturePhotoKey: lastAlabamaPhotoKey,
    });
    const { storage } = memoryStorage();
    expect(saveSteelHomeProjectDraft(storage, draft)).toBe(true);
    expect(loadSteelHomeProjectDraft(storage).countertops).toMatchObject({
      textureImageIndex: 40,
      texturePhotoKey: lastAlabamaPhotoKey,
    });

    draft.countertops.stoneId = "blue-fantasy";
    draft.countertops.textureImageIndex = 40;
    expect(reconcileSteelHomeProjectDraft(draft).countertops).toMatchObject({
      textureImageIndex: 0,
      texturePhotoKey: expect.stringMatching(/^ph_[0-9a-f]{16}$/),
    });
  });

  it("removes waterfall selections when no island exists", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.island = false;
    draft.countertops.waterfall = "Both";
    expect(reconcileSteelHomeProjectDraft(draft).countertops.waterfall).toBe("None");
  });

  it("migrates v7 countertop dimensions to v9 with the former 25.5-inch wall depth", () => {
    const legacyKey = "tradescout:steel-home-project-tools:draft:v7";
    const legacyDraft = createEmptySteelHomeProjectDraft();
    const legacyCountertops = {
      ...legacyDraft.countertops,
      included: true,
      room: "Primary bathroom",
      wallAIn: 84,
      wallBIn: 54,
      sink: "Single-bowl undermount",
      sinkRun: "main",
      sinkPositionIn: 42,
      sinkFrontPositionIn: 13,
    } as Record<string, unknown>;
    delete legacyCountertops.wallDepthIn;

    const { storage, values } = memoryStorage({
      [legacyKey]: JSON.stringify({
        ...legacyDraft,
        version: 7,
        countertops: legacyCountertops,
      }),
    });

    expect(loadSteelHomeProjectDraft(storage)).toMatchObject({
      version: 9,
      countertops: {
        included: true,
        room: "Primary bathroom",
        wallAIn: 84,
        wallBIn: 54,
        wallDepthIn: 25.5,
        sinkRun: "main",
        sinkPositionIn: 42,
        sinkFrontPositionIn: 13,
      },
    });
    expect(values.has(legacyKey)).toBe(false);
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(true);
  });

  it("migrates v6 opening placements to v9 with new front positions and wall depth defaulted", () => {
    const legacyKey = "tradescout:steel-home-project-tools:draft:v6";
    const legacyDraft = createEmptySteelHomeProjectDraft();
    const legacyCountertops = {
      ...legacyDraft.countertops,
      included: true,
      island: true,
      sink: "Farmhouse",
      sinkRun: "main",
      sinkPositionIn: 48,
      cooktop: "36-inch cooktop cutout",
      cooktopRun: "left-return",
      cooktopPositionIn: 40,
      otherCutouts: [
        {
          id: "outlet",
          type: "Pop-up outlet",
          label: "",
          run: "island",
          positionIn: 42,
          widthIn: 4,
          depthIn: 4,
        },
      ],
    } as Record<string, unknown>;
    delete legacyCountertops.sinkFrontPositionIn;
    delete legacyCountertops.cooktopFrontPositionIn;

    const { storage, values } = memoryStorage({
      [legacyKey]: JSON.stringify({
        ...legacyDraft,
        version: 6,
        countertops: legacyCountertops,
      }),
    });

    const migrated = loadSteelHomeProjectDraft(storage);
    expect(migrated).toMatchObject({
      version: 9,
      countertops: {
        included: true,
        wallDepthIn: 25.5,
        sinkRun: "main",
        sinkPositionIn: 48,
        sinkFrontPositionIn: null,
        cooktopRun: "left-return",
        cooktopPositionIn: 40,
        cooktopFrontPositionIn: null,
        otherCutouts: [
          {
            id: "outlet",
            run: "island",
            positionIn: 42,
            frontPositionIn: null,
            widthIn: 4,
            depthIn: 4,
          },
        ],
      },
    });
    expect(values.has(legacyKey)).toBe(false);
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(true);
  });

  it("migrates a v5 countertop draft through v9 without losing choices", () => {
    const legacyKey = "tradescout:steel-home-project-tools:draft:v5";
    const legacyDraft = createEmptySteelHomeProjectDraft();
    const legacyCountertops = {
      ...legacyDraft.countertops,
      included: true,
      stoneId: "taj-mahal",
      wallAIn: 144,
      sink: "Farmhouse",
      cooktop: "36-inch",
    } as Record<string, unknown>;
    delete legacyCountertops.sinkRun;
    delete legacyCountertops.sinkPositionIn;
    delete legacyCountertops.cooktopRun;
    delete legacyCountertops.cooktopPositionIn;
    delete legacyCountertops.otherCutouts;

    const { storage, values } = memoryStorage({
      [legacyKey]: JSON.stringify({
        ...legacyDraft,
        version: 5,
        countertops: legacyCountertops,
      }),
    });

    const migrated = loadSteelHomeProjectDraft(storage);
    expect(migrated).toMatchObject({
      version: 9,
      countertops: {
        included: true,
        stoneId: "taj-mahal",
        wallAIn: 144,
        wallDepthIn: 25.5,
        sink: "Farmhouse",
        sinkRun: "",
        sinkPositionIn: null,
        sinkFrontPositionIn: null,
        cooktop: "36-inch cooktop cutout",
        cooktopRun: "",
        cooktopPositionIn: null,
        cooktopFrontPositionIn: null,
        otherCutouts: [],
      },
    });
    expect(values.has(legacyKey)).toBe(false);
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(true);
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
    expect(draft.countertops).toMatchObject({
      wallDepthIn: 25.5,
      sink: "None",
      sinkRun: "",
      sinkPositionIn: null,
      sinkFrontPositionIn: null,
      cooktop: "None",
      cooktopRun: "",
      cooktopPositionIn: null,
      cooktopFrontPositionIn: null,
      otherCutouts: [],
    });
    expect(getCountertopOpeningSchedule(draft.countertops)).toEqual([]);
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([]);
    expect(calculateCountertopSquareFeet(draft.countertops)).toBe(33.7);
    expect(calculateCabinetPlannedWidth(draft.cabinets)).toBe(198);
    expect(draft.cabinets.primaryWallIn - calculateCabinetPlannedWidth(draft.cabinets)).toBe(18);
    expect(
      draft.cabinets.primaryWallIn - calculateCabinetPlannedWidth(draft.cabinets)
    ).toBeGreaterThanOrEqual(0);

    draft.countertops.layout = "straight";
    draft.countertops.island = false;
    draft.countertops.wallAIn = 120;
    expect(calculateCountertopSquareFeet(draft.countertops)).toBe(21.3);
    expect(getCountertopCutoutRunDepth(draft.countertops, "main")).toBe(25.5);
    draft.countertops.island = true;
    draft.countertops.islandWidthIn = 54;
    expect(getCountertopCutoutRunDepth(draft.countertops, "island")).toBe(54);
  });

  it("sanitizes explicit wall-top depth to half-inch values within 12 and 72 inches", () => {
    expect(createEmptySteelHomeProjectDraft().countertops.wallDepthIn).toBe(25.5);
    expect(
      reconcileSteelHomeProjectDraft({ countertops: { wallDepthIn: -999 } }).countertops.wallDepthIn
    ).toBe(12);
    expect(
      reconcileSteelHomeProjectDraft({ countertops: { wallDepthIn: 999 } }).countertops.wallDepthIn
    ).toBe(72);
    expect(
      reconcileSteelHomeProjectDraft({ countertops: { wallDepthIn: 22.26 } }).countertops
        .wallDepthIn
    ).toBe(22.5);
    expect(
      reconcileSteelHomeProjectDraft({ countertops: { wallDepthIn: "hostile" } }).countertops
        .wallDepthIn
    ).toBe(25.5);
  });

  it("uses a bathroom's 22-inch wall depth for area, opening bounds, and both countertop requests", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.included = true;
    draft.countertops.room = "Primary bathroom";
    draft.countertops.layout = "u-shape";
    draft.countertops.wallAIn = 120;
    draft.countertops.wallBIn = 96;
    draft.countertops.wallCIn = 72;
    draft.countertops.island = false;
    draft.countertops.measurementsReviewed = true;

    expect(calculateCountertopSquareFeet(draft.countertops)).toBe(42);
    draft.countertops.wallDepthIn = 22;
    expect(calculateCountertopSquareFeet(draft.countertops)).toBe(37.3);
    expect(getCountertopCutoutRunDepth(draft.countertops, "main")).toBe(22);
    expect(getCountertopCutoutRunDepth(draft.countertops, "left-return")).toBe(22);
    expect(getCountertopCutoutRunDepth(draft.countertops, "right-return")).toBe(22);

    draft.countertops.sink = "Single-bowl undermount";
    draft.countertops.sinkRun = "main";
    draft.countertops.sinkPositionIn = 60;
    draft.countertops.sinkFrontPositionIn = 11;
    draft.countertops.sinkTemplateWidthIn = 30;
    draft.countertops.sinkTemplateDepthIn = 18;
    const [sink] = getCountertopOpeningSchedule(draft.countertops);
    expect(getCountertopOpeningFrontBounds(draft.countertops, sink)).toEqual({
      minimum: 10,
      maximum: 12,
      surfaceDepth: 22,
    });
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([]);
    draft.countertops.sinkFrontPositionIn = 13;
    expect(getCountertopPlacementProblems(draft.countertops)).toContain(
      "Sink — Single-bowl undermount is too close to the front or back edge of main run."
    );
    draft.countertops.sinkFrontPositionIn = 11;

    const descriptions = [
      buildCountertopStoneRequestDescription(draft),
      buildCountertopFabricatorRequestDescription(draft),
    ];
    for (const description of descriptions) {
      expect(description).toContain('Main run: 120"');
      expect(description).toContain('Left return: 96"');
      expect(description).toContain('Right return: 72"');
      expect(description).toContain('Wall-top depth: 22"');
      expect(description).not.toContain('Wall runs: 120" × 96" × 72"');
    }
  });

  it("enforces layout-aware run minima and a nondecreasing legal gross footprint", () => {
    const straight = reconcileSteelHomeProjectDraft({
      countertops: { layout: "straight", wallAIn: -999, island: false },
    }).countertops;
    const lShape = reconcileSteelHomeProjectDraft({
      countertops: { layout: "l-shape", wallAIn: -999, wallBIn: -999, island: false },
    }).countertops;
    const uShape = reconcileSteelHomeProjectDraft({
      countertops: {
        layout: "u-shape",
        wallAIn: -999,
        wallBIn: -999,
        wallCIn: -999,
        island: false,
      },
    }).countertops;

    expect(straight.wallAIn).toBe(24);
    expect(lShape).toMatchObject({ wallAIn: 26, wallBIn: 26 });
    expect(uShape).toMatchObject({ wallAIn: 52, wallBIn: 26, wallCIn: 26 });

    for (const layout of ["l-shape", "u-shape"] as const) {
      const footprints = [26, 27, 52, 96].map((returnIn) =>
        calculateCountertopSquareFeet({
          ...createEmptySteelHomeProjectDraft().countertops,
          layout,
          wallAIn: layout === "u-shape" ? 52 : 26,
          wallBIn: returnIn,
          wallCIn: returnIn,
          island: false,
        })
      );
      expect(footprints.every((area) => area >= 0)).toBe(true);
      expect(footprints).toEqual([...footprints].sort((left, right) => left - right));
    }
  });

  it("sanitizes hostile opening data, deduplicates IDs, and bounds positions and dimensions", () => {
    const reconciled = reconcileSteelHomeProjectDraft({
      countertops: {
        layout: "u-shape",
        wallAIn: 120,
        wallBIn: 96,
        wallCIn: 72,
        island: true,
        islandLengthIn: 84,
        sink: "Farmhouse",
        sinkRun: "main",
        sinkPositionIn: -999,
        sinkFrontPositionIn: -999,
        cooktop: "48-inch range gap",
        cooktopRun: "left-return",
        cooktopPositionIn: 999,
        cooktopFrontPositionIn: 999,
        otherCutouts: [
          {
            id: "sink",
            type: "Faucet hole",
            label: "safe",
            run: "main",
            positionIn: -500,
            frontPositionIn: -500,
            widthIn: 0,
            depthIn: 999,
          },
          {
            id: "DUP!!",
            type: "Soap dispenser hole",
            run: "island",
            positionIn: 999,
            frontPositionIn: 999,
            widthIn: 10.6,
            depthIn: 12.4,
          },
          {
            id: "dup",
            type: "Pop-up outlet",
            run: "right-return",
            positionIn: 36.4,
            frontPositionIn: "not-a-number",
          },
          {
            id: "<script>alert(1)</script>",
            type: "hostile type",
            label: "L".repeat(100),
            run: "not-a-run",
            positionIn: 50,
            frontPositionIn: 999,
            widthIn: -20,
            depthIn: 200,
          },
          null,
          {
            id: "cooktop",
            type: "Other opening",
            label: "Column",
            run: "main",
            positionIn: 60,
            frontPositionIn: null,
          },
          {
            id: "seventh-is-discarded",
            type: "Faucet hole",
            run: "main",
            positionIn: 20,
            frontPositionIn: 10,
          },
        ],
      },
    });

    expect(reconciled.countertops).toMatchObject({
      sinkRun: "main",
      sinkPositionIn: 2,
      sinkFrontPositionIn: 1,
      cooktopRun: "left-return",
      cooktopPositionIn: 94,
      cooktopFrontPositionIn: 24.5,
    });
    expect(reconciled.countertops.otherCutouts).toHaveLength(5);
    expect(reconciled.countertops.otherCutouts.map((cutout) => cutout.id)).toEqual([
      "other-1",
      "dup",
      "dup-3",
      "script-alert-1-script",
      "other-6",
    ]);
    expect(new Set(reconciled.countertops.otherCutouts.map((cutout) => cutout.id)).size).toBe(5);
    expect(reconciled.countertops.otherCutouts[0]).toMatchObject({
      run: "main",
      positionIn: 2,
      frontPositionIn: 1,
      widthIn: 1,
      depthIn: 96,
    });
    expect(reconciled.countertops.otherCutouts[1]).toMatchObject({
      run: "island",
      positionIn: 82,
      frontPositionIn: 41,
      widthIn: 10.625,
      depthIn: 12.375,
    });
    expect(reconciled.countertops.otherCutouts[2]).toMatchObject({
      run: "right-return",
      positionIn: 36.375,
      frontPositionIn: 12.75,
      widthIn: null,
      depthIn: null,
    });
    expect(reconciled.countertops.otherCutouts[3]).toMatchObject({
      type: "Other opening",
      run: "",
      positionIn: null,
      frontPositionIn: null,
      widthIn: 1,
      depthIn: 96,
    });
    expect(reconciled.countertops.otherCutouts[3].label).toHaveLength(40);
    expect(
      reconciled.countertops.otherCutouts.some((item) => item.id === "seventh-is-discarded")
    ).toBe(false);
  });

  it("preserves opening measurements at eighth-inch precision through reconcile, storage, and format", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.island = true;
    draft.countertops.wallDepthIn = 25.74;
    draft.countertops.sink = "Double-bowl undermount";
    draft.countertops.sinkRun = "main";
    draft.countertops.sinkPositionIn = 48.11;
    draft.countertops.sinkFrontPositionIn = 13.11;
    draft.countertops.cooktop = "36-inch cooktop cutout";
    draft.countertops.cooktopRun = "left-return";
    draft.countertops.cooktopPositionIn = 52.19;
    draft.countertops.cooktopFrontPositionIn = 13.11;
    draft.countertops.otherCutouts = [
      {
        id: "precise-faucet",
        type: "Faucet hole",
        label: "",
        run: "island",
        positionIn: 42.11,
        frontPositionIn: 21.19,
        widthIn: 1.11,
        depthIn: 1.19,
      },
    ];

    const expectedCountertops = {
      wallDepthIn: 25.5,
      sinkPositionIn: 48.125,
      sinkFrontPositionIn: 13.125,
      cooktopPositionIn: 52.25,
      cooktopFrontPositionIn: 13.125,
      otherCutouts: [
        {
          id: "precise-faucet",
          positionIn: 42.125,
          frontPositionIn: 21.25,
          widthIn: 1.125,
          depthIn: 1.25,
        },
      ],
    };
    expect(reconcileSteelHomeProjectDraft(draft).countertops).toMatchObject(expectedCountertops);

    const { storage } = memoryStorage();
    expect(saveSteelHomeProjectDraft(storage, draft)).toBe(true);
    expect(loadSteelHomeProjectDraft(storage).countertops).toMatchObject(expectedCountertops);

    expect(formatCountertopOpeningSchedule(draft.countertops)).toEqual([
      expect.stringMatching(/center 48\.125" from .*center 13\.125" inward/),
      expect.stringMatching(/center 52\.25" from .*center 13\.125" inward/),
      expect.stringMatching(
        /center 42\.125" from .*center 21\.25" inward .*approximately 1\.125" × 1\.25"/
      ),
    ]);
  });

  it("removes opening placements when a layout or island no longer provides their run", () => {
    const straight = reconcileSteelHomeProjectDraft({
      countertops: {
        layout: "straight",
        island: false,
        sink: "Single-bowl undermount",
        sinkRun: "left-return",
        sinkPositionIn: 44,
        sinkFrontPositionIn: 13,
        cooktop: "36-inch cooktop cutout",
        cooktopRun: "island",
        cooktopPositionIn: 42,
        cooktopFrontPositionIn: 21,
        otherCutouts: [
          {
            id: "outlet",
            type: "Pop-up outlet",
            run: "right-return",
            positionIn: 30,
            frontPositionIn: 13,
          },
        ],
      },
    });

    expect(getAvailableCountertopCutoutRuns(straight.countertops).map((run) => run.value)).toEqual([
      "main",
    ]);
    expect(straight.countertops).toMatchObject({
      sinkRun: "",
      sinkPositionIn: null,
      sinkFrontPositionIn: null,
      cooktopRun: "",
      cooktopPositionIn: null,
      cooktopFrontPositionIn: null,
    });
    expect(straight.countertops.otherCutouts[0]).toMatchObject({
      run: "",
      positionIn: null,
      frontPositionIn: null,
    });
    expect(getCountertopPlacementProblems(straight.countertops)).toEqual([
      "Sink — Single-bowl undermount needs a location.",
      "36-inch cooktop cutout needs a location.",
      "Pop-up outlet needs a location.",
    ]);

    const lShapeWithIsland = reconcileSteelHomeProjectDraft({
      countertops: {
        layout: "l-shape",
        island: true,
      },
    });
    expect(
      getAvailableCountertopCutoutRuns(lShapeWithIsland.countertops).map((run) => run.value)
    ).toEqual(["main", "left-return", "island"]);
  });

  it("requires and serializes valid 2-D centers for sink, cooktop, and other openings", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.island = true;
    draft.countertops.sink = "Double-bowl undermount";
    draft.countertops.sinkRun = "main";
    draft.countertops.sinkPositionIn = 48;
    draft.countertops.sinkFrontPositionIn = 13;
    draft.countertops.sinkTemplateWidthIn = 33;
    draft.countertops.sinkTemplateDepthIn = 20;
    draft.countertops.cooktop = "36-inch cooktop cutout";
    draft.countertops.cooktopRun = "left-return";
    draft.countertops.cooktopPositionIn = 52;
    draft.countertops.cooktopFrontPositionIn = 13;
    draft.countertops.cooktopTemplateWidthIn = 36;
    draft.countertops.cooktopTemplateDepthIn = 22;
    draft.countertops.otherCutouts = [
      {
        id: "faucet",
        type: "Faucet hole",
        label: "",
        run: "island",
        positionIn: 42,
        frontPositionIn: 21,
        widthIn: 1,
        depthIn: 1,
      },
    ];

    expect(getCountertopOpeningSchedule(draft.countertops)).toEqual([
      {
        id: "sink",
        label: "Sink — Double-bowl undermount",
        placementKind: "cutout",
        run: "main",
        positionIn: 48,
        frontPositionIn: 13,
        requiresFrontPosition: true,
        widthIn: 33,
        depthIn: 20,
        planningWidthIn: 33,
        representation: "template-opening",
        templateStatus: "entered",
      },
      {
        id: "cooktop",
        label: "36-inch cooktop cutout",
        placementKind: "cutout",
        run: "left-return",
        positionIn: 52,
        frontPositionIn: 13,
        requiresFrontPosition: true,
        widthIn: 36,
        depthIn: 22,
        planningWidthIn: 36,
        representation: "template-opening",
        templateStatus: "entered",
      },
      {
        id: "faucet",
        label: "Faucet hole",
        placementKind: "cutout",
        run: "island",
        positionIn: 42,
        frontPositionIn: 21,
        requiresFrontPosition: true,
        widthIn: 1,
        depthIn: 1,
        planningWidthIn: 1,
        representation: "template-opening",
        templateStatus: "entered",
      },
    ]);
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([]);
    expect(formatCountertopOpeningSchedule(draft.countertops)).toEqual([
      'Sink — Double-bowl undermount — Main run, center 48" from the start edge (left end); left/right are as viewed while standing in the room facing the run, center 13" inward from the room-facing front edge; measure inward toward the wall or back edge, approximately 33" × 20"',
      '36-inch cooktop cutout — Left return, center 52" from the start edge (top/wall-side outer end; the first 25.5 inches includes the shared corner zone), center 13" inward from the room-facing front edge; measure inward toward the wall or back edge, approximately 36" × 22"',
      'Faucet hole — Island, center 42" from the start edge (left end while standing at the long edge facing away from the main run), center 21" inward from the front long edge facing away from the main run; measure inward across the island, approximately 1" × 1"',
    ]);
  });

  it("treats a range gap as a full-depth non-cutout with no front coordinate", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.layout = "straight";
    draft.countertops.island = false;
    draft.countertops.cooktop = "36-inch range gap";
    draft.countertops.cooktopRun = "main";
    draft.countertops.cooktopPositionIn = 60;
    draft.countertops.cooktopFrontPositionIn = 24;

    expect(getCountertopOpeningSchedule(draft.countertops)).toEqual([
      {
        id: "cooktop",
        label: "36-inch range gap",
        placementKind: "full-depth-gap",
        run: "main",
        positionIn: 60,
        frontPositionIn: null,
        requiresFrontPosition: false,
        widthIn: 36,
        depthIn: null,
        planningWidthIn: 36,
        representation: "full-depth-gap",
        templateStatus: "not-needed",
      },
    ]);
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([]);
    expect(formatCountertopOpeningSchedule(draft.countertops)).toEqual([
      '36-inch range gap — Main run, center 60" from the start edge (left end); left/right are as viewed while standing in the room facing the run, full-depth run gap (not a countertop cutout), nominal 36" width',
    ]);
  });

  it("rejects an opening deeper than the selected run", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.otherCutouts = [
      {
        id: "oversized",
        type: "Pop-up outlet",
        label: "",
        run: "main",
        positionIn: 60,
        frontPositionIn: 13,
        widthIn: 6,
        depthIn: 96,
      },
    ];

    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([
      'Pop-up outlet is 96" deep and cannot fit on the 25.5"-deep main run.',
    ]);
  });

  it("checks front and back edges and reports overlap only when both axes collide", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.otherCutouts = [
      {
        id: "faucet",
        type: "Faucet hole",
        label: "",
        run: "main",
        positionIn: 30,
        frontPositionIn: 1,
        widthIn: 4,
        depthIn: 4,
      },
      {
        id: "soap",
        type: "Soap dispenser hole",
        label: "",
        run: "main",
        positionIn: 90,
        frontPositionIn: 24.5,
        widthIn: 4,
        depthIn: 4,
      },
    ];

    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([
      "Faucet hole is too close to the front or back edge of main run.",
      "Soap dispenser hole is too close to the front or back edge of main run.",
    ]);

    draft.countertops.otherCutouts[0].positionIn = 50;
    draft.countertops.otherCutouts[0].frontPositionIn = 3;
    draft.countertops.otherCutouts[1].positionIn = 52;
    draft.countertops.otherCutouts[1].frontPositionIn = 22;
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([]);

    draft.countertops.otherCutouts[1].frontPositionIn = 5;
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([
      "Faucet hole and Soap dispenser hole are too close together on main run.",
    ]);
  });

  it("rejects an accessory inside an undermount sink but permits rear-deck and farmhouse placement", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.layout = "straight";
    draft.countertops.island = false;
    draft.countertops.sink = "Double-bowl undermount";
    draft.countertops.sinkRun = "main";
    draft.countertops.sinkPositionIn = 60;
    draft.countertops.sinkFrontPositionIn = 13;
    draft.countertops.sinkTemplateWidthIn = 33;
    draft.countertops.sinkTemplateDepthIn = 20;
    draft.countertops.otherCutouts = [
      {
        id: "faucet",
        type: "Faucet hole",
        label: "",
        run: "main",
        positionIn: 60,
        frontPositionIn: 13,
        widthIn: 2,
        depthIn: 2,
      },
    ];

    const obviousConflict =
      "Sink — Double-bowl undermount and Faucet hole are too close together on main run.";
    expect(getCountertopPlacementProblems(draft.countertops)).toContain(obviousConflict);
    draft.countertops.otherCutouts[0].positionIn = 70;
    expect(getCountertopPlacementProblems(draft.countertops)).toContain(obviousConflict);

    draft.countertops.otherCutouts[0] = {
      ...draft.countertops.otherCutouts[0],
      positionIn: 60,
      frontPositionIn: 24,
      widthIn: 1,
      depthIn: 1,
    };
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([]);

    draft.countertops.sink = "Farmhouse";
    draft.countertops.sinkFrontPositionIn = null;
    draft.countertops.otherCutouts[0].frontPositionIn = 13;
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([]);

    const ordinaryOverlap = createEmptySteelHomeProjectDraft();
    ordinaryOverlap.countertops.layout = "straight";
    ordinaryOverlap.countertops.island = false;
    ordinaryOverlap.countertops.otherCutouts = [
      {
        id: "first",
        type: "Other opening",
        label: "First",
        run: "main",
        positionIn: 60,
        frontPositionIn: 10,
        widthIn: 8,
        depthIn: 4,
      },
      {
        id: "second",
        type: "Other opening",
        label: "Second",
        run: "main",
        positionIn: 62,
        frontPositionIn: 10,
        widthIn: 8,
        depthIn: 4,
      },
    ];
    expect(getCountertopPlacementProblems(ordinaryOverlap.countertops)).toEqual([
      "Other opening — First and Other opening — Second are too close together on main run.",
    ]);
  });

  it("checks every opening pair and reserves the shared inside-corner zone", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.layout = "l-shape";
    draft.countertops.island = true;
    draft.countertops.islandLengthIn = 84;
    draft.countertops.islandWidthIn = 72;
    draft.countertops.otherCutouts = [
      {
        id: "first",
        type: "Other opening",
        label: "First",
        run: "island",
        positionIn: 30,
        frontPositionIn: 10,
        widthIn: 30,
        depthIn: 10,
      },
      {
        id: "middle",
        type: "Other opening",
        label: "Middle",
        run: "island",
        positionIn: 40,
        frontPositionIn: 50,
        widthIn: 30,
        depthIn: 10,
      },
      {
        id: "third",
        type: "Other opening",
        label: "Third",
        run: "island",
        positionIn: 50,
        frontPositionIn: 10,
        widthIn: 30,
        depthIn: 10,
      },
    ];

    expect(getCountertopPlacementProblems(draft.countertops)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Other opening — First and Other opening — Third are too close together"
        ),
      ])
    );

    draft.countertops.otherCutouts = [
      {
        id: "corner",
        type: "Other opening",
        label: "Corner",
        run: "left-return",
        positionIn: 12,
        frontPositionIn: 13,
        widthIn: 20,
        depthIn: 10,
      },
    ];
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual(
      expect.arrayContaining([expect.stringContaining("shared inside-corner zone")])
    );
  });

  it("reserves the U-shaped main run's right corner while leaving an L-shaped right end open", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.layout = "u-shape";
    draft.countertops.wallAIn = 120;
    draft.countertops.otherCutouts = [
      {
        id: "right-corner",
        type: "Faucet hole",
        label: "",
        run: "main",
        positionIn: 96,
        frontPositionIn: 3,
        widthIn: 4,
        depthIn: 4,
      },
    ];

    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([
      expect.stringContaining("shared inside-corner zone"),
    ]);
    expect(getCountertopPlacementProblems(draft.countertops)[0]).toContain("right end");

    draft.countertops.otherCutouts[0].positionIn = 90;
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([]);

    draft.countertops.layout = "l-shape";
    draft.countertops.otherCutouts[0].positionIn = 96;
    expect(getCountertopPlacementProblems(draft.countertops)).toEqual([]);
  });

  it("hands off a farmhouse sink as an apron-edge condition requiring its manufacturer template", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.sink = "Farmhouse";
    draft.countertops.sinkRun = "main";
    draft.countertops.sinkPositionIn = 60;
    draft.countertops.sinkFrontPositionIn = 13;

    const [farmhouseHandoff] = formatCountertopOpeningSchedule(draft.countertops);
    const handoffLower = farmhouseHandoff.toLowerCase();
    expect(handoffLower).toContain("farmhouse");
    expect(handoffLower).toContain("apron");
    expect(handoffLower).toContain("front edge");
    expect(handoffLower).toContain("manufacturer");
    expect(handoffLower).toContain("template");
    expect(farmhouseHandoff).not.toContain('approximately 33" × 20"');
    expect(buildCountertopFabricatorRequestDescription(draft)).toContain(farmhouseHandoff);
  });

  it("makes opening orientation self-contained in the fabricator schedule", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.countertops.sink = "Single-bowl undermount";
    draft.countertops.sinkRun = "main";
    draft.countertops.sinkPositionIn = 60;
    draft.countertops.sinkFrontPositionIn = 13;

    const [openingHandoff] = formatCountertopOpeningSchedule(draft.countertops);
    expect(openingHandoff).toContain("start edge (left end)");
    expect(openingHandoff).toContain("room-facing front edge");
    expect(openingHandoff.toLowerCase()).not.toContain("shown in the plan");
    expect(openingHandoff.toLowerCase()).not.toContain("see the plan");
    expect(buildCountertopFabricatorRequestDescription(draft)).toContain(openingHandoff);
  });

  it("keeps gross footprint invariant when openings move or backsplash changes", () => {
    const draft = createEmptySteelHomeProjectDraft();
    const baseline = calculateCountertopSquareFeet(draft.countertops);
    const withOpenings = {
      ...draft.countertops,
      sink: "Double-bowl undermount" as const,
      sinkRun: "main" as const,
      sinkPositionIn: 52,
      sinkFrontPositionIn: 13,
      cooktop: "36-inch cooktop cutout" as const,
      cooktopRun: "left-return" as const,
      cooktopPositionIn: 45,
      cooktopFrontPositionIn: 13,
      otherCutouts: [
        {
          id: "outlet",
          type: "Pop-up outlet" as const,
          label: "",
          run: "island" as const,
          positionIn: 42,
          frontPositionIn: 21,
          widthIn: 4,
          depthIn: 4,
        },
      ],
    };

    expect(calculateCountertopSquareFeet(withOpenings)).toBe(baseline);
    expect(
      calculateCountertopSquareFeet({
        ...withOpenings,
        sinkPositionIn: 90,
        cooktopPositionIn: 20,
        otherCutouts: [{ ...withOpenings.otherCutouts[0], widthIn: 60, depthIn: 60 }],
      })
    ).toBe(baseline);
    for (const backsplash of COUNTERTOP_BACKSPLASH_OPTIONS) {
      expect(calculateCountertopSquareFeet({ ...withOpenings, backsplash })).toBe(baseline);
    }
    expect(
      calculateCountertopSquareFeet({
        ...withOpenings,
        cooktop: "36-inch range gap",
      })
    ).toBe(baseline);
  });

  it("keeps metal building pricing quote-only", () => {
    const draft = createEmptySteelHomeProjectDraft();
    const estimate = calculateBuildingPlanningEstimate(draft.building);

    expect(estimate).toMatchObject({
      key: "building",
      label: "Metal building — quote required",
      range: { lower: 0, high: 0 },
    });
    expect(formatPlanningRange(estimate.range)).toBe("Quote required");
    expect(estimate.breakdown).toEqual([]);
    expect(estimate.disclaimer).toContain("Quote required");

    const publicEstimateText = JSON.stringify(estimate).toLowerCase();
    for (const forbidden of [
      ...FORBIDDEN_PUBLIC_NAMES,
      ...FORBIDDEN_PUBLIC_PRICING_TERMS,
      ...FORBIDDEN_CURRENT_CUSTOMER_TERMS,
    ]) {
      expect(publicEstimateText).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps cabinet pricing quote-only", () => {
    const draft = createEmptySteelHomeProjectDraft();
    const estimate = calculateCabinetPlanningEstimate(draft.cabinets);

    expect(estimate).toMatchObject({
      key: "cabinets",
      label: "Cabinets — quote required",
      range: { lower: 0, high: 0 },
    });
    expect(formatPlanningRange(estimate.range)).toBe("Quote required");
    expect(estimate.breakdown).toEqual([]);
    expect(estimate.disclaimer).toContain("Quote required");

    const publicEstimateText = JSON.stringify(estimate).toLowerCase();
    for (const forbidden of [
      ...FORBIDDEN_PUBLIC_NAMES,
      ...FORBIDDEN_PUBLIC_PRICING_TERMS,
      ...FORBIDDEN_CURRENT_CUSTOMER_TERMS,
    ]) {
      expect(publicEstimateText).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps every planner outside a numeric estimated total", () => {
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
    expect(summary.planningEstimates).toEqual([]);
    expect(summary.planningRange).toBeNull();
    expect(summary.quoteRequired).toEqual([
      "Metal building: catalog availability, engineering, freight, foundation coordination, delivery, and installation.",
      "Cabinets: field measurements, exact products, hardware, trim, delivery, and installation.",
      "Taj Mahal: stone availability, slab quantity, and delivery. Fabrication is separate.",
    ]);
    expect(JSON.stringify(summary.quoteRequired)).not.toContain("$0");
    expect(summary.disclaimer).toContain("do not publish prices");
    expect(calculateBuildingPlanningEstimate(draft.building).disclaimer).toContain(
      "Quote required"
    );
    expect(calculateCabinetPlanningEstimate(draft.cabinets).disclaimer).toContain("Quote required");

    const quoteOnlyDraft = createEmptySteelHomeProjectDraft();
    quoteOnlyDraft.countertops.included = true;
    quoteOnlyDraft.additionalScopes = ["appliances"];
    const quoteOnlySummary = getSteelHomeProjectEstimateSummary(quoteOnlyDraft);
    expect(quoteOnlySummary.planningRange).toBeNull();
    expect(quoteOnlySummary.quoteRequired).toHaveLength(1);
  });

  it("requires a role, location, and one of the three current planners", () => {
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
      needsDesign: true,
      additionalScopeLabels: ["Mini-split heating and cooling"],
    });

    draft.projectRole = "self-contracted";
    expect(getSteelHomeProjectReadiness(draft)).toMatchObject({
      projectReady: false,
      needsRole: false,
      needsLocation: false,
      needsDesign: true,
    });

    draft.building.included = true;
    draft.building.planner = measuredBuildingPlanner();
    expect(getSteelHomeProjectReadiness(draft)).toMatchObject({
      projectReady: true,
      needsDesign: false,
    });
  });

  it("persists canonical cabinet geometry and blocks requests until it is reviewed", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "Ocean Springs, MS";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.projectRole = "self-contracted";
    draft.cabinets.included = true;

    expect(draft.cabinets.planner.starter).toBeNull();
    expect(getSteelHomeProjectReadiness(draft).projectReady).toBe(false);

    draft.cabinets.planner = measuredCabinetPlanner("Keep the north wall clear at the door.");
    const reconciled = reconcileSteelHomeProjectDraft(draft);
    expect(reconciled.cabinets.planner).toEqual(draft.cabinets.planner);
    expect(getSteelHomeProjectReadiness(reconciled).projectReady).toBe(true);

    const description = buildSteelHomeProjectDescription(reconciled);
    expect(description).toContain('Sink base: 36" W × 24" D × 34.5" H');
    expect(description).toContain("Keep the north wall clear at the door.");
    expect(description).not.toContain("Shaker");
    expect(description).not.toContain("Matte black");
    expect(description).not.toMatch(/\$\d/);
  });

  it("persists the canonical metal scene and uses it for readiness and request details", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "Ocean Springs, MS";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.projectRole = "self-contracted";
    draft.building.included = true;
    draft.building.planner = {
      ...measuredBuildingPlanner({ widthFt: 50, notes: "Keep the rear wall clear." }),
      openings: [
        {
          id: "door-1",
          typeId: "overhead-door",
          surface: "front",
          widthFt: 12,
          heightFt: 12,
          offsetFt: 5,
          sillHeightFt: 0,
          roofXFt: null,
          roofZFt: null,
        },
      ],
    };

    const reconciled = reconcileSteelHomeProjectDraft(draft);
    expect(reconciled.building.planner).toEqual(draft.building.planner);
    expect(getSteelHomeProjectReadiness(reconciled)).toMatchObject({
      projectReady: true,
      buildingProblems: [],
    });

    const description = buildSteelHomeProjectDescription(reconciled);
    expect(description).toContain("Measured shell: 50 × 60 × 14 ft eave");
    expect(description).toContain("Overhead sectional door: 12 × 12 ft on front");
    expect(description).toContain("Scene reference: building-");
    expect(description).toContain("Private planner notes: Keep the rear wall clear.");
    expect(description).not.toMatch(/\$\d/);
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
    draft.building.planner = measuredBuildingPlanner({ widthFt: 54 });
    draft.countertops.included = true;
    draft.countertops.island = true;
    draft.countertops.stoneId = "taj-mahal";
    draft.countertops.wallAIn = 132;
    draft.countertops.measurementsReviewed = true;
    draft.cabinets.included = true;
    draft.cabinets.planner = measuredCabinetPlanner();

    const description = buildSteelHomeProjectDescription(draft);
    expect(description).toMatch(/^TradeScout Steel Home Planning Request\n/);
    expect(description).toContain("Measured shell: 54 × 60 × 14 ft eave");
    expect(description).toContain("Project location: Ocean Springs, MS 39564 — Jackson County, MS");
    expect(description).toContain("Contracting setup: Self-contracted homeowner");
    expect(description).not.toMatch(/\$\d/);
    expect(description).toContain("Quote needed: Metal building:");
    expect(description).toContain("Taj Mahal: stone availability");
    expect(description).not.toContain("Insulation");
    expect(description).not.toContain("Tankless water heating");
    expect(description).toContain("Taj Mahal — Quartzite");
    expect(description).toContain("Planners: Countertops, Cabinets, Metal Building");
    expect(description).not.toContain("Stone record:");
    expect(description).not.toContain("Stone image:");
    expect(description).toContain('Wall runs: Main run: 132"; Left return: 96"');
    expect(description).toContain('Wall-top depth: 25.5"');
    expect(description).toContain("Metal Building Details");
    expect(description).toContain("TradeScout Cabinet Planning Request");
    expect(description).toContain('Room shell: 144" × 120" × 96" high');
    expect(description).toContain('Sink base: 36" W × 24" D × 34.5" H');
    expect(description).toContain(
      "Gross countertop layout footprint (backsplash excluded; range gaps not deducted): About 60.4 sq. ft."
    );
    expect(description).toContain(
      "This request is not a quote. Stone material and fabrication are separate: JW Stone supplies material and does not template, fabricate, cut, or install countertops."
    );
    expect(description.length).toBeLessThanOrEqual(5000);

    const engineeredQuartzDraft = createEmptySteelHomeProjectDraft();
    engineeredQuartzDraft.countertops.included = true;
    engineeredQuartzDraft.countertops.stoneId = "aj-quartz";
    const engineeredQuartzDescription = buildSteelHomeProjectDescription(engineeredQuartzDraft);
    expect(engineeredQuartzDescription).toContain(
      "Selected surface: AJ Quartz — Engineered Quartz"
    );
    expect(engineeredQuartzDescription).toContain("Planner: Countertops");
    expect(engineeredQuartzDescription).not.toContain("Planners:");
    expect(engineeredQuartzDescription).not.toContain("Stone + quartz");

    const graniteDraft = createEmptySteelHomeProjectDraft();
    graniteDraft.countertops.included = true;
    graniteDraft.countertops.stoneId = "blue-goias";
    const graniteDescription = buildSteelHomeProjectDescription(graniteDraft);
    expect(graniteDescription).toContain("Planner: Countertops");
    expect(graniteDescription).toContain("Selected surface: Blue Goias — Granite");
    expect(graniteDescription).not.toContain("Quartzite / engineered quartz");

    const href = buildSteelHomeProjectRequestHref(
      "/direct-connect?target=old-target&intent=hire&contractorId=old-contractor",
      draft
    );
    const url = new URL(href, "https://www.thetradescout.com");
    expect(url.pathname).toBe("/direct-connect");
    expect(url.searchParams.get("profile")).toBe("steel-home-packages");
    expect(url.searchParams.get("profileName")).toBe("Steel Home Planning Tools");
    expect(url.searchParams.get("source")).toBe("steel_home_planning_tools");
    expect(url.searchParams.get("subject")).toBe("product");
    expect(url.searchParams.get("title")).toBe(
      "TradeScout Steel Home Planning Request — Countertops, Cabinets, Metal Building"
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
    draft.building.planner = measuredBuildingPlanner({ notes: draft.building.notes });
    draft.countertops.notes = `STONE-${"S".repeat(234)}`;
    draft.cabinets.notes = `CABINET-${"C".repeat(232)}`;
    draft.cabinets.planner = measuredCabinetPlanner(draft.cabinets.notes);

    const description = buildSteelHomeProjectDescription(draft);
    expect(description).toContain("Metal Building Details");
    expect(description).toContain("Countertop Details");
    expect(description).toContain("TradeScout Cabinet Planning Request");
    expect(description).toContain(draft.building.notes);
    expect(description).toContain(draft.countertops.notes);
    expect(description).toContain(draft.cabinets.notes);
    expect(description).toContain("This request is not a quote");
    expect(description).not.toContain("Installation and trade work");
    expect(description.length).toBeLessThanOrEqual(5000);
  });

  it("builds separate stone-product and local-fabricator requests from one countertop design", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "123 Private Lane, Ocean Springs, MS 39564";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.timing = "Within 3 months";
    draft.projectRole = "self-contracted";
    draft.countertops.included = true;
    draft.countertops.island = true;
    draft.countertops.stoneId = "aj-quartz";
    draft.countertops.measurementsReviewed = true;
    draft.countertops.sink = "Farmhouse";
    draft.countertops.sinkRun = "main";
    draft.countertops.sinkPositionIn = 48;
    draft.countertops.sinkFrontPositionIn = 13;
    draft.countertops.cooktop = "36-inch range gap";
    draft.countertops.cooktopRun = "left-return";
    draft.countertops.cooktopPositionIn = 40;
    draft.countertops.otherCutouts = [
      {
        id: "faucet",
        type: "Faucet hole",
        label: "",
        run: "island",
        positionIn: 42,
        frontPositionIn: 21,
        widthIn: 1,
        depthIn: 1,
      },
      {
        id: "column",
        type: "Other opening",
        label: "Column",
        run: "main",
        positionIn: 92,
        frontPositionIn: 6,
        widthIn: 8,
        depthIn: 6,
      },
    ];
    draft.countertops.notes = "Confirm the waterfall end.";

    expect(formatCountertopOpeningSchedule(draft.countertops)).toEqual([
      "Sink — Farmhouse / apron-front — Main run, center 48\" from the start edge (left end); left/right are as viewed while standing in the room facing the run, apron opening interrupts the room-facing front edge; exact notch and cutout must follow the sink manufacturer's template",
      '36-inch range gap — Left return, center 40" from the start edge (top/wall-side outer end; the first 25.5 inches includes the shared corner zone), full-depth run gap (not a countertop cutout), nominal 36" width',
      'Faucet hole — Island, center 42" from the start edge (left end while standing at the long edge facing away from the main run), center 21" inward from the front long edge facing away from the main run; measure inward across the island, approximately 1" × 1"',
      'Other opening — Column — Main run, center 92" from the start edge (left end); left/right are as viewed while standing in the room facing the run, center 6" inward from the room-facing front edge; measure inward toward the wall or back edge, approximately 8" × 6"',
    ]);

    const selectedStone = getCatalogItemById("aj-quartz");
    const selectedImageHref = selectedStone?.images[0];
    const stablePhotoHref =
      selectedStone?.shareSlug && selectedImageHref
        ? buildNamedStoneDesignerImageHref(selectedStone.shareSlug, selectedImageHref)
        : null;
    expect(stablePhotoHref).toBeTruthy();

    const stoneDescription = buildCountertopStoneRequestDescription(draft);
    const fabricatorDescription = buildCountertopFabricatorRequestDescription(draft);

    expect(stoneDescription).toMatch(/^TradeScout Stone Material Request\n/);
    expect(stoneDescription).toContain(
      "Project location: 123 Private Lane, Ocean Springs, MS 39564 — Jackson County, MS"
    );
    expect(stoneDescription).toContain("Requested surface: AJ Quartz — Engineered Quartz");
    expect(stoneDescription).toContain(`Selected catalog photo reference: ${stablePhotoHref}`);
    expect(stoneDescription).toContain(
      `Selected-photo source dimensions: 128×64" recorded for this exact photo's source filename`
    );
    expect(stoneDescription).toContain(
      "Texture scale status: Dimension-derived from this exact photo; confirm the exact slab with JW Stone"
    );
    expect(stoneDescription).not.toContain('128×64" · 127.5×64"');
    expect(stoneDescription).toContain("applied to countertops, island");
    expect(stoneDescription).toContain("Availability status: Confirmation required with JW Stone");
    expect(stoneDescription).toContain(
      "Gross countertop layout footprint (backsplash excluded; range gaps not deducted):"
    );
    expect(stoneDescription).toContain(
      "Material request only: ask about stone availability and delivery. Opening locations do not establish stone quantity or price."
    );
    expect(stoneDescription).toContain(
      "Slab quantity, backsplash height, seams, waste, and final material quantity require field measurement and slab layout."
    );
    expect(stoneDescription).toContain(
      "does not provide field templating, fabrication, cutting, or countertop installation"
    );
    expect(stoneDescription).not.toContain("Planned openings");
    expect(stoneDescription).not.toContain("Faucet hole");
    expect(stoneDescription).not.toContain('center 48"');
    expect(stoneDescription).not.toContain("Confirm the waterfall end");

    expect(fabricatorDescription).toMatch(/^TradeScout Countertop Fabricator Request\n/);
    expect(fabricatorDescription).toContain("Service area: Jackson County, MS");
    expect(fabricatorDescription).toContain("Work needed: Stone fabrication");
    expect(fabricatorDescription).toContain("Stone reference: AJ Quartz — Engineered Quartz");
    expect(fabricatorDescription).toContain(`Selected catalog photo reference: ${stablePhotoHref}`);
    expect(fabricatorDescription).toContain(
      `Selected-photo source dimensions: 128×64" recorded for this exact photo's source filename`
    );
    expect(fabricatorDescription).not.toContain('128×64" · 127.5×64"');
    expect(fabricatorDescription).toContain(
      "Availability status: Confirmation required with JW Stone"
    );
    expect(fabricatorDescription).toContain(
      "Gross countertop layout footprint (backsplash excluded; range gaps not deducted):"
    );
    expect(fabricatorDescription).toContain("Planned openings");
    expect(fabricatorDescription).toContain(
      "Return runs start at their top/wall-side outer end; the first 25.5 inches includes the shared corner zone where the return meets the main run."
    );
    expect(fabricatorDescription).toContain("Fabricator notes: Confirm the waterfall end.");
    expect(fabricatorDescription).toContain(
      "- Sink — Farmhouse / apron-front — Main run, center 48\" from the start edge (left end); left/right are as viewed while standing in the room facing the run, apron opening interrupts the room-facing front edge; exact notch and cutout must follow the sink manufacturer's template"
    );
    expect(fabricatorDescription).toContain(
      '- Other opening — Column — Main run, center 92" from the start edge (left end); left/right are as viewed while standing in the room facing the run, center 6" inward from the room-facing front edge; measure inward toward the wall or back edge, approximately 8" × 6"'
    );
    expect(fabricatorDescription).toContain(
      "Planning brief only. The fabricator must field-template and confirm every opening"
    );
    expect(fabricatorDescription).toContain(
      "Stone purchase, availability, slab quantity, and material pricing are not part of this fabricator request."
    );
    expect(fabricatorDescription).not.toContain("123 Private Lane");

    const closeUpDraft = createEmptySteelHomeProjectDraft();
    closeUpDraft.countertops.stoneId = "blue-goias";
    expect(buildCountertopFabricatorRequestDescription(closeUpDraft)).toContain(
      "Texture scale status: Scale unverified — the selected photo is a hand or close-up view"
    );
    const unprovenScaleDraft = createEmptySteelHomeProjectDraft();
    unprovenScaleDraft.countertops.stoneId = "black-pearl";
    expect(buildCountertopFabricatorRequestDescription(unprovenScaleDraft)).toContain(
      "Texture scale status: Scale unverified — this exact photo has no recorded source dimensions"
    );
    expect(fabricatorDescription).not.toContain("Project location:");
    expect(fabricatorDescription).not.toContain("inside corner");

    const staleParams = new URLSearchParams({
      intent: "hire",
      target: "old-user",
      targetName: "Old target",
      targetProviderId: "old-provider",
      contractorId: "old-contractor-id",
      contractor: "old-contractor",
      profile: "old-profile",
      profileName: "Old profile",
      postId: "old-post",
      dealId: "old-deal",
      clientId: "old-client",
      shared: "old-share",
      employmentPostId: "old-employment",
      item: "old-item",
      prefill_businessSlug: "old-business",
      prefill_businessName: "Old business",
      trade: "old-trade",
      tradeId: "old-trade-id",
      category: "old-category",
      budgetMin: "1",
      budgetMax: "2",
      from: "old-from",
      where: "old-where",
      timing: "old-alternate-timing",
      prefill_countyFips: "11111",
      stateCode: "AA",
      prefill_stateCode: "BB",
      source: "old-source",
      subject: "business",
      title: "Old title",
      description: "Old description",
      location: "Old location",
      county: "99999",
      state: "ZZ",
      when: "Old timing",
    });
    const staleBase = `/direct-connect?${staleParams.toString()}`;
    const stoneUrl = new URL(
      buildCountertopStoneRequestHref(staleBase, draft),
      "https://www.thetradescout.com"
    );
    const fabricatorHref = buildCountertopFabricatorRequestHref(staleBase, draft);
    const fabricatorUrl = new URL(fabricatorHref, "https://www.thetradescout.com");

    expect(stoneUrl.searchParams.get("profile")).toBe("steel-home-packages");
    expect(stoneUrl.searchParams.get("profileName")).toBe("Steel Home Planning Tools");
    expect(stoneUrl.searchParams.get("source")).toBe("steel_home_planning_tools");
    expect(stoneUrl.searchParams.get("subject")).toBe("product");
    expect(stoneUrl.searchParams.get("title")).toBe(
      "TradeScout Stone Material Request — AJ Quartz"
    );
    expect(stoneUrl.searchParams.get("description")).toBe(stoneDescription);
    expect(stoneUrl.searchParams.get("location")).toBe("123 Private Lane, Ocean Springs, MS 39564");

    expect(fabricatorUrl.searchParams.get("source")).toBe("steel_home_planning_tools_labor");
    expect(fabricatorUrl.searchParams.get("subject")).toBe("service");
    expect(fabricatorUrl.searchParams.get("title")).toBe(
      "TradeScout Countertop Fabricator Request"
    );
    expect(fabricatorUrl.searchParams.get("description")).toBe(fabricatorDescription);
    expect(fabricatorUrl.searchParams.get("location")).toBe("Jackson County, MS");
    expect(decodeURIComponent(fabricatorHref)).not.toContain("123 Private Lane");

    const staleTargetKeys = [
      "intent",
      "target",
      "targetName",
      "targetProviderId",
      "contractorId",
      "contractor",
      "postId",
      "dealId",
      "clientId",
      "shared",
      "employmentPostId",
      "item",
      "prefill_businessSlug",
      "prefill_businessName",
      "trade",
      "tradeId",
      "category",
      "budgetMin",
      "budgetMax",
      "from",
      "where",
      "timing",
      "prefill_countyFips",
      "stateCode",
      "prefill_stateCode",
    ];
    for (const key of staleTargetKeys) {
      expect(stoneUrl.searchParams.has(key), `stone request must remove ${key}`).toBe(false);
      expect(fabricatorUrl.searchParams.has(key), `fabricator request must remove ${key}`).toBe(
        false
      );
    }
    expect(fabricatorUrl.searchParams.has("profile")).toBe(false);
    expect(fabricatorUrl.searchParams.has("profileName")).toBe(false);
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
    draft.countertops.island = true;
    draft.countertops.stoneId = "cristallo";
    draft.labor.trades = ["Stone fabrication", "Countertop installation"];

    const href = buildSteelHomeLaborRequestHref(
      "/direct-connect?profile=steel-home-packages&target=someone&targetProviderId=provider",
      draft
    );
    const url = new URL(href, "https://www.thetradescout.com");
    expect(url.searchParams.get("subject")).toBe("service");
    expect(url.searchParams.get("source")).toBe("steel_home_planning_tools_labor");
    expect(url.searchParams.get("county")).toBe("28047");
    expect(url.searchParams.get("state")).toBe("MS");
    expect(url.searchParams.get("description")).toContain(
      "Countertop details: Kitchen; Cristallo — Quartzite; surface dimensions unreviewed"
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
    expect(url.searchParams.get("description")).not.toContain("Windows and exterior doors");
    expect(url.searchParams.get("description")).not.toContain("Appliance warranty or service plan");
    expect(url.searchParams.get("description")).toContain("Related planner: Countertops");
    expect(url.searchParams.get("title")?.toLowerCase()).not.toContain("labor");
    expect(url.searchParams.get("description")?.toLowerCase()).not.toContain("labor");
    for (const target of ["profile", "profileName", "target", "targetProviderId", "contractorId"]) {
      expect(url.searchParams.has(target)).toBe(false);
    }
  });
});
