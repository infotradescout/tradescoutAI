import { useEffect, useId, useMemo, useState } from "react";
import { STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY, type SteelHomeCabinetDesign, type SteelHomeCountertopDesign } from "./projectModel";
import { EMPTY_TRANSFER_OPTIONS, proposeCabinetCountertopTransfer, type TransferOptions, type TransferRect } from "./cabinetCountertopTransfer";
import { equalCountertopSnapshots, loadCountertopTransferBackup, saveCountertopTransferBackup } from "./countertopTransferBackup";

type Props = {
  cabinets: SteelHomeCabinetDesign;
  current: SteelHomeCountertopDesign;
  onApply: (next: SteelHomeCountertopDesign) => void;
  onClose: () => void;
};
const storage = () => { try { return window.localStorage; } catch { return null; } };
const measure = (value: number | null) => value === null ? "Unresolved" : `${value} in`;
const layoutName = (value: SteelHomeCountertopDesign["layout"]) => value === "straight" ? "Straight" : value === "l-shape" ? "L-shaped" : "U-shaped";
function description(design: SteelHomeCountertopDesign) {
  return `${layoutName(design.layout)}; main ${design.wallAIn} in; depth ${design.wallDepthIn} in${design.island ? `; island ${design.islandLengthIn} × ${design.islandWidthIn} in` : "; no island"}`;
}
function Footprint({ supports, excluded, tops, width, depth }: { supports: TransferRect[]; excluded: TransferRect[]; tops: TransferRect[]; width: number | null; depth: number | null }) {
  if (width === null || depth === null) return <p>Enter the room measurements in the cabinet planner to see the source footprint.</p>;
  const font = Math.max(width, depth) / 40;
  const padding = font * 3;
  const draw = (items: TransferRect[], kind: string) => items.map(r => <rect key={`${kind}-${r.id}`} data-transfer-shape={kind} data-source-module={r.id} x={r.x1} y={r.z1} width={Math.max(0, r.x2 - r.x1)} height={Math.max(0, r.z2 - r.z1)} fill={kind === "countertop" ? "#d9c8a7" : kind === "excluded" ? "#c9cecc" : "none"} fillOpacity={kind === "countertop" ? .65 : 1} stroke={kind === "support" ? "#18312f" : "#68736f"} strokeWidth={font / 9} strokeDasharray={kind === "support" ? `${font / 2} ${font / 3}` : undefined}><title>{r.label}: {r.x2 - r.x1} × {r.z2 - r.z1} inches; west {r.x1}, north {r.z1}</title></rect>);
  return <svg role="img" aria-label="Cabinet footprints and proposed countertop, equal scale on both axes" data-testid="cabinet-countertop-import-drawing" viewBox={`${-padding} ${-padding} ${width + padding * 2} ${depth + padding * 2}`} className="mt-3 block min-h-64 w-full rounded-xl border border-[#18312f]/20 bg-[#fbf9f3]" style={{ height: "min(55vh,480px)" }}>
    <rect x={0} y={0} width={width} height={depth} fill="none" stroke="#18312f" strokeWidth={font / 7} />
    {draw(excluded, "excluded")}{draw(tops, "countertop")}{draw(supports, "support")}
    <g fill="#18312f" fontSize={font} textAnchor="middle"><text x={width / 2} y={-font}>North · {width} in</text><text x={width / 2} y={depth + font * 2}>South · room depth {depth} in</text></g>
  </svg>;
}

export default function CabinetCountertopImport({ cabinets, current, onApply, onClose }: Props) {
  const headingId = useId();
  const [options, setOptions] = useState<TransferOptions>({ ...EMPTY_TRANSFER_OPTIONS });
  const [approved, setApproved] = useState("");
  const [mode, setMode] = useState<"import" | "restore">("import");
  const [notice, setNotice] = useState("");
  const [changedExternally, setChangedExternally] = useState(false);
  const [backup, setBackup] = useState(() => loadCountertopTransferBackup(storage()));
  const proposal = useMemo(() => proposeCabinetCountertopTransfer(cabinets, current, options), [cabinets, current, options]);
  const signature = JSON.stringify({ cabinets, current, options, mode });
  useEffect(() => {
    const otherTab = (event: StorageEvent) => {
      if (event.key === STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY || event.key === null) { setChangedExternally(true); setApproved(""); }
    };
    window.addEventListener("storage", otherTab);
    return () => window.removeEventListener("storage", otherTab);
  }, []);
  const apply = () => {
    if (changedExternally || approved !== signature) return;
    if (mode === "restore") {
      const stored = loadCountertopTransferBackup(storage());
      if (!stored || !backup || !equalCountertopSnapshots(stored, backup)) { setNotice("The restore point changed or is unavailable. Close and reopen this review."); return; }
      onApply(structuredClone(stored.previous));
      return;
    }
    const fresh = proposeCabinetCountertopTransfer(cabinets, current, options);
    if (!fresh.next || fresh.problems.length) return;
    const saved = saveCountertopTransferBackup(storage(), current, fresh.next);
    if (!saved) { setNotice("Import not applied: an exact restore point could not be saved. Keep this page open. Save and reopen the current design before retrying, and check browser storage availability."); return; }
    setBackup(saved);
    onApply(fresh.next);
  };
  const field = (key: keyof TransferOptions, label: string, max: number, min = 0) => <label key={key} className="grid gap-1 text-sm font-semibold">{label}<input aria-label={label} type="number" inputMode="decimal" min={min} max={max} step="0.125" placeholder="Enter inches" value={options[key] ?? ""} onChange={event => { const raw = event.target.value; setOptions(old => ({ ...old, [key]: raw === "" ? null : Number(raw) })); setNotice(""); }} className="min-h-11 min-w-0 rounded-lg border border-[#18312f]/25 bg-white px-3 text-base" /></label>;
  const openingCount = Number(current.sink !== "None") + Number(current.cooktop !== "None") + current.otherCutouts.length;
  return <section aria-labelledby={headingId} data-testid="cabinet-countertop-import" className="min-w-0 overflow-auto border-b border-[#18312f]/20 bg-[#f6f3ed] p-4 text-[#18312f] sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id={headingId} className="text-xl font-bold">Use cabinet layout for countertops</h2><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-[#18312f]/25 bg-white px-4 font-semibold">Cancel import</button></div>
    <p className="mt-2 max-w-3xl text-sm leading-6">Review a one-time copy of the measured cabinet footprint. Nothing changes until you apply it. The cabinet design is never replaced or linked to future countertop edits.</p>
    {backup && <div className="mt-3 rounded-lg border border-[#18312f]/20 bg-white p-3 text-sm"><p>Restore point on this device: {description(backup.previous)}. Created {backup.createdAt}.</p><button type="button" onClick={() => { setMode(old => old === "restore" ? "import" : "restore"); setApproved(""); setNotice(""); }} className="mt-2 min-h-11 rounded-lg border border-[#18312f]/25 px-3 font-semibold">{mode === "restore" ? "Return to import preview" : "Preview previous countertop"}</button></div>}
    {changedExternally && <p role="alert" className="mt-3 rounded-lg bg-[#fff0e8] p-3 font-semibold">The saved project changed in another tab. Reload the page before importing or restoring.</p>}
    {mode === "restore" && backup ? <div className="mt-4 space-y-3"><h3 className="text-lg font-semibold">Restore the design from before the last import</h3><p>Current: {description(current)}</p><p>Restore: {description(backup.previous)}</p><p className="text-sm">This replaces the current countertop design, including any edits since that import, with the previous stone, notes, measurements and cutout positions. Cabinets remain untouched. This restoration is also an Undo step.</p></div> : <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{field("frontOverhangIn", "Wall-run front overhang (in)", 12)}{field("thicknessIn", "Countertop thickness (in)", 6, .25)}</div>
      {proposal.hasIsland && <fieldset className="mt-4"><legend className="font-semibold">Island overhangs — enter every side, including zero</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">{field("islandWestIn", "Island west overhang (in)", 24)}{field("islandEastIn", "Island east overhang (in)", 24)}{field("islandNorthIn", "Island north overhang (in)", 24)}{field("islandSouthIn", "Island south overhang (in)", 24)}</div></fieldset>}
      <Footprint supports={proposal.supports} excluded={proposal.excluded} tops={proposal.problems.length ? [] : proposal.tops} width={proposal.roomWidthIn} depth={proposal.roomDepthIn} />
      <p className="mt-2 text-sm">Dashed outlines: {proposal.supports.length} supporting cabinet modules. Gray: {proposal.excluded.length} excluded upper/tall/appliance modules. Tan: proposed countertop. Drawing units are inches; both axes use the same scale.</p>
      {proposal.problems.length > 0 && <div className="mt-4 rounded-xl border border-[#9f4f35]/30 bg-[#fff0e8] p-4" role="status"><h3 className="font-bold">Resolve before importing</h3>{[...new Set(proposal.problems)].map(message => <p key={message} className="mt-2 text-sm leading-6">{message}</p>)}</div>}
      {proposal.next && <div className="mt-4 overflow-x-auto rounded-xl border border-[#18312f]/20 bg-white p-3"><h3 className="mb-2 text-lg font-semibold">Measured change review</h3><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Measurement</th><th className="p-2">Current</th><th className="p-2">Proposed</th></tr></thead><tbody>
        <tr><td className="p-2">Layout</td><td className="p-2">{layoutName(current.layout)}</td><td className="p-2">{layoutName(proposal.next.layout)}</td></tr>
        {([['wallAIn','Main run'],['wallDepthIn','Run depth'],['roomWidthIn','Room width'],['roomDepthIn','Room depth'],['finishedTopHeightIn','Finished top height'],['topThicknessIn','Thickness']] as const).map(([key, label]) => <tr key={key}><td className="p-2">{label}</td><td className="p-2">{measure(current[key])}</td><td className="p-2">{measure(proposal.next![key])}</td></tr>)}
        {proposal.next.layout !== "straight" && <tr><td className="p-2">Left return</td><td className="p-2">{current.layout === "straight" ? "Not used" : measure(current.wallBIn)}</td><td className="p-2">{measure(proposal.next.wallBIn)}</td></tr>}
        {proposal.next.layout === "u-shape" && <tr><td className="p-2">Right return</td><td className="p-2">{current.layout === "u-shape" ? measure(current.wallCIn) : "Not used"}</td><td className="p-2">{measure(proposal.next.wallCIn)}</td></tr>}
        <tr><td className="p-2">Island</td><td className="p-2">{current.island ? `${current.islandLengthIn} × ${current.islandWidthIn} in` : "None"}</td><td className="p-2">{proposal.next.island ? `${proposal.next.islandLengthIn} × ${proposal.next.islandWidthIn} in` : "None"}</td></tr>
        {proposal.next.island && <tr><td className="p-2">Island west / north offsets</td><td className="p-2">{measure(current.islandLeftOffsetIn)} / {measure(current.islandBackOffsetIn)}</td><td className="p-2">{measure(proposal.next.islandLeftOffsetIn)} / {measure(proposal.next.islandBackOffsetIn)}</td></tr>}
      </tbody></table></div>}
      {proposal.warnings.map(warning => <p key={warning} className="mt-3 text-sm leading-6">{warning}</p>)}
      <p className="mt-3 text-sm leading-6">{openingCount} existing fixture/opening selections will keep their template dimensions, but their locations must be placed again. Edge and backsplash choices remain editable in the countertop editor. Overhangs shown here are user entries, not engineering approval.</p>
      <p className="mt-2 text-sm leading-6">Apply saves one pre-import restore point on this browser, replacing any older import restore point. It is not a cloud backup and is not included in public plan links.</p>
    </>}
    <label className="mt-4 flex items-start gap-3 rounded-lg border border-[#18312f]/20 bg-white p-3 text-sm font-semibold"><input type="checkbox" checked={approved === signature} onChange={event => setApproved(event.target.checked ? signature : "")} className="mt-1 h-5 w-5 shrink-0" aria-label="Approve countertop replacement" /><span>{mode === "restore" ? "I reviewed the restore point and approve replacing the current countertop design, including later edits." : "I reviewed the proposed dimensions and approve replacing this countertop layout. Existing cutout locations will be cleared for review; cabinets stay unchanged."}</span></label>
    {notice && <p className="mt-3 text-sm font-semibold" role="alert">{notice}</p>}
    <button type="button" onClick={apply} disabled={changedExternally || approved !== signature || (mode === "restore" ? !backup : !proposal.next)} className="mt-4 min-h-12 rounded-lg bg-[#18312f] px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" data-testid="apply-cabinet-countertop-import">{mode === "restore" ? "Restore previous countertop design" : "Apply cabinet layout"}</button>
  </section>;
}
