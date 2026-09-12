import React, { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowUpRight, CalendarClock, FileText, FolderOpen, Home, LockKeyhole, Wrench } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { homeOverviewQueryKeys } from "./homeOverviewQueryKeys";
import HomeIdentityEditor from "./HomeIdentityEditor";
import {
  HOME_SECTIONS, PACKAGE_HOME_ID, collection, readHomeDetail, readPersistence,
  dateLabel, dueMaintenance, homeAddress, homeHref, homeName, humanLabel, recentRecords,
  type HomeSummary, type SavedProject, type SavedSchedule,
} from "./homeWorkspaceModel";

type Props = { viewerId: string; homeId: string | null; homes: HomeSummary[]; homesPending: boolean;
  homesError: boolean; retryHomes: () => void; selectHome: (id: string) => void };

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className="home-panel"><div className="home-panel-heading"><h2>{title}</h2>{action}</div>{children}</section>;
}
function Problem({ children, retry }: { children: ReactNode; retry: () => void }) {
  return <div className="home-problem" role="alert"><p>{children}</p><button type="button" className="home-text-action" onClick={retry}>Retry</button></div>;
}
function ReadState({ pending, error, retry, children, label }: {
  pending: boolean; error: boolean; retry: () => void; children: ReactNode; label: string;
}) {
  if (error) return <Problem retry={retry}>{label} could not be loaded. Saved information has not been changed.</Problem>;
  if (pending) return <p role="status" className="home-empty">Loading {label.toLowerCase()}…</p>;
  return <>{children}</>;
}

export default function HomeOverview({ viewerId, homeId, homes, homesPending, homesError, retryHomes, selectHome }: Props) {
  const encoded = encodeURIComponent(homeId || "");
  const keys = homeOverviewQueryKeys(homeId || "_none", viewerId);
  const detail = useQuery({
    queryKey: keys.detail, enabled: Boolean(homeId),
    queryFn: async () => readHomeDetail(await apiRequest("GET", `/api/homes/${encoded}`), homeId!),
  });
  // Do not load dependent records until the selected property's authorized response resolves.
  const permitted = Boolean(homeId && detail.isSuccess && !detail.isError);
  const projects = useQuery({
    queryKey: keys.projects, enabled: permitted,
    queryFn: async () => collection<SavedProject>(await apiRequest("GET", `/api/homes/${encoded}/projects`), "projects"),
  });
  const schedules = useQuery({
    queryKey: keys.schedules, enabled: permitted,
    queryFn: async () => collection<SavedSchedule>(await apiRequest("GET", `/api/homes/${encoded}/maintenance-schedules`), "schedules"),
  });
  const persistence = useQuery({
    queryKey: keys.persistence, enabled: permitted,
    queryFn: async () => readPersistence(await apiRequest("GET", `/api/homeid/${encoded}/persistence`)),
  });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, []);

  const home = detail.data?.home;
  const due = dueMaintenance(schedules.data || [], now);
  const review = (persistence.data?.propertyDetails || []).filter((item) => item.status === "needs_review");
  const history = recentRecords(detail.data?.records || []);
  const manageHref = `/homes?${new URLSearchParams({ ...(homeId ? { homeId } : {}), workspace: "record" })}`;
  const open = (section: Parameters<typeof homeHref>[1], label: string) => <Link className="home-text-action" href={homeHref(homeId, section)}>{label}<ArrowUpRight size={15} aria-hidden="true" /></Link>;

  return (
    <div className="ts-home-overview" data-testid="homeid-overview">
      <div className="home-workspace-bar">
        <span className="home-workspace-name"><Home size={20} aria-hidden="true" />HomeID</span>
        <div className="home-workspace-controls">
          {homes.length > 1 && <label className="home-picker"><span className="sr-only">Choose property</span><select value={homeId || ""} onChange={(event) => selectHome(event.target.value)}>
            {!homes.some((item) => item.id === homeId) && homeId && <option value={homeId}>{homeName(home)}</option>}
            {homes.map((item) => <option key={item.id} value={item.id}>{homeName(item)}</option>)}
          </select></label>}
          <Link className="home-text-action" href={manageHref}>Manage homes</Link>
        </div>
      </div>
      {homesError && <Problem retry={retryHomes}>Your property list could not be loaded.</Problem>}
      {!homeId ? (
        homesPending ? <p role="status">Loading your properties…</p> : homesError ? null :
        <section className="home-panel home-welcome"><h1>Your property, organized.</h1><p>Keep projects, documents, systems, and maintenance with the property they belong to.</p><Link className="home-action" href={manageHref}>Create a property record</Link></section>
      ) : detail.isError ? (
        <Problem retry={() => void detail.refetch()}>This property could not be opened. It may be unavailable or your access may have changed.</Problem>
      ) : !home ? (
        <div className="home-loading" role="status"><span className="home-skeleton" /><p>Loading the selected property…</p></div>
      ) : (
        <>
          <header className="home-heading">
            <div><p className="home-eyebrow"><LockKeyhole size={14} aria-hidden="true" />Private property workspace</p><h1>{homeName(home)}</h1><p className="home-address">{homeAddress(home) || "Address not added"}</p>
              <p className="home-property-kind">{humanLabel(home.propertyType)}{home.yearBuilt ? ` · Built ${home.yearBuilt}` : ""}</p>
            </div>
            <div className="home-primary-actions"><Link className="home-action" href={homeHref(homeId, "requests")}>Prepare a work request</Link><Link className="home-action home-action-secondary" href={homeHref(homeId, "documents")}>Add a document</Link></div>
          </header>
          <nav className="home-sections" aria-label="Property workspace sections">
            {HOME_SECTIONS.map((section) => <Link key={section.id} href={homeHref(homeId, section.id)} aria-current={section.id === "overview" ? "page" : undefined}>{section.label}</Link>)}
          </nav>
          <div className="home-overview-grid">
            <div className="home-main-column">
              <Section title="What needs attention" action={open("maintenance", "Maintenance")}>
                <div className="home-attention-list">
                  {!homeAddress(home) && <div className="home-attention-item"><Home size={19} aria-hidden="true" /><span><HomeIdentityEditor homeId={homeId} viewerId={viewerId} triggerLabel="Add property address" /><small>Save the address, state, and county or parish on the property itself.</small></span></div>}
                  <ReadState pending={schedules.isPending} error={schedules.isError} retry={() => void schedules.refetch()} label="Maintenance">
                    {due.slice(0, 3).map((item, index) => <Link className="home-attention-item" href={homeHref(homeId, "maintenance")} key={item.id || index}><CalendarClock size={19} aria-hidden="true" /><span><strong>{item.title || "Scheduled maintenance"}</strong><small>Due {dateLabel(item.nextDueAt)}</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>)}
                    {!due.length && <p className="home-empty">No dated maintenance is due in the saved schedule.</p>}
                  </ReadState>
                  <ReadState pending={persistence.isPending} error={persistence.isError} retry={() => void persistence.refetch()} label="Property details">
                    {review.length > 0 && <Link className="home-attention-item" href={homeHref(homeId, "property")}><FileText size={19} aria-hidden="true" /><span><strong>{review.length} saved {review.length === 1 ? "detail needs" : "details need"} review</strong><small>Review the information before including it in a request.</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>}
                  </ReadState>
                </div>
                <p className="home-footnote">Based on saved records, not a property inspection or readiness rating.</p>
              </Section>
              <Section title="Projects & work" action={open("build", "Open projects")}>
                <ReadState pending={projects.isPending} error={projects.isError} retry={() => void projects.refetch()} label="Projects">
                  {projects.data?.length ? <div className="home-record-list">{projects.data.map((project) => <Link className="home-project" key={project.id} href={homeHref(homeId, "build", project.id)}>
                    <div className="home-project-title"><FolderOpen size={20} aria-hidden="true" /><strong>{project.title || "Untitled project"}</strong><ArrowUpRight size={17} aria-hidden="true" /></div>
                    {project.description && <p className="home-project-description">{project.description}</p>}
                    <div className="home-project-meta"><span>{project.status ? humanLabel(project.status) : "Status not recorded"}</span>{project.desiredStartAt && <span>Desired start: {dateLabel(project.desiredStartAt)}</span>}</div>
                  </Link>)}</div> : <div className="home-empty"><p>No projects have been saved for this property.</p>{open("requests", "Prepare a work request")}</div>}
                </ReadState>
                {homeId === PACKAGE_HOME_ID && <div className="home-specialist-link"><Link className="home-text-action" href={`/homes?${new URLSearchParams({ homeId, workspace: "launch" })}`}>Package planning & partner tools<ArrowUpRight size={15} aria-hidden="true" /></Link><p>Scope matrix, package levels, source records, and launch planning remain available here.</p></div>}
              </Section>
              <Section title="Recent history" action={open("timeline", "View history")}>
                {history.length ? <ol className="home-history-list">{history.map((item, index) => <li key={item.id || index}><span className="home-history-dot" /><div><strong>{item.title || humanLabel(item.recordType)}</strong><small>{dateLabel(item.occurredAt || item.createdAt)}</small></div></li>)}</ol> : <div className="home-empty"><p>No history has been recorded yet.</p>{open("timeline", "Add a history entry")}</div>}
              </Section>
            </div>
            <aside className="home-side-column" aria-label="Property records">
              <Section title="Property details" action={<HomeIdentityEditor homeId={homeId} viewerId={viewerId} />}>
                <dl className="home-fact-list"><div><dt>Property type</dt><dd>{humanLabel(home.propertyType)}</dd></div><div><dt>Address</dt><dd>{homeAddress(home) || "Not added"}</dd></div><div><dt>Year built</dt><dd>{home.yearBuilt || "Not recorded"}</dd></div></dl>
                <ReadState pending={persistence.isPending} error={persistence.isError} retry={() => void persistence.refetch()} label="Saved details">
                  <p className="home-footnote">{persistence.data?.propertyDetails.length ?? 0} saved details · {persistence.data?.components.length ?? 0} system records</p>
                </ReadState>
              </Section>
              <Section title="Documents" action={open("documents", "View all")}>
                {detail.data?.documents.length ? <ul className="home-document-list">{detail.data.documents.slice(0, 4).map((document, index) => <li key={document.id || index}><FileText size={19} aria-hidden="true" /><span><strong>{document.originalName || "Stored document"}</strong><small>{humanLabel(document.documentType)} · {dateLabel(document.createdAt)}</small></span></li>)}</ul> : <p className="home-empty">No files have been uploaded to this property.</p>}
                <div className="home-panel-action">{open("documents", "Upload a document")}</div>
                {persistence.isSuccess && !persistence.isError && (persistence.data?.evidence.length || 0) > 0 && <p className="home-footnote">{persistence.data!.evidence.length} separate evidence references. References are not uploaded files.</p>}
              </Section>
              <Section title="Use this property record">
                <div className="home-shortcuts">
                  <Link href={homeHref(homeId, "systems")}><Wrench size={18} aria-hidden="true" /><span>Systems & equipment</span><ArrowUpRight size={15} aria-hidden="true" /></Link>
                  <Link href={homeHref(homeId, "requests")}><FolderOpen size={18} aria-hidden="true" /><span>Saved request details</span><ArrowUpRight size={15} aria-hidden="true" /></Link>
                  <Link href={homeHref(homeId, "sale")}><Home size={18} aria-hidden="true" /><span>Sale & ownership transfer</span><ArrowUpRight size={15} aria-hidden="true" /></Link>
                </div><p className="home-footnote">Review what will be shared before continuing to Direct Connect.</p>
              </Section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
