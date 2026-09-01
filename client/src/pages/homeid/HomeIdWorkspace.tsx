import React, { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  FolderOpen,
  Hammer,
  HardHat,
  Home,
  Layers3,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import type { HomeIdPropertyDetail, HomeIdRequestPacket } from "@/lib/homeidPersistence";
import { resolveHomeIdFirstUseTaskPrompt } from "@/lib/firstUseTaskPrompts";
import {
  trackFirstUseGuidanceViewed,
  trackFirstUseTaskPromptClicked,
  trackFirstUseTaskPromptViewed,
} from "@/lib/firstUseAnalytics";

type Tab =
  | "overview"
  | "property"
  | "build"
  | "systems"
  | "documents"
  | "timeline"
  | "maintenance"
  | "requests"
  | "sale";

type HomeRow = {
  id?: string;
  nickname?: string | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  stateCode?: string | null;
  countyFips?: string | null;
  zipCode?: string | null;
};

type HomeRecord = {
  id?: string;
  recordType?: string;
  occurredAt?: string | null;
  title?: string | null;
  details?: string | null;
  createdAt?: string | null;
};

type HomeDocument = {
  id?: string;
  documentType?: string | null;
  originalName?: string | null;
  bytes?: number | null;
  createdAt?: string | null;
};

type HomeProject = {
  id?: string;
  title?: string | null;
  description?: string | null;
  projectType?: string | null;
  status?: string | null;
  estimatedCost?: string | number | null;
  desiredStartAt?: string | null;
  metadata?: unknown;
};

type HomeSchedule = {
  id?: string;
  title?: string | null;
  cadenceDays?: number | null;
  nextDueAt?: string | null;
  status?: string | null;
};

type Component = {
  id: string;
  type: string;
  label: string;
  status: "known" | "needs_review" | "unknown";
};

type Evidence = {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "verified" | "needs_review";
  fileUrl?: string;
  fileName?: string;
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "property", label: "Property" },
  { id: "build", label: "Build" },
  { id: "systems", label: "Systems" },
  { id: "documents", label: "Documents" },
  { id: "timeline", label: "Timeline" },
  { id: "maintenance", label: "Maintenance" },
  { id: "requests", label: "Requests" },
  { id: "sale", label: "Sale & Transfer" },
];

const HOME_TYPES = [
  ["single_family", "Single-family home"],
  ["manufactured_home", "Manufactured home"],
  ["mobile_home", "Mobile home"],
  ["new_build", "New build"],
  ["land_lot", "Land or lot"],
  ["rental_unit", "Rental unit"],
  ["other", "Other"],
] as const;

const DETAIL_CATEGORIES = [
  "roof",
  "hvac",
  "plumbing",
  "electrical",
  "foundation",
  "exterior",
  "interior",
  "appliances",
  "permits_documents",
  "other",
] as const;

const DOC_TYPES = [
  ["inspection_report", "Inspection report"],
  ["invoice", "Invoice"],
  ["receipt", "Receipt"],
  ["photo", "Photo"],
  ["manual", "Manual"],
  ["permit", "Permit"],
  ["other", "Other"],
] as const;

const RECORD_TYPES = [
  ["inspection", "Inspection"],
  ["upgrade", "Upgrade"],
  ["improvement", "Improvement"],
  ["maintenance", "Maintenance"],
  ["warranty", "Warranty"],
  ["note", "Note"],
] as const;

const STAGES = ["Property", "Design", "Engineering", "Package", "Build", "Closeout", "Occupancy"];
const COVERED = new Set(["structural_system", "roofing", "cabinets", "natural_stone"]);
const PANEL = "rounded-3xl border border-white/[0.10] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,.035)]";
const INPUT = "border-white/[0.10] bg-black/[0.20] text-white placeholder:text-white/[0.25]";
const SECONDARY = "border-white/[0.10] bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white";
const PRIMARY = "bg-orange-500 font-black text-black hover:bg-orange-400";

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function human(value: unknown): string {
  const text = String(value || "").trim();
  return text
    ? text.replaceAll("_", " ").replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Not set";
}

function date(value: unknown, fallback = "Not dated"): string {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function money(value: unknown): string | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(amount)
    : null;
}

function bytes(value: unknown): string {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function initial(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name)?.trim() || null;
}

function initialTab(): Tab {
  const value = initial("tab") || "";
  return TABS.some((tab) => tab.id === value) ? (value as Tab) : "overview";
}

function title(home: HomeRow | null): string {
  return String(home?.nickname || home?.address1 || "Untitled HomeID").trim();
}

function location(home: HomeRow | null): string {
  const locality = [home?.city, home?.stateCode].filter(Boolean).join(", ");
  return [home?.address1, home?.address2, locality, home?.zipCode].filter(Boolean).join(" · ");
}

function homeType(value: unknown): string {
  return HOME_TYPES.find(([key]) => key === value)?.[1] || human(value || "Property");
}

function uid(prefix: string): string {
  return `${prefix}_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function tone(status: string): string {
  if (["known", "verified", "ready_for_handoff", "active"].includes(status)) {
    return "border-emerald-400/[0.25] bg-emerald-400/[0.10] text-emerald-300";
  }
  if (["needs_review", "needs_info", "pending", "planning"].includes(status)) {
    return "border-amber-400/[0.25] bg-amber-400/[0.10] text-amber-200";
  }
  return "border-white/[0.10] bg-white/[0.04] text-white/[0.55]";
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Pill({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.11em] ${tone(status)}`}>
      <CircleDot className="h-3 w-3" />
      {label || human(status)}
    </span>
  );
}

function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-[210px] place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-black/[0.14] p-6 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-400/[0.10] text-orange-300">{icon}</div>
        <h3 className="mt-4 font-black text-white">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/[0.50]">{text}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

export default function HomeIdWorkspace() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLTextAreaElement>(null);

  const [homeId, setHomeId] = useState<string | null>(() => initial("homeId"));
  const [projectId] = useState<string | null>(() => initial("projectId"));
  const [tab, setTab] = useState<Tab>(() => initialTab());
  const [newHomeOpen, setNewHomeOpen] = useState(false);

  const [newHome, setNewHome] = useState({
    nickname: "",
    homeType: "new_build",
    address1: "",
    city: "",
    stateCode: "",
    zipCode: "",
  });
  const [detail, setDetail] = useState({
    category: "other",
    note: "",
    status: "known" as "known" | "needs_review",
  });
  const [docType, setDocType] = useState("other");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [timeline, setTimeline] = useState({
    recordType: "note",
    occurredAt: "",
    title: "",
    details: "",
  });
  const [schedule, setSchedule] = useState({ title: "", cadenceDays: "90", nextDueAt: "" });
  const [requestType, setRequestType] = useState("documentation");
  const [selectedDetailIds, setSelectedDetailIds] = useState<string[]>([]);

  const homesQuery = useQuery({ queryKey: ["/api/homes"] });
  const homes = list<HomeRow>(record(homesQuery.data).homes);

  useEffect(() => {
    if (!homeId && homes.length) setHomeId(String(homes[0].id || "") || null);
  }, [homeId, homes]);

  useEffect(() => {
    if (!homeId || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("homeId", homeId);
    tab === "overview" ? url.searchParams.delete("tab") : url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [homeId, tab]);

  const detailQuery = useQuery({
    queryKey: [homeId ? `/api/homes/${homeId}` : "/api/homes/_none"],
    enabled: Boolean(homeId),
  });
  const persistenceQuery = useQuery({
    queryKey: [homeId ? `/api/homeid/${homeId}/persistence` : "/api/homeid/_none/persistence"],
    enabled: Boolean(homeId),
  });
  const projectsQuery = useQuery({
    queryKey: [homeId ? `/api/homes/${homeId}/projects` : "/api/homes/_none/projects"],
    enabled: Boolean(homeId),
  });
  const schedulesQuery = useQuery({
    queryKey: [homeId ? `/api/homes/${homeId}/maintenance-schedules` : "/api/homes/_none/maintenance-schedules"],
    enabled: Boolean(homeId),
  });

  const detailData = record(detailQuery.data);
  const selectedHome =
    (detailData.home as HomeRow | undefined) ||
    homes.find((item) => String(item.id || "") === homeId) ||
    null;
  const records = list<HomeRecord>(detailData.records).filter(
    (item) => !String(item.title || "").startsWith("homeid:")
  );
  const documents = list<HomeDocument>(detailData.documents);
  const appliances = list<any>(detailData.appliances);

  const persistence = record(record(persistenceQuery.data).persistence);
  const facts = list<HomeIdPropertyDetail>(persistence.propertyDetails);
  const packets = list<HomeIdRequestPacket>(persistence.requestPackets);
  const components = list<Component>(persistence.components);
  const evidence = list<Evidence>(persistence.evidence);

  const projects = list<HomeProject>(record(projectsQuery.data).projects);
  const project =
    projects.find((item) => String(item.id || "") === projectId) || projects[0] || null;
  const projectMeta = record(project?.metadata);
  const schedules = list<HomeSchedule>(record(schedulesQuery.data).schedules);

  const known = facts.filter((item) => item.status === "known");
  const review = facts.filter((item) => item.status === "needs_review");
  const homeIdFirstTaskPrompt = useMemo(
    () =>
      resolveHomeIdFirstUseTaskPrompt({
        hasSelectedHome: Boolean(homeId),
        knownDetailsCount: known.length,
        hasComponentLikeDetail: known.length > 0,
      }),
    [homeId, known.length]
  );
  const missing = Array.from(
    new Set([
      ...list<string>(projectMeta.requiredNextInputs),
      ...packets.flatMap((packet) => list<string>(packet.missingHelpfulInfo)),
    ])
  ).filter(Boolean);
  const missingCount = Math.max(
    missing.length,
    ...packets.map((packet) => Number(packet.missingHelpfulInfoCount || 0)),
    0
  );
  const propertyLocation = location(selectedHome);
  const propertyAssigned = Boolean(propertyLocation);
  const currentStage = propertyAssigned ? "Design and property screening" : "Preconstruction";

  useEffect(() => {
    if (!homeId) return;
    trackFirstUseGuidanceViewed("homes", "authenticated");
    trackFirstUseTaskPromptViewed({
      surface: "homes",
      promptMessage: homeIdFirstTaskPrompt.message,
      ctaLabel: homeIdFirstTaskPrompt.ctaLabel,
      userState: "authenticated",
    });
  }, [homeId, homeIdFirstTaskPrompt.ctaLabel, homeIdFirstTaskPrompt.message]);

  const refresh = async () => {
    if (!homeId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/homes"] }),
      queryClient.invalidateQueries({ queryKey: [`/api/homes/${homeId}`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/homeid/${homeId}/persistence`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/homes/${homeId}/projects`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/homes/${homeId}/maintenance-schedules`] }),
    ]);
  };

  const fail = (name: string, error: any) =>
    toast({
      title: name,
      description: formatUserFacingErrorMessage(error, "Try again."),
      variant: "destructive",
    });

  const createHome = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/homeid/create", {
        nickname: newHome.nickname.trim() || undefined,
        homeType: newHome.homeType,
        creatorRole: "homeowner",
        address1: newHome.address1.trim() || undefined,
        city: newHome.city.trim() || undefined,
        stateCode: newHome.stateCode.trim().toUpperCase() || undefined,
        zipCode: newHome.zipCode.trim() || undefined,
      }),
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/homes"] });
      const id = String(data?.home?.id || "");
      if (id) setHomeId(id);
      setNewHomeOpen(false);
      toast({ title: "HomeID created" });
    },
    onError: (error: any) => fail("Could not create HomeID", error),
  });

  const saveFact = useMutation({
    mutationFn: () => {
      if (!homeId || !detail.note.trim()) throw new Error("Add the property fact first");
      const now = new Date().toISOString();
      const next: HomeIdPropertyDetail = {
        id: uid("detail"),
        category: detail.category,
        note: detail.note.trim(),
        status: detail.status,
        createdAt: now,
        savedAt: now,
      };
      return apiRequest("PUT", `/api/homeid/${homeId}/property-details`, {
        propertyDetails: [next, ...facts],
      });
    },
    onSuccess: async () => {
      setDetail({ category: "other", note: "", status: "known" });
      await refresh();
      toast({ title: "Property fact saved" });
    },
    onError: (error: any) => fail("Could not save property fact", error),
  });

  const uploadDoc = useMutation({
    mutationFn: async () => {
      if (!homeId || !docFile) throw new Error("Choose a file first");
      const { objectKey } = await uploadPrivateObject(docFile);
      return apiRequest("POST", `/api/homes/${homeId}/documents`, {
        documentType: docType,
        objectKey,
        originalName: docFile.name,
        contentType: docFile.type || "application/octet-stream",
        bytes: docFile.size,
      });
    },
    onSuccess: async () => {
      setDocFile(null);
      setDocType("other");
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
      toast({ title: "Document added to HomeID" });
    },
    onError: (error: any) => fail("Document upload failed", error),
  });

  const saveTimeline = useMutation({
    mutationFn: () => {
      if (!homeId || !timeline.title.trim()) throw new Error("Add a timeline title");
      return apiRequest("POST", `/api/homes/${homeId}/records`, {
        recordType: timeline.recordType,
        occurredAt: timeline.occurredAt || undefined,
        title: timeline.title.trim(),
        details: timeline.details.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setTimeline({ recordType: "note", occurredAt: "", title: "", details: "" });
      await refresh();
      toast({ title: "Timeline event saved" });
    },
    onError: (error: any) => fail("Could not save timeline event", error),
  });

  const saveSchedule = useMutation({
    mutationFn: () => {
      if (!homeId || !schedule.title.trim()) throw new Error("Add a maintenance item");
      return apiRequest("POST", `/api/homes/${homeId}/maintenance-schedules`, {
        title: schedule.title.trim(),
        cadenceDays: Number.parseInt(schedule.cadenceDays, 10),
        nextDueAt: schedule.nextDueAt || undefined,
      });
    },
    onSuccess: async () => {
      setSchedule({ title: "", cadenceDays: "90", nextDueAt: "" });
      await refresh();
      toast({ title: "Maintenance schedule created" });
    },
    onError: (error: any) => fail("Could not create schedule", error),
  });

  const savePacket = useMutation({
    mutationFn: () => {
      if (!homeId || !selectedDetailIds.length) throw new Error("Choose at least one HomeID fact");
      const now = new Date().toISOString();
      const packet: HomeIdRequestPacket = {
        id: uid("packet"),
        requestType,
        selectedDetailIds,
        missingHelpfulInfo: missing.slice(0, 15),
        missingHelpfulInfoCount: Math.min(15, missing.length),
        status: missing.length ? "needs_info" : "ready_for_handoff",
        createdAt: now,
        savedAt: now,
      };
      return apiRequest("PUT", `/api/homeid/${homeId}/request-packets`, {
        requestPackets: [packet, ...packets],
      });
    },
    onSuccess: async () => {
      setSelectedDetailIds([]);
      await refresh();
      toast({ title: "Request details saved" });
    },
    onError: (error: any) => fail("Could not save request details", error),
  });

  const openProperty = () => {
    setTab("property");
    setDetail((current) => ({ ...current, category: "permits_documents", status: "needs_review" }));
    window.setTimeout(() => detailRef.current?.focus(), 60);
  };

  const openDocs = () => {
    setTab("documents");
    window.setTimeout(() => fileRef.current?.click(), 60);
  };

  const openRequest = (packetId?: string) => {
    if (!homeId) return;
    const params = new URLSearchParams({
      homeId,
      homeContextIntent: "update_from_request",
    });
    if (packetId) params.set("homePacketId", packetId);
    navigate(`/direct-connect?${params.toString()}`);
  };

  const openFirstTask = () => {
    const targetTab: Tab =
      homeIdFirstTaskPrompt.ctaLabel === "Create request details" ? "requests" : "property";
    const targetRoute = `/homes?homeId=${encodeURIComponent(String(homeId || ""))}&tab=${targetTab}`;
    trackFirstUseTaskPromptClicked({
      surface: "homes",
      promptMessage: homeIdFirstTaskPrompt.message,
      ctaLabel: homeIdFirstTaskPrompt.ctaLabel,
      targetRoute,
      userState: "authenticated",
    });
    if (targetTab === "requests") {
      setTab("requests");
      return;
    }
    openProperty();
  };

  if (!homeId && !homesQuery.isLoading && homes.length === 0) {
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-[35] grid place-items-center overflow-y-auto p-5 text-white"
        style={{
          top: "var(--top-nav-h, 56px)",
          background:
            "radial-gradient(circle at 20% 10%, rgba(249,115,22,.13), transparent 34%), var(--surface-app-bg, #07090b)",
        }}
        data-testid="homeid-workspace"
      >
        <div className={`${PANEL} w-full max-w-3xl p-8`}>
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-500 text-black">
            <Home className="h-7 w-7" />
          </div>
          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">HomeID</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            Start the property record before the paperwork scatters.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/[0.58]">
            One private source of truth for the property, build, systems, documents, service
            history, and eventual transfer.
          </p>
          <Button className={`mt-7 ${PRIMARY}`} onClick={() => setNewHomeOpen(true)}>
            Create HomeID
          </Button>
        </div>
        {newHomeOpen ? (
          <NewHome
            state={newHome}
            setState={setNewHome}
            close={() => setNewHomeOpen(false)}
            create={() => createHome.mutate()}
            pending={createHome.isPending}
          />
        ) : null}
      </div>
    );
  }

  const loading =
    homesQuery.isLoading ||
    (Boolean(homeId) &&
      (detailQuery.isLoading || persistenceQuery.isLoading || projectsQuery.isLoading));

  const stats = [
    ["Planning facts", facts.length, `${known.length} known · ${review.length} need review`, "property", <Database className="h-5 w-5" />],
    ["Package systems", components.length, `${components.filter((item) => COVERED.has(item.type)).length} relationships covered`, "systems", <Layers3 className="h-5 w-5" />],
    ["Decisions needed", missingCount, missingCount ? "Blocking the next release gate" : "No major gap detected", "overview", <ClipboardList className="h-5 w-5" />],
    ["Source records", evidence.length + documents.length, `${evidence.length} references · ${documents.length} stored files`, "documents", <FileCheck2 className="h-5 w-5" />],
  ] as const;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[35] flex flex-col overflow-hidden text-white"
      style={{
        top: "var(--top-nav-h, 56px)",
        background:
          "radial-gradient(circle at 10% 0%, rgba(249,115,22,.09), transparent 30%), radial-gradient(circle at 92% 5%, rgba(14,165,233,.07), transparent 28%), var(--surface-app-bg, #07090b)",
      }}
      data-testid="homeid-workspace"
    >
      <header className="flex-none border-b border-white/[0.08] bg-black/[0.24] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-500 text-black">
              <Home className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-300">HomeID</p>
              <p className="truncate text-sm font-black">{title(selectedHome)}</p>
            </div>
          </div>
          {homes.length > 1 ? (
            <Select value={homeId || ""} onValueChange={setHomeId}>
              <SelectTrigger className={`h-10 min-w-[220px] ${INPUT}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {homes.map((home) => (
                  <SelectItem key={String(home.id)} value={String(home.id)}>
                    {title(home)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button variant="outline" className={SECONDARY} onClick={() => setNewHomeOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New HomeID
          </Button>
        </div>
      </header>

      <section className="flex-none border-b border-white/[0.08]">
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill
                  status={missingCount ? "needs_info" : "known"}
                  label={missingCount ? "Needs information" : "Ready for next gate"}
                />
                <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.11em] text-white/[0.55]">
                  {currentStage}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-black leading-none tracking-[-0.055em] sm:text-4xl lg:text-5xl">
                {title(selectedHome)}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/[0.55]">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-orange-300" />
                  {homeType(selectedHome?.propertyType)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-orange-300" />
                  {propertyLocation || "Property not assigned"}
                </span>
                {project?.status ? (
                  <span className="inline-flex items-center gap-1.5">
                    <HardHat className="h-4 w-4 text-orange-300" />
                    {human(project.status)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button variant="outline" className={SECONDARY} onClick={openProperty}>
                <MapPin className="mr-2 h-4 w-4" />
                Add Property
              </Button>
              <Button variant="outline" className={SECONDARY} onClick={openDocs}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents
              </Button>
              <Button variant="outline" className={SECONDARY} onClick={() => setTab("build")}>
                <Hammer className="mr-2 h-4 w-4" />
                Continue Planning
              </Button>
              <Button className={PRIMARY} onClick={() => openRequest()}>
                Start a Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(([label, value, note, target, icon]) => (
              <button
                key={label}
                type="button"
                className="rounded-2xl border border-white/[0.09] bg-white/[0.032] p-4 text-left transition hover:-translate-y-0.5 hover:border-orange-400/[0.25]"
                onClick={() => setTab(target)}
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-400/[0.10] text-orange-300">{icon}</span>
                  <span className="text-3xl font-black tracking-[-0.04em]">{value}</span>
                </div>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.13em] text-white/[0.75]">{label}</p>
                <p className="mt-1 text-xs leading-5 text-white/[0.40]">{note}</p>
              </button>
            ))}
          </div>
          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/[0.18] bg-orange-400/[0.055] px-4 py-3"
            data-testid="homeid-first-task-prompt"
          >
            <p className="text-sm font-semibold text-white/[0.72]">
              {homeIdFirstTaskPrompt.message}
            </p>
            <Button variant="outline" className={SECONDARY} onClick={openFirstTask}>
              {homeIdFirstTaskPrompt.ctaLabel}
            </Button>
          </div>
        </div>
      </section>

      <nav className="flex-none border-b border-white/[0.08] bg-black/[0.16]">
        <div className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-4 py-2 sm:px-6">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-10 flex-none rounded-full px-4 text-xs font-black transition ${
                tab === item.id
                  ? "bg-orange-500 text-black"
                  : "text-white/[0.52] hover:bg-white/[0.055] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-[1500px] px-4 py-5 pb-28 sm:px-6 lg:pb-10">
          {loading ? (
            <div className="grid min-h-[460px] place-items-center">
              <div className="text-center">
                <RefreshCw className="mx-auto h-7 w-7 animate-spin text-orange-300" />
                <p className="mt-3 text-sm text-white/[0.50]">Loading the property record…</p>
              </div>
            </div>
          ) : tab === "overview" ? (
            <Overview
              propertyAssigned={propertyAssigned}
              missing={missing}
              components={components}
              evidence={evidence}
              projectMeta={projectMeta}
              openProperty={openProperty}
              openSystems={() => setTab("systems")}
              openDocuments={() => setTab("documents")}
            />
          ) : tab === "property" ? (
            <Property
              home={selectedHome}
              known={known}
              review={review}
              detail={detail}
              setDetail={setDetail}
              detailRef={detailRef}
              save={() => saveFact.mutate()}
              pending={saveFact.isPending}
            />
          ) : tab === "build" ? (
            <Build
              project={project}
              metadata={projectMeta}
              missing={missing}
              homeId={homeId}
              openProperty={openProperty}
            />
          ) : tab === "systems" ? (
            <Systems components={components} />
          ) : tab === "documents" ? (
            <Documents
              documents={documents}
              evidence={evidence}
              fileRef={fileRef}
              docType={docType}
              setDocType={setDocType}
              docFile={docFile}
              setDocFile={setDocFile}
              upload={() => uploadDoc.mutate()}
              pending={uploadDoc.isPending}
            />
          ) : tab === "timeline" ? (
            <Timeline
              records={records}
              state={timeline}
              setState={setTimeline}
              save={() => saveTimeline.mutate()}
              pending={saveTimeline.isPending}
            />
          ) : tab === "maintenance" ? (
            <Maintenance
              schedules={schedules}
              appliances={appliances}
              state={schedule}
              setState={setSchedule}
              save={() => saveSchedule.mutate()}
              pending={saveSchedule.isPending}
            />
          ) : tab === "requests" ? (
            <Requests
              facts={facts}
              packets={packets}
              requestType={requestType}
              setRequestType={setRequestType}
              selected={selectedDetailIds}
              setSelected={setSelectedDetailIds}
              missing={missing}
              save={() => savePacket.mutate()}
              open={openRequest}
              pending={savePacket.isPending}
            />
          ) : (
            <Sale
              homeId={homeId}
              propertyAssigned={propertyAssigned}
              evidenceCount={evidence.length + documents.length}
              missingCount={missingCount}
              openProperty={openProperty}
              openDocuments={() => setTab("documents")}
              openRequest={() => openRequest()}
            />
          )}
        </div>
      </main>

      {newHomeOpen ? (
        <NewHome
          state={newHome}
          setState={setNewHome}
          close={() => setNewHomeOpen(false)}
          create={() => createHome.mutate()}
          pending={createHome.isPending}
        />
      ) : null}
    </div>
  );
}

function Overview({
  propertyAssigned,
  missing,
  components,
  evidence,
  projectMeta,
  openProperty,
  openSystems,
  openDocuments,
}: {
  propertyAssigned: boolean;
  missing: string[];
  components: Component[];
  evidence: Evidence[];
  projectMeta: Record<string, any>;
  openProperty: () => void;
  openSystems: () => void;
  openDocuments: () => void;
}) {
  const coverage = [
    ...components.filter((item) => COVERED.has(item.type)).map((item) => item.label),
    ...Object.keys(record(projectMeta.currentCoverage)).map(human),
    "TradeScout professional network",
  ].filter((item, index, all) => item && all.indexOf(item) === index);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.75fr)]">
      <div className="space-y-5">
        <Panel
          eyebrow="Current stage"
          title={propertyAssigned ? "Design and property screening" : "Preconstruction"}
          action={<Pill status={missing.length ? "needs_info" : "known"} label={missing.length ? "Needs information" : "Ready for next gate"} />}
        >
          <p className="max-w-3xl text-sm leading-6 text-white/[0.55]">
            This HomeID organizes the property, package, source records, open decisions, and
            handoff without pretending the final design or jurisdiction approval already exists.
          </p>
          <div className="mt-6 overflow-x-auto pb-2">
            <div className="flex min-w-[720px] items-start">
              {STAGES.map((stage, index) => (
                <div key={stage} className="flex flex-1 items-start">
                  <div className="flex min-w-[78px] flex-col items-center text-center">
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-full border ${
                        index === (propertyAssigned ? 1 : 0)
                          ? "border-orange-400 bg-orange-500 font-black text-black"
                          : index < (propertyAssigned ? 1 : 0)
                            ? "border-emerald-400/[0.40] bg-emerald-400/[0.15] text-emerald-300"
                            : "border-white/[0.12] bg-white/[0.035] text-white/[0.35]"
                      }`}
                    >
                      {index < (propertyAssigned ? 1 : 0) ? <Check className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className="mt-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/[0.42]">{stage}</span>
                  </div>
                  {index < STAGES.length - 1 ? <span className="mt-4 h-px flex-1 bg-white/[0.10]" /> : null}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel
            eyebrow="Already covered"
            title="Package relationships in place"
            action={<Button variant="ghost" className="text-orange-300" onClick={openSystems}>View systems</Button>}
          >
            <div className="space-y-2">
              {(coverage.length ? coverage : ["Steel structure", "Roofing", "Cabinets", "Natural stone", "TradeScout professional network"]).slice(0, 7).map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-emerald-400/[0.12] bg-emerald-400/[0.04] px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span className="text-sm font-semibold text-white/[0.74]">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-white/[0.38]">
              Covered means a relationship or lane exists. Exact products, quantities, delivery,
              warranties, and property scope still require confirmation.
            </p>
          </Panel>

          <Panel
            eyebrow="Release gate"
            title="What must be decided next"
            action={<Button variant="ghost" className="text-orange-300" onClick={openProperty}>Add facts</Button>}
          >
            {missing.length ? (
              <ol className="space-y-2">
                {missing.slice(0, 7).map((item, index) => (
                  <li key={item} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-black/[0.15] px-3 py-2.5">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-400/[0.12] text-[10px] font-black text-orange-200">{index + 1}</span>
                    <span className="text-sm leading-5 text-white/[0.62]">{item}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty icon={<CheckCircle2 className="h-5 w-5" />} title="No major planning gaps detected" text="Review the property, engineering, supplier, payment, and inspection gates before final release." />
            )}
          </Panel>
        </div>
      </div>

      <div className="space-y-5">
        <Panel eyebrow="Readiness" title="What this record can support now">
          {[
            ["Organize the preconstruction package", true],
            ["Preserve source-backed planning facts", true],
            ["Track open systems and partners", true],
            ["Release a final property package", false],
            ["Claim permit or code approval", false],
          ].map(([label, ready]) => (
            <div key={String(label)} className="mb-3 flex items-start gap-3 last:mb-0">
              {ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />}
              <span className="text-sm leading-5 text-white/[0.60]">{label}</span>
            </div>
          ))}
          {!propertyAssigned ? (
            <Button className={`mt-5 w-full ${PRIMARY}`} onClick={openProperty}>Assign the property first</Button>
          ) : null}
        </Panel>

        <Panel
          eyebrow="Evidence"
          title="Source-backed facts"
          action={<Button variant="ghost" className="text-orange-300" onClick={openDocuments}>Open records</Button>}
        >
          {evidence.length ? (
            <div className="space-y-3">
              {evidence.slice(0, 4).map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/[0.09] bg-black/[0.18] p-3.5">
                  <p className="text-sm font-black text-white/[0.80]">{item.title}</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-white/[0.42]">
                    {item.description || "Source record attached to this HomeID."}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Pill status={item.status} />
                    {!item.fileUrl ? (
                      <span className="rounded-full border border-white/[0.09] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.10em] text-white/[0.35]">Reference only</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty icon={<FileText className="h-5 w-5" />} title="No evidence records yet" text="Add plans, surveys, permits, receipts, warranties, and inspections when they become real." />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Property({
  home,
  known,
  review,
  detail,
  setDetail,
  detailRef,
  save,
  pending,
}: {
  home: HomeRow | null;
  known: HomeIdPropertyDetail[];
  review: HomeIdPropertyDetail[];
  detail: { category: string; note: string; status: "known" | "needs_review" };
  setDetail: React.Dispatch<React.SetStateAction<typeof detail>>;
  detailRef: React.RefObject<HTMLTextAreaElement>;
  save: () => void;
  pending: boolean;
}) {
  const identity = [
    ["Street address", home?.address1],
    ["City", home?.city],
    ["State", home?.stateCode],
    ["ZIP", home?.zipCode],
    ["County FIPS", home?.countyFips],
    ["Year built", home?.yearBuilt],
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Panel eyebrow="Property identity" title="Where this HomeID belongs">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {identity.map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/[0.35]">{label}</p>
                <p className={`mt-2 text-sm font-black ${value ? "text-white/[0.78]" : "text-amber-200/[0.80]"}`}>{value || "Not assigned"}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-2xl border border-amber-400/[0.18] bg-amber-400/[0.055] p-4 text-xs leading-5 text-amber-100/[0.72]">
            Add the address or parcel facts now. Final release still requires the legal
            description, survey, restrictions, jurisdiction, utilities, hazards, and applicable
            professional approvals.
          </p>
        </Panel>

        <Panel eyebrow="Add one fact" title="Update the property record">
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select value={detail.category} onValueChange={(value) => setDetail((current) => ({ ...current, category: value }))}>
                <SelectTrigger className={`mt-1 ${INPUT}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DETAIL_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{human(category)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Property fact</Label>
              <Textarea
                ref={detailRef}
                value={detail.note}
                onChange={(event) => setDetail((current) => ({ ...current, note: event.target.value }))}
                placeholder="Example: Parcel 123-456, city water at the road, survey dated May 14, 2026."
                className={`mt-1 min-h-28 ${INPUT}`}
              />
            </div>
            <div>
              <Label>Confidence</Label>
              <Select
                value={detail.status}
                onValueChange={(value) => setDetail((current) => ({ ...current, status: value === "needs_review" ? "needs_review" : "known" }))}
              >
                <SelectTrigger className={`mt-1 ${INPUT}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="known">Known and source-backed</SelectItem>
                  <SelectItem value="needs_review">Needs review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className={`w-full ${PRIMARY}`} onClick={save} disabled={pending || !detail.note.trim()}>Save property fact</Button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <FactList title={`Confirmed planning facts (${known.length})`} items={known} empty="No confirmed property facts yet." />
        <FactList title={`Needs confirmation (${review.length})`} items={review} empty="Nothing is waiting for review." />
      </div>
    </div>
  );
}

function FactList({
  title,
  items,
  empty,
}: {
  title: string;
  items: HomeIdPropertyDetail[];
  empty: string;
}) {
  return (
    <Panel title={title}>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-orange-300">{human(item.category)}</p>
                <Pill status={item.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-white/[0.68]">{item.note}</p>
            </article>
          ))}
        </div>
      ) : (
        <Empty icon={<Database className="h-5 w-5" />} title={empty} text="Add facts only when they are known or clearly marked for review." />
      )}
    </Panel>
  );
}

function Build({
  project,
  metadata,
  missing,
  homeId,
  openProperty,
}: {
  project: HomeProject | null;
  metadata: Record<string, any>;
  missing: string[];
  homeId: string | null;
  openProperty: () => void;
}) {
  if (!project) {
    return (
      <Empty
        icon={<HardHat className="h-5 w-5" />}
        title="No build project is attached"
        text="Start a build timeline when the property and project are ready to move beyond a general HomeID."
        action={
          <Button className={PRIMARY} onClick={() => (window.location.href = `/homes/build${homeId ? `?homeId=${encodeURIComponent(homeId)}` : ""}`)}>
            Start Build Timeline
          </Button>
        }
      />
    );
  }

  const coverage = record(metadata.currentCoverage);
  const unresolved = list<string>(metadata.unresolvedPackageLanes);
  const boundaries = list<string>(metadata.boundaries);

  return (
    <div className="space-y-5">
      <Panel eyebrow="Active build" title={project.title || "Build project"} action={<Pill status={String(project.status || "planning")} />}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <p className="text-sm leading-7 text-white/[0.60]">
            {project.description || "This project is still in planning. Property, design, engineering, package, and release gates remain visible."}
          </p>
          <dl className="rounded-2xl border border-white/[0.09] bg-black/[0.18] p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-white/[0.40]">Type</dt><dd className="font-black text-white/[0.72]">{human(project.projectType || "new_build")}</dd></div>
            <div className="mt-3 flex justify-between gap-3"><dt className="text-white/[0.40]">Target start</dt><dd className="font-black text-white/[0.72]">{date(project.desiredStartAt, "Not set")}</dd></div>
            <div className="mt-3 flex justify-between gap-3"><dt className="text-white/[0.40]">Budget</dt><dd className="font-black text-white/[0.72]">{money(project.estimatedCost) || "Not set"}</dd></div>
          </dl>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="Current coverage" title="Package lanes represented">
          {Object.keys(coverage).length ? (
            <div className="space-y-2">
              {Object.entries(coverage).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-emerald-400/[0.12] bg-emerald-400/[0.04] px-3 py-3">
                  <span className="text-sm font-bold text-white/[0.72]">{human(key)}</span>
                  <span className="text-[10px] font-black uppercase text-emerald-300">{human(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={<PackageCheck className="h-5 w-5" />} title="Coverage has not been classified" text="Add supplier lanes and exact scope before the project becomes order-ready." />
          )}
        </Panel>

        <Panel eyebrow="Open lanes" title="Package categories unresolved">
          <div className="grid gap-2 sm:grid-cols-2">
            {unresolved.map((item) => (
              <div key={item} className="rounded-xl border border-white/[0.09] bg-black/[0.15] px-3 py-3 text-sm text-white/[0.55]">{human(item)}</div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel eyebrow="Next gate" title="Required decisions before release">
          <ol className="grid gap-3 lg:grid-cols-2">
            {missing.map((item, index) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-400/[0.12] text-xs font-black text-orange-200">{index + 1}</span>
                <span className="text-sm leading-6 text-white/[0.62]">{item}</span>
              </li>
            ))}
          </ol>
          <Button variant="outline" className={`mt-5 ${SECONDARY}`} onClick={openProperty}>Add property facts</Button>
        </Panel>

        <Panel eyebrow="Boundaries" title="What this project does not claim">
          {(boundaries.length ? boundaries : [
            "No property-specific approval is represented.",
            "No final design, price, supplier order, permit, or schedule is represented.",
            "No installed equipment or warranty activation is represented.",
          ]).map((item) => (
            <div key={item} className="mb-3 flex items-start gap-3 last:mb-0">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-amber-300" />
              <p className="text-sm leading-6 text-white/[0.58]">{item}</p>
            </div>
          ))}
          <Button className={`mt-5 w-full ${PRIMARY}`} onClick={() => (window.location.href = `/homes/build${homeId ? `?homeId=${encodeURIComponent(homeId)}` : ""}`)}>
            Open Build Timeline
          </Button>
        </Panel>
      </div>
    </div>
  );
}

function Systems({ components }: { components: Component[] }) {
  const groups = [
    ["Structure & envelope", ["structural_system", "roofing", "windows_doors", "insulation"]],
    ["Property & site", ["site_foundation_utilities"]],
    ["Mechanical & utilities", ["hvac", "water_heater", "plumbing", "electrical_lighting"]],
    ["Interior package", ["cabinets", "natural_stone", "flooring", "appliances", "interior_finishes"]],
    ["Protection", ["warranty_protection"]],
    ["Plans & logistics", ["plans_engineering", "freight_logistics"]],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Relationship covered", components.filter((item) => COVERED.has(item.type)).length],
          ["Needs selection", components.filter((item) => item.status === "needs_review").length],
          ["Not yet defined", components.filter((item) => item.status === "unknown").length],
        ].map(([label, value]) => (
          <div key={String(label)} className={`${PANEL} p-4`}>
            <p className="text-3xl font-black text-white">{value}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.13em] text-white/[0.45]">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {groups.map(([name, types]) => {
          const items = components.filter((item) => (types as readonly string[]).includes(item.type));
          return (
            <Panel key={name} title={name}>
              {items.length ? (
                <div className="space-y-3">
                  {items.map((item) => {
                    const covered = COVERED.has(item.type);
                    return (
                      <article key={item.id} className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-black leading-5 text-white/[0.76]">{item.label}</p>
                          <Pill status={covered ? "known" : item.status} label={covered ? "Relationship covered" : undefined} />
                        </div>
                        <p className="mt-3 text-xs leading-5 text-white/[0.38]">
                          {covered
                            ? "A supplier or package lane exists. Product, quantity, delivery, and property scope still need confirmation."
                            : item.status === "needs_review"
                              ? "The lane is identified but the exact selection is not approved."
                              : "This package lane has not been defined yet."}
                        </p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty icon={<Wrench className="h-5 w-5" />} title="Nothing recorded here" text="Add the system when it becomes part of the property or package record." />
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function Documents({
  documents,
  evidence,
  fileRef,
  docType,
  setDocType,
  docFile,
  setDocFile,
  upload,
  pending,
}: {
  documents: HomeDocument[];
  evidence: Evidence[];
  fileRef: React.RefObject<HTMLInputElement>;
  docType: string;
  setDocType: (value: string) => void;
  docFile: File | null;
  setDocFile: (file: File | null) => void;
  upload: () => void;
  pending: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Panel eyebrow="Private storage" title="Upload a real property document">
        <div className="space-y-4">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className={INPUT}><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="block cursor-pointer rounded-2xl border border-dashed border-orange-400/[0.25] bg-orange-400/[0.045] p-5 text-center">
            <Upload className="mx-auto h-6 w-6 text-orange-300" />
            <p className="mt-3 text-sm font-black text-white/[0.75]">{docFile ? docFile.name : "Choose a file"}</p>
            <p className="mt-1 text-xs text-white/[0.38]">Plans, surveys, permits, inspections, receipts, manuals, photos, and warranties.</p>
            <input ref={fileRef} type="file" className="sr-only" onChange={(event) => setDocFile(event.target.files?.[0] || null)} />
          </label>
          <Button className={`w-full ${PRIMARY}`} onClick={upload} disabled={pending || !docFile}>Upload to HomeID</Button>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel eyebrow="Stored files" title={`Property documents (${documents.length})`}>
          {documents.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {documents.map((item) => (
                <article key={String(item.id)} className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/[0.10] text-emerald-300"><FileText className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white/[0.78]">{item.originalName || "HomeID document"}</p>
                      <p className="mt-1 text-xs text-white/[0.38]">{human(item.documentType)}{bytes(item.bytes) ? ` · ${bytes(item.bytes)}` : ""}</p>
                      <p className="mt-2 text-[10px] uppercase text-white/[0.28]">Added {date(item.createdAt)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty icon={<FolderOpen className="h-5 w-5" />} title="No files are stored yet" text="The planning sources currently appear as evidence references. Upload the actual file when it belongs in HomeID." />
          )}
        </Panel>

        <Panel eyebrow="Source record" title={`Evidence and references (${evidence.length})`}>
          <div className="space-y-3">
            {evidence.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white/[0.78]">{item.title}</p>
                    {item.fileName ? <p className="mt-1 text-xs font-semibold text-orange-200/[0.70]">{item.fileName}</p> : null}
                    <p className="mt-2 text-xs leading-5 text-white/[0.42]">{item.description || "Evidence attached to this HomeID."}</p>
                  </div>
                  <div className="flex gap-2">
                    <Pill status={item.status} />
                    <span className="rounded-full border border-white/[0.09] px-2.5 py-1 text-[9px] font-bold uppercase text-white/[0.35]">{item.fileUrl ? "Stored file" : "Reference only"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Timeline({
  records,
  state,
  setState,
  save,
  pending,
}: {
  records: HomeRecord[];
  state: { recordType: string; occurredAt: string; title: string; details: string };
  setState: React.Dispatch<React.SetStateAction<typeof state>>;
  save: () => void;
  pending: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
      <Panel eyebrow="Permanent history" title={`Property and project timeline (${records.length})`}>
        {records.length ? (
          <div className="relative ml-2 border-l border-white/[0.10] pl-6">
            {records.map((item, index) => (
              <article key={String(item.id || index)} className="relative pb-7 last:pb-0">
                <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-orange-400 bg-[#0b0d0f]" />
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/[0.09] px-2.5 py-1 text-[9px] font-black uppercase text-white/[0.45]">{human(item.recordType || "note")}</span>
                  <span className="text-[10px] font-bold uppercase text-white/[0.28]">{date(item.occurredAt || item.createdAt)}</span>
                </div>
                <h3 className="mt-2 font-black text-white/[0.80]">{item.title || "Timeline entry"}</h3>
                {item.details ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/[0.50]">{item.details}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <Empty icon={<Clock3 className="h-5 w-5" />} title="No visible timeline events" text="Add decisions, inspections, completed work, warranties, maintenance, and ownership events as they occur." />
        )}
      </Panel>

      <Panel eyebrow="Add event" title="Write the next permanent record">
        <div className="space-y-4">
          <Select value={state.recordType} onValueChange={(value) => setState((current) => ({ ...current, recordType: value }))}>
            <SelectTrigger className={INPUT}><SelectValue /></SelectTrigger>
            <SelectContent>{RECORD_TYPES.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={state.occurredAt} onChange={(event) => setState((current) => ({ ...current, occurredAt: event.target.value }))} className={INPUT} />
          <Input value={state.title} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} placeholder="Example: Survey completed" className={INPUT} />
          <Textarea value={state.details} onChange={(event) => setState((current) => ({ ...current, details: event.target.value }))} placeholder="What happened, who handled it, and what happens next?" className={`min-h-28 ${INPUT}`} />
          <Button className={`w-full ${PRIMARY}`} onClick={save} disabled={pending || !state.title.trim()}>Save timeline event</Button>
        </div>
      </Panel>
    </div>
  );
}

function Maintenance({
  schedules,
  appliances,
  state,
  setState,
  save,
  pending,
}: {
  schedules: HomeSchedule[];
  appliances: any[];
  state: { title: string; cadenceDays: string; nextDueAt: string };
  setState: React.Dispatch<React.SetStateAction<typeof state>>;
  save: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <Panel eyebrow="Preventive care" title={`Maintenance schedules (${schedules.length})`}>
          {schedules.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {schedules.map((item) => (
                <article key={String(item.id)} className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white/[0.78]">{item.title || "Maintenance item"}</p>
                      <p className="mt-1 text-xs text-white/[0.38]">Every {item.cadenceDays || 90} days</p>
                    </div>
                    <Pill status={String(item.status || "active")} />
                  </div>
                  <p className="mt-4 inline-flex items-center gap-2 text-xs text-white/[0.50]"><CalendarClock className="h-4 w-4 text-orange-300" />Next due {date(item.nextDueAt, "not scheduled")}</p>
                </article>
              ))}
            </div>
          ) : (
            <Empty icon={<CalendarClock className="h-5 w-5" />} title="No maintenance schedules yet" text="Schedules begin when real equipment, warranties, and occupancy dates exist." />
          )}
        </Panel>

        <Panel eyebrow="Create schedule" title="Add preventive maintenance">
          <div className="space-y-4">
            <Input value={state.title} onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))} placeholder="Example: Flush tankless water heater" className={INPUT} />
            <Select value={state.cadenceDays} onValueChange={(value) => setState((current) => ({ ...current, cadenceDays: value }))}>
              <SelectTrigger className={INPUT}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">6 months</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={state.nextDueAt} onChange={(event) => setState((current) => ({ ...current, nextDueAt: event.target.value }))} className={INPUT} />
            <Button className={`w-full ${PRIMARY}`} onClick={save} disabled={pending || !state.title.trim()}>Create schedule</Button>
          </div>
        </Panel>
      </div>

      <Panel eyebrow="Installed assets" title={`Appliances and equipment (${appliances.length})`}>
        {appliances.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {appliances.map((item) => (
              <article key={String(item.id)} className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
                <p className="text-[10px] font-black uppercase text-orange-300">{item.category || "Equipment"}</p>
                <p className="mt-2 text-sm font-black text-white/[0.78]">{[item.brand, item.model].filter(Boolean).join(" ") || "Details not added"}</p>
                <p className="mt-2 text-xs text-white/[0.38]">{item.serial ? `Serial ${item.serial}` : "Serial number not added"}</p>
              </article>
            ))}
          </div>
        ) : (
          <Empty icon={<Wrench className="h-5 w-5" />} title="No installed equipment yet" text="Do not create equipment records until a real product has been selected or installed." />
        )}
      </Panel>
    </div>
  );
}

function Requests({
  facts,
  packets,
  requestType,
  setRequestType,
  selected,
  setSelected,
  missing,
  save,
  open,
  pending,
}: {
  facts: HomeIdPropertyDetail[];
  packets: HomeIdRequestPacket[];
  requestType: string;
  setRequestType: (value: string) => void;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  missing: string[];
  save: () => void;
  open: (packetId?: string) => void;
  pending: boolean;
}) {
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  return (
    <div className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
      <Panel eyebrow="Prepare first" title="Build a request from HomeID facts">
        <div className="space-y-4">
          <Select value={requestType} onValueChange={setRequestType}>
            <SelectTrigger className={INPUT}><SelectValue /></SelectTrigger>
            <SelectContent>
              {["repair", "inspection", "quote", "maintenance", "documentation", "other"].map((type) => <SelectItem key={type} value={type}>{human(type)}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {facts.map((fact) => (
              <label key={fact.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected.includes(fact.id) ? "border-orange-400/[0.30] bg-orange-400/[0.065]" : "border-white/[0.09] bg-black/[0.15]"}`}>
                <input type="checkbox" checked={selected.includes(fact.id)} onChange={() => toggle(fact.id)} className="mt-1" />
                <span>
                  <span className="block text-[10px] font-black uppercase text-orange-200">{human(fact.category)}</span>
                  <span className="mt-1 line-clamp-3 block text-xs leading-5 text-white/[0.55]">{fact.note}</span>
                </span>
              </label>
            ))}
          </div>
          {missing.length ? (
            <p className="rounded-2xl border border-amber-400/[0.16] bg-amber-400/[0.045] p-3 text-xs leading-5 text-amber-100/[0.60]">
              {missing.length} planning inputs remain unresolved. HomeID will keep them visible.
            </p>
          ) : null}
          <Button className={`w-full ${PRIMARY}`} onClick={save} disabled={pending || !selected.length}>Save request details</Button>
        </div>
      </Panel>

      <Panel
        eyebrow="Saved packets"
        title={`Requests prepared from this HomeID (${packets.length})`}
        action={<Button className={PRIMARY} onClick={() => open()}>Start a Request</Button>}
      >
        {packets.length ? (
          <div className="space-y-3">
            {packets.map((packet) => (
              <article key={packet.id} className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white/[0.78]">{human(packet.requestType)} request</p>
                    <p className="mt-1 text-xs text-white/[0.38]">{packet.selectedDetailIds.length} facts attached · {packet.missingHelpfulInfoCount} missing inputs</p>
                    <p className="mt-2 text-[10px] uppercase text-white/[0.28]">Saved {date(packet.savedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill status={String(packet.status)} />
                    <Button variant="outline" className={SECONDARY} onClick={() => open(packet.id)}>Open in Direct Connect</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty icon={<ClipboardList className="h-5 w-5" />} title="No request details saved" text="Choose the HomeID facts that matter, save the packet, then carry that context into Direct Connect." />
        )}
      </Panel>
    </div>
  );
}

function Sale({
  homeId,
  propertyAssigned,
  evidenceCount,
  missingCount,
  openProperty,
  openDocuments,
  openRequest,
}: {
  homeId: string | null;
  propertyAssigned: boolean;
  evidenceCount: number;
  missingCount: number;
  openProperty: () => void;
  openDocuments: () => void;
  openRequest: () => void;
}) {
  const steps = [
    ["Build the living property record", "Keep plans, systems, warranties, inspections, maintenance, and improvements tied to the property.", evidenceCount > 0],
    ["Solve readiness gaps", "Use Direct Connect for repairs, inspections, photos, measurements, and documents.", missingCount === 0],
    ["Prepare the buyer-facing packet", "Choose which verified property facts and records should be shared.", false],
    ["Choose the sale path", "Direct, assisted, or agent-supported, with licensed professionals used where needed.", false],
  ] as const;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel eyebrow="HomeScout path" title="Sell from the property record, not scattered paperwork">
        <div className="space-y-3">
          {steps.map(([name, text, ready], index) => (
            <article key={name} className="flex items-start gap-4 rounded-2xl border border-white/[0.09] bg-black/[0.15] p-4">
              <span className={`grid h-9 w-9 place-items-center rounded-full border ${ready ? "border-emerald-400/[0.35] bg-emerald-400/[0.12] text-emerald-300" : "border-white/[0.10] bg-white/[0.035] text-white/[0.42]"}`}>
                {ready ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <div>
                <h3 className="text-sm font-black text-white/[0.78]">{name}</h3>
                <p className="mt-1 text-sm leading-6 text-white/[0.48]">{text}</p>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel eyebrow="Readiness" title="What should happen next">
          <div className="space-y-3">
            {!propertyAssigned ? <Button className={`w-full justify-between ${PRIMARY}`} onClick={openProperty}>Assign the property<ArrowRight className="h-4 w-4" /></Button> : null}
            <Button variant="outline" className={`w-full justify-between ${SECONDARY}`} onClick={openDocuments}>Review property records<ArrowRight className="h-4 w-4" /></Button>
            <Button variant="outline" className={`w-full justify-between ${SECONDARY}`} onClick={openRequest}>Fix a readiness gap<ArrowRight className="h-4 w-4" /></Button>
            <Button variant="outline" className={`w-full justify-between ${SECONDARY}`} onClick={() => (window.location.href = `/homescout/new${homeId ? `?homeId=${encodeURIComponent(homeId)}` : ""}`)}>Open HomeScout<ArrowRight className="h-4 w-4" /></Button>
          </div>
        </Panel>
        <Panel eyebrow="Professional boundary" title="The owner controls the path">
          <p className="text-sm leading-7 text-white/[0.55]">
            HomeScout helps organize sale preparation and property information. Real estate
            rules, disclosures, contracts, title, and closing requirements vary by state. Use
            licensed professionals when needed.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function NewHome({
  state,
  setState,
  close,
  create,
  pending,
}: {
  state: {
    nickname: string;
    homeType: string;
    address1: string;
    city: string;
    stateCode: string;
    zipCode: string;
  };
  setState: React.Dispatch<React.SetStateAction<typeof state>>;
  close: () => void;
  create: () => void;
  pending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/[0.75] backdrop-blur-sm" onClick={close} aria-label="Close new HomeID" />
      <section className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-white/[0.12] bg-[#111416] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.20em] text-orange-300">New HomeID</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Create the property passport</h2>
          </div>
          <button type="button" onClick={close} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.10] text-white/[0.55]"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-6 space-y-4">
          <Input value={state.nickname} onChange={(event) => setState((current) => ({ ...current, nickname: event.target.value }))} placeholder="Nickname" className={INPUT} />
          <Select value={state.homeType} onValueChange={(value) => setState((current) => ({ ...current, homeType: value }))}>
            <SelectTrigger className={INPUT}><SelectValue /></SelectTrigger>
            <SelectContent>{HOME_TYPES.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Input value={state.address1} onChange={(event) => setState((current) => ({ ...current, address1: event.target.value }))} placeholder="Street address or site — optional" className={INPUT} />
          <div className="grid gap-3 sm:grid-cols-[1fr_90px_110px]">
            <Input value={state.city} onChange={(event) => setState((current) => ({ ...current, city: event.target.value }))} placeholder="City" className={INPUT} />
            <Input value={state.stateCode} maxLength={2} onChange={(event) => setState((current) => ({ ...current, stateCode: event.target.value.toUpperCase() }))} placeholder="State" className={INPUT} />
            <Input value={state.zipCode} onChange={(event) => setState((current) => ({ ...current, zipCode: event.target.value }))} placeholder="ZIP" className={INPUT} />
          </div>
        </div>
        <div className="mt-7 flex justify-end gap-2">
          <Button variant="outline" className={SECONDARY} onClick={close}>Cancel</Button>
          <Button className={PRIMARY} onClick={create} disabled={pending}>Create HomeID</Button>
        </div>
      </section>
    </div>
  );
}
