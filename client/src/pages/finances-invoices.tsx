import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    totalExpenses: number;
    netProfit: number;
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

export default function FinancesInvoicesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [projectTitle, setProjectTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [total, setTotal] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "open" | "paid">("all");
  const [invoiceRangeFilter, setInvoiceRangeFilter] = useState<"all" | "90d" | "365d">("all");

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
      return (await res.json()) as { document: StandaloneInvoice };
    },
    onSuccess: () => {
      toast({
        title: "Invoice created",
        description: "You can now send or record payment for this off-site job.",
      });
      setProjectTitle("");
      setClientName("");
      setNotes("");
      setTotal("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/standalone-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/reports/summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not create invoice",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendInvoice = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}/send`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to send invoice (${res.status})`);
      }
      return (await res.json()) as { document: StandaloneInvoice };
    },
    onSuccess: () => {
      toast({
        title: "Invoice sent",
        description: "Status updated to sent. You can now record payment when it clears.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/standalone-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/reports/summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send invoice",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const markInvoicePaid = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}/mark-paid`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ method: "manual" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to record payment (${res.status})`);
      }
      return (await res.json()) as { document: StandaloneInvoice };
    },
    onSuccess: () => {
      toast({
        title: "Payment recorded",
        description: "Invoice marked as paid and a receipt was issued.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/standalone-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/reports/summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not record payment",
        description:
          error?.message === "INVOICE_NOT_READY_FOR_PAYMENT"
            ? "Send the invoice first, then record payment."
            : error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const invoices = data?.invoices ?? [];
  const totalCount = data?.pagination?.totalCount ?? invoices.length;
  const pageCount = data?.pagination?.pageCount ?? 1;

  const recentInvoices = useMemo(() => {
    if (!invoices.length) return [] as StandaloneInvoice[];
    return [...invoices]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [invoices]);

  const filteredInvoicesForTable = useMemo(() => {
    if (!invoices.length) return [] as StandaloneInvoice[];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return invoices.filter((inv) => {
      const status = String(inv.status || "").toLowerCase();
      if (invoiceStatusFilter === "open" && status === "paid") return false;
      if (invoiceStatusFilter === "paid" && status !== "paid") return false;

      if (invoiceRangeFilter !== "all") {
        const createdTime = new Date(inv.created_at).getTime();
        const maxAgeDays = invoiceRangeFilter === "90d" ? 90 : 365;
        if (!Number.isFinite(createdTime) || now - createdTime > maxAgeDays * dayMs) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, invoiceStatusFilter, invoiceRangeFilter]);

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const handleExportInvoicesCsv = () => {
    if (typeof window === "undefined") return;
    if (!invoices.length) {
      toast({
        title: "No data to export",
        description: "Create at least one invoice before exporting.",
      });
      return;
    }

    const header = [
      "Invoice ID",
      "Job ID",
      "Created At",
      "Updated At",
      "Status",
      "Project Title",
      "Client Name",
      "Total",
      "Currency",
    ];

    const rows = invoices.map((inv) => {
      const payload = inv.payload || {};
      const title: string = payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`;
      const client: string | null = payload.clientName || null;
      const totalVal: number | null = typeof payload.total === "number" ? payload.total : null;
      const currency = payload.currency || "USD";
      return [
        inv.id,
        inv.job_id ?? "",
        new Date(inv.created_at).toISOString(),
        new Date(inv.updated_at).toISOString(),
        String(inv.status || ""),
        title,
        client ?? "",
        totalVal !== null ? String(totalVal) : "",
        currency,
      ];
    });

    const csvLines = [
      header.join(","),
      ...rows.map((cols) =>
        cols
          .map((val) => {
            const s = String(val ?? "");
            if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
              return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
          })
          .join(","),
      ),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tradescout-finances-invoices.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export started",
      description: "Your invoices CSV is downloading.",
    });
  };

  useEffect(() => {
    document.title = "Invoices • Finances | TradeScout";
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 mb-1">Invoices</h1>
          <p className="text-sm text-slate-400">
            Create, send, and get paid for work you track in your Finances workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-slate-600 text-[11px] text-slate-200"
            onClick={() => navigate("/finances")}
          >
            Back to dashboard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-slate-300 uppercase tracking-wide">
              Total billed
            </CardTitle>
            <CardDescription>Lifetime revenue from invoices you track here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-white">
              {formatCurrency(summary?.lifetime.totalAmount)}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {(summary?.lifetime.invoiceCount ?? totalCount).toLocaleString()} documents
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-slate-300 uppercase tracking-wide">
              Collected
            </CardTitle>
            <CardDescription>Invoices you've marked as paid.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-300">
              {formatCurrency(summary?.lifetime.paidAmount)}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {(summary?.lifetime.paidCount ?? 0).toLocaleString()} paid invoices
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-slate-300 uppercase tracking-wide">
              Outstanding
            </CardTitle>
            <CardDescription>Work you've billed but not collected yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-amber-300">
              {formatCurrency(summary?.lifetime.unpaidAmount)}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {(summary?.lifetime.unpaidCount ?? 0).toLocaleString()} open invoices
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium text-slate-300 uppercase tracking-wide">
              Recent activity
            </CardTitle>
            <CardDescription>Newest invoice records in this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="text-[10px] px-2 py-0.5 bg-slate-800 border-slate-600">
              {recentInvoices.length} shown
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700 mb-4">
        <CardHeader>
          <CardTitle className="text-white mb-1">New invoice / job record</CardTitle>
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
              {createInvoice.isPending ? "Creating..." : "Create invoice record"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-100">All invoices</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Manage every standalone invoice you track here: send, record payment, or export.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter("all")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceStatusFilter === "all"
                    ? "border-orange-500 bg-orange-500/10 text-slate-50"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter("open")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceStatusFilter === "open"
                    ? "border-orange-500 bg-orange-500/10 text-slate-50"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                }`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter("paid")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceStatusFilter === "paid"
                    ? "border-orange-500 bg-orange-500/10 text-slate-50"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                }`}
              >
                Paid
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <button
                type="button"
                onClick={() => setInvoiceRangeFilter("all")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceRangeFilter === "all"
                    ? "border-slate-500 bg-slate-800 text-slate-50"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                }`}
              >
                All time
              </button>
              <button
                type="button"
                onClick={() => setInvoiceRangeFilter("90d")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceRangeFilter === "90d"
                    ? "border-slate-500 bg-slate-800 text-slate-50"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                }`}
              >
                Last 90 days
              </button>
              <button
                type="button"
                onClick={() => setInvoiceRangeFilter("365d")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceRangeFilter === "365d"
                    ? "border-slate-500 bg-slate-800 text-slate-50"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                }`}
              >
                Last year
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="text-[10px] px-2 py-0.5 bg-slate-800 border-slate-600">
                {filteredInvoicesForTable.length} shown of {invoices.length}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 border-slate-600 text-[11px] text-slate-200"
                onClick={handleExportInvoicesCsv}
                disabled={!invoices.length}
              >
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-1">
          {isLoading ? (
            <p className="text-xs text-slate-400 py-4">Loading invoice records...</p>
          ) : invoices.length === 0 ? (
            <p className="text-xs text-slate-400">
              Once you start creating invoice records, you'll see them listed here with quick actions.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <Table className="min-w-full text-xs">
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="w-[18%] text-slate-400">Date</TableHead>
                    <TableHead className="w-[26%] text-slate-400">Job / project</TableHead>
                    <TableHead className="w-[20%] text-slate-400">Client</TableHead>
                    <TableHead className="w-[16%] text-right text-slate-400">Amount</TableHead>
                    <TableHead className="w-[20%] text-right text-slate-400">Status / Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoicesForTable.length === 0 ? (
                    <TableRow className="border-slate-800">
                      <TableCell colSpan={5} className="py-4 text-center text-[11px] text-slate-500">
                        No invoices match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoicesForTable.map((inv) => {
                      const payload = inv.payload || {};
                      const title: string = payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`;
                      const client: string | null = payload.clientName || null;
                      const totalVal: number | null =
                        typeof payload.total === "number" ? payload.total : null;
                      const createdLabel = new Date(inv.created_at).toLocaleDateString();
                      const status = String(inv.status || "").toLowerCase();
                      const isPaid = status === "paid";
                      const isSent = status === "sent";

                      return (
                        <TableRow key={inv.id} className="border-slate-800 hover:bg-slate-900/70">
                          <TableCell className="py-2 text-slate-200 text-[11px]">
                            {createdLabel}
                          </TableCell>
                          <TableCell className="py-2 text-slate-100 text-[11px] truncate max-w-[220px]">
                            {title}
                          </TableCell>
                          <TableCell className="py-2 text-slate-200 text-[11px] truncate max-w-[180px]">
                            {client || "—"}
                          </TableCell>
                          <TableCell className="py-2 text-right text-[11px] text-slate-100">
                            {totalVal !== null
                              ? totalVal.toLocaleString(undefined, {
                                  style: "currency",
                                  currency: payload.currency || "USD",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="py-2 text-right text-[10px]">
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-medium capitalize ${
                                  isPaid
                                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                                    : isSent
                                    ? "bg-sky-500/10 text-sky-300 border-sky-500/40"
                                    : "bg-slate-600/10 text-slate-200 border-slate-500/60"
                                }`}
                              >
                                {inv.status || "draft"}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {status === "draft" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 border-slate-600 text-[10px]"
                                    disabled={sendInvoice.isPending || markInvoicePaid.isPending}
                                    onClick={() => sendInvoice.mutate(inv.id)}
                                  >
                                    {sendInvoice.isPending ? "Sending..." : "Send"}
                                  </Button>
                                )}
                                {(status === "sent" || status === "approved") && !isPaid && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 border-slate-600 text-[10px]"
                                    disabled={markInvoicePaid.isPending || sendInvoice.isPending}
                                    onClick={() => markInvoicePaid.mutate(inv.id)}
                                  >
                                    {markInvoicePaid.isPending ? "Recording..." : "Record payment"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 border-slate-600"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
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
        </div>
      )}
    </div>
  );
}
