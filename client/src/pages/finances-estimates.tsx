import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

interface JobFlowsResponse {
  jobs: Array<{
    jobId: string;
    title: string;
    clientName: string | null;
    stage: string;
    documentCounts: {
      estimates: number;
      contracts: number;
      invoices: number;
      receipts: number;
      expenses: number;
    };
    updatedAt: string | null;
  }>;
}

export default function FinancesEstimatesPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialJobIdFromQuery = (() => {
    const idx = location.indexOf("?");
    if (idx === -1) return "";
    const params = new URLSearchParams(location.slice(idx + 1));
    return params.get("jobId") || "";
  })();

  const [projectTitle, setProjectTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [linkedJobId, setLinkedJobId] = useState(initialJobIdFromQuery);
  const [notes, setNotes] = useState("");
  const [contractBody, setContractBody] = useState("");
  const [total, setTotal] = useState("");

  const { data, isLoading } = useQuery<JobFlowsResponse>({
    queryKey: ["/api/accounting/job-flows"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/job-flows", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load estimate pipeline (${res.status})`);
      }
      return (await res.json()) as JobFlowsResponse;
    },
  });

  const estimateStages = new Set(["estimate_draft", "estimate_sent", "estimate_approved"]);

  const estimateRows = useMemo(() => {
    const jobs = data?.jobs ?? [];
    return jobs.filter((job) => estimateStages.has(job.stage));
  }, [data]);

  const createEstimate = useMutation({
    mutationFn: async () => {
      const numericTotal = Number(total || 0);
      if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
        throw new Error("Enter a valid estimate total greater than zero.");
      }

      const res = await fetch("/api/accounting/standalone-estimate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          projectTitle: projectTitle || "Manual estimate",
          clientName: clientName || undefined,
          jobId: linkedJobId.trim() || undefined,
          notes: notes || undefined,
          total: numericTotal,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create estimate (${res.status})`);
      }

      return (await res.json()) as { document: { job_id?: string }; jobId?: string };
    },
    onSuccess: (result) => {
      const createdJobId = result?.jobId || result?.document?.job_id || "";
      toast({
        title: "Estimate created",
        description: "You can continue this job in invoices or expenses right here in Finances.",
      });
      setProjectTitle("");
      setClientName("");
      setNotes("");
      setTotal("");
      if (createdJobId) setLinkedJobId(createdJobId);
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/job-flows"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not create estimate",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const createContract = useMutation({
    mutationFn: async () => {
      const numericTotal = Number(total || 0);
      if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
        throw new Error("Enter a valid contract total greater than zero.");
      }

      const res = await fetch("/api/accounting/standalone-contract", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          projectTitle: projectTitle || "Manual contract",
          clientName: clientName || undefined,
          jobId: linkedJobId.trim() || undefined,
          notes: notes || undefined,
          body: contractBody || undefined,
          total: numericTotal,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create contract (${res.status})`);
      }

      return (await res.json()) as { document: { job_id?: string }; jobId?: string };
    },
    onSuccess: (result) => {
      const createdJobId = result?.jobId || result?.document?.job_id || "";
      toast({
        title: "Contract draft created",
        description: "This job can now continue through signatures and invoicing in Finances.",
      });
      setProjectTitle("");
      setClientName("");
      setNotes("");
      setContractBody("");
      setTotal("");
      if (createdJobId) setLinkedJobId(createdJobId);
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/job-flows"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not create contract",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const stageLabel: Record<string, string> = {
    estimate_draft: "Draft",
    estimate_sent: "Sent",
    estimate_approved: "Approved",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Estimates</h1>
          <p className="text-sm text-white/60">
            Create and manage estimate-stage work directly inside Finances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => navigate("/finances/jobs")}
          >
            Open jobs
          </Button>
        </div>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">
            Create estimate or contract
          </CardTitle>
          <CardDescription className="text-xs text-white/60">
            Start at estimate or jump straight to a contract draft and attach either to an existing
            accounting job flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder="Project or job name"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="h-10 bg-tsCard border-white/10 text-white text-sm"
            />
            <Input
              placeholder="Client name (optional)"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="h-10 bg-tsCard border-white/10 text-white text-sm"
            />
            <Input
              placeholder="Link existing job ID (optional)"
              value={linkedJobId}
              onChange={(e) => setLinkedJobId(e.target.value)}
              className="h-10 bg-tsCard border-white/10 text-white text-sm"
            />
            <Input
              placeholder="Estimate total"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="h-10 bg-tsCard border-white/10 text-white text-sm"
            />
          </div>
          <Input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-10 bg-tsCard border-white/10 text-white text-sm"
          />
          <Input
            placeholder="Contract body (optional)"
            value={contractBody}
            onChange={(e) => setContractBody(e.target.value)}
            className="h-10 bg-tsCard border-white/10 text-white text-sm"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => createContract.mutate()}
              disabled={createContract.isPending || createEstimate.isPending}
            >
              {createContract.isPending ? "Creating..." : "Create contract draft"}
            </Button>
            <Button
              size="sm"
              onClick={() => createEstimate.mutate()}
              disabled={createEstimate.isPending || createContract.isPending}
            >
              {createEstimate.isPending ? "Creating..." : "Create estimate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">Estimate pipeline</CardTitle>
          <CardDescription className="text-xs text-white/60">
            Active estimate-stage jobs from your current accounting flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-[11px] text-white/60">Loading estimate pipeline…</p>
          ) : estimateRows.length === 0 ? (
            <p className="text-[11px] text-white/60">
              No jobs are currently in estimate stages. Create an estimate above to start one.
            </p>
          ) : (
            <div className="space-y-2">
              {estimateRows.map((job) => (
                <Card key={job.jobId} className="bg-tsCard/95 border-white/10">
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white truncate max-w-xs">
                          {job.title}
                        </h3>
                        <Badge className="text-[10px] px-2 py-0.5 bg-white/5 border-white/15">
                          {stageLabel[job.stage] || "Estimate"}
                        </Badge>
                      </div>
                      {job.clientName && (
                        <p className="text-[11px] text-white/70">Client: {job.clientName}</p>
                      )}
                      <p className="text-[11px] text-white/60 mt-0.5">
                        Estimates: {job.documentCounts.estimates} · Contracts:{" "}
                        {job.documentCounts.contracts}
                      </p>
                      {job.updatedAt && (
                        <p className="text-[11px] text-white/60 mt-0.5">
                          Updated {new Date(job.updatedAt).toLocaleDateString()}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 border-white/10 text-[11px] text-white/80"
                          onClick={() =>
                            navigate(`/finances/invoices?jobId=${encodeURIComponent(job.jobId)}`)
                          }
                        >
                          Create invoice
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 border-white/10 text-[11px] text-white/80"
                          onClick={() =>
                            navigate(`/finances/expenses?jobId=${encodeURIComponent(job.jobId)}`)
                          }
                        >
                          Record expense
                        </Button>
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-sky-400">Continue in Finances</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
