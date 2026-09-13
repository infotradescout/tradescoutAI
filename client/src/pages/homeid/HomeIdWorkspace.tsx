import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowUpRight, FileText, Home, Plus, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import type { HomeIdPropertyDetail, HomeIdRequestPacket } from "@/lib/homeidPersistence";
import { resolveHomeIdFirstUseTaskPrompt } from "@/lib/firstUseTaskPrompts";
import { trackFirstUseGuidanceViewed, trackFirstUseTaskPromptClicked, trackFirstUseTaskPromptViewed } from "@/lib/firstUseAnalytics";
import { HOME_IDENTITY_TYPES, homeIdentityChangesSchema } from "@shared/homeIdentity";
import HomeIdentityEditor from "./HomeIdentityEditor";
import { HOME_SECTIONS, dateLabel, homeAddress, homeName, humanLabel, object, type HomeSection, type HomeSummary } from "./homeWorkspaceModel";
import {
  rows, readRecordDetail, readRecordPersistence, recordTab, recordHref, buildTimelineHref,
  selectRecordProject, savedProjectStage, recordedMissingInputs, savedValue, textList,
  groupedSystems, documentDownloadHref, safeEvidenceHref,
  type HomeRecord, type HomeDocument, type HomeProject, type HomeSchedule, type HomeSystem,
  type HomeEvidence, type HomeAppliance,
} from "./homeRecordViewModel";
import "./HomeRecordWorkspace.css";

const DETAIL_CATEGORIES = ["roof", "hvac", "plumbing", "electrical", "foundation", "exterior", "interior", "appliances", "permits_documents", "other"];
const DOC_TYPES = [["inspection_report", "Inspection report"], ["invoice", "Invoice"], ["receipt", "Receipt"], ["photo", "Photo"], ["manual", "Manual"], ["permit", "Permit"], ["other", "Other"]] as const;
const RECORD_TYPES = [["inspection", "Inspection"], ["upgrade", "Upgrade"], ["improvement", "Improvement"], ["maintenance", "Maintenance"], ["warranty", "Warranty"], ["note", "Note"]] as const;
const STAGES = ["Property", "Design", "Engineering", "Package", "Build", "Closeout", "Occupancy"];
const TABS = HOME_SECTIONS;
type ReadQuery = { isPending: boolean; isError: boolean; refetch: () => Promise<unknown> };
type Feedback = { isError: boolean; error: unknown };
type DetailDraft = { category: string; note: string; status: "known" | "needs_review" };
type TimelineDraft = { recordType: string; occurredAt: string; title: string; details: string };
type ScheduleDraft = { title: string; cadenceDays: string; nextDueAt: string };
type NewHomeDraft = { nickname: string; homeType: string; yearBuilt: string; address1: string; address2: string; city: string; stateCode: string; countyFips: string; zipCode: string };
const emptyHome = (): NewHomeDraft => ({ nickname: "", homeType: "", yearBuilt: "", address1: "", address2: "", city: "", stateCode: "", countyFips: "", zipCode: "" });
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const human = (value: unknown) => humanLabel(typeof value === "string" ? value : null);
function money(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount) : "Not recorded";
}
function fileSize(value: unknown) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0 || value == null) return "";
  return size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function Panel({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return <section className="hr-panel"><div className="hr-panel-heading"><h2>{title}</h2>{action}</div><div className="hr-panel-body">{children}</div></section>;
}
export function Pill({ status, label }: { status?: string | null; label?: string }) {
  // This label reports a saved status; component category never upgrades it.
  const labels: Record<string, string> = { known: "Recorded", verified: "Marked verified", ready_for_handoff: "Prepared for review", needs_review: "Needs review", needs_info: "Needs information" };
  return <span className="hr-status" data-status={status || "unknown"}>{label || labels[status || ""] || human(status)}</span>;
}
export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return <div className="hr-empty"><h3>{title}</h3>{text && <p>{text}</p>}{action}</div>;
}
export function SavedEntries({ value, empty = "No details recorded." }: { value: unknown; empty?: string }) {
  const entries = Object.entries(object(value));
  return entries.length ? <dl className="hr-saved-fields">{entries.map(([key, item]) => <div key={key}><dt>{human(key)}</dt><dd>{savedValue(item)}</dd></div>)}</dl> : <p className="hr-muted">{empty}</p>;
}
function ReadState({ queries, label, children }: { queries: ReadQuery[]; label: string; children: ReactNode }) {
  if (queries.some((query) => query.isError)) return <div className="hr-error" role="alert"><p>{label} could not be loaded. Saved information has not changed.</p><button type="button" className="hr-button" onClick={() => void Promise.all(queries.map((query) => query.refetch()))}>Retry {label.toLowerCase()}</button></div>;
  if (queries.some((query) => query.isPending)) return <p role="status" className="hr-loading">Loading {label.toLowerCase()}…</p>;
  return <>{children}</>;
}
function MutationError({ mutation }: { mutation: Feedback }) {
  return mutation.isError ? <p className="hr-error" role="alert">{formatUserFacingErrorMessage(mutation.error, "The save did not complete. Your changes are still here.")}</p> : null;
}
function Action({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`hr-button ${props.className || ""}`}>{children}</button>;
}

export default function HomeIdWorkspace() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const homesQuery = useQuery({ queryKey: ["/api/homes", user?.id], enabled: isAuthenticated,
    queryFn: async () => rows<HomeSummary>(await apiRequest("GET", "/api/homes"), "homes") });
  const homes = homesQuery.data || [];
  const requestedHomeId = new URLSearchParams(search).get("homeId")?.trim() || null;
  const homeId = requestedHomeId || homes[0]?.id || null;
  if (isLoading) return <p role="status">Loading your property workspace…</p>;
  if (!isAuthenticated || !user?.id) return <section className="ts-home-record"><h1>Private property records</h1><Link className="hr-button" href={`/login?next=${encodeURIComponent(`/homes${search ? `?${search}` : ""}`)}`}>Sign in</Link></section>;
  // Property/viewer changes reset drafts and live state; tab changes do not erase them.
  return <RecordSession key={`${user.id}:${homeId || "new"}`} viewerId={user.id} homeId={homeId} homes={homes}
    homesQuery={homesQuery} search={search} navigate={navigate} />;
}

function RecordSession({ viewerId, homeId, homes, homesQuery, search, navigate }: {
  viewerId: string; homeId: string | null; homes: HomeSummary[]; homesQuery: ReadQuery;
  search: string; navigate: (href: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLTextAreaElement>(null);
  const projectId = new URLSearchParams(search).get("projectId")?.trim() || null;
  const tab = recordTab(search);
  const setTab = (next: HomeSection) => navigate(recordHref(homeId, next, projectId));
  const [newHomeOpen, setNewHomeOpen] = useState(false);
  const [newHome, setNewHome] = useState(emptyHome);
  const [detail, setDetail] = useState<DetailDraft>({ category: "other", note: "", status: "known" });
  const [docType, setDocType] = useState("other");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [timeline, setTimeline] = useState<TimelineDraft>({ recordType: "note", occurredAt: "", title: "", details: "" });
  const [schedule, setSchedule] = useState<ScheduleDraft>({ title: "", cadenceDays: "90", nextDueAt: "" });
  const [requestType, setRequestType] = useState("documentation");
  const [selectedDetailIds, setSelectedDetailIds] = useState<string[]>([]);
  const encoded = encodeURIComponent(homeId || "_none");
  const endpoint = `/api/homes/${encoded}`;
  const persistenceEndpoint = `/api/homeid/${encoded}/persistence`;
  const detailQuery = useQuery({ queryKey: [endpoint, "record", viewerId], enabled: Boolean(homeId),
    queryFn: async () => readRecordDetail(await apiRequest("GET", endpoint), homeId!) });
  const permitted = Boolean(homeId && detailQuery.isSuccess && !detailQuery.isError);
  const persistenceQuery = useQuery({ queryKey: [persistenceEndpoint, "record", viewerId], enabled: permitted,
    queryFn: async () => readRecordPersistence(await apiRequest("GET", persistenceEndpoint)) });
  const projectsQuery = useQuery({ queryKey: [`${endpoint}/projects`, "record", viewerId], enabled: permitted,
    queryFn: async () => rows<HomeProject>(await apiRequest("GET", `${endpoint}/projects`), "projects") });
  const schedulesQuery = useQuery({ queryKey: [`${endpoint}/maintenance-schedules`, "record", viewerId], enabled: permitted,
    queryFn: async () => rows<HomeSchedule>(await apiRequest("GET", `${endpoint}/maintenance-schedules`), "schedules") });

  const selectedHome = detailQuery.data?.home || null;
  const records = (detailQuery.data?.records || []).filter((item) => !item.title?.startsWith("homeid:"));
  const documents = detailQuery.data?.documents || [];
  const appliances = detailQuery.data?.appliances || [];
  const facts = persistenceQuery.data?.propertyDetails || [];
  const packets = persistenceQuery.data?.requestPackets || [];
  const components = persistenceQuery.data?.components || [];
  const evidence = persistenceQuery.data?.evidence || [];
  const projects = projectsQuery.data || [];
  const project = selectRecordProject(projects, projectId);
  const missing = recordedMissingInputs(project, packets);
  const known = facts.filter((item) => item.status === "known");
  const review = facts.filter((item) => item.status === "needs_review");
  const homeIdFirstTaskPrompt = useMemo(() => resolveHomeIdFirstUseTaskPrompt({
    hasSelectedHome: Boolean(homeId), knownDetailsCount: known.length, hasComponentLikeDetail: known.length > 0,
  }), [homeId, known.length]);
  useEffect(() => {
    if (!homeId || !permitted || !persistenceQuery.isSuccess || persistenceQuery.isError) return;
    trackFirstUseGuidanceViewed("homes", "authenticated");
    trackFirstUseTaskPromptViewed({ surface: "homes", promptMessage: homeIdFirstTaskPrompt.message, ctaLabel: homeIdFirstTaskPrompt.ctaLabel, userState: "authenticated" });
  }, [homeId, permitted, persistenceQuery.isSuccess, persistenceQuery.isError, homeIdFirstTaskPrompt.message, homeIdFirstTaskPrompt.ctaLabel]);

  const refresh = async () => {
    await Promise.all(["/api/homes", endpoint, persistenceEndpoint, `${endpoint}/projects`, `${endpoint}/maintenance-schedules`]
      .map((prefix) => queryClient.invalidateQueries({ queryKey: [prefix] })));
  };
  const requireReadableHome = () => { if (!permitted) throw new Error("Reload the selected property before saving."); };
  const requirePersistence = () => {
    requireReadableHome();
    if (!persistenceQuery.isSuccess || persistenceQuery.isError) throw new Error("Load the existing property details before saving.");
  };
  const fail = (title: string, error: unknown) => toast({ title, description: formatUserFacingErrorMessage(error, "Your changes are still here. Please retry."), variant: "destructive" });
  const createHome = useMutation({
    mutationFn: async () => {
      if (!HOME_IDENTITY_TYPES.some(([type]) => type === newHome.homeType)) throw new Error("Choose the property type.");
      const values = homeIdentityChangesSchema.parse({ nickname: newHome.nickname.trim() || null, propertyType: newHome.homeType,
        yearBuilt: newHome.yearBuilt.trim() ? Number(newHome.yearBuilt) : null,
        address1: newHome.address1.trim() || null, address2: newHome.address2.trim() || null, city: newHome.city.trim() || null,
        stateCode: newHome.stateCode || null, countyFips: newHome.countyFips || null, zipCode: newHome.zipCode.trim() || null });
      if ([values.address1, values.address2, values.city, values.stateCode, values.countyFips, values.zipCode].some(Boolean) && (!values.stateCode || !values.countyFips)) throw new Error("Choose the property's state and county or parish.");
      const { propertyType, ...fields } = values;
      const result = object(await apiRequest("POST", "/api/homeid/create", {
        ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)),
        homeType: propertyType, creatorRole: "homeowner",
      }));
      const id = object(result.home).id;
      if (typeof id !== "string" || !id) throw new Error("The created property could not be read. Check your property list before retrying.");
      return id;
    },
    onSuccess: async (id) => { setNewHomeOpen(false); setNewHome(emptyHome()); await queryClient.invalidateQueries({ queryKey: ["/api/homes"] }); navigate(recordHref(id)); toast({ title: "HomeID created" }); },
    onError: (error) => fail("Could not create HomeID", error),
  });
  const saveFact = useMutation({
    mutationFn: () => {
      requirePersistence();
      if (!detail.note.trim()) throw new Error("Add a property note first.");
      const now = new Date().toISOString();
      const next: HomeIdPropertyDetail = { id: uid("detail"), category: detail.category, note: detail.note.trim(), status: detail.status, createdAt: now, savedAt: now };
      return apiRequest("PUT", `/api/homeid/${homeId}/property-details`, { propertyDetails: [next, ...facts] });
    },
    onSuccess: async () => { setDetail({ category: "other", note: "", status: "known" }); await refresh(); toast({ title: "Property note saved" }); },
    onError: (error) => fail("Could not save property note", error),
  });
  const uploadDoc = useMutation({
    mutationFn: async () => {
      requireReadableHome();
      if (!docFile) throw new Error("Choose a file first.");
      const { objectKey } = await uploadPrivateObject(docFile);
      return apiRequest("POST", `${endpoint}/documents`, { documentType: docType, objectKey, originalName: docFile.name, contentType: docFile.type || "application/octet-stream", bytes: docFile.size });
    },
    onSuccess: async () => { setDocFile(null); setDocType("other"); if (fileRef.current) fileRef.current.value = ""; await refresh(); toast({ title: "Document added to HomeID" }); },
    onError: (error) => fail("Document upload failed", error),
  });
  const saveTimeline = useMutation({
    mutationFn: () => {
      requireReadableHome();
      if (timeline.title.trim().length < 2) throw new Error("Use at least two characters for the event title.");
      return apiRequest("POST", `${endpoint}/records`, { recordType: timeline.recordType, occurredAt: timeline.occurredAt || undefined, title: timeline.title.trim(), details: timeline.details.trim() || undefined });
    },
    onSuccess: async () => { setTimeline({ recordType: "note", occurredAt: "", title: "", details: "" }); await refresh(); toast({ title: "Timeline event saved" }); },
    onError: (error) => fail("Could not save timeline event", error),
  });
  const saveSchedule = useMutation({
    mutationFn: () => {
      requireReadableHome();
      const cadenceDays = Number(schedule.cadenceDays);
      if (schedule.title.trim().length < 2 || !Number.isInteger(cadenceDays) || cadenceDays < 1 || cadenceDays > 3650) throw new Error("Add a maintenance title and a valid interval.");
      return apiRequest("POST", `${endpoint}/maintenance-schedules`, { title: schedule.title.trim(), cadenceDays,
        nextDueAt: schedule.nextDueAt ? new Date(`${schedule.nextDueAt}T12:00:00`).toISOString() : undefined });
    },
    onSuccess: async () => { setSchedule({ title: "", cadenceDays: "90", nextDueAt: "" }); await refresh(); toast({ title: "Maintenance schedule created" }); },
    onError: (error) => fail("Could not create schedule", error),
  });
  const savePacket = useMutation({
    mutationFn: () => {
      requirePersistence();
      if (!projectsQuery.isSuccess || projectsQuery.isError) throw new Error("Load the existing project details before preparing a request.");
      if (!selectedDetailIds.length || selectedDetailIds.some((id) => !facts.some((fact) => fact.id === id))) throw new Error("Choose the saved property details to include.");
      const now = new Date().toISOString();
      const packet: HomeIdRequestPacket = { id: uid("packet"), requestType, selectedDetailIds,
        missingHelpfulInfo: missing.slice(0, 15), missingHelpfulInfoCount: Math.min(15, missing.length),
        status: missing.length ? "needs_info" : "ready_for_handoff", createdAt: now, savedAt: now };
      return apiRequest("PUT", `/api/homeid/${homeId}/request-packets`, { requestPackets: [packet, ...packets] });
    },
    onSuccess: async () => { setSelectedDetailIds([]); await refresh(); toast({ title: "Request details saved" }); },
    onError: (error) => fail("Could not save request details", error),
  });
  const openProperty = () => { setTab("property"); window.requestAnimationFrame(() => detailRef.current?.focus()); };
  const openDocs = () => { setTab("documents"); window.requestAnimationFrame(() => fileRef.current?.focus()); };
  const openRequest = (packetId?: string) => {
    if (!homeId || !permitted) return;
    const params = new URLSearchParams({ homeId, homeContextIntent: "update_from_request" });
    if (packetId) params.set("homePacketId", packetId);
    navigate(`/direct-connect?${params.toString()}`);
  };
  const openFirstTask = () => {
    const targetTab: HomeSection = homeIdFirstTaskPrompt.ctaLabel === "Create request details" ? "requests" : "property";
    const targetRoute = recordHref(homeId, targetTab, projectId);
    trackFirstUseTaskPromptClicked({ surface: "homes", promptMessage: homeIdFirstTaskPrompt.message, ctaLabel: homeIdFirstTaskPrompt.ctaLabel, targetRoute, userState: "authenticated" });
    targetTab === "requests" ? setTab("requests") : openProperty();
  };

  return <div className="ts-home-record" data-testid="homeid-workspace">
    <div className="hr-workspace-bar"><span className="hr-brand"><Home size={19} aria-hidden="true" />HomeID</span><div className="hr-actions">
      {homes.length > 1 && <label className="hr-picker"><span className="sr-only">Choose property</span><select aria-label="Choose property" value={homeId || ""} onChange={(event) => navigate(recordHref(event.target.value, tab))}>
        {homeId && !homes.some((home) => home.id === homeId) && <option value={homeId}>Selected property</option>}
        {homes.map((home) => <option key={home.id} value={home.id}>{homeName(home)}</option>)}
      </select></label>}
      <Action onClick={() => setNewHomeOpen(true)}><Plus size={16} aria-hidden="true" />New property</Action>
      <Action aria-label="Refresh property records" onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />Refresh</Action>
    </div></div>
    {homesQuery.isError && <div className="hr-error" role="alert"><p>Your property list could not be loaded.</p><Action onClick={() => void homesQuery.refetch()}>Retry property list</Action></div>}
    {!homeId ? <ReadState queries={[homesQuery]} label="Properties"><Empty title="Create your first property record" text="Keep projects, systems, documents, maintenance, and ownership history in one private workspace." action={<Action className="hr-primary" onClick={() => setNewHomeOpen(true)}>Create HomeID</Action>} /></ReadState> :
    <ReadState queries={[detailQuery]} label="Selected property">
      {selectedHome && <>
        <header className="hr-heading"><div><p className="hr-eyebrow">Private property record</p><h1>{homeName(selectedHome)}</h1><p>{homeAddress(selectedHome) || "Address not recorded"}</p><p className="hr-muted">{HOME_IDENTITY_TYPES.find(([type]) => type === selectedHome.propertyType)?.[1] || human(selectedHome.propertyType)}{selectedHome.yearBuilt ? ` · Built ${selectedHome.yearBuilt}` : ""}</p></div>
          <div className="hr-actions"><HomeIdentityEditor homeId={homeId} viewerId={viewerId} className="hr-button" /><Action onClick={openDocs}>Upload Documents</Action><Action onClick={() => setTab("build")}>Continue Planning</Action><Action className="hr-primary" onClick={() => openRequest()}>Start a Request</Action></div>
        </header>
        <nav className="hr-sections" aria-label="Property record sections">{TABS.map((item) => <Link key={item.id} href={recordHref(homeId, item.id, projectId)} aria-current={tab === item.id ? "page" : undefined}>{item.label}</Link>)}</nav>
        <main className="hr-content">
          {tab === "overview" && <ReadState queries={[persistenceQuery, projectsQuery]} label="Property overview"><Overview project={project} missing={missing} components={components} evidence={evidence} facts={facts} documents={documents} openProperty={openProperty} openSystems={() => setTab("systems")} openDocuments={() => setTab("documents")} />
            <div className="hr-guidance" data-testid="homeid-first-task-prompt"><p>{homeIdFirstTaskPrompt.message}</p><Action onClick={openFirstTask}>{homeIdFirstTaskPrompt.ctaLabel}</Action></div>
          </ReadState>}
          {tab === "property" && <ReadState queries={[persistenceQuery]} label="Property details"><Property home={selectedHome} viewerId={viewerId} known={known} review={review} detail={detail} setDetail={setDetail} detailRef={detailRef} save={() => saveFact.mutate()} pending={saveFact.isPending} /><MutationError mutation={saveFact} /></ReadState>}
          {tab === "build" && <ReadState queries={[projectsQuery, persistenceQuery]} label="Projects"><Build project={project} projects={projects} projectId={projectId} homeId={homeId} missing={missing} openProperty={openProperty} selectProject={(id) => navigate(recordHref(homeId, "build", id))} /></ReadState>}
          {tab === "systems" && <ReadState queries={[persistenceQuery]} label="Systems"><Systems components={components} /></ReadState>}
          {tab === "documents" && <><Documents homeId={homeId} documents={documents} evidence={evidence} referencesQuery={persistenceQuery} fileRef={fileRef} docType={docType} setDocType={setDocType} docFile={docFile} setDocFile={setDocFile} upload={() => uploadDoc.mutate()} pending={uploadDoc.isPending} /><MutationError mutation={uploadDoc} /></>}
          {tab === "timeline" && <><Timeline records={records} state={timeline} setState={setTimeline} save={() => saveTimeline.mutate()} pending={saveTimeline.isPending} /><MutationError mutation={saveTimeline} /></>}
          {tab === "maintenance" && <ReadState queries={[schedulesQuery]} label="Maintenance"><Maintenance schedules={schedulesQuery.data || []} appliances={appliances} state={schedule} setState={setSchedule} save={() => saveSchedule.mutate()} pending={saveSchedule.isPending} /><MutationError mutation={saveSchedule} /></ReadState>}
          {tab === "requests" && <ReadState queries={[persistenceQuery, projectsQuery]} label="Request details"><Requests facts={facts} packets={packets} requestType={requestType} setRequestType={setRequestType} selected={selectedDetailIds} setSelected={setSelectedDetailIds} missing={missing} save={() => savePacket.mutate()} open={openRequest} pending={savePacket.isPending} /><MutationError mutation={savePacket} /></ReadState>}
          {tab === "sale" && <Sale homeId={homeId} openProperty={openProperty} openDocuments={() => setTab("documents")} openRequest={() => openRequest()} />}
        </main>
      </>}
    </ReadState>}
    <Dialog open={newHomeOpen} onOpenChange={(open) => { if (!createHome.isPending) setNewHomeOpen(open); }}><DialogContent data-ts-core-ui="true" className="home-record-dialog"><DialogHeader><DialogTitle>New property</DialogTitle><DialogDescription>Add a private HomeID. An address is optional until you have the location.</DialogDescription></DialogHeader>
      <NewHome state={newHome} setState={setNewHome} close={() => setNewHomeOpen(false)} create={() => createHome.mutate()} pending={createHome.isPending} /><MutationError mutation={createHome} />
    </DialogContent></Dialog>
  </div>;
}

export function Overview({ project, missing, components, evidence, facts, documents, openProperty, openSystems, openDocuments }: {
  project: HomeProject | null; missing: string[]; components: HomeSystem[]; evidence: HomeEvidence[]; facts: HomeIdPropertyDetail[]; documents: HomeDocument[];
  openProperty: () => void; openSystems: () => void; openDocuments: () => void;
}) {
  const stage = savedProjectStage(project);
  return <div className="hr-stack">
    <div className="hr-summary-grid">{[["Saved property details", facts.length], ["System records", components.length], ["Uploaded documents", documents.length], ["Listed open inputs", missing.length]].map(([label, count]) => <div className="hr-summary" key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>
    <div className="hr-two-columns">
      <Panel title="Project & planning"><h3>{project?.title || "No project selected"}</h3><div className="hr-actions"><Pill status={project?.status} /><span className="hr-muted">Project stage: {stage || "Not recorded"}</span></div>
        <p>{project?.description || "Open Projects & build to start or select the work for this property."}</p>
        <details className="hr-details"><summary>View the planning sequence</summary><p className="hr-muted">A planning reference, not a list of completed milestones.</p><ol className="hr-planning-sequence">{STAGES.map((name) => <li key={name} aria-current={stage?.toLowerCase() === name.toLowerCase() ? "step" : undefined}>{name}</li>)}</ol></details>
      </Panel>
      <Panel title="Open planning inputs" action={<Action onClick={openProperty}>Add property note</Action>}>{missing.length ? <ul className="hr-list">{missing.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="hr-muted">No open inputs are listed in the saved project and requests.</p>}<p className="hr-note">An empty list does not confirm project readiness.</p></Panel>
      <Panel title="Package & systems" action={<Action onClick={openSystems}>View systems</Action>}><SavedEntries value={object(project?.metadata).currentCoverage} empty="No package coverage has been recorded." /><p className="hr-note">{components.length} system records. Status is shown as recorded, not inferred from the system category.</p></Panel>
      <Panel title="Documents & references" action={<Action onClick={openDocuments}>Open documents</Action>}><p>{documents.length} uploaded files · {evidence.length} references</p>{evidence.length ? <ul className="hr-list">{evidence.slice(0, 4).map((item) => <li key={item.id}>{item.title}<Pill status={item.status} /></li>)}</ul> : <p className="hr-muted">No references have been added.</p>}<p className="hr-note">File links and references are separate from uploaded property documents.</p></Panel>
    </div>
  </div>;
}

function Property({ home, viewerId, known, review, detail, setDetail, detailRef, save, pending }: {
  home: HomeSummary; viewerId: string; known: HomeIdPropertyDetail[]; review: HomeIdPropertyDetail[]; detail: DetailDraft;
  setDetail: React.Dispatch<React.SetStateAction<DetailDraft>>; detailRef: React.RefObject<HTMLTextAreaElement>; save: () => void; pending: boolean;
}) {
  return <div className="hr-stack"><div className="hr-two-columns"><Panel title="Property identity" action={<HomeIdentityEditor homeId={home.id} viewerId={viewerId} triggerLabel="Edit address & details" className="hr-button" />}>
    <dl className="hr-facts"><div><dt>Property name</dt><dd>{homeName(home)}</dd></div><div><dt>Address</dt><dd>{homeAddress(home) || "Not recorded"}</dd></div><div><dt>Property type</dt><dd>{HOME_IDENTITY_TYPES.find(([type]) => type === home.propertyType)?.[1] || human(home.propertyType)}</dd></div><div><dt>Year built</dt><dd>{home.yearBuilt || "Not recorded"}</dd></div></dl>
    <p className="hr-note">Use Edit address & details for the property's address. Use a note for measurements, parcel information, decisions, or anything to review.</p>
  </Panel><Panel title="Add a property note"><form onSubmit={(event) => { event.preventDefault(); save(); }}><fieldset disabled={pending} className="hr-form">
    <label>Category<select aria-label="Category" value={detail.category} onChange={(event) => setDetail((current) => ({ ...current, category: event.target.value }))}>{DETAIL_CATEGORIES.map((category) => <option key={category} value={category}>{human(category)}</option>)}</select></label>
    <label>Property note<textarea ref={detailRef} value={detail.note} maxLength={20000} onChange={(event) => setDetail((current) => ({ ...current, note: event.target.value }))} placeholder="Add a measurement, parcel detail, decision, or item to review." /></label>
    <label>Review status<select aria-label="Review status" value={detail.status} onChange={(event) => setDetail((current) => ({ ...current, status: event.target.value === "needs_review" ? "needs_review" : "known" }))}><option value="known">Recorded by you</option><option value="needs_review">Needs review</option></select></label>
    <button className="hr-button hr-primary" disabled={pending || !detail.note.trim()} type="submit">{pending ? "Saving…" : "Save property note"}</button>
  </fieldset></form></Panel></div><div className="hr-two-columns"><FactList title={`Saved details (${known.length})`} items={known} /><FactList title={`Needs review (${review.length})`} items={review} /></div></div>;
}
function FactList({ title, items }: { title: string; items: HomeIdPropertyDetail[] }) {
  return <Panel title={title}>{items.length ? <div className="hr-stack">{items.map((item) => <article key={item.id} className="hr-item"><div className="hr-item-heading"><h3>{human(item.category)}</h3><Pill status={item.status} /></div><p className="hr-prewrap">{item.note}</p></article>)}</div> : <p className="hr-muted">No details in this group.</p>}</Panel>;
}

export function Build({ project, projects, projectId, homeId, missing, openProperty, selectProject }: {
  project: HomeProject | null; projects: HomeProject[]; projectId: string | null; homeId: string; missing: string[]; openProperty: () => void; selectProject: (id: string | null) => void;
}) {
  return <div className="hr-stack"><div className="hr-actions"><label className="hr-picker">Choose project<select aria-label="Choose project" value={project?.id || ""} onChange={(event) => selectProject(event.target.value || null)}><option value="">Choose a saved project</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.title || "Untitled project"}</option>)}</select></label><Link className="hr-button" href={buildTimelineHref(homeId, project?.id)}>Open Build Timeline<ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    {!project ? <Empty title={projectId ? "This project is not available in this property" : "No build project is attached"} text={projectId ? "Choose another saved project. No other project has been substituted." : "Start a project timeline when you are ready to plan work."} action={projectId ? <Action onClick={() => selectProject(null)}>Show this property's projects</Action> : <Link className="hr-button hr-primary" href={buildTimelineHref(homeId)}>Start Build Timeline</Link>} /> : <>
      <Panel title={project.title || "Build project"} action={<Pill status={project.status} />}><p>{project.description || "No project description recorded."}</p><dl className="hr-facts"><div><dt>Type</dt><dd>{human(project.projectType)}</dd></div><div><dt>Stage</dt><dd>{savedProjectStage(project) || "Not recorded"}</dd></div><div><dt>Target start</dt><dd>{dateLabel(project.desiredStartAt)}</dd></div><div><dt>Budget</dt><dd>{money(project.estimatedCost)}</dd></div></dl></Panel>
      <div className="hr-two-columns"><Panel title="Recorded package coverage"><SavedEntries value={object(project.metadata).currentCoverage} /></Panel><Panel title="Unresolved package categories">{textList(object(project.metadata).unresolvedPackageLanes).length ? <ul className="hr-list">{textList(object(project.metadata).unresolvedPackageLanes).map((item) => <li key={item}>{human(item)}</li>)}</ul> : <p className="hr-muted">No unresolved categories are listed.</p>}</Panel>
      <Panel title="Listed planning inputs" action={<Action onClick={openProperty}>Add property note</Action>}>{missing.length ? <ol className="hr-list">{missing.map((item) => <li key={item}>{item}</li>)}</ol> : <p className="hr-muted">No open inputs are listed. Review the project before ordering or scheduling.</p>}</Panel>
      <Panel title="Project boundaries & notes">{textList(object(project.metadata).boundaries).length ? <ul className="hr-list">{textList(object(project.metadata).boundaries).map((item) => <li key={item}>{item}</li>)}</ul> : <p className="hr-muted">No project-specific boundaries have been recorded.</p>}</Panel></div>
    </>}
  </div>;
}

export function Systems({ components }: { components: HomeSystem[] }) {
  return <div className="hr-stack"><div className="hr-summary-grid">{[["Recorded", "known"], ["Needs review", "needs_review"], ["Not defined", "unknown"]].map(([label, status]) => <div className="hr-summary" key={status}><strong>{components.filter((item) => item.status === status).length}</strong><span>{label}</span></div>)}</div>
    <div className="hr-two-columns">{groupedSystems(components).map((group) => <Panel key={group.name} title={group.name}>{group.items.length ? <div className="hr-stack">{group.items.map((item) => <article key={item.id} className="hr-item"><div className="hr-item-heading"><h3>{item.label || human(item.type)}</h3><Pill status={item.status} /></div><p className="hr-muted">{human(item.type)}</p></article>)}</div> : <p className="hr-muted">No system records in this group.</p>}</Panel>)}</div>
  </div>;
}

export function Documents({ homeId, documents, evidence, referencesQuery, fileRef, docType, setDocType, docFile, setDocFile, upload, pending }: {
  homeId: string; documents: HomeDocument[]; evidence: HomeEvidence[]; referencesQuery: ReadQuery;
  fileRef: React.RefObject<HTMLInputElement>; docType: string; setDocType: (value: string) => void; docFile: File | null; setDocFile: (value: File | null) => void; upload: () => void; pending: boolean;
}) {
  return <div className="hr-stack"><div className="hr-two-columns"><Panel title="Upload a property document"><form onSubmit={(event) => { event.preventDefault(); upload(); }}><fieldset className="hr-form" disabled={pending}>
    <label>Document type<select aria-label="Document type" value={docType} onChange={(event) => setDocType(event.target.value)}>{DOC_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Choose a file<input ref={fileRef} type="file" onChange={(event) => setDocFile(event.target.files?.[0] || null)} /></label>
    <p className="hr-note">Plans, surveys, permits, inspections, receipts, manuals, photos, and warranties.</p>{docFile && <p>{docFile.name} · {fileSize(docFile.size)}</p>}
    <button className="hr-button hr-primary" type="submit" disabled={pending || !docFile}>{pending ? "Uploading…" : "Upload to HomeID"}</button>
  </fieldset></form></Panel><Panel title={`Property documents (${documents.length})`}>{documents.length ? <div className="hr-stack">{documents.map((item, index) => <article key={item.id || index} className="hr-item"><div className="hr-item-heading"><h3><FileText size={17} aria-hidden="true" />{item.originalName || "Property document"}</h3>{item.id && <a className="hr-button" href={documentDownloadHref(homeId, item.id)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.originalName || "property document"}`}>Open / download<ArrowUpRight size={15} aria-hidden="true" /></a>}</div><p className="hr-muted">{human(item.documentType)}{fileSize(item.bytes) ? ` · ${fileSize(item.bytes)}` : ""} · Added {dateLabel(item.createdAt)}</p></article>)}</div> : <Empty title="No files are stored yet" text="Upload a property document to keep it here." />}</Panel></div>
    <Panel title="References"><ReadState queries={[referencesQuery]} label="References">{evidence.length ? <div className="hr-two-columns">{evidence.map((item) => <article key={item.id} className="hr-item"><div className="hr-item-heading"><h3>{item.title}</h3><Pill status={item.status} /></div>{item.fileName && <p>{item.fileName}</p>}{item.description && <p className="hr-prewrap">{item.description}</p>}{safeEvidenceHref(item.fileUrl) ? <a className="hr-button" href={safeEvidenceHref(item.fileUrl)!} target="_blank" rel="noopener noreferrer">Open file link</a> : <span className="hr-muted">Reference only</span>}<p className="hr-note">A reference or file link is not proof that the original file is stored in HomeID.</p></article>)}</div> : <p className="hr-muted">No references have been added.</p>}</ReadState></Panel>
  </div>;
}

function Timeline({ records, state, setState, save, pending }: { records: HomeRecord[]; state: TimelineDraft; setState: React.Dispatch<React.SetStateAction<TimelineDraft>>; save: () => void; pending: boolean }) {
  return <div className="hr-two-columns"><Panel title={`Property history (${records.length})`}>{records.length ? <ol className="hr-history">{records.map((item, index) => <li key={item.id || index}><p className="hr-muted">{dateLabel(item.occurredAt || item.createdAt)} · {human(item.recordType)}</p><h3>{item.title || "History entry"}</h3>{item.details && <p className="hr-prewrap">{item.details}</p>}</li>)}</ol> : <Empty title="No history has been recorded" text="Keep decisions, inspections, completed work, warranties, and maintenance with the property." />}</Panel>
    <Panel title="Add history entry"><form onSubmit={(event) => { event.preventDefault(); save(); }}><fieldset className="hr-form" disabled={pending}><label>Event type<select aria-label="Event type" value={state.recordType} onChange={(event) => setState((current) => ({ ...current, recordType: event.target.value }))}>{RECORD_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Event date<input type="date" value={state.occurredAt} onChange={(event) => setState((current) => ({ ...current, occurredAt: event.target.value }))} /></label><label>Event title<input value={state.title} maxLength={220} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} /></label><label>Event details<textarea value={state.details} maxLength={20000} onChange={(event) => setState((current) => ({ ...current, details: event.target.value }))} /></label><button className="hr-button hr-primary" type="submit" disabled={pending || state.title.trim().length < 2}>{pending ? "Saving…" : "Save timeline event"}</button></fieldset></form></Panel>
  </div>;
}

function Maintenance({ schedules, appliances, state, setState, save, pending }: { schedules: HomeSchedule[]; appliances: HomeAppliance[]; state: ScheduleDraft; setState: React.Dispatch<React.SetStateAction<ScheduleDraft>>; save: () => void; pending: boolean }) {
  return <div className="hr-stack"><div className="hr-two-columns"><Panel title={`Maintenance schedules (${schedules.length})`}>{schedules.length ? <div className="hr-stack">{schedules.map((item, index) => <article className="hr-item" key={item.id || index}><div className="hr-item-heading"><h3>{item.title || "Maintenance item"}</h3><Pill status={item.status} /></div><p className="hr-muted">{item.cadenceDays ? `Every ${item.cadenceDays} days` : "Interval not recorded"}</p><p>Next due: {dateLabel(item.nextDueAt)}</p></article>)}</div> : <Empty title="No maintenance schedules yet" text="Add the care interval and next due date for the property or equipment." />}</Panel>
    <Panel title="Add preventive maintenance"><form onSubmit={(event) => { event.preventDefault(); save(); }}><fieldset className="hr-form" disabled={pending}><label>Maintenance title<input value={state.title} maxLength={220} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} /></label><label>Repeat interval<select aria-label="Repeat interval" value={state.cadenceDays} onChange={(event) => setState((current) => ({ ...current, cadenceDays: event.target.value }))}><option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">1 year</option></select></label><label>Next due date<input type="date" value={state.nextDueAt} onChange={(event) => setState((current) => ({ ...current, nextDueAt: event.target.value }))} /></label><p className="hr-note">When no due date is entered, the first date is the selected interval from today.</p><button className="hr-button hr-primary" type="submit" disabled={pending || state.title.trim().length < 2}>{pending ? "Saving…" : "Create schedule"}</button></fieldset></form></Panel></div>
    <Panel title={`Appliances & equipment (${appliances.length})`}>{appliances.length ? <div className="hr-two-columns">{appliances.map((item, index) => <article className="hr-item" key={item.id || index}><h3>{[item.brand, item.model].filter(Boolean).join(" ") || item.category || "Equipment"}</h3><p className="hr-muted">{human(item.category)}</p><p>{item.serial ? `Serial: ${item.serial}` : "Serial number not recorded"}</p>{item.installedAt && <p>Installed: {dateLabel(item.installedAt)}</p>}{item.notes && <p className="hr-prewrap">{item.notes}</p>}</article>)}</div> : <p className="hr-muted">No equipment has been recorded.</p>}</Panel>
  </div>;
}

function Requests({ facts, packets, requestType, setRequestType, selected, setSelected, missing, save, open, pending }: {
  facts: HomeIdPropertyDetail[]; packets: HomeIdRequestPacket[]; requestType: string; setRequestType: (value: string) => void;
  selected: string[]; setSelected: React.Dispatch<React.SetStateAction<string[]>>; missing: string[]; save: () => void; open: (packetId?: string) => void; pending: boolean;
}) {
  return <div className="hr-two-columns"><Panel title="Prepare a request"><form onSubmit={(event) => { event.preventDefault(); save(); }}><fieldset className="hr-form" disabled={pending}>
    <label>Request type<select aria-label="Request type" value={requestType} onChange={(event) => setRequestType(event.target.value)}>{["repair", "inspection", "quote", "maintenance", "documentation", "other"].map((value) => <option key={value} value={value}>{human(value)}</option>)}</select></label>
    <p>Choose the saved details to include.</p><div className="hr-selection-list">{facts.map((fact) => <label key={fact.id} className="hr-check"><input type="checkbox" checked={selected.includes(fact.id)} onChange={() => setSelected((current) => current.includes(fact.id) ? current.filter((id) => id !== fact.id) : [...current, fact.id])} /><span><strong>{human(fact.category)}</strong><span className="hr-prewrap">{fact.note}</span><Pill status={fact.status} /></span></label>)}</div>
    {!facts.length && <p className="hr-muted">Add a property note before preparing saved request details.</p>}{missing.length > 0 && <p className="hr-note">{missing.length} open inputs are listed in the saved project and requests.</p>}
    <button className="hr-button hr-primary" type="submit" disabled={pending || !selected.length}>{pending ? "Saving…" : "Save request details"}</button><p className="hr-note">Saving here does not submit a request or share your property.</p>
  </fieldset></form></Panel><Panel title={`Saved request details (${packets.length})`} action={<Action onClick={() => open()}>Start a Request</Action>}>{packets.length ? <div className="hr-stack">{packets.map((packet) => <article key={packet.id} className="hr-item"><div className="hr-item-heading"><h3>{human(packet.requestType)} request</h3><Pill status={packet.status} /></div><p className="hr-muted">{packet.selectedDetailIds.length} details selected · {packet.missingHelpfulInfoCount} listed open inputs</p><p className="hr-muted">Saved {dateLabel(packet.savedAt)}</p><Action onClick={() => open(packet.id)}>Open in Direct Connect</Action></article>)}</div> : <Empty title="No request details saved" text="Choose the HomeID facts that matter, save the packet, then carry that context into Direct Connect." />}</Panel></div>;
}

export function Sale({ homeId, openProperty, openDocuments, openRequest }: { homeId: string; openProperty: () => void; openDocuments: () => void; openRequest: () => void }) {
  return <div className="hr-two-columns"><Panel title="Sale & Transfer"><ol className="hr-list"><li><strong>Review the property record.</strong><p>Keep plans, systems, warranties, inspections, maintenance, and improvements together.</p></li><li><strong>Prepare work that is still needed.</strong><p>Use Requests for repairs, inspections, measurements, and missing documents.</p></li><li><strong>Choose what to share.</strong><p>Review the selected records before making buyer-facing information available.</p></li><li><strong>Choose the sale path.</strong><p>Continue through HomeScout with the appropriate professional support.</p></li></ol><p className="hr-note">These are preparation steps, not completed tasks or a transfer-readiness rating.</p></Panel><Panel title="Continue from this record"><div className="hr-stack"><Action onClick={openProperty}>Review property notes</Action><Action onClick={openDocuments}>Review property records</Action><Action onClick={openRequest}>Prepare needed work</Action><Link className="hr-button hr-primary" href={`/homescout/new?${new URLSearchParams({ homeId })}`}>Open HomeScout<ArrowUpRight size={16} aria-hidden="true" /></Link></div><p className="hr-note">You control the information you share. Opening a listing does not transfer ownership.</p></Panel></div>;
}

function NewHome({ state, setState, close, create, pending }: { state: NewHomeDraft; setState: React.Dispatch<React.SetStateAction<NewHomeDraft>>; close: () => void; create: () => void; pending: boolean }) {
  const states = useQuery({ queryKey: ["/api/states"], queryFn: async () => { const value = await apiRequest("GET", "/api/states"); if (!Array.isArray(value)) throw new Error("States could not be read."); return value as { code: string; name: string }[]; }, staleTime: 3600000 });
  const counties = useQuery({ queryKey: ["/api/counties", state.stateCode], enabled: Boolean(state.stateCode), queryFn: async () => { const value = await apiRequest("GET", `/api/counties?state=${encodeURIComponent(state.stateCode)}`); if (!Array.isArray(value)) throw new Error("Counties could not be read."); return value as { fips: string; name: string }[]; }, staleTime: 3600000 });
  const field = (key: keyof NewHomeDraft, label: string, maxLength: number) => <label>{label}<input value={state[key]} maxLength={maxLength} onChange={(event) => setState((current) => ({ ...current, [key]: event.target.value }))} /></label>;
  return <form className="hr-create-form" onSubmit={(event) => { event.preventDefault(); create(); }}><fieldset className="hr-form" disabled={pending}>{field("nickname", "Property name (optional)", 160)}<label>Property type<select aria-label="Property type" value={state.homeType} onChange={(event) => setState((current) => ({ ...current, homeType: event.target.value }))}><option value="">Choose property type</option>{HOME_IDENTITY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="hr-two-columns">{field("yearBuilt", "Year built (optional)", 4)}{field("address1", "Street address (optional)", 180)}{field("address2", "Unit or address line 2", 180)}{field("city", "City", 120)}
    <label>State<select aria-label="State" value={state.stateCode} disabled={pending || states.isPending || states.isError} onChange={(event) => setState((current) => ({ ...current, stateCode: event.target.value, countyFips: "" }))}><option value="">Choose state</option>{states.data?.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label>County or parish<select aria-label="County or parish" value={state.countyFips} disabled={pending || !state.stateCode || counties.isPending || counties.isError} onChange={(event) => setState((current) => ({ ...current, countyFips: event.target.value }))}><option value="">Choose county or parish</option>{counties.data?.map((item) => <option key={item.fips} value={item.fips}>{item.name}</option>)}</select></label>{field("zipCode", "ZIP code", 10)}</div>
    {states.isError && <Action onClick={() => void states.refetch()}>Retry states</Action>}{counties.isError && <Action onClick={() => void counties.refetch()}>Retry counties</Action>}
    <div className="hr-actions"><Action disabled={pending} onClick={close}>Cancel</Action><button className="hr-button hr-primary" type="submit" disabled={pending || !state.homeType}>{pending ? "Creating…" : "Create HomeID"}</button></div>
  </fieldset></form>;
}
