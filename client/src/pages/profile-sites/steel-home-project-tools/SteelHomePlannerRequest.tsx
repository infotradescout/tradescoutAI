import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { Check, CircleDollarSign, MapPin, Ruler, ShieldCheck, X } from "lucide-react";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import { parseDirectConnectEntryContext } from "@/pages/direct-connect/directConnectEntryContext";
import ProjectDetailsFields from "./ProjectDetailsFields";
import SteelHomeRequestAction from "./SteelHomeRequestAction";
import type { SteelHomePlanner } from "./SteelHomePlannerNav";
import {
  PROJECT_ROLE_OPTIONS,
  buildSteelHomeProjectRequestHref,
  calculateBuildingPlanningEstimate,
  calculateCabinetPlanningEstimate,
  calculateCountertopSquareFeet,
  formatPlanningRange,
  reconcileSteelHomeProjectDraft,
  type SteelHomeProjectDraft,
} from "./projectModel";

type Props = {
  planner: SteelHomePlanner;
  draft: SteelHomeProjectDraft;
  onChange: (draft: SteelHomeProjectDraft) => void;
  requestHref: string;
  saved: boolean;
  onClose: () => void;
};

const PLANNER_COPY: Record<
  SteelHomePlanner,
  { label: string; requestTitle: string; color: string }
> = {
  building: {
    label: "Metal Building",
    requestTitle: "TradeScout Metal Building Planning Request",
    color: "bg-[#18312f]",
  },
  countertops: {
    label: "Countertop",
    requestTitle: "TradeScout Countertop Planning Request",
    color: "bg-[#17201f]",
  },
  cabinets: {
    label: "Cabinet",
    requestTitle: "TradeScout Cabinet Planning Request",
    color: "bg-[#654936]",
  },
};

const REQUEST_ROLE_OPTIONS = PROJECT_ROLE_OPTIONS.filter(
  (option) => option.value !== "whole-build-help"
);

export function buildScopedSteelHomePlannerDraft(
  planner: SteelHomePlanner,
  draftInput: SteelHomeProjectDraft
): SteelHomeProjectDraft {
  const draft = reconcileSteelHomeProjectDraft(draftInput);
  return reconcileSteelHomeProjectDraft({
    ...draft,
    additionalScopes: [],
    building: { ...draft.building, included: planner === "building" },
    countertops: { ...draft.countertops, included: planner === "countertops" },
    cabinets: { ...draft.cabinets, included: planner === "cabinets" },
    labor: { trades: [], notes: "" },
  });
}

function plannerResult(planner: SteelHomePlanner, draft: SteelHomeProjectDraft) {
  if (planner === "building") {
    const estimate = calculateBuildingPlanningEstimate(draft.building);
    return {
      eyebrow: "Early metal building estimate",
      value: formatPlanningRange(estimate.range),
      detail: `${draft.building.widthFt}' × ${draft.building.lengthFt}' metal building with roof`,
      icon: CircleDollarSign,
    };
  }
  if (planner === "cabinets") {
    const estimate = calculateCabinetPlanningEstimate(draft.cabinets);
    return {
      eyebrow: "Early cabinet estimate",
      value: formatPlanningRange(estimate.range),
      detail: `${draft.cabinets.room} · ${draft.cabinets.primaryWallIn}" main wall`,
      icon: CircleDollarSign,
    };
  }

  const stone = getCatalogItemById(draft.countertops.stoneId);
  return {
    eyebrow: "Approximate countertop area",
    value: `About ${calculateCountertopSquareFeet(draft.countertops)} sq. ft.`,
    detail: `${stone?.publicLabel || "Selected surface"} · Quote needed`,
    icon: Ruler,
  };
}

export default function SteelHomePlannerRequest({
  planner,
  draft,
  onChange,
  requestHref,
  saved,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const copy = PLANNER_COPY[planner];
  const result = plannerResult(planner, draft);
  const ResultIcon = result.icon;
  const scopedDraft = useMemo(
    () => buildScopedSteelHomePlannerDraft(planner, draft),
    [draft, planner]
  );
  const context = useMemo(() => {
    const parsed = parseDirectConnectEntryContext(
      buildSteelHomeProjectRequestHref(requestHref, scopedDraft)
    );
    return {
      ...parsed,
      targetName: "Steel Home Planning Tools",
      title: copy.requestTitle,
      description: (parsed.description || "")
        .replace(/TradeScout Steel Home (?:Project|Planning) Request/, copy.requestTitle)
        .replace(/Selected packages:|Selected planning tools:/, "Planner:"),
    };
  }, [copy.requestTitle, requestHref, scopedDraft]);
  const hasVisibleProjectRole = REQUEST_ROLE_OPTIONS.some(
    (option) => option.value === draft.projectRole
  );
  const ready =
    hasVisibleProjectRole &&
    draft.location.trim().length >= 2 &&
    /^[A-Z]{2}$/.test(draft.stateCode) &&
    /^\d{5}$/.test(draft.countyFips);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []
    ).filter((element) => !element.hasAttribute("aria-hidden"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[100]" data-testid="steel-home-planner-request">
      <button
        type="button"
        aria-label="Close request details"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-[#10211f]/65 backdrop-blur-sm"
        data-testid="steel-home-planner-request-backdrop"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="steel-home-planner-request-title"
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-[#f7f3eb] text-[#18312f] shadow-[-24px_0_90px_rgba(8,24,22,.32)]"
        data-planner={planner}
      >
        <header
          className={`${copy.color} flex shrink-0 items-start justify-between gap-4 px-5 py-5 text-white sm:px-8`}
        >
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#f0b392]">
              {copy.label} Planner
            </p>
            <h2
              id="steel-home-planner-request-title"
              className="mt-2 font-editorial text-3xl font-semibold tracking-[-0.035em]"
            >
              Start a {copy.label} Request
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close request"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            data-testid="steel-home-planner-request-close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <section
            className="rounded-[1.5rem] border border-[#18312f]/10 bg-white p-5 shadow-[0_14px_45px_rgba(24,49,47,.07)] sm:p-6"
            data-testid="steel-home-planner-request-result"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7ede5] text-[#18312f]">
                <ResultIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.15em] text-[#a94f2e]">
                  {result.eyebrow}
                </p>
                <p className="mt-2 font-editorial text-3xl font-semibold tracking-[-0.035em]">
                  {result.value}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#68736f]">{result.detail}</p>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#a94f2e]" aria-hidden="true" />
              <div>
                <h3 className="text-base font-black">Only this planner goes into the request.</h3>
                <p className="mt-1 text-sm leading-6 text-[#68736f]">
                  Your {copy.label.toLowerCase()} choices stay separate from anything saved in the
                  other two planners.
                </p>
              </div>
            </div>
          </section>

          <fieldset className="mt-7">
            <legend className="text-sm font-black">Who is planning this request?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {REQUEST_ROLE_OPTIONS.map((option) => {
                const selected = draft.projectRole === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ ...draft, projectRole: option.value })}
                    data-testid={`steel-home-project-role-${option.value}`}
                    className={`relative min-h-28 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                      selected
                        ? "border-[#18312f] bg-[#e7ede5]"
                        : "border-[#18312f]/10 bg-white hover:border-[#18312f]/30"
                    }`}
                  >
                    {selected ? (
                      <Check className="absolute right-3 top-3 h-4 w-4" aria-hidden="true" />
                    ) : null}
                    <span className="block pr-5 text-sm font-black">{option.label}</span>
                    <span className="mt-2 block text-xs leading-5 text-[#68736f]">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-7 rounded-[1.5rem] border border-[#18312f]/10 bg-[#eee7dc] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-[#a94f2e]" aria-hidden="true" />
              <p className="text-sm font-black">Add the jobsite before continuing.</p>
            </div>
            <ProjectDetailsFields draft={draft} onChange={onChange} className="mt-5" />
          </div>
        </div>

        <footer className="shrink-0 border-t border-[#18312f]/10 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[#68736f]" aria-live="polite">
              {!hasVisibleProjectRole
                ? "Choose who is planning the request."
                : !ready
                  ? "Add the jobsite city or ZIP, state, and county."
                  : saved
                    ? "Ready. You will review contact details before anything is sent."
                    : "Saving your choices on this device."}
            </p>
            <div className="w-full shrink-0 sm:w-auto sm:min-w-56">
              <SteelHomeRequestAction
                ready={ready}
                context={context}
                destinationHref={requestHref}
                label="Continue to contact details"
                testId="steel-home-planner-request-submit"
              />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
