import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { DealRoomRole } from "@/lib/dealRoomState";
import { DealRoomPanel } from "@/components/jobs/DealRoomPanel";
import { useToast } from "@/hooks/use-toast";

interface StandaloneInvoice {
  id: string;
  job_id: string | null;
  type: string;
  status: string;
  payload: any;
  created_at: string;
  updated_at: string;
}


interface AccountingSummary {
  lifetime: {
    invoiceCount: number;
    paidCount: number;
    unpaidCount: number;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
  };
  byMonth: {
    month: string;
    totalAmount: number;
    paidAmount: number;
  }[];
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

function getDealRoomRole(user: any): DealRoomRole {
  if (!user) return "guest";
  const roles: string[] = Array.isArray(user.roles) && user.roles.length
    ? (user.roles as string[])
    : user.role
    ? [String(user.role)]
    : [];
  const baseRoles = Array.from(new Set(roles.map((r) => r.split(":")[0].toLowerCase())));
  if (
    baseRoles.includes("contractor") ||
    baseRoles.includes("pro") ||
    baseRoles.includes("service_provider")
  ) {
    return "contractor";
  }
  if (baseRoles.includes("homeowner")) {
    return "homeowner";
  }
  return "guest";
}

export default function AccountingWorkspace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const role = useMemo(() => getDealRoomRole(user), [user]);

  const [projectTitle, setProjectTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [total, setTotal] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const { data, isLoading } = useQuery<StandaloneInvoicesResponse>({
    queryKey: ["/api/accounting/standalone-invoices", page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
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

  const { data: summary } = useQuery<AccountingSummary>({
    queryKey: ["/api/accounting/reports/summary"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/reports/summary", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load accounting summary (${res.status})`);
      }
      return (await res.json()) as AccountingSummary;
    },
  });

  const createInvoice = useMutation({
    mutationFn: async () => {
      const numericTotal = Number(total || 0);
      if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
        throw new Error("Enter a valid total greater than zero.");
      }
      const res = await fetch("/api/accounting/standalone-invoice", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          projectTitle: projectTitle || "Manual project",
          clientName: clientName || undefined,
          notes: notes || undefined,
          total: numericTotal,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create invoice (${res.status})`);
      }
      return (await res.json()) as { document: StandaloneInvoice; jobId: string };
    },
    onSuccess: (result) => {
      toast({
        title: "Invoice created",
        description: "You can now send or record payment for this off-site job.",
      });
      setProjectTitle("");
      setClientName("");
      setNotes("");
      setTotal("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/standalone-invoices"] });
      setSelectedJobId(result.jobId);
    },
    onError: (error: any) => {
      toast({
        title: "Could not create invoice",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const invoices = data?.invoices ?? [];
  const totalCount = data?.pagination?.totalCount ?? invoices.length;
  const pageCount = data?.pagination?.pageCount ?? 1;
  const selectedInvoice = invoices.find((inv) => inv.job_id === selectedJobId) ?? invoices[0] ?? null;
  const effectiveJobId = selectedInvoice?.job_id ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Job Documents</CardTitle>
            <CardDescription>Estimates, invoices, materials, receipts, and contracts you track in this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{totalCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Unpaid</CardTitle>
            <CardDescription>Invoices still waiting on payment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">
              {invoices.filter((i) => i.status !== "paid").length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-400">Paid</CardTitle>
            <CardDescription>Invoices with receipts issued</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">
              {invoices.filter((i) => i.status === "paid").length}
            </div>
          </CardContent>
        </Card>

        {summary && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Accounting Reports</CardTitle>
              <CardDescription>
                Overview of your job records and money moving through them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground">Total Billed</div>
                  <div className="text-xl font-semibold">
                    ${summary.lifetime.totalAmount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Collected</div>
                  <div className="text-xl font-semibold">
                    ${summary.lifetime.paidAmount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Outstanding</div>
                  <div className="text-xl font-semibold">
                    ${summary.lifetime.unpaidAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-slate-800/50 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white mb-1">New Invoice / Job Record</CardTitle>
          <CardDescription>
            Create a clean invoice record for work that ran off-platform so it still shows up in your ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="Project or job name"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="bg-slate-900/60 border-slate-700 text-white text-sm"
            />
            <Input
              placeholder="Client name (optional)"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="bg-slate-900/60 border-slate-700 text-white text-sm"
            />
            <Input
              placeholder="Total amount"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="bg-slate-900/60 border-slate-700 text-white text-sm"
            />
          </div>
          <Input
            placeholder="Notes (what this work was for)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-slate-900/60 border-slate-700 text-white text-sm"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => createInvoice.mutate()} disabled={createInvoice.isPending}>
              {createInvoice.isPending ? "Creating..." : "Create Invoice Record"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-white">Money Workspace</CardTitle>
              <CardDescription>Pick a job record on the left, then manage it in the deal room.</CardDescription>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 border-slate-600"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span>
                  Page {page} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 border-slate-600"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => (p < pageCount ? p + 1 : p))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-gray-400">Loading invoice records...</div>
          ) : invoices.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              No invoice records yet. Use the form above to create your first invoice for a job, even if it ran off TradeScout.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)] gap-6">
              <div className="space-y-2">
                {invoices.map((inv) => {
                  const payload = inv.payload || {};
                  const title: string = payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`;
                  const client: string | null = payload.clientName || null;
                  const totalVal: number | null =
                    typeof payload.total === "number" ? payload.total : null;
                  const createdLabel = new Date(inv.created_at).toLocaleDateString();

                  const isSelected = inv.job_id === effectiveJobId;

                  return (
                    <Card
                      key={inv.id}
                      className={`bg-slate-900/60 border-slate-700 hover:border-orange-500/60 transition-colors cursor-pointer ${
                        isSelected ? "ring-1 ring-orange-500/60" : ""
                      }`}
                      onClick={() => setSelectedJobId(inv.job_id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-white truncate max-w-xs">{title}</h3>
                              <Badge className="text-[10px] px-2 py-0.5 bg-slate-800 border-slate-600">
                                {inv.status}
                              </Badge>
                            </div>
                            {client && (
                              <p className="text-[11px] text-slate-300">Client: {client}</p>
                            )}
                            <p className="text-[11px] text-slate-400 mt-1">
                              Created {createdLabel}
                            </p>
                          </div>
                          {totalVal !== null && (
                            <div className="text-right text-sm font-semibold text-sky-400">
                              {totalVal.toLocaleString(undefined, {
                                style: "currency",
                                currency: payload.currency || "USD",
                              })}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="min-h-[260px]">
                {effectiveJobId ? (
                  <DealRoomPanel jobId={effectiveJobId} userRole={role} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-slate-700 rounded-md bg-slate-900/40 p-4">
                    Select an invoice on the left to open it in the deal room.
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
