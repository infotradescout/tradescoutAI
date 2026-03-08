import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatUserFacingErrorMessage, getRawErrorMessage } from "@/lib/userFacingError";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Page } from "@/components/layout/PagePrimitives";

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

interface StandaloneReceipt {
  id: string;
  job_id: string | null;
  type: string;
  status: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

type AdditionalRecordType = "BILL" | "PURCHASE_ORDER" | "CREDIT_NOTE" | "PAYMENT" | "JOURNAL_ENTRY";

export default function FinancesInvoicesPage() {
  const { isAuthenticated, user } = useAuth();
  const isCommunityFirst = Boolean((user as any)?.communityFirst);
  const { toast } = useToast();
  const newInvoiceRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  const initialClientFromQuery = (() => {
    const idx = location.indexOf("?");
    if (idx === -1) return "";
    const search = location.slice(idx + 1);
    const params = new URLSearchParams(search);
    return params.get("client") || "";
  })();

  const initialJobIdFromQuery = (() => {
    const idx = location.indexOf("?");
    if (idx === -1) return "";
    const search = location.slice(idx + 1);
    const params = new URLSearchParams(search);
    return params.get("jobId") || "";
  })();

  const [projectTitle, setProjectTitle] = useState("");
  const [clientName, setClientName] = useState(initialClientFromQuery);
  const [linkedJobId, setLinkedJobId] = useState(initialJobIdFromQuery);
  const [notes, setNotes] = useState("");
  const [total, setTotal] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "open" | "paid">("all");
  const [invoiceRangeFilter, setInvoiceRangeFilter] = useState<"all" | "90d" | "365d">("all");
  const [receiptTitle, setReceiptTitle] = useState("");
  const [receiptClientName, setReceiptClientName] = useState("");
  const [receiptJobId, setReceiptJobId] = useState(initialJobIdFromQuery);
  const [receiptTotal, setReceiptTotal] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [sourceInvoiceId, setSourceInvoiceId] = useState("");
  const [otherRecordType, setOtherRecordType] = useState<AdditionalRecordType>("BILL");
  const [otherRecordTitle, setOtherRecordTitle] = useState("");
  const [otherRecordJobId, setOtherRecordJobId] = useState(initialJobIdFromQuery);
  const [otherRecordClientName, setOtherRecordClientName] = useState("");
  const [otherRecordVendorName, setOtherRecordVendorName] = useState("");
  const [otherRecordReference, setOtherRecordReference] = useState("");
  const [otherRecordTotal, setOtherRecordTotal] = useState("");
  const [otherRecordNotes, setOtherRecordNotes] = useState("");

  if (!isAuthenticated) {
    return (
      <Page className="py-16">
        <div className="text-center text-sm text-white/60">
          Sign in to view and manage invoices.
        </div>
      </Page>
    );
  }

  const handleNewInvoiceClick = () => {
    if (newInvoiceRef.current) {
      newInvoiceRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
          jobId: linkedJobId.trim() || undefined,
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
      setLinkedJobId("");
      setNotes("");
      setTotal("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/standalone-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/reports/summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not create invoice",
        description: formatUserFacingErrorMessage(error, "Please try again."),
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
        description: formatUserFacingErrorMessage(error, "Please try again."),
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
      const raw = getRawErrorMessage(error);
      toast({
        title: "Could not record payment",
        description:
          raw === "INVOICE_NOT_READY_FOR_PAYMENT"
            ? "Send the invoice first, then record payment."
            : formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const createReceipt = useMutation({
    mutationFn: async () => {
      const numericTotal = Number(receiptTotal || 0);
      if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
        throw new Error("Enter a valid receipt total greater than zero.");
      }

      const res = await fetch("/api/accounting/standalone-receipt", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          projectTitle: receiptTitle || "Manual receipt",
          clientName: receiptClientName || undefined,
          jobId: receiptJobId.trim() || undefined,
          notes: receiptNotes || undefined,
          total: numericTotal,
          invoiceId: sourceInvoiceId.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create receipt (${res.status})`);
      }

      return (await res.json()) as { document: StandaloneReceipt };
    },
    onSuccess: () => {
      toast({
        title: "Receipt recorded",
        description: "Receipt is now part of your finance record and linked flow.",
      });
      setReceiptTitle("");
      setReceiptClientName("");
      setReceiptJobId("");
      setReceiptTotal("");
      setReceiptNotes("");
      setSourceInvoiceId("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/job-flows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/reports/summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not create receipt",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const createOtherRecord = useMutation({
    mutationFn: async () => {
      const numericTotal = Number(otherRecordTotal || 0);
      if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
        throw new Error("Enter a valid record total greater than zero.");
      }

      const res = await fetch("/api/accounting/standalone-record", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          type: otherRecordType,
          projectTitle: otherRecordTitle || undefined,
          jobId: otherRecordJobId.trim() || undefined,
          clientName: otherRecordClientName || undefined,
          vendorName: otherRecordVendorName || undefined,
          reference: otherRecordReference || undefined,
          notes: otherRecordNotes || undefined,
          total: numericTotal,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create record (${res.status})`);
      }

      return (await res.json()) as { document: { type: string } };
    },
    onSuccess: (result) => {
      toast({
        title: `${result.document.type.replace(/_/g, " ")} recorded`,
        description: "Record added to your accounting history and linked flow.",
      });
      setOtherRecordTitle("");
      setOtherRecordClientName("");
      setOtherRecordVendorName("");
      setOtherRecordReference("");
      setOtherRecordTotal("");
      setOtherRecordNotes("");
      setOtherRecordJobId("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/job-flows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/reports/summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not create record",
        description: formatUserFacingErrorMessage(error, "Please try again."),
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
    const idx = location.indexOf("?");
    const search = idx === -1 ? "" : location.slice(idx + 1);
    const params = new URLSearchParams(search);
    const clientFilter = (params.get("client") || "").trim().toLowerCase();

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

      if (clientFilter) {
        const payload = inv.payload || {};
        const invoiceClient = String(payload.clientName || "")
          .trim()
          .toLowerCase();
        if (!invoiceClient || invoiceClient !== clientFilter) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, invoiceStatusFilter, invoiceRangeFilter, location]);

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const getInvoiceStatusTone = (status: string) => {
    const normalizedStatus = String(status || "").toLowerCase();
    if (normalizedStatus === "paid") {
      return "bg-tsSuccess text-tsSuccess border-tsSuccess";
    }
    if (normalizedStatus === "sent") {
      return "bg-ts-orange text-ts-orange border-ts-orange";
    }
    if (normalizedStatus === "overdue") {
      return "bg-tsWarning text-tsWarning border-tsWarning";
    }
    if (normalizedStatus === "draft") {
      return "bg-tsCard text-white/60 border-white/10";
    }
    return "bg-tsCard text-white/70 border-white/10";
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
            if (s.includes(",") || s.includes("\n") || s.includes('"')) {
              return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
          })
          .join(",")
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
    document.title = "Invoices • Finances | TradeScout — Connection Without Compromise";
  }, []);

  return (
    <Page className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold text-tsText mb-1">Invoices</h1>
          <p className="text-sm text-white/60">
            Create, send, and get paid for work you track in Finances.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-end">
          <Button
            variant="default"
            size="sm"
            className="h-9 px-3 text-[11px] md:h-8"
            onClick={handleNewInvoiceClick}
          >
            New invoice
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 border-white/10 text-[11px] text-tsText md:h-8"
            onClick={() => navigate("/finances")}
          >
            Back to dashboard
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 border-white/10 text-[11px] text-tsText md:h-8"
            onClick={() => navigate("/finances/records")}
          >
            Open records ledger
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-xs font-medium text-white/70 uppercase tracking-wide">
              Total billed
            </CardTitle>
            <CardDescription className="text-[11px] leading-relaxed md:text-sm">
              Lifetime revenue from invoices you track here.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-semibold text-tsText md:text-2xl">
              {formatCurrency(summary?.lifetime.totalAmount)}
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              {(summary?.lifetime.invoiceCount ?? totalCount).toLocaleString()} documents
            </p>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-xs font-medium text-white/70 uppercase tracking-wide">
              Collected
            </CardTitle>
            <CardDescription className="text-[11px] leading-relaxed md:text-sm">
              Invoices you've marked as paid.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-semibold text-tsSuccess md:text-2xl">
              {formatCurrency(summary?.lifetime.paidAmount)}
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              {(summary?.lifetime.paidCount ?? 0).toLocaleString()} paid invoices
            </p>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-xs font-medium text-white/70 uppercase tracking-wide">
              Outstanding
            </CardTitle>
            <CardDescription className="text-[11px] leading-relaxed md:text-sm">
              Work you've billed but not collected yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg font-semibold text-tsWarning md:text-2xl">
              {formatCurrency(summary?.lifetime.unpaidAmount)}
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              {(summary?.lifetime.unpaidCount ?? 0).toLocaleString()} open invoices
            </p>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10 col-span-2 md:col-span-1">
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-xs font-medium text-white/70 uppercase tracking-wide">
              Recent activity
            </CardTitle>
            <CardDescription className="text-[11px] leading-relaxed md:text-sm">
              Newest invoice records on this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 flex items-center justify-between gap-3">
            <Badge className="text-[10px] px-2 py-0.5 bg-tsCard border-white/10">
              {recentInvoices.length} shown
            </Badge>
            <p className="text-[11px] text-white/50">
              {recentInvoices.length > 0 ? "Latest records ready to review." : "No recent changes."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card ref={newInvoiceRef} className="bg-tsCard border-white/10 mb-4">
        <CardHeader>
          <CardTitle className="text-tsText mb-1">New invoice / job record</CardTitle>
          <CardDescription>
            Create a clean invoice record for work that ran off-platform so it still shows up in
            your ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              placeholder="Project or job name"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Client name (optional)"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Link existing job ID (optional)"
              value={linkedJobId}
              onChange={(e) => setLinkedJobId(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Total amount"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
          </div>
          <Input
            placeholder="Notes (what this work was for)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="w-full h-10 md:w-auto md:h-8"
              onClick={() => createInvoice.mutate()}
              disabled={createInvoice.isPending}
            >
              {createInvoice.isPending ? "Creating..." : "Create invoice record"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10 mb-4">
        <CardHeader>
          <CardTitle className="text-tsText mb-1">Standalone receipt record</CardTitle>
          <CardDescription>
            Add a receipt at any point. Link it to an existing job flow or keep it standalone for
            clean records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder="Receipt title"
              value={receiptTitle}
              onChange={(e) => setReceiptTitle(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Client name (optional)"
              value={receiptClientName}
              onChange={(e) => setReceiptClientName(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Link existing job ID (optional)"
              value={receiptJobId}
              onChange={(e) => setReceiptJobId(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Receipt total"
              value={receiptTotal}
              onChange={(e) => setReceiptTotal(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              placeholder="Source invoice ID (optional)"
              value={sourceInvoiceId}
              onChange={(e) => setSourceInvoiceId(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Notes (optional)"
              value={receiptNotes}
              onChange={(e) => setReceiptNotes(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-10 md:w-auto md:h-8"
              onClick={() => createReceipt.mutate()}
              disabled={createReceipt.isPending}
            >
              {createReceipt.isPending ? "Creating..." : "Create receipt record"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10 mb-4">
        <CardHeader>
          <CardTitle className="text-tsText mb-1">Other bookkeeping records</CardTitle>
          <CardDescription>
            Create additional records like bills, purchase orders, credit notes, payments, and
            journal entries without leaving Finances.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <select
              value={otherRecordType}
              onChange={(e) => setOtherRecordType(e.target.value as AdditionalRecordType)}
              className="h-11 rounded-md bg-tsCard border border-white/10 px-3 text-tsText text-sm"
            >
              <option value="BILL">Bill</option>
              <option value="PURCHASE_ORDER">Purchase order</option>
              <option value="CREDIT_NOTE">Credit note</option>
              <option value="PAYMENT">Payment record</option>
              <option value="JOURNAL_ENTRY">Journal entry</option>
            </select>
            <Input
              placeholder="Record title"
              value={otherRecordTitle}
              onChange={(e) => setOtherRecordTitle(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Link existing job ID (optional)"
              value={otherRecordJobId}
              onChange={(e) => setOtherRecordJobId(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Record total"
              value={otherRecordTotal}
              onChange={(e) => setOtherRecordTotal(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              placeholder="Client name (optional)"
              value={otherRecordClientName}
              onChange={(e) => setOtherRecordClientName(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Vendor name (optional)"
              value={otherRecordVendorName}
              onChange={(e) => setOtherRecordVendorName(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
            <Input
              placeholder="Reference (optional)"
              value={otherRecordReference}
              onChange={(e) => setOtherRecordReference(e.target.value)}
              className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
            />
          </div>
          <Input
            placeholder="Notes (optional)"
            value={otherRecordNotes}
            onChange={(e) => setOtherRecordNotes(e.target.value)}
            className="h-11 bg-tsCard border-white/10 text-tsText text-sm"
          />
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-10 md:w-auto md:h-8"
              onClick={() => createOtherRecord.mutate()}
              disabled={createOtherRecord.isPending}
            >
              {createOtherRecord.isPending ? "Creating..." : "Create record"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-tsCard border-white/10">
        <CardHeader className="pb-3 space-y-3">
          <div>
            <CardTitle className="text-sm font-semibold text-tsText">All invoices</CardTitle>
            <CardDescription className="text-xs text-white/60">
              Manage every standalone invoice you track here: send, record payment, or export.
            </CardDescription>
          </div>
          <div className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">
              Status
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-white/60">
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter("all")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceStatusFilter === "all"
                    ? "border-ts-orange bg-ts-orange/10 text-tsText"
                    : "border-white/10 bg-tsCard text-white/70 hover:border-ts-orange"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter("open")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceStatusFilter === "open"
                    ? "border-tsWarning bg-tsWarning/10 text-tsText"
                    : "border-white/10 bg-tsCard text-white/70 hover:border-tsWarning"
                }`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setInvoiceStatusFilter("paid")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceStatusFilter === "paid"
                    ? "border-tsSuccess bg-tsSuccess/10 text-tsText"
                    : "border-white/10 bg-tsCard text-white/70 hover:border-tsSuccess"
                }`}
              >
                Paid
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/60">
              <button
                type="button"
                onClick={() => setInvoiceRangeFilter("all")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceRangeFilter === "all"
                    ? "border-ts-orange bg-white/5 text-tsText"
                    : "border-white/10 bg-tsCard text-white/70 hover:border-ts-orange"
                }`}
              >
                All time
              </button>
              <button
                type="button"
                onClick={() => setInvoiceRangeFilter("90d")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceRangeFilter === "90d"
                    ? "border-ts-orange bg-white/5 text-tsText"
                    : "border-white/10 bg-tsCard text-white/70 hover:border-ts-orange"
                }`}
              >
                Last 90 days
              </button>
              <button
                type="button"
                onClick={() => setInvoiceRangeFilter("365d")}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  invoiceRangeFilter === "365d"
                    ? "border-ts-orange bg-white/5 text-tsText"
                    : "border-white/10 bg-tsCard text-white/70 hover:border-ts-orange"
                }`}
              >
                Last year
              </button>
            </div>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <Badge className="text-[10px] px-2 py-0.5 bg-tsCard border-white/10">
                {filteredInvoicesForTable.length} shown of {invoices.length}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full px-3 border-white/10 text-[11px] text-tsText sm:h-7 sm:w-auto"
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
            <p className="text-xs text-white/60 py-4">Loading invoice records...</p>
          ) : invoices.length === 0 ? (
            <div className="text-xs text-white/60 space-y-2">
              <p>
                {isCommunityFirst
                  ? "You only need invoices when you want a record. Create one when it’s useful; until then, everything else in TradeScout still works."
                  : "Once you start creating invoice records, you'll see them listed here with quick actions."}
              </p>
              {isCommunityFirst && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 px-3 text-[11px]"
                    onClick={handleNewInvoiceClick}
                  >
                    New invoice
                  </Button>
                  <Link href="/community">
                    <a className="text-[11px] text-sky-400 hover:text-sky-300">
                      See what’s happening nearby
                    </a>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filteredInvoicesForTable.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/10 p-4 text-center text-[11px] text-white/60">
                    No invoices match these filters.
                  </div>
                ) : (
                  filteredInvoicesForTable.map((inv) => {
                    const payload = inv.payload || {};
                    const title: string = payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`;
                    const client: string | null = payload.clientName || null;
                    const totalVal: number | null =
                      typeof payload.total === "number" ? payload.total : null;
                    const createdLabel = new Date(inv.created_at).toLocaleDateString();
                    const status = String(inv.status || "").toLowerCase();

                    return (
                      <div
                        key={inv.id}
                        className="rounded-2xl border border-white/10 bg-black/10 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-semibold text-tsText">{title}</p>
                            <p className="text-[11px] text-white/55">
                              {client || "No client name"}
                            </p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${getInvoiceStatusTone(inv.status)}`}
                          >
                            {inv.status || "draft"}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-tsCard/40 p-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">
                              Date
                            </p>
                            <p className="mt-1 text-xs text-white/75">{createdLabel}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">
                              Amount
                            </p>
                            <p className="mt-1 text-xs font-semibold text-tsText">
                              {totalVal !== null
                                ? totalVal.toLocaleString(undefined, {
                                    style: "currency",
                                    currency: payload.currency || "USD",
                                  })
                                : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2">
                          {status === "draft" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 w-full border-white/10 text-[11px]"
                              disabled={sendInvoice.isPending || markInvoicePaid.isPending}
                              onClick={() => sendInvoice.mutate(inv.id)}
                            >
                              {sendInvoice.isPending ? "Sending..." : "Send invoice"}
                            </Button>
                          )}
                          {(status === "sent" || status === "approved") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 w-full border-white/10 text-[11px]"
                              disabled={markInvoicePaid.isPending || sendInvoice.isPending}
                              onClick={() => markInvoicePaid.mutate(inv.id)}
                            >
                              {markInvoicePaid.isPending ? "Recording..." : "Record payment"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="hidden overflow-x-auto -mx-2 md:block">
                <Table className="min-w-full text-xs">
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="w-[18%] text-white/60">Date</TableHead>
                      <TableHead className="w-[26%] text-white/60">Job / project</TableHead>
                      <TableHead className="w-[20%] text-white/60">Client</TableHead>
                      <TableHead className="w-[16%] text-right text-white/60">Amount</TableHead>
                      <TableHead className="w-[20%] text-right text-white/60">
                        Status / Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoicesForTable.length === 0 ? (
                      <TableRow className="border-white/10">
                        <TableCell
                          colSpan={5}
                          className="py-4 text-center text-[11px] text-white/60"
                        >
                          No invoices match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInvoicesForTable.map((inv) => {
                        const payload = inv.payload || {};
                        const title: string =
                          payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`;
                        const client: string | null = payload.clientName || null;
                        const totalVal: number | null =
                          typeof payload.total === "number" ? payload.total : null;
                        const createdLabel = new Date(inv.created_at).toLocaleDateString();
                        const status = String(inv.status || "").toLowerCase();
                        const isPaid = status === "paid";
                        const isSent = status === "sent";

                        return (
                          <TableRow key={inv.id} className="border-white/10 hover:bg-white/5">
                            <TableCell className="py-2 text-white/70 text-[11px]">
                              {createdLabel}
                            </TableCell>
                            <TableCell className="py-2 text-tsText text-[11px] truncate max-w-[220px]">
                              {title}
                            </TableCell>
                            <TableCell className="py-2 text-white/70 text-[11px] truncate max-w-[180px]">
                              {client || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-right text-[11px] text-tsText">
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
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] font-medium capitalize ${getInvoiceStatusTone(inv.status)}`}
                                >
                                  {inv.status || "draft"}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {status === "draft" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 border-white/10 text-[10px]"
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
                                      className="h-6 px-2 border-white/10 text-[10px]"
                                      disabled={markInvoicePaid.isPending || sendInvoice.isPending}
                                      onClick={() => markInvoicePaid.mutate(inv.id)}
                                    >
                                      {markInvoicePaid.isPending
                                        ? "Recording..."
                                        : "Record payment"}
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
            </>
          )}
        </CardContent>
      </Card>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 border-white/10"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 border-white/10"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => (p < pageCount ? p + 1 : p))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Page>
  );
}
