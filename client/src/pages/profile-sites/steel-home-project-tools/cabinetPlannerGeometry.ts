import type { SteelHomeCabinetDesign } from "./projectModel";

export const CABINET_PLANNER_EXTENSION_VERSION = 1 as const;
export const CABINET_PLANNER_GRID_IN = 0.125 as const;

export const CABINET_PLANNER_STARTS = [
  { value: "kitchen", label: "Kitchen", description: "Cabinets, appliances, and islands." },
  {
    value: "bathroom-vanity",
    label: "Bathroom Vanity",
    description: "Vanities, tall storage, and measured utilities.",
  },
  { value: "laundry", label: "Laundry", description: "Storage around laundry equipment." },
  { value: "pantry", label: "Pantry", description: "Tall and wall-mounted storage." },
  { value: "built-in", label: "Built-in", description: "Measured casework for another room." },
  { value: "blank", label: "Blank", description: "An empty measured room with no assumptions." },
] as const;

export type CabinetPlannerStart = (typeof CABINET_PLANNER_STARTS)[number]["value"];
export type CabinetWallId = "north" | "east" | "south" | "west";
export type CabinetPlacementSurface = CabinetWallId | "floor";
export type CabinetPlannerView = "plan" | "elevations" | "3d";
export type CabinetModuleKind =
  | "base-cabinet"
  | "wall-cabinet"
  | "tall-cabinet"
  | "appliance"
  | "island";
export type CabinetShellItemKind =
  | "door"
  | "window"
  | "obstacle"
  | "water"
  | "drain"
  | "electric"
  | "vent";

export type CabinetRoomShell = {
  widthIn: number | null;
  depthIn: number | null;
  heightIn: number | null;
  measurementsReviewed: boolean;
};

export type CabinetShellItem = {
  id: string;
  kind: CabinetShellItemKind;
  label: string;
  wall: CabinetWallId;
  offsetIn: number;
  widthIn: number;
  heightIn: number;
  elevationIn: number;
  depthIn: number;
};

export type CabinetPlannerModule = {
  id: string;
  kind: CabinetModuleKind;
  label: string;
  surface: CabinetPlacementSurface;
  /** Distance from the named wall's canonical start, or X in the room for floor modules. */
  offsetIn: number;
  /** Y in the room for floor modules. Wall modules always derive their depth from the wall. */
  roomDepthOffsetIn: number;
  widthIn: number;
  depthIn: number;
  heightIn: number;
  elevationIn: number;
};

export type CabinetPlannerExtensionV1 = {
  version: typeof CABINET_PLANNER_EXTENSION_VERSION;
  starter: CabinetPlannerStart | null;
  shell: CabinetRoomShell;
  shellItems: CabinetShellItem[];
  modules: CabinetPlannerModule[];
  selectedModuleId: string | null;
  view: CabinetPlannerView;
  activeElevationWall: CabinetWallId;
  notes: string;
};

export type CabinetPlannerDiagnosticCode =
  | "missing-shell"
  | "unreviewed-measurements"
  | "empty-plan"
  | "shell-item-outside-wall"
  | "module-outside-room"
  | "module-collision"
  | "blocked-opening";

export type CabinetPlannerDiagnostic = {
  code: CabinetPlannerDiagnosticCode;
  severity: "error";
  message: string;
  objectIds: string[];
};

export type CabinetModuleBounds = {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  z1: number;
  z2: number;
};

const START_VALUES = new Set<CabinetPlannerStart>(CABINET_PLANNER_STARTS.map((item) => item.value));
const WALL_VALUES = new Set<CabinetWallId>(["north", "east", "south", "west"]);
const SURFACE_VALUES = new Set<CabinetPlacementSurface>([
  "north",
  "east",
  "south",
  "west",
  "floor",
]);
const VIEW_VALUES = new Set<CabinetPlannerView>(["plan", "elevations", "3d"]);
const MODULE_VALUES = new Set<CabinetModuleKind>([
  "base-cabinet",
  "wall-cabinet",
  "tall-cabinet",
  "appliance",
  "island",
]);
const SHELL_ITEM_VALUES = new Set<CabinetShellItemKind>([
  "door",
  "window",
  "obstacle",
  "water",
  "drain",
  "electric",
  "vent",
]);

export function snapCabinetInches(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number((Math.round(value / CABINET_PLANNER_GRID_IN) * CABINET_PLANNER_GRID_IN).toFixed(3));
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : fallback;
}

function cleanDimension(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return snapCabinetInches(Math.min(maximum, Math.max(minimum, parsed)));
}

function cleanOptionalDimension(value: unknown, minimum: number, maximum: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return snapCabinetInches(Math.min(maximum, Math.max(minimum, parsed)));
}

export function createBlankCabinetPlannerExtension(): CabinetPlannerExtensionV1 {
  return {
    version: CABINET_PLANNER_EXTENSION_VERSION,
    starter: null,
    shell: {
      widthIn: null,
      depthIn: null,
      heightIn: null,
      measurementsReviewed: false,
    },
    shellItems: [],
    modules: [],
    selectedModuleId: null,
    view: "plan",
    activeElevationWall: "north",
    notes: "",
  };
}

export function applyCabinetPlannerStart(
  current: CabinetPlannerExtensionV1,
  starter: CabinetPlannerStart
): CabinetPlannerExtensionV1 {
  return {
    ...createBlankCabinetPlannerExtension(),
    starter,
    notes: current.notes,
  };
}

export function createCabinetPlannerModule(
  kind: CabinetModuleKind,
  id: string
): CabinetPlannerModule {
  const definition: Record<
    CabinetModuleKind,
    Omit<CabinetPlannerModule, "id" | "kind" | "offsetIn" | "roomDepthOffsetIn">
  > = {
    "base-cabinet": {
      label: "Base cabinet",
      surface: "north",
      widthIn: 30,
      depthIn: 24,
      heightIn: 34.5,
      elevationIn: 0,
    },
    "wall-cabinet": {
      label: "Wall cabinet",
      surface: "north",
      widthIn: 30,
      depthIn: 12,
      heightIn: 30,
      elevationIn: 54,
    },
    "tall-cabinet": {
      label: "Tall cabinet",
      surface: "north",
      widthIn: 24,
      depthIn: 24,
      heightIn: 84,
      elevationIn: 0,
    },
    appliance: {
      label: "Appliance space",
      surface: "north",
      widthIn: 30,
      depthIn: 30,
      heightIn: 72,
      elevationIn: 0,
    },
    island: {
      label: "Island module",
      surface: "floor",
      widthIn: 36,
      depthIn: 24,
      heightIn: 34.5,
      elevationIn: 0,
    },
  };
  return {
    id,
    kind,
    ...definition[kind],
    offsetIn: 0,
    roomDepthOffsetIn: 0,
  };
}

export function createCabinetShellItem(kind: CabinetShellItemKind, id: string): CabinetShellItem {
  const definitions: Record<
    CabinetShellItemKind,
    Omit<CabinetShellItem, "id" | "kind" | "wall" | "offsetIn">
  > = {
    door: { label: "Door", widthIn: 36, heightIn: 80, elevationIn: 0, depthIn: 4 },
    window: { label: "Window", widthIn: 36, heightIn: 48, elevationIn: 36, depthIn: 4 },
    obstacle: { label: "Obstacle", widthIn: 12, heightIn: 96, elevationIn: 0, depthIn: 12 },
    water: { label: "Water supply", widthIn: 2, heightIn: 2, elevationIn: 18, depthIn: 1 },
    drain: { label: "Drain", widthIn: 3, heightIn: 3, elevationIn: 16, depthIn: 1 },
    electric: { label: "Electrical", widthIn: 4, heightIn: 4, elevationIn: 18, depthIn: 1 },
    vent: { label: "Vent", widthIn: 6, heightIn: 6, elevationIn: 72, depthIn: 1 },
  };
  return {
    id,
    kind,
    wall: "north",
    offsetIn: 0,
    ...definitions[kind],
  };
}

export function reconcileCabinetPlannerExtension(value: unknown): CabinetPlannerExtensionV1 {
  const empty = createBlankCabinetPlannerExtension();
  if (!value || typeof value !== "object") return empty;
  const candidate = value as Partial<CabinetPlannerExtensionV1>;
  const shell =
    candidate.shell && typeof candidate.shell === "object" ? candidate.shell : empty.shell;
  const starter = START_VALUES.has(candidate.starter as CabinetPlannerStart)
    ? (candidate.starter as CabinetPlannerStart)
    : null;
  const shellItems = Array.isArray(candidate.shellItems)
    ? candidate.shellItems.slice(0, 80).flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as Partial<CabinetShellItem>;
        const kind = SHELL_ITEM_VALUES.has(entry.kind as CabinetShellItemKind)
          ? (entry.kind as CabinetShellItemKind)
          : "obstacle";
        const base = createCabinetShellItem(kind, cleanText(entry.id, `shell-${index + 1}`, 80));
        return [
          {
            ...base,
            label: cleanText(entry.label, base.label, 60),
            wall: WALL_VALUES.has(entry.wall as CabinetWallId)
              ? (entry.wall as CabinetWallId)
              : base.wall,
            offsetIn: cleanDimension(entry.offsetIn, base.offsetIn, 0, 720),
            widthIn: cleanDimension(entry.widthIn, base.widthIn, 0.125, 240),
            heightIn: cleanDimension(entry.heightIn, base.heightIn, 0.125, 240),
            elevationIn: cleanDimension(entry.elevationIn, base.elevationIn, 0, 240),
            depthIn: cleanDimension(entry.depthIn, base.depthIn, 0.125, 120),
          },
        ];
      })
    : [];
  const modules = Array.isArray(candidate.modules)
    ? candidate.modules.slice(0, 120).flatMap((module, index) => {
        if (!module || typeof module !== "object") return [];
        const entry = module as Partial<CabinetPlannerModule>;
        const kind = MODULE_VALUES.has(entry.kind as CabinetModuleKind)
          ? (entry.kind as CabinetModuleKind)
          : "base-cabinet";
        const base = createCabinetPlannerModule(
          kind,
          cleanText(entry.id, `module-${index + 1}`, 80)
        );
        return [
          {
            ...base,
            label: cleanText(entry.label, base.label, 60),
            surface: SURFACE_VALUES.has(entry.surface as CabinetPlacementSurface)
              ? (entry.surface as CabinetPlacementSurface)
              : base.surface,
            offsetIn: cleanDimension(entry.offsetIn, base.offsetIn, 0, 720),
            roomDepthOffsetIn: cleanDimension(
              entry.roomDepthOffsetIn,
              base.roomDepthOffsetIn,
              0,
              720
            ),
            widthIn: cleanDimension(entry.widthIn, base.widthIn, 0.125, 240),
            depthIn: cleanDimension(entry.depthIn, base.depthIn, 0.125, 120),
            heightIn: cleanDimension(entry.heightIn, base.heightIn, 0.125, 240),
            elevationIn: cleanDimension(entry.elevationIn, base.elevationIn, 0, 240),
          },
        ];
      })
    : [];

  return {
    version: CABINET_PLANNER_EXTENSION_VERSION,
    starter,
    shell: {
      widthIn: cleanOptionalDimension(shell.widthIn, 24, 720),
      depthIn: cleanOptionalDimension(shell.depthIn, 24, 720),
      heightIn: cleanOptionalDimension(shell.heightIn, 48, 240),
      measurementsReviewed: shell.measurementsReviewed === true,
    },
    shellItems,
    modules,
    selectedModuleId:
      typeof candidate.selectedModuleId === "string" &&
      modules.some((module) => module.id === candidate.selectedModuleId)
        ? candidate.selectedModuleId
        : null,
    view: VIEW_VALUES.has(candidate.view as CabinetPlannerView)
      ? (candidate.view as CabinetPlannerView)
      : "plan",
    activeElevationWall: WALL_VALUES.has(candidate.activeElevationWall as CabinetWallId)
      ? (candidate.activeElevationWall as CabinetWallId)
      : "north",
    notes: cleanText(candidate.notes, "", 500),
  };
}

export function cabinetWallLengthIn(
  state: Pick<CabinetPlannerExtensionV1, "shell">,
  wall: CabinetWallId
): number | null {
  return wall === "north" || wall === "south" ? state.shell.widthIn : state.shell.depthIn;
}

export function getCabinetModuleBounds(
  state: Pick<CabinetPlannerExtensionV1, "shell">,
  module: CabinetPlannerModule
): CabinetModuleBounds | null {
  const width = state.shell.widthIn;
  const depth = state.shell.depthIn;
  if (width === null || depth === null) return null;
  const y1 = module.elevationIn;
  const y2 = module.elevationIn + module.heightIn;
  if (module.surface === "floor") {
    return {
      x1: module.offsetIn,
      x2: module.offsetIn + module.widthIn,
      z1: module.roomDepthOffsetIn,
      z2: module.roomDepthOffsetIn + module.depthIn,
      y1,
      y2,
    };
  }
  if (module.surface === "north") {
    return {
      x1: module.offsetIn,
      x2: module.offsetIn + module.widthIn,
      z1: 0,
      z2: module.depthIn,
      y1,
      y2,
    };
  }
  if (module.surface === "south") {
    return {
      x1: width - module.offsetIn - module.widthIn,
      x2: width - module.offsetIn,
      z1: depth - module.depthIn,
      z2: depth,
      y1,
      y2,
    };
  }
  if (module.surface === "east") {
    return {
      x1: width - module.depthIn,
      x2: width,
      z1: module.offsetIn,
      z2: module.offsetIn + module.widthIn,
      y1,
      y2,
    };
  }
  return {
    x1: 0,
    x2: module.depthIn,
    z1: depth - module.offsetIn - module.widthIn,
    z2: depth - module.offsetIn,
    y1,
    y2,
  };
}

function overlaps(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number) {
  return firstStart < secondEnd - 0.001 && secondStart < firstEnd - 0.001;
}

function moduleBoundsOverlap(first: CabinetModuleBounds, second: CabinetModuleBounds): boolean {
  return (
    overlaps(first.x1, first.x2, second.x1, second.x2) &&
    overlaps(first.z1, first.z2, second.z1, second.z2) &&
    overlaps(first.y1, first.y2, second.y1, second.y2)
  );
}

function moduleBlocksShellItem(module: CabinetPlannerModule, item: CabinetShellItem): boolean {
  if (module.surface !== item.wall) return false;
  return (
    overlaps(
      module.offsetIn,
      module.offsetIn + module.widthIn,
      item.offsetIn,
      item.offsetIn + item.widthIn
    ) &&
    overlaps(
      module.elevationIn,
      module.elevationIn + module.heightIn,
      item.elevationIn,
      item.elevationIn + item.heightIn
    )
  );
}

export function getCabinetPlannerDiagnostics(
  stateInput: CabinetPlannerExtensionV1
): CabinetPlannerDiagnostic[] {
  const state = reconcileCabinetPlannerExtension(stateInput);
  const diagnostics: CabinetPlannerDiagnostic[] = [];
  const { widthIn, depthIn, heightIn } = state.shell;
  if (widthIn === null || depthIn === null || heightIn === null) {
    diagnostics.push({
      code: "missing-shell",
      severity: "error",
      message: "Enter the measured room width, depth, and ceiling height.",
      objectIds: [],
    });
  } else if (!state.shell.measurementsReviewed) {
    diagnostics.push({
      code: "unreviewed-measurements",
      severity: "error",
      message: "Review the room and object measurements after the latest geometry change.",
      objectIds: [],
    });
  }
  if (!state.modules.length) {
    diagnostics.push({
      code: "empty-plan",
      severity: "error",
      message: "Add at least one cabinet, appliance space, or island module.",
      objectIds: [],
    });
  }

  if (widthIn !== null && depthIn !== null && heightIn !== null) {
    for (const item of state.shellItems) {
      const wallLength = cabinetWallLengthIn(state, item.wall) ?? 0;
      if (
        item.offsetIn < 0 ||
        item.offsetIn + item.widthIn > wallLength + 0.001 ||
        item.elevationIn < 0 ||
        item.elevationIn + item.heightIn > heightIn + 0.001
      ) {
        diagnostics.push({
          code: "shell-item-outside-wall",
          severity: "error",
          message: `${item.label} extends outside the measured ${item.wall} wall.`,
          objectIds: [item.id],
        });
      }
    }

    const boundsByModule = new Map<string, CabinetModuleBounds>();
    for (const module of state.modules) {
      const bounds = getCabinetModuleBounds(state, module);
      if (!bounds) continue;
      boundsByModule.set(module.id, bounds);
      const wallLength =
        module.surface === "floor" ? null : cabinetWallLengthIn(state, module.surface);
      const outsideWallRun =
        wallLength !== null &&
        (module.offsetIn < 0 || module.offsetIn + module.widthIn > wallLength + 0.001);
      if (
        outsideWallRun ||
        bounds.x1 < -0.001 ||
        bounds.z1 < -0.001 ||
        bounds.y1 < -0.001 ||
        bounds.x2 > widthIn + 0.001 ||
        bounds.z2 > depthIn + 0.001 ||
        bounds.y2 > heightIn + 0.001
      ) {
        diagnostics.push({
          code: "module-outside-room",
          severity: "error",
          message: `${module.label} extends outside the measured room shell.`,
          objectIds: [module.id],
        });
      }
      for (const item of state.shellItems) {
        if (
          (item.kind === "door" || item.kind === "window" || item.kind === "obstacle") &&
          moduleBlocksShellItem(module, item)
        ) {
          diagnostics.push({
            code: "blocked-opening",
            severity: "error",
            message: `${module.label} blocks ${item.label} on the ${item.wall} wall.`,
            objectIds: [module.id, item.id],
          });
        }
      }
    }

    for (let firstIndex = 0; firstIndex < state.modules.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < state.modules.length; secondIndex += 1) {
        const first = state.modules[firstIndex];
        const second = state.modules[secondIndex];
        if (!first || !second) continue;
        const firstBounds = boundsByModule.get(first.id);
        const secondBounds = boundsByModule.get(second.id);
        if (firstBounds && secondBounds && moduleBoundsOverlap(firstBounds, secondBounds)) {
          diagnostics.push({
            code: "module-collision",
            severity: "error",
            message: `${first.label} collides with ${second.label}.`,
            objectIds: [first.id, second.id],
          });
        }
      }
    }
  }
  return diagnostics;
}

export function isCabinetPlannerRequestReady(state: CabinetPlannerExtensionV1): boolean {
  return Boolean(state.starter) && getCabinetPlannerDiagnostics(state).length === 0;
}

const LEGACY_START_BY_ROOM: Readonly<Record<string, CabinetPlannerStart>> = {
  Kitchen: "kitchen",
  "Primary bathroom": "bathroom-vanity",
  "Guest bathroom": "bathroom-vanity",
  Laundry: "laundry",
  Pantry: "pantry",
  "Built-in storage": "built-in",
};

/**
 * Explicit legacy-import adapter. Callers must show an import decision; do not run this for a fresh
 * legacy default, because old drafts contain appearance assumptions that this extension omits.
 */
export function cabinetPlannerExtensionFromLegacy(
  design: SteelHomeCabinetDesign
): CabinetPlannerExtensionV1 {
  const starter = LEGACY_START_BY_ROOM[design.room] ?? "blank";
  const state = applyCabinetPlannerStart(createBlankCabinetPlannerExtension(), starter);
  const modules: CabinetPlannerModule[] = [];
  let cursor = 0;
  const addWallModule = (kind: CabinetModuleKind, label: string, widthIn: number) => {
    const module = createCabinetPlannerModule(kind, `legacy-${modules.length + 1}`);
    modules.push({ ...module, label, widthIn, offsetIn: cursor });
    cursor += widthIn;
  };
  addWallModule("appliance", "Refrigerator space", design.refrigeratorWidthIn);
  for (let index = 0; index < design.pantryCount; index += 1) {
    addWallModule("tall-cabinet", `Pantry ${index + 1}`, 24);
  }
  for (let index = 0; index < design.drawerBaseCount; index += 1) {
    addWallModule("base-cabinet", `Drawer base ${index + 1}`, 24);
  }
  addWallModule("base-cabinet", "Sink base", design.sinkBaseWidthIn);
  addWallModule("appliance", "Range space", design.rangeWidthIn);
  if (design.island) {
    modules.push({
      ...createCabinetPlannerModule("island", `legacy-${modules.length + 1}`),
      widthIn: design.islandLengthIn,
      depthIn: design.islandWidthIn,
      offsetIn: 0,
      roomDepthOffsetIn: 0,
    });
  }
  return reconcileCabinetPlannerExtension({
    ...state,
    shell: {
      widthIn: design.primaryWallIn,
      depthIn: design.returnWallIn,
      heightIn: design.ceilingHeightIn,
      measurementsReviewed: false,
    },
    modules,
    notes: design.notes,
  });
}

export function buildCabinetPlannerRequestBrief(stateInput: CabinetPlannerExtensionV1): string {
  const state = reconcileCabinetPlannerExtension(stateInput);
  const lines = [
    "TradeScout Cabinet Planning Request",
    `Start: ${CABINET_PLANNER_STARTS.find((item) => item.value === state.starter)?.label || "Not selected"}`,
    `Room shell: ${state.shell.widthIn ?? "unresolved"}\" × ${state.shell.depthIn ?? "unresolved"}\" × ${state.shell.heightIn ?? "unresolved"}\" high`,
    `Measurements reviewed: ${state.shell.measurementsReviewed ? "Yes" : "No"}`,
    `Quote: Required`,
    "",
    "Modules",
    ...state.modules.map((module) => {
      const placement =
        module.surface === "floor"
          ? `floor at X ${module.offsetIn}\", Y ${module.roomDepthOffsetIn}\"`
          : `${module.surface} wall at ${module.offsetIn}\"`;
      return `- ${module.label}: ${module.widthIn}\" W × ${module.depthIn}\" D × ${module.heightIn}\" H; ${placement}; elevation ${module.elevationIn}\"`;
    }),
    "",
    "Openings, obstacles, and utilities",
    ...state.shellItems.map(
      (item) =>
        `- ${item.label} (${item.kind}): ${item.wall} wall at ${item.offsetIn}\"; ${item.widthIn}\" W × ${item.heightIn}\" H; elevation ${item.elevationIn}\"`
    ),
  ];
  if (state.notes) lines.push("", `Planning notes: ${state.notes}`);
  lines.push(
    "",
    "Planning intent only. Field measurement, product availability, code, clearances, installation, and exact cabinet specifications require professional confirmation."
  );
  return lines.join("\n");
}
