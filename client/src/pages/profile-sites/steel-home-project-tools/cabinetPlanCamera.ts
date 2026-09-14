import { getCabinetModuleBounds, isCabinetAccessory, type CabinetPlannerExtensionV1, type CabinetPlannerModule } from "./cabinetPlannerModel";

export type CabinetPlanLayer = "all" | "lower" | "upper" | "panels";
export type CabinetPlanCamera = { x: number; y: number; width: number; height: number };
export const CABINET_PLAN_FRAME: Readonly<CabinetPlanCamera> = Object.freeze({ x: 0, y: 0, width: 760, height: 500 });
export const CABINET_PLAN_LAYERS: ReadonlyArray<{ value: CabinetPlanLayer; label: string }> = [
  { value: "all", label: "All objects" }, { value: "lower", label: "Base, tall & islands" },
  { value: "upper", label: "Wall cabinets" }, { value: "panels", label: "Fillers & panels" },
];

/** Layer visibility changes hit testing, not the canonical model or its collision checks. */
export function cabinetOnPlanLayer(module: CabinetPlannerModule, layer: CabinetPlanLayer): boolean {
  return layer === "all" || (layer === "panels" ? isCabinetAccessory(module) :
    layer === "upper" ? module.kind === "wall-cabinet" : module.kind !== "wall-cabinet" && !isCabinetAccessory(module));
}
export function cabinetPlanProjection(planner: CabinetPlannerExtensionV1) {
  const width = planner.shell.widthIn, depth = planner.shell.depthIn;
  const scale = width && depth ? Math.min(620 / width, 360 / depth) : 1;
  return { scale, originX: (760 - (width ?? 0) * scale) / 2, originY: (500 - (depth ?? 0) * scale) / 2 };
}
function cameraAt(width: number, cx: number, cy: number): CabinetPlanCamera {
  const safeWidth = Math.max(760 / 6, Math.min(760, Number.isFinite(width) ? width : 760));
  const height = safeWidth * 500 / 760;
  return {
    x: Math.max(0, Math.min(760 - safeWidth, cx - safeWidth / 2)),
    y: Math.max(0, Math.min(500 - height, cy - height / 2)), width: safeWidth, height,
  };
}
export function zoomCabinetPlan(camera: CabinetPlanCamera, factor: number): CabinetPlanCamera {
  if (!Number.isFinite(factor) || factor <= 0) return { ...camera };
  return cameraAt(camera.width / factor, camera.x + camera.width / 2, camera.y + camera.height / 2);
}
export function frameCabinetInPlan(planner: CabinetPlannerExtensionV1, id: string | null): CabinetPlanCamera | null {
  const module = planner.modules.find(item => item.id === id);
  if (!module || planner.shell.widthIn === null || planner.shell.depthIn === null) return null;
  const bounds = getCabinetModuleBounds(planner, module);
  if (!bounds) return null;
  const { scale, originX, originY } = cabinetPlanProjection(planner);
  const width = (bounds.x2 - bounds.x1) * scale, height = (bounds.z2 - bounds.z1) * scale;
  const targetWidth = Math.max(width + 72, (height + 72) * 760 / 500);
  return cameraAt(targetWidth, originX + (bounds.x1 + bounds.x2) * scale / 2, originY + (bounds.z1 + bounds.z2) * scale / 2);
}
