import {
  cabinetWallLengthIn, getCabinetModuleBounds, getCabinetPlannerDiagnostics,
  snapCabinetInches, type CabinetPlannerExtensionV1, type CabinetPlannerModule,
} from "./cabinetPlannerModel";

export type CabinetMoveGuide = { axis: "x" | "z"; coordinate: number; label: string };
export type CabinetMoveProposal = {
  planner: CabinetPlannerExtensionV1;
  module: CabinetPlannerModule;
  changed: boolean;
  problems: string[];
  guides: CabinetMoveGuide[];
};
type SnapTarget = { offset: number; guide: CabinetMoveGuide };
const overlap = (a: number, b: number, c: number, d: number) => a < d - .001 && c < b - .001;
const clamp = (n: number, max: number) => snapCabinetInches(Math.min(Math.max(0, max), Math.max(0, n)));

/** Deltas use room axes (right/east is +X, down/south is +Z), never screen pixels. */
export function proposeCabinetMove(
  planner: CabinetPlannerExtensionV1,
  id: string,
  dx: number,
  dz: number,
  snapDistanceIn = 1
): CabinetMoveProposal | null {
  const matches = planner.modules.filter(module => module.id === id);
  if (matches.length !== 1 || ![dx, dz, snapDistanceIn].every(Number.isFinite)) return null;
  const source = matches[0];
  const { widthIn: width, depthIn: depth, heightIn: height } = planner.shell;
  if (width === null || depth === null || height === null) return null;
  const module = { ...source };
  const guides: CabinetMoveGuide[] = [];
  const distance = Math.min(3, Math.max(0, snapDistanceIn));
  const snap = (offset: number, maximum: number, targets: SnapTarget[]) => {
    const value = clamp(offset, maximum);
    if (!distance) return value;
    const target = targets.filter(item => item.offset >= 0 && item.offset <= maximum && Math.abs(item.offset - value) <= distance)
      .sort((a, b) => Math.abs(a.offset - value) - Math.abs(b.offset - value))[0];
    if (!target) return value;
    guides.push(target.guide);
    return snapCabinetInches(target.offset);
  };
  const neighbours = planner.modules.filter(other => other.id !== id && overlap(
    source.elevationIn, source.elevationIn + source.heightIn,
    other.elevationIn, other.elevationIn + other.heightIn
  ));
  if (source.surface !== "floor") {
    const surface = source.surface;
    const length = cabinetWallLengthIn(planner, surface)!;
    const axis = surface === "north" || surface === "south" ? "x" : "z";
    const reversed = surface === "south" || surface === "west";
    const position = source.offsetIn + (axis === "x" ? dx : dz) * (reversed ? -1 : 1);
    const guide = (offset: number, label: string): CabinetMoveGuide => ({ axis, coordinate: reversed ? length - offset : offset, label });
    const targets: SnapTarget[] = [
      { offset: 0, guide: guide(0, "Wall start") },
      { offset: length - source.widthIn, guide: guide(length, "Wall end") },
    ];
    for (const other of neighbours.filter(other => other.surface === surface)) {
      targets.push(
        { offset: other.offsetIn + other.widthIn, guide: guide(other.offsetIn + other.widthIn, `Next to ${other.label}`) },
        { offset: other.offsetIn - source.widthIn, guide: guide(other.offsetIn, `Next to ${other.label}`) }
      );
    }
    module.offsetIn = snap(position, length - source.widthIn, targets);
  } else {
    module.offsetIn = clamp(source.offsetIn + dx, width - source.widthIn);
    module.roomDepthOffsetIn = clamp(source.roomDepthOffsetIn + dz, depth - source.depthIn);
    const xTargets: SnapTarget[] = [
      { offset: 0, guide: { axis: "x", coordinate: 0, label: "West wall" } },
      { offset: width - source.widthIn, guide: { axis: "x", coordinate: width, label: "East wall" } },
    ];
    const zTargets: SnapTarget[] = [
      { offset: 0, guide: { axis: "z", coordinate: 0, label: "North wall" } },
      { offset: depth - source.depthIn, guide: { axis: "z", coordinate: depth, label: "South wall" } },
    ];
    for (const other of neighbours) {
      const b = getCabinetModuleBounds(planner, other);
      if (!b) continue;
      if (overlap(module.roomDepthOffsetIn - distance, module.roomDepthOffsetIn + module.depthIn + distance, b.z1, b.z2)) {
        xTargets.push(
          { offset: b.x2, guide: { axis: "x", coordinate: b.x2, label: `Next to ${other.label}` } },
          { offset: b.x1 - module.widthIn, guide: { axis: "x", coordinate: b.x1, label: `Next to ${other.label}` } }
        );
      }
      if (overlap(module.offsetIn - distance, module.offsetIn + module.widthIn + distance, b.x1, b.x2)) {
        zTargets.push(
          { offset: b.z2, guide: { axis: "z", coordinate: b.z2, label: `Next to ${other.label}` } },
          { offset: b.z1 - module.depthIn, guide: { axis: "z", coordinate: b.z1, label: `Next to ${other.label}` } }
        );
      }
    }
    module.offsetIn = snap(module.offsetIn, width - source.widthIn, xTargets);
    module.roomDepthOffsetIn = snap(module.roomDepthOffsetIn, depth - source.depthIn, zTargets);
  }
  const changed = source.offsetIn !== module.offsetIn || source.roomDepthOffsetIn !== module.roomDepthOffsetIn;
  const next = changed ? {
    ...planner,
    selectedModuleId: id,
    modules: planner.modules.map(item => item.id === id ? module : item),
    shell: { ...planner.shell, measurementsReviewed: false },
  } : planner;
  const problems = getCabinetPlannerDiagnostics(next)
    .filter(problem => problem.objectIds.includes(id))
    .map(problem => problem.message);
  // The canonical wall diagnostics do not project floor modules against shell objects.
  // For direct movement, also reject intersection with their recorded wall/depth envelope.
  if (module.surface === "floor") {
    const b = getCabinetModuleBounds(next, module)!;
    for (const item of planner.shellItems) {
      if (!["door", "window", "obstacle"].includes(item.kind)) continue;
      const wall = item.wall;
      const length = wall === "north" || wall === "south" ? width : depth;
      const start = wall === "south" || wall === "west" ? length - item.offsetIn - item.widthIn : item.offsetIn;
      const x1 = wall === "north" || wall === "south" ? start : wall === "east" ? width - item.depthIn : 0;
      const z1 = wall === "east" || wall === "west" ? start : wall === "south" ? depth - item.depthIn : 0;
      const x2 = x1 + (wall === "north" || wall === "south" ? item.widthIn : item.depthIn);
      const z2 = z1 + (wall === "east" || wall === "west" ? item.widthIn : item.depthIn);
      if (overlap(b.x1, b.x2, x1, x2) && overlap(b.z1, b.z2, z1, z2) && overlap(b.y1, b.y2, item.elevationIn, item.elevationIn + item.heightIn)) {
        problems.push(`${module.label} intersects the recorded ${item.label} envelope.`);
      }
    }
  }
  return { planner: next, module, changed, problems, guides };
}

export function cabinetMovePosition(module: CabinetPlannerModule): string {
  return module.surface === "floor"
    ? `${module.label}: X ${module.offsetIn} in from west; Y ${module.roomDepthOffsetIn} in from north`
    : `${module.label}: ${module.offsetIn} in from ${module.surface} wall start`;
}
