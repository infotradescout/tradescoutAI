import * as geometry from "./cabinetPlannerGeometry";
export * from "./cabinetPlannerGeometry";

// Optional, additive presentation data. Existing measured drafts retain their geometry.
export const CABINET_STUDIO_STYLES = ["Shaker", "Slab", "Raised panel", "Glass accent"] as const;
export const CABINET_STUDIO_FINISHES = [
  { value: "natural-oak", label: "Natural oak", color: "#b58d62" },
  { value: "warm-walnut", label: "Warm walnut", color: "#76533f" },
  { value: "soft-white", label: "Soft white", color: "#e9e3d8" },
  { value: "sage", label: "Sage", color: "#7e8c7b" },
  { value: "navy", label: "Navy", color: "#334658" },
  { value: "charcoal", label: "Charcoal", color: "#474b4b" },
] as const;
export const CABINET_STUDIO_HARDWARE = ["Matte black", "Brushed brass", "Brushed nickel", "Polished chrome", "None"] as const;
export const CABINET_FRONT_LAYOUTS = ["doors", "drawers", "sink", "open"] as const;
export type CabinetPresentation = {
  style: (typeof CABINET_STUDIO_STYLES)[number] | null;
  finish: (typeof CABINET_STUDIO_FINISHES)[number]["value"] | null;
  hardware: (typeof CABINET_STUDIO_HARDWARE)[number] | null;
  fronts: Record<string, (typeof CABINET_FRONT_LAYOUTS)[number]>;
};
export type CabinetPlannerExtensionV1 = geometry.CabinetPlannerExtensionV1 & {
  presentation?: CabinetPresentation;
};
export function reconcileCabinetPlannerExtension(value: unknown): CabinetPlannerExtensionV1 {
  const measured = geometry.reconcileCabinetPlannerExtension(value);
  const raw = value && typeof value === "object" ? (value as { presentation?: unknown }).presentation : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return measured;
  const source = raw as Partial<CabinetPresentation>;
  const fronts: CabinetPresentation["fronts"] = Object.create(null);
  for (const module of measured.modules) {
    const candidate = source.fronts && Object.prototype.hasOwnProperty.call(source.fronts, module.id) ? source.fronts[module.id] : null;
    if (CABINET_FRONT_LAYOUTS.includes(candidate as (typeof CABINET_FRONT_LAYOUTS)[number])) fronts[module.id] = candidate as (typeof CABINET_FRONT_LAYOUTS)[number];
  }
  return { ...measured, presentation: {
    style: CABINET_STUDIO_STYLES.includes(source.style as (typeof CABINET_STUDIO_STYLES)[number]) ? source.style! : null,
    finish: CABINET_STUDIO_FINISHES.some(finish => finish.value === source.finish) ? source.finish! : null,
    hardware: CABINET_STUDIO_HARDWARE.includes(source.hardware as (typeof CABINET_STUDIO_HARDWARE)[number]) ? source.hardware! : null,
    fronts,
  } };
}
export function buildCabinetPlannerRequestBrief(input: CabinetPlannerExtensionV1): string {
  const state = reconcileCabinetPlannerExtension(input);
  const brief = geometry.buildCabinetPlannerRequestBrief(state);
  if (!state.presentation) return brief;
  const p = state.presentation;
  return [brief, "", "Appearance preferences (illustrative, not a manufacturer specification)",
    `Door style: ${p.style ?? "Not selected"}`,
    `Finish: ${CABINET_STUDIO_FINISHES.find(finish => finish.value === p.finish)?.label ?? "Not selected"}`,
    `Hardware: ${p.hardware ?? "Not selected"}`,
    ...state.modules.filter(module => p.fronts[module.id]).map(module => `${module.label}: ${p.fronts[module.id]} front arrangement`),
  ].join("\n");
}
export function duplicateCabinetModule(input: CabinetPlannerExtensionV1, id: string, newId: string): CabinetPlannerExtensionV1 {
  const state = reconcileCabinetPlannerExtension(input);
  const source = state.modules.find(module => module.id === id);
  if (!source || !newId || newId.length > 80 || state.modules.length >= 120 || state.modules.some(module => module.id === newId)) return state;
  const module = { ...source, id: newId, offsetIn: source.offsetIn + source.widthIn };
  return reconcileCabinetPlannerExtension({ ...state,
    shell: { ...state.shell, measurementsReviewed: false },
    modules: [...state.modules, module], selectedModuleId: newId,
    ...(state.presentation ? { presentation: { ...state.presentation, fronts: {
      ...state.presentation.fronts,
      ...(state.presentation.fronts[id] ? { [newId]: state.presentation.fronts[id] } : {}),
    } } } : {}),
  });
}
