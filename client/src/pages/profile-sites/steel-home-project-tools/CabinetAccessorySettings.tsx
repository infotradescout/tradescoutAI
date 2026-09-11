import { useEffect, useMemo, useState } from "react";
import { isCabinetAccessory, reconcileCabinetPlannerExtension, type CabinetPlannerExtensionV1 } from "./cabinetPlannerModel";
import { proposeLibraryCabinet } from "./cabinetLibrary";

export function proposeAccessorySetback(input: CabinetPlannerExtensionV1, id: string, setback: number) {
  const planner = reconcileCabinetPlannerExtension(input);
  const module = planner.modules.find(item => item.id === id);
  if (!module || !isCabinetAccessory(module) || module.surface === "floor") {
    return { next: null, problems: ["Select a wall-placed accessory."] };
  }
  if (!Number.isFinite(setback) || setback < 0 || setback > 720 || Math.abs(setback * 8 - Math.round(setback * 8)) > 1e-7) {
    return { next: null, problems: ["Enter a wall setback from 0 to 720 inches on the 1/8-inch grid."] };
  }
  // Reuse the addition check without committing its temporary ordering or default label.
  const check = proposeLibraryCabinet({ ...planner, modules: planner.modules.filter(item => item.id !== id) }, {
    presetId: module.kind, surface: module.surface,
    widthIn: module.widthIn, depthIn: module.depthIn, heightIn: module.heightIn,
    elevationIn: module.elevationIn, offsetIn: module.offsetIn,
    roomDepthOffsetIn: module.roomDepthOffsetIn, wallInsetIn: setback,
  }, id);
  if (check.problems.length) return { next: null, problems: check.problems };
  return {
    next: reconcileCabinetPlannerExtension({ ...planner,
      modules: planner.modules.map(item => item.id === id ? { ...item, wallInsetIn: setback } : item),
      shell: { ...planner.shell, measurementsReviewed: false },
    }),
    problems: [],
  };
}

type Props = { planner: CabinetPlannerExtensionV1; onChange: (planner: CabinetPlannerExtensionV1) => void };
export default function CabinetAccessorySettings({ planner, onChange }: Props) {
  const module = planner.modules.find(item => item.id === planner.selectedModuleId);
  const [value, setValue] = useState(String(module?.wallInsetIn ?? 0));
  const [notice, setNotice] = useState("");
  useEffect(() => { setValue(String(module?.wallInsetIn ?? 0)); setNotice(""); }, [module?.id, module?.wallInsetIn]);
  const proposal = useMemo(() => proposeAccessorySetback(planner, module?.id ?? "", value.trim() ? Number(value) : NaN), [planner, module?.id, value]);
  if (!module || !isCabinetAccessory(module)) return null;
  return <section aria-label="Selected accessory settings" className="border-b border-[#18312f]/20 bg-[#f7f3ec] p-4 text-sm text-[#18312f]">
    <p className="font-bold">{module.label} · accessory, not a cabinet</p>
    <p className="mb-2">Panel dimensions are edited in the measured module controls. Panels use the selected finish, not cabinet doors or hardware. Countertop support is not assumed.</p>
    {module.surface !== "floor" ? <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">Back of panel from {module.surface} wall (in)
          <input aria-label="Selected accessory wall setback" type="number" inputMode="decimal" min={0} max={720} step={0.125}
            value={value} onChange={event => { setValue(event.target.value); setNotice(""); }}
            className="min-h-11 w-40 rounded-lg border border-[#18312f]/30 bg-white px-3" />
        </label>
        <button type="button" disabled={!proposal.next || Number(value) === module.wallInsetIn}
          className="min-h-11 rounded-lg border border-[#18312f]/30 bg-white px-3 disabled:opacity-40"
          onClick={() => {
            const latest = proposeAccessorySetback(planner, module.id, value.trim() ? Number(value) : NaN);
            if (!latest.next) { setNotice(latest.problems.join(" ")); return; }
            onChange(latest.next); setNotice("Panel setback applied. One Undo restores its previous placement.");
          }}>Apply panel setback</button>
      </div>
      {proposal.problems.map(problem => <p role="status" key={problem} className="mt-2 text-[#8f3329]">{problem}</p>)}
    </> : <p>Floor-placed panels use the measured X/Y position; wall setback does not apply.</p>}
    {notice && <p role="status" className="mt-2">{notice}</p>}
  </section>;
}
