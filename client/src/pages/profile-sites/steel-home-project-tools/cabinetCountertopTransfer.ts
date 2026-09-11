import { getCabinetModuleBounds, reconcileCabinetPlannerExtension } from "./cabinetPlannerModel";
import type { SteelHomeCabinetDesign, SteelHomeCountertopDesign } from "./projectModel";
import { proposeCabinetCountertopTransfer as proposeFootprint, type TransferOptions } from "./cabinetCountertopFootprint";
export * from "./cabinetCountertopFootprint";

/** Validate the finished top layer too: a base may fit below a window while its top does not. */
export function proposeCabinetCountertopTransfer(cabinets: SteelHomeCabinetDesign, current: SteelHomeCountertopDesign, options: TransferOptions) {
  const result = proposeFootprint(cabinets, current, options);
  if (!result.next) return result;
  const planner = reconcileCabinetPlannerExtension(cabinets.planner);
  const upper = result.next.finishedTopHeightIn!;
  const lower = upper - result.next.topThicknessIn!;
  for (const item of planner.shellItems) {
    if (item.kind !== "door" && item.kind !== "window" && item.kind !== "obstacle") continue;
    const bounds = getCabinetModuleBounds(planner, {
      id: item.id, kind: "base-cabinet", label: item.label, surface: item.wall,
      offsetIn: item.offsetIn, roomDepthOffsetIn: 0, widthIn: item.widthIn,
      depthIn: item.depthIn, heightIn: item.heightIn, elevationIn: item.elevationIn,
    });
    if (!bounds || bounds.y1 >= upper - 0.00001 || bounds.y2 <= lower + 0.00001) continue;
    if (result.tops.some(top => top.x1 < bounds.x2 - 0.00001 && bounds.x1 < top.x2 - 0.00001 && top.z1 < bounds.z2 - 0.00001 && bounds.z1 < top.z2 - 0.00001)) {
      result.problems.push(`The finished countertop intersects the recorded ${item.label} geometry. Remeasure or revise the layout before importing.`);
    }
  }
  if (result.problems.length) result.next = null;
  return result;
}
