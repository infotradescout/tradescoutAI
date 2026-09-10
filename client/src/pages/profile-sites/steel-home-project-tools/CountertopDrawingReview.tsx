import { useEffect, useRef, useState, type ComponentProps } from "react";
import { buildSteelHomeBuilderPath, resolveSteelHomeBuilderPathname } from "@shared/steelHomeBuilderRoutes";
import { resolveCountertopPlannerDesign } from "./countertopPlannerModel";
import { buildCountertopStudioShareUrl } from "./countertopStudioShare";
import CountertopPrecisionReview from "./CountertopPrecisionReview";

type Props = ComponentProps<typeof CountertopPrecisionReview> & {
  exportRequested: boolean;
  onExportComplete: (notice: string) => void;
};

/** This optional view owns the drawing and its exporter, so a cold export waits for both. */
export default function CountertopDrawingReview({ design, exportRequested, onExportComplete }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const exported = useRef(false);
  const [shareLink, setShareLink] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  useEffect(() => { setShareLink(""); setShareNotice(""); }, [design]);
  const shareDrawing = async () => {
    const pathname = resolveSteelHomeBuilderPathname(window.location.pathname) === "countertops"
      ? window.location.pathname : buildSteelHomeBuilderPath("countertops");
    const link = buildCountertopStudioShareUrl(
      resolveCountertopPlannerDesign({ ...design, floorStone: false }),
      new URL(pathname, window.location.origin).href
    );
    if (!link) { setShareNotice("Choose a named stone in the editor before sharing this plan."); return; }
    setShareLink(link);
    setShareNotice("Select and copy the link below.");
    try { await navigator.clipboard.writeText(link); setShareNotice("Plan link copied."); } catch { /* The selectable link remains usable. */ }
  };
  useEffect(() => {
    if (!exportRequested) { exported.current = false; return; }
    if (exported.current) return;
    const svg = root.current?.querySelector<SVGSVGElement>("[data-testid=countertop-precision-drawing]");
    if (!svg) { onExportComplete("The drawing could not be prepared. Retry when it is visible."); return; }
    exported.current = true;
    try {
      // The export contains measured geometry only, not photos, notes or contact information.
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
      try { document.body.append(link); link.click(); }
      finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      onExportComplete("Drawing download started. Field templating remains required.");
    } catch {
      onExportComplete("Download unavailable. The scaled drawing remains visible for review.");
    }
  }, [exportRequested, onExportComplete]);
  return <div ref={root}>
    <div className="kitchen-designer-toolbar" aria-label="Drawing sharing actions">
      <button type="button" onClick={shareDrawing}>Copy plan link</button>
      <p className="text-xs">Shares measured dimensions and the selected stone, not notes or contact details.</p>
      {shareLink && <label className="block w-full min-w-0 text-xs">Drawing plan link<input aria-label="Drawing plan link" readOnly value={shareLink} onFocus={event => event.currentTarget.select()} className="mt-2 min-h-11 w-full rounded border border-[#aebdb5] bg-white px-3 text-[#18312f]" /></label>}
      {shareNotice && <p role="status" className="w-full text-xs">{shareNotice}</p>}
    </div>
    <CountertopPrecisionReview design={design} />
  </div>;
}
