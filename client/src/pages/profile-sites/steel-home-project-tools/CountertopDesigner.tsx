import { lazy, Suspense, useCallback, useRef, useState, type ComponentProps } from "react";
import MeasuredCountertopDesigner from "./MeasuredCountertopDesigner";
import type { SteelHomeCabinetDesign, SteelHomeCountertopDesign } from "./projectModel";
import { useDesignerHistory } from "./useDesignerHistory";
import "./planningBuilderResponsive.css";
import "./kitchenDesignerStudio.css";
import "./kitchenWorkspaceControls.css";

const CountertopDrawingReview = lazy(() => import("./CountertopDrawingReview"));
const CabinetCountertopImport = lazy(() => import("./CabinetCountertopImport"));
type Props = ComponentProps<typeof MeasuredCountertopDesigner> & { cabinets?: SteelHomeCabinetDesign };

export default function CountertopDesigner({ cabinets, ...props }: Props) {
  const history = useDesignerHistory(props.design, props.onChange);
  const [review, setReview] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [notice, setNotice] = useState("");
  const importButton = useRef<HTMLButtonElement>(null);
  const completeExport = useCallback((message: string) => { setExportPending(false); setNotice(message); }, []);
  const closeImport = () => { setImportOpen(false); requestAnimationFrame(() => importButton.current?.focus()); };
  const applyImport = (next: SteelHomeCountertopDesign) => {
    history.change(next);
    setImportOpen(false);
    setReview(true);
    setNotice("Countertop design updated. Undo reverses this change; the pre-import restore point is available under Use cabinet layout. Review dimensions and place opening locations before requesting.");
    requestAnimationFrame(() => importButton.current?.focus());
  };
  return (
    <div className="kitchen-designer-studio" onKeyDown={event => {
      const target = event.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable=true]") || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? history.redo() : history.undo(); }
    }}>
      <div className="kitchen-designer-toolbar" aria-label="Countertop editing actions">
        <strong>Countertop studio</strong>
        <button type="button" disabled={!history.canUndo} onClick={history.undo}>Undo</button>
        <button type="button" disabled={!history.canRedo} onClick={history.redo}>Redo</button>
        <button type="button" aria-pressed={!review && !importOpen} onClick={() => { setExportPending(false); setReview(false); setImportOpen(false); setNotice(""); }}>Edit design</button>
        <button type="button" aria-pressed={review && !importOpen} onClick={() => { setReview(true); setImportOpen(false); }}>Scaled drawing</button>
        <button type="button" disabled={exportPending || importOpen} aria-busy={exportPending} onClick={() => { setReview(true); setNotice("Preparing drawing…"); setExportPending(true); }}>Export drawing</button>
        {cabinets && <button ref={importButton} type="button" disabled={exportPending} aria-expanded={importOpen} onClick={() => { setImportOpen(value => !value); setNotice(""); }}>Use cabinet layout</button>}
      </div>
      {notice && <p className="kitchen-designer-notice" role="status">{notice}</p>}
      {importOpen && cabinets && <Suspense fallback={<p role="status" className="p-6">Loading cabinet layout review…</p>}><CabinetCountertopImport cabinets={cabinets} current={props.design} onApply={applyImport} onClose={closeImport} /></Suspense>}
      {review && !importOpen && (
        <Suspense fallback={<div role="status" className="grid min-h-[24rem] place-items-center p-6 text-sm font-semibold">Loading scaled drawing…</div>}>
          <CountertopDrawingReview design={props.design} exportRequested={exportPending} onExportComplete={completeExport} />
        </Suspense>
      )}
      <div className="kitchen-designer-editor" style={review || importOpen ? { display: "none" } : undefined}>
        <MeasuredCountertopDesigner {...props} onChange={history.change} />
      </div>
    </div>
  );
}
