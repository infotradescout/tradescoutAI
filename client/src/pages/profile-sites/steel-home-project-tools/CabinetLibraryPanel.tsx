import { useEffect, useMemo, useRef, useState } from "react";
import {
  CABINET_STUDIO_FINISHES, getCabinetModuleBounds, getCabinetPlannerDiagnostics,
  isCabinetAccessory, isCountedCabinet,
  type CabinetPlannerExtensionV1, type CabinetPlannerModule, type CabinetPresentation,
} from "./cabinetPlannerModel";
import { buildCabinetCaseworkParts } from "./cabinetCasework";
import {
  CABINET_ALL_PRESETS, cabinetLibrarySelection, cabinetSchedule, cabinetScheduleCsv,
  findCabinetLibraryWallGap, proposeLibraryCabinet, type CabinetLibrarySelection,
} from "./cabinetLibrary";

type Props = {
  planner: CabinetPlannerExtensionV1;
  view: "library" | "schedule";
  onChange: (planner: CabinetPlannerExtensionV1) => void;
  onClose: () => void;
};
const control = "min-h-11 rounded-lg border border-[#18312f]/25 bg-white px-3 py-2 text-sm text-[#18312f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a94f2e] disabled:opacity-40";
const newId = () => `cabinet-module-${crypto.randomUUID()}`;

/** Front projections use the same parts as the orbitable renderer, not a second cabinet model. */
function CabinetFrontShapes({ module, presentation }: { module: CabinetPlannerModule; presentation?: CabinetPresentation }) {
  const finish = CABINET_STUDIO_FINISHES.find(item => item.value === presentation?.finish)?.color ?? "#d5d0c5";
  const hardware = presentation?.hardware;
  const metal = hardware === "Brushed brass" ? "#b59a5c" : hardware === "Matte black" ? "#24282a" : "#9da6a8";
  const parts = buildCabinetCaseworkParts(module, presentation).sort((a, b) => a.centerIn[2] - b.centerIn[2]);
  if (module.kind === "appliance") return <rect x={-module.widthIn / 2} y={0} width={module.widthIn} height={module.heightIn} fill="none" stroke="#647780" strokeWidth={.3} strokeDasharray="2 2" />;
  return <g data-front-arrangement={isCabinetAccessory(module) ? "panel" : presentation?.fronts[module.id] ?? "generic"}>
    {parts.map((part, index) => <rect key={index} data-casework-role={part.role}
      x={part.centerIn[0] - part.sizeIn[0] / 2} y={module.heightIn - part.centerIn[1] - part.sizeIn[1] / 2}
      width={part.sizeIn[0]} height={part.sizeIn[1]}
      fill={part.role === "handle" ? metal : part.role === "toe-kick" ? "#514c43" : part.role === "glass" ? "#b5d0d1" : finish}
      fillOpacity={part.role === "glass" ? .45 : 1} stroke="#526057" strokeWidth={.06} />)}
  </g>;
}

function ScheduleElevations({ planner }: { planner: CabinetPlannerExtensionV1 }) {
  const { widthIn, depthIn, heightIn } = planner.shell;
  if (widthIn === null || depthIn === null || heightIn === null) return <p>Room measurements are needed for wall elevations.</p>;
  return <div className="grid gap-4 sm:grid-cols-2" aria-label="Scheduled cabinet elevations">
    {(["north", "east", "south", "west"] as const).map(wall => {
      const length = wall === "north" || wall === "south" ? widthIn : depthIn;
      return <figure key={wall} className="min-w-0 rounded-xl border border-[#18312f]/15 bg-[#faf8f3] p-3">
        <figcaption className="text-sm font-bold capitalize">{wall} wall · {length} × {heightIn} in</figcaption>
        <svg viewBox={`-2 -2 ${length + 4} ${heightIn + 4}`} className="h-48 w-full" role="img" aria-label={`${wall} scheduled cabinet fronts`} data-testid={`cabinet-schedule-elevation-${wall}`}>
          <rect x={0} y={0} width={length} height={heightIn} fill="#eee8dd" stroke="#53625e" strokeWidth={.3} />
          {planner.shellItems.filter(item => item.wall === wall).map(item => <rect key={item.id} x={item.offsetIn} y={heightIn - item.elevationIn - item.heightIn} width={item.widthIn} height={item.heightIn} fill="#b2cbcb" stroke="#53625e" strokeWidth={.3} />)}
          {planner.modules.filter(module => module.surface === wall).map(module => <g key={module.id} data-elevation-module={module.id}
            transform={`translate(${module.offsetIn + module.widthIn / 2} ${heightIn - module.elevationIn - module.heightIn})`}>
            <title>{module.label}: {module.widthIn} × {module.depthIn} × {module.heightIn} in</title>
            <CabinetFrontShapes module={module} presentation={planner.presentation} />
          </g>)}
        </svg>
      </figure>;
    })}
    <p className="text-xs sm:col-span-2">Front details are illustrative and match the 3D casework parts. Floor cabinets and panels remain in the plan, 3D view and schedule; these elevations show wall-attached modules.</p>
  </div>;
}

export default function CabinetLibraryPanel({ planner, view, onChange, onClose }: Props) {
  const [selection, setSelection] = useState<CabinetLibrarySelection | null>(null);
  const [id, setId] = useState(newId);
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [view]);
  const proposal = useMemo(() => selection ? proposeLibraryCabinet(planner, selection, id) : null, [planner, selection, id]);
  const rows = useMemo(() => cabinetSchedule(planner), [planner]);
  const cabinetCount = planner.modules.filter(isCountedCabinet).length;
  const accessoryCount = planner.modules.filter(isCabinetAccessory).length;
  const applianceCount = planner.modules.filter(module => module.kind === "appliance").length;
  const selectedPreset = CABINET_ALL_PRESETS.find(item => item.id === selection?.presetId);
  const accessorySelected = !!selectedPreset && isCabinetAccessory(selectedPreset);
  const diagnostics = getCabinetPlannerDiagnostics(planner);
  const numeric = (key: keyof Omit<CabinetLibrarySelection, "presetId" | "surface">, label: string, max: number, min = 0) => <label className="grid min-w-0 gap-1 text-xs font-bold" key={key}>
    {label}<input aria-label={`Library ${label}`} type="number" inputMode="decimal" min={min} max={max} step="0.125" value={selection?.[key] ?? ""}
      placeholder="Enter measurement" className={`${control} w-full min-w-0`} onChange={event => {
        const raw = event.target.value;
        setSelection(current => current ? { ...current, [key]: raw === "" ? null : Number(raw) } : null);
        setNotice("");
      }} />
  </label>;
  const exportSchedule = () => {
    try {
      const url = URL.createObjectURL(new Blob([cabinetScheduleCsv(planner)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = "tradescout-cabinet-schedule.csv";
      try { document.body.append(link); link.click(); }
      finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setNotice("Schedule download started. Notes and customer contact details are not included.");
    } catch { setNotice("Download unavailable. The complete schedule remains visible below."); }
  };
  return <section aria-label={view === "library" ? "Cabinet configuration library" : "Cabinet schedule"}
    className="max-h-[75vh] min-w-0 shrink-0 overflow-y-auto border-b border-[#18312f]/20 bg-[#f7f3ec] p-4 text-[#18312f] sm:p-5" data-testid="cabinet-library-panel">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 ref={heading} tabIndex={-1} className="text-lg font-bold focus:outline-none">{view === "library" ? "Cabinet configuration library" : "Cabinet schedule"}</h2>
        <p className="text-sm" data-testid="cabinet-schedule-count">{cabinetCount} cabinets · {applianceCount} appliance spaces{accessoryCount > 0 ? ` · ${accessoryCount} accessories` : ""}</p></div>
      <button type="button" className={control} onClick={onClose}>Close library and schedule</button>
    </header>
    {view === "library" ? <>
      <p className="mb-3 text-sm">Choose a configuration, review its dimensions and location, then add it. These are editable planning sizes, not manufacturer products or prices. Existing cabinets are never moved automatically.</p>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {CABINET_ALL_PRESETS.map(preset => <button key={preset.id} type="button" className={`${control} text-left`} aria-pressed={selection?.presetId === preset.id}
          data-testid={`cabinet-${isCabinetAccessory(preset) ? "accessory" : "library"}-${preset.id}`} onClick={() => { setSelection(cabinetLibrarySelection(preset.id)); setNotice(""); }}>
          <strong className="block">{preset.label}</strong><span className="block text-xs">{preset.widthIn} W × {preset.depthIn} D × {preset.heightIn} H in · elevation {preset.elevationIn} in</span>
          {isCabinetAccessory(preset) && <span className="block text-xs">Accessory · wall setback {preset.wallInsetIn} in</span>}
        </button>)}
      </div>
      {selection && <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          {accessorySelected && <p className="text-sm">Enter the actual panel dimensions, not a full cabinet box. Wall setback is measured to the back of the panel; it is ignored for floor placement. Accessories are counted separately and are not assumed countertop supports.</p>}
          <div className="grid grid-cols-2 gap-3">
            {numeric("widthIn", "Width in", 240, .125)}{numeric("depthIn", "Depth in", 120, .125)}
            {numeric("heightIn", "Height in", 240, .125)}{numeric("elevationIn", "Elevation in", 240)}
            <label className="grid min-w-0 gap-1 text-xs font-bold">Placement
              <select aria-label="Library placement" className={`${control} w-full min-w-0`} value={selection.surface} onChange={event => {
                const surface = event.target.value as CabinetLibrarySelection["surface"];
                setSelection({ ...selection, surface, offsetIn: 0, roomDepthOffsetIn: surface === "floor" ? null : 0 }); setNotice("");
              }}>
                {(selectedPreset?.kind === "island" ? ["floor"] : ["north", "east", "south", "west", "floor"]).map(surface => <option key={surface} value={surface}>{surface === "floor" ? "Floor / island" : `${surface} wall`}</option>)}
              </select>
            </label>
            {numeric("offsetIn", selection.surface === "floor" ? "X from west in" : "Offset from wall start in", 720)}
            {selection.surface === "floor" && numeric("roomDepthOffsetIn", "Y from north in", 720)}
            {accessorySelected && selection.surface !== "floor" && numeric("wallInsetIn", "Wall setback in", 720)}
          </div>
          {selection.surface !== "floor" && <button type="button" className={control} onClick={() => {
            const offset = findCabinetLibraryWallGap(planner, selection, id);
            if (offset === null) setNotice("No fitting wall space found at these dimensions. Change the wall or dimensions; nothing was added.");
            else { setSelection({ ...selection, offsetIn: offset }); setNotice(`Proposed wall offset: ${offset} in. Review it, then Add to plan.`); }
          }}>Find wall space</button>}
          <div className="text-sm" role="status">
            {proposal?.problems.map(problem => <p key={problem} className="mb-1 text-[#8f3329]">{problem}</p>)}
            {proposal && !proposal.problems.length && <p>Placement fits the recorded geometry. Working clearances and door swings still require review.</p>}
          </div>
          <button type="button" className={`${control} font-bold`} data-testid="cabinet-library-add" disabled={!proposal?.planner || !!proposal.problems.length} onClick={() => {
            // Re-evaluate the current props at the commit boundary; preview alone never saves.
            const current = proposeLibraryCabinet(planner, selection, id);
            if (!current.planner || current.problems.length) { setNotice(current.problems.join(" ")); return; }
            onChange(current.planner); setId(newId());
            setNotice(`${current.module!.label} added. One Undo removes this addition. Measurements need review.`);
          }}>Add to plan</button>
        </div>
        <div className="min-w-0 rounded-xl border border-[#18312f]/15 bg-white p-3">
          {proposal?.module && proposal.planner ? <>
            <h3 className="text-sm font-bold">Proposed front · {proposal.module.widthIn} × {proposal.module.heightIn} in</h3>
            <svg role="img" aria-label="Proposed cabinet front" className="h-48 w-full" viewBox={`${-proposal.module.widthIn / 2 - 1} -1 ${proposal.module.widthIn + 2} ${proposal.module.heightIn + 2}`}>
              <CabinetFrontShapes module={proposal.module} presentation={proposal.planner.presentation} />
            </svg>
            <p className="text-xs">{accessorySelected ? "Simple panel geometry uses the selected finish, with no doors, drawer fronts or hardware." : "Same illustrative front parts as 3D. Style, finish and hardware use your existing selections."}</p>
            <h3 className="mt-3 text-sm font-bold">Proposed plan position</h3>
            <svg role="img" aria-label="Proposed cabinet placement" className="h-48 w-full" viewBox={`-4 -4 ${planner.shell.widthIn! + 8} ${planner.shell.depthIn! + 8}`}>
              <rect width={planner.shell.widthIn!} height={planner.shell.depthIn!} fill="#faf8f3" stroke="#53625e" strokeWidth={.4} />
              {proposal.planner.modules.map(module => {
                const bounds = getCabinetModuleBounds(proposal.planner!, module)!;
                return <rect key={module.id} x={bounds.x1} y={bounds.z1} width={bounds.x2 - bounds.x1} height={bounds.z2 - bounds.z1}
                  fill={module.id === id ? (proposal.problems.length ? "#ce9588" : "#98b8aa") : "#d4c3a9"} fillOpacity={module.kind === "wall-cabinet" ? .45 : .9}
                  stroke="#53625e" strokeDasharray={module.id === id ? "2 1" : undefined} strokeWidth={.5}><title>{module.label}</title></rect>;
              })}
            </svg>
          </> : <p className="text-sm">Complete the dimensions to see the proposed cabinet. Nothing is added until you choose Add to plan.</p>}
        </div>
      </div>}
    </> : <>
      <p className="mb-3 text-sm">Counts come from placed modules, not estimates. Appliance spaces and accessory panels are listed separately from cabinets. Dimensions are inches; this is a planning schedule, not an order or shop drawing.</p>
      <button type="button" disabled={!rows.length} onClick={exportSchedule} className={`${control} mb-3`}>Export cabinet schedule</button>
      {diagnostics.length > 0 && <p role="status" className="mb-3 text-sm text-[#8f3329]">{diagnostics.length} planning checks remain unresolved. Review the measured plan before ordering.</p>}
      <div className="mb-4 max-w-full overflow-x-auto rounded-xl border border-[#18312f]/15 bg-white">
        <table className="w-full text-left text-sm" aria-label="Dimensioned cabinet schedule">
          <thead><tr>{["Qty", "Configuration", "W × D × H in", "Fronts", "Placements"].map(label => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-[#18312f]/10" data-testid="cabinet-schedule-row">
            <td className="px-3 py-2">{row.quantity}</td><td className="px-3 py-2">{row.label}{row.kind === "appliance" && <span className="block text-xs">Appliance space only</span>}{isCabinetAccessory(row) && <span className="block text-xs">Accessory, not a cabinet</span>}</td>
            <td className="whitespace-nowrap px-3 py-2">{row.widthIn} × {row.depthIn} × {row.heightIn}</td><td className="px-3 py-2">{row.front}</td>
            <td className="px-3 py-2">{row.placements.map((placement, i) => <p key={i}>{placement}</p>)}</td>
          </tr>)}</tbody>
        </table>
        {!rows.length && <p className="p-3">No modules placed yet.</p>}
      </div>
      <ScheduleElevations planner={planner} />
    </>}
    {notice && <p role="status" className="mt-3 text-sm font-semibold">{notice}</p>}
  </section>;
}
