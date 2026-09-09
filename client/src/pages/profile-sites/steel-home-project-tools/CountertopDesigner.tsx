import { lazy, Suspense, useRef, useState, type ComponentProps } from "react";
import MeasuredCountertopDesigner from "./MeasuredCountertopDesigner";
import { useDesignerHistory } from "./useDesignerHistory";
import "./planningBuilderResponsive.css";
import "./kitchenDesignerStudio.css";

const CountertopPrecisionReview = lazy(() => import("./CountertopPrecisionReview"));

type Props = ComponentProps<typeof MeasuredCountertopDesigner>;
export default function CountertopDesigner(props: Props) {
  const history = useDesignerHistory(props.design, props.onChange);
  const [review, setReview] = useState(false);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const exportDrawing = () => {
    setReview(true);
    // Export only this self-contained drawing; notes, contacts and photos stay out.
    requestAnimationFrame(() => {
      const svg = root.current?.querySelector<SVGSVGElement>("[data-testid=countertop-precision-drawing]");
      if (!svg) {
        setNotice("Open Scaled drawing, then choose Export drawing again.");
        return;
      }
      try {
        const copy = svg.cloneNode(true) as SVGSVGElement;
        copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        copy.removeAttribute("style");
        copy.setAttribute("width", "1200");
        copy.setAttribute("height", "900");
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = "TradeScout countertop planning review — dimensions in inches; not a fabrication template";
        copy.prepend(title);
        const bounds = (copy.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
        if (bounds.length === 4 && bounds.every(Number.isFinite)) {
          const font = bounds[2] / 65;
          const warning = document.createElementNS("http://www.w3.org/2000/svg", "text");
          warning.setAttribute("x", String(bounds[0] + bounds[2] / 2));
          warning.setAttribute("y", String(bounds[1] + bounds[3] - font));
          warning.setAttribute("font-size", String(font));
          warning.setAttribute("text-anchor", "middle");
          warning.setAttribute("fill", "#843d26");
          warning.textContent = "PLANNING ONLY — verify field dimensions; not a fabrication template";
          copy.append(warning);
        }
        const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "tradescout-countertop-review.svg";
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice("Drawing download started. Field templating remains required.");
      } catch {
        setNotice("Download unavailable. The scaled drawing remains visible for review.");
      }
    });
  };
  return (
    <div className="kitchen-designer-studio" ref={root} onKeyDown={event => {
      const target = event.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable=true]") || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? history.redo() : history.undo();
      }
    }}>
      <div className="kitchen-designer-toolbar" aria-label="Countertop editing actions">
        <strong>Countertop studio</strong>
        <button type="button" disabled={!history.canUndo} onClick={history.undo}>Undo</button>
        <button type="button" disabled={!history.canRedo} onClick={history.redo}>Redo</button>
        <button type="button" aria-pressed={!review} onClick={() => setReview(false)}>Edit design</button>
        <button type="button" aria-pressed={review} onClick={() => setReview(true)}>Scaled drawing</button>
        <button type="button" onClick={exportDrawing}>Export drawing</button>
      </div>
      {notice && <p className="kitchen-designer-notice" role="status">{notice}</p>}
      {review && (
        <Suspense fallback={<div className="grid min-h-[24rem] place-items-center p-6 text-sm font-semibold">Loading scaled drawing…</div>}>
          <CountertopPrecisionReview design={props.design} />
        </Suspense>
      )}
      <div className="kitchen-designer-editor" style={review ? { display: "none" } : undefined}>
        <MeasuredCountertopDesigner {...props} onChange={history.change} />
      </div>
    </div>
  );
}
