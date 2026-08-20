import {
  ArrowRight,
  Check,
  ChevronDown,
  FileSearch,
  FileText,
  HardHat,
  Home,
  MapPin,
  PackageCheck,
  RotateCcw,
  Search,
  Send,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { STEEL_HOME_PACKAGES_PROFILE_CONTENT as content } from "@shared/steelHomePackagesProfile";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import {
  parseDirectConnectEntryContext,
  type DirectConnectEntryContext,
} from "@/pages/direct-connect/directConnectEntryContext";
import {
  getDirectConnectEntryFallbackHref,
  stageDirectConnectEntryContext,
} from "@/pages/direct-connect/stagedDirectConnectEntryContext";
import {
  BUILDING_COLOR_OPTIONS,
  BUILDING_PORCH_OPTIONS,
  BUILDING_ROOF_OPTIONS,
  BUILDING_USE_OPTIONS,
  CABINET_FINISH_OPTIONS,
  CABINET_LAYOUT_OPTIONS,
  COUNTERTOP_LAYOUT_OPTIONS,
  PROJECT_ROLE_OPTIONS,
  buildSteelHomeLaborRequestHref,
  buildSteelHomeProjectRequestHref,
  calculateCabinetPlannedWidth,
  calculateCountertopSquareFeet,
  formatSteelHomeProjectLocation,
  getSteelHomeProjectEstimateSummary,
  getSteelHomeProjectReadiness,
  type SteelHomeProjectDraft,
} from "./projectModel";

type Props = {
  draft: SteelHomeProjectDraft;
  requestHref: string;
  laborRequestHref: string;
  saved: boolean;
  onChange: (draft: SteelHomeProjectDraft) => void;
  onReset: () => void;
};

const PACKAGE_CHOICES = [
  { key: "building", label: "Building + roof" },
  { key: "countertops", label: "Countertops" },
  { key: "cabinets", label: "Cabinets" },
] as const;

function optionLabel(value: string, options: readonly { value: string; label: string }[]) {
  return options.find((option) => option.value === value)?.label || value;
}

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
  const prepareHref = (anchor: HTMLAnchorElement, refresh = false) => {
    if (!refresh && new URL(anchor.href, window.location.href).searchParams.has("staged")) return;
    anchor.href = stageDirectConnectEntryContext(context, destinationHref);
  };
  const className =
    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto";

  if (!ready) {
    return (
      <span
        aria-disabled="true"
        data-testid={testId}
        className={`${className} cursor-not-allowed bg-[#d9ddd5] text-[#596762]`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
    );
  }

  return (
    <a
      href={fallbackHref}
      onFocus={(event) => prepareHref(event.currentTarget)}
      onPointerDown={(event) => prepareHref(event.currentTarget, true)}
      onClick={(event) => prepareHref(event.currentTarget, event.detail === 0)}
      data-testid={testId}
      className={`${className} bg-[#a94f2e] text-white shadow-[0_16px_45px_rgba(84,35,18,0.2)] hover:bg-[#8f3f25] focus-visible:ring-[#a94f2e]`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  children,
  className = "",
  testId,
}: {
  icon: typeof Home;
  title: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <article
      className={`rounded-[1.5rem] border border-[#18312f]/10 bg-white p-5 shadow-[0_12px_36px_rgba(24,49,47,0.055)] ${className}`}
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7ede5] text-[#18312f]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="text-sm font-black text-[#18312f]">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-[#18312f]/10 py-3 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs font-bold text-[#5e6965]">{label}</dt>
      <dd className="text-sm leading-6 text-[#18312f]">{value}</dd>
    </div>
  );
}

function SelectionList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (!items.length) return <p className="text-sm leading-6 text-[#74807b]">{emptyText}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#edf1e9] px-3 text-xs font-bold text-[#304540]"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function SteelHomeProjectReview({
  draft,
  requestHref,
  laborRequestHref,
  saved,
  onReset,
}: Props) {
  const readiness = getSteelHomeProjectReadiness(draft);
  const projectContext = parseDirectConnectEntryContext(
    buildSteelHomeProjectRequestHref(requestHref, draft)
  );
  const laborContext = parseDirectConnectEntryContext(
    buildSteelHomeLaborRequestHref(laborRequestHref, draft)
  );
  const total = getSteelHomeProjectEstimateSummary(draft);
  const quoteRequired = [
    ...(draft.building.included
      ? ["Metal building: catalog availability, engineering, freight, and installation."]
      : []),
    ...(draft.cabinets.included
      ? ["Cabinets: field measurements, final catalog selections, delivery, and installation."]
      : []),
    ...total.quoteRequired,
  ];
  const selectedRole = PROJECT_ROLE_OPTIONS.find((option) => option.value === draft.projectRole);
  const contractingSetup = selectedRole?.label;
  const includedPackages = PACKAGE_CHOICES.filter((item) => draft[item.key].included).map(
    (item) => item.label
  );
  const otherHomeNeeds = readiness.additionalScopeLabels;
  const missingProjectParts = [
    readiness.needsRole ? "Choose your contracting setup" : "",
    readiness.needsLocation ? "Add the project location" : "",
    readiness.needsDesign ? "Add at least one package or home need" : "",
  ].filter(Boolean);
  const stone = draft.countertops.included ? getCatalogItemById(draft.countertops.stoneId) : null;

  return (
    <section
      id="project-review"
      className="scroll-mt-24 bg-[#eee7dc]"
      data-testid="steel-home-project-review"
    >
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-[#18312f]/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a94f2e]">
              Summary &amp; request
            </p>
            <h2 className="mt-2 max-w-3xl font-editorial text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#18312f] sm:text-4xl">
              Check everything before you send it.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5e6965]">
              Your choices are grouped below. Open the complete details for a closer look, then
              start the request when everything is ready.
            </p>
          </div>
          <span
            className={`w-fit shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${
              saved ? "bg-[#dce9df] text-[#18312f]" : "bg-[#18312f]/10 text-[#52615d]"
            }`}
            data-testid="steel-home-project-save-status"
            aria-live="polite"
          >
            {saved ? "Saved on this device" : "Saving on this device"}
          </span>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard icon={MapPin} title="Contracting setup & location">
            <dl className="space-y-3">
              <div>
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b4b33]">
                  Contracting setup
                </dt>
                <dd className="mt-1 text-sm font-bold text-[#18312f]">
                  {contractingSetup || "Not selected"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b4b33]">
                  Project location
                </dt>
                <dd className="mt-1 text-sm leading-6 text-[#455651]">
                  {draft.location ? formatSteelHomeProjectLocation(draft) : "Not entered"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8b4b33]">
                  Desired timing
                </dt>
                <dd className="mt-1 text-sm leading-6 text-[#455651]">
                  {draft.timing || "Not selected"}
                </dd>
              </div>
            </dl>
          </SummaryCard>

          <SummaryCard icon={PackageCheck} title="Included packages">
            <SelectionList items={includedPackages} emptyText="No packages selected yet." />
            <div className="sr-only">
              {PACKAGE_CHOICES.map((item) => (
                <span key={item.key} data-testid={`steel-home-review-scope-${item.key}`}>
                  {draft[item.key].included ? "Included" : "Not included"}
                </span>
              ))}
            </div>
          </SummaryCard>

          <SummaryCard icon={Home} title="Other home needs">
            <SelectionList items={otherHomeNeeds} emptyText="No other home needs selected." />
          </SummaryCard>

          <SummaryCard icon={Wrench} title="Local trade needs">
            <SelectionList
              items={draft.labor.trades}
              emptyText="No local trade help selected yet."
            />
            {draft.labor.notes ? (
              <p className="mt-3 border-t border-[#18312f]/10 pt-3 text-xs leading-5 text-[#5e6965]">
                {draft.labor.notes}
              </p>
            ) : null}
          </SummaryCard>

          <SummaryCard
            icon={FileSearch}
            title="Pricing status"
            testId="steel-home-project-estimate-summary"
          >
            <p className="font-editorial text-3xl font-semibold tracking-[-0.03em] text-[#18312f]">
              {includedPackages.length ? "Quote required" : "No package selected"}
            </p>
            <p className="mt-3 text-xs leading-5 text-[#74807b]">
              This planner does not invent prices. A qualified seller or trade professional must
              review the measured scope before providing availability and pricing.
            </p>
          </SummaryCard>

          <SummaryCard icon={FileText} title="Quotes still needed">
            <SelectionList items={quoteRequired} emptyText="No additional quotes needed." />
          </SummaryCard>
        </div>

        <details className="group mt-5 rounded-[1.5rem] border border-[#18312f]/10 bg-[#f9f6ef]">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 text-sm font-black text-[#18312f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a94f2e] sm:px-6 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-[#a94f2e]" aria-hidden="true" />
              View package measurements and selections
            </span>
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
          </summary>

          <div
            className="grid gap-4 border-t border-[#18312f]/10 p-5 sm:p-6 lg:grid-cols-3"
            data-testid="steel-home-project-brief"
          >
            {draft.building.included ? (
              <article className="rounded-2xl bg-white p-5">
                <h4 className="font-editorial text-2xl font-semibold text-[#18312f]">
                  Building + roof
                </h4>
                <dl className="mt-3">
                  <DetailRow
                    label="Building type"
                    value={optionLabel(draft.building.use, BUILDING_USE_OPTIONS)}
                  />
                  <DetailRow
                    label="Size"
                    value={`${draft.building.widthFt}' wide × ${draft.building.lengthFt}' long × ${draft.building.eaveHeightFt}' eave`}
                  />
                  <DetailRow
                    label="Roof"
                    value={`${optionLabel(draft.building.roofStyle, BUILDING_ROOF_OPTIONS)}, ${draft.building.roofPitch}`}
                  />
                  <DetailRow
                    label="Doors & windows"
                    value={`${draft.building.garageDoors} ${draft.building.garageDoors === 1 ? "garage-door opening" : "garage-door openings"}, ${draft.building.walkDoors} ${draft.building.walkDoors === 1 ? "exterior entry door" : "exterior entry doors"}, ${draft.building.windows} ${draft.building.windows === 1 ? "window" : "windows"}`}
                  />
                  <DetailRow
                    label="Porch"
                    value={
                      draft.building.porch === "none"
                        ? "None"
                        : `${optionLabel(draft.building.porch, BUILDING_PORCH_OPTIONS)}, ${draft.building.porchDepthFt}' deep`
                    }
                  />
                  <DetailRow
                    label="Colors"
                    value={`Walls ${optionLabel(draft.building.wallColor, BUILDING_COLOR_OPTIONS)}; roof ${optionLabel(draft.building.roofColor, BUILDING_COLOR_OPTIONS)}; trim ${optionLabel(draft.building.trimColor, BUILDING_COLOR_OPTIONS)}`}
                  />
                  {draft.building.notes ? (
                    <DetailRow label="Notes" value={draft.building.notes} />
                  ) : null}
                </dl>
              </article>
            ) : null}

            {draft.countertops.included ? (
              <article className="rounded-2xl bg-white p-5">
                <h4 className="font-editorial text-2xl font-semibold text-[#18312f]">
                  Countertops
                </h4>
                <dl className="mt-3">
                  <DetailRow
                    label="Room & shape"
                    value={`${draft.countertops.room}, ${optionLabel(draft.countertops.layout, COUNTERTOP_LAYOUT_OPTIONS)}`}
                  />
                  <DetailRow
                    label="Surface"
                    value={
                      stone
                        ? `${stone.publicLabel}${stone.materialLabel ? ` — ${stone.materialLabel}` : ""}`
                        : "Not selected"
                    }
                  />
                  <DetailRow
                    label="Estimated area"
                    value={`About ${calculateCountertopSquareFeet(draft.countertops)} sq. ft.`}
                  />
                  <DetailRow
                    label="Island"
                    value={
                      draft.countertops.island
                        ? `${draft.countertops.islandLengthIn}\" × ${draft.countertops.islandWidthIn}\"`
                        : "None"
                    }
                  />
                  <DetailRow
                    label="Finishing choices"
                    value={`${draft.countertops.edge} edge; ${draft.countertops.backsplash} backsplash; ${draft.countertops.sink} sink; ${draft.countertops.cooktop} cooktop`}
                  />
                  {draft.countertops.notes ? (
                    <DetailRow label="Notes" value={draft.countertops.notes} />
                  ) : null}
                </dl>
              </article>
            ) : null}

            {draft.cabinets.included ? (
              <article className="rounded-2xl bg-white p-5">
                <h4 className="font-editorial text-2xl font-semibold text-[#18312f]">Cabinets</h4>
                <dl className="mt-3">
                  <DetailRow
                    label="Room & shape"
                    value={`${draft.cabinets.room}, ${optionLabel(draft.cabinets.layout, CABINET_LAYOUT_OPTIONS)}`}
                  />
                  <DetailRow
                    label="Room size"
                    value={`${draft.cabinets.primaryWallIn}\" main wall; ${draft.cabinets.returnWallIn}\" return; ${draft.cabinets.ceilingHeightIn}\" ceiling`}
                  />
                  <DetailRow
                    label="Look"
                    value={`${draft.cabinets.doorStyle}; ${optionLabel(draft.cabinets.finish, CABINET_FINISH_OPTIONS)}; ${draft.cabinets.hardware}`}
                  />
                  <DetailRow
                    label="Main wall fit"
                    value={`${calculateCabinetPlannedWidth(draft.cabinets)}\" used of ${draft.cabinets.primaryWallIn}\"`}
                  />
                  <DetailRow
                    label="Island"
                    value={
                      draft.cabinets.island
                        ? `${draft.cabinets.islandLengthIn}\" × ${draft.cabinets.islandWidthIn}\"`
                        : "None"
                    }
                  />
                  {draft.cabinets.notes ? (
                    <DetailRow label="Notes" value={draft.cabinets.notes} />
                  ) : null}
                </dl>
              </article>
            ) : null}

            {!includedPackages.length ? (
              <p className="text-sm leading-6 text-[#68736f]">
                Choose a building, surface, or cabinet package to see its complete details here.
              </p>
            ) : null}
          </div>
        </details>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-[1.5rem] bg-[#18312f] p-5 text-white sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f0b392] text-[#18312f]">
                <PackageCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-black">Request package pricing</h3>
                <p className="mt-2 text-xs leading-5 text-white/[0.65]">
                  Review your details and add your contact information before anything is sent.
                </p>
              </div>
            </div>
            <div className="mt-5">
              <RequestAction
                ready={readiness.projectReady}
                context={projectContext}
                destinationHref={requestHref}
                label="Start a Request"
                testId="steel-home-project-request"
              />
            </div>
            {!readiness.projectReady ? (
              <p
                className="mt-4 text-xs font-bold leading-5 text-[#f0b392]"
                data-testid="steel-home-project-needs"
              >
                Before you continue: {missingProjectParts.join("; ")}.
              </p>
            ) : null}
          </section>

          <section className="rounded-[1.5rem] border border-[#18312f]/10 bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e7ede5] text-[#18312f]">
                <HardHat className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-black text-[#18312f]">Request local trade help</h3>
                <p className="mt-2 text-xs leading-5 text-[#68736f]">
                  Local trade work uses a separate request from the material packages.
                </p>
              </div>
            </div>
            <div className="mt-5">
              <RequestAction
                ready={readiness.laborReady}
                context={laborContext}
                destinationHref={laborRequestHref}
                label="Start a Local Trade Request"
                testId="steel-home-labor-request"
                icon="search"
              />
            </div>
            {!readiness.laborReady ? (
              <p className="mt-4 text-xs font-semibold leading-5 text-[#8b4b33]">
                Add the project location and choose at least one local trade need first.
              </p>
            ) : null}
          </section>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#18312f]/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[#68736f]">
            Your saved choices stay on this device until you reset them.
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

        <p
          className="mx-auto mt-10 max-w-5xl text-center text-xs leading-6 text-[#6a746f]"
          data-testid="steel-home-disclosure"
        >
          {content.disclosure}
        </p>
      </div>
    </section>
  );
}
