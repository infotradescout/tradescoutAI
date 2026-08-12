import { JW_STONE_NAMED_IDS, getCatalogItemById } from "@/features/jw-stone/catalog";
import { getCountyByFips } from "@shared/states-counties";
import { buildStoneDesignerImageHref } from "./stoneDesignerImages";

export const STEEL_HOME_PROJECT_DRAFT_VERSION = 3 as const;
export const STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY = "tradescout:steel-home-project-tools:draft:v3";

export const PROJECT_TIMING_OPTIONS = [
  "As soon as practical",
  "Within 3 months",
  "Within 6 months",
  "Within 12 months",
  "Planning ahead",
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
  "Eased",
  "Beveled",
  "Half bullnose",
  "Full bullnose",
  "Mitered",
] as const;

export const COUNTERTOP_BACKSPLASH_OPTIONS = ["None", "4-inch", "Full-height"] as const;
export const COUNTERTOP_SINK_OPTIONS = [
  "None",
  "Single-bowl undermount",
  "Double-bowl undermount",
  "Farmhouse",
] as const;
export const COUNTERTOP_COOKTOP_OPTIONS = ["None", "30-inch", "36-inch", "48-inch"] as const;

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
export type CabinetLayout = (typeof CABINET_LAYOUT_OPTIONS)[number]["value"];
export type BuildingColor = (typeof BUILDING_COLOR_OPTIONS)[number]["value"];
export type CabinetFinish = (typeof CABINET_FINISH_OPTIONS)[number]["value"];

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
};

export type SteelHomeCountertopDesign = {
  included: boolean;
  room: (typeof COUNTERTOP_ROOM_OPTIONS)[number];
  layout: CountertopLayout;
  wallAIn: number;
  wallBIn: number;
  wallCIn: number;
  island: boolean;
  islandLengthIn: number;
  islandWidthIn: number;
  stoneId: string;
  edge: (typeof COUNTERTOP_EDGE_OPTIONS)[number];
  backsplash: (typeof COUNTERTOP_BACKSPLASH_OPTIONS)[number];
  sink: (typeof COUNTERTOP_SINK_OPTIONS)[number];
  cooktop: (typeof COUNTERTOP_COOKTOP_OPTIONS)[number];
  notes: string;
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
};

export type SteelHomeProjectDraft = {
  version: typeof STEEL_HOME_PROJECT_DRAFT_VERSION;
  location: string;
  stateCode: string;
  countyFips: string;
  countyName: string;
  timing: string;
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
const CABINET_LAYOUTS = setFromValues(CABINET_LAYOUT_OPTIONS.map((item) => item.value));
const CABINET_FINISHES = setFromValues(CABINET_FINISH_OPTIONS.map((item) => item.value));

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

function cleanAllowedStrings(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const allowedSet = new Set(allowed);
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => allowedSet.has(item))
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
    },
    countertops: {
      included: false,
      room: "Kitchen",
      layout: "l-shape",
      wallAIn: 120,
      wallBIn: 96,
      wallCIn: 96,
      island: true,
      islandLengthIn: 84,
      islandWidthIn: 42,
      stoneId: "cristallo",
      edge: "Eased",
      backsplash: "4-inch",
      sink: "Single-bowl undermount",
      cooktop: "36-inch",
      notes: "",
    },
    cabinets: {
      included: false,
      room: "Kitchen",
      layout: "l-shape",
      primaryWallIn: 144,
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
  const requestedCountyFips = cleanText(candidate.countyFips, 5);
  const requestedStateCode = cleanText(candidate.stateCode, 2).toUpperCase();
  const canonicalCounty = /^\d{5}$/.test(requestedCountyFips)
    ? getCountyByFips(requestedCountyFips)
    : undefined;

  return {
    version: STEEL_HOME_PROJECT_DRAFT_VERSION,
    location: cleanText(candidate.location, 160),
    stateCode:
      canonicalCounty?.state || (/^[A-Z]{2}$/.test(requestedStateCode) ? requestedStateCode : ""),
    countyFips: canonicalCounty?.fipsCode || "",
    countyName: canonicalCounty?.name || "",
    timing: cleanLabel(candidate.timing, PROJECT_TIMING_OPTIONS, ""),
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
    },
    countertops: {
      included: countertops.included === true,
      room: cleanLabel(countertops.room, COUNTERTOP_ROOM_OPTIONS, empty.countertops.room),
      layout: cleanEnum(countertops.layout, COUNTERTOP_LAYOUTS, empty.countertops.layout),
      wallAIn: cleanNumber(countertops.wallAIn, empty.countertops.wallAIn, 24, 360),
      wallBIn: cleanNumber(countertops.wallBIn, empty.countertops.wallBIn, 24, 360),
      wallCIn: cleanNumber(countertops.wallCIn, empty.countertops.wallCIn, 24, 360),
      island: countertops.island === true,
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
      edge: cleanLabel(countertops.edge, COUNTERTOP_EDGE_OPTIONS, empty.countertops.edge),
      backsplash: cleanLabel(
        countertops.backsplash,
        COUNTERTOP_BACKSPLASH_OPTIONS,
        empty.countertops.backsplash
      ),
      sink: cleanLabel(countertops.sink, COUNTERTOP_SINK_OPTIONS, empty.countertops.sink),
      cooktop: cleanLabel(
        countertops.cooktop,
        COUNTERTOP_COOKTOP_OPTIONS,
        empty.countertops.cooktop
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
    },
    labor: {
      trades: cleanAllowedStrings(labor.trades, LOCAL_LABOR_OPTIONS),
      notes: cleanText(labor.notes, 240),
    },
  };
}

export function loadSteelHomeProjectDraft(
  storage: SteelHomeProjectStorage | null | undefined
): SteelHomeProjectDraft {
  if (!storage) return createEmptySteelHomeProjectDraft();
  try {
    const raw = storage.getItem(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY);
    if (!raw) return createEmptySteelHomeProjectDraft();
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (parsed.version !== STEEL_HOME_PROJECT_DRAFT_VERSION) {
      return createEmptySteelHomeProjectDraft();
    }
    return reconcileSteelHomeProjectDraft(parsed);
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
  } catch {
    // Clearing the in-memory state is still sufficient for the current session.
  }
}

export function calculateCountertopSquareFeet(designInput: SteelHomeCountertopDesign): number {
  const design = reconcileSteelHomeProjectDraft({ countertops: designInput }).countertops;
  const depth = 25.5;
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

function labelFromOptions(
  value: string,
  options: readonly { value: string; label: string }[]
): string {
  return options.find((option) => option.value === value)?.label || value;
}

function colorLabel(value: BuildingColor): string {
  return labelFromOptions(value, BUILDING_COLOR_OPTIONS);
}

function briefNote(value: string): string {
  return cleanText(value, 120);
}

function addLine(lines: string[], label: string, value: unknown) {
  const normalized = String(value ?? "").trim();
  if (normalized) lines.push(`${label}: ${normalized}`);
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
    draft.building.included ? "Building" : "",
    draft.countertops.included ? "Countertops" : "",
    draft.cabinets.included ? "Cabinets" : "",
  ].filter(Boolean);
}

export function buildSteelHomeProjectDescription(draftInput: SteelHomeProjectDraft): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const scopes = getIncludedProjectScopes(draft);
  const lines = [
    "TRADESCOUT STEEL-HOME PROJECT BRIEF",
    `Project location: ${formatSteelHomeProjectLocation(draft)}`,
    `Designs ready for review: ${scopes.join(", ") || "None selected"}`,
  ];
  addLine(lines, "Desired timing", draft.timing);

  if (draft.building.included) {
    const building = draft.building;
    lines.push("", "BUILDING CONCEPT");
    addLine(lines, "Use", labelFromOptions(building.use, BUILDING_USE_OPTIONS));
    addLine(
      lines,
      "Dimensions",
      `${building.widthFt}' wide × ${building.lengthFt}' long × ${building.eaveHeightFt}' eave`
    );
    addLine(
      lines,
      "Roof",
      `${labelFromOptions(building.roofStyle, BUILDING_ROOF_OPTIONS)}, ${building.roofPitch}`
    );
    addLine(
      lines,
      "Openings",
      `${building.garageDoors} garage, ${building.walkDoors} walk door, ${building.windows} windows`
    );
    addLine(
      lines,
      "Porch",
      building.porch === "none"
        ? "None"
        : `${labelFromOptions(building.porch, BUILDING_PORCH_OPTIONS)}, ${building.porchDepthFt}' deep`
    );
    addLine(
      lines,
      "Exterior colors",
      `walls ${colorLabel(building.wallColor)}; roof ${colorLabel(building.roofColor)}; trim ${colorLabel(building.trimColor)}`
    );
    addLine(lines, "Notes", briefNote(building.notes));
  }

  if (draft.countertops.included) {
    const countertops = draft.countertops;
    const stone = getCatalogItemById(countertops.stoneId);
    lines.push("", "COUNTERTOP CONCEPT");
    addLine(
      lines,
      "Room and layout",
      `${countertops.room}, ${labelFromOptions(countertops.layout, COUNTERTOP_LAYOUT_OPTIONS)}`
    );
    const runs = [countertops.wallAIn];
    if (countertops.layout !== "straight") runs.push(countertops.wallBIn);
    if (countertops.layout === "u-shape") runs.push(countertops.wallCIn);
    addLine(lines, "Wall runs", runs.map((value) => `${value}\"`).join(" × "));
    addLine(
      lines,
      "Island",
      countertops.island
        ? `${countertops.islandLengthIn}\" × ${countertops.islandWidthIn}\"`
        : "None"
    );
    addLine(
      lines,
      "Selected real stone",
      stone ? `${stone.publicLabel}${stone.materialLabel ? ` — ${stone.materialLabel}` : ""}` : ""
    );
    addLine(lines, "Stone record", stone?.id || "");
    addLine(lines, "Stone image", stone ? buildStoneDesignerImageHref(stone.id) : "");
    addLine(
      lines,
      "Details",
      `${countertops.edge} edge; ${countertops.backsplash} backsplash; ${countertops.sink} sink; ${countertops.cooktop} cooktop`
    );
    addLine(
      lines,
      "Planning area",
      `${calculateCountertopSquareFeet(countertops)} sq. ft. approximate`
    );
    addLine(lines, "Notes", briefNote(countertops.notes));
  }

  if (draft.cabinets.included) {
    const cabinets = draft.cabinets;
    const finish = labelFromOptions(cabinets.finish, CABINET_FINISH_OPTIONS);
    const plannedWidth = calculateCabinetPlannedWidth(cabinets);
    lines.push("", "CABINET CONCEPT");
    addLine(
      lines,
      "Room and layout",
      `${cabinets.room}, ${labelFromOptions(cabinets.layout, CABINET_LAYOUT_OPTIONS)}`
    );
    addLine(
      lines,
      "Room dimensions",
      `${cabinets.primaryWallIn}\" primary wall; ${cabinets.returnWallIn}\" return; ${cabinets.ceilingHeightIn}\" ceiling`
    );
    addLine(lines, "Style", `${cabinets.doorStyle}; ${finish}; ${cabinets.hardware}`);
    addLine(
      lines,
      "Major modules",
      `${cabinets.refrigeratorWidthIn}\" refrigerator; ${cabinets.rangeWidthIn}\" range; ${cabinets.sinkBaseWidthIn}\" sink base; ${cabinets.pantryCount} pantry; ${cabinets.drawerBaseCount} drawer base`
    );
    addLine(lines, "Upper cabinets", `${cabinets.upperHeightIn}\" high`);
    addLine(
      lines,
      "Island",
      cabinets.island ? `${cabinets.islandLengthIn}\" × ${cabinets.islandWidthIn}\"` : "None"
    );
    addLine(
      lines,
      "Planned primary-wall modules",
      `${plannedWidth}\" of ${cabinets.primaryWallIn}\"`
    );
    addLine(lines, "Notes", briefNote(cabinets.notes));
  }

  lines.push(
    "",
    "Customer-created concept. Final field measurements, engineering, code requirements, product specifications, availability, delivery, fabrication, and installation scope must be confirmed before approval."
  );
  return lines.join("\n").slice(0, 2000);
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

export function buildSteelHomeProjectRequestHref(
  baseHref: string,
  draftInput: SteelHomeProjectDraft
): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const scopes = getIncludedProjectScopes(draft);
  return updateRequestHref(
    baseHref,
    {
      profile: "steel-home-packages",
      profileName: "TradeScout project desk",
      source: "steel_home_project_tools",
      subject: "product",
      title: scopes.length
        ? `Steel-home design review: ${scopes.join(" + ")}`
        : "Steel-home design review",
      description: buildSteelHomeProjectDescription(draft),
      location: draft.location,
      county: draft.countyFips,
      state: draft.stateCode,
      when: draft.timing,
    },
    ["intent", "target", "targetProviderId", "contractorId", "prefill_businessSlug"]
  );
}

export function buildSteelHomeLaborRequestHref(
  baseHref: string,
  draftInput: SteelHomeProjectDraft
): string {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const scopes = getIncludedProjectScopes(draft);
  const lines = [
    "TRADESCOUT STEEL-HOME LOCAL LABOR BRIEF",
    `Project location: ${formatSteelHomeProjectLocation(draft)}`,
    `Labor needed: ${draft.labor.trades.join(", ") || "Not selected"}`,
  ];
  addLine(lines, "Related saved designs", scopes.join(", "));
  addLine(lines, "Desired timing", draft.timing);
  if (draft.building.included) {
    addLine(
      lines,
      "Building concept",
      `${draft.building.widthFt}' × ${draft.building.lengthFt}' × ${draft.building.eaveHeightFt}' eave; ${labelFromOptions(draft.building.roofStyle, BUILDING_ROOF_OPTIONS)}`
    );
  }
  if (draft.countertops.included) {
    const stone = getCatalogItemById(draft.countertops.stoneId);
    addLine(
      lines,
      "Countertop concept",
      `${draft.countertops.room}; ${stone?.publicLabel || "stone selected"}${stone ? ` (${stone.id})` : ""}; ${calculateCountertopSquareFeet(draft.countertops)} sq. ft. approximate`
    );
  }
  if (draft.cabinets.included) {
    addLine(
      lines,
      "Cabinet concept",
      `${draft.cabinets.room}; ${labelFromOptions(draft.cabinets.layout, CABINET_LAYOUT_OPTIONS)}; ${draft.cabinets.primaryWallIn}\" primary wall`
    );
  }
  addLine(lines, "Labor notes", briefNote(draft.labor.notes));

  return updateRequestHref(
    baseHref,
    {
      source: "steel_home_project_tools_labor",
      subject: "service",
      title: draft.labor.trades.length
        ? `Steel-home labor: ${draft.labor.trades.join(", ")}`
        : "Steel-home local labor request",
      description: lines.join("\n").slice(0, 2000),
      location: draft.location,
      county: draft.countyFips,
      state: draft.stateCode,
      when: draft.timing,
    },
    [
      "intent",
      "profile",
      "profileName",
      "target",
      "targetName",
      "targetProviderId",
      "contractorId",
      "prefill_businessSlug",
    ]
  );
}

export function getSteelHomeProjectReadiness(draftInput: SteelHomeProjectDraft) {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  const scopes = getIncludedProjectScopes(draft);
  const hasRoutingLocation =
    draft.location.length >= 2 &&
    /^[A-Z]{2}$/.test(draft.stateCode) &&
    /^\d{5}$/.test(draft.countyFips);
  return {
    projectReady: hasRoutingLocation && scopes.length > 0,
    laborReady: hasRoutingLocation && draft.labor.trades.length > 0,
    needsLocation: !hasRoutingLocation,
    needsDesign: scopes.length === 0,
    needsLabor: draft.labor.trades.length === 0,
    includedScopes: scopes,
  };
}
