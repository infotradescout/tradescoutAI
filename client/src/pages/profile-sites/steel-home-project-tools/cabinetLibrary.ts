import {
  CABINET_STUDIO_FINISHES,
  getCabinetModuleBounds,
  getCabinetPlannerDiagnostics,
  isCabinetAccessory,
  reconcileCabinetPlannerExtension,
  type CabinetPlacementSurface,
  type CabinetPlannerExtensionV1,
  type CabinetPlannerModule,
  type CabinetPresentation,
} from "./cabinetPlannerModel";

export type CabinetLibraryPreset = {
  id: string;
  label: string;
  kind: CabinetPlannerModule["kind"];
  front: CabinetPresentation["fronts"][string] | null;
  widthIn: number;
  depthIn: number;
  heightIn: number;
  elevationIn: number;
  wallInsetIn?: number;
};

// Explicitly chosen planning sizes, not manufacturer products or verified stock.
export const CABINET_LIBRARY_PRESETS: readonly CabinetLibraryPreset[] = [
  { id: "door-base", label: "Door base", kind: "base-cabinet", front: "doors", widthIn: 30, depthIn: 24, heightIn: 34.5, elevationIn: 0 },
  { id: "drawer-bank", label: "Three-drawer base", kind: "base-cabinet", front: "drawers", widthIn: 18, depthIn: 24, heightIn: 34.5, elevationIn: 0 },
  { id: "sink-base", label: "Sink base", kind: "base-cabinet", front: "sink", widthIn: 36, depthIn: 24, heightIn: 34.5, elevationIn: 0 },
  { id: "vanity", label: "Vanity sink base", kind: "base-cabinet", front: "sink", widthIn: 36, depthIn: 21, heightIn: 34.5, elevationIn: 0 },
  { id: "wall-doors", label: "Wall cabinet", kind: "wall-cabinet", front: "doors", widthIn: 30, depthIn: 12, heightIn: 30, elevationIn: 54 },
  { id: "open-wall", label: "Open wall shelves", kind: "wall-cabinet", front: "open", widthIn: 30, depthIn: 12, heightIn: 30, elevationIn: 54 },
  { id: "pantry", label: "Pantry cabinet", kind: "tall-cabinet", front: "doors", widthIn: 24, depthIn: 24, heightIn: 84, elevationIn: 0 },
  { id: "island-doors", label: "Island door cabinet", kind: "island", front: "doors", widthIn: 36, depthIn: 24, heightIn: 34.5, elevationIn: 0 },
  { id: "island-drawers", label: "Island drawer cabinet", kind: "island", front: "drawers", widthIn: 30, depthIn: 24, heightIn: 34.5, elevationIn: 0 },
];

export const CABINET_ACCESSORY_PRESETS: readonly CabinetLibraryPreset[] = [
  { id: "filler", label: "Filler strip", kind: "filler", front: null, widthIn: 3, depthIn: 0.75, heightIn: 30.5, elevationIn: 4, wallInsetIn: 23.25 },
  { id: "end-panel", label: "Finished end panel", kind: "end-panel", front: null, widthIn: 0.75, depthIn: 24, heightIn: 34.5, elevationIn: 0, wallInsetIn: 0 },
];
export const CABINET_ALL_PRESETS = [...CABINET_LIBRARY_PRESETS, ...CABINET_ACCESSORY_PRESETS] as const;

export type CabinetLibrarySelection = {
  presetId: string;
  surface: CabinetPlacementSurface;
  widthIn: number | null;
  depthIn: number | null;
  heightIn: number | null;
  elevationIn: number | null;
  offsetIn: number | null;
  roomDepthOffsetIn: number | null;
  wallInsetIn?: number | null;
};
export type CabinetLibraryProposal = {
  planner: CabinetPlannerExtensionV1 | null;
  module: CabinetPlannerModule | null;
  problems: string[];
};
const SURFACES: readonly string[] = ["north", "east", "south", "west", "floor"];
const overlaps = (a: number, b: number, c: number, d: number) => a < d - .001 && c < b - .001;
const onGrid = (value: number) => Math.abs(value * 8 - Math.round(value * 8)) < 1e-7;

export function cabinetLibrarySelection(presetId: string): CabinetLibrarySelection | null {
  const preset = CABINET_ALL_PRESETS.find(item => item.id === presetId);
  return preset ? {
    presetId, surface: preset.kind === "island" ? "floor" : "north",
    widthIn: preset.widthIn, depthIn: preset.depthIn, heightIn: preset.heightIn,
    elevationIn: preset.elevationIn, offsetIn: 0,
    // Floor position must be entered deliberately, not placed at an invented kitchen island position.
    roomDepthOffsetIn: preset.kind === "island" ? null : 0,
    ...(isCabinetAccessory(preset) ? { wallInsetIn: preset.wallInsetIn ?? 0 } : {}),
  } : null;
}

/** A read-only proposal; callers commit it once, through the existing whole-design history. */
export function proposeLibraryCabinet(
  input: CabinetPlannerExtensionV1,
  selection: CabinetLibrarySelection,
  id: string
): CabinetLibraryProposal {
  const planner = reconcileCabinetPlannerExtension(input);
  const problems: string[] = [];
  const preset = CABINET_ALL_PRESETS.find(item => item.id === selection.presetId);
  if (!preset) problems.push("Choose a cabinet configuration.");
  if (!planner.starter || Object.values(planner.shell).slice(0, 3).some(value => value === null)) {
    problems.push("Enter the measured room width, depth and height first.");
  }
  if (planner.modules.length >= 120) problems.push("This plan already has the maximum 120 modules.");
  if (!id.trim() || id.length > 80 || planner.modules.some(item => item.id === id)) problems.push("A unique cabinet identity is required.");
  if (!SURFACES.includes(selection.surface)) problems.push("Choose a measured wall or floor placement.");
  if (preset?.kind === "island" && selection.surface !== "floor") problems.push("Island configurations use floor placement.");
  const dimensions: Array<[keyof CabinetLibrarySelection, string, number, number]> = [
    ["widthIn", "Width", .125, 240], ["depthIn", "Depth", .125, 120],
    ["heightIn", "Height", .125, 240], ["elevationIn", "Elevation", 0, 240],
    ["offsetIn", "Offset", 0, 720],
  ];
  if (selection.surface === "floor") dimensions.push(["roomDepthOffsetIn", "Distance from north", 0, 720]);
  if (preset && isCabinetAccessory(preset) && selection.surface !== "floor") {
    dimensions.push(["wallInsetIn", "Wall setback", 0, 720]);
  }
  for (const [key, label, minimum, maximum] of dimensions) {
    const value = selection[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum || !onGrid(value)) {
      problems.push(`${label} must be entered between ${minimum} and ${maximum} inches on the 1/8-inch grid.`);
    }
  }
  if (problems.length || !preset) return { planner: null, module: null, problems };
  const module: CabinetPlannerModule = {
    id, kind: preset.kind, label: preset.label, surface: selection.surface,
    widthIn: selection.widthIn!, depthIn: selection.depthIn!, heightIn: selection.heightIn!,
    elevationIn: selection.elevationIn!, offsetIn: selection.offsetIn!,
    roomDepthOffsetIn: selection.surface === "floor" ? selection.roomDepthOffsetIn! : 0,
    ...(isCabinetAccessory(preset) ? { wallInsetIn: selection.surface === "floor" ? 0 : selection.wallInsetIn! } : {}),
  };
  const appearance = planner.presentation ?? { style: null, finish: null, hardware: null, fronts: {} };
  const next = reconcileCabinetPlannerExtension({
    ...planner, selectedModuleId: id, modules: [...planner.modules, module],
    shell: { ...planner.shell, measurementsReviewed: false },
    presentation: { ...appearance, fronts: { ...appearance.fronts, ...(preset.front ? { [id]: preset.front } : {}) } },
  });
  problems.push(...getCabinetPlannerDiagnostics(next).filter(item => item.objectIds.includes(id)).map(item => item.message));
  const bounds = getCabinetModuleBounds(next, module)!;
  // Also cover recorded cross-wall and floor obstacles, not just same-wall openings.
  for (const item of planner.shellItems) {
    if (!["door", "window", "obstacle"].includes(item.kind)) continue;
    const obstacle = getCabinetModuleBounds(next, {
      ...module, kind: "appliance", wallInsetIn: 0,
      surface: item.wall, widthIn: item.widthIn, depthIn: item.depthIn,
      heightIn: item.heightIn, elevationIn: item.elevationIn, offsetIn: item.offsetIn,
    })!;
    if (overlaps(bounds.x1, bounds.x2, obstacle.x1, obstacle.x2) &&
        overlaps(bounds.z1, bounds.z2, obstacle.z1, obstacle.z2) &&
        overlaps(bounds.y1, bounds.y2, obstacle.y1, obstacle.y2)) {
      problems.push(`${module.label} intersects the recorded ${item.label} envelope.`);
    }
  }
  return { planner: next, module, problems: [...new Set(problems)] };
}

/** Suggest, but never commit, the first valid wall gap. Floor positions remain explicit. */
export function findCabinetLibraryWallGap(
  planner: CabinetPlannerExtensionV1,
  selection: CabinetLibrarySelection,
  id: string
): number | null {
  if (selection.surface === "floor") return null;
  const horizontal = selection.surface === "north" || selection.surface === "south";
  const reversed = selection.surface === "south" || selection.surface === "west";
  const length = horizontal ? planner.shell.widthIn : planner.shell.depthIn;
  if (length === null) return null;
  const candidates = new Set<number>([0]);
  const objects = [
    ...planner.modules,
    ...planner.shellItems.filter(item => ["door", "window", "obstacle"].includes(item.kind)).map(item => ({
      id: item.id, kind: "appliance" as const, label: item.label, surface: item.wall,
      offsetIn: item.offsetIn, roomDepthOffsetIn: 0, widthIn: item.widthIn,
      depthIn: item.depthIn, heightIn: item.heightIn, elevationIn: item.elevationIn,
    })),
  ];
  for (const item of objects) {
    const bounds = getCabinetModuleBounds(planner, item);
    if (!bounds) continue;
    candidates.add(horizontal ? (reversed ? length - bounds.x1 : bounds.x2) : (reversed ? length - bounds.z1 : bounds.z2));
  }
  for (const offsetIn of [...candidates].filter(value => value >= 0 && value <= length).sort((a, b) => a - b)) {
    if (!proposeLibraryCabinet(planner, { ...selection, offsetIn }, id).problems.length) return offsetIn;
  }
  return null;
}

export type CabinetScheduleRow = {
  quantity: number;
  label: string;
  kind: CabinetPlannerModule["kind"];
  widthIn: number;
  depthIn: number;
  heightIn: number;
  front: string;
  ids: string[];
  placements: string[];
};
export function cabinetSchedule(input: CabinetPlannerExtensionV1): CabinetScheduleRow[] {
  const planner = reconcileCabinetPlannerExtension(input);
  const rows = new Map<string, CabinetScheduleRow>();
  for (const module of planner.modules) {
    const front = module.kind === "appliance" ? "Appliance space, not a cabinet"
      : isCabinetAccessory(module) ? "Accessory panel, not a cabinet"
      : planner.presentation?.fronts[module.id] ?? "Not selected";
    const key = JSON.stringify([module.label, module.kind, module.widthIn, module.depthIn, module.heightIn, front]);
    const row = rows.get(key) ?? {
      quantity: 0, label: module.label, kind: module.kind,
      widthIn: module.widthIn, depthIn: module.depthIn, heightIn: module.heightIn,
      front, ids: [], placements: [],
    };
    row.quantity++; row.ids.push(module.id);
    row.placements.push(module.surface === "floor"
      ? `Floor: X ${module.offsetIn}, Y ${module.roomDepthOffsetIn}, elevation ${module.elevationIn} in`
      : `${module.surface}: offset ${module.offsetIn}, elevation ${module.elevationIn} in${isCabinetAccessory(module) ? `, wall setback ${module.wallInsetIn ?? 0} in` : ""}`);
    rows.set(key, row);
  }
  return [...rows.values()];
}

/** Escape CSV fields and neutralize formula prefixes in user-controlled labels and IDs. */
function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export function cabinetScheduleCsv(input: CabinetPlannerExtensionV1): string {
  const planner = reconcileCabinetPlannerExtension(input);
  const presentation = planner.presentation;
  const finish = CABINET_STUDIO_FINISHES.find(item => item.value === presentation?.finish)?.label ?? "Not selected";
  const rows: Array<Array<string | number>> = [
    ["TradeScout cabinet planning schedule", "Not an order, manufacturer specification, or shop drawing"],
    ["Review status", getCabinetPlannerDiagnostics(planner).length ? "Unresolved planning checks" : "Ready for professional review"],
    ["Room width in", planner.shell.widthIn ?? "Unresolved", "Room depth in", planner.shell.depthIn ?? "Unresolved", "Room height in", planner.shell.heightIn ?? "Unresolved"],
    ["Door style", presentation?.style ?? "Not selected", "Finish", finish, "Hardware", presentation?.hardware ?? "Not selected"],
    ["Qty", "Configuration", "Module kind", "Width in", "Depth in", "Height in", "Front arrangement", "Placements", "Module IDs"],
    ...cabinetSchedule(planner).map(row => [row.quantity, row.label, row.kind, row.widthIn, row.depthIn, row.heightIn, row.front, row.placements.join("; "), row.ids.join("; ")]),
  ];
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
