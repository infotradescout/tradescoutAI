import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

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
  const [, navigate] = useLocation();

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
            Quotes waiting for approval, driven by each job's deal room.
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
              No jobs are currently in estimate stages. Open a deal room to draft an estimate and it
              will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {estimateRows.map((job) => (
                <Card
                  key={job.jobId}
                  className="bg-tsCard/95 border-white/10 hover:border-ts-orange/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/deal-room/${encodeURIComponent(job.jobId)}`)}
                >
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
                    </div>
                    <div className="text-right text-[11px] text-sky-400">Open deal room</div>
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
