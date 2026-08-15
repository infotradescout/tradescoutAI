import { JW_STONE_NAMED_IDS, getCatalogItemById } from "@/features/jw-stone/catalog";
import { isHandScaleCoverImage } from "@/features/jw-stone/coverImages";
import {
  formatSlabDimension,
  resolveSlabDimensionForInventoryImage,
} from "@/features/jw-stone/slabDimensions";
import { getCountyByFips } from "@shared/states-counties";
import {
  STEEL_HOME_PACKAGES_LABOR_REQUEST_SOURCE,
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY,
  STEEL_HOME_PACKAGES_REQUEST_SOURCE,
} from "@shared/steelHomePackagesProfile";
import {
  buildNamedStoneDesignerImageHref,
  buildStoneDesignerPhotoKey,
  resolveStoneDesignerPhotoIndex,
} from "./stoneDesignerImages";
import {
  buildCabinetPlannerRequestBrief,
  createBlankCabinetPlannerExtension,
  isCabinetPlannerRequestReady,
  reconcileCabinetPlannerExtension,
  type CabinetPlannerExtensionV1,
} from "./cabinetPlannerModel";
import {
  buildBuildingPlannerRequest,
  createEmptyBuildingPlannerExtension,
  getBuildingPlannerRequestReadiness,
  sanitizeBuildingPlannerExtension,
  type BuildingPlannerExtensionV1,
} from "./buildingPlannerModel";
import { getCountertopPlannerOpeningSchedule } from "./countertopPlannerModel";

export const STEEL_HOME_PROJECT_DRAFT_VERSION = 9 as const;
export const STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY = "tradescout:steel-home-project-tools:draft:v9";
const LEGACY_V8_STEEL_HOME_PROJECT_DRAFT_VERSION = 8;
const LEGACY_V8_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY =
  "tradescout:steel-home-project-tools:draft:v8";
const LEGACY_V7_STEEL_HOME_PROJECT_DRAFT_VERSION = 7;
const LEGACY_V7_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY =
  "tradescout:steel-home-project-tools:draft:v7";
const LEGACY_V6_STEEL_HOME_PROJECT_DRAFT_VERSION = 6;
const LEGACY_V6_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY =
  "tradescout:steel-home-project-tools:draft:v6";
const LEGACY_V5_STEEL_HOME_PROJECT_DRAFT_VERSION = 5;
const LEGACY_V5_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY =
  "tradescout:steel-home-project-tools:draft:v5";
const LEGACY_V4_STEEL_HOME_PROJECT_DRAFT_VERSION = 4;
const LEGACY_V4_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY =
  "tradescout:steel-home-project-tools:draft:v4";
const LEGACY_V3_STEEL_HOME_PROJECT_DRAFT_VERSION = 3;
const LEGACY_V3_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY =
  "tradescout:steel-home-project-tools:draft:v3";

export const PROJECT_TIMING_OPTIONS = [
  "As soon as possible",
  "Within 3 months",
  "Within 6 months",
  "Within 12 months",
  "More than 12 months away",
] as const;

export const PROJECT_ROLE_OPTIONS = [
  {
    value: "self-contracted",
    label: "Self-contracted homeowner",
    description: "Use the planners while managing the project yourself.",
  },
  {
    value: "has-builder",
    label: "Homeowner with a builder",
    description: "Use the planners to prepare choices for your builder.",
  },
  {
    value: "builder-or-contractor",
    label: "Builder or contractor",
    description: "Use the planners to prepare choices for your customer's project.",
  },
  {
    value: "whole-build-help",
    label: "Need help managing the project",
    description: "Use the planners first, then explain the management help you need.",
  },
] as const;

export const ADDITIONAL_PROJECT_SCOPE_OPTIONS = [
  {
    value: "house-plans-and-layout",
    label: "House plans and layout",
    description:
      "Plan licensing, room layout, modifications, engineering, and location requirements must be confirmed before pricing.",
  },
  {
    value: "windows-and-doors",
    label: "Windows and exterior doors",
    description:
      "Sizes, styles, performance goals, delivery, and installation are confirmed by quote.",
  },
  {
    value: "insulation",
    label: "Insulation",
    description: "The assembly and rating depend on the building use and local requirements.",
  },
  {
    value: "interior-doors-and-trim",
    label: "Interior doors and trim",
    description: "Choose the style direction now and confirm the exact package by quote.",
  },
  {
    value: "interior-framing-and-drywall",
    label: "Interior framing and drywall",
    description:
      "Wall layout, ceiling assemblies, moisture needs, quantities, delivery, and installation work require a quote.",
  },
  {
    value: "flooring",
    label: "Flooring",
    description:
      "Rooms, material direction, quantities, and exact products are confirmed together.",
  },
  {
    value: "plumbing-fixtures",
    label: "Plumbing fixtures",
    description: "Fixture selections, utility fit, delivery, and installation need a quote.",
  },
  {
    value: "electrical-fixtures",
    label: "Electrical fixtures",
    description: "Fixture types, counts, code fit, and installation are confirmed by quote.",
  },
  {
    value: "mini-split-hvac",
    label: "Mini-split heating and cooling",
    description: "Room loads, equipment size, electrical needs, and installation require a quote.",
  },
  {
    value: "tankless-water-heating",
    label: "Tankless water heating",
    description:
      "Fuel, household demand, utility fit, equipment, and installation are confirmed later.",
  },
  {
    value: "appliances",
    label: "Appliances",
    description:
      "Models, fuel types, availability, delivery, and installation are confirmed by quote.",
  },
  {
    value: "appliance-protection",
    label: "Appliance warranty or service plan",
    description: "Available plans, coverage, exclusions, and price are confirmed before selection.",
  },
  {
    value: "home-and-systems-protection",
    label: "Home warranty or systems service plan",
    description:
      "Availability, provider, covered systems, exclusions, service terms, and price require a quote.",
  },
  {
    value: "foundation-and-site-work",
    label: "Foundation and site work",
    description:
      "Engineering, soil, grading, drainage, access, and concrete depend on the site and location requirements.",
  },
  {
    value: "septic-and-utilities",
    label: "Septic and utility connections",
    description:
      "Local rules, existing service, capacity, routing, and exact work are confirmed later.",
  },
  {
    value: "installation-and-trade-support",
    label: "Installation and trade work",
    description:
      "The work needed, trade qualifications, availability, and schedule require a quote.",
  },
] as const;

export const BUILDING_USE_OPTIONS = [
  { value: "home-shell", label: "Home shell" },
  { value: "home-and-shop", label: "Home with shop" },
  { value: "garage-or-workshop", label: "Garage or workshop" },
  { value: "other", label: "Other steel structure" },
] as const;

export const BUILDING_ROOF_OPTIONS = [
  { value: "gable", label: "Gable" },
  { value: "single-slope", label: "Single slope" },
  { value: "monitor", label: "Monitor" },
] as const;

export const BUILDING_ROOF_PITCH_OPTIONS = ["2:12", "3:12", "4:12", "5:12", "6:12"] as const;

export const BUILDING_PORCH_OPTIONS = [
  { value: "none", label: "No porch" },
  { value: "front", label: "Front porch" },
  { value: "side", label: "Side porch" },
  { value: "wrap", label: "Wraparound porch" },
] as const;

export const BUILDING_COLOR_OPTIONS = [
  { value: "warm-white", label: "Warm white", hex: "#e8e0d0" },
  { value: "sand", label: "Sand", hex: "#c8af8c" },
  { value: "sage", label: "Sage", hex: "#78877a" },
  { value: "slate", label: "Slate", hex: "#59676b" },
  { value: "bronze", label: "Bronze", hex: "#665243" },
  { value: "black", label: "Black", hex: "#242625" },
] as const;

export const COUNTERTOP_ROOM_OPTIONS = [
  "Kitchen",
  "Primary bathroom",
  "Guest bathroom",
  "Living room",
  "Laundry",
  "Outdoor kitchen",
  "Other room",
] as const;

export const COUNTERTOP_LAYOUT_OPTIONS = [
  { value: "straight", label: "Straight run" },
  { value: "l-shape", label: "L-shaped" },
  { value: "u-shape", label: "U-shaped" },
] as const;

export const COUNTERTOP_EDGE_OPTIONS = [
  "None",
  "Eased",
  "Beveled",
  "Half bullnose",
  "Full bullnose",
  "Mitered",
] as const;

export const COUNTERTOP_BACKSPLASH_OPTIONS = ["None", "4-inch", "Full-height"] as const;
export const COUNTERTOP_CAMERA_PRESET_OPTIONS = ["Perspective", "Front", "Top", "Detail"] as const;
export const COUNTERTOP_VEIN_ROTATION_OPTIONS = [0, 90, 180, 270] as const;
export const COUNTERTOP_WATERFALL_OPTIONS = ["None", "Left", "Right", "Both"] as const;
export const COUNTERTOP_SINK_OPTIONS = [
  "None",
  "Single-bowl undermount",
  "Double-bowl undermount",
  "Farmhouse",
] as const;
export const COUNTERTOP_COOKTOP_OPTIONS = [
  "None",
  "30-inch cooktop cutout",
  "36-inch cooktop cutout",
  "48-inch cooktop cutout",
  "30-inch range gap",
  "36-inch range gap",
  "48-inch range gap",
] as const;

export const COUNTERTOP_CUTOUT_RUN_OPTIONS = [
  { value: "main", label: "Main run" },
  { value: "left-return", label: "Left return" },
  { value: "right-return", label: "Right return" },
  { value: "island", label: "Island" },
] as const;

export const COUNTERTOP_OTHER_CUTOUT_OPTIONS = [
  "Faucet hole",
  "Soap dispenser hole",
  "Pop-up outlet",
  "Other opening",
] as const;

export const CABINET_ROOM_OPTIONS = [
  "Kitchen",
  "Primary bathroom",
  "Guest bathroom",
  "Laundry",
  "Pantry",
  "Built-in storage",
] as const;

export const CABINET_LAYOUT_OPTIONS = [
  { value: "one-wall", label: "One wall" },
  { value: "l-shape", label: "L-shaped" },
  { value: "u-shape", label: "U-shaped" },
  { value: "galley", label: "Galley" },
] as const;

export const CABINET_DOOR_STYLE_OPTIONS = [
  "Shaker",
  "Slab",
  "Raised panel",
  "Glass accent",
] as const;

export const CABINET_FINISH_OPTIONS = [
  { value: "natural-oak", label: "Natural oak", hex: "#b58d62" },
  { value: "warm-walnut", label: "Warm walnut", hex: "#76533f" },
  { value: "soft-white", label: "Soft white", hex: "#e9e3d8" },
  { value: "sage", label: "Sage", hex: "#7e8c7b" },
  { value: "navy", label: "Navy", hex: "#334658" },
  { value: "charcoal", label: "Charcoal", hex: "#474b4b" },
] as const;

export const CABINET_HARDWARE_OPTIONS = [
  "Matte black",
  "Brushed brass",
  "Brushed nickel",
  "Polished chrome",
  "No preference",
] as const;

export const LOCAL_LABOR_OPTIONS = [
  "Site work",
  "Foundation",
  "Steel erection",
  "Countertop templating",
  "Stone fabrication",
  "Countertop installation",
  "Cabinet installation",
  "Other construction work",
] as const;

export type BuildingUse = (typeof BUILDING_USE_OPTIONS)[number]["value"];
export type BuildingRoof = (typeof BUILDING_ROOF_OPTIONS)[number]["value"];
export type BuildingPorch = (typeof BUILDING_PORCH_OPTIONS)[number]["value"];
export type CountertopLayout = (typeof COUNTERTOP_LAYOUT_OPTIONS)[number]["value"];
export type CountertopCutoutRun = (typeof COUNTERTOP_CUTOUT_RUN_OPTIONS)[number]["value"];
export type CountertopOtherCutoutType = (typeof COUNTERTOP_OTHER_CUTOUT_OPTIONS)[number];
export type CabinetLayout = (typeof CABINET_LAYOUT_OPTIONS)[number]["value"];
export type BuildingColor = (typeof BUILDING_COLOR_OPTIONS)[number]["value"];
export type CabinetFinish = (typeof CABINET_FINISH_OPTIONS)[number]["value"];
export type ProjectRole = (typeof PROJECT_ROLE_OPTIONS)[number]["value"];
export type AdditionalProjectScope = (typeof ADDITIONAL_PROJECT_SCOPE_OPTIONS)[number]["value"];

export type PlanningRange = {
  lower: number;
  high: number;
};

export type PlanningEstimateLine = {
  key: string;
  label: string;
  quantity: number;
  unit: string;
  range: PlanningRange;
  detail: string;
};

export type SteelHomePlanningEstimate = {
  key: "building" | "cabinets";
  label: string;
  range: PlanningRange;
  breakdown: PlanningEstimateLine[];
  disclaimer: string;
};

export type SteelHomeProjectEstimateSummary = {
  planningRange: PlanningRange | null;
  planningEstimates: SteelHomePlanningEstimate[];
  quoteRequired: string[];
  disclaimer: string;
};

export type SteelHomeBuildingDesign = {
  included: boolean;
  use: BuildingUse;
  widthFt: number;
  lengthFt: number;
  eaveHeightFt: number;
  roofStyle: BuildingRoof;
  roofPitch: (typeof BUILDING_ROOF_PITCH_OPTIONS)[number];
  wallColor: BuildingColor;
  roofColor: BuildingColor;
  trimColor: BuildingColor;
  garageDoors: number;
  walkDoors: number;
  windows: number;
  porch: BuildingPorch;
  porchDepthFt: number;
  notes: string;
  planner: BuildingPlannerExtensionV1;
};

export type SteelHomeCountertopDesign = {
  included: boolean;
  room: (typeof COUNTERTOP_ROOM_OPTIONS)[number];
  layout: CountertopLayout;
  wallAIn: number;
  wallBIn: number;
  wallCIn: number;
  wallDepthIn: number;
  island: boolean;
  islandLengthIn: number;
  islandWidthIn: number;
  stoneId: string;
  /** Zero-based real inventory image used as the slab face in the spatial studio. */
  textureImageIndex: number;
  /** Stable opaque identity for that exact catalog photo; array index is legacy fallback only. */
  texturePhotoKey: string;
  /** Normalized slab-map offsets. They move the photographed slab, never resize geometry. */
  textureOffsetX: number;
  textureOffsetY: number;
  /** Physical mapping scale multiplier; 1 preserves the dimension-derived baseline. */
  textureScale: number;
  veinRotation: (typeof COUNTERTOP_VEIN_ROTATION_OPTIONS)[number];
  cameraPreset: (typeof COUNTERTOP_CAMERA_PRESET_OPTIONS)[number];
  /** Optional independent floor application. Countertops always use the selected surface. */
  floorStone: boolean;
  showSeams: boolean;
  waterfall: (typeof COUNTERTOP_WATERFALL_OPTIONS)[number];
  edge: (typeof COUNTERTOP_EDGE_OPTIONS)[number];
  backsplash: (typeof COUNTERTOP_BACKSPLASH_OPTIONS)[number];
  sink: (typeof COUNTERTOP_SINK_OPTIONS)[number];
  sinkRun: CountertopCutoutRun | "";
  sinkPositionIn: number | null;
  sinkFrontPositionIn: number | null;
  cooktop: (typeof COUNTERTOP_COOKTOP_OPTIONS)[number];
  cooktopRun: CountertopCutoutRun | "";
  cooktopPositionIn: number | null;
  cooktopFrontPositionIn: number | null;
  otherCutouts: SteelHomeCountertopCutout[];
  /** True only after the visible run, depth, and enabled-island dimensions are reviewed. */
  measurementsReviewed: boolean;
  roomWidthIn: number | null;
  roomDepthIn: number | null;
  roomWallHeightIn: number | null;
  finishedTopHeightIn: number | null;
  topThicknessIn: number | null;
  islandLeftOffsetIn: number | null;
  islandBackOffsetIn: number | null;
  sinkTemplateWidthIn: number | null;
  sinkTemplateDepthIn: number | null;
  cooktopTemplateWidthIn: number | null;
  cooktopTemplateDepthIn: number | null;
  notes: string;
};

export type SteelHomeCountertopCutout = {
  id: string;
  type: CountertopOtherCutoutType;
  label: string;
  run: CountertopCutoutRun | "";
  positionIn: number | null;
  frontPositionIn: number | null;
  widthIn: number | null;
  depthIn: number | null;
};

export type SteelHomeCabinetDesign = {
  included: boolean;
  room: (typeof CABINET_ROOM_OPTIONS)[number];
  layout: CabinetLayout;
  primaryWallIn: number;
  returnWallIn: number;
  ceilingHeightIn: number;
  doorStyle: (typeof CABINET_DOOR_STYLE_OPTIONS)[number];
  finish: CabinetFinish;
  hardware: (typeof CABINET_HARDWARE_OPTIONS)[number];
  upperHeightIn: 30 | 36 | 42;
  refrigeratorWidthIn: 30 | 36 | 42 | 48;
  rangeWidthIn: 30 | 36 | 48;
  sinkBaseWidthIn: 30 | 33 | 36;
  pantryCount: number;
  drawerBaseCount: number;
  island: boolean;
  islandLengthIn: number;
  islandWidthIn: number;
  notes: string;
  /** Canonical measured room, fixed features, and placed cabinet objects. */
  planner: CabinetPlannerExtensionV1;
};

export type SteelHomeProjectDraft = {
  version: typeof STEEL_HOME_PROJECT_DRAFT_VERSION;
  location: string;
  stateCode: string;
  countyFips: string;
  countyName: string;
  timing: string;
  projectRole: ProjectRole | "";
  additionalScopes: AdditionalProjectScope[];
  building: SteelHomeBuildingDesign;
  countertops: SteelHomeCountertopDesign;
  cabinets: SteelHomeCabinetDesign;
  labor: {
    trades: string[];
    notes: string;
  };
};

export type SteelHomeProjectStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const setFromValues = <T extends string>(values: readonly T[]) => new Set<string>(values);
const BUILDING_USES = setFromValues(BUILDING_USE_OPTIONS.map((item) => item.value));
const BUILDING_ROOFS = setFromValues(BUILDING_ROOF_OPTIONS.map((item) => item.value));
const BUILDING_PORCHES = setFromValues(BUILDING_PORCH_OPTIONS.map((item) => item.value));
const BUILDING_COLORS = setFromValues(BUILDING_COLOR_OPTIONS.map((item) => item.value));
const COUNTERTOP_LAYOUTS = setFromValues(COUNTERTOP_LAYOUT_OPTIONS.map((item) => item.value));
const COUNTERTOP_CUTOUT_RUNS = setFromValues(
  COUNTERTOP_CUTOUT_RUN_OPTIONS.map((item) => item.value)
);
const CABINET_LAYOUTS = setFromValues(CABINET_LAYOUT_OPTIONS.map((item) => item.value));
const CABINET_FINISHES = setFromValues(CABINET_FINISH_OPTIONS.map((item) => item.value));
const PROJECT_ROLES = setFromValues(PROJECT_ROLE_OPTIONS.map((item) => item.value));

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanEnum<T extends string>(value: unknown, allowed: ReadonlySet<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function cleanLabel<T extends string | number>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return (typeof value === "string" || typeof value === "number") && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function cleanIncrementNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  increment: number
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const precision = String(increment).split(".")[1]?.length || 0;
  const snapped = Math.round(parsed / increment) * increment;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(precision));
}

const cleanHalfInchNumber = (value: unknown, fallback: number, min: number, max: number) =>
  cleanIncrementNumber(value, fallback, min, max, 0.5);

const cleanEighthInchNumber = (value: unknown, fallback: number, min: number, max: number) =>
  cleanIncrementNumber(value, fallback, min, max, 0.125);

const cleanOptionalEighthInchNumber = (value: unknown, min: number, max: number): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return cleanIncrementNumber(parsed, min, min, max, 0.125);
};

function cleanAllowedStrings<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  const allowedSet = new Set(allowed);
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item): item is T => allowedSet.has(item as T))
    )
  );
}

export function createEmptySteelHomeProjectDraft(): SteelHomeProjectDraft {
  return {
    version: STEEL_HOME_PROJECT_DRAFT_VERSION,
    location: "",
    stateCode: "",
    countyFips: "",
    countyName: "",
    timing: "",
    projectRole: "",
    additionalScopes: [],
    building: {
      included: false,
      use: "home-and-shop",
      widthFt: 40,
      lengthFt: 60,
      eaveHeightFt: 14,
      roofStyle: "gable",
      roofPitch: "4:12",
      wallColor: "warm-white",
      roofColor: "slate",
      trimColor: "bronze",
      garageDoors: 2,
      walkDoors: 1,
      windows: 6,
      porch: "front",
      porchDepthFt: 8,
      notes: "",
      planner: createEmptyBuildingPlannerExtension(),
    },
    countertops: {
      included: false,
      room: "Kitchen",
      layout: "l-shape",
      wallAIn: 120,
      wallBIn: 96,
      wallCIn: 96,
      wallDepthIn: 25.5,
      island: false,
      islandLengthIn: 84,
      islandWidthIn: 42,
      stoneId: "",
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
      edge: "None",
      backsplash: "None",
      sink: "None",
      sinkRun: "",
      sinkPositionIn: null,
      sinkFrontPositionIn: null,
      cooktop: "None",
      cooktopRun: "",
      cooktopPositionIn: null,
      cooktopFrontPositionIn: null,
      otherCutouts: [],
      measurementsReviewed: false,
      roomWidthIn: null,
      roomDepthIn: null,
      roomWallHeightIn: null,
      finishedTopHeightIn: null,
      topThicknessIn: null,
      islandLeftOffsetIn: null,
      islandBackOffsetIn: null,
      sinkTemplateWidthIn: null,
      sinkTemplateDepthIn: null,
      cooktopTemplateWidthIn: null,
      cooktopTemplateDepthIn: null,
      notes: "",
    },
    cabinets: {
      included: false,
      room: "Kitchen",
      layout: "l-shape",
      primaryWallIn: 216,
      returnWallIn: 120,
      ceilingHeightIn: 96,
      doorStyle: "Shaker",
      finish: "natural-oak",
      hardware: "Matte black",
      upperHeightIn: 36,
      refrigeratorWidthIn: 36,
      rangeWidthIn: 30,
      sinkBaseWidthIn: 36,
      pantryCount: 1,
      drawerBaseCount: 2,
      island: true,
      islandLengthIn: 84,
      islandWidthIn: 42,
      notes: "",
      planner: createBlankCabinetPlannerExtension(),
    },
    labor: {
      trades: [],
      notes: "",
    },
  };
}

export function reconcileSteelHomeProjectDraft(value: unknown): SteelHomeProjectDraft {
  const empty = createEmptySteelHomeProjectDraft();
  if (!value || typeof value !== "object") return empty;

  const candidate = value as Partial<SteelHomeProjectDraft>;
  const building = candidate.building || empty.building;
  const countertops = candidate.countertops || empty.countertops;
  const cabinets = candidate.cabinets || empty.cabinets;
  const labor = candidate.labor || empty.labor;
  const selectedStoneId =
    typeof countertops.stoneId === "string" && JW_STONE_NAMED_IDS.has(countertops.stoneId)
      ? countertops.stoneId
      : empty.countertops.stoneId;
  const selectedStone = getCatalogItemById(selectedStoneId);
  const selectedStoneLastImageIndex = Math.max(0, (selectedStone?.images.length || 1) - 1);
  const legacyTextureImageIndex = cleanNumber(
    countertops.textureImageIndex,
    empty.countertops.textureImageIndex,
    0,
    selectedStoneLastImageIndex
  );
  const stableTextureImageIndex = selectedStone
    ? resolveStoneDesignerPhotoIndex(selectedStone.images, countertops.texturePhotoKey)
    : -1;
  const selectedTextureImageIndex =
    stableTextureImageIndex >= 0 ? stableTextureImageIndex : legacyTextureImageIndex;
  const selectedTexturePhotoKey =
    buildStoneDesignerPhotoKey(selectedStone?.images[selectedTextureImageIndex] || "") || "";
  const requestedCountyFips = cleanText(candidate.countyFips, 5);
  const requestedStateCode = cleanText(candidate.stateCode, 2).toUpperCase();
  const canonicalCounty = /^\d{5}$/.test(requestedCountyFips)
    ? getCountyByFips(requestedCountyFips)
    : undefined;
  const requestedProjectRole =
    candidate.projectRole === ("owner-builder" as string)
      ? "self-contracted"
      : candidate.projectRole;
  const requestedProjectTiming =
    candidate.timing === "As soon as practical"
      ? "As soon as possible"
      : candidate.timing === "Planning ahead"
        ? "More than 12 months away"
        : candidate.timing;
  const countertopLayout = cleanEnum(
    countertops.layout,
    COUNTERTOP_LAYOUTS,
    empty.countertops.layout
  );
  const countertopWallDepthIn = cleanHalfInchNumber(
    countertops.wallDepthIn,
    empty.countertops.wallDepthIn,
    12,
    72
  );
  const minimumMainRunIn =
    countertopLayout === "u-shape"
      ? Math.ceil(countertopWallDepthIn * 2 + 1)
      : countertopLayout === "l-shape"
        ? Math.ceil(countertopWallDepthIn + 0.5)
        : 24;
  const minimumReturnRunIn = Math.ceil(countertopWallDepthIn + 0.5);
  const countertopIsland = countertops.island === true;
  const availableCutoutRuns = new Set<CountertopCutoutRun>(["main"]);
  if (countertopLayout !== "straight") availableCutoutRuns.add("left-return");
  if (countertopLayout === "u-shape") availableCutoutRuns.add("right-return");
  if (countertopIsland) availableCutoutRuns.add("island");
  const cleanCutoutRun = (value: unknown): CountertopCutoutRun | "" => {
    const cleaned = cleanEnum(value, COUNTERTOP_CUTOUT_RUNS, "" as CountertopCutoutRun | "");
    return cleaned && availableCutoutRuns.has(cleaned) ? cleaned : "";
  };
  const cleanOptionalPosition = (value: unknown, run: CountertopCutoutRun | "") => {
    if (!run || value === null || value === undefined || value === "") return null;
    const runLength =
      run === "main"
        ? cleanNumber(countertops.wallAIn, empty.countertops.wallAIn, minimumMainRunIn, 360)
        : run === "left-return"
          ? cleanNumber(countertops.wallBIn, empty.countertops.wallBIn, minimumReturnRunIn, 360)
          : run === "right-return"
            ? cleanNumber(countertops.wallCIn, empty.countertops.wallCIn, minimumReturnRunIn, 360)
            : cleanNumber(countertops.islandLengthIn, empty.countertops.islandLengthIn, 24, 180);
    return cleanEighthInchNumber(
      value,
      Math.round((runLength / 2) * 8) / 8,
      2,
      Math.max(2, runLength - 2)
    );
  };
  const cleanOptionalFrontPosition = (value: unknown, run: CountertopCutoutRun | "") => {
    if (!run || value === null || value === undefined || value === "") return null;
    const surfaceDepth =
      run === "island"
        ? cleanNumber(countertops.islandWidthIn, empty.countertops.islandWidthIn, 20, 72)
        : cleanHalfInchNumber(countertops.wallDepthIn, empty.countertops.wallDepthIn, 12, 72);
    return cleanEighthInchNumber(
      value,
      Math.round((surfaceDepth / 2) * 8) / 8,
      1,
      Math.max(1, surfaceDepth - 1)
    );
  };
  const cleanOptionalDimension = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    return cleanEighthInchNumber(value, 1, 1, 96);
  };
  const rawOtherCutouts = Array.isArray(countertops.otherCutouts)
    ? countertops.otherCutouts.slice(0, 6)
    : [];
  const usedCutoutIds = new Set<string>();
  const otherCutouts = rawOtherCutouts.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const candidateCutout = value as Partial<SteelHomeCountertopCutout>;
    const run = cleanCutoutRun(candidateCutout.run);
    const requestedId = cleanText(candidateCutout.id, 40)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    let id =
      requestedId && !["sink", "cooktop"].includes(requestedId)
        ? requestedId
        : `other-${index + 1}`;
    while (usedCutoutIds.has(id)) id = `${id}-${index + 1}`;
    usedCutoutIds.add(id);
    return [
      {
        id,
        type: cleanLabel(candidateCutout.type, COUNTERTOP_OTHER_CUTOUT_OPTIONS, "Other opening"),
        label: cleanText(candidateCutout.label, 40),
        run,
        positionIn: cleanOptionalPosition(candidateCutout.positionIn, run),
        frontPositionIn: cleanOptionalFrontPosition(candidateCutout.frontPositionIn, run),
        widthIn: cleanOptionalDimension(candidateCutout.widthIn),
        depthIn: cleanOptionalDimension(candidateCutout.depthIn),
      },
    ];
  });
  const sinkRun = cleanCutoutRun(countertops.sinkRun);
  const cooktopRun = cleanCutoutRun(countertops.cooktopRun);

  return {
    version: STEEL_HOME_PROJECT_DRAFT_VERSION,
    location: cleanText(candidate.location, 160),
    stateCode:
      canonicalCounty?.state || (/^[A-Z]{2}$/.test(requestedStateCode) ? requestedStateCode : ""),
    countyFips: canonicalCounty?.fipsCode || "",
    countyName: canonicalCounty?.name || "",
    timing: cleanLabel(requestedProjectTiming, PROJECT_TIMING_OPTIONS, ""),
    projectRole: cleanEnum(requestedProjectRole, PROJECT_ROLES, ""),
    additionalScopes: cleanAllowedStrings(
      candidate.additionalScopes,
      ADDITIONAL_PROJECT_SCOPE_OPTIONS.map((option) => option.value)
    ),
    building: {
      included: building.included === true,
      use: cleanEnum(building.use, BUILDING_USES, empty.building.use),
      widthFt: cleanNumber(building.widthFt, empty.building.widthFt, 12, 200),
      lengthFt: cleanNumber(building.lengthFt, empty.building.lengthFt, 20, 400),
      eaveHeightFt: cleanNumber(building.eaveHeightFt, empty.building.eaveHeightFt, 8, 40),
      roofStyle: cleanEnum(building.roofStyle, BUILDING_ROOFS, empty.building.roofStyle),
      roofPitch: cleanLabel(
        building.roofPitch,
        BUILDING_ROOF_PITCH_OPTIONS,
        empty.building.roofPitch
      ),
      wallColor: cleanEnum(building.wallColor, BUILDING_COLORS, empty.building.wallColor),
      roofColor: cleanEnum(building.roofColor, BUILDING_COLORS, empty.building.roofColor),
      trimColor: cleanEnum(building.trimColor, BUILDING_COLORS, empty.building.trimColor),
      garageDoors: cleanNumber(building.garageDoors, empty.building.garageDoors, 0, 5),
      walkDoors: cleanNumber(building.walkDoors, empty.building.walkDoors, 0, 5),
      windows: cleanNumber(building.windows, empty.building.windows, 0, 16),
      porch: cleanEnum(building.porch, BUILDING_PORCHES, empty.building.porch),
      porchDepthFt: cleanNumber(building.porchDepthFt, empty.building.porchDepthFt, 0, 20),
      notes: cleanText(building.notes, 240),
      planner: sanitizeBuildingPlannerExtension(building.planner),
    },
    countertops: {
      included: countertops.included === true,
      room: cleanLabel(countertops.room, COUNTERTOP_ROOM_OPTIONS, empty.countertops.room),
      layout: countertopLayout,
      wallAIn: cleanNumber(countertops.wallAIn, empty.countertops.wallAIn, minimumMainRunIn, 360),
      wallBIn: cleanNumber(countertops.wallBIn, empty.countertops.wallBIn, minimumReturnRunIn, 360),
      wallCIn: cleanNumber(countertops.wallCIn, empty.countertops.wallCIn, minimumReturnRunIn, 360),
      wallDepthIn: countertopWallDepthIn,
      island: countertopIsland,
      islandLengthIn: cleanNumber(
        countertops.islandLengthIn,
        empty.countertops.islandLengthIn,
        24,
        180
      ),
      islandWidthIn: cleanNumber(
        countertops.islandWidthIn,
        empty.countertops.islandWidthIn,
        20,
        72
      ),
      stoneId: selectedStoneId,
      textureImageIndex: selectedTextureImageIndex,
      texturePhotoKey: selectedTexturePhotoKey,
      textureOffsetX: cleanIncrementNumber(
        countertops.textureOffsetX,
        empty.countertops.textureOffsetX,
        -1,
        1,
        0.05
      ),
      textureOffsetY: cleanIncrementNumber(
        countertops.textureOffsetY,
        empty.countertops.textureOffsetY,
        -1,
        1,
        0.05
      ),
      textureScale: cleanIncrementNumber(
        countertops.textureScale,
        empty.countertops.textureScale,
        0.5,
        3,
        0.1
      ),
      veinRotation: cleanLabel(
        countertops.veinRotation,
        COUNTERTOP_VEIN_ROTATION_OPTIONS,
        empty.countertops.veinRotation
      ),
      cameraPreset: cleanLabel(
        countertops.cameraPreset,
        COUNTERTOP_CAMERA_PRESET_OPTIONS,
        empty.countertops.cameraPreset
      ),
      floorStone: countertops.floorStone === true,
      showSeams: countertops.showSeams === true,
      waterfall: countertopIsland
        ? cleanLabel(
            countertops.waterfall,
            COUNTERTOP_WATERFALL_OPTIONS,
            empty.countertops.waterfall
          )
        : "None",
      edge: cleanLabel(countertops.edge, COUNTERTOP_EDGE_OPTIONS, empty.countertops.edge),
      backsplash: cleanLabel(
        countertops.backsplash,
        COUNTERTOP_BACKSPLASH_OPTIONS,
        empty.countertops.backsplash
      ),
      sink: cleanLabel(countertops.sink, COUNTERTOP_SINK_OPTIONS, empty.countertops.sink),
      sinkRun,
      sinkPositionIn: cleanOptionalPosition(countertops.sinkPositionIn, sinkRun),
      sinkFrontPositionIn: cleanOptionalFrontPosition(countertops.sinkFrontPositionIn, sinkRun),
      cooktop: cleanLabel(
        {
          "30-inch": "30-inch cooktop cutout",
          "36-inch": "36-inch cooktop cutout",
          "48-inch": "48-inch cooktop cutout",
        }[String(countertops.cooktop)] || countertops.cooktop,
        COUNTERTOP_COOKTOP_OPTIONS,
        empty.countertops.cooktop
      ),
      cooktopRun,
      cooktopPositionIn: cleanOptionalPosition(countertops.cooktopPositionIn, cooktopRun),
      cooktopFrontPositionIn: cleanOptionalFrontPosition(
        countertops.cooktopFrontPositionIn,
        cooktopRun
      ),
      otherCutouts,
      measurementsReviewed: countertops.measurementsReviewed === true,
      roomWidthIn: cleanOptionalEighthInchNumber(countertops.roomWidthIn, 24, 1_200),
      roomDepthIn: cleanOptionalEighthInchNumber(countertops.roomDepthIn, 24, 1_200),
      roomWallHeightIn: cleanOptionalEighthInchNumber(countertops.roomWallHeightIn, 48, 240),
      finishedTopHeightIn: cleanOptionalEighthInchNumber(countertops.finishedTopHeightIn, 12, 72),
      topThicknessIn: cleanOptionalEighthInchNumber(countertops.topThicknessIn, 0.25, 6),
      islandLeftOffsetIn: cleanOptionalEighthInchNumber(
        countertops.islandLeftOffsetIn,
        -600,
        1_200
      ),
      islandBackOffsetIn: cleanOptionalEighthInchNumber(
        countertops.islandBackOffsetIn,
        -120,
        1_200
      ),
      sinkTemplateWidthIn: cleanOptionalEighthInchNumber(
        countertops.sinkTemplateWidthIn,
        0.125,
        96
      ),
      sinkTemplateDepthIn: cleanOptionalEighthInchNumber(
        countertops.sinkTemplateDepthIn,
        0.125,
        72
      ),
      cooktopTemplateWidthIn: cleanOptionalEighthInchNumber(
        countertops.cooktopTemplateWidthIn,
        0.125,
        96
      ),
      cooktopTemplateDepthIn: cleanOptionalEighthInchNumber(
        countertops.cooktopTemplateDepthIn,
        0.125,
        72
      ),
      notes: cleanText(countertops.notes, 240),
    },
    cabinets: {
      included: cabinets.included === true,
      room: cleanLabel(cabinets.room, CABINET_ROOM_OPTIONS, empty.cabinets.room),
      layout: cleanEnum(cabinets.layout, CABINET_LAYOUTS, empty.cabinets.layout),
      primaryWallIn: cleanNumber(cabinets.primaryWallIn, empty.cabinets.primaryWallIn, 36, 360),
      returnWallIn: cleanNumber(cabinets.returnWallIn, empty.cabinets.returnWallIn, 36, 360),
      ceilingHeightIn: cleanNumber(
        cabinets.ceilingHeightIn,
        empty.cabinets.ceilingHeightIn,
        72,
        144
      ),
      doorStyle: cleanLabel(
        cabinets.doorStyle,
        CABINET_DOOR_STYLE_OPTIONS,
        empty.cabinets.doorStyle
      ),
      finish: cleanEnum(cabinets.finish, CABINET_FINISHES, empty.cabinets.finish),
      hardware: cleanLabel(cabinets.hardware, CABINET_HARDWARE_OPTIONS, empty.cabinets.hardware),
      upperHeightIn: cleanLabel(cabinets.upperHeightIn, [30, 36, 42] as const, 36),
      refrigeratorWidthIn: cleanLabel(cabinets.refrigeratorWidthIn, [30, 36, 42, 48] as const, 36),
      rangeWidthIn: cleanLabel(cabinets.rangeWidthIn, [30, 36, 48] as const, 30),
      sinkBaseWidthIn: cleanLabel(cabinets.sinkBaseWidthIn, [30, 33, 36] as const, 36),
      pantryCount: cleanNumber(cabinets.pantryCount, empty.cabinets.pantryCount, 0, 4),
      drawerBaseCount: cleanNumber(cabinets.drawerBaseCount, empty.cabinets.drawerBaseCount, 0, 6),
      island: cabinets.island === true,
      islandLengthIn: cleanNumber(cabinets.islandLengthIn, empty.cabinets.islandLengthIn, 24, 180),
      islandWidthIn: cleanNumber(cabinets.islandWidthIn, empty.cabinets.islandWidthIn, 20, 72),
      notes: cleanText(cabinets.notes, 240),
      planner: reconcileCabinetPlannerExtension(cabinets.planner),
    },
    labor: {
      trades: cleanAllowedStrings(labor.trades, LOCAL_LABOR_OPTIONS),
      notes: cleanText(labor.notes, 240),
    },
  };
}

function usesDeployedV3CabinetModuleDefaults(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const cabinets = (value as { cabinets?: Partial<SteelHomeCabinetDesign> }).cabinets;
  if (!cabinets || typeof cabinets !== "object") return false;

  return (
    cabinets.primaryWallIn === 144 &&
    cabinets.refrigeratorWidthIn === 36 &&
    cabinets.rangeWidthIn === 30 &&
    cabinets.sinkBaseWidthIn === 36 &&
    cabinets.pantryCount === 1 &&
    cabinets.drawerBaseCount === 2
  );
}

export function loadSteelHomeProjectDraft(
  storage: SteelHomeProjectStorage | null | undefined
): SteelHomeProjectDraft {
  if (!storage) return createEmptySteelHomeProjectDraft();
  try {
    const currentRaw = storage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    const legacyV8Raw = currentRaw
      ? null
      : storage.getItem(LEGACY_V8_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    const legacyV7Raw =
      currentRaw || legacyV8Raw
        ? null
        : storage.getItem(LEGACY_V7_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    const legacyV6Raw =
      currentRaw || legacyV8Raw || legacyV7Raw
        ? null
        : storage.getItem(LEGACY_V6_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    const legacyV5Raw =
      currentRaw || legacyV8Raw || legacyV7Raw || legacyV6Raw
        ? null
        : storage.getItem(LEGACY_V5_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    const legacyV4Raw =
      currentRaw || legacyV8Raw || legacyV7Raw || legacyV6Raw || legacyV5Raw
        ? null
        : storage.getItem(LEGACY_V4_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    const legacyV3Raw =
      currentRaw || legacyV8Raw || legacyV7Raw || legacyV6Raw || legacyV5Raw || legacyV4Raw
        ? null
        : storage.getItem(LEGACY_V3_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    const raw =
      currentRaw ||
      legacyV8Raw ||
      legacyV7Raw ||
      legacyV6Raw ||
      legacyV5Raw ||
      legacyV4Raw ||
      legacyV3Raw;
    if (!raw) return createEmptySteelHomeProjectDraft();
    const parsed = JSON.parse(raw) as { version?: unknown };
    const isCurrentDraft = parsed.version === STEEL_HOME_PROJECT_DRAFT_VERSION;
    const isLegacyV8Draft =
      Boolean(legacyV8Raw) && parsed.version === LEGACY_V8_STEEL_HOME_PROJECT_DRAFT_VERSION;
    const isLegacyV7Draft =
      Boolean(legacyV7Raw) && parsed.version === LEGACY_V7_STEEL_HOME_PROJECT_DRAFT_VERSION;
    const isLegacyV6Draft =
      Boolean(legacyV6Raw) && parsed.version === LEGACY_V6_STEEL_HOME_PROJECT_DRAFT_VERSION;
    const isLegacyV5Draft =
      Boolean(legacyV5Raw) && parsed.version === LEGACY_V5_STEEL_HOME_PROJECT_DRAFT_VERSION;
    const isLegacyV4Draft =
      Boolean(legacyV4Raw) && parsed.version === LEGACY_V4_STEEL_HOME_PROJECT_DRAFT_VERSION;
    const isLegacyV3Draft =
      Boolean(legacyV3Raw) && parsed.version === LEGACY_V3_STEEL_HOME_PROJECT_DRAFT_VERSION;
    if (
      !isCurrentDraft &&
      !isLegacyV8Draft &&
      !isLegacyV7Draft &&
      !isLegacyV6Draft &&
      !isLegacyV5Draft &&
      !isLegacyV4Draft &&
      !isLegacyV3Draft
    ) {
      return createEmptySteelHomeProjectDraft();
    }
    const reconciled = reconcileSteelHomeProjectDraft(parsed);
    if (isLegacyV3Draft && usesDeployedV3CabinetModuleDefaults(parsed)) {
      reconciled.cabinets.primaryWallIn = createEmptySteelHomeProjectDraft().cabinets.primaryWallIn;
    }
    if (
      isLegacyV8Draft ||
      isLegacyV7Draft ||
      isLegacyV6Draft ||
      isLegacyV5Draft ||
      isLegacyV4Draft ||
      isLegacyV3Draft
    ) {
      try {
        storage.setItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY, JSON.stringify(reconciled));
        storage.removeItem(LEGACY_V8_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
        storage.removeItem(LEGACY_V7_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
        storage.removeItem(LEGACY_V6_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
        storage.removeItem(LEGACY_V5_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
        storage.removeItem(LEGACY_V4_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
        storage.removeItem(LEGACY_V3_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
      } catch {
        // A readable legacy draft remains usable even when migration writes are blocked.
      }
    }
    return reconciled;
  } catch {
    try {
      storage.removeItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    } catch {
      // The in-memory tools remain usable when browser storage is unavailable.
    }
    return createEmptySteelHomeProjectDraft();
  }
}

export function saveSteelHomeProjectDraft(
  storage: SteelHomeProjectStorage | null | undefined,
  draft: SteelHomeProjectDraft
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
      JSON.stringify(reconcileSteelHomeProjectDraft(draft))
    );
    return true;
  } catch {
    return false;
  }
}

export function clearSteelHomeProjectDraft(
  storage: SteelHomeProjectStorage | null | undefined
): void {
  if (!storage) return;
  try {
    storage.removeItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    storage.removeItem(LEGACY_V8_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    storage.removeItem(LEGACY_V7_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    storage.removeItem(LEGACY_V6_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    storage.removeItem(LEGACY_V5_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    storage.removeItem(LEGACY_V4_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    storage.removeItem(LEGACY_V3_STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
  } catch {
    // Clearing the in-memory state is still sufficient for the current session.
  }
}

export function calculateCountertopSquareFeet(designInput: SteelHomeCountertopDesign): number {
  const design = reconcileSteelHomeProjectDraft({ countertops: designInput }).countertops;
  const depth = design.wallDepthIn;
  let squareInches = design.wallAIn * depth;
  if (design.layout === "l-shape" || design.layout === "u-shape") {
    squareInches += design.wallBIn * depth - depth * depth;
  }
  if (design.layout === "u-shape") {
    squareInches += design.wallCIn * depth - depth * depth;
  }
  if (design.island) {
    squareInches += design.islandLengthIn * design.islandWidthIn;
  }
  return Math.round((Math.max(0, squareInches) / 144) * 10) / 10;
}

export function formatCountertopWallRuns(designInput: SteelHomeCountertopDesign): string {
  const design = reconcileSteelHomeProjectDraft({ countertops: designInput }).countertops;
  const runs = [`Main run: ${design.wallAIn}"`];
  if (design.layout !== "straight") runs.push(`Left return: ${design.wallBIn}"`);
  if (design.layout === "u-shape") runs.push(`Right return: ${design.wallCIn}"`);
  return runs.join("; ");
}

export function getAvailableCountertopCutoutRuns(
  designInput: SteelHomeCountertopDesign
): Array<{ value: CountertopCutoutRun; label: string }> {
  const design = reconcileSteelHomeProjectDraft({ countertops: designInput }).countertops;
  return COUNTERTOP_CUTOUT_RUN_OPTIONS.filter((option) => {
    if (option.value === "left-return") return design.layout !== "straight";
    if (option.value === "right-return") return design.layout === "u-shape";
    if (option.value === "island") return design.island;
    return true;
  });
}

export function getCountertopCutoutRunLength(
  designInput: SteelHomeCountertopDesign,
  run: CountertopCutoutRun
): number {
  const design = reconcileSteelHomeProjectDraft({ countertops: designInput }).countertops;
  if (run === "main") return design.wallAIn;
  if (run === "left-return") return design.wallBIn;
  if (run === "right-return") return design.wallCIn;
  return design.islandLengthIn;
}

/** Physical front-to-back depth used by the planning drawing and opening checks. */
export function getCountertopCutoutRunDepth(
  designInput: SteelHomeCountertopDesign,
  run: CountertopCutoutRun
): number {
  const design = reconcileSteelHomeProjectDraft({ countertops: designInput }).countertops;
  return run === "island" ? design.islandWidthIn : design.wallDepthIn;
}

export function getCountertopCutoutRunLabel(run: CountertopCutoutRun | ""): string {
  return (
    COUNTERTOP_CUTOUT_RUN_OPTIONS.find((option) => option.value === run)?.label ||
    "Placement needed"
  );
}

export function getCountertopCutoutStartLabel(run: CountertopCutoutRun | ""): string {
  if (run === "main" || run === "island") return "left end";
  if (run === "left-return" || run === "right-return") return "top end";
  return "start end";
}

export type CountertopOpeningScheduleItem = {
  id: string;
  label: string;
  placementKind: "cutout" | "full-depth-gap" | "front-edge-opening";
  run: CountertopCutoutRun | "";
  positionIn: number | null;
  frontPositionIn: number | null;
  requiresFrontPosition: boolean;
  widthIn: number | null;
  depthIn: number | null;
  /** Conservative span used only for collision planning when final template dimensions are unknown. */
  planningWidthIn: number;
  representation?: "coordination-point" | "template-opening" | "full-depth-gap";
  templateStatus?: "not-needed" | "unresolved" | "entered";
};

function openingPlanningWidth(item: CountertopOpeningScheduleItem): number {
  return item.planningWidthIn;
}

function isSmallDeckAccessory(item: CountertopOpeningScheduleItem): boolean {
  return (
    item.placementKind === "cutout" &&
    item.id !== "sink" &&
    item.id !== "cooktop" &&
    item.planningWidthIn <= 2 &&
    (item.depthIn || 0) <= 2
  );
}

const COUNTERTOP_OPENING_EDGE_CLEARANCE_IN = 1;

export function getCountertopOpeningFrontBounds(
  designInput: SteelHomeCountertopDesign,
  item: CountertopOpeningScheduleItem
): { minimum: number; maximum: number; surfaceDepth: number } | null {
  if (!item.run || !item.requiresFrontPosition || !item.depthIn) return null;
  const surfaceDepth = getCountertopCutoutRunDepth(designInput, item.run);
  return {
    minimum: item.depthIn / 2 + COUNTERTOP_OPENING_EDGE_CLEARANCE_IN,
    maximum: surfaceDepth - item.depthIn / 2 - COUNTERTOP_OPENING_EDGE_CLEARANCE_IN,
    surfaceDepth,
  };
}

export function getCountertopOpeningSchedule(
  designInput: SteelHomeCountertopDesign
): CountertopOpeningScheduleItem[] {
  const design = reconcileSteelHomeProjectDraft({ countertops: designInput }).countertops;
  return getCountertopPlannerOpeningSchedule(design);
}

export function getCountertopPlacementProblems(designInput: SteelHomeCountertopDesign): string[] {
  const design = reconcileSteelHomeProjectDraft({ countertops: designInput }).countertops;
  const problems: string[] = [];
  const schedule = getCountertopOpeningSchedule(design);
  for (const item of schedule) {
    if (!item.run || item.positionIn === null) {
      problems.push(`${item.label} needs a location.`);
      continue;
    }
    const runLength = getCountertopCutoutRunLength(design, item.run);
    const endClearance = openingPlanningWidth(item) / 2 + 2;
    if (item.positionIn < endClearance || item.positionIn > runLength - endClearance) {
      problems.push(
        `${item.label} is too close to the end of ${getCountertopCutoutRunLabel(item.run).toLowerCase()}.`
      );
    }
    if (
      item.run !== "island" &&
      design.layout !== "straight" &&
      item.positionIn < design.wallDepthIn + endClearance
    ) {
      problems.push(
        `${item.label} overlaps the shared inside-corner zone on ${getCountertopCutoutRunLabel(item.run).toLowerCase()}; move its center at least ${Math.ceil(design.wallDepthIn + endClearance)}" from the ${getCountertopCutoutStartLabel(item.run)}.`
      );
    }
    if (
      design.layout === "u-shape" &&
      item.run === "main" &&
      runLength - item.positionIn < design.wallDepthIn + endClearance
    ) {
      problems.push(
        `${item.label} overlaps the shared inside-corner zone on the main run; move its center at least ${Math.ceil(design.wallDepthIn + endClearance)}" from the right end.`
      );
    }
    if (item.requiresFrontPosition && item.depthIn) {
      const bounds = getCountertopOpeningFrontBounds(design, item);
      if (bounds && bounds.maximum < bounds.minimum) {
        problems.push(
          `${item.label} is ${item.depthIn}" deep and cannot fit on the ${bounds.surfaceDepth}"-deep ${getCountertopCutoutRunLabel(item.run).toLowerCase()}.`
        );
      } else if (item.frontPositionIn === null) {
        problems.push(`${item.label} needs a center distance from the front edge.`);
      } else if (
        bounds &&
        (item.frontPositionIn < bounds.minimum || item.frontPositionIn > bounds.maximum)
      ) {
        problems.push(
          `${item.label} is too close to the front or back edge of ${getCountertopCutoutRunLabel(item.run).toLowerCase()}.`
        );
      }
    }
  }
  for (const run of COUNTERTOP_CUTOUT_RUN_OPTIONS.map((option) => option.value)) {
    const placed = schedule
      .filter(
        (item): item is CountertopOpeningScheduleItem & { positionIn: number } =>
          item.run === run && item.positionIn !== null
      )
      .sort((a, b) => a.positionIn - b.positionIn);
    for (let firstIndex = 0; firstIndex < placed.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < placed.length; secondIndex += 1) {
        const first = placed[firstIndex];
        const second = placed[secondIndex];
        const sink = first.id === "sink" ? first : second.id === "sink" ? second : null;
        const accessory = sink === first ? second : sink === second ? first : null;
        const isSinkAccessoryPair = Boolean(sink && accessory && isSmallDeckAccessory(accessory));
        // Faucet/soap/accessory holes next to a sink are manufacturer-specific. We keep their
        // coordinates in the brief and leave final template clearance to the fabricator. An
        // accessory visibly inside an undermount sink footprint is still an obvious conflict.
        if (isSinkAccessoryPair && sink && accessory) {
          const obviousUndermountOverlap =
            sink.placementKind === "cutout" &&
            sink.frontPositionIn !== null &&
            accessory.frontPositionIn !== null &&
            Boolean(sink.depthIn) &&
            Boolean(accessory.depthIn) &&
            Math.abs(accessory.positionIn - sink.positionIn) <
              (openingPlanningWidth(sink) + openingPlanningWidth(accessory)) / 2 &&
            Math.abs(accessory.frontPositionIn - sink.frontPositionIn) <
              ((sink.depthIn || 0) + (accessory.depthIn || 0)) / 2;
          if (!obviousUndermountOverlap) continue;
        }
        const minimumDistance =
          openingPlanningWidth(first) / 2 + openingPlanningWidth(second) / 2 + 3;
        const frontToBackOverlap =
          !first.requiresFrontPosition ||
          !second.requiresFrontPosition ||
          first.frontPositionIn === null ||
          second.frontPositionIn === null ||
          !first.depthIn ||
          !second.depthIn ||
          Math.abs(second.frontPositionIn - first.frontPositionIn) <
            first.depthIn / 2 + second.depthIn / 2 + 3;
        if (
          Math.abs(second.positionIn - first.positionIn) < minimumDistance &&
          frontToBackOverlap
        ) {
          problems.push(
            `${first.label} and ${second.label} are too close together on ${getCountertopCutoutRunLabel(run).toLowerCase()}.`
          );
        }
      }
    }
  }
  for (const cutout of design.otherCutouts) {
    if (cutout.type === "Other opening" && !cutout.label.trim()) {
      problems.push("Other opening needs a name.");
    }
    if (cutout.run && cutout.positionIn !== null && (!cutout.widthIn || !cutout.depthIn)) {
      problems.push(
        `${cutout.type === "Other opening" && cutout.label ? cutout.label : cutout.type} needs an opening width and depth.`
      );
    }
  }
  return problems;
}

export function formatCountertopOpeningSchedule(designInput: SteelHomeCountertopDesign): string[] {
  const design = reconcileSteelHomeProjectDraft({ countertops: designInput }).countertops;
  return getCountertopOpeningSchedule(design).map((item) => {
    const startReference =
      item.run === "main"
        ? "start edge (left end); left/right are as viewed while standing in the room facing the run"
        : item.run === "left-return" || item.run === "right-return"
          ? `start edge (top/wall-side outer end; the first ${design.wallDepthIn} inches includes the shared corner zone)`
          : item.run === "island"
            ? "start edge (left end while standing at the long edge facing away from the main run)"
            : "start edge";
    const frontReference =
      item.run === "island"
        ? "front long edge facing away from the main run; measure inward across the island"
        : "room-facing front edge; measure inward toward the wall or back edge";
    const placement =
      item.run && item.positionIn !== null
        ? `${getCountertopCutoutRunLabel(item.run)}, center ${item.positionIn}" from the ${startReference}${
            item.placementKind === "front-edge-opening"
              ? ", apron opening interrupts the room-facing front edge; exact notch and cutout must follow the sink manufacturer's template"
              : item.requiresFrontPosition
                ? item.frontPositionIn === null
                  ? ", front-to-back position not placed"
                  : `, center ${item.frontPositionIn}" inward from the ${frontReference}`
                : ", full-depth run gap (not a countertop cutout)"
          }`
        : "location not placed";
    const dimensions =
      item.placementKind === "front-edge-opening"
        ? ""
        : item.widthIn && item.depthIn
          ? `, approximately ${item.widthIn}" × ${item.depthIn}"`
          : item.widthIn
            ? `, nominal ${item.widthIn}" width`
            : item.representation === "coordination-point"
              ? ", non-dimensional coordination point; manufacturer template size not entered"
              : "";
    return `${item.label} — ${placement}${dimensions}`;
  });
}

export function calculateCabinetPlannedWidth(designInput: SteelHomeCabinetDesign): number {
  const design = reconcileSteelHomeProjectDraft({ cabinets: designInput }).cabinets;
  return (
    design.refrigeratorWidthIn +
    design.rangeWidthIn +
    design.sinkBaseWidthIn +
    design.pantryCount * 24 +
    design.drawerBaseCount * 24 +
    24
  );
}

export type CabinetPrimaryWallFit = {
  fits: boolean;
  plannedWidthIn: number;
  primaryWallIn: number;
  overageIn: number;
};

export function getCabinetPrimaryWallFit(
  designInput: SteelHomeCabinetDesign
): CabinetPrimaryWallFit {
  const design = reconcileSteelHomeProjectDraft({ cabinets: designInput }).cabinets;
  const plannedWidthIn = calculateCabinetPlannedWidth(design);
  const overageIn = Math.max(0, plannedWidthIn - design.primaryWallIn);
  return {
    fits: overageIn === 0,
    plannedWidthIn,
    primaryWallIn: design.primaryWallIn,
    overageIn,
  };
}

export type BuildingOpeningFit = {
  fits: boolean;
  totalOpenings: number;
  requiredWallRunFt: number;
  availableWallRunFt: number;
  shortfallFt: number;
  recommendedDimensionIncreaseFt: number;
};

/**
 * Count-only feasibility guard for the builder UI. The spans include a rough
 * planning buffer around each opening and four short corner reserves. This is
 * intentionally not a placement, framing, clearance, or engineering check.
 */
export function getBuildingOpeningFit(designInput: SteelHomeBuildingDesign): BuildingOpeningFit {
  const design = reconcileSteelHomeProjectDraft({ building: designInput }).building;
  const totalOpenings = design.garageDoors + design.walkDoors + design.windows;
  const requiredWallRunFt = design.garageDoors * 12 + design.walkDoors * 5 + design.windows * 4;
  const perimeterFt = 2 * (design.widthFt + design.lengthFt);
  const availableWallRunFt = Math.max(0, perimeterFt - 16);
  const shortfallFt = Math.max(0, requiredWallRunFt - availableWallRunFt);

  return {
    fits: shortfallFt === 0,
    totalOpenings,
    requiredWallRunFt,
    availableWallRunFt,
    shortfallFt,
    recommendedDimensionIncreaseFt: Math.ceil(shortfallFt / 2),
  };
}

const BUILDING_PLANNING_DISCLAIMER =
  "Quote required. Product availability, engineering, freight, foundation, installation, taxes, and final specifications require professional review.";

const CABINET_PLANNING_DISCLAIMER =
  "Quote required. Field measurements, exact products, hardware, trim, delivery, taxes, and installation require professional review.";

const PROJECT_ESTIMATE_DISCLAIMER =
  "The planners do not publish prices. Every selected product or service requires availability review and a written quote. Stone purchasing and countertop fabrication remain separate requests.";

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPlanningRange(range: PlanningRange): string {
  const first = Number.isFinite(range.lower) ? Math.max(0, Math.round(range.lower)) : 0;
  const second = Number.isFinite(range.high) ? Math.max(0, Math.round(range.high)) : first;
  const lower = Math.min(first, second);
  const high = Math.max(first, second);
  if (high <= 0) return "Quote required";
  return lower === high
    ? CURRENCY_FORMATTER.format(lower)
    : `${CURRENCY_FORMATTER.format(lower)}–${CURRENCY_FORMATTER.format(high)}`;
}

export function calculateBuildingPlanningEstimate(
  designInput: SteelHomeBuildingDesign
): SteelHomePlanningEstimate {
  reconcileSteelHomeProjectDraft({ building: designInput });

  return {
    key: "building",
    label: "Metal building — quote required",
    range: { lower: 0, high: 0 },
    breakdown: [],
    disclaimer: BUILDING_PLANNING_DISCLAIMER,
  };
}

export function calculateCabinetPlanningEstimate(
  designInput: SteelHomeCabinetDesign
): SteelHomePlanningEstimate {
  reconcileSteelHomeProjectDraft({ cabinets: designInput });

  return {
    key: "cabinets",
    label: "Cabinets — quote required",
    range: { lower: 0, high: 0 },
    breakdown: [],
    disclaimer: CABINET_PLANNING_DISCLAIMER,
  };
}

export function getSteelHomeProjectEstimateSummary(
  draftInput: SteelHomeProjectDraft
): SteelHomeProjectEstimateSummary {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const quoteRequired: string[] = [];
  if (draft.building.included) {
    quoteRequired.push(
      "Metal building: catalog availability, engineering, freight, foundation coordination, delivery, and installation."
    );
  }
  if (draft.cabinets.included) {
    quoteRequired.push(
      "Cabinets: field measurements, exact products, hardware, trim, delivery, and installation."
    );
  }
  if (draft.countertops.included) {
    const stone = getCatalogItemById(draft.countertops.stoneId);
    quoteRequired.push(
      `${stone?.publicLabel || "Selected surface"}: stone availability, slab quantity, and delivery. Fabrication is separate.`
    );
  }
  return {
    planningRange: null,
    planningEstimates: [],
    quoteRequired,
    disclaimer: PROJECT_ESTIMATE_DISCLAIMER,
  };
}

function labelFromOptions(
  value: string,
  options: readonly { value: string; label: string }[]
): string {
  return options.find((option) => option.value === value)?.label || value;
}

function getAdditionalProjectScopeLabels(draft: SteelHomeProjectDraft): string[] {
  return draft.additionalScopes.flatMap((value) => {
    const option = ADDITIONAL_PROJECT_SCOPE_OPTIONS.find((item) => item.value === value);
    return option ? [option.label] : [];
  });
}

function briefNote(value: string): string {
  return cleanText(value, 240);
}

function addLine(lines: string[], label: string, value: unknown) {
  const normalized = String(value ?? "").trim();
  if (normalized) lines.push(`${label}: ${normalized}`);
}

function formatOptionalInches(value: number | null): string {
  return value === null ? "Not entered" : `${value}\"`;
}

function addCountertopMeasurementLines(lines: string[], design: SteelHomeCountertopDesign): void {
  addLine(
    lines,
    "Room shell",
    `${formatOptionalInches(design.roomWidthIn)} wide × ${formatOptionalInches(design.roomDepthIn)} deep × ${formatOptionalInches(design.roomWallHeightIn)} high`
  );
  addLine(lines, "Finished-top height", formatOptionalInches(design.finishedTopHeightIn));
  addLine(lines, "Top thickness", formatOptionalInches(design.topThicknessIn));
  if (design.island) {
    addLine(
      lines,
      "Island position",
      `${formatOptionalInches(design.islandLeftOffsetIn)} from the main-run left edge; ${formatOptionalInches(design.islandBackOffsetIn)} perpendicular from the main wall/back edge`
    );
  }
  if (!design.measurementsReviewed) {
    addLine(
      lines,
      "Surface measurement status",
      "Unreviewed starter values — excluded from measured geometry"
    );
    return;
  }
  addLine(lines, "Wall runs", formatCountertopWallRuns(design));
  addLine(lines, "Wall-top depth", `${design.wallDepthIn}\"`);
  addLine(
    lines,
    "Island",
    design.island ? `${design.islandLengthIn}\" × ${design.islandWidthIn}\"` : "None"
  );
  addLine(
    lines,
    "Gross countertop layout footprint (backsplash excluded; range gaps not deducted)",
    `About ${calculateCountertopSquareFeet(design)} sq. ft.`
  );
}

export function formatSteelHomeProjectLocation(draftInput: SteelHomeProjectDraft): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const place = draft.location || "Not entered";
  return draft.countyName && draft.stateCode
    ? `${place} — ${draft.countyName}, ${draft.stateCode}`
    : place;
}

export function getIncludedProjectScopes(draftInput: SteelHomeProjectDraft): string[] {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  return [
    draft.countertops.included ? "Countertops" : "",
    draft.cabinets.included ? "Cabinets" : "",
    draft.building.included ? "Metal Building" : "",
  ].filter(Boolean);
}

export function buildSteelHomeProjectDescription(draftInput: SteelHomeProjectDraft): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const scopes = getIncludedProjectScopes(draft);
  const estimateSummary = getSteelHomeProjectEstimateSummary(draft);
  const plannerLabel = scopes.length === 1 ? "Planner" : "Planners";
  const lines = [
    "TradeScout Steel Home Planning Request",
    `Project location: ${formatSteelHomeProjectLocation(draft)}`,
    `${plannerLabel}: ${scopes.join(", ") || "None selected"}`,
  ];
  addLine(lines, "Contracting setup", labelFromOptions(draft.projectRole, PROJECT_ROLE_OPTIONS));
  addLine(lines, "Quote needed", estimateSummary.quoteRequired.join(", "));
  addLine(lines, "Desired timing", draft.timing);

  if (draft.building.included) {
    const buildingRequest = buildBuildingPlannerRequest(draft.building.planner);
    const buildingReadiness = getBuildingPlannerRequestReadiness(draft.building.planner);
    lines.push("", "Metal Building Details");
    if (!buildingRequest) {
      addLine(lines, "Status", "Planner incomplete — request blocked");
      buildingReadiness.blockers.forEach((blocker) => lines.push(`- ${blocker.message}`));
    } else {
      addLine(lines, "Use", buildingRequest.use);
      addLine(lines, "Structural system", buildingRequest.structuralSystem);
      addLine(lines, "Measured shell", buildingRequest.shell);
      addLine(lines, "Roof", buildingRequest.roof);
      addLine(lines, "Exterior colors", buildingRequest.colors.join("; "));
      lines.push("Placed openings");
      lines.push(
        ...(buildingRequest.openings.length
          ? buildingRequest.openings.map((opening) => `- ${opening}`)
          : ["- None placed"])
      );
      lines.push("Placed attachments");
      lines.push(
        ...(buildingRequest.attachments.length
          ? buildingRequest.attachments.map((attachment) => `- ${attachment}`)
          : ["- None placed"])
      );
      lines.push("Placed accessories");
      lines.push(
        ...(buildingRequest.accessories.length
          ? buildingRequest.accessories.map((accessory) => `- ${accessory}`)
          : ["- None placed"])
      );
      addLine(lines, "Scene reference", buildingRequest.sceneFingerprint);
      addLine(lines, "Private planner notes", briefNote(buildingRequest.notes));
      lines.push(...buildingRequest.qualifications.map((qualification) => `- ${qualification}`));
    }
  }

  if (draft.countertops.included) {
    const countertops = draft.countertops;
    const stone = getCatalogItemById(countertops.stoneId);
    lines.push("", "Countertop Details");
    addLine(
      lines,
      "Room and layout",
      `${countertops.room}, ${labelFromOptions(countertops.layout, COUNTERTOP_LAYOUT_OPTIONS)}`
    );
    addCountertopMeasurementLines(lines, countertops);
    addLine(
      lines,
      "Selected surface",
      stone ? `${stone.publicLabel}${stone.materialLabel ? ` — ${stone.materialLabel}` : ""}` : ""
    );
    addLine(
      lines,
      "Details",
      `${countertops.edge} edge; ${countertops.backsplash} backsplash; ${countertops.sink} sink; ${countertops.cooktop} cooktop`
    );
    addLine(lines, "Visualizer configuration", formatCountertopVisualizerDetails(countertops));
    addLine(lines, "Notes", briefNote(countertops.notes));
  }

  if (draft.cabinets.included) {
    lines.push("", ...buildCabinetPlannerRequestBrief(draft.cabinets.planner).split("\n"));
  }

  lines.push("");
  if (draft.countertops.included) {
    lines.push(
      "This request is not a quote. Stone material and fabrication are separate: JW Stone supplies material and does not template, fabricate, cut, or install countertops."
    );
  } else {
    lines.push(
      "This request is not a quote. Final pricing depends on confirmed products, site conditions, taxes, delivery, and installation requirements."
    );
  }
  return lines.join("\n");
}

function updateRequestHref(
  baseHref: string,
  values: Record<string, string | undefined>,
  remove: readonly string[] = []
): string {
  const isAbsolute = /^https?:\/\//i.test(baseHref);
  const url = new URL(baseHref, "https://tradescout.local");
  for (const key of remove) url.searchParams.delete(key);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

function formatCountertopVisualizerDetails(design: SteelHomeCountertopDesign): string {
  const targets = [
    "countertops",
    design.island ? "island" : null,
    design.backsplash === "None" ? null : `${design.backsplash.toLowerCase()} backsplash`,
    design.floorStone ? "floor" : null,
  ].filter(Boolean);
  return [
    `inventory image ${design.textureImageIndex + 1}`,
    `${design.veinRotation}° vein direction`,
    `${design.textureScale.toFixed(1)}× mapping scale`,
    `crop X ${design.textureOffsetX.toFixed(2)} / Y ${design.textureOffsetY.toFixed(2)}`,
    `applied to ${targets.join(", ")}`,
    `${design.waterfall.toLowerCase()} waterfall`,
    design.showSeams ? "planning seams shown" : "no planning seams shown",
  ].join("; ");
}

function addCountertopStoneSourceContext(
  lines: string[],
  design: SteelHomeCountertopDesign,
  stone: ReturnType<typeof getCatalogItemById>
): void {
  if (!stone?.shareSlug) return;
  const selectedImageHref = stone.images[design.textureImageIndex];
  if (!selectedImageHref) return;
  const stablePhotoHref = buildNamedStoneDesignerImageHref(stone.shareSlug, selectedImageHref);
  const exactDimensions = resolveSlabDimensionForInventoryImage(selectedImageHref);
  const handOrCloseUp = isHandScaleCoverImage(selectedImageHref);
  addLine(lines, "Selected catalog photo reference", stablePhotoHref || "Unavailable");
  addLine(
    lines,
    "Selected-photo source dimensions",
    exactDimensions
      ? `${formatSlabDimension(exactDimensions)} recorded for this exact photo's source filename`
      : "Not recorded for this exact photo"
  );
  addLine(
    lines,
    "Texture scale status",
    handOrCloseUp
      ? "Scale unverified — the selected photo is a hand or close-up view"
      : exactDimensions
        ? "Dimension-derived from this exact photo; confirm the exact slab with JW Stone"
        : "Scale unverified — this exact photo has no recorded source dimensions"
  );
  addLine(lines, "Availability status", "Confirmation required with JW Stone");
}

const DIRECT_CONNECT_COMPETING_CONTEXT_KEYS = [
  "intent",
  "target",
  "targetName",
  "targetProviderId",
  "contractorId",
  "contractor",
  "profile",
  "profileName",
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
] as const;

export function buildCountertopStoneRequestDescription(draftInput: SteelHomeProjectDraft): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const design = draft.countertops;
  const stone = getCatalogItemById(design.stoneId);
  const lines = [
    "TradeScout Stone Material Request",
    `Project location: ${formatSteelHomeProjectLocation(draft)}`,
  ];
  addLine(lines, "Contracting setup", labelFromOptions(draft.projectRole, PROJECT_ROLE_OPTIONS));
  addLine(
    lines,
    "Requested surface",
    stone ? `${stone.publicLabel}${stone.materialLabel ? ` — ${stone.materialLabel}` : ""}` : ""
  );
  addLine(lines, "Room", design.room);
  addLine(lines, "Layout", labelFromOptions(design.layout, COUNTERTOP_LAYOUT_OPTIONS));
  addCountertopMeasurementLines(lines, design);
  addLine(
    lines,
    "Backsplash selection",
    `${design.backsplash} (not included in the area; quantity requires field measurement)`
  );
  addLine(lines, "Visualizer configuration", formatCountertopVisualizerDetails(design));
  addCountertopStoneSourceContext(lines, design, stone);
  addLine(lines, "Desired timing", draft.timing);
  lines.push(
    "",
    "Material request only: ask about stone availability and delivery. Opening locations do not establish stone quantity or price.",
    "Slab quantity, backsplash height, seams, waste, and final material quantity require field measurement and slab layout.",
    "JW Stone does not provide field templating, fabrication, cutting, or countertop installation. Those services require a separate fabricator."
  );
  return lines.join("\n");
}

export function buildCountertopFabricatorRequestDescription(
  draftInput: SteelHomeProjectDraft
): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const design = draft.countertops;
  const stone = getCatalogItemById(design.stoneId);
  const serviceArea =
    draft.countyName && draft.stateCode
      ? `${draft.countyName}, ${draft.stateCode}`
      : draft.stateCode || "Not entered";
  const lines = [
    "TradeScout Countertop Fabricator Request",
    `Service area: ${serviceArea}`,
    "Work needed: Stone fabrication",
  ];
  addLine(lines, "Contracting setup", labelFromOptions(draft.projectRole, PROJECT_ROLE_OPTIONS));
  addLine(lines, "Desired timing", draft.timing);
  addLine(
    lines,
    "Room and layout",
    `${design.room}, ${labelFromOptions(design.layout, COUNTERTOP_LAYOUT_OPTIONS)}`
  );
  addCountertopMeasurementLines(lines, design);
  addLine(
    lines,
    "Stone reference",
    stone ? `${stone.publicLabel}${stone.materialLabel ? ` — ${stone.materialLabel}` : ""}` : ""
  );
  addLine(lines, "Edge and backsplash", `${design.edge} edge; ${design.backsplash} backsplash`);
  addLine(lines, "Visualizer configuration", formatCountertopVisualizerDetails(design));
  addCountertopStoneSourceContext(lines, design, stone);
  const openings = formatCountertopOpeningSchedule(design);
  if (openings.length)
    lines.push(
      "",
      "Planned openings",
      `Measurement reference: wall-run front means the finished edge facing the room. Return runs start at their top/wall-side outer end; the first ${design.wallDepthIn} inches includes the shared corner zone where the return meets the main run. For an island, FRONT is the long edge facing away from the main run; stand there and use your left as the island start.`,
      ...openings.map((line) => `- ${line}`)
    );
  else lines.push("", "Planned openings", "- None added");
  addLine(lines, "Fabricator notes", briefNote(design.notes));
  lines.push(
    "",
    "Planning brief only. The fabricator must field-template and confirm every opening, dimension, clearance, seam, edge, and installation requirement.",
    "Stone purchase, availability, slab quantity, and material pricing are not part of this fabricator request."
  );
  return lines.join("\n");
}

export function buildCountertopStoneRequestHref(
  baseHref: string,
  draftInput: SteelHomeProjectDraft
): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const stone = getCatalogItemById(draft.countertops.stoneId);
  return updateRequestHref(
    baseHref,
    {
      profile: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug,
      profileName: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel,
      source: STEEL_HOME_PACKAGES_REQUEST_SOURCE,
      subject: "product",
      title: `TradeScout Stone Material Request — ${stone?.publicLabel || "Selected surface"}`,
      description: buildCountertopStoneRequestDescription(draft),
      location: draft.location,
      county: draft.countyFips,
      state: draft.stateCode,
      when: draft.timing,
    },
    DIRECT_CONNECT_COMPETING_CONTEXT_KEYS
  );
}

export function buildCountertopFabricatorRequestHref(
  baseHref: string,
  draftInput: SteelHomeProjectDraft
): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const serviceArea =
    draft.countyName && draft.stateCode
      ? `${draft.countyName}, ${draft.stateCode}`
      : draft.stateCode;
  return updateRequestHref(
    baseHref,
    {
      source: STEEL_HOME_PACKAGES_LABOR_REQUEST_SOURCE,
      subject: "service",
      title: "TradeScout Countertop Fabricator Request",
      description: buildCountertopFabricatorRequestDescription(draft),
      location: serviceArea,
      county: draft.countyFips,
      state: draft.stateCode,
      when: draft.timing,
    },
    DIRECT_CONNECT_COMPETING_CONTEXT_KEYS
  );
}

export function buildSteelHomeProjectRequestHref(
  baseHref: string,
  draftInput: SteelHomeProjectDraft
): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const scopes = getIncludedProjectScopes(draft);
  return updateRequestHref(
    baseHref,
    {
      profile: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug,
      profileName: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.displayLabel,
      source: STEEL_HOME_PACKAGES_REQUEST_SOURCE,
      subject: "product",
      title: scopes.length
        ? `TradeScout Steel Home Planning Request — ${scopes.join(", ")}`
        : "TradeScout Steel Home Planning Request",
      description: buildSteelHomeProjectDescription(draft),
      location: draft.location,
      county: draft.countyFips,
      state: draft.stateCode,
      when: draft.timing,
    },
    DIRECT_CONNECT_COMPETING_CONTEXT_KEYS
  );
}

export function buildSteelHomeLaborRequestHref(
  baseHref: string,
  draftInput: SteelHomeProjectDraft
): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const scopes = getIncludedProjectScopes(draft);
  const lines = [
    "TradeScout Local Trade Request",
    `Project location: ${formatSteelHomeProjectLocation(draft)}`,
    `Work needed: ${draft.labor.trades.join(", ") || "Not selected"}`,
  ];
  addLine(lines, "Contracting setup", labelFromOptions(draft.projectRole, PROJECT_ROLE_OPTIONS));
  addLine(lines, scopes.length === 1 ? "Related planner" : "Related planners", scopes.join(", "));
  addLine(lines, "Desired timing", draft.timing);
  if (draft.building.included) {
    const buildingRequest = buildBuildingPlannerRequest(draft.building.planner);
    addLine(
      lines,
      "Metal building planner",
      buildingRequest
        ? `${buildingRequest.use}; ${buildingRequest.structuralSystem}; ${buildingRequest.shell}; ${buildingRequest.roof}; scene ${buildingRequest.sceneFingerprint}`
        : "Incomplete — no measured metal-building geometry attached"
    );
  }
  if (draft.countertops.included) {
    const stone = getCatalogItemById(draft.countertops.stoneId);
    const measurementStatus = draft.countertops.measurementsReviewed
      ? `reviewed gross footprint about ${calculateCountertopSquareFeet(draft.countertops)} sq. ft.`
      : "surface dimensions unreviewed";
    addLine(
      lines,
      "Countertop details",
      `${draft.countertops.room}; ${stone ? `${stone.publicLabel}${stone.materialLabel ? ` — ${stone.materialLabel}` : ""}` : "surface not selected"}; ${measurementStatus}`
    );
  }
  if (draft.cabinets.included) {
    addLine(
      lines,
      "Cabinet planner",
      isCabinetPlannerRequestReady(draft.cabinets.planner)
        ? buildCabinetPlannerRequestBrief(draft.cabinets.planner)
        : "Incomplete — no reviewed cabinet geometry attached"
    );
  }
  addLine(lines, "Local trade notes", briefNote(draft.labor.notes));

  return updateRequestHref(
    baseHref,
    {
      source: STEEL_HOME_PACKAGES_LABOR_REQUEST_SOURCE,
      subject: "service",
      title: draft.labor.trades.length
        ? `TradeScout Local Trade Request — ${draft.labor.trades.join(", ")}`
        : "TradeScout Local Trade Request",
      description: lines.join("\n"),
      location: draft.location,
      county: draft.countyFips,
      state: draft.stateCode,
      when: draft.timing,
    },
    DIRECT_CONNECT_COMPETING_CONTEXT_KEYS
  );
}

export function getSteelHomeProjectReadiness(draftInput: SteelHomeProjectDraft) {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const scopes = getIncludedProjectScopes(draft);
  const buildingReadiness = getBuildingPlannerRequestReadiness(draft.building.planner);
  const hasProjectScope = scopes.length > 0;
  const hasProjectRole = Boolean(draft.projectRole);
  const hasRoutingLocation =
    draft.location.length >= 2 &&
    /^[A-Z]{2}$/.test(draft.stateCode) &&
    /^\d{5}$/.test(draft.countyFips);
  return {
    projectReady:
      hasRoutingLocation &&
      hasProjectRole &&
      hasProjectScope &&
      (!draft.building.included || buildingReadiness.requestReady) &&
      (!draft.cabinets.included || isCabinetPlannerRequestReady(draft.cabinets.planner)),
    laborReady: hasRoutingLocation && draft.labor.trades.length > 0,
    needsLocation: !hasRoutingLocation,
    needsRole: !hasProjectRole,
    needsDesign: !hasProjectScope,
    needsLabor: draft.labor.trades.length === 0,
    buildingProblems: draft.building.included
      ? buildingReadiness.blockers.map((blocker) => blocker.message)
      : [],
    includedScopes: scopes,
    additionalScopeLabels: getAdditionalProjectScopeLabels(draft),
  };
}
