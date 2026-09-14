import { useState } from "react";
import { CABINET_STUDIO_FINISHES, isCabinetAccessory, type CabinetPlannerModule, type CabinetPresentation } from "./cabinetPlannerModel";
import { buildCabinetCaseworkParts } from "./cabinetCasework";
import { CABINET_ALL_PRESETS, type CabinetLibraryPreset } from "./cabinetLibrary";
import "./cabinetCanvasWorkflow.css";

type Group = "all" | "base" | "wall" | "tall" | "islands" | "panels";
const groups: ReadonlyArray<{ value: Group; label: string }> = [
  { value: "all", label: "All cabinet types" }, { value: "base", label: "Base & vanity" },
  { value: "wall", label: "Wall cabinets" }, { value: "tall", label: "Pantries" },
  { value: "islands", label: "Island cabinets" }, { value: "panels", label: "Fillers & panels" },
];
function inGroup(preset: CabinetLibraryPreset, group: Group) {
  return group === "all" || (group === "panels" ? isCabinetAccessory(preset) :
    group === "base" ? preset.kind === "base-cabinet" : group === "wall" ? preset.kind === "wall-cabinet" :
    group === "tall" ? preset.kind === "tall-cabinet" : preset.kind === "island");
}

/** Catalog illustrations use real preset envelopes and the SAME casework parts as 3D. They never create a draft. */
export function CabinetCatalogThumbnail({ preset, presentation }: { preset: CabinetLibraryPreset; presentation?: CabinetPresentation }) {
  const id = `catalog-${preset.id}`;
  const module: CabinetPlannerModule = {
    id, label: preset.label, kind: preset.kind, surface: preset.kind === "island" ? "floor" : "north",
    widthIn: preset.widthIn, depthIn: preset.depthIn, heightIn: preset.heightIn,
    elevationIn: preset.elevationIn, offsetIn: 0, roomDepthOffsetIn: 0,
    ...(isCabinetAccessory(preset) ? { wallInsetIn: preset.wallInsetIn ?? 0 } : {}),
  };
  const appearance: CabinetPresentation = {
    style: presentation?.style ?? null, finish: presentation?.finish ?? null, hardware: presentation?.hardware ?? null,
    fronts: preset.front ? { [id]: preset.front } : {},
  };
  const finish = CABINET_STUDIO_FINISHES.find(item => item.value === appearance.finish)?.color ?? "#d9d2c4";
  const metal = appearance.hardware === "Brushed brass" ? "#b59a5c" : appearance.hardware === "Matte black" ? "#24282a" : "#9da6a8";
  const parts = buildCabinetCaseworkParts(module, appearance).sort((a, b) => a.centerIn[2] - b.centerIn[2]);
  const w = module.widthIn, h = module.heightIn, dx = module.depthIn * .34, dy = module.depthIn * .2;
  const pad = Math.max(w, h, module.depthIn) * .12;
  return <svg className="cabinet-catalog-thumbnail" viewBox={`${-w / 2 - pad} ${-dy - pad} ${w + dx + 2 * pad} ${h + dy + 2 * pad}`} role="img" aria-label={`${preset.label} configuration preview`}>
    <polygon points={`${w / 2},0 ${w / 2 + dx},${-dy} ${w / 2 + dx},${h - dy} ${w / 2},${h}`} fill={finish} stroke="#68756b" strokeWidth=".35" />
    <polygon points={`${w / 2},0 ${w / 2 + dx},${-dy} ${w / 2 + dx},${h - dy} ${w / 2},${h}`} fill="#24362f" fillOpacity=".16" />
    <polygon points={`${-w / 2},0 ${-w / 2 + dx},${-dy} ${w / 2 + dx},${-dy} ${w / 2},0`} fill={finish} stroke="#68756b" strokeWidth=".35" />
    {parts.map((part, index) => <rect key={index} data-catalog-role={part.role}
      x={part.centerIn[0] - part.sizeIn[0] / 2} y={h - part.centerIn[1] - part.sizeIn[1] / 2}
      width={part.sizeIn[0]} height={part.sizeIn[1]}
      fill={part.role === "handle" ? metal : part.role === "toe-kick" ? "#514c43" : part.role === "glass" ? "#b5d0d1" : finish}
      fillOpacity={part.role === "glass" ? .45 : 1} stroke="#637167" strokeWidth={part.role === "handle" ? .06 : .18} />)}
  </svg>;
}

export default function CabinetCatalogGallery({ selectedId, presentation, onSelect }: {
  selectedId?: string; presentation?: CabinetPresentation; onSelect: (id: string) => void;
}) {
  const [group, setGroup] = useState<Group>("all");
  const [expanded, setExpanded] = useState(false);
  const compact = Boolean(selectedId) && !expanded;
  return <div className="cabinet-visual-catalog" data-testid="cabinet-visual-catalog" data-compact={compact}>
    <div className="cabinet-catalog-heading">
      <label><span className="sr-only">Cabinet catalog group</span><select aria-label="Cabinet catalog group" value={group} onChange={event => { setGroup(event.target.value as Group); setExpanded(true); }}>{groups.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {selectedId && <button type="button" onClick={() => setExpanded(value => !value)}>{compact ? "Browse types" : "Compact list"}</button>}
    </div>
    <div className="cabinet-catalog-cards" aria-label="Cabinet configuration choices">
      {CABINET_ALL_PRESETS.filter(preset => inGroup(preset, group)).map(preset => <button key={preset.id} type="button" className="cabinet-catalog-card" aria-pressed={selectedId === preset.id}
        data-testid={`cabinet-${isCabinetAccessory(preset) ? "accessory" : "library"}-${preset.id}`} onClick={() => { onSelect(preset.id); setExpanded(false); }}>
        <CabinetCatalogThumbnail preset={preset} presentation={presentation} />
        <strong>{preset.label}</strong>
        <span>{preset.widthIn} × {preset.depthIn} × {preset.heightIn} in</span>
        {isCabinetAccessory(preset) && <small>Accessory · not a cabinet</small>}
      </button>)}
    </div>
  </div>;
}
