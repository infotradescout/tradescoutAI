import { ArrowRight, CheckCircle2, FileSearch, Save } from "lucide-react";
import {
  getSteelHomeProjectEstimateSummary,
  getSteelHomeProjectReadiness,
  type SteelHomeProjectDraft,
} from "./projectModel";
import type { SteelHomeWorkspace } from "./SteelHomeWorkspaceNav";

type Props = {
  draft: SteelHomeProjectDraft;
  saved: boolean;
  onOpenReview: () => void;
  layout?: "rail" | "strip" | "mobile";
};

function getRequiredProgress(draft: SteelHomeProjectDraft) {
  const readiness = getSteelHomeProjectReadiness(draft);
  const complete =
    Number(!readiness.needsRole) +
    Number(!readiness.needsLocation) +
    Number(!readiness.needsDesign);
  return { complete, total: 3, readiness };
}

export function getSteelHomeWorkspaceStatuses(
  draft: SteelHomeProjectDraft
): Record<SteelHomeWorkspace, "complete" | "started" | "optional" | "needed"> {
  const { readiness } = getRequiredProgress(draft);
  const hasProjectDetails = Boolean(
    draft.projectRole || draft.location || draft.stateCode || draft.timing
  );
  return {
    project:
      readiness.needsRole || readiness.needsLocation
        ? hasProjectDetails
          ? "started"
          : "needed"
        : "complete",
    building: draft.building.included ? "complete" : "optional",
    countertops: draft.countertops.included ? "complete" : "optional",
    cabinets: draft.cabinets.included ? "complete" : "optional",
    "whole-home":
      draft.additionalScopes.length || draft.labor.trades.length ? "complete" : "optional",
    review: readiness.projectReady ? "complete" : "needed",
  };
}

export default function SteelHomeProjectSummary({
  draft,
  saved,
  onOpenReview,
  layout = "rail",
}: Props) {
  const estimate = getSteelHomeProjectEstimateSummary(draft);
  const { complete, total } = getRequiredProgress(draft);
  const included = [
    draft.building.included ? "Building + roof" : "",
    draft.countertops.included ? "Countertops" : "",
    draft.cabinets.included ? "Cabinets" : "",
  ].filter(Boolean);
  const estimateLabel = included.length ? "Quote required" : "No package selected";
  const progressWidthClass = ["w-0", "w-1/3", "w-2/3", "w-full"][complete];

  if (layout === "mobile") {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t border-[#18312f]/10 bg-[#f7f3eb]/95 px-4 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_34px_rgba(24,49,47,0.12)] backdrop-blur-xl xl:hidden"
        data-testid="steel-home-project-summary-mobile"
      >
        <div className="min-w-0">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#a94f2e]">
            <span aria-live="polite">
              {saved ? "Saved" : "Saving"} · {complete} of {total} details
            </span>
          </p>
          <p className="truncate text-base font-bold text-[#18312f]">{estimateLabel}</p>
        </div>
        <button
          type="button"
          onClick={onOpenReview}
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-[#a94f2e] px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
        >
          Summary
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (layout === "strip") {
    return (
      <aside
        className="hidden border-b border-[#18312f]/10 bg-white px-4 py-3 sm:px-6 xl:block 2xl:hidden"
        data-testid="steel-home-project-summary-strip"
        aria-label="Project summary"
      >
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[#18312f]">
            <Save className="h-4 w-4 text-[#a94f2e]" aria-hidden="true" />
            {saved ? "Saved on this device" : "Saving changes"}
          </span>
          <span className="text-sm text-[#68736f]">
            {complete} of {total} required details complete
          </span>
          <span className="text-sm font-bold text-[#18312f]">{estimateLabel}</span>
          <button
            type="button"
            onClick={onOpenReview}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-[#18312f] px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18312f]"
          >
            Open summary
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="hidden h-full flex-col border-l border-[#18312f]/10 bg-[#eee7dc] p-5 2xl:flex"
      data-testid="steel-home-project-summary"
      aria-label="Project summary"
    >
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#a94f2e]">
        <Save className="h-4 w-4" aria-hidden="true" />
        {saved ? "Saved on this device" : "Saving changes"}
      </div>

      <div className="mt-6">
        <p className="text-sm font-bold text-[#18312f]">Required details</p>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-[#18312f]/10"
          role="progressbar"
          aria-label="Required project details"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={complete}
          data-testid="steel-home-project-progress"
        >
          <div
            className={`h-full rounded-full bg-[#c9683d] transition-[width] ${progressWidthClass}`}
          />
        </div>
        <p className="mt-2 text-xs text-[#68736f]" aria-live="polite">
          {complete} of {total} complete
        </p>
      </div>

      <div className="mt-6 rounded-2xl bg-[#18312f] p-5 text-white">
        <div className="flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
          <FileSearch className="h-4 w-4" aria-hidden="true" />
          Estimated package total
        </div>
        <p className="mt-3 font-editorial text-3xl font-semibold tracking-[-0.03em]">
          {estimateLabel}
        </p>
        {estimate.quoteRequired.length ? (
          <p className="mt-2 text-xs leading-5 text-white/60">
            {estimate.quoteRequired.length}{" "}
            {estimate.quoteRequired.length === 1 ? "item needs" : "items need"} a quote
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="text-sm font-bold text-[#18312f]">Included packages</p>
        {included.length ? (
          <ul className="mt-3 space-y-2">
            {included.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-[#41514d]">
                <CheckCircle2 className="h-4 w-4 text-[#37724a]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[#68736f]">Nothing included yet</p>
        )}
        {draft.additionalScopes.length ? (
          <p className="mt-3 text-xs text-[#68736f]">
            {draft.additionalScopes.length} whole-home{" "}
            {draft.additionalScopes.length === 1 ? "need" : "needs"} selected
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onOpenReview}
        className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#a94f2e] px-5 text-sm font-bold text-white shadow-[0_14px_35px_rgba(84,35,18,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e]"
      >
        Open summary
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
