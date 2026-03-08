import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";

interface JobRow {
  jobId: string;
  title: string;
  clientName: string | null;
  stage: string;
  invoiceCount: number;
  totalInvoiced: number;
  paidAmount: number;
  unpaidAmount: number;
  expensesTotal: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface JobFlowsResponse {
  jobs: Array<{
    jobId: string;
    title: string;
    clientName: string | null;
    stage: string;
    totals: {
      totalInvoiced: number;
      totalPaid: number;
      totalUnpaid: number;
      totalExpenses: number;
      net: number;
    };
    documentCounts: {
      estimates: number;
      contracts: number;
      invoices: number;
      receipts: number;
      expenses: number;
    };
    createdAt: string | null;
    updatedAt: string | null;
  }>;
}

export default function FinancesJobsPage() {
  const { user } = useAuth();
  const isCommunityFirst = Boolean((user as any)?.communityFirst);
  const [, navigate] = useLocation();

  const { data: jobFlowsData, isLoading: isJobFlowsLoading } = useQuery<JobFlowsResponse>({
    queryKey: ["/api/accounting/job-flows"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/job-flows", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load job flows (${res.status})`);
      }
      return (await res.json()) as JobFlowsResponse;
    },
  });

  const [jobQuery, setJobQuery] = useState("");

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const jobs: JobRow[] = useMemo(() => {
    const source = jobFlowsData?.jobs ?? [];
    return source.map((job) => ({
      jobId: job.jobId,
      title: job.title,
      clientName: job.clientName,
      stage: job.stage,
      invoiceCount: Number(job.documentCounts?.invoices || 0),
      totalInvoiced: Number(job.totals?.totalInvoiced || 0),
      paidAmount: Number(job.totals?.totalPaid || 0),
      unpaidAmount: Number(job.totals?.totalUnpaid || 0),
      expensesTotal: Number(job.totals?.totalExpenses || 0),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }));
  }, [jobFlowsData]);

  const stageLabelMap: Record<string, string> = {
    new: "New",
    estimate_draft: "Estimate draft",
    estimate_sent: "Estimate sent",
    estimate_approved: "Estimate approved",
    contract_draft: "Contract draft",
    contract_sent: "Contract sent",
    contract_signed: "Contract signed",
    invoice_draft: "Invoice draft",
    invoice_sent: "Invoice sent",
    invoice_paid: "Invoice paid",
    receipt_issued: "Receipt issued",
  };

  const filteredJobs = useMemo(() => {
    if (!jobQuery.trim()) return jobs;
    const q = jobQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      return (
        job.title.toLowerCase().includes(q) ||
        (job.client ? job.client.toLowerCase().includes(q) : false) ||
        (job.jobId ? job.jobId.toLowerCase().includes(q) : false)
      );
    });
  }, [jobs, jobQuery]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Jobs</h1>
          <p className="text-sm text-white/60">
            Job pipeline and deal rooms, anchored on the invoices you've issued.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => navigate("/finances/invoices")}
          >
            View invoices
          </Button>
        </div>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-white">
              Jobs linked to invoices
            </CardTitle>
            <CardDescription className="text-xs text-white/60">
              Flow-aware jobs sourced from your accounting documents. Open a deal room to continue
              the estimate, contract, invoice, and payment lifecycle.
            </CardDescription>
          </div>
          <div className="flex flex-col items-stretch gap-2 w-full md:w-auto">
            <Input
              placeholder="Search jobs by name, client, or ID"
              value={jobQuery}
              onChange={(e) => setJobQuery(e.target.value)}
              className="bg-tsCard/95 border-white/10 text-xs text-white h-8 min-w-[220px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isJobFlowsLoading ? (
            <p className="text-[11px] text-white/60 py-4">Loading jobs…</p>
          ) : filteredJobs.length === 0 ? (
            <div className="text-[11px] text-white/60 py-4 space-y-2">
              <p>
                {isCommunityFirst
                  ? "You don’t need to set up jobs in advance. When you create invoices or expenses and tie them to work, jobs will appear here automatically."
                  : "No jobs found yet. Once you create invoices or expenses tied to jobs, they'll appear here."}
              </p>
              {isCommunityFirst && (
                <div className="flex items-center gap-2 text-[11px]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 border-white/10 text-white/70"
                    onClick={() => navigate("/finances/invoices")}
                  >
                    Create an invoice when you’re ready
                  </Button>
                  <Link href="/community">
                    <a className="text-sky-400 hover:text-sky-300">See what’s happening nearby</a>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map((job) => {
                const statusLabel = stageLabelMap[job.stage] || "In progress";
                const stageHint =
                  job.stage === "receipt_issued"
                    ? "Flow complete"
                    : job.stage.startsWith("invoice")
                      ? "Collect payment"
                      : job.stage.startsWith("contract")
                        ? "Finalize contract"
                        : job.stage.startsWith("estimate")
                          ? "Move estimate forward"
                          : "Begin estimate";

                return (
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
                            {statusLabel}
                          </Badge>
                        </div>
                        {job.clientName && (
                          <p className="text-[11px] text-white/70">Client: {job.clientName}</p>
                        )}
                        <p className="text-[11px] text-white/60 mt-1">
                          Invoiced: {formatCurrency(job.totalInvoiced)} · Paid:{" "}
                          {formatCurrency(job.paidAmount)} · Open:{" "}
                          {formatCurrency(job.unpaidAmount)}
                        </p>
                        <p className="text-[11px] text-white/60 mt-0.5">
                          Expenses: {formatCurrency(job.expensesTotal)} · Simple net:{" "}
                          {formatCurrency(job.totalInvoiced - job.expensesTotal)}
                        </p>
                        <p className="text-[11px] text-white/60 mt-0.5">{stageHint}</p>
                        {job.updatedAt && (
                          <p className="text-[11px] text-white/60 mt-0.5">
                            Updated {new Date(job.updatedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm font-semibold text-sky-400">
                        {formatCurrency(job.totalInvoiced - job.expensesTotal)}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
