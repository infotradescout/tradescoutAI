import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface StandaloneInvoice {
  id: string;
  job_id: string | null;
  type: string;
  status: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

interface StandaloneInvoicesResponse {
  invoices: StandaloneInvoice[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    pageCount: number;
  };
}

interface ExpenseEntry {
  id: string;
  job_id: string | null;
  type: string;
  status: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

interface ExpensesResponse {
  expenses: ExpenseEntry[];
}

interface JobRow {
  id: string;
  jobId: string;
  title: string;
  client: string | null;
  invoiceCount: number;
  totalInvoiced: number;
  paidAmount: number;
  unpaidAmount: number;
  expensesTotal: number;
  createdAt: string;
}

export default function FinancesJobsPage() {
  const [, navigate] = useLocation();

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery<StandaloneInvoicesResponse>({
    queryKey: ["/api/accounting/standalone-invoices", 1, 200],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "200" });
      const res = await fetch(`/api/accounting/standalone-invoices?${params.toString()}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load invoices (${res.status})`);
      }
      return (await res.json()) as StandaloneInvoicesResponse;
    },
  });

  const { data: expensesData, isLoading: isExpensesLoading } = useQuery<ExpensesResponse>({
    queryKey: ["/api/accounting/expenses"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/expenses", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load expenses (${res.status})`);
      }
      return (await res.json()) as ExpensesResponse;
    },
  });

  const [jobQuery, setJobQuery] = useState("");

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const jobs: JobRow[] = useMemo(() => {
    const invoices = invoicesData?.invoices ?? [];
    const expenses = expensesData?.expenses ?? [];

    const map = new Map<string, JobRow>();

    for (const inv of invoices) {
      if (!inv.job_id) continue;
      const payload = inv.payload || {};
      const jobId = String(inv.job_id);
      const title: string = payload.projectTitle || `Job ${jobId.slice(0, 8)}`;
      const client: string | null = payload.clientName || null;
      const totalVal: number | null = typeof payload.total === "number" ? payload.total : null;

      const existing: JobRow =
        map.get(jobId) || {
          id: jobId,
          jobId,
          title,
          client,
          invoiceCount: 0,
          totalInvoiced: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          expensesTotal: 0,
          createdAt: inv.created_at,
        };

      existing.invoiceCount += 1;

      if (typeof totalVal === "number" && Number.isFinite(totalVal)) {
        existing.totalInvoiced += totalVal;
        const status = String(inv.status || "").toLowerCase();
        if (status === "paid") {
          existing.paidAmount += totalVal;
        } else {
          existing.unpaidAmount += totalVal;
        }
      }

      if (new Date(inv.created_at).getTime() < new Date(existing.createdAt).getTime()) {
        existing.createdAt = inv.created_at;
      }

      map.set(jobId, existing);
    }

    for (const exp of expenses) {
      if (!exp.job_id) continue;
      const payload = exp.payload || {};
      const jobId = String(exp.job_id);
      const title: string = payload.projectTitle || `Job ${jobId.slice(0, 8)}`;
      const totalVal: number | null = typeof payload.total === "number" ? payload.total : null;

      const existing: JobRow =
        map.get(jobId) || {
          id: jobId,
          jobId,
          title,
          client: null,
          invoiceCount: 0,
          totalInvoiced: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          expensesTotal: 0,
          createdAt: exp.created_at,
        };

      if (typeof totalVal === "number" && Number.isFinite(totalVal)) {
        existing.expensesTotal += totalVal;
      }

      if (new Date(exp.created_at).getTime() < new Date(existing.createdAt).getTime()) {
        existing.createdAt = exp.created_at;
      }

      map.set(jobId, existing);
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [invoicesData, expensesData]);

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
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 mb-1">Jobs</h1>
          <p className="text-sm text-slate-400">
            Job pipeline and deal rooms, anchored on the invoices you've issued.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-slate-600 text-[11px] text-slate-200"
            onClick={() => navigate("/finances/invoices")}
          >
            View invoices
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-100">Jobs linked to invoices</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              This is a simple job list based on your invoice and expense records. Open a deal room to manage
              materials, estimates, contracts, and payments.
            </CardDescription>
          </div>
          <div className="flex flex-col items-stretch gap-2 w-full md:w-auto">
            <Input
              placeholder="Search jobs by name, client, or ID"
              value={jobQuery}
              onChange={(e) => setJobQuery(e.target.value)}
              className="bg-slate-900/60 border-slate-700 text-xs text-slate-100 h-8 min-w-[220px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isInvoicesLoading || isExpensesLoading ? (
            <p className="text-[11px] text-slate-400 py-4">Loading jobs…</p>
          ) : filteredJobs.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-4">
              No jobs found yet. Once you create invoices or expenses tied to jobs, they'll appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map((job) => {
                let statusLabel = "No invoices";
                if (job.totalInvoiced > 0) {
                  if (job.unpaidAmount <= 0) statusLabel = "Paid";
                  else if (job.paidAmount > 0) statusLabel = "Partially paid";
                  else statusLabel = "Unpaid";
                }

                return (
                  <Card
                    key={job.id}
                    className="bg-slate-900/60 border-slate-700 hover:border-orange-500/60 transition-colors cursor-pointer"
                    onClick={() => navigate(`/deal-room/${encodeURIComponent(job.jobId)}`)}
                  >
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white truncate max-w-xs">{job.title}</h3>
                          <Badge className="text-[10px] px-2 py-0.5 bg-slate-800 border-slate-600">
                            {statusLabel}
                          </Badge>
                        </div>
                        {job.client && (
                          <p className="text-[11px] text-slate-300">Client: {job.client}</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                          Invoiced: {formatCurrency(job.totalInvoiced)} · Paid: {formatCurrency(job.paidAmount)} ·
                          Open: {formatCurrency(job.unpaidAmount)}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Expenses: {formatCurrency(job.expensesTotal)} · Simple net: {formatCurrency(
                            job.totalInvoiced - job.expensesTotal,
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Created {new Date(job.createdAt).toLocaleDateString()}
                        </p>
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
