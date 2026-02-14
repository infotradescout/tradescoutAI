import { useMemo, useState } from "react";
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

export default function AdminCommercialDirectoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
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

  const { data: projectBids, isLoading: bidsLoading } = useQuery<ProjectBidRow[]>({
    queryKey: ["/api/admin/commercial-directory/projects/bids", selectedProjectId],
    queryFn: () =>
      apiRequest("GET", `/api/admin/commercial-directory/projects/${selectedProjectId}/bids`),
    enabled: Boolean(selectedProjectId),
  });

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
          ? `Landing: ${payload.landingUrl}`
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
      toast({
        title: "Bid updated",
        description:
          vars.action === "accept"
            ? "Bid accepted and project marked as awarded."
            : `Bid ${vars.action}ed.`,
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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Commercial Project Portal</CardTitle>
          <CardDescription>
            Create a commercial project, upload scope docs, publish to verified contractor bidding,
            and generate campaign landing pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>County FIPS</Label>
              <Input
                value={form.countyFips}
                onChange={(e) => setForm((f) => ({ ...f, countyFips: e.target.value }))}
                placeholder="e.g. 22105"
              />
            </div>
            <div>
              <Label>State Code</Label>
              <Input
                value={form.stateCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stateCode: e.target.value.toUpperCase().slice(0, 2) }))
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
            <Label>Summary</Label>
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
            <Label htmlFor="campaign-enabled">Enable campaign landing page</Label>
          </div>

          <div>
            <Label>Scope/Requirement Files</Label>
            <Input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {!!files.length && (
              <p className="text-sm text-muted-foreground mt-1">{files.length} file(s) selected</p>
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

      <Card>
        <CardHeader>
          <CardTitle>Existing Commercial Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading...</p>}
          {!isLoading && !data?.length && <p>No projects yet.</p>}
          <div className="space-y-3">
            {(data || []).map((row) => (
              <div key={row.project.id} className="rounded border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{row.project.title}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm">{row.project.status}</div>
                    <Button
                      size="sm"
                      variant={selectedProjectId === row.project.id ? "default" : "outline"}
                      onClick={() => setSelectedProjectId(row.project.id)}
                    >
                      {selectedProjectId === row.project.id ? "Viewing bids" : "Manage bids"}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {row.project.stateCode}-{row.project.countyFips} | bids: {row.bidsCount} | docs:{" "}
                  {row.docsCount}
                </div>
                <div className="text-xs mt-1">
                  Landing:{" "}
                  <a
                    className="underline"
                    href={`/commercial/p/${row.project.slug}`}
                  >{`/commercial/p/${row.project.slug}`}</a>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedProjectId && (
        <Card>
          <CardHeader>
            <CardTitle>Bid Management</CardTitle>
            <CardDescription>Project ID: {selectedProjectId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bidsLoading && <p>Loading bids...</p>}
            {!bidsLoading && !projectBids?.length && <p>No bids yet.</p>}
            {(projectBids || []).map((row) => (
              <div key={row.bid.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">
                    {row.contractor?.companyName || "Unknown contractor"}
                  </div>
                  <div className="text-sm">{row.bid.status}</div>
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
                    Accept & Award
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
