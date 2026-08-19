import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BriefcaseBusiness,
  FileStack,
  Gavel,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
  AdminWorkspaceSubnav,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type AdminProjectRow = {
  project: {
    id: string;
    title: string;
    slug: string;
    countyFips: string;
    stateCode: string;
    status: string;
    campaignEnabled: boolean;
    createdAt: string;
  };
  bidsCount: number;
  docsCount: number;
};

type ProjectBidRow = {
  bid: {
    id: string;
    projectId: string;
    contractorId: string;
    amount: string;
    timelineDays?: number | null;
    proposal: string;
    status: "submitted" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
    createdAt: string;
  };
  contractor: {
    id: string;
    companyName: string;
    slug: string;
    verifiedLicensed?: boolean | null;
    verifiedInsured?: boolean | null;
  } | null;
  eligibility?: {
    isEligible: boolean;
    reason: "ok" | "missing_contractor" | "inactive" | "missing_license" | "missing_insurance";
    hasLicense: boolean;
    hasInsurance: boolean;
    isActive: boolean;
  };
};

type ProjectDetailPayload = {
  project: {
    id: string;
    title: string;
    slug: string;
    summary: string;
    scopeOfWork: string;
    requirements: string;
    countyFips: string;
    stateCode: string;
    status: string;
    campaignEnabled: boolean;
    budgetMin?: string | null;
    budgetMax?: string | null;
    bidDueAt?: string | null;
  };
  documents: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
    fileSizeBytes?: number | null;
    createdAt?: string;
  }>;
  bidsCount: number;
};

type PendingVerificationDocRow = {
  document: {
    id: string;
    contractorId: string;
    type: "license" | "insurance" | string;
    fileName: string;
    fileUrl: string;
    status: string;
    createdAt?: string;
  };
  contractor: {
    id: string;
    companyName: string;
    slug: string;
    verifiedLicensed?: boolean | null;
    verifiedInsured?: boolean | null;
  } | null;
};

type ProjectForm = {
  title: string;
  summary: string;
  scopeOfWork: string;
  requirements: string;
  countyFips: string;
  stateCode: string;
  budgetMin: string;
  budgetMax: string;
  bidDueAt: string;
  projectStartAt: string;
  campaignEnabled: boolean;
  campaignHeadline: string;
  campaignBody: string;
  heroImageUrl: string;
};

function emptyProjectForm(): ProjectForm {
  return {
    title: "",
    summary: "",
    scopeOfWork: "",
    requirements: "",
    countyFips: "",
    stateCode: "",
    budgetMin: "",
    budgetMax: "",
    bidDueAt: "",
    projectStartAt: "",
    campaignEnabled: false,
    campaignHeadline: "",
    campaignBody: "",
    heroImageUrl: "",
  };
}

function readable(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "Not recorded";
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}

function renderBudget(min?: string | null, max?: string | null): string {
  const minimum = min ? Number(min).toLocaleString() : null;
  const maximum = max ? Number(max).toLocaleString() : null;
  if (minimum && maximum) return `$${minimum} – $${maximum}`;
  if (minimum) return `From $${minimum}`;
  if (maximum) return `Up to $${maximum}`;
  return "Budget on request";
}

function eligibilityReason(
  reason: "ok" | "missing_contractor" | "inactive" | "missing_license" | "missing_insurance"
): string {
  if (reason === "missing_contractor") return "Provider profile missing";
  if (reason === "inactive") return "Provider is inactive";
  if (reason === "missing_license") return "License verification missing";
  if (reason === "missing_insurance") return "Insurance verification missing";
  return "Eligible";
}

function ProjectStatusBadge({ status }: { status: string }) {
  if (status === "open") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">Open</Badge>
    );
  }
  if (status === "awarded") {
    return <Badge className="border-sky-400/25 bg-sky-400/10 text-sky-200">Awarded</Badge>;
  }
  if (status === "closed") {
    return <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">Closed</Badge>;
  }
  return (
    <Badge className="border-white/15 bg-white/5 text-white/52">{readable(status)}</Badge>
  );
}

function BidStatusBadge({ status }: { status: ProjectBidRow["bid"]["status"] }) {
  if (status === "accepted") {
    return <Badge className="border-sky-400/25 bg-sky-400/10 text-sky-200">Accepted</Badge>;
  }
  if (status === "shortlisted") {
    return <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-100">Shortlisted</Badge>;
  }
  if (status === "rejected") {
    return <Badge className="border-red-400/25 bg-red-400/10 text-red-100">Rejected</Badge>;
  }
  return (
    <Badge className="border-white/15 bg-white/5 text-white/52">{readable(status)}</Badge>
  );
}

export default function AdminCommercialDirectoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("projects");
  const [files, setFiles] = useState<File[]>([]);
  const [addendaFiles, setAddendaFiles] = useState<File[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedVerificationDocId, setSelectedVerificationDocId] = useState("");
  const [statusControl, setStatusControl] = useState("open");
  const [campaignControl, setCampaignControl] = useState(false);
  const [bidStatusFilter, setBidStatusFilter] = useState("all");
  const [form, setForm] = useState<ProjectForm>(emptyProjectForm);

  const projectsQuery = useQuery<AdminProjectRow[]>({
    queryKey: ["/api/admin/commercial-directory/projects"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/commercial-directory/projects") as Promise<AdminProjectRow[]>,
    retry: false,
  });

  const verificationQuery = useQuery<PendingVerificationDocRow[]>({
    queryKey: ["/api/admin/commercial-directory/verification/pending"],
    queryFn: () =>
      apiRequest(
        "GET",
        "/api/admin/commercial-directory/verification/pending"
      ) as Promise<PendingVerificationDocRow[]>,
    retry: false,
  });

  const detailQuery = useQuery<ProjectDetailPayload>({
    queryKey: ["/api/commercial-directory/projects/detail", selectedProjectId],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/commercial-directory/projects/${selectedProjectId}`
      ) as Promise<ProjectDetailPayload>,
    enabled: Boolean(selectedProjectId),
    retry: false,
  });

  const bidsQuery = useQuery<ProjectBidRow[]>({
    queryKey: ["/api/admin/commercial-directory/projects/bids", selectedProjectId],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/admin/commercial-directory/projects/${selectedProjectId}/bids`
      ) as Promise<ProjectBidRow[]>,
    enabled: Boolean(selectedProjectId),
    retry: false,
  });

  useEffect(() => {
    if (!selectedProjectId && projectsQuery.data?.length) {
      setSelectedProjectId(projectsQuery.data[0].project.id);
    }
  }, [projectsQuery.data, selectedProjectId]);

  useEffect(() => {
    if (!detailQuery.data?.project) return;
    setStatusControl(detailQuery.data.project.status || "open");
    setCampaignControl(Boolean(detailQuery.data.project.campaignEnabled));
  }, [detailQuery.data]);

  useEffect(() => {
    const documents = verificationQuery.data || [];
    if (!documents.length) {
      setSelectedVerificationDocId("");
      return;
    }
    if (!documents.some((row) => row.document.id === selectedVerificationDocId)) {
      setSelectedVerificationDocId(documents[0].document.id);
    }
  }, [selectedVerificationDocId, verificationQuery.data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (typeof value === "boolean") {
          payload.append(key, String(value));
        } else if (value.trim()) {
          payload.append(key, value.trim());
        }
      });
      files.forEach((file) => payload.append("files", file));

      const response = await fetch("/api/admin/commercial-directory/projects", {
        method: "POST",
        credentials: "include",
        body: payload,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || "Failed to create project");
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commercial-directory/projects"] });
      setFiles([]);
      setForm(emptyProjectForm());
      if (result?.project?.id) setSelectedProjectId(String(result.project.id));
      setActiveTab("projects");
      toast({
        title: "Commercial project created",
        description: result?.landingUrl
          ? `Landing generated: ${result.landingUrl}`
          : "The project package was created.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Create failed",
        description: formatUserFacingErrorMessage(error, "Please review the project package."),
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: () => {
      if (!selectedProjectId) throw new Error("Select a project");
      return apiRequest("PUT", `/api/admin/commercial-directory/projects/${selectedProjectId}`, {
        status: statusControl,
        campaignEnabled: campaignControl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commercial-directory/projects"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/commercial-directory/projects/detail", selectedProjectId],
      });
      toast({ title: "Project controls updated" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Update failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const addendaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error("Select a project first");
      if (!addendaFiles.length) throw new Error("Select at least one file");

      const payload = new FormData();
      addendaFiles.forEach((file) => payload.append("files", file));
      const response = await fetch(
        `/api/admin/commercial-directory/projects/${selectedProjectId}/documents`,
        { method: "POST", credentials: "include", body: payload }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || "Failed to upload addenda");
      return result;
    },
    onSuccess: () => {
      setAddendaFiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commercial-directory/projects"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/commercial-directory/projects/detail", selectedProjectId],
      });
      toast({ title: "Addenda uploaded" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Upload failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const bidActionMutation = useMutation({
    mutationFn: ({ bidId, action }: { bidId: string; action: "shortlist" | "reject" | "accept" }) => {
      if (!selectedProjectId) throw new Error("Select a project");
      return apiRequest(
        "PUT",
        `/api/admin/commercial-directory/projects/${selectedProjectId}/bids/${bidId}`,
        { action }
      );
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commercial-directory/projects"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/commercial-directory/projects/bids", selectedProjectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/commercial-directory/projects/detail", selectedProjectId],
      });
      toast({
        title: "Bid adjudicated",
        description:
          variables.action === "accept"
            ? "The bid was accepted and the project moved to awarded."
            : `The bid was marked ${variables.action}.`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Bid action failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const reviewVerificationMutation = useMutation({
    mutationFn: ({ documentId, approved }: { documentId: string; approved: boolean }) =>
      apiRequest(
        "POST",
        `/api/admin/commercial-directory/verification/documents/${documentId}/review`,
        { approved }
      ),
    onSuccess: (_result, variables) => {
      const documents = verificationQuery.data || [];
      const index = documents.findIndex((row) => row.document.id === variables.documentId);
      setSelectedVerificationDocId(
        documents[index + 1]?.document.id || documents[index - 1]?.document.id || ""
      );
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/commercial-directory/verification/pending"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/commercial-directory/projects/bids"],
      });
      toast({ title: "Verification reviewed" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Review failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const handleKeyboardReview = (event: KeyboardEvent) => {
      if (
        activeTab !== "verification" ||
        !selectedVerificationDocId ||
        reviewVerificationMutation.isPending
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key !== "a" && key !== "r") return;
      event.preventDefault();
      reviewVerificationMutation.mutate({
        documentId: selectedVerificationDocId,
        approved: key === "a",
      });
    };
    window.addEventListener("keydown", handleKeyboardReview);
    return () => window.removeEventListener("keydown", handleKeyboardReview);
  }, [activeTab, reviewVerificationMutation, selectedVerificationDocId]);

  const canSubmit = useMemo(
    () =>
      form.title.trim().length >= 3 &&
      form.summary.trim().length >= 10 &&
      form.scopeOfWork.trim().length >= 10 &&
      form.requirements.trim().length >= 10 &&
      form.countyFips.trim().length === 5 &&
      form.stateCode.trim().length === 2,
    [form]
  );

  const projects = projectsQuery.data || [];
  const pendingDocuments = verificationQuery.data || [];
  const selectedProjectRow =
    projects.find((row) => row.project.id === selectedProjectId) || null;
  const bids = bidsQuery.data || [];
  const filteredBids = useMemo(
    () =>
      bidStatusFilter === "all"
        ? bids
        : bids.filter((row) => row.bid.status === bidStatusFilter),
    [bidStatusFilter, bids]
  );
  const stats = useMemo(
    () => ({
      total: projects.length,
      open: projects.filter((row) => row.project.status === "open").length,
      bids: projects.reduce((total, row) => total + row.bidsCount, 0),
      documents: projects.reduce((total, row) => total + row.docsCount, 0),
    }),
    [projects]
  );

  return (
    <AdminWorkspace data-testid="admin-commercial-work-v2">
      <AdminSection
        title="Commercial work"
        description="Publish commercial project packages, review contractor credentials, issue addenda, adjudicate bids, and control campaign exposure from one operating workspace."
        className="pt-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                projectsQuery.refetch();
                verificationQuery.refetch();
                if (selectedProjectId) {
                  detailQuery.refetch();
                  bidsQuery.refetch();
                }
              }}
              disabled={
                projectsQuery.isFetching ||
                verificationQuery.isFetching ||
                detailQuery.isFetching ||
                bidsQuery.isFetching
              }
              className="border-white/12 bg-transparent text-white/65"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  projectsQuery.isFetching || verificationQuery.isFetching ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
            <a href="/admin/commercial-contractors">
              <Button type="button" variant="outline" className="border-white/12 bg-transparent text-white/65">
                Commercial businesses
              </Button>
            </a>
          </div>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Projects",
              value: projectsQuery.isError ? "—" : stats.total,
              detail: projectsQuery.isError ? "Project source unavailable" : "Stored solicitations",
              tone: projectsQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Open",
              value: projectsQuery.isError ? "—" : stats.open,
              detail: "Accepting bids or public review",
              tone: projectsQuery.isError ? "warning" : "good",
            },
            {
              label: "Bids",
              value: projectsQuery.isError ? "—" : stats.bids,
              detail: "Across all project registry rows",
              tone: projectsQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Pending verification",
              value: verificationQuery.isError ? "—" : pendingDocuments.length,
              detail: verificationQuery.isError
                ? "Verification source unavailable"
                : `${stats.documents} project documents`,
              tone:
                verificationQuery.isError || pendingDocuments.length > 0 ? "warning" : "good",
            },
          ]}
        />
      </AdminSection>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
            {[
              ["projects", "Projects"],
              ["bids", `Bid Review${bids.length ? ` (${bids.length})` : ""}`],
              [
                "verification",
                `Verification${pendingDocuments.length ? ` (${pendingDocuments.length})` : ""}`,
              ],
              ["create", "New Project"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </AdminWorkspaceSubnav>

        <TabsContent value="projects" className="mt-6">
          <div className="grid gap-7 xl:grid-cols-[20rem_minmax(0,1fr)]">
            <AdminSection
              title="Project registry"
              description="Choose a package to inspect or control."
              className="pt-0"
            >
              {projectsQuery.isLoading ? (
                <QueueLoading label="Loading commercial projects…" />
              ) : projectsQuery.isError ? (
                <QueueUnavailable label="Commercial project registry is unavailable." />
              ) : projects.length ? (
                <AdminList>
                  {projects.map((row) => (
                    <button
                      key={row.project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(row.project.id)}
                      className={`grid w-full gap-2 px-3 py-3 text-left transition sm:px-4 ${
                        row.project.id === selectedProjectId
                          ? "bg-white/[0.07] text-white"
                          : "text-white/58 hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">{row.project.title}</span>
                        <ProjectStatusBadge status={row.project.status} />
                      </div>
                      <span className="font-mono text-xs text-white/30">
                        {row.project.stateCode}-{row.project.countyFips}
                      </span>
                      <span className="text-xs text-white/35">
                        {row.bidsCount} bids · {row.docsCount} documents
                      </span>
                    </button>
                  ))}
                </AdminList>
              ) : (
                <AdminEmptyState
                  title="No commercial projects"
                  description="Create the first solicitation package from New Project."
                />
              )}
            </AdminSection>

            <ProjectControl
              selectedProjectId={selectedProjectId}
              selectedRow={selectedProjectRow}
              detailQuery={detailQuery}
              statusControl={statusControl}
              setStatusControl={setStatusControl}
              campaignControl={campaignControl}
              setCampaignControl={setCampaignControl}
              updatePending={updateProjectMutation.isPending}
              onUpdate={() => updateProjectMutation.mutate()}
              addendaFiles={addendaFiles}
              onAddendaFilesChange={setAddendaFiles}
              addendaPending={addendaMutation.isPending}
              onUploadAddenda={() => addendaMutation.mutate()}
            />
          </div>
        </TabsContent>

        <TabsContent value="bids" className="mt-6">
          <AdminSection
            title="Bid adjudication"
            description="Eligibility is checked before shortlist or award. Accepting a bid uses the existing server action and moves the project to awarded."
            className="pt-0"
          >
            <AdminToolbar>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full border-white/10 bg-black/20 text-white md:w-[24rem]">
                  <SelectValue placeholder="Choose project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((row) => (
                    <SelectItem key={row.project.id} value={row.project.id}>
                      {row.project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={bidStatusFilter} onValueChange={setBidStatusFilter}>
                <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="shortlisted">Shortlisted</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </AdminToolbar>

            {!selectedProjectId ? (
              <AdminEmptyState
                title="Choose a commercial project"
                description="Bid records are scoped to one project package."
              />
            ) : bidsQuery.isLoading ? (
              <QueueLoading label="Loading project bids…" />
            ) : bidsQuery.isError ? (
              <QueueUnavailable label="Project bids are unavailable." />
            ) : filteredBids.length ? (
              <AdminList className="mt-4">
                {filteredBids.map((row) => (
                  <details key={row.bid.id} className="group">
                    <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(9rem,0.45fr)_minmax(9rem,0.45fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">
                            {row.contractor?.companyName || "Unknown contractor"}
                          </p>
                          <BidStatusBadge status={row.bid.status} />
                        </div>
                        <p className="mt-1 text-xs text-white/35">
                          Submitted {formatDate(row.bid.createdAt)}
                        </p>
                      </div>
                      <MetricCell
                        label="Amount"
                        value={`$${Number(row.bid.amount).toLocaleString()}`}
                      />
                      <MetricCell
                        label="Timeline"
                        value={row.bid.timelineDays ? `${row.bid.timelineDays} days` : "Not provided"}
                      />
                      {row.eligibility?.isEligible === false ? (
                        <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
                          Ineligible
                        </Badge>
                      ) : (
                        <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
                          Eligible
                        </Badge>
                      )}
                    </summary>
                    <div className="space-y-4 border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                      {row.eligibility?.isEligible === false ? (
                        <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-3 py-3 text-sm text-amber-100">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          Ineligible for shortlist or award: {eligibilityReason(row.eligibility.reason)}
                        </div>
                      ) : null}
                      <p className="whitespace-pre-wrap text-sm leading-6 text-white/58">
                        {row.bid.proposal}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            bidActionMutation.isPending ||
                            row.bid.status === "accepted" ||
                            row.eligibility?.isEligible === false
                          }
                          onClick={() =>
                            bidActionMutation.mutate({
                              bidId: row.bid.id,
                              action: "shortlist",
                            })
                          }
                          className="border-white/12 bg-transparent text-white/65"
                        >
                          Shortlist
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={bidActionMutation.isPending || row.bid.status === "accepted"}
                          onClick={() =>
                            bidActionMutation.mutate({ bidId: row.bid.id, action: "reject" })
                          }
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            bidActionMutation.isPending ||
                            row.bid.status === "accepted" ||
                            row.eligibility?.isEligible === false
                          }
                          onClick={() =>
                            bidActionMutation.mutate({ bidId: row.bid.id, action: "accept" })
                          }
                          className="bg-orange-500 text-black hover:bg-orange-400"
                        >
                          Accept and award
                        </Button>
                      </div>
                    </div>
                  </details>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No bids match this filter"
                description="This project has no bid record in the selected status."
              />
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="verification" className="mt-6">
          <AdminSection
            title="Commercial verification review"
            description="Human review of contractor license and insurance evidence required for commercial eligibility. Keyboard shortcuts apply only while this workspace is open."
            className="pt-0"
          >
            <AdminToolbar>
              <div className="text-xs text-white/42">
                Shortcuts: <kbd className="border border-white/12 px-1.5 py-0.5">A</kbd> approve · {" "}
                <kbd className="border border-white/12 px-1.5 py-0.5">R</kbd> reject
              </div>
              <span className="text-xs text-white/35">
                {pendingDocuments.length} pending document{pendingDocuments.length === 1 ? "" : "s"}
              </span>
            </AdminToolbar>

            {verificationQuery.isLoading ? (
              <QueueLoading label="Loading verification documents…" />
            ) : verificationQuery.isError ? (
              <QueueUnavailable label="Commercial verification queue is unavailable." />
            ) : pendingDocuments.length ? (
              <AdminList className="mt-4">
                {pendingDocuments.map((row) => (
                  <div
                    key={row.document.id}
                    onClick={() => setSelectedVerificationDocId(row.document.id)}
                    className={`grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.55fr)_auto] lg:items-center ${
                      row.document.id === selectedVerificationDocId
                        ? "bg-white/[0.065]"
                        : "hover:bg-white/[0.025]"
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">
                          {row.contractor?.companyName || "Unknown contractor"}
                        </p>
                        <Badge className="border-white/15 bg-white/5 text-white/52">
                          {readable(row.document.type)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-white/35">{row.document.fileName}</p>
                      <p className="mt-1 text-xs text-white/28">
                        Submitted {formatDate(row.document.createdAt)}
                      </p>
                    </div>
                    <a
                      href={row.document.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-sky-200 underline underline-offset-4"
                    >
                      Open evidence
                    </a>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={reviewVerificationMutation.isPending}
                        onClick={() =>
                          reviewVerificationMutation.mutate({
                            documentId: row.document.id,
                            approved: false,
                          })
                        }
                      >
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={reviewVerificationMutation.isPending}
                        onClick={() =>
                          reviewVerificationMutation.mutate({
                            documentId: row.document.id,
                            approved: true,
                          })
                        }
                        className="bg-orange-500 text-black hover:bg-orange-400"
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No pending verification documents"
                description="All commercial license and insurance evidence has been reviewed."
              />
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <CreateProjectForm
            form={form}
            setForm={setForm}
            files={files}
            setFiles={setFiles}
            canSubmit={canSubmit}
            pending={createMutation.isPending}
            onSubmit={() => createMutation.mutate()}
          />
        </TabsContent>
      </Tabs>
    </AdminWorkspace>
  );
}

function ProjectControl({
  selectedProjectId,
  selectedRow,
  detailQuery,
  statusControl,
  setStatusControl,
  campaignControl,
  setCampaignControl,
  updatePending,
  onUpdate,
  addendaFiles,
  onAddendaFilesChange,
  addendaPending,
  onUploadAddenda,
}: {
  selectedProjectId: string;
  selectedRow: AdminProjectRow | null;
  detailQuery: ReturnType<typeof useQuery<ProjectDetailPayload>>;
  statusControl: string;
  setStatusControl: (value: string) => void;
  campaignControl: boolean;
  setCampaignControl: (value: boolean) => void;
  updatePending: boolean;
  onUpdate: () => void;
  addendaFiles: File[];
  onAddendaFilesChange: (files: File[]) => void;
  addendaPending: boolean;
  onUploadAddenda: () => void;
}) {
  if (!selectedProjectId) {
    return (
      <AdminSection title="Project control" className="pt-0">
        <AdminEmptyState
          title="Choose a commercial project"
          description="Select a project registry row to inspect the complete package."
        />
      </AdminSection>
    );
  }
  if (detailQuery.isLoading) {
    return (
      <AdminSection title="Project control" className="pt-0">
        <QueueLoading label="Loading project package…" />
      </AdminSection>
    );
  }
  if (detailQuery.isError || !detailQuery.data?.project) {
    return (
      <AdminSection title="Project control" className="pt-0">
        <QueueUnavailable label="The selected project package is unavailable." />
      </AdminSection>
    );
  }

  const details = detailQuery.data;
  return (
    <AdminSection
      title={details.project.title}
      description={`Project ${details.project.id} · ${details.project.stateCode}-${details.project.countyFips}`}
      className="pt-0"
      actions={
        <a href={`/commercial/p/${details.project.slug}`} target="_blank" rel="noreferrer">
          <Button type="button" variant="outline" className="border-white/12 bg-transparent text-white/65">
            Open landing page
          </Button>
        </a>
      }
    >
      <div className="grid overflow-hidden border-y border-white/10 sm:grid-cols-2 xl:grid-cols-4">
        <ProjectMetric label="Status" value={readable(details.project.status)} />
        <ProjectMetric
          label="Budget"
          value={renderBudget(details.project.budgetMin, details.project.budgetMax)}
        />
        <ProjectMetric label="Bids" value={String(details.bidsCount)} />
        <ProjectMetric label="Bid due" value={formatDate(details.project.bidDueAt)} />
      </div>

      <div className="mt-6 grid gap-7 xl:grid-cols-2">
        <TextBlock title="Executive summary">{details.project.summary}</TextBlock>
        <TextBlock title="Scope of work">{details.project.scopeOfWork}</TextBlock>
        <TextBlock title="Requirements">{details.project.requirements}</TextBlock>
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
            Project controls
          </p>
          <div className="space-y-4 border-y border-white/10 px-3 py-4 sm:px-4">
            <Select value={statusControl} onValueChange={setStatusControl}>
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="awarded">Awarded</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-white/58">
              <input
                type="checkbox"
                checked={campaignControl}
                onChange={(event) => setCampaignControl(event.target.checked)}
              />
              Campaign landing page enabled
            </label>
            <Button
              type="button"
              onClick={onUpdate}
              disabled={updatePending}
              className="bg-orange-500 text-black hover:bg-orange-400"
            >
              {updatePending ? "Saving…" : "Save project controls"}
            </Button>
            {selectedRow ? (
              <p className="text-xs text-white/32">
                Registry snapshot: {selectedRow.bidsCount} bids · {selectedRow.docsCount} documents
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <AdminSection
        title="Documents and addenda"
        description="Existing project package files and supplemental uploads."
        className="mt-7 pt-5"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
          {details.documents.length ? (
            <AdminList>
              {details.documents.map((document) => (
                <a
                  key={document.id}
                  href={document.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="grid gap-2 px-3 py-3 transition hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-white">{document.fileName}</p>
                    <p className="mt-1 text-xs text-white/32">
                      {document.mimeType || "File"} · {formatDate(document.createdAt)}
                    </p>
                  </div>
                  <FileStack className="h-4 w-4 text-white/35" />
                </a>
              ))}
            </AdminList>
          ) : (
            <AdminEmptyState
              title="No project documents"
              description="This package does not have a stored document yet."
            />
          )}
          <div className="border-y border-white/10 px-3 py-4 sm:px-4">
            <Label className="text-white/48">Supplemental files</Label>
            <Input
              type="file"
              multiple
              onChange={(event) =>
                onAddendaFilesChange(Array.from(event.target.files || []))
              }
              className="mt-2 border-white/10 bg-black/20 text-white"
            />
            <p className="mt-2 text-xs text-white/32">
              {addendaFiles.length
                ? `${addendaFiles.length} file(s) staged`
                : "Select one or more addenda files."}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={onUploadAddenda}
              disabled={addendaPending || !addendaFiles.length}
              className="mt-4 border-white/12 bg-transparent text-white/65"
            >
              {addendaPending ? "Uploading…" : "Upload addenda"}
            </Button>
          </div>
        </div>
      </AdminSection>
    </AdminSection>
  );
}

function CreateProjectForm({
  form,
  setForm,
  files,
  setFiles,
  canSubmit,
  pending,
  onSubmit,
}: {
  form: ProjectForm;
  setForm: React.Dispatch<React.SetStateAction<ProjectForm>>;
  files: File[];
  setFiles: (files: File[]) => void;
  canSubmit: boolean;
  pending: boolean;
  onSubmit: () => void;
}) {
  const update = <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <AdminSection
      title="Create commercial solicitation"
      description="Publish a project package with scope, requirements, documents, budget guidance, and optional campaign presentation."
      className="pt-0"
    >
      <div className="space-y-7">
        <FormGroup title="Project identity">
          <FormField label="Project title">
            <Input
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="County FIPS">
            <Input
              value={form.countyFips}
              onChange={(event) =>
                update("countyFips", event.target.value.replace(/\D/g, "").slice(0, 5))
              }
              placeholder="22105"
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="State code">
            <Input
              value={form.stateCode}
              onChange={(event) =>
                update(
                  "stateCode",
                  event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2)
                )
              }
              placeholder="LA"
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="Bid due (ISO datetime)">
            <Input
              value={form.bidDueAt}
              onChange={(event) => update("bidDueAt", event.target.value)}
              placeholder="2026-03-01T18:00:00.000Z"
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="Project start (ISO datetime)">
            <Input
              value={form.projectStartAt}
              onChange={(event) => update("projectStartAt", event.target.value)}
              placeholder="2026-04-01T13:00:00.000Z"
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
        </FormGroup>

        <FormGroup title="Scope and qualification">
          <FormField label="Executive summary" wide>
            <Textarea
              value={form.summary}
              onChange={(event) => update("summary", event.target.value)}
              rows={4}
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="Scope of work" wide>
            <Textarea
              value={form.scopeOfWork}
              onChange={(event) => update("scopeOfWork", event.target.value)}
              rows={6}
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="Requirements" wide>
            <Textarea
              value={form.requirements}
              onChange={(event) => update("requirements", event.target.value)}
              rows={6}
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
        </FormGroup>

        <FormGroup title="Budget and campaign">
          <FormField label="Budget minimum">
            <Input
              type="number"
              value={form.budgetMin}
              onChange={(event) => update("budgetMin", event.target.value)}
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="Budget maximum">
            <Input
              type="number"
              value={form.budgetMax}
              onChange={(event) => update("budgetMax", event.target.value)}
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="Hero image URL">
            <Input
              value={form.heroImageUrl}
              onChange={(event) => update("heroImageUrl", event.target.value)}
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="Campaign headline" wide>
            <Input
              value={form.campaignHeadline}
              onChange={(event) => update("campaignHeadline", event.target.value)}
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <FormField label="Campaign body" wide>
            <Textarea
              value={form.campaignBody}
              onChange={(event) => update("campaignBody", event.target.value)}
              rows={4}
              className="border-white/10 bg-black/20 text-white"
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-white/58 md:col-span-2 xl:col-span-3">
            <input
              type="checkbox"
              checked={form.campaignEnabled}
              onChange={(event) => update("campaignEnabled", event.target.checked)}
            />
            Enable campaign landing page at creation
          </label>
        </FormGroup>

        <FormGroup title="Initial documents">
          <FormField label="Scope and requirement files" wide>
            <Input
              type="file"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
              className="border-white/10 bg-black/20 text-white"
            />
            <p className="mt-2 text-xs text-white/32">
              {files.length ? `${files.length} file(s) selected` : "No files selected."}
            </p>
          </FormField>
        </FormGroup>

        <div className="flex items-center justify-between gap-4 border-y border-white/10 px-3 py-4 sm:px-4">
          <p className="text-xs text-white/38">
            Title, summary, scope, requirements, five-digit FIPS, and two-letter state are required.
          </p>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || pending}
            className="bg-orange-500 text-black hover:bg-orange-400"
          >
            {pending ? "Creating…" : "Create commercial project"}
          </Button>
        </div>
      </div>
    </AdminSection>
  );
}

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
        {title}
      </p>
      <div className="grid gap-4 border-y border-white/10 px-3 py-4 sm:px-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function FormField({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`space-y-1 text-xs text-white/42 ${wide ? "md:col-span-2 xl:col-span-3" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
        {title}
      </p>
      <div className="whitespace-pre-wrap border-y border-white/10 px-3 py-4 text-sm leading-6 text-white/58 sm:px-4">
        {children || "Not recorded"}
      </div>
    </div>
  );
}

function ProjectMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 px-4 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-white/68">{value}</p>
    </div>
  );
}

function QueueLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
      <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function QueueUnavailable({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {label}
    </div>
  );
}
