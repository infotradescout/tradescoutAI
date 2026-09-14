import React, { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import HomeIdentityEditor from "./HomeIdentityEditor";
import { Panel, Pill, Empty } from "./HomeIdWorkspace";
import { PACKAGE_HOME_ID, homeAddress, homeName, humanLabel, object, type HomeSection, type HomeSummary } from "./homeWorkspaceModel";
import { rows, readRecordDetail, readRecordPersistence, buildTimelineHref, documentDownloadHref, safeEvidenceHref, type HomeDocument, type HomeProject, type HomeRecord, type RecordPersistence } from "./homeRecordViewModel";
import { PACKAGE_PROJECT_ID, LAUNCH_TABS, launchTab, launchWorkspaceModel, listCount, savedCount, taskStatusCount, scopeConfirmation, recordedNumber, type LaunchModel, type LaunchTab, type SavedFields, type PartnerTarget } from "./launchWorkspaceModel";
import "./HomeRecordWorkspace.css";

const HOME_ID = PACKAGE_HOME_ID;
const PROJECT_ID = PACKAGE_PROJECT_ID;
const text = (value: unknown, fallback = "Not recorded") => typeof value === "string" && value.trim() ? value.trim() : fallback;
const human = (value: unknown) => humanLabel(typeof value === "string" ? value.replace(/^pb-target-/, "") : null);
function passportUrl(tab?: HomeSection): string {
  const params = new URLSearchParams({ homeId: HOME_ID, mode: "passport" });
  if (tab) params.set("tab", tab);
  return `/homes?${params}`;
}
function launchHref(tab: LaunchTab) { return `/homes?${new URLSearchParams({ homeId: HOME_ID, workspace: "launch", launchTab: tab })}`; }
function without(value: SavedFields, excluded: string[]) { return Object.fromEntries(Object.entries(value).filter(([key]) => !excluded.includes(key))); }

/** Nested saved data stays readable and complete; templates do not stop after eight items. */
export function Fields({ value, empty = "No details recorded.", depth = 0 }: { value: unknown; empty?: string; depth?: number }) {
  if (value === undefined || value === null || value === "") return <p className="hr-muted">{empty}</p>;
  if (typeof value === "string") return <p className="hr-prewrap">{value}</p>;
  if (typeof value === "number" || typeof value === "boolean") return <p>{typeof value === "boolean" ? value ? "Yes" : "No" : String(value)}</p>;
  if (depth > 6) return <details className="hr-details"><summary>Additional saved details</summary><pre className="hr-prewrap">{JSON.stringify(value, null, 2)}</pre></details>;
  if (Array.isArray(value)) return value.length ? <ul className="hr-list">{value.map((item, index) => <li key={index}><Fields value={item} depth={depth + 1} /></li>)}</ul> : <p className="hr-muted">{empty}</p>;
  const entries = Object.entries(object(value));
  return entries.length ? <dl className="hr-saved-fields">{entries.map(([key, item]) => <div key={key}><dt>{human(key)}</dt><dd>{key === "status" && typeof item === "string" ? <Pill status={item} /> : <Fields value={item} depth={depth + 1} />}</dd></div>)}</dl> : <p className="hr-muted">{empty}</p>;
}
function Collection({ items, empty, children }: { items: SavedFields[] | null; empty: string; children: (item: SavedFields, index: number) => ReactNode }) {
  if (items === null) return <p className="hr-muted">{empty} have not been recorded.</p>;
  return items.length ? <div className="hr-two-columns">{items.map((item, index) => <React.Fragment key={text(item.id, String(index))}>{children(item, index)}</React.Fragment>)}</div> : <p className="hr-muted">No {empty.toLowerCase()} are saved.</p>;
}
function SavedCard({ item, index, fallback }: { item: SavedFields; index: number; fallback: string }) {
  return <article className="hr-item"><div className="hr-item-heading"><h3>{text(item.title, text(item.label, item.key ? human(item.key) : `${fallback} ${index + 1}`))}</h3><Pill status={typeof item.status === "string" ? item.status : null} /></div><Fields value={without(item, ["id", "key", "title", "label", "status"])} empty="No further details recorded." /></article>;
}
function Stats({ items }: { items: Array<[string, string]> }) {
  return <div className="hr-summary-grid">{items.map(([label, value]) => <div className="hr-summary" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}
function LinkAction({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return <Link className={`hr-button${primary ? " hr-primary" : ""}`} href={href}>{children}</Link>;
}

export default function PropertyBlessingsLaunchWorkspace() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const search = useSearch();
  const tab = launchTab(search);
  const detailQuery = useQuery({ queryKey: [`/api/homes/${HOME_ID}`, "launch", user?.id], enabled: isAuthenticated,
    queryFn: async () => readRecordDetail(await apiRequest("GET", `/api/homes/${HOME_ID}`), HOME_ID) });
  const permitted = isAuthenticated && detailQuery.isSuccess && !detailQuery.isError;
  const persistenceQuery = useQuery({ queryKey: [`/api/homeid/${HOME_ID}/persistence`, "launch", user?.id], enabled: permitted,
    queryFn: async () => readRecordPersistence(await apiRequest("GET", `/api/homeid/${HOME_ID}/persistence`)) });
  const projectsQuery = useQuery({ queryKey: [`/api/homes/${HOME_ID}/projects`, "launch", user?.id], enabled: permitted,
    queryFn: async () => {
      const projects = rows<HomeProject>(await apiRequest("GET", `/api/homes/${HOME_ID}/projects`), "projects");
      // Never substitute an unrelated first project for this explicitly selected package workspace.
      const project = projects.find((item) => item.id === PROJECT_ID) || null;
      return { project, model: project ? launchWorkspaceModel(project) : null };
    } });
  if (isLoading) return <p role="status">Loading package planning…</p>;
  if (!isAuthenticated || !user?.id) return <section className="ts-home-record"><h1>Private package planning</h1><LinkAction href={`/login?next=${encodeURIComponent(launchHref(tab))}`}>Sign in</LinkAction></section>;
  const queries = [detailQuery, persistenceQuery, projectsQuery];
  if (queries.some((query) => query.isError)) return <section className="ts-home-record"><div className="hr-error" role="alert"><h1>Package planning could not be loaded</h1><p>No saved records have been changed.</p><button className="hr-button" type="button" onClick={() => void Promise.all(queries.map((query) => query.refetch()))}>Retry package planning</button></div><LinkAction href={passportUrl()}>Open full property passport</LinkAction></section>;
  if (queries.some((query) => query.isPending) || !detailQuery.data || !persistenceQuery.data) return <p role="status" className="ts-home-record">Loading package planning…</p>;
  const project = projectsQuery.data?.project;
  const model = projectsQuery.data?.model;
  if (!project || !model) return <section className="ts-home-record"><Empty title="The package planning project is not attached to this property" text="No other project has been substituted." action={<LinkAction href={passportUrl("build")}>Open property projects</LinkAction>} /></section>;
  return <LaunchContent home={detailQuery.data.home} project={project} model={model} persistence={persistenceQuery.data}
    documents={detailQuery.data.documents} records={detailQuery.data.records.filter((item) => !item.title?.startsWith("homeid:"))} viewerId={user.id} tab={tab} />;
}

export function LaunchContent({ home, project, model, persistence, documents, records, viewerId, tab }: {
  home: HomeSummary; project: HomeProject; model: LaunchModel; persistence: RecordPersistence;
  documents: HomeDocument[]; records: HomeRecord[]; viewerId: string; tab: LaunchTab;
}) {
  return <div className="ts-home-record" data-testid="property-blessings-launch-workspace">
    <header className="hr-heading"><div><p className="hr-eyebrow">Private Property Blessings package planning</p><h1>{homeName(home)}</h1><p>{project.description || "Keep package scope, partner research, documents, and handoff requirements together."}</p><p className="hr-muted">{homeAddress(home) || "Location not recorded"}</p><Pill status={project.status} /></div>
      <div className="hr-actions"><HomeIdentityEditor homeId={HOME_ID} viewerId={viewerId} className="hr-button" /><LinkAction href={passportUrl()}>Open full property passport</LinkAction><LinkAction href={passportUrl("requests")} primary>Open saved scope request</LinkAction></div>
    </header>
    <nav className="hr-sections" aria-label="Package planning sections">{LAUNCH_TABS.map((item) => <Link key={item.id} href={launchHref(item.id)} aria-current={tab === item.id ? "page" : undefined}>{item.label}</Link>)}</nav>
    <main className="hr-content hr-stack">
      <Stats items={[["Launch tasks", listCount(model.launchTasks)], ["Scope lines", listCount(model.scopeMatrix)], ["Package levels", listCount(model.packageLevels)], ["Partner entries", listCount(model.partnerTargets)]]} />
      {tab === "control" && <ControlTab model={model} />}
      {tab === "scope" && <ScopeTab model={model} />}
      {tab === "packages" && <PackagesTab model={model} persistence={persistence} />}
      {tab === "partners" && <PartnersTab targets={model.partnerTargets} pipeline={model.partnerPipeline} currentCoverage={model.currentCoverage} />}
      {tab === "evidence" && <EvidenceTab model={model} persistence={persistence} documents={documents} records={records} />}
      {tab === "release" && <ReleaseTab model={model} persistence={persistence} />}
    </main>
  </div>;
}
function ControlTab({ model }: { model: LaunchModel }) {
  return <div className="hr-stack"><Panel title="Current launch gate" action={<Pill status={typeof model.launchBoard.currentGateStatus === "string" ? model.launchBoard.currentGateStatus : null} />}>
    <h3>{text(model.launchBoard.currentGate)}</h3>{model.launchBoard.currentBlocker != null && <p>{text(model.launchBoard.currentBlocker)}</p>}
    <Fields value={without(model.launchBoard, ["tasks", "currentGate", "currentGateStatus", "currentBlocker", "completedCount", "activeCount", "blockedCount"])} />
    <div className="hr-actions"><LinkAction href={passportUrl("requests")}>Open saved scope request</LinkAction><LinkAction href="/admin/tradepartners">Open private partner operations</LinkAction></div>
  </Panel><Stats items={[["Scope lines marked confirmed", scopeConfirmation(model)], ["Tasks marked complete", taskStatusCount(model.launchTasks, ["complete", "completed", "done"])], ["Tasks marked active", taskStatusCount(model.launchTasks, ["active", "in_progress"])], ["Tasks marked blocked", taskStatusCount(model.launchTasks, ["blocked", "blocked_on_written_confirmation"])]]} />
    <Panel title="Launch board"><p className="hr-note">First 90 days: saved task order and status, without assumed completion.</p><Collection items={model.launchTasks} empty="Launch tasks">{(item, index) => <SavedCard item={item} index={index} fallback="Task" />}</Collection></Panel>
    <div className="hr-two-columns"><Panel title="Recorded package coverage"><Fields value={model.currentCoverage} /><p className="hr-note">Recorded coverage is not an approval of specific products, quantities, pricing, or delivery.</p></Panel><Panel title="Package execution sequence"><Collection items={model.executionSteps} empty="Execution steps">{(item, index) => <SavedCard item={item} index={index} fallback="Step" />}</Collection></Panel></div>
  </div>;
}
function ScopeTab({ model }: { model: LaunchModel }) {
  return <div className="hr-stack"><Panel title={model.scopeMatrix === null ? "Anchor metal-building scope matrix" : `${model.scopeMatrix.length}-line anchor metal-building scope matrix`}>
    <p className="hr-note">Review the saved inclusions, options, exclusions, local sourcing, pricing, engineering, freight, support, warranties, and responsibilities.</p>
    <Collection items={model.scopeMatrix} empty="Scope lines">{(item, index) => <SavedCard item={item} index={index} fallback="Scope line" />}</Collection>
    <div className="hr-actions"><LinkAction href={passportUrl("requests")} primary>Open saved scope request</LinkAction><LinkAction href={passportUrl("documents")}>Upload supplier documents</LinkAction></div>
  </Panel><Panel title="Commercial terms checklists"><Fields value={model.commercialChecklists} /></Panel></div>;
}
function PackagesTab({ model, persistence }: { model: LaunchModel; persistence: RecordPersistence }) {
  return <div className="hr-stack"><Panel title="Package levels"><Collection items={model.packageLevels} empty="Package levels">{(item, index) => <SavedCard item={item} index={index} fallback="Package" />}</Collection></Panel>
    <Panel title={`Package systems (${persistence.components.length})`} action={<LinkAction href={passportUrl("systems")}>Open full systems record</LinkAction>}><div className="hr-two-columns">{persistence.components.map((item) => <article className="hr-item" key={item.id}><div className="hr-item-heading"><h3>{item.label}</h3><Pill status={item.status} /></div><p className="hr-muted">{human(item.type)}</p></article>)}</div>{!persistence.components.length && <p className="hr-muted">No package systems have been saved.</p>}</Panel>
    <div className="hr-two-columns"><Panel title="First package quote template"><Fields value={model.quoteTemplate} /></Panel><Panel title="Builder Handoff Pack"><Fields value={model.handoffTemplate} /></Panel><Panel title="Ownership protection activation"><Fields value={model.ownershipTemplate} /></Panel></div>
  </div>;
}
const TARGET_NAMES: Record<string, string> = {
  "pb-target-provia": "ProVia", "pb-target-mrcool": "MRCOOL", "pb-target-gree-select-dealers": "GREE Select Dealer Network", "pb-target-rheem": "Rheem", "pb-target-rinnai": "Rinnai",
  "pb-target-idi-insulation": "Insulation Distributors Inc.", "pb-target-service-partners": "Service Partners", "pb-target-ferguson": "Ferguson", "pb-target-southern-luxe-flooring": "Southern Luxe Flooring",
  "pb-target-town-appliance": "Town Appliance", "pb-target-cafe-appliances": "Café Appliances", "pb-target-graybar": "Graybar", "pb-target-sonepar": "Sonepar", "pb-target-onpoint-warranty": "OnPoint Warranty",
  "pb-target-cinch": "Cinch Home Services", "pb-target-builders-firstsource": "Builders FirstSource", "pb-target-fbm": "Foundation Building Materials", "pb-target-chi-overhead-doors": "C.H.I. Overhead Doors",
  "pb-target-freight-club": "Freight Club", "pb-target-trinity-logistics": "Trinity Logistics", "pb-target-truoba": "Truoba", "pb-target-nexgen-steel": "NexGen Steel",
};
function PartnersTab({ targets, pipeline, currentCoverage }: { targets: PartnerTarget[] | null; pipeline: SavedFields; currentCoverage: SavedFields }) {
  return <div className="hr-stack"><Panel title="Prospective partners" action={<LinkAction href="/admin/tradepartners">Open partner operations</LinkAction>}>
    <Pill status={typeof pipeline.queueStatus === "string" ? pipeline.queueStatus : null} /><p className="hr-note">Private source-review pipeline. No signed partner claim is made by listing a company here; prospective entries remain unconfirmed until separately reviewed.</p>
    {pipeline.contactRule != null && <Fields value={pipeline.contactRule} />}<p className="hr-note">Partner operations retain their existing access and contact controls.</p>
  </Panel><Stats items={[["Saved urgent count", savedCount(pipeline.urgentCount)], ["Saved high count", savedCount(pipeline.highCount)], ["Saved normal count", savedCount(pipeline.normalCount)], ["Saved conditional count", savedCount(pipeline.lowCount)]]} />
    <Panel title="Package categories & backup options">{targets === null ? <p className="hr-muted">Partner targets have not been recorded.</p> : targets.length ? <div className="hr-two-columns">{targets.map((target) => <article className="hr-item" key={`${target.slug}:${target.lane}:${target.role}`}><div className="hr-item-heading"><h3>{TARGET_NAMES[target.slug] || human(target.slug)}</h3><Pill status="unknown" label={target.role} /></div><p>{human(target.lane)}</p></article>)}</div> : <p className="hr-muted">No partner targets are saved.</p>}</Panel>
    <div className="hr-two-columns"><Panel title="Recorded structure & roofing coverage"><Fields value={currentCoverage} /><LinkAction href={passportUrl("requests")}>Open anchor scope request</LinkAction></Panel><Panel title="Partner selection checklist"><ul className="hr-list">{["Customer price and measurable advantage", "Protected project registration", "Code and product documentation", "Reliable delivery and damage handling", "Clear warranty and service path", "Qualified installation support", "Written margin, commission, rebate, or renewal terms", "No pay-per-lead requirement"].map((item) => <li key={item}>{item}</li>)}</ul></Panel></div>
  </div>;
}
function EvidenceTab({ model, persistence, documents, records }: { model: LaunchModel; persistence: RecordPersistence; documents: HomeDocument[]; records: HomeRecord[] }) {
  const operating = recordedNumber(model.coverageTargets.operatingTargetAbovePercent, "percent");
  return <div className="hr-stack"><Panel title="Saved planning examples"><p className="hr-note">Planning examples and targets are not approved customer prices, guaranteed revenue, or confirmed property measurements.</p><Stats items={[["Launch coverage target", recordedNumber(model.coverageTargets.launchMinimumPercent, "percent")], ["Operating coverage target", operating === "Not recorded" ? operating : `>${operating}`], ["Recorded revenue example", recordedNumber(model.economics.upfrontPackageRevenue, "currency")], ["Recorded space example", recordedNumber(model.spaceExample.recoveredSquareFeet, "area")]]} /></Panel>
    <Panel title={`Uploaded property documents (${documents.length})`} action={<LinkAction href={passportUrl("documents")}>Open full document record</LinkAction>}>{documents.length ? <div className="hr-two-columns">{documents.map((item, index) => <article className="hr-item" key={item.id || index}><h3>{item.originalName || "Property document"}</h3>{item.id && <a className="hr-button" target="_blank" rel="noopener noreferrer" href={documentDownloadHref(HOME_ID, item.id)}>Open / download</a>}</article>)}</div> : <p className="hr-muted">No uploaded property documents are saved.</p>}</Panel>
    <Panel title={`References (${persistence.evidence.length})`}><div className="hr-two-columns">{persistence.evidence.map((item) => <article className="hr-item" key={item.id}><div className="hr-item-heading"><h3>{item.title}</h3><Pill status={item.status} /></div>{item.fileName && <p>{item.fileName}</p>}{item.description && <p>{item.description}</p>}{safeEvidenceHref(item.fileUrl) ? <a className="hr-button" href={safeEvidenceHref(item.fileUrl)!} target="_blank" rel="noopener noreferrer">Open file link</a> : <p className="hr-note">Reference only — original file not stored as a downloadable attachment</p>}</article>)}</div>{!persistence.evidence.length && <p className="hr-muted">No references have been saved.</p>}</Panel>
    <div className="hr-two-columns"><Panel title="Source records used"><Collection items={model.sourceFiles} empty="Source records">{(item, index) => <SavedCard item={item} index={index} fallback="Source record" />}</Collection></Panel><Panel title="Files excluded from the property record"><Collection items={model.excludedFiles} empty="Excluded files">{(item, index) => <SavedCard item={item} index={index} fallback="Excluded file" />}</Collection></Panel>
      <Panel title="Saved property information"><p>{persistence.propertyDetails.length} property details · {records.length} history entries</p><div className="hr-actions"><LinkAction href={passportUrl("property")}>Open property details</LinkAction><LinkAction href={passportUrl("timeline")}>Open full HomeID timeline</LinkAction></div></Panel>
      <Panel title="Planning example details"><Fields value={model.sourcePlan} /></Panel></div>
  </div>;
}
function ReleaseTab({ model, persistence }: { model: LaunchModel; persistence: RecordPersistence }) {
  return <div className="hr-stack"><Panel title="Inputs & decisions to review" action={<LinkAction href={passportUrl("property")}>Review property details</LinkAction>}><Fields value={model.requiredNextInputs} empty="No open decisions are listed." /><p className="hr-note">A blank list does not establish release approval. Review the property, supplier scope, selections, and responsible parties.</p></Panel>
    <div className="hr-two-columns"><Panel title="Destination screening"><Fields value={model.screeningTemplate} /></Panel><Panel title={`Saved planning requests (${persistence.requestPackets.length})`} action={<LinkAction href={passportUrl("requests")}>Open request packets</LinkAction>}>{persistence.requestPackets.length ? <div className="hr-stack">{persistence.requestPackets.map((packet) => <article className="hr-item" key={packet.id}><div className="hr-item-heading"><h3>{human(packet.requestType)}</h3><Pill status={packet.status} /></div><p>{savedCount(packet.missingHelpfulInfoCount)} listed open inputs</p><Fields value={packet.missingHelpfulInfo} /></article>)}</div> : <p className="hr-muted">No planning requests have been saved.</p>}</Panel></div>
    <Panel title="Recorded project boundaries"><Fields value={model.boundaries} /><div className="hr-actions"><LinkAction href={buildTimelineHref(HOME_ID, PROJECT_ID)} primary>Open Build Timeline</LinkAction><LinkAction href={passportUrl("timeline")}>Open full HomeID timeline</LinkAction></div></Panel>
  </div>;
}
