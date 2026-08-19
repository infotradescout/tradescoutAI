import React, { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileCheck2,
  FolderOpen,
  HardHat,
  Home,
  Layers3,
  LockKeyhole,
  MapPin,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const HOME_ID = "073b355c-1aa3-4658-a776-ebedaa6aaefc";
const PROJECT_ID = "d703435e-f059-468a-a8b2-bafff6a5047e";

type LaunchTab = "control" | "scope" | "packages" | "partners" | "evidence" | "release";
type AnyRecord = Record<string, any>;
type TargetRow = { slug: string; lane: string; role: string };

const TABS: Array<{ id: LaunchTab; label: string }> = [
  { id: "control", label: "Launch Control" },
  { id: "scope", label: "Scope Matrix" },
  { id: "packages", label: "Package Levels" },
  { id: "partners", label: "Partner Pipeline" },
  { id: "evidence", label: "Source Records" },
  { id: "release", label: "Release Gates" },
];

const PANEL = "rounded-3xl border border-border/70 bg-card/70 shadow-sm";
const PRIMARY = "bg-orange-500 font-black text-black hover:bg-orange-400";
const SECONDARY = "border-border bg-card text-foreground hover:bg-muted";

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : {};
}

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function human(value: unknown): string {
  const text = String(value || "").trim();
  return text
    ? text
        .replace(/^pb-target-/, "")
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not set";
}

function money(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(amount)
    : "Not set";
}

function passportUrl(tab?: string): string {
  const params = new URLSearchParams({ homeId: HOME_ID, mode: "passport" });
  if (tab) params.set("tab", tab);
  return `/homes?${params.toString()}`;
}

function initialTab(): LaunchTab {
  if (typeof window === "undefined") return "control";
  const value = new URLSearchParams(window.location.search).get("launchTab") || "";
  return TABS.some((tab) => tab.id === value) ? (value as LaunchTab) : "control";
}

function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (["complete", "known", "verified", "active", "included", "confirmed"].includes(normalized)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (
    [
      "next",
      "planning",
      "needs_review",
      "needs_confirmation",
      "needs_info",
      "source_review",
      "blocked",
      "unconfirmed",
      "blocked_on_written_confirmation",
    ].includes(normalized)
  ) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

function Pill({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.11em] ${statusTone(status)}`}
    >
      <CircleDot className="h-3 w-3" />
      {label || human(status)}
    </span>
  );
}

function Panel({
  eyebrow,
  title,
  action,
  children,
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${PANEL} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[70vh] place-items-center bg-background text-foreground">
      <div className="text-center">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-orange-400" />
        <p className="mt-4 text-sm text-muted-foreground">Loading Property Blessings HomeID…</p>
      </div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-[260px] place-items-center rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
      <div>
        <FolderOpen className="mx-auto h-8 w-8 text-orange-400" />
        <h2 className="mt-4 text-lg font-black text-foreground">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function targetName(slug: string): string {
  const labels: Record<string, string> = {
    "pb-target-provia": "ProVia",
    "pb-target-mrcool": "MRCOOL",
    "pb-target-gree-select-dealers": "GREE Select Dealer Network",
    "pb-target-rheem": "Rheem",
    "pb-target-rinnai": "Rinnai",
    "pb-target-idi-insulation": "Insulation Distributors Inc.",
    "pb-target-service-partners": "Service Partners",
    "pb-target-ferguson": "Ferguson",
    "pb-target-southern-luxe-flooring": "Southern Luxe Flooring",
    "pb-target-town-appliance": "Town Appliance",
    "pb-target-cafe-appliances": "Café Appliances",
    "pb-target-graybar": "Graybar",
    "pb-target-sonepar": "Sonepar",
    "pb-target-onpoint-warranty": "OnPoint Warranty",
    "pb-target-cinch": "Cinch Home Services",
    "pb-target-builders-firstsource": "Builders FirstSource",
    "pb-target-fbm": "Foundation Building Materials",
    "pb-target-chi-overhead-doors": "C.H.I. Overhead Doors",
    "pb-target-freight-club": "Freight Club",
    "pb-target-trinity-logistics": "Trinity Logistics",
    "pb-target-truoba": "Truoba",
    "pb-target-nexgen-steel": "NexGen Steel",
  };
  return labels[slug] || human(slug);
}

function collectTargets(primaryTargets: AnyRecord[]): TargetRow[] {
  const rows: TargetRow[] = [];
  for (const item of primaryTargets) {
    const lane = String(item.lane || "Package lane");
    if (item.slug) rows.push({ slug: String(item.slug), lane, role: "Primary" });
    if (item.backupSlug) rows.push({ slug: String(item.backupSlug), lane, role: "Backup" });
    if (item.incentiveSlug) {
      rows.push({ slug: String(item.incentiveSlug), lane, role: "Incentive" });
    }
  }
  return Array.from(new Map(rows.map((row) => [row.slug, row])).values());
}

export default function PropertyBlessingsLaunchWorkspace() {
  const [tab, setTab] = useState<LaunchTab>(() => initialTab());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("homeId", HOME_ID);
    url.searchParams.delete("mode");
    if (tab === "control") url.searchParams.delete("launchTab");
    else url.searchParams.set("launchTab", tab);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [tab]);

  const detailQuery = useQuery({ queryKey: [`/api/homes/${HOME_ID}`] });
  const persistenceQuery = useQuery({ queryKey: [`/api/homeid/${HOME_ID}/persistence`] });
  const projectsQuery = useQuery({ queryKey: [`/api/homes/${HOME_ID}/projects`] });

  if (detailQuery.isLoading || persistenceQuery.isLoading || projectsQuery.isLoading) {
    return <LoadingState />;
  }

  const detailData = asRecord(detailQuery.data);
  const home = asRecord(detailData.home);
  const documents = asList<AnyRecord>(detailData.documents);
  const records = asList<AnyRecord>(detailData.records).filter(
    (item) => !String(item.title || "").startsWith("homeid:")
  );

  const persistence = asRecord(asRecord(persistenceQuery.data).persistence);
  const evidence = asList<AnyRecord>(persistence.evidence);
  const components = asList<AnyRecord>(persistence.components);
  const facts = asList<AnyRecord>(persistence.propertyDetails);
  const requestPackets = asList<AnyRecord>(persistence.requestPackets);

  const projects = asList<AnyRecord>(asRecord(projectsQuery.data).projects);
  const project =
    projects.find((item) => String(item.id || "") === PROJECT_ID) || projects[0] || null;

  if (detailQuery.isError || persistenceQuery.isError || projectsQuery.isError || !project) {
    return (
      <div className="min-h-screen bg-background p-6 text-foreground">
        <EmptyState
          title="The Property Blessings launch record could not be loaded"
          text="The full property passport remains available while this launch-control record is checked."
        />
      </div>
    );
  }

  const metadata = asRecord(project.metadata);
  const launchBoard = asRecord(metadata.launchBoard);
  const launchTasks = asList<AnyRecord>(launchBoard.tasks);
  const partnerPipeline = asRecord(metadata.partnerPipeline);
  const primaryTargets = asList<AnyRecord>(partnerPipeline.primaryTargets);
  const partnerTargets = collectTargets(primaryTargets);
  const packageExecution = asRecord(metadata.packageExecution);
  const scopeMatrix = asList<AnyRecord>(packageExecution.anchorScopeMatrix);
  const packageLevels = asList<AnyRecord>(packageExecution.packageLevels);
  const executionSteps = asList<AnyRecord>(packageExecution.executionSteps);
  const currentCoverage = asRecord(metadata.currentCoverage);
  const commercialChecklists = asRecord(metadata.commercialTermsChecklists);
  const sourcePlan = asRecord(metadata.sourceDerivedPlan);
  const coverageTargets = asRecord(sourcePlan.commissionableCoverage);
  const economics = asRecord(sourcePlan.planningEconomicsExample);
  const spaceExample = asRecord(sourcePlan.mechanicalSpaceExample);
  const sourceFiles = asList<AnyRecord>(metadata.sourceFilesUsed);
  const excludedFiles = asList<AnyRecord>(metadata.sourceFilesExcluded);
  const requiredNextInputs = asList<string>(metadata.requiredNextInputs);
  const screeningTemplate = asRecord(metadata.destinationScreeningTemplate);
  const quoteTemplate = asRecord(metadata.firstPackageQuoteTemplate);
  const handoffTemplate = asRecord(metadata.builderHandoffTemplate);
  const ownershipTemplate = asRecord(metadata.ownershipActivationTemplate);
  const boundaries = asList<string>(metadata.boundaries);

  const scopeConfirmed = scopeMatrix.filter((item) =>
    ["confirmed", "included", "covered"].includes(String(item.status || "").toLowerCase())
  ).length;
  const propertyAssigned = Boolean(
    [home.address1, home.city, home.stateCode, home.zipCode].filter(Boolean).join("")
  );

  return (
    <div
      data-testid="property-blessings-launch-workspace"
      className="min-h-screen bg-background text-foreground"
    >
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-[1540px] px-4 py-6 sm:px-6 lg:py-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-300">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  Private Property Blessings operations
                </span>
                <Pill status={String(project.status || "planning")} />
                <Pill
                  status={propertyAssigned ? "known" : "needs_review"}
                  label={propertyAssigned ? "Property assigned" : "Property not assigned"}
                />
              </div>
              <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-orange-400">
                Property Blessings LLC · Master package HomeID
              </p>
              <h1 className="mt-2 max-w-5xl text-3xl font-black tracking-[-0.055em] sm:text-4xl lg:text-5xl">
                {String(home.nickname || project.title || "Full-Size Steel Home Package")}
              </h1>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-muted-foreground sm:text-base">
                {String(
                  project.description ||
                    "Launch control for the first coordinated, location-ready full-size steel-home package."
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 xl:max-w-[470px] xl:justify-end">
              <Button
                variant="outline"
                className={SECONDARY}
                onClick={() => (window.location.href = passportUrl())}
              >
                <Home className="mr-2 h-4 w-4" />
                Open full property passport
              </Button>
              <Button
                className={PRIMARY}
                onClick={() => (window.location.href = passportUrl("requests"))}
              >
                Open saved scope request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              { value: String(launchTasks.length || 17), label: "Launch tasks" },
              {
                value: `${scopeConfirmed}/${scopeMatrix.length || 18}`,
                label: "Scope lines",
              },
              { value: String(packageLevels.length || 3), label: "Package levels" },
              { value: String(partnerTargets.length || 22), label: "Private targets" },
              {
                value: String(evidence.length + documents.length),
                label: "Source records",
              },
              {
                value: String(requiredNextInputs.length || 12),
                label: "Release decisions",
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-card/70 p-4">
                <p className="text-2xl font-black tracking-[-0.04em]">{stat.value}</p>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1540px] gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-10 flex-none rounded-full px-4 text-xs font-black transition ${
                tab === item.id
                  ? "bg-orange-500 text-black"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-[1540px] px-4 py-5 pb-24 sm:px-6 lg:py-7">
        {tab === "control" ? (
          <ControlTab
            launchBoard={launchBoard}
            launchTasks={launchTasks}
            executionSteps={executionSteps}
            currentCoverage={currentCoverage}
            scopeConfirmed={scopeConfirmed}
            scopeTotal={scopeMatrix.length || 18}
          />
        ) : tab === "scope" ? (
          <ScopeTab scopeMatrix={scopeMatrix} checklists={commercialChecklists} />
        ) : tab === "packages" ? (
          <PackagesTab
            packageLevels={packageLevels}
            components={components}
            quoteTemplate={quoteTemplate}
            handoffTemplate={handoffTemplate}
            ownershipTemplate={ownershipTemplate}
          />
        ) : tab === "partners" ? (
          <PartnersTab targets={partnerTargets} pipeline={partnerPipeline} />
        ) : tab === "evidence" ? (
          <EvidenceTab
            evidence={evidence}
            sourceFiles={sourceFiles}
            excludedFiles={excludedFiles}
            facts={facts}
            records={records}
            economics={economics}
            coverage={coverageTargets}
            spaceExample={spaceExample}
          />
        ) : (
          <ReleaseTab
            required={requiredNextInputs}
            screening={screeningTemplate}
            boundaries={boundaries}
            packets={requestPackets}
            propertyAssigned={propertyAssigned}
          />
        )}
      </main>
    </div>
  );
}

function ControlTab({
  launchBoard,
  launchTasks,
  executionSteps,
  currentCoverage,
  scopeConfirmed,
  scopeTotal,
}: {
  launchBoard: AnyRecord;
  launchTasks: AnyRecord[];
  executionSteps: AnyRecord[];
  currentCoverage: AnyRecord;
  scopeConfirmed: number;
  scopeTotal: number;
}) {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-orange-500/25 bg-orange-500/5">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(310px,.75fr)] lg:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-orange-300">
                Current launch gate
              </span>
              <Pill status={String(launchBoard.currentGateStatus || "needs_confirmation")} />
            </div>
            <h2 className="mt-4 max-w-4xl text-2xl font-black tracking-[-0.045em] sm:text-3xl">
              {String(
                launchBoard.currentGate || "Anchor metal-building partner written scope matrix"
              )}
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
              {String(
                launchBoard.currentBlocker ||
                  "The structure-and-roofing relationship must be confirmed line by line before outside sourcing, final package pricing, or supplier order release."
              )}
            </p>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-muted-foreground">
              {String(
                launchBoard.productSpine ||
                  "Sell one coordinated, location-ready steel-home package through Property Blessings, then preserve and protect the home through HomeID."
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className={PRIMARY}
                onClick={() => (window.location.href = passportUrl("requests"))}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Open the saved 18-line request
              </Button>
              <Button
                variant="outline"
                className={SECONDARY}
                onClick={() => (window.location.href = "/admin/tradepartners")}
              >
                Open private partner operations
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: `${scopeConfirmed}/${scopeTotal}`, label: "Scope lines confirmed" },
              { value: String(Number(launchBoard.completedCount || 0)), label: "Tasks complete" },
              { value: String(Number(launchBoard.activeCount || 0)), label: "Tasks active" },
              { value: String(Number(launchBoard.blockedCount || 0)), label: "Tasks blocked" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-card/80 p-4">
                <p className="text-2xl font-black tracking-[-0.04em]">{item.value}</p>
                <p className="mt-2 text-[10px] font-black uppercase leading-4 tracking-[0.11em] text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(330px,.75fr)]">
        <Panel eyebrow="First 90 days" title="Launch board">
          <div className="grid gap-3 lg:grid-cols-2">
            {launchTasks.map((task) => (
              <article
                key={`${String(task.order || "")}-${String(task.title || "")}`}
                className="rounded-2xl border border-border bg-background/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-orange-500/10 text-xs font-black text-orange-400">
                    {String(task.order || "–")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-black leading-5">
                        {String(task.title || "Launch task")}
                      </h3>
                      <Pill status={String(task.status || "not_started")} />
                    </div>
                    {task.dependency ? (
                      <p className="mt-2 text-xs leading-5 text-amber-200/70">
                        Depends on: {String(task.dependency)}
                      </p>
                    ) : null}
                    {task.proof ? (
                      <p className="mt-2 text-xs leading-5 text-emerald-300/70">
                        Proof: {String(task.proof)}
                      </p>
                    ) : null}
                    {task.sourceConflict ? (
                      <p className="mt-2 text-xs leading-5 text-sky-300/70">
                        Corrected source order: {String(task.sourceConflict)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel eyebrow="Already represented" title="Current package coverage">
            <div className="space-y-2">
              {Object.entries(currentCoverage).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-400" />
                    <div>
                      <p className="text-sm font-black">{human(key)}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{String(value)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Covered means a relationship or operating lane exists. It does not mean the exact
              product, quantity, delivery, price, warranty, or property scope is confirmed.
            </p>
          </Panel>

          <Panel eyebrow="Order of work" title="Package execution sequence">
            <div className="space-y-3">
              {executionSteps.map((step, index) => (
                <article
                  key={String(step.id || step.label || index)}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-3.5"
                >
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-orange-500/10 text-[10px] font-black text-orange-400">
                    {String(step.order || index + 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black leading-5">
                      {String(step.label || "Execution step")}
                    </p>
                    <div className="mt-2">
                      <Pill status={String(step.status || "not_started")} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ScopeTab({ scopeMatrix, checklists }: { scopeMatrix: AnyRecord[]; checklists: AnyRecord }) {
  return (
    <div className="space-y-5">
      <Panel
        eyebrow="Current release blocker"
        title="18-line anchor metal-building scope matrix"
        action={<Pill status="needs_confirmation" label="Written confirmation required" />}
      >
        <p className="max-w-5xl text-sm leading-7 text-muted-foreground">
          Each line must be marked included, optional, excluded, locally sourced, or unresolved.
          Pricing, engineering, freight, erection support, damage responsibility, warranty, and
          Property Blessings economics must be attached before duplicate sourcing is removed.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scopeMatrix.map((item, index) => (
            <article
              key={String(item.key || item.label || index)}
              className="rounded-2xl border border-border bg-background/40 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-orange-500/10 text-[10px] font-black text-orange-400">
                  {index + 1}
                </span>
                <Pill status={String(item.status || "unconfirmed")} />
              </div>
              <p className="mt-4 text-sm font-black leading-5">
                {String(item.label || human(item.key))}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            className={PRIMARY}
            onClick={() => (window.location.href = passportUrl("requests"))}
          >
            Open saved scope request
          </Button>
          <Button
            variant="outline"
            className={SECONDARY}
            onClick={() => (window.location.href = passportUrl("documents"))}
          >
            Upload supplier documents
          </Button>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        {Object.entries(checklists).map(([key, raw]) => {
          const checklist = asRecord(raw);
          const fields = asList<string>(checklist.requiredFields);
          return (
            <Panel
              key={key}
              eyebrow="Commercial terms"
              title={human(key)}
              action={<Pill status={String(checklist.relationshipStatus || "needs_confirmation")} />}
            >
              <ol className="space-y-2">
                {fields.map((field, index) => (
                  <li
                    key={field}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5"
                  >
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-muted text-[10px] font-black text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="text-xs leading-5 text-muted-foreground">{field}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function PackagesTab({
  packageLevels,
  components,
  quoteTemplate,
  handoffTemplate,
  ownershipTemplate,
}: {
  packageLevels: AnyRecord[];
  components: AnyRecord[];
  quoteTemplate: AnyRecord;
  handoffTemplate: AnyRecord;
  ownershipTemplate: AnyRecord;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        {packageLevels.map((level, index) => (
          <Panel
            key={String(level.id || level.label || index)}
            eyebrow={`Package ${index + 1}`}
            title={String(level.label || "Package level")}
            action={<Pill status={String(level.status || "source_defined_not_priced")} />}
          >
            <div className="space-y-2">
              {asList<string>(level.includes).map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5"
                >
                  <Check className="mt-0.5 h-4 w-4 flex-none text-orange-400" />
                  <span className="text-sm leading-5 text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-amber-200/70">
              Source-defined structure only. No Property Blessings customer price or supplier order
              is approved yet.
            </p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(350px,.95fr)]">
        <Panel eyebrow="Package systems" title={`${components.length} component lanes tracked`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {components.map((component) => (
              <article
                key={String(component.id || component.type || component.label)}
                className="rounded-2xl border border-border bg-background/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <PackageCheck className="h-4 w-4 flex-none text-orange-400" />
                  <Pill status={String(component.status || "unknown")} />
                </div>
                <p className="mt-3 text-sm font-black leading-5">
                  {String(component.label || human(component.type))}
                </p>
              </article>
            ))}
          </div>
          <Button
            variant="outline"
            className={`mt-5 ${SECONDARY}`}
            onClick={() => (window.location.href = passportUrl("systems"))}
          >
            Open full systems record
          </Button>
        </Panel>

        <div className="space-y-5">
          <TemplatePanel
            eyebrow="Quote control"
            title="First package quote template"
            status={String(quoteTemplate.status || "template_ready_not_priced")}
            items={asList<string>(quoteTemplate.requiredSections)}
            note={String(quoteTemplate.pricingBoundary || "")}
          />
          <TemplatePanel
            eyebrow="Formal handoff"
            title="Builder Handoff Pack"
            status={String(handoffTemplate.status || "template_ready_no_handoff")}
            items={asList<string>(handoffTemplate.requiredItems)}
          />
          <TemplatePanel
            eyebrow="After occupancy"
            title="Ownership protection activation"
            status={String(ownershipTemplate.status || "template_ready_not_active")}
            items={asList<string>(ownershipTemplate.activationRequirements)}
          />
        </div>
      </div>
    </div>
  );
}

function TemplatePanel({
  eyebrow,
  title,
  status,
  items,
  note,
}: {
  eyebrow: string;
  title: string;
  status: string;
  items: string[];
  note?: string;
}) {
  return (
    <Panel eyebrow={eyebrow} title={title} action={<Pill status={status} />}>
      {note ? <p className="mb-4 text-xs leading-5 text-amber-200/70">{note}</p> : null}
      <div className="space-y-2">
        {items.slice(0, 8).map((item) => (
          <div key={item} className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
            <span className="text-xs leading-5 text-muted-foreground">{item}</span>
          </div>
        ))}
        {items.length > 8 ? (
          <p className="pt-2 text-xs font-black text-orange-400">+ {items.length - 8} more required items</p>
        ) : null}
      </div>
    </Panel>
  );
}

function PartnersTab({ targets, pipeline }: { targets: TargetRow[]; pipeline: AnyRecord }) {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-5 lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill status={String(pipeline.queueStatus || "source_review")} />
              <span className="rounded-full border border-amber-500/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">
                No signed partner claim
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.04em]">
              Private source-review pipeline
            </h2>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-muted-foreground">
              {String(
                pipeline.contactRule ||
                  "Every target remains unconfirmed. Source review may continue, but no customer traffic or duplicate-prone commercial outreach starts until the anchor scope is confirmed."
              )}
            </p>
          </div>
          <Button
            className={PRIMARY}
            onClick={() => (window.location.href = "/admin/tradepartners")}
          >
            Open partner operations
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-3xl">
          {[
            { value: String(Number(pipeline.urgentCount || 0)), label: "Urgent" },
            { value: String(Number(pipeline.highCount || 0)), label: "High" },
            { value: String(Number(pipeline.normalCount || 0)), label: "Normal" },
            { value: String(Number(pipeline.lowCount || 0)), label: "Conditional" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-card/70 p-4">
              <p className="text-2xl font-black">{item.value}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <Panel eyebrow="22 source targets" title="Package lanes and backup paths">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((target) => (
              <article
                key={target.slug}
                className="rounded-2xl border border-border bg-background/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-black leading-5">{targetName(target.slug)}</h3>
                  <Pill
                    status={target.role === "Primary" ? "source_review" : "unknown"}
                    label={target.role}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {human(target.lane)}
                </p>
              </article>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel eyebrow="Anchor gate" title="Existing structure and roofing relationship">
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
              <p className="text-sm font-black">Written scope confirmation</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Structure and roofing are relationship-covered. Detailed inclusions, exclusions,
                engineering, freight, support, warranties, and economics remain unconfirmed.
              </p>
            </div>
            <Button
              className={`mt-5 w-full ${PRIMARY}`}
              onClick={() => (window.location.href = passportUrl("requests"))}
            >
              Open anchor scope request
            </Button>
          </Panel>

          <Panel eyebrow="Selection rule" title="What wins a package lane">
            {[
              "Customer price and measurable advantage",
              "Protected project registration",
              "Code and product documentation",
              "Reliable delivery and damage handling",
              "Clear warranty and service path",
              "Local qualified installation support",
              "Written margin, commission, rebate, or renewal terms",
              "No pay-per-lead requirement",
            ].map((item) => (
              <div key={item} className="mb-3 flex items-start gap-3 last:mb-0">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-emerald-400" />
                <span className="text-sm leading-5 text-muted-foreground">{item}</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function EvidenceTab({
  evidence,
  sourceFiles,
  excludedFiles,
  facts,
  records,
  economics,
  coverage,
  spaceExample,
}: {
  evidence: AnyRecord[];
  sourceFiles: AnyRecord[];
  excludedFiles: AnyRecord[];
  facts: AnyRecord[];
  records: AnyRecord[];
  economics: AnyRecord;
  coverage: AnyRecord;
  spaceExample: AnyRecord;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            value: `${Number(coverage.launchMinimumPercent || 75)}%`,
            label: "Launch coverage target",
          },
          {
            value: `>${Number(coverage.operatingTargetAbovePercent || 90)}%`,
            label: "Operating coverage target",
          },
          {
            value: money(economics.upfrontPackageRevenue || 13600),
            label: "Source revenue example",
          },
          {
            value: `${Number(spaceExample.recoveredSquareFeet || 17)} sq ft`,
            label: "Source space example",
          },
        ].map((item) => (
          <div key={item.label} className={`${PANEL} p-5`}>
            <p className="text-3xl font-black tracking-[-0.04em]">{item.value}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.11em] text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
        <Panel
          eyebrow="Relevant uploaded files"
          title={`${sourceFiles.length || evidence.length} source records used`}
          action={<Pill status="verified" label="Structured into HomeID" />}
        >
          <div className="space-y-3">
            {evidence.map((item) => (
              <article
                key={String(item.id || item.title)}
                className="rounded-2xl border border-border bg-background/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-black leading-5">
                    {String(item.title || "Source record")}
                  </h3>
                  <Pill status={String(item.status || "needs_review")} />
                </div>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">
                  {String(item.description || "Source-backed planning evidence.")}
                </p>
                {!item.fileUrl ? (
                  <span className="mt-3 inline-flex rounded-full border border-border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
                    Reference only — original file not stored as a downloadable attachment
                  </span>
                ) : null}
              </article>
            ))}
          </div>
          <Button
            variant="outline"
            className={`mt-5 ${SECONDARY}`}
            onClick={() => (window.location.href = passportUrl("documents"))}
          >
            Open full document record
          </Button>
        </Panel>

        <div className="space-y-5">
          <Panel eyebrow="Extraction proof" title="What the files contributed">
            {[
              `${facts.length} planning facts`,
              `${records.length} visible timeline events`,
              "Three housing platforms",
              "Three customer paths",
              "Three package levels",
              "Eight-step customer journey",
              "Seventeen first-90-day launch tasks",
              "Fifteen corrected package gaps",
              "Seven-phase HomeScout path",
            ].map((item) => (
              <div key={item} className="mb-3 flex items-start gap-3 last:mb-0">
                <Database className="mt-0.5 h-4 w-4 flex-none text-orange-400" />
                <span className="text-sm leading-5 text-muted-foreground">{item}</span>
              </div>
            ))}
          </Panel>

          <Panel eyebrow="Deliberately excluded" title="Files that are not home facts">
            <div className="space-y-3">
              {excludedFiles.map((item) => (
                <article
                  key={String(item.title)}
                  className="rounded-xl border border-border bg-background/40 p-3"
                >
                  <p className="text-sm font-black">{String(item.title)}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {String(item.reason)}
                  </p>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ReleaseTab({
  required,
  screening,
  boundaries,
  packets,
  propertyAssigned,
}: {
  required: string[];
  screening: AnyRecord;
  boundaries: string[];
  packets: AnyRecord[];
  propertyAssigned: boolean;
}) {
  const screeningSections = asList<string>(screening.sections);
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-5 lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill status="needs_info" label={`${required.length} decisions remain`} />
              <Pill
                status={propertyAssigned ? "known" : "needs_review"}
                label={propertyAssigned ? "Property assigned" : "Property not assigned"}
              />
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.04em]">
              No package release until the real property and written supplier scopes agree
            </h2>
            <p className="mt-3 max-w-5xl text-sm leading-7 text-muted-foreground">
              The master HomeID can organize the package now. A customer-specific HomeID is created
              only after a real parcel, jurisdiction, classification, funding path, responsible
              professionals, supplier scopes, and package selections are known.
            </p>
          </div>
          <Button
            className={PRIMARY}
            onClick={() => (window.location.href = passportUrl("property"))}
          >
            <MapPin className="mr-2 h-4 w-4" />
            Assign the first property
          </Button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(350px,.9fr)]">
        <Panel eyebrow="Ordered release work" title="Required inputs and decisions">
          <ol className="grid gap-3 lg:grid-cols-2">
            {required.map((item, index) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-4"
              >
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-orange-500/10 text-xs font-black text-orange-400">
                  {index + 1}
                </span>
                <span className="text-sm leading-6 text-muted-foreground">{item}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-5">
          <Panel
            eyebrow="Destination screening"
            title="Property-specific compliance record"
            action={<Pill status={String(screening.status || "property_not_assigned")} />}
          >
            <div className="space-y-2">
              {screeningSections.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 flex-none text-orange-400" />
                  <span className="text-xs leading-5 text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/70">
              {String(
                screening.releaseBoundary ||
                  "Final release requires the applicable professionals and authorities for the exact property and classification."
              )}
            </p>
          </Panel>

          <Panel eyebrow="Readiness packet" title={`${packets.length} saved planning request`}>
            {packets.length ? (
              packets.map((packet, index) => (
                <div
                  key={String(packet.id || index)}
                  className="rounded-2xl border border-border bg-background/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black">
                      {human(packet.requestType || "documentation")}
                    </p>
                    <Pill status={String(packet.status || "needs_info")} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {Number(packet.missingHelpfulInfoCount || 0)} supporting inputs remain.
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">No readiness packet is stored.</p>
            )}
            <Button
              variant="outline"
              className={`mt-5 w-full ${SECONDARY}`}
              onClick={() => (window.location.href = passportUrl("requests"))}
            >
              Open request packets
            </Button>
          </Panel>
        </div>
      </div>

      <Panel eyebrow="Truth boundaries" title="What this master HomeID does not claim">
        <div className="grid gap-3 lg:grid-cols-2">
          {boundaries.map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-4"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-amber-400" />
              <p className="text-sm leading-6 text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            className={PRIMARY}
            onClick={() => (window.location.href = `/homes/build?homeId=${HOME_ID}`)}
          >
            <HardHat className="mr-2 h-4 w-4" />
            Open Build Timeline
          </Button>
          <Button
            variant="outline"
            className={SECONDARY}
            onClick={() => (window.location.href = passportUrl("timeline"))}
          >
            Open full HomeID timeline
          </Button>
        </div>
      </Panel>
    </div>
  );
}
