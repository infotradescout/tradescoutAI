import { lazy, Suspense, useCallback, useState, type ComponentProps } from "react";
import MeasuredCountertopDesigner from "./MeasuredCountertopDesigner";
import { useDesignerHistory } from "./useDesignerHistory";
import "./planningBuilderResponsive.css";
import "./kitchenDesignerStudio.css";

const CountertopDrawingReview = lazy(() => import("./CountertopDrawingReview"));
type Props = ComponentProps<typeof MeasuredCountertopDesigner>;

export default function CountertopDesigner(props: Props) {
  const history = useDesignerHistory(props.design, props.onChange);
  const [review, setReview] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [notice, setNotice] = useState("");
  const completeExport = useCallback((message: string) => { setExportPending(false); setNotice(message); }, []);
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
        <button type="button" aria-pressed={!review} onClick={() => { setExportPending(false); setReview(false); setNotice(""); }}>Edit design</button>
        <button type="button" aria-pressed={review} onClick={() => setReview(true)}>Scaled drawing</button>
        <button type="button" disabled={exportPending} aria-busy={exportPending} onClick={() => { setReview(true); setNotice("Preparing drawing…"); setExportPending(true); }}>Export drawing</button>
      </div>
      {notice && <p className="kitchen-designer-notice" role="status">{notice}</p>}
      {review && (
        <Suspense fallback={<div role="status" className="grid min-h-[24rem] place-items-center p-6 text-sm font-semibold">Loading scaled drawing…</div>}>
          <CountertopDrawingReview design={props.design} exportRequested={exportPending} onExportComplete={completeExport} />
        </Suspense>
      )}
      <div className="kitchen-designer-editor" style={review ? { display: "none" } : undefined}>
        <MeasuredCountertopDesigner {...props} onChange={history.change} />
      </div>
    </div>
  );
}
