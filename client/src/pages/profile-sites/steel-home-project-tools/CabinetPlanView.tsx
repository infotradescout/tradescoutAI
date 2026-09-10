import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getCabinetModuleBounds, type CabinetPlannerExtensionV1, type CabinetShellItem } from "./cabinetPlannerModel";
import { cabinetMovePosition, proposeCabinetMove, type CabinetMoveProposal } from "./cabinetPlacement";

type Props = {
  planner: CabinetPlannerExtensionV1;
  onSelectModule: (id: string) => void;
  onChange: (planner: CabinetPlannerExtensionV1) => void;
};
type Drag = {
  id: string; pointer: number; element: SVGGElement;
  baseline: CabinetPlannerExtensionV1; signature: string;
  startX: number; startY: number; clientX: number; clientY: number;
  moved: boolean;
};
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Temporary drag geometry is local; only a valid pointer-up reaches the saved draft and undo stack. */
export default function CabinetPlanView({ planner, onSelectModule, onChange }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<CabinetMoveProposal | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapping, setSnapping] = useState(true);
  const [notice, setNotice] = useState("");
  const helpId = useId();
  const signature = JSON.stringify(planner);
  const latestSignature = useRef(signature); latestSignature.current = signature;
  const width = planner.shell.widthIn, depth = planner.shell.depthIn;
  const scale = width && depth ? Math.min(620 / width, 360 / depth) : 1;
  const originX = (760 - (width ?? 0) * scale) / 2;
  const originY = (500 - (depth ?? 0) * scale) / 2;
  const release = () => {
    const current = drag.current; drag.current = null;
    if (current?.element.hasPointerCapture?.(current.pointer)) current.element.releasePointerCapture(current.pointer);
  };
  const cancel = useCallback(() => {
    if (!drag.current) return;
    release(); setPreview(null); setActiveId(null); setNotice("Move cancelled. Saved measurements are unchanged.");
  }, []);
  useEffect(() => { if (drag.current && drag.current.signature !== signature) cancel(); }, [signature, cancel]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel); window.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", hidden); release();
    };
  }, [cancel]);
  const point = (event: { clientX: number; clientY: number }) => {
    const node = svg.current, matrix = node?.getScreenCTM();
    if (!node || !matrix) return null;
    try {
      const p = node.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      const result = p.matrixTransform(matrix.inverse());
      return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : null;
    } catch { return null; }
  };
  const begin = (event: ReactPointerEvent<SVGGElement>, id: string) => {
    if (drag.current || event.button !== 0 || !event.isPrimary) return;
    const p = point(event);
    if (!p || !proposeCabinetMove(planner, id, 0, 0, 0)) {
      onSelectModule(id); setNotice("Enter complete room measurements before moving this module."); return;
    }
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus();
    try { event.currentTarget.setPointerCapture(event.pointerId); }
    catch { setNotice("Dragging is unavailable. Use the movement buttons or exact measurement inputs."); onSelectModule(id); return; }
    drag.current = { id, pointer: event.pointerId, element: event.currentTarget, baseline: planner, signature,
      startX: p.x, startY: p.y, clientX: event.clientX, clientY: event.clientY, moved: false };
    setActiveId(id); setNotice("");
  };
  const propose = (event: ReactPointerEvent<SVGGElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return null;
    if (current.signature !== latestSignature.current) { cancel(); return null; }
    const p = point(event); if (!p) { cancel(); return null; }
    current.moved ||= Math.hypot(event.clientX - current.clientX, event.clientY - current.clientY) >= 3;
    if (!current.moved) return null;
    return proposeCabinetMove(current.baseline, current.id, (p.x - current.startX) / scale, (p.y - current.startY) / scale, snapping && !event.altKey ? 1 : 0);
  };
  const move = (event: ReactPointerEvent<SVGGElement>) => {
    const next = propose(event); if (next) { event.preventDefault(); setPreview(next); }
  };
  const end = (event: ReactPointerEvent<SVGGElement>) => {
    const current = drag.current; if (!current || current.pointer !== event.pointerId) return;
    const next = propose(event);
    if (!drag.current) return;
    event.preventDefault(); event.stopPropagation(); release(); setActiveId(null); setPreview(null);
    if (!current.moved) { onSelectModule(current.id); return; }
    if (next?.problems.length) { setNotice(`Move not applied: ${next.problems.join(" ")}`); return; }
    if (next?.changed) { onChange(next.planner); setNotice(`${cabinetMovePosition(next.module)}. Move applied; measurements need review.`); }
    else setNotice("Position unchanged.");
  };
  const nudge = (id: string, dx: number, dz: number) => {
    if (drag.current) return;
    const next = proposeCabinetMove(planner, id, dx, dz, 0);
    if (!next) { setNotice("Complete room measurements are required before moving."); return; }
    if (next.problems.length) { setNotice(`Move not applied: ${next.problems.join(" ")}`); return; }
    if (next.changed) { onChange(next.planner); setNotice(`${cabinetMovePosition(next.module)}. Move applied; measurements need review.`); }
    else setNotice("Wall cabinets move along their chosen wall; use Place on to change walls.");
  };
  if (width === null || depth === null) return <div className="grid h-full min-h-[24rem] place-items-center bg-[#e5ddd0] p-8 text-center"><div><p className="text-sm font-black text-[#18312f]">Measured geometry unresolved</p><p className="mt-2 text-xs text-[#68736f]">Enter room width and depth to draw the measured plan.</p></div></div>;
  const display = preview?.planner ?? planner;
  const selected = activeId ?? planner.selectedModuleId;
  const selectedModule = display.modules.find(module => module.id === selected);
  const boxFor = (item: CabinetShellItem) => {
    const start = item.offsetIn * scale, extent = item.widthIn * scale;
    if (item.wall === "north") return { x: originX + start, y: originY, width: extent, height: 8 };
    if (item.wall === "south") return { x: originX + (width - item.offsetIn - item.widthIn) * scale, y: originY + depth * scale - 8, width: extent, height: 8 };
    if (item.wall === "east") return { x: originX + width * scale - 8, y: originY + start, width: 8, height: extent };
    return { x: originX, y: originY + (depth - item.offsetIn - item.widthIn) * scale, width: 8, height: extent };
  };
  const feedback = preview ? [cabinetMovePosition(preview.module), ...preview.guides.map(guide => guide.label), ...preview.problems,
    preview.problems.length ? "Blocked: releasing restores the original position." : "Release to apply; Escape to cancel."].join(" · ") : notice || (selectedModule ? cabinetMovePosition(selectedModule) : "Select or drag a cabinet to position it.");
  return <div className="flex h-full min-w-0 flex-col bg-[#ede7dd]" data-testid="cabinet-direct-placement">
    <div className="flex flex-wrap items-center gap-2 border-b border-[#18312f]/10 bg-white/90 p-3 text-xs text-[#18312f]">
      <label className="inline-flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" checked={snapping} onChange={event => setSnapping(event.target.checked)} />Snap to walls and cabinets</label>
      <span className="text-[#53625e]">1/8-inch grid</span>
      <div className="ml-auto flex flex-wrap gap-1" aria-label="Cabinet movement buttons">
        {([['Left', -1, 0], ['Up', 0, -1], ['Down', 0, 1], ['Right', 1, 0]] as const).map(([label, dx, dz]) => <button type="button" key={label} disabled={!selectedModule || activeId !== null} onClick={() => selectedModule && nudge(selectedModule.id, dx * .125, dz * .125)} aria-label={`Move selected cabinet ${label.toLowerCase()}`} className="min-h-11 min-w-11 rounded-lg border border-[#18312f]/20 bg-white px-2 font-bold disabled:opacity-40 focus-visible:outline focus-visible:outline-2">{label}</button>)}
      </div>
    </div>
    <svg ref={svg} viewBox="0 0 760 500" role="group" aria-label={`Measured cabinet plan, ${width} by ${depth} inches`} aria-describedby={helpId} className="block min-h-[20rem] w-full flex-1" data-testid="steel-home-cabinet-plan" data-placement-invalid={Boolean(preview?.problems.length)}>
      <rect width="760" height="500" fill="#ede7dd" />
      <rect x={originX} y={originY} width={width * scale} height={depth * scale} fill="#faf8f3" stroke="#18312f" strokeWidth="5" />
      {planner.shellItems.map(item => <g key={item.id} data-shell-item={item.id}><rect {...boxFor(item)} fill={item.kind === "obstacle" ? "#9b3f32" : "#4f8c8e"} /><title>{`${item.label}: ${item.widthIn} inches on ${item.wall} wall`}</title></g>)}
      {display.modules.map(module => {
        const b = getCabinetModuleBounds(display, module); if (!b) return null;
        const x = originX + b.x1 * scale, y = originY + b.z1 * scale;
        const w = (b.x2 - b.x1) * scale, d = (b.z2 - b.z1) * scale;
        const isSelected = selected === module.id, invalid = isSelected && Boolean(preview?.problems.length);
        return <g key={module.id} data-module={module.id} data-offset-in={module.offsetIn} data-depth-offset-in={module.roomDepthOffsetIn} role="button" tabIndex={0} aria-label={`Select ${module.label}`} aria-pressed={isSelected} aria-describedby={helpId}
          onPointerDown={event => begin(event, module.id)} onPointerMove={move} onPointerUp={end}
          onPointerCancel={event => { if (drag.current?.pointer === event.pointerId) cancel(); }} onLostPointerCapture={event => { if (drag.current?.pointer === event.pointerId) cancel(); }}
          onClick={event => { if (event.detail === 0 && !drag.current) onSelectModule(module.id); }}
          onKeyDown={event => {
            if (event.key === "Escape" || (drag.current && (event.ctrlKey || event.metaKey))) { if (drag.current) { event.preventDefault(); event.stopPropagation(); cancel(); } return; }
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectModule(module.id); }
            const delta = ARROWS[event.key]; if (delta) { event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 1 : .125; nudge(module.id, delta[0] * step, delta[1] * step); }
          }} style={{ touchAction: "none", cursor: activeId === module.id ? "grabbing" : "grab" }} className="outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a94f2e]">
          <rect x={x} y={y} width={w} height={d} rx="2" fill={module.kind === "island" ? "#a94f2e" : "#ac7b4e"} stroke={invalid ? "#b3261e" : isSelected ? "#f4b08c" : "#18312f"} strokeWidth={isSelected ? 5 : 2} />
          <title>{`${cabinetMovePosition(module)}; ${module.widthIn} × ${module.depthIn} × ${module.heightIn} inches`}</title>
          {w > 46 && d > 20 && <text x={x + w / 2} y={y + d / 2 + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="800" pointerEvents="none">{module.label.slice(0, 16)}</text>}
        </g>;
      })}
      {preview?.guides.map((guide, index) => <line key={index} data-snap-guide={guide.axis} pointerEvents="none" x1={guide.axis === "x" ? originX + guide.coordinate * scale : originX} x2={guide.axis === "x" ? originX + guide.coordinate * scale : originX + width * scale} y1={guide.axis === "z" ? originY + guide.coordinate * scale : originY} y2={guide.axis === "z" ? originY + guide.coordinate * scale : originY + depth * scale} stroke="#156c61" strokeDasharray="5 4" strokeWidth="2" />)}
      <g fill="#18312f" fontFamily="system-ui, sans-serif" fontWeight="800" pointerEvents="none">
        <text x="380" y={Math.max(20, originY - 14)} textAnchor="middle" fontSize="13">NORTH · {width}&quot;</text>
        <text x="380" y={Math.min(490, originY + depth * scale + 24)} textAnchor="middle" fontSize="13">SOUTH · {width}&quot;</text>
        <text x="24" y="250" fontSize="13" transform="rotate(-90 24 250)" textAnchor="middle">WEST · {depth}&quot;</text>
        <text x="736" y="250" fontSize="13" transform="rotate(90 736 250)" textAnchor="middle">EAST · {depth}&quot;</text>
      </g>
    </svg>
    <div className="border-t border-[#18312f]/10 bg-white/90 p-3 text-xs leading-5 text-[#18312f]">
      <p role="status" aria-live="polite" className="min-h-10 font-semibold" data-testid="cabinet-placement-status">{feedback}</p>
      <p id={helpId} className="text-[#53625e]">Drag along the chosen wall; islands move freely. Arrow keys move 1/8 in; Shift + arrow moves 1 in. Alt disables magnetic snapping. Escape cancels. Use Place on for another wall. Warnings check recorded geometry, not door swings or required working clearances.</p>
    </div>
  </div>;
}
