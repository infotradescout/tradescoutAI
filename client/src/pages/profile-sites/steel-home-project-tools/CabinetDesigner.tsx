import { useCallback, useMemo, useState } from "react";
import CabinetMeasuredEditor, { type CabinetDesignerProps } from "./CabinetMeasuredEditor";
import {
  CABINET_STUDIO_STYLES, CABINET_STUDIO_FINISHES, CABINET_STUDIO_HARDWARE, CABINET_FRONT_LAYOUTS,
  buildCabinetPlannerRequestBrief, duplicateCabinetModule, reconcileCabinetPlannerExtension,
  type CabinetPresentation,
} from "./cabinetPlannerModel";
import type { SteelHomeCabinetDesign } from "./projectModel";
import { useDesignerHistory } from "./useDesignerHistory";
import "./kitchenDesignerStudio.css";
export type { CabinetDesignerProps } from "./CabinetMeasuredEditor";

export default function CabinetDesigner(props: CabinetDesignerProps) {
  const design = useMemo(() => ({ ...props.design, planner: reconcileCabinetPlannerExtension(props.plannerExtension ?? props.design.planner) }), [props.design, props.plannerExtension]);
  const emit = useCallback((next: SteelHomeCabinetDesign) => {
    props.onChange(next);
    props.onPlannerExtensionChange?.(next.planner);
  }, [props.onChange, props.onPlannerExtensionChange]);
  const history = useDesignerHistory(design, emit);
  const [review, setReview] = useState(false);
  const [notice, setNotice] = useState("");
  const planner = design.planner;
  const presentation: CabinetPresentation = planner.presentation ?? { style: null, finish: null, hardware: null, fronts: {} };
  const selected = planner.modules.find(module => module.id === planner.selectedModuleId);
  const appearance = (patch: Partial<CabinetPresentation>) => history.change({ ...design, planner: reconcileCabinetPlannerExtension({ ...planner, presentation: { ...presentation, ...patch } }) });
  const exportReview = () => {
    try {
      const blob = new Blob([buildCabinetPlannerRequestBrief(planner)], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "tradescout-cabinet-review.txt";
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Review download started. It includes this device's design and notes.");
    } catch { setReview(true); setNotice("Download unavailable. The full review is shown below for copying."); }
  };
  return <div className="kitchen-designer-studio" data-cabinet-appearance={Boolean(planner.presentation)} onKeyDown={event => {
    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,[contenteditable=true]") || event.altKey || !(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? history.redo() : history.undo(); }
  }}>
    {planner.starter && <>
      <div className="kitchen-designer-toolbar" aria-label="Cabinet editing actions">
        <strong>Cabinet studio</strong>
        <button type="button" disabled={!history.canUndo} onClick={history.undo}>Undo</button>
        <button type="button" disabled={!history.canRedo} onClick={history.redo}>Redo</button>
        <button type="button" disabled={!selected || planner.modules.length >= 120} onClick={() => {
          if (selected) history.change({ ...design, planner: duplicateCabinetModule(planner, selected.id, `cabinet-module-${crypto.randomUUID()}`) });
        }}>Duplicate selected</button>
        <button type="button" aria-expanded={review} onClick={() => setReview(value => !value)}>Dimensioned review</button>
        <button type="button" onClick={exportReview}>Export review</button>
      </div>
      <div className="kitchen-designer-appearance">
        <label>Door style<select aria-label="Cabinet door style" value={presentation.style ?? ""} onChange={event => appearance({ style: (event.target.value || null) as CabinetPresentation["style"] })}><option value="">Not selected</option>{CABINET_STUDIO_STYLES.map(style => <option key={style}>{style}</option>)}</select></label>
        <label>Finish<select aria-label="Cabinet finish" value={presentation.finish ?? ""} onChange={event => appearance({ finish: (event.target.value || null) as CabinetPresentation["finish"] })}><option value="">Not selected</option>{CABINET_STUDIO_FINISHES.map(finish => <option value={finish.value} key={finish.value}>{finish.label}</option>)}</select></label>
        <label>Hardware<select aria-label="Cabinet hardware" value={presentation.hardware ?? ""} onChange={event => appearance({ hardware: (event.target.value || null) as CabinetPresentation["hardware"] })}><option value="">Not selected</option>{CABINET_STUDIO_HARDWARE.map(hardware => <option key={hardware}>{hardware}</option>)}</select></label>
        {selected && selected.kind !== "appliance" && <label>Selected cabinet fronts<select aria-label="Selected cabinet fronts" value={presentation.fronts[selected.id] ?? ""} onChange={event => {
          const fronts = { ...presentation.fronts }; if (event.target.value) fronts[selected.id] = event.target.value as (typeof CABINET_FRONT_LAYOUTS)[number]; else delete fronts[selected.id]; appearance({ fronts });
        }}><option value="">Generic preview</option>{CABINET_FRONT_LAYOUTS.map(front => <option key={front}>{front}</option>)}</select></label>}
        <p>Appearance is shown in 3D and saved with this measured design. Preview details are illustrative, not manufacturer specifications.</p>
      </div>
      {review && <section className="kitchen-designer-review" aria-label="Cabinet dimensioned review"><pre>{buildCabinetPlannerRequestBrief(planner)}</pre></section>}
      {notice && <p className="kitchen-designer-notice" role="status">{notice}</p>}
    </>}
    <div className="kitchen-designer-editor"><CabinetMeasuredEditor {...props} design={design} plannerExtension={undefined} onChange={history.change} onPlannerExtensionChange={undefined} /></div>
  </div>;
}
