import {
  getCabinetModuleBounds, getCabinetPlannerDiagnostics, reconcileCabinetPlannerExtension,
  type CabinetPlannerModule,
} from "./cabinetPlannerModel";
import { reconcileSteelHomeProjectDraft, type SteelHomeCabinetDesign, type SteelHomeCountertopDesign } from "./projectModel";

export type TransferOptions = {
  frontOverhangIn: number | null;
  thicknessIn: number | null;
  islandWestIn: number | null;
  islandEastIn: number | null;
  islandNorthIn: number | null;
  islandSouthIn: number | null;
};
export const EMPTY_TRANSFER_OPTIONS: TransferOptions = {
  frontOverhangIn: null, thicknessIn: null,
  islandWestIn: null, islandEastIn: null, islandNorthIn: null, islandSouthIn: null,
};
export type TransferRect = { id: string; label: string; x1: number; x2: number; z1: number; z2: number };
export type CabinetCountertopProposal = {
  next: SteelHomeCountertopDesign | null;
  problems: string[];
  warnings: string[];
  supports: TransferRect[];
  excluded: TransferRect[];
  tops: TransferRect[];
  hasIsland: boolean;
  roomWidthIn: number | null;
  roomDepthIn: number | null;
};
const close = (a: number, b: number) => Math.abs(a - b) < 0.00001;
const overlap = (a: TransferRect, b: TransferRect) => a.x1 < b.x2 - 0.00001 && b.x1 < a.x2 - 0.00001 && a.z1 < b.z2 - 0.00001 && b.z1 < a.z2 - 0.00001;
const rect = (id: string, x1: number, z1: number, x2: number, z2: number): TransferRect => ({ id, label: id, x1, x2, z1, z2 });

/** Exact axis-aligned rectangle union area; no bounding-box gap filling. */
export function transferUnionArea(rectangles: TransferRect[]): number {
  const xs = [...new Set(rectangles.flatMap(r => [r.x1, r.x2]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const left = xs[i - 1], right = xs[i];
    const spans = rectangles.filter(r => r.x1 < right && r.x2 > left).map(r => [r.z1, r.z2]).sort((a, b) => a[0] - b[0]);
    let start = 0, end = 0, length = 0, initialized = false;
    for (const [a, b] of spans) {
      if (!initialized) { start = a; end = b; initialized = true; }
      else if (a <= end) end = Math.max(end, b);
      else { length += end - start; start = a; end = b; }
    }
    if (initialized) length += end - start;
    area += (right - left) * length;
  }
  return area;
}
function sameFootprint(first: TransferRect[], second: TransferRect[]) {
  const a = transferUnionArea(first), b = transferUnionArea(second);
  return close(a, b) && close(transferUnionArea([...first, ...second]), a);
}
const numericChoice = (value: number | null, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max && close(value * 8, Math.round(value * 8));

/** Import changes only countertop state, never cabinet/source state or request authority. */
export function proposeCabinetCountertopTransfer(
  cabinets: SteelHomeCabinetDesign,
  current: SteelHomeCountertopDesign,
  options: TransferOptions
): CabinetCountertopProposal {
  const planner = reconcileCabinetPlannerExtension(cabinets.planner);
  const { widthIn: width, depthIn: depth, heightIn: height } = planner.shell;
  const result: CabinetCountertopProposal = { next: null, problems: [], warnings: [], supports: [], excluded: [], tops: [], hasIsland: false, roomWidthIn: width, roomDepthIn: depth };
  const eligible: CabinetPlannerModule[] = [], ignored: CabinetPlannerModule[] = [];
  for (const module of planner.modules) {
    const support = module.kind === "base-cabinet" || module.kind === "island";
    (support ? eligible : ignored).push(module);
    const bounds = getCabinetModuleBounds(planner, module);
    if (bounds) (support ? result.supports : result.excluded).push({ ...bounds, id: module.id, label: module.label });
  }
  const wall = eligible.filter(m => m.surface !== "floor");
  const island = eligible.filter(m => m.surface === "floor");
  result.hasIsland = island.length > 0;
  if (!planner.starter || width === null || depth === null || height === null) result.problems.push("Complete the cabinet room width, depth and height before importing.");
  if (!wall.length) result.problems.push("This handoff needs a wall run. Island-only layouts are not representable by the current countertop editor.");
  if (new Set(planner.modules.map(m => m.id)).size !== planner.modules.length) result.problems.push("Cabinet module identities must be unique.");
  for (const problem of getCabinetPlannerDiagnostics(planner)) {
    if (problem.code === "unreviewed-measurements") result.warnings.push("Cabinet measurements have not been reviewed. The imported countertop will also require measurement review.");
    else result.problems.push(problem.message);
  }
  if (!numericChoice(options.frontOverhangIn, 0, 12)) result.problems.push("Enter a wall-run front overhang from 0 to 12 inches on the 1/8-inch grid. No overhang is assumed.");
  if (!numericChoice(options.thicknessIn, 0.25, 6)) result.problems.push("Enter countertop thickness from 1/4 to 6 inches on the 1/8-inch grid.");
  if (island.length && ![options.islandWestIn, options.islandEastIn, options.islandNorthIn, options.islandSouthIn].every(v => numericChoice(v, 0, 24))) result.problems.push("Enter all four island overhangs from 0 to 24 inches on the 1/8-inch grid, including explicit zeros.");
  if (wall.some(m => m.surface === "south") || !wall.some(m => m.surface === "north")) result.problems.push("This version supports origin-aligned north-wall straight runs, north/west L layouts, and north/west/east U layouts. Other orientations stay unchanged.");
  if (wall.some(m => m.kind === "island")) result.problems.push("An island module must use floor placement, not a wall.");
  if (result.problems.length) return result;
  const roomWidth = width!, roomDepth = depth!;
  const topHeight = eligible[0].elevationIn + eligible[0].heightIn;
  const cabinetDepth = wall[0].depthIn;
  if (eligible.some(m => !close(m.elevationIn + m.heightIn, topHeight))) result.problems.push("Different cabinet-top heights need separate countertop levels; no level is silently changed.");
  if (wall.some(m => !close(m.depthIn, cabinetDepth))) result.problems.push("Wall runs with different cabinet depths need a custom footprint; no depth is silently changed.");
  const bounds = (module: CabinetPlannerModule) => result.supports.find(r => r.id === module.id)!;
  const north = wall.filter(m => m.surface === "north"), west = wall.filter(m => m.surface === "west"), east = wall.filter(m => m.surface === "east");
  if (east.length && !west.length) result.problems.push("A right-return-only layout cannot be imported as a left-return L. Keep this layout in cabinets until a matching countertop shape is available.");
  if (result.problems.length) return result;
  const a = Math.max(...north.map(m => bounds(m).x2));
  const b = west.length ? Math.max(...west.map(m => bounds(m).z2)) : current.wallBIn;
  const c = east.length ? Math.max(...east.map(m => bounds(m).z2)) : current.wallCIn;
  const layout: SteelHomeCountertopDesign["layout"] = east.length ? "u-shape" : west.length ? "l-shape" : "straight";
  const template = (d: number) => [rect("main", 0, 0, a, d), ...(west.length ? [rect("left-return", 0, d, d, b)] : []), ...(east.length ? [rect("right-return", a - d, d, a, c)] : [])];
  const supportTemplate = template(cabinetDepth);
  if (supportTemplate.some(r => r.x2 <= r.x1 || r.z2 <= r.z1) || !sameFootprint(wall.map(bounds), supportTemplate)) result.problems.push("The cabinet footprint has an offset, gap, missing corner, or disconnected run that the current countertop shapes cannot preserve. No cabinets will be moved and no gaps filled.");
  const d = cabinetDepth + options.frontOverhangIn!;
  const proposedWallTops = wall.map(m => {
    const r = { ...bounds(m) };
    if (m.surface === "north") r.z2 += options.frontOverhangIn!;
    else if (m.surface === "west") r.x2 += options.frontOverhangIn!;
    else if (m.surface === "east") r.x1 -= options.frontOverhangIn!;
    return r;
  });
  const topTemplate = template(d);
  if (topTemplate.some(r => r.x2 <= r.x1 || r.z2 <= r.z1) || !sameFootprint(proposedWallTops, topTemplate)) result.problems.push("The entered front overhang cannot be represented without changing the cabinet footprint.");
  result.tops.push(...topTemplate);
  let islandTop: TransferRect | null = null;
  if (island.length) {
    const actual = island.map(bounds);
    const supportBox = rect("island-support", Math.min(...actual.map(r => r.x1)), Math.min(...actual.map(r => r.z1)), Math.max(...actual.map(r => r.x2)), Math.max(...actual.map(r => r.z2)));
    if (!sameFootprint(actual, [supportBox])) result.problems.push("Island cabinets must form one filled rectangle. Multiple islands or internal gaps are not silently covered.");
    islandTop = rect("island", supportBox.x1 - options.islandWestIn!, supportBox.z1 - options.islandNorthIn!, supportBox.x2 + options.islandEastIn!, supportBox.z2 + options.islandSouthIn!);
    result.tops.push(islandTop);
    if (topTemplate.some(r => overlap(r, islandTop!))) result.problems.push("The island countertop overlaps a wall countertop with these overhangs.");
  }
  if (result.tops.some(r => r.x1 < 0 || r.z1 < 0 || r.x2 > roomWidth || r.z2 > roomDepth)) result.problems.push("The proposed countertop extends outside the measured room. Reduce or remeasure the relevant overhang.");
  for (const module of ignored) {
    const r = getCabinetModuleBounds(planner, module)!;
    if (r.y2 > topHeight + 0.00001 && r.y1 < topHeight + options.thicknessIn! - 0.00001 && result.tops.some(top => overlap(top, { ...r, id: module.id, label: module.label }))) result.problems.push(`The proposed countertop intersects ${module.label}. Appliance spaces and tall cabinets are not countertop supports.`);
  }
  if (topHeight + options.thicknessIn! > height!) result.problems.push("The finished countertop would extend above the measured room height.");
  if (result.problems.length) return result;
  const next: SteelHomeCountertopDesign = {
    ...current,
    layout, wallAIn: a, wallBIn: b, wallCIn: c, wallDepthIn: d,
    roomWidthIn: roomWidth, roomDepthIn: roomDepth, roomWallHeightIn: height,
    finishedTopHeightIn: topHeight + options.thicknessIn!, topThicknessIn: options.thicknessIn,
    island: Boolean(islandTop),
    ...(islandTop ? { islandLengthIn: islandTop.x2 - islandTop.x1, islandWidthIn: islandTop.z2 - islandTop.z1, islandLeftOffsetIn: islandTop.x1, islandBackOffsetIn: islandTop.z1 } : { islandLeftOffsetIn: null, islandBackOffsetIn: null, waterfall: "None" as const }),
    measurementsReviewed: false,
    sinkRun: "", sinkPositionIn: null, sinkFrontPositionIn: null,
    cooktopRun: "", cooktopPositionIn: null, cooktopFrontPositionIn: null,
    otherCutouts: current.otherCutouts.map(item => ({ ...item, run: "", positionIn: null, frontPositionIn: null })),
  };
  // v9 has older integer/half-inch limits. Reject any lossy import instead of rounding.
  const stored = reconcileSteelHomeProjectDraft({ countertops: next }).countertops;
  const exactFields = ["layout", "wallAIn", "wallBIn", "wallCIn", "wallDepthIn", "roomWidthIn", "roomDepthIn", "roomWallHeightIn", "finishedTopHeightIn", "topThicknessIn", "island", "islandLengthIn", "islandWidthIn", "islandLeftOffsetIn", "islandBackOffsetIn"] as const;
  const changedByStorage = exactFields.filter(key => next[key] !== stored[key]);
  if (changedByStorage.length) {
    result.problems.push(`Current countertop storage cannot retain these exact values (${changedByStorage.join(", ")}). Import is blocked rather than rounded or clamped.`);
    return result;
  }
  result.next = next;
  result.warnings.push("Wall-run ends stay flush with the cabinet footprint; only the entered front overhang is added. Island overhangs are independent on all four sides.");
  result.warnings.push("Stone/photo selection, notes, edge and backsplash choices, and fixture/template selections are retained. Existing opening positions are cleared and must be placed on the new layout.");
  result.warnings.push("This is a one-time copy, not automatic synchronization. Future cabinet moves do not move the countertop. Field templating and support/clearance review remain required.");
  return result;
}
