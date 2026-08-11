import {
  JW_STONE_NAMED_IDS,
  getCatalogItemById,
} from "@/features/jw-stone/catalog";

export const STEEL_HOME_PACKAGE_DRAFT_VERSION = 1 as const;
export const STEEL_HOME_PACKAGE_DRAFT_STORAGE_KEY =
  "tradescout:steel-home-studio:package-draft:v1";

export const STEEL_HOME_FEATURED_STONE_IDS = [
  "cristallo",
  "taj-mahal",
  "amazonic-green",
  "blue-goias",
  "rhino-white",
  "gold-macaubas",
] as const;

export const STEEL_HOME_PACKAGE_OPTIONS = [
  { value: "structure", label: "Metal structure" },
  { value: "stone", label: "Natural stone" },
  { value: "cabinets", label: "Cabinets" },
] as const;

export const STEEL_HOME_STARTING_POINT_OPTIONS = [
  { value: "idea", label: "I have an idea" },
  { value: "plans", label: "I have plans" },
  { value: "three-d", label: "I have a 3D concept" },
  { value: "sketch", label: "I have a sketch or photos" },
] as const;

export const STEEL_HOME_TIMING_OPTIONS = [
  "As soon as practical",
  "Within 3 months",
  "Within 6 months",
  "Within 12 months",
  "Planning ahead",
] as const;

export const STEEL_HOME_STRUCTURE_FOOTPRINT_OPTIONS = [
  "Home only",
  "Home with garage",
  "Home with shop",
  "Home with garage and shop",
  "Not sure yet",
] as const;

export const STEEL_HOME_STRUCTURE_ROOFLINE_OPTIONS = [
  "Classic gable",
  "Monitor roof",
  "Single-slope modern",
  "Mixed rooflines",
  "Not sure yet",
] as const;

export const STEEL_HOME_STRUCTURE_LEVEL_OPTIONS = [
  "One level",
  "One level with loft",
  "Two levels",
  "Not sure yet",
] as const;

export const STEEL_HOME_STONE_ROOM_OPTIONS = [
  "Kitchen",
  "Bathrooms",
  "Fireplace",
  "Feature walls",
  "Floors",
  "Outdoor living",
] as const;

export const STEEL_HOME_STONE_DIRECTION_OPTIONS = [
  "Soft and light",
  "Warm and earthy",
  "Cool and calm",
  "Deep and dramatic",
  "Bold and expressive",
  "Show me options",
] as const;

export const STEEL_HOME_CABINET_ROOM_OPTIONS = [
  "Kitchen",
  "Island",
  "Pantry",
  "Primary bathroom",
  "Other bathrooms",
  "Laundry",
  "Built-ins and storage",
] as const;

export const STEEL_HOME_CABINET_FINISH_OPTIONS = [
  "Warm natural wood",
  "Light painted",
  "Two-tone",
  "Dark modern",
  "Show me options",
] as const;

export const STEEL_HOME_CABINET_STAGE_OPTIONS = [
  "Design from my plans",
  "Quote an existing cabinet schedule",
  "Help me measure and plan",
  "Early idea stage",
] as const;

export const STEEL_HOME_LABOR_TRADE_OPTIONS = [
  "Site work",
  "Foundation",
  "Steel erection",
  "Stone fabrication",
  "Stone installation",
  "Cabinet installation",
  "Other construction work",
] as const;

export type SteelHomePackageKey = (typeof STEEL_HOME_PACKAGE_OPTIONS)[number]["value"];
export type SteelHomeStartingPoint =
  | ""
  | (typeof STEEL_HOME_STARTING_POINT_OPTIONS)[number]["value"];

export type SteelHomePackageDraft = {
  version: typeof STEEL_HOME_PACKAGE_DRAFT_VERSION;
  location: string;
  timing: string;
  startingPoint: SteelHomeStartingPoint;
  packages: SteelHomePackageKey[];
  structure: {
    footprint: string;
    roofline: string;
    levels: string;
    sizeEstimate: string;
    notes: string;
  };
  stone: {
    roomUses: string[];
    direction: string;
    stoneIds: string[];
    notes: string;
  };
  cabinets: {
    rooms: string[];
    finishDirection: string;
    designStage: string;
    notes: string;
  };
  labor: {
    trades: string[];
    notes: string;
  };
};

export type SteelHomeDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PACKAGE_KEYS = new Set(STEEL_HOME_PACKAGE_OPTIONS.map((option) => option.value));
const STARTING_POINT_KEYS = new Set(
  STEEL_HOME_STARTING_POINT_OPTIONS.map((option) => option.value)
);

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanAllowedStrings(
  value: unknown,
  allowed: readonly string[],
  maxItems = allowed.length
): string[] {
  if (!Array.isArray(value)) return [];
  const allowedSet = new Set(allowed);
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => allowedSet.has(item))
    )
  ).slice(0, maxItems);
}

function cleanPackageKeys(value: unknown): SteelHomePackageKey[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (item): item is SteelHomePackageKey =>
          typeof item === "string" && PACKAGE_KEYS.has(item as SteelHomePackageKey)
      )
    )
  );
}

export function createEmptySteelHomePackageDraft(): SteelHomePackageDraft {
  return {
    version: STEEL_HOME_PACKAGE_DRAFT_VERSION,
    location: "",
    timing: "",
    startingPoint: "",
    packages: [],
    structure: {
      footprint: "",
      roofline: "",
      levels: "",
      sizeEstimate: "",
      notes: "",
    },
    stone: {
      roomUses: [],
      direction: "",
      stoneIds: [],
      notes: "",
    },
    cabinets: {
      rooms: [],
      finishDirection: "",
      designStage: "",
      notes: "",
    },
    labor: {
      trades: [],
      notes: "",
    },
  };
}

export function reconcileSteelHomePackageDraft(value: unknown): SteelHomePackageDraft {
  const empty = createEmptySteelHomePackageDraft();
  if (!value || typeof value !== "object") return empty;

  const candidate = value as Partial<SteelHomePackageDraft>;
  const structure = candidate.structure || empty.structure;
  const stone = candidate.stone || empty.stone;
  const cabinets = candidate.cabinets || empty.cabinets;
  const labor = candidate.labor || empty.labor;
  const startingPoint =
    typeof candidate.startingPoint === "string" &&
    STARTING_POINT_KEYS.has(candidate.startingPoint as Exclude<SteelHomeStartingPoint, "">)
      ? (candidate.startingPoint as SteelHomeStartingPoint)
      : "";

  return {
    version: STEEL_HOME_PACKAGE_DRAFT_VERSION,
    location: cleanText(candidate.location, 160),
    timing: cleanAllowedStrings(
      [candidate.timing],
      STEEL_HOME_TIMING_OPTIONS
    )[0] || "",
    startingPoint,
    packages: cleanPackageKeys(candidate.packages),
    structure: {
      footprint:
        cleanAllowedStrings(
          [structure.footprint],
          STEEL_HOME_STRUCTURE_FOOTPRINT_OPTIONS
        )[0] || "",
      roofline:
        cleanAllowedStrings([structure.roofline], STEEL_HOME_STRUCTURE_ROOFLINE_OPTIONS)[0] ||
        "",
      levels:
        cleanAllowedStrings([structure.levels], STEEL_HOME_STRUCTURE_LEVEL_OPTIONS)[0] || "",
      sizeEstimate: cleanText(structure.sizeEstimate, 80),
      notes: cleanText(structure.notes, 400),
    },
    stone: {
      roomUses: cleanAllowedStrings(stone.roomUses, STEEL_HOME_STONE_ROOM_OPTIONS),
      direction:
        cleanAllowedStrings([stone.direction], STEEL_HOME_STONE_DIRECTION_OPTIONS)[0] || "",
      stoneIds: Array.isArray(stone.stoneIds)
        ? Array.from(
            new Set(
              stone.stoneIds.filter(
                (item): item is string => typeof item === "string" && JW_STONE_NAMED_IDS.has(item)
              )
            )
          ).slice(0, 12)
        : [],
      notes: cleanText(stone.notes, 400),
    },
    cabinets: {
      rooms: cleanAllowedStrings(cabinets.rooms, STEEL_HOME_CABINET_ROOM_OPTIONS),
      finishDirection:
        cleanAllowedStrings(
          [cabinets.finishDirection],
          STEEL_HOME_CABINET_FINISH_OPTIONS
        )[0] || "",
      designStage:
        cleanAllowedStrings([cabinets.designStage], STEEL_HOME_CABINET_STAGE_OPTIONS)[0] || "",
      notes: cleanText(cabinets.notes, 400),
    },
    labor: {
      trades: cleanAllowedStrings(labor.trades, STEEL_HOME_LABOR_TRADE_OPTIONS),
      notes: cleanText(labor.notes, 400),
    },
  };
}

export function loadSteelHomePackageDraft(
  storage: SteelHomeDraftStorage | null | undefined
): SteelHomePackageDraft {
  if (!storage) return createEmptySteelHomePackageDraft();
  try {
    const raw = storage.getItem(STEEL_HOME_PACKAGE_DRAFT_STORAGE_KEY);
    if (!raw) return createEmptySteelHomePackageDraft();
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (parsed?.version !== STEEL_HOME_PACKAGE_DRAFT_VERSION) return createEmptySteelHomePackageDraft();
    return reconcileSteelHomePackageDraft(parsed);
  } catch {
    try {
      storage.removeItem(STEEL_HOME_PACKAGE_DRAFT_STORAGE_KEY);
    } catch {
      // The in-memory builder remains usable when browser storage is blocked.
    }
    return createEmptySteelHomePackageDraft();
  }
}

export function saveSteelHomePackageDraft(
  storage: SteelHomeDraftStorage | null | undefined,
  draft: SteelHomePackageDraft
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      STEEL_HOME_PACKAGE_DRAFT_STORAGE_KEY,
      JSON.stringify(reconcileSteelHomePackageDraft(draft))
    );
    return true;
  } catch {
    return false;
  }
}

export function clearSteelHomePackageDraft(
  storage: SteelHomeDraftStorage | null | undefined
): void {
  if (!storage) return;
  try {
    storage.removeItem(STEEL_HOME_PACKAGE_DRAFT_STORAGE_KEY);
  } catch {
    // Clearing the in-memory draft still works when browser storage is blocked.
  }
}

export function toggleDraftValue(values: readonly string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function labelForStartingPoint(value: SteelHomeStartingPoint): string {
  return (
    STEEL_HOME_STARTING_POINT_OPTIONS.find((option) => option.value === value)?.label ||
    "Not selected"
  );
}

function labelForPackage(value: SteelHomePackageKey): string {
  return STEEL_HOME_PACKAGE_OPTIONS.find((option) => option.value === value)?.label || value;
}

function addLine(lines: string[], label: string, value: string | readonly string[]) {
  const normalized = Array.isArray(value) ? value.filter(Boolean).join(", ") : String(value || "");
  if (normalized) lines.push(`${label}: ${normalized}`);
}

export function buildSteelHomePackageDescription(draftInput: SteelHomePackageDraft): string {
  const draft = reconcileSteelHomePackageDraft(draftInput);
  const lines = [
    "TradeScout Steel Home Studio package builder",
    `Project location: ${draft.location || "Not entered yet"}`,
    `Starting point: ${labelForStartingPoint(draft.startingPoint)}`,
    `Package requested: ${draft.packages.map(labelForPackage).join(", ") || "Not selected"}`,
  ];
  addLine(lines, "Desired timing", draft.timing);

  if (draft.packages.includes("structure")) {
    lines.push("", "METAL STRUCTURE");
    addLine(lines, "Building arrangement", draft.structure.footprint);
    addLine(lines, "Estimated size", draft.structure.sizeEstimate);
    addLine(lines, "Roofline", draft.structure.roofline);
    addLine(lines, "Levels", draft.structure.levels);
    addLine(lines, "Structure notes", draft.structure.notes);
  }

  if (draft.packages.includes("stone")) {
    lines.push("", "NATURAL STONE");
    addLine(lines, "Rooms and uses", draft.stone.roomUses);
    addLine(lines, "Color direction", draft.stone.direction);
    addLine(
      lines,
      "Stone shortlist",
      draft.stone.stoneIds
        .map((id) => getCatalogItemById(id)?.displayName || "")
        .filter(Boolean)
    );
    addLine(lines, "Stone notes", draft.stone.notes);
  }

  if (draft.packages.includes("cabinets")) {
    lines.push("", "CABINETS");
    addLine(lines, "Rooms", draft.cabinets.rooms);
    addLine(lines, "Finish direction", draft.cabinets.finishDirection);
    addLine(lines, "Design starting point", draft.cabinets.designStage);
    addLine(lines, "Cabinet notes", draft.cabinets.notes);
  }

  if (draft.labor.trades.length > 0 || draft.labor.notes) {
    lines.push("", "LOCAL LABOR ALSO NEEDED");
    addLine(lines, "Labor types", draft.labor.trades);
    addLine(lines, "Labor notes", draft.labor.notes);
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

export function buildSteelHomePackageRequestHref(
  baseHref: string,
  draftInput: SteelHomePackageDraft
): string {
  const draft = reconcileSteelHomePackageDraft(draftInput);
  const packageLabels = draft.packages.map(labelForPackage);
  return updateRequestHref(
    baseHref,
    {
      source: "steel_home_package_builder",
      subject: "product",
      title: packageLabels.length
        ? `Steel home package: ${packageLabels.join(" + ")}`
        : "Steel home material package",
      description: buildSteelHomePackageDescription(draft),
      location: draft.location,
      when: draft.timing,
    },
    ["intent"]
  );
}

export function buildSteelHomeLaborRequestHref(
  baseHref: string,
  draftInput: SteelHomePackageDraft
): string {
  const draft = reconcileSteelHomePackageDraft(draftInput);
  const selectedPackages = draft.packages.map(labelForPackage);
  const lines = [
    "TradeScout Steel Home Studio local labor request",
    `Project location: ${draft.location || "Not entered yet"}`,
    `Labor needed: ${draft.labor.trades.join(", ") || "Not selected"}`,
  ];
  addLine(lines, "Material package involved", selectedPackages);
  addLine(lines, "Desired timing", draft.timing);
  addLine(lines, "Starting point", labelForStartingPoint(draft.startingPoint));
  addLine(lines, "Labor notes", draft.labor.notes);

  return updateRequestHref(
    baseHref,
    {
      source: "steel_home_package_builder_labor",
      subject: "service",
      title: draft.labor.trades.length
        ? `Steel-home labor: ${draft.labor.trades.join(", ")}`
        : "Steel-home labor or installation request",
      description: lines.join("\n"),
      location: draft.location,
      when: draft.timing,
    },
    ["intent", "profile", "profileName", "target", "targetProviderId", "contractorId"]
  );
}

export function getSteelHomeDraftReadiness(draftInput: SteelHomePackageDraft) {
  const draft = reconcileSteelHomePackageDraft(draftInput);
  return {
    packageReady: draft.location.length >= 2 && draft.packages.length > 0,
    laborReady: draft.location.length >= 2 && draft.labor.trades.length > 0,
    needsPackage: draft.packages.length === 0,
    needsLabor: draft.labor.trades.length === 0,
    needsLocation: draft.location.length < 2,
  };
}
