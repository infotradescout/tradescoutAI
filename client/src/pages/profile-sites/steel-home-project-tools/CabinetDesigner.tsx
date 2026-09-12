import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import CabinetMeasuredEditor, { type CabinetDesignerProps } from "./CabinetMeasuredEditor";
import KitchenWorkspacePanel from "./KitchenWorkspacePanel";
import {
  CABINET_STUDIO_STYLES, CABINET_STUDIO_FINISHES, CABINET_STUDIO_HARDWARE, CABINET_FRONT_LAYOUTS,
  buildCabinetPlannerRequestBrief, duplicateCabinetModule, isCabinetAccessory, reconcileCabinetPlannerExtension,
  type CabinetPresentation,
} from "./cabinetPlannerModel";
import type { SteelHomeCabinetDesign } from "./projectModel";
import { useDesignerHistory } from "./useDesignerHistory";
import { installCabinetToolbarTouch } from "./cabinetToolbarTouch";
import "./kitchenDesignerStudio.css";
import "./cabinetCanvasWorkflow.css";
export type { CabinetDesignerProps } from "./CabinetMeasuredEditor";

const CabinetLibraryPanel = lazy(() => import("./CabinetLibraryPanel"));
const CabinetAccessorySettings = lazy(() => import("./CabinetAccessorySettings"));
type Panel = "library" | "schedule" | "review" | null;

export default function CabinetDesigner(props: CabinetDesignerProps) {
  const design = useMemo(() => ({ ...props.design, planner: reconcileCabinetPlannerExtension(props.plannerExtension ?? props.design.planner) }), [props.design, props.plannerExtension]);
  const emit = useCallback((next: SteelHomeCabinetDesign) => {
    props.onChange(next);
    props.onPlannerExtensionChange?.(next.planner);
  }, [props.onChange, props.onPlannerExtensionChange]);
  const history = useDesignerHistory(design, emit);
  const [panel, setPanel] = useState<Panel>(null);
  const [canvasFocus, setCanvasFocus] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => root.current ? installCabinetToolbarTouch(root.current) : undefined, []);
  const panelTrigger = useRef<HTMLButtonElement | null>(null);
  const [notice, setNotice] = useState("");
  const planner = design.planner;
  const presentation: CabinetPresentation = planner.presentation ?? { style: null, finish: null, hardware: null, fronts: {} };
  const selected = planner.modules.find(module => module.id === planner.selectedModuleId);
  useEffect(() => { if (!planner.starter) setCanvasFocus(false); }, [planner.starter]);
  const appearance = (patch: Partial<CabinetPresentation>) => history.change({ ...design, planner: reconcileCabinetPlannerExtension({ ...planner, presentation: { ...presentation, ...patch } }) });
  const closePanel = () => { setPanel(null); panelTrigger.current?.focus({ preventScroll: true }); };
  const editSelected = () => {
    setPanel(null); setCanvasFocus(false);
    requestAnimationFrame(() => {
      const input = root.current?.querySelector<HTMLInputElement>('[data-testid="steel-home-cabinet-module-width"]');
      if (!input) return;
      const details = input.closest("details");
      if (details) details.open = true;
      input.scrollIntoView({ block: "center", inline: "nearest" });
      input.focus({ preventScroll: true });
    });
  };
  const exportReview = () => {
    try {
      const blob = new Blob([buildCabinetPlannerRequestBrief(planner)], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "tradescout-cabinet-review.txt";
      try { document.body.append(link); link.click(); }
      finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setNotice("Review download started. It includes this device's design and notes.");
    } catch { setPanel("review"); setCanvasFocus(false); setNotice("Download unavailable. The full review is shown for copying."); }
  };
  return <div ref={root} className="kitchen-designer-studio cabinet-design-focus" data-canvas-focus={canvasFocus} data-cabinet-appearance={Boolean(planner.presentation)} onKeyDown={event => {
    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,[contenteditable=true]") || event.altKey || !(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? history.redo() : history.undo(); }
  }}>
    {planner.starter && <>
      <div className="kitchen-designer-toolbar" aria-label="Cabinet editing actions">
        <strong>Cabinet studio</strong>
        <button type="button" aria-label="Cabinet library" aria-expanded={panel === "library"} onClick={event => { panelTrigger.current = event.currentTarget; setCanvasFocus(false); setPanel("library"); }}>Cabinet library</button>
        <button type="button" aria-label="Undo" disabled={!history.canUndo} onClick={history.undo}>Undo</button>
        <button type="button" aria-label="Redo" disabled={!history.canRedo} onClick={history.redo}>Redo</button>
        <button type="button" aria-pressed={canvasFocus} onClick={() => { setPanel(null); setCanvasFocus(value => !value); }}>{canvasFocus ? "Show inspector" : "Focus drawing"}</button>
        <button type="button" aria-label="Edit selected dimensions" disabled={!selected} onClick={editSelected}>Edit selected</button>
        <button type="button" aria-expanded={panel === "schedule"} onClick={event => { panelTrigger.current = event.currentTarget; setCanvasFocus(false); setPanel("schedule"); }}>Cabinet schedule</button>
        <button type="button" disabled={!selected || planner.modules.length >= 120} onClick={() => {
          if (selected) history.change({ ...design, planner: duplicateCabinetModule(planner, selected.id, `cabinet-module-${crypto.randomUUID()}`) });
        }}>Duplicate selected</button>
        <button type="button" aria-expanded={panel === "review"} onClick={event => { panelTrigger.current = event.currentTarget; setCanvasFocus(false); setPanel(value => value === "review" ? null : "review"); }}>Dimensioned review</button>
        <button type="button" onClick={event => { panelTrigger.current = event.currentTarget; exportReview(); }}>Export review</button>
      </div>
      <div className="kitchen-designer-appearance" aria-label="Cabinet appearance">
        <label>Door style<select aria-label="Cabinet door style" value={presentation.style ?? ""} onChange={event => appearance({ style: (event.target.value || null) as CabinetPresentation["style"] })}><option value="">Not selected</option>{CABINET_STUDIO_STYLES.map(style => <option key={style}>{style}</option>)}</select></label>
        <label>Finish<select aria-label="Cabinet finish" value={presentation.finish ?? ""} onChange={event => appearance({ finish: (event.target.value || null) as CabinetPresentation["finish"] })}><option value="">Not selected</option>{CABINET_STUDIO_FINISHES.map(finish => <option key={finish.value} key={finish.value}>{finish.label}</option>)}</select></label>
        <label>Hardware<select aria-label="Cabinet hardware" value={presentation.hardware ?? ""} onChange={event => appearance({ hardware: (event.target.value || null) as CabinetPresentation["hardware"] })}><option value="">Not selected</option>{CABINET_STUDIO_HARDWARE.map(hardware => <option key={hardware}>{hardware}</option>)}</select></label>
        {selected && selected.kind !== "appliance" && !isCabinetAccessory(selected) && <label>Selected cabinet fronts<select aria-label="Selected cabinet fronts" value={presentation.fronts[selected.id] ?? ""} onChange={event => {
          const fronts = { ...presentation.fronts }; if (event.target.value) fronts[selected.id] = event.target.value as (typeof CABINET_FRONT_LAYOUTS)[number]; else delete fronts[selected.id]; appearance({ fronts });
        }}><option value="">Generic preview</option>{CABINET_FRONT_LAYOUTS.map(front => <option key={front}>{front}</option>)}</select></label>}
        <p>Appearance is shown in 3D and saved with this measured design. Preview details are illustrative, not manufacturer specifications.</p>
      </div>
      {selected && isCabinetAccessory(selected) && <div className="kitchen-designer-context-settings"><Suspense fallback={<p role="status" className="p-4 text-sm">Loading accessory settings…</p>}>
        <CabinetAccessorySettings planner={planner} onChange={next => history.change({ ...design, planner: next, notes: next.notes })} />
      </Suspense></div>}
      {notice && <p className="kitchen-designer-notice" role="status">{notice}</p>}
    </>}
    <div className="kitchen-designer-stage" data-panel-open={Boolean(panel && planner.starter)}>
      <div className="kitchen-designer-editor"><CabinetMeasuredEditor {...props} design={design} plannerExtension={undefined} onChange={history.change} onPlannerExtensionChange={undefined} /></div>
      {panel && planner.starter && <KitchenWorkspacePanel label={panel === "review" ? "Cabinet review panel" : "Cabinet library and schedule"} onClose={closePanel}>
        {panel === "review" ? <section className="kitchen-designer-review" aria-label="Cabinet dimensioned review">
          <div className="kitchen-designer-toolbar"><strong>Dimensioned review</strong><button type="button" onClick={closePanel}>Close dimensioned review</button></div>
          <pre>{buildCabinetPlannerRequestBrief(planner)}</pre>
        </section> : <Suspense fallback={<p role="status" className="p-4 text-sm">Loading cabinet library…</p>}>
          <CabinetLibraryPanel planner={planner} view={panel}
            onChange={next => history.change({ ...design, planner: next, notes: next.notes })}
            onClose={closePanel} />
        </Suspense>}
      </KitchenWorkspacePanel>}
    </div>
  </div>;
}
