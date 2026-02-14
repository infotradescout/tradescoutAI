import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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

function renderBudget(min?: string | null, max?: string | null): string {
  const a = min ? Number(min).toLocaleString() : null;
  const b = max ? Number(max).toLocaleString() : null;
  if (a && b) return `$${a} - $${b}`;
  if (a) return `From $${a}`;
  if (b) return `Up to $${b}`;
  return "Budget on request";
}

export default function AdminCommercialDirectoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [files, setFiles] = useState<File[]>([]);
  const [addendaFiles, setAddendaFiles] = useState<File[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [statusControl, setStatusControl] = useState<string>("open");
  const [campaignControl, setCampaignControl] = useState<boolean>(false);

  const [form, setForm] = useState({
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
  });

  const { data, isLoading } = useQuery<AdminProjectRow[]>({
    queryKey: ["/api/admin/commercial-directory/projects"],
    queryFn: () => apiRequest("GET", "/api/admin/commercial-directory/projects"),
  });

  const { data: details, isLoading: detailsLoading } = useQuery<ProjectDetailPayload>({
    queryKey: ["/api/commercial-directory/projects/detail", selectedProjectId],
    queryFn: () => apiRequest("GET", `/api/commercial-directory/projects/${selectedProjectId}`),
    enabled: Boolean(selectedProjectId),
  });

  const { data: projectBids, isLoading: bidsLoading } = useQuery<ProjectBidRow[]>({
    queryKey: ["/api/admin/commercial-directory/projects/bids", selectedProjectId],
    queryFn: () =>
      apiRequest("GET", `/api/admin/commercial-directory/projects/${selectedProjectId}/bids`),
    enabled: Boolean(selectedProjectId),
  });

  useEffect(() => {
    if (!selectedProjectId && data && data.length > 0) {
      setSelectedProjectId(data[0].project.id);
    }
  }, [data, selectedProjectId]);

  useEffect(() => {
    if (details?.project) {
      setStatusControl(details.project.status || "open");
      setCampaignControl(Boolean(details.project.campaignEnabled));
    }
  }, [details]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (typeof value === "boolean") {
          fd.append(key, String(value));
          return;
        }
        if (value && String(value).trim().length > 0) fd.append(key, String(value).trim());
      });
      files.forEach((f) => fd.append("files", f));

      const res = await fetch("/api/admin/commercial-directory/projects", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Failed to create project");
      return payload;
    },
    onSuccess: (payload: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commercial-directory/projects"] });
      setFiles([]);
      setForm({
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
      });
      toast({
        title: "Commercial project created",
        description: payload?.landingUrl
          ? `Landing generated: ${payload.landingUrl}`
          : "Project created successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Create failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async () => {
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
      toast({
        title: "Project controls updated",
        description: "Status and campaign settings saved.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const addendaMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error("Select a project first");
      if (!addendaFiles.length) throw new Error("Select at least one file");

      const fd = new FormData();
      addendaFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(
        `/api/admin/commercial-directory/projects/${selectedProjectId}/documents`,
        {
          method: "POST",
          credentials: "include",
          body: fd,
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Failed to upload addenda");
      return payload;
    },
    onSuccess: () => {
      setAddendaFiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/commercial-directory/projects"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/commercial-directory/projects/detail", selectedProjectId],
      });
      toast({ title: "Addenda uploaded", description: "Document package refreshed." });
    },
    onError: (err: any) => {
      toast({
        title: "Upload failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const bidActionMutation = useMutation({
    mutationFn: async (input: { bidId: string; action: "shortlist" | "reject" | "accept" }) => {
      if (!selectedProjectId) throw new Error("Select a project");
      return apiRequest(
        "PUT",
        `/api/admin/commercial-directory/projects/${selectedProjectId}/bids/${input.bidId}`,
        { action: input.action }
      );
    },
    onSuccess: (_, vars) => {
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
          vars.action === "accept"
            ? "Bid accepted and project moved to awarded."
            : `Bid marked as ${vars.action}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Bid action failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const canSubmit = useMemo(() => {
    return (
      form.title.trim().length >= 3 &&
      form.summary.trim().length >= 10 &&
      form.scopeOfWork.trim().length >= 10 &&
      form.requirements.trim().length >= 10 &&
      form.countyFips.trim().length === 5 &&
      form.stateCode.trim().length === 2
    );
  }, [form]);

  const selectedRow = (data || []).find((row) => row.project.id === selectedProjectId) || null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <section className="rounded-2xl border border-slate-700 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6">
        <p className="text-xs tracking-[0.2em] uppercase text-emerald-200">
          Commercial Procurement Command
        </p>
        <h1 className="text-3xl font-semibold mt-2">Admin Commercial Job Request and Bid Portal</h1>
        <p className="text-sm text-slate-300 mt-2 max-w-3xl">
          Publish official commercial project packages, control campaign exposure, issue addenda,
          and award verified contractor bids.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        <Card className="border-slate-700 bg-slate-950/70">
          <CardHeader>
            <CardTitle>Project Registry</CardTitle>
            <CardDescription>
              Select an active package for control and adjudication.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p>Loading projects...</p>}
            {!isLoading && !data?.length && <p>No projects yet.</p>}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {(data || []).map((row) => (
                <button
                  key={row.project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(row.project.id)}
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    selectedProjectId === row.project.id
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm line-clamp-1">{row.project.title}</div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-300">
                      {row.project.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {row.project.stateCode}-{row.project.countyFips}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2">
                    bids: {row.bidsCount} | docs: {row.docsCount}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-700 bg-slate-950/70">
            <CardHeader>
              <CardTitle>Selected Project Control</CardTitle>
              <CardDescription>
                {selectedProjectId
                  ? `Project ID: ${selectedProjectId}`
                  : "Choose a project from the registry."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {detailsLoading && <p>Loading project package...</p>}
              {!detailsLoading && !details?.project && <p>No project selected.</p>}

              {details?.project && (
                <>
                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-xl font-semibold">{details.project.title}</h2>
                      <a
                        className="text-sm underline text-emerald-200"
                        href={`/commercial/p/${details.project.slug}`}
                      >
                        Open landing page
                      </a>
                    </div>
                    <p className="text-sm text-slate-300 mt-2">{details.project.summary}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
                      <div>
                        <div className="text-xs text-slate-400">County / State</div>
                        <div>
                          {details.project.countyFips} / {details.project.stateCode}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Budget</div>
                        <div>
                          {renderBudget(details.project.budgetMin, details.project.budgetMax)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Current Bid Count</div>
                        <div>{details.bidsCount}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-700 p-3 bg-slate-900/60">
                      <h3 className="text-sm uppercase tracking-wide text-slate-300">
                        Scope of Work
                      </h3>
                      <p className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">
                        {details.project.scopeOfWork}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 p-3 bg-slate-900/60">
                      <h3 className="text-sm uppercase tracking-wide text-slate-300">
                        Requirements
                      </h3>
                      <p className="text-sm text-slate-200 mt-2 whitespace-pre-wrap">
                        {details.project.requirements}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Status</Label>
                      <select
                        value={statusControl}
                        onChange={(e) => setStatusControl(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                      >
                        <option value="draft">draft</option>
                        <option value="open">open</option>
                        <option value="closed">closed</option>
                        <option value="awarded">awarded</option>
                        <option value="archived">archived</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={campaignControl}
                          onChange={(e) => setCampaignControl(e.target.checked)}
                        />
                        Campaign landing page enabled
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => updateProjectMutation.mutate()}
                      disabled={updateProjectMutation.isPending}
                    >
                      {updateProjectMutation.isPending ? "Saving..." : "Save Project Controls"}
                    </Button>
                    {selectedRow && (
                      <span className="text-xs text-slate-400 self-center">
                        Registry snapshot: {selectedRow.bidsCount} bids / {selectedRow.docsCount}{" "}
                        docs
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-3">
                    <h3 className="text-sm uppercase tracking-wide text-slate-300">
                      Addenda and Supplemental Documents
                    </h3>
                    <Input
                      type="file"
                      multiple
                      onChange={(e) => setAddendaFiles(Array.from(e.target.files || []))}
                    />
                    {!!addendaFiles.length && (
                      <p className="text-xs text-slate-400">
                        {addendaFiles.length} file(s) staged for upload
                      </p>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => addendaMutation.mutate()}
                      disabled={addendaMutation.isPending || !addendaFiles.length}
                    >
                      {addendaMutation.isPending ? "Uploading..." : "Upload Addenda"}
                    </Button>

                    {!!details.documents.length && (
                      <div className="space-y-1 pt-1">
                        {details.documents.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-sm underline text-emerald-200"
                          >
                            {doc.fileName}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-950/70">
            <CardHeader>
              <CardTitle>Create New Solicitation Package</CardTitle>
              <CardDescription>
                Publish a new commercial project with scope documents and campaign-ready messaging.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Project Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>County FIPS</Label>
                  <Input
                    value={form.countyFips}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, countyFips: e.target.value.slice(0, 5) }))
                    }
                    placeholder="22105"
                  />
                </div>
                <div>
                  <Label>State Code</Label>
                  <Input
                    value={form.stateCode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        stateCode: e.target.value.toUpperCase().slice(0, 2),
                      }))
                    }
                    placeholder="LA"
                  />
                </div>
                <div>
                  <Label>Bid Due (ISO datetime)</Label>
                  <Input
                    value={form.bidDueAt}
                    onChange={(e) => setForm((f) => ({ ...f, bidDueAt: e.target.value }))}
                    placeholder="2026-03-01T18:00:00.000Z"
                  />
                </div>
              </div>

              <div>
                <Label>Executive Summary</Label>
                <Textarea
                  value={form.summary}
                  onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                />
              </div>
              <div>
                <Label>Scope of Work</Label>
                <Textarea
                  value={form.scopeOfWork}
                  onChange={(e) => setForm((f) => ({ ...f, scopeOfWork: e.target.value }))}
                />
              </div>
              <div>
                <Label>Requirements</Label>
                <Textarea
                  value={form.requirements}
                  onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Budget Min</Label>
                  <Input
                    type="number"
                    value={form.budgetMin}
                    onChange={(e) => setForm((f) => ({ ...f, budgetMin: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Budget Max</Label>
                  <Input
                    type="number"
                    value={form.budgetMax}
                    onChange={(e) => setForm((f) => ({ ...f, budgetMax: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Hero Image URL</Label>
                  <Input
                    value={form.heroImageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, heroImageUrl: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Campaign Headline</Label>
                <Input
                  value={form.campaignHeadline}
                  onChange={(e) => setForm((f) => ({ ...f, campaignHeadline: e.target.value }))}
                />
              </div>
              <div>
                <Label>Campaign Body</Label>
                <Textarea
                  value={form.campaignBody}
                  onChange={(e) => setForm((f) => ({ ...f, campaignBody: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="campaign-enabled"
                  type="checkbox"
                  checked={form.campaignEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, campaignEnabled: e.target.checked }))}
                />
                <Label htmlFor="campaign-enabled">Enable campaign landing page at creation</Label>
              </div>

              <div>
                <Label>Initial Scope and Requirement Files</Label>
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                />
                {!!files.length && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {files.length} file(s) selected
                  </p>
                )}
              </div>

              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Commercial Project"}
              </Button>
            </CardContent>
          </Card>

          {selectedProjectId && (
            <Card className="border-slate-700 bg-slate-950/70">
              <CardHeader>
                <CardTitle>Bid Adjudication Board</CardTitle>
                <CardDescription>
                  Formal review and award workflow for project {selectedProjectId}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {bidsLoading && <p>Loading bids...</p>}
                {!bidsLoading && !projectBids?.length && <p>No bids yet.</p>}
                {(projectBids || []).map((row) => (
                  <div
                    key={row.bid.id}
                    className="border border-slate-700 rounded p-3 space-y-2 bg-slate-900/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">
                        {row.contractor?.companyName || "Unknown contractor"}
                      </div>
                      <div className="text-xs uppercase tracking-wide text-slate-300">
                        {row.bid.status}
                      </div>
                    </div>
                    <div className="text-sm">
                      Amount: ${Number(row.bid.amount).toLocaleString()} | Timeline:{" "}
                      {row.bid.timelineDays || "n/a"} days
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {row.bid.proposal}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bidActionMutation.isPending || row.bid.status === "accepted"}
                        onClick={() =>
                          bidActionMutation.mutate({ bidId: row.bid.id, action: "shortlist" })
                        }
                      >
                        Shortlist
                      </Button>
                      <Button
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
                        size="sm"
                        disabled={bidActionMutation.isPending || row.bid.status === "accepted"}
                        onClick={() =>
                          bidActionMutation.mutate({ bidId: row.bid.id, action: "accept" })
                        }
                      >
                        Accept and Award
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
