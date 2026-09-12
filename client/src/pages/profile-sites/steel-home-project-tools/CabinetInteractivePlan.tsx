import { useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CABINET_STUDIO_FINISHES, getCabinetModuleBounds, isCabinetAccessory, type CabinetPlannerExtensionV1, type CabinetShellItem } from "./cabinetPlannerModel";
import { cabinetMovePosition, proposeCabinetMove, type CabinetMoveProposal } from "./cabinetPlacement";
import { CABINET_PLAN_FRAME, CABINET_PLAN_LAYERS, cabinetOnPlanLayer, cabinetPlanProjection, frameCabinetInPlan, zoomCabinetPlan, type CabinetPlanCamera, type CabinetPlanLayer } from "./cabinetPlanCamera";
import "./cabinetCanvasWorkflow.css";

type Props = {
  planner: CabinetPlannerExtensionV1;
  onSelectModule: (id: string) => void;
  onChange: (planner: CabinetPlannerExtensionV1) => void;
};
type Drag = {
  id: string; pointer: number; element: SVGGElement;
  baseline: CabinetPlannerExtensionV1; signature: string;
  startX: number; startY: number; clientX: number; clientY: number; moved: boolean;
};
type Pan = { pointer: number; clientX: number; clientY: number; camera: CabinetPlanCamera; unitsX: number; unitsY: number };
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Camera and layer state never reach the saved draft. Valid cabinet drops still commit exactly once. */
export default function CabinetPlanView({ planner, onSelectModule, onChange }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null), pan = useRef<Pan | null>(null);
  const [preview, setPreview] = useState<CabinetMoveProposal | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapping, setSnapping] = useState(true);
  const [notice, setNotice] = useState("");
  const [layer, setLayer] = useState<CabinetPlanLayer>("all");
  const [camera, setCamera] = useState<CabinetPlanCamera>({ ...CABINET_PLAN_FRAME });
  const helpId = useId(), gridId = `cabinet-grid-${useId().replace(/:/g, "")}`;
  const signature = JSON.stringify(planner);
  const latestSignature = useRef(signature); latestSignature.current = signature;
  const width = planner.shell.widthIn, depth = planner.shell.depthIn;
  const { scale, originX, originY } = cabinetPlanProjection(planner);
  const release = () => {
    const current = drag.current; drag.current = null;
    if (current?.element.hasPointerCapture?.(current.pointer)) current.element.releasePointerCapture(current.pointer);
  };
  const releasePan = () => {
    const current = pan.current; pan.current = null;
    if (current && svg.current?.hasPointerCapture?.(current.pointer)) svg.current.releasePointerCapture(current.pointer);
  };
  const cancel = useCallback(() => {
    releasePan();
    if (!drag.current) return;
    release(); setPreview(null); setActiveId(null); setNotice("Move cancelled. Saved measurements are unchanged.");
  }, []);
  useEffect(() => { if (drag.current && drag.current.signature !== signature) cancel(); }, [signature, cancel]);
  useEffect(() => { cancel(); setCamera({ ...CABINET_PLAN_FRAME }); }, [width, depth, cancel]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel); window.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel); window.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", hidden); release(); releasePan();
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
    if (drag.current || pan.current || event.button !== 0 || !event.isPrimary) return;
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
  const finish = CABINET_STUDIO_FINISHES.find(item => item.value === display.presentation?.finish)?.color ?? "#bdb7ac";
  const boxFor = (item: CabinetShellItem) => {
    const start = item.offsetIn * scale, extent = item.widthIn * scale;
    if (item.wall === "north") return { x: originX + start, y: originY, width: extent, height: 8 };
    if (item.wall === "south") return { x: originX + (width - item.offsetIn - item.widthIn) * scale, y: originY + depth * scale - 8, width: extent, height: 8 };
    if (item.wall === "east") return { x: originX + width * scale - 8, y: originY + start, width: 8, height: extent };
    return { x: originX, y: originY + (depth - item.offsetIn - item.widthIn) * scale, width: 8, height: extent };
  };
  const feedback = preview ? [cabinetMovePosition(preview.module), ...preview.guides.map(guide => guide.label), ...preview.problems,
    preview.problems.length ? "Blocked: releasing restores the original position." : "Release to apply; Escape to cancel."].join(" · ") : notice || (selectedModule ? cabinetMovePosition(selectedModule) : "Select a cabinet to edit it. Drag to position it.");
  const visible = display.modules.filter(module => cabinetOnPlanLayer(module, layer));
  // Paint upper cabinets last only when selected; the object picker and layer control resolve overlap explicitly.
  const ordered = [...visible].sort((a, b) => Number(a.id === selected) - Number(b.id === selected));
  const focusSelected = () => {
    const next = frameCabinetInPlan(planner, selected);
    if (next) { if (selectedModule && !cabinetOnPlanLayer(selectedModule, layer)) setLayer("all"); setCamera(next); }
  };
  return <div className="cabinet-canvas-workflow flex h-full min-w-0 flex-col" data-testid="cabinet-direct-placement" data-plan-layer={layer}>
    <div className="cabinet-canvas-navigation" aria-label="Cabinet drawing navigation">
      <label><span className="sr-only">Cabinet plan layer</span><select aria-label="Cabinet plan layer" value={layer} disabled={activeId !== null} onChange={event => { cancel(); setLayer(event.target.value as CabinetPlanLayer); }}>{CABINET_PLAN_LAYERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="cabinet-object-picker"><span className="sr-only">Select object in plan</span><select aria-label="Select object in plan" value={selected ?? ""} disabled={activeId !== null || !planner.modules.length} onChange={event => { const object = planner.modules.find(item => item.id === event.target.value); if (object) { if (!cabinetOnPlanLayer(object, layer)) setLayer("all"); onSelectModule(object.id); } }}><option value="">Select an object</option>{planner.modules.map((module, index) => <option value={module.id} key={module.id}>{index + 1}. {module.label} · {module.surface}</option>)}</select></label>
      <div className="cabinet-camera-actions">
        <button type="button" aria-label="Zoom cabinet plan out" disabled={activeId !== null || camera.width >= 760} onClick={() => setCamera(current => zoomCabinetPlan(current, 1 / 1.35))}>−</button>
        <output aria-label="Cabinet plan zoom">{Math.round(760 / camera.width * 100)}%</output>
        <button type="button" aria-label="Zoom cabinet plan in" disabled={activeId !== null || camera.width <= 760 / 6} onClick={() => setCamera(current => zoomCabinetPlan(current, 1.35))}>+</button>
        <button type="button" disabled={activeId !== null} onClick={() => setCamera({ ...CABINET_PLAN_FRAME })}>Fit room</button>
        <button type="button" disabled={activeId !== null || !selectedModule} onClick={focusSelected}>Fit selected</button>
      </div>
    </div>
    <svg ref={svg} viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`} role="group" aria-label={`Measured cabinet plan, ${width} by ${depth} inches`} aria-describedby={helpId} style={{ touchAction: "none" }} className="block min-h-[20rem] w-full flex-1" data-testid="steel-home-cabinet-plan" data-placement-invalid={Boolean(preview?.problems.length)}
      onPointerDown={event => {
        if (event.button !== 0 || !event.isPrimary || drag.current || pan.current || camera.width >= 760) return;
        const matrix = event.currentTarget.getScreenCTM(); if (!matrix) return;
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { return; }
        event.preventDefault();
        pan.current = { pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, camera, unitsX: 1 / matrix.a, unitsY: 1 / matrix.d };
      }} onPointerMove={event => {
        const current = pan.current; if (!current || current.pointer !== event.pointerId) return;
        event.preventDefault();
        setCamera({ ...current.camera, x: Math.max(0, Math.min(760 - current.camera.width, current.camera.x - (event.clientX - current.clientX) * current.unitsX)), y: Math.max(0, Math.min(500 - current.camera.height, current.camera.y - (event.clientY - current.clientY) * current.unitsY)) });
      }} onPointerUp={event => { if (pan.current?.pointer === event.pointerId) releasePan(); }} onPointerCancel={releasePan} onLostPointerCapture={releasePan}>
      <defs><pattern id={gridId} width={12 * scale} height={12 * scale} x={originX} y={originY} patternUnits="userSpaceOnUse"><path d={`M ${12 * scale} 0 H 0 V ${12 * scale}`} fill="none" stroke="#dbe1dc" strokeWidth=".5" /></pattern></defs>
      <rect width="760" height="500" fill="#eef1ec" />
      <rect x={originX} y={originY} width={width * scale} height={depth * scale} fill="#fffefa" stroke="#344941" strokeWidth="3" />
      <rect x={originX} y={originY} width={width * scale} height={depth * scale} fill={`url(#${gridId})`} pointerEvents="none" />
      {planner.shellItems.map(item => <g key={item.id} data-shell-item={item.id}><rect {...boxFor(item)} fill={item.kind === "obstacle" ? "#9b3f32" : "#4f8c8e"} /><title>{`${item.label}: ${item.widthIn} inches on ${item.wall} wall`}</title></g>)}
      {display.modules.filter(module => !cabinetOnPlanLayer(module, layer)).map(module => {
        const b = getCabinetModuleBounds(display, module); if (!b) return null;
        return <rect key={module.id} data-layer-ghost={module.id} x={originX + b.x1 * scale} y={originY + b.z1 * scale} width={(b.x2 - b.x1) * scale} height={(b.z2 - b.z1) * scale} fill="none" stroke="#adb7b0" strokeDasharray="3 3" strokeWidth="1" pointerEvents="none" aria-hidden="true" />;
      })}
      {ordered.map(module => {
        const b = getCabinetModuleBounds(display, module); if (!b) return null;
        const x = originX + b.x1 * scale, y = originY + b.z1 * scale;
        const w = (b.x2 - b.x1) * scale, d = (b.z2 - b.z1) * scale;
        const isSelected = selected === module.id, invalid = isSelected && Boolean(preview?.problems.length);
        const upper = module.kind === "wall-cabinet", gap = module.kind === "appliance";
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
          <rect x={x} y={y} width={w} height={d} rx="1" fill={gap ? "#f1f4f2" : finish} fillOpacity={upper && !isSelected ? .4 : 1} stroke={invalid ? "#b3261e" : isSelected ? "#087b6c" : "#46584e"} strokeWidth={isSelected ? 3 : 1} strokeDasharray={upper || gap ? "4 2" : undefined} />
          {isCabinetAccessory(module) && <rect x={x} y={y} width={w} height={d} fill="transparent" stroke="transparent" strokeWidth="6" />}
          {isSelected && <rect x={x - 3} y={y - 3} width={w + 6} height={d + 6} fill="none" stroke={invalid ? "#b3261e" : "#087b6c"} strokeWidth=".8" pointerEvents="none" />}
          <title>{`${cabinetMovePosition(module)}; ${module.widthIn} × ${module.depthIn} × ${module.heightIn} inches`}</title>
          {w > 46 && d > 20 && <text x={x + w / 2} y={y + d / 2 + 4} textAnchor="middle" fill="#162f29" fontSize="11" fontWeight="700" pointerEvents="none">{module.label.slice(0, 16)}</text>}
          {isSelected && <text x={x + w / 2} y={y - 8} textAnchor="middle" fill="#075d50" fontSize="12" fontWeight="700" paintOrder="stroke" stroke="#fffefa" strokeWidth="3" strokeLinejoin="round" pointerEvents="none">{module.widthIn} × {module.depthIn} in</text>}
        </g>;
      })}
      {preview?.guides.map((guide, index) => <line key={index} data-snap-guide={guide.axis} pointerEvents="none" x1={guide.axis === "x" ? originX + guide.coordinate * scale : originX} x2={guide.axis === "x" ? originX + guide.coordinate * scale : originX + width * scale} y1={guide.axis === "z" ? originY + guide.coordinate * scale : originY} y2={guide.axis === "z" ? originY + guide.coordinate * scale : originY + depth * scale} stroke="#087b6c" strokeDasharray="5 4" strokeWidth="2" />)}
      <g fill="#3e554a" fontFamily="system-ui, sans-serif" fontWeight="600" pointerEvents="none">
        <text x="380" y={Math.max(20, originY - 14)} textAnchor="middle" fontSize="13">NORTH · {width}&quot;</text>
        <text x="380" y={Math.min(490, originY + depth * scale + 24)} textAnchor="middle" fontSize="13">SOUTH · {width}&quot;</text>
        <text x="24" y="250" fontSize="13" transform="rotate(-90 24 250)" textAnchor="middle">WEST · {depth}&quot;</text>
        <text x="736" y="250" fontSize="13" transform="rotate(90 736 250)" textAnchor="middle">EAST · {depth}&quot;</text>
      </g>
    </svg>
    <div className="cabinet-canvas-footer">
      <p role="status" aria-live="polite" data-testid="cabinet-placement-status">{feedback}</p>
      <div className="cabinet-placement-actions">
        <label><input type="checkbox" checked={snapping} onChange={event => setSnapping(event.target.checked)} />Snap to walls and cabinets</label>
        <div aria-label="Cabinet movement buttons">{([['Left', -1, 0], ['Up', 0, -1], ['Down', 0, 1], ['Right', 1, 0]] as const).map(([label, dx, dz]) => <button type="button" key={label} disabled={!selectedModule || activeId !== null || !cabinetOnPlanLayer(selectedModule, layer)} onClick={() => selectedModule && nudge(selectedModule.id, dx * .125, dz * .125)} aria-label={`Move selected cabinet ${label.toLowerCase()}`}>{label}</button>)}</div>
      </div>
      <details className="cabinet-canvas-help"><summary>Moving, zooming &amp; measurement checks</summary><p id={helpId}>Drag cabinets along the chosen wall; islands move freely. When zoomed in, drag empty space to pan. Layers only change what you can select; all recorded objects still participate in collision checks. The drawn grid is 12 inches; placement uses a 1/8-inch grid. Arrow keys move 1/8 in; Shift + arrow moves 1 in. Alt disables magnetic snapping. Escape cancels a cabinet move. Scroll outside the drawing to move the page. Use Place on for another wall. Warnings check recorded geometry, not door swings or required working clearances.</p></details>
    </div>
  </div>;
}
