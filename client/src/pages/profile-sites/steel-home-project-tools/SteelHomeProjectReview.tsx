import { ArrowRight, Check, CircleDollarSign, MapPin, RotateCcw, Search, Send } from "lucide-react";
import { STEEL_HOME_PACKAGES_PROFILE_CONTENT as content } from "@shared/steelHomePackagesProfile";
import { getAllStates, getCountiesByState } from "@shared/states-counties";
import {
  parseDirectConnectEntryContext,
  type DirectConnectEntryContext,
} from "@/pages/direct-connect/directConnectEntryContext";
import {
  getDirectConnectEntryFallbackHref,
  stageDirectConnectEntryContext,
} from "@/pages/direct-connect/stagedDirectConnectEntryContext";
import {
  LOCAL_LABOR_OPTIONS,
  PROJECT_ROLE_OPTIONS,
  PROJECT_TIMING_OPTIONS,
  buildSteelHomeLaborRequestHref,
  buildSteelHomeProjectDescription,
  buildSteelHomeProjectRequestHref,
  formatPlanningRange,
  getSteelHomeProjectEstimateSummary,
  getSteelHomeProjectReadiness,
  type SteelHomeProjectDraft,
} from "./projectModel";
import { PROJECT_FIELD_CLASS, PROJECT_TEXTAREA_CLASS } from "./ProjectToolControls";

type Props = {
  draft: SteelHomeProjectDraft;
  requestHref: string;
  laborRequestHref: string;
  saved: boolean;
  onChange: (draft: SteelHomeProjectDraft) => void;
  onReset: () => void;
};

const DESIGN_SCOPES = [
  { key: "building", label: "Building + roof" },
  { key: "countertops", label: "Stone + quartz" },
  { key: "cabinets", label: "Cabinets" },
] as const;

const STATE_OPTIONS = getAllStates();

function RequestAction({
  ready,
  context,
  destinationHref,
  label,
  testId,
  icon = "send",
}: {
  ready: boolean;
  context: DirectConnectEntryContext;
  destinationHref: string;
  label: string;
  testId: string;
  icon?: "send" | "search";
}) {
  const Icon = icon === "search" ? Search : Send;
  const fallbackHref = getDirectConnectEntryFallbackHref(destinationHref);
  const className =
    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto";

  if (!ready) {
    return (
      <span
        aria-disabled="true"
        data-testid={testId}
        className={`${className} cursor-not-allowed bg-[#18312f]/10 text-[#18312f]/[0.45]`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <a
      href={fallbackHref}
      onClick={(event) => {
        event.currentTarget.href = stageDirectConnectEntryContext(context, destinationHref);
      }}
      data-testid={testId}
      className={`${className} bg-[#c9683d] text-white shadow-[0_16px_45px_rgba(84,35,18,0.22)] hover:bg-[#b55732] focus-visible:ring-[#c9683d]`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

export default function SteelHomeProjectReview({
  draft,
  requestHref,
  laborRequestHref,
  saved,
  onChange,
  onReset,
}: Props) {
  const readiness = getSteelHomeProjectReadiness(draft);
  const projectContext = parseDirectConnectEntryContext(
    buildSteelHomeProjectRequestHref(requestHref, draft)
  );
  const laborContext = parseDirectConnectEntryContext(
    buildSteelHomeLaborRequestHref(laborRequestHref, draft)
  );
  const brief = buildSteelHomeProjectDescription(draft);
  const estimateSummary = getSteelHomeProjectEstimateSummary(draft);
  const countyOptions = draft.stateCode ? getCountiesByState(draft.stateCode) : [];
  const selectedRole = PROJECT_ROLE_OPTIONS.find((option) => option.value === draft.projectRole);
  const planScopes = [...readiness.includedScopes, ...readiness.additionalScopeLabels];
  const missingProjectParts = [
    readiness.needsRole ? "choose how you are building" : "",
    readiness.needsLocation ? "confirm the project city, state, and county" : "",
    readiness.needsDesign ? "add at least one design or home scope" : "",
  ].filter(Boolean);

  const update = (values: Partial<SteelHomeProjectDraft>) => onChange({ ...draft, ...values });
  const toggleTrade = (trade: string) => {
    const selected = draft.labor.trades.includes(trade);
    update({
      labor: {
        ...draft.labor,
        trades: selected
          ? draft.labor.trades.filter((item) => item !== trade)
          : [...draft.labor.trades, trade],
      },
    });
  };

  return (
    <section
      id="project-review"
      className="scroll-mt-24 bg-[#eee7dc]"
      data-testid="steel-home-project-review"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-28 lg:px-10">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,.82fr)_minmax(560px,1.18fr)] xl:gap-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
              {content.review.eyebrow}
            </p>
            <h2 className="mt-4 max-w-3xl font-editorial text-5xl font-semibold leading-[0.92] tracking-[-0.045em] text-[#18312f] sm:text-7xl">
              {content.review.title}
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#5e6965] sm:text-lg">
              {content.review.body}
            </p>

            <div className="mt-9 rounded-[2rem] bg-[#18312f] p-6 text-white shadow-[0_24px_80px_rgba(24,49,47,0.18)] sm:p-8">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f0b392]">
                    My build plan
                  </p>
                  <h3 className="mt-3 font-editorial text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                    What you have chosen so far.
                  </h3>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.14em] ${
                    saved ? "bg-[#dce9df] text-[#18312f]" : "bg-white/10 text-white/70"
                  }`}
                  data-testid="steel-home-project-save-status"
                  aria-live="polite"
                >
                  {saved ? "Saved" : "In this browser"}
                </span>
              </div>

              <div className="mt-7 rounded-2xl border border-white/10 bg-black/[0.15] p-5">
                <p className="text-sm font-bold text-white">Project summary</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
                      Location
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/[0.72]">
                      {draft.location || "Add the project location below"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
                      Your role
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/[0.72]">
                      {selectedRole?.label || "Choose how you are building above"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#f0b392]">
                      Project scopes
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/[0.72]">
                      {planScopes.join(", ") || "Add a design or home scope above"}
                    </p>
                  </div>
                </div>
                <details className="mt-4 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer text-xs font-bold text-white/[0.72]">
                    View full design details
                  </summary>
                  <pre
                    className="mt-4 max-h-[24rem] overflow-auto whitespace-pre-wrap font-sans text-xs leading-6 text-white/[0.58]"
                    data-testid="steel-home-project-brief"
                  >
                    {brief}
                  </pre>
                </details>
              </div>

              <div
                className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-5"
                data-testid="steel-home-project-estimate-summary"
              >
                <div className="flex items-start gap-3">
                  <CircleDollarSign
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#f0b392]"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#f0b392]">
                      Materials planning estimate
                    </p>
                    <p className="mt-2 font-editorial text-3xl font-semibold tracking-[-0.03em]">
                      {estimateSummary.planningRange
                        ? formatPlanningRange(estimateSummary.planningRange)
                        : "Add a building or cabinet plan"}
                    </p>
                    {estimateSummary.planningEstimates.length ? (
                      <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                        {estimateSummary.planningEstimates.map((estimate) => (
                          <div
                            key={estimate.key}
                            className="flex items-center justify-between gap-4 text-sm"
                          >
                            <span className="text-white/[0.66]">{estimate.label}</span>
                            <span className="shrink-0 font-bold">
                              {formatPlanningRange(estimate.range)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {estimateSummary.quoteRequired.length ? (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <p className="text-xs font-bold text-white/[0.75]">Price after review</p>
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-white/[0.55]">
                          {estimateSummary.quoteRequired.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <p className="mt-4 text-xs leading-5 text-white/[0.48]">
                      {estimateSummary.disclaimer}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <RequestAction
                  ready={readiness.projectReady}
                  context={projectContext}
                  destinationHref={requestHref}
                  label="Start a Request"
                  testId="steel-home-project-request"
                />
                <p className="text-xs leading-5 text-white/[0.55]">
                  You will review the details and add your contact information before anything is
                  sent.
                </p>
              </div>
              {!readiness.projectReady ? (
                <p
                  className="mt-4 text-sm font-semibold text-[#f0b392]"
                  data-testid="steel-home-project-needs"
                >
                  Complete these to continue: {missingProjectParts.join("; ")}.
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-[#18312f]/10 bg-[#fbf8f1] p-5 shadow-[0_24px_80px_rgba(24,49,47,0.08)] sm:p-8">
              <div className="flex items-center gap-3 border-b border-[#18312f]/10 pb-6">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#18312f] text-white">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#18312f]">Project details</p>
                  <p className="mt-1 text-xs text-[#6d7874]">
                    Used to prepare local review and jobsite support.
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-bold text-[#18312f]">
                  <span>Project city, address, or ZIP</span>
                  <input
                    type="text"
                    value={draft.location}
                    maxLength={160}
                    onChange={(event) => update({ location: event.target.value })}
                    placeholder="City, state or ZIP"
                    autoComplete="postal-code"
                    className={PROJECT_FIELD_CLASS}
                    data-testid="steel-home-project-location"
                  />
                </label>
                <label className="space-y-2 text-sm font-bold text-[#18312f]">
                  <span>Desired timing</span>
                  <select
                    value={draft.timing}
                    onChange={(event) => update({ timing: event.target.value })}
                    className={PROJECT_FIELD_CLASS}
                    data-testid="steel-home-project-timing"
                  >
                    <option value="">Choose timing</option>
                    {PROJECT_TIMING_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-bold text-[#18312f]">
                  <span>Jobsite state</span>
                  <select
                    value={draft.stateCode}
                    onChange={(event) =>
                      update({
                        stateCode: event.target.value,
                        countyFips: "",
                        countyName: "",
                      })
                    }
                    className={PROJECT_FIELD_CLASS}
                    data-testid="steel-home-project-state"
                  >
                    <option value="">Choose state</option>
                    {STATE_OPTIONS.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-bold text-[#18312f]">
                  <span>Jobsite county</span>
                  <select
                    value={draft.countyFips}
                    disabled={!draft.stateCode}
                    onChange={(event) => {
                      const countyFips = event.target.value;
                      const county = countyOptions.find((option) => option.fipsCode === countyFips);
                      update({ countyFips, countyName: county?.name || "" });
                    }}
                    className={PROJECT_FIELD_CLASS}
                    data-testid="steel-home-project-county"
                  >
                    <option value="">
                      {draft.stateCode ? "Choose county" : "Choose state first"}
                    </option>
                    {countyOptions.map((county) => (
                      <option key={county.fipsCode} value={county.fipsCode}>
                        {county.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p className="mt-4 text-xs leading-5 text-[#6d7874]">
                The selected state and county guide local requirements and jobsite support. Make
                sure they match the city, address, or ZIP entered above.
              </p>

              <div className="mt-7">
                <p className="text-sm font-bold text-[#18312f]">Designs included in the brief</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {DESIGN_SCOPES.map((scope) => {
                    const included = draft[scope.key].included;
                    return (
                      <div
                        key={scope.key}
                        className={`rounded-2xl border p-4 ${
                          included
                            ? "border-[#18312f] bg-[#e2ebe3]"
                            : "border-[#18312f]/10 bg-white text-[#76817d]"
                        }`}
                        data-testid={`steel-home-review-scope-${scope.key}`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <span
                            className={`grid h-6 w-6 place-items-center rounded-full ${
                              included ? "bg-[#18312f] text-white" : "bg-[#18312f]/10"
                            }`}
                          >
                            {included ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                          </span>
                          {scope.label}
                        </span>
                        <span className="mt-2 block text-xs">
                          {included ? "Added to plan" : "Not included"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#18312f]/10 bg-white p-5 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
                {content.labor.eyebrow}
              </p>
              <h3 className="mt-3 font-editorial text-4xl font-semibold leading-none tracking-[-0.035em] text-[#18312f]">
                {content.labor.title}
              </h3>
              <p className="mt-4 text-sm leading-6 text-[#68736f]">{content.labor.body}</p>

              <fieldset className="mt-6">
                <legend className="text-sm font-bold text-[#18312f]">Labor needed</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LOCAL_LABOR_OPTIONS.map((trade) => {
                    const selected = draft.labor.trades.includes(trade);
                    return (
                      <button
                        key={trade}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleTrade(trade)}
                        data-testid={`steel-home-labor-${trade.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a94f2e] ${
                          selected
                            ? "border-[#18312f] bg-[#18312f] text-white"
                            : "border-[#18312f]/[0.15] bg-[#f8f4ec] text-[#41514d] hover:border-[#18312f]/40"
                        }`}
                      >
                        {trade}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="mt-6 block space-y-2 text-sm font-bold text-[#18312f]">
                <span>Labor notes</span>
                <textarea
                  value={draft.labor.notes}
                  maxLength={240}
                  onChange={(event) =>
                    update({ labor: { ...draft.labor, notes: event.target.value } })
                  }
                  placeholder="Access, schedule, site conditions, or work already completed."
                  className={PROJECT_TEXTAREA_CLASS}
                />
              </label>

              <div className="mt-7 flex flex-col items-start gap-3 border-t border-[#18312f]/10 pt-7">
                <RequestAction
                  ready={readiness.laborReady}
                  context={laborContext}
                  destinationHref={laborRequestHref}
                  label="Find local labor"
                  testId="steel-home-labor-request"
                  icon="search"
                />
                <p className="text-xs leading-5 text-[#68736f]">
                  Labor stays separate from product pricing and uses the selected jobsite state and
                  county for local review.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-[#18312f]/10 bg-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[#68736f]">
                This plan stays on this device until you reset it.
              </p>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#18312f]/20 px-4 text-sm font-bold text-[#18312f] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18312f]"
                data-testid="steel-home-project-reset"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reset project
              </button>
            </div>
          </div>
        </div>

        <p
          className="mx-auto mt-14 max-w-5xl text-center text-xs leading-6 text-[#6a746f]"
          data-testid="steel-home-disclosure"
        >
          {content.disclosure}
        </p>
      </div>
    </section>
  );
}
