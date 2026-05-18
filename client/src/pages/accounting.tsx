// Expense Helper link (define if the tool exists, otherwise set to undefined)
const expenseHelperLink = "/tools/expense-helper";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { DealRoomRole } from "@/lib/dealRoomState";
import { WorkflowPanel } from "@/components/jobs/WorkflowPanel";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatUserFacingErrorMessage, getRawErrorMessage } from "@/lib/userFacingError";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  LayoutDashboard,
  FileText,
  Handshake,
  BarChart3,
  Settings2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  WalletCards,
} from "lucide-react";
import { useLocation } from "wouter";
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
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    pageCount: number;
  };
}

interface BooksFoundationResponse {
  profile: {
    id: string;
    accountingBasis: "cash" | "accrual";
    fiscalYearStartMonth: number;
    defaultCurrency: string;
    booksStatus: string;
  } | null;
  capabilities: Record<string, string>;
  counts: {
    accounts: number;
    journalEntries: number;
    postedEntries: number;
    openReconciliations: number;
    proposedAutomation: number;
  };
  sourceCoverage: Array<{ sourceSurface: string; count: number }>;
  proposals: Array<{
    id: string;
    sourceSurface: string;
    sourceType: string;
    sourceId: string;
    workRequestId: string | null;
    assignmentId: string | null;
    automationState: string;
    reason: string | null;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
  migrationRequired?: string;
}

function getDealRoomRole(user: any): DealRoomRole {
  if (!user) return "guest";
  const roles: string[] =
    Array.isArray(user.roles) && user.roles.length
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
  const [location, navigate] = useLocation();

  const [projectTitle, setProjectTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [total, setTotal] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [activeNav, setActiveNav] = useState<string>("dashboard");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [jobQuery, setJobQuery] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "open" | "paid">("all");
  const [invoiceRangeFilter, setInvoiceRangeFilter] = useState<"all" | "90d" | "365d">("all");
  const [expenseProjectTitle, setExpenseProjectTitle] = useState("");
  const [expenseVendor, setExpenseVendor] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseTotal, setExpenseTotal] = useState("");

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

  const { data: expensesData } = useQuery<ExpensesResponse>({
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

  const { data: booksFoundation } = useQuery<BooksFoundationResponse>({
    queryKey: ["/api/accounting/books-foundation"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/books-foundation", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load books foundation (${res.status})`);
      }
      return (await res.json()) as BooksFoundationResponse;
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

  const createExpense = useMutation({
    mutationFn: async () => {
      const numericTotal = Number(expenseTotal || 0);
      if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
        throw new Error("Enter a valid expense total greater than zero.");
      }
      const res = await fetch("/api/accounting/standalone-expense", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          projectTitle: expenseProjectTitle || "Manual expense",
          vendorName: expenseVendor || undefined,
          category: expenseCategory || undefined,
          notes: expenseNotes || undefined,
          total: numericTotal,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create expense (${res.status})`);
      }
      return (await res.json()) as { document: ExpenseEntry; jobId: string };
    },
    onSuccess: () => {
      toast({
        title: "Expense recorded",
        description: "This cost now rolls into your finances dashboard.",
      });
      setExpenseProjectTitle("");
      setExpenseVendor("");
      setExpenseCategory("");
      setExpenseNotes("");
      setExpenseTotal("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/reports/summary"] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not record expense",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const invoices = data?.invoices ?? [];
  const expenses = expensesData?.expenses ?? [];
  const totalCount = data?.pagination?.totalCount ?? invoices.length;
  const pageCount = data?.pagination?.pageCount ?? 1;
  const selectedInvoice =
    invoices.find((inv) => inv.job_id === selectedJobId) ?? invoices[0] ?? null;
  const effectiveJobId = selectedInvoice?.job_id ?? null;

  const lifetime = summary?.lifetime;
  const monthly = summary?.byMonth ?? [];

  const chartData = monthly.map((m) => ({
    month: m.month,
    billed: m.totalAmount,
    collected: m.paidAmount,
  }));

  const recentInvoices = useMemo(() => {
    if (!invoices.length) return [] as StandaloneInvoice[];
    return [...invoices]
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [invoices]);

  const openInvoices = useMemo(
    () => invoices.filter((inv) => String(inv.status || "").toLowerCase() !== "paid"),
    [invoices]
  );

  const draftInvoices = useMemo(
    () =>
      invoices.filter((inv) =>
        ["draft", "created"].includes(String(inv.status || "").toLowerCase())
      ),
    [invoices]
  );

  const expensesMissingDetails = useMemo(
    () =>
      expenses.filter((expense) => {
        const payload = expense.payload || {};
        return !expense.job_id || !payload.vendorName || !payload.category;
      }),
    [expenses]
  );

  const jobIdsWithInvoices = useMemo(
    () => new Set(invoices.map((inv) => inv.job_id).filter(Boolean) as string[]),
    [invoices]
  );

  const expenseOnlyJobIds = useMemo(() => {
    const ids = new Set<string>();
    for (const expense of expenses) {
      const jobId = expense.job_id;
      if (jobId && !jobIdsWithInvoices.has(jobId)) ids.add(jobId);
    }
    return Array.from(ids);
  }, [expenses, jobIdsWithInvoices]);

  const reviewQueue = [
    {
      label: "Unpaid invoices",
      count: openInvoices.length,
      detail: "Collect or record payment after review",
      to: "/finances/invoices",
    },
    {
      label: "Draft invoices",
      count: draftInvoices.length,
      detail: "Review before sending",
      to: "/finances/invoices",
    },
    {
      label: "Expenses missing details",
      count: expensesMissingDetails.length,
      detail: "Add vendor, category, or job link",
      to: "/finances/expenses",
    },
    {
      label: "Expense-only jobs",
      count: expenseOnlyJobIds.length,
      detail: "Costs exist without a linked invoice",
      to: "/finances/jobs",
    },
    {
      label: "Automation proposals",
      count: booksFoundation?.counts.proposedAutomation ?? 0,
      detail: "Hiring and Scout events waiting for accounting review",
      to: "/finances/records",
    },
  ];

  const booksStatusTiles = [
    ["Document records", "Live"],
    [
      "Connected automation",
      booksFoundation?.counts.proposedAutomation
        ? `${booksFoundation.counts.proposedAutomation} proposed`
        : booksFoundation?.capabilities.automation === "proposed_review"
          ? "Ready"
          : "Needed",
    ],
    [
      "Chart of accounts",
      booksFoundation?.capabilities.chartOfAccounts === "live"
        ? `${booksFoundation.counts.accounts} accounts`
        : "Needed",
    ],
    [
      "Double-entry ledger",
      booksFoundation?.capabilities.doubleEntryLedger === "partial"
        ? `${booksFoundation.counts.journalEntries} entries`
        : "Foundation",
    ],
    [
      "Bank reconciliation",
      booksFoundation?.capabilities.bankReconciliation === "partial" ? "Partial" : "Needed",
    ],
    ["Tax & payroll", "Needed"],
  ];

  const booksFoundationItems = [
    [
      "Chart of accounts",
      booksFoundation?.counts.accounts
        ? `${booksFoundation.counts.accounts} starter accounts are initialized`
        : "Needed before real P&L and balance sheet",
    ],
    [
      "Source-linked automation",
      booksFoundation?.counts.proposedAutomation
        ? `${booksFoundation.counts.proposedAutomation} Direct Connect hiring event${
            booksFoundation.counts.proposedAutomation === 1 ? "" : "s"
          } waiting for review`
        : "Direct Connect, Connections, and Scout events can create reviewable accounting drafts",
    ],
    ["Double-entry ledger", "Needed before automated posting"],
    ["Bank reconciliation", "Needed before cash accuracy claims"],
    ["AR/AP aging", "Needed before collections and bills are complete"],
    ["Tax and payroll boundaries", "Needed before compliance workflows"],
  ];

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

  const filteredJobInvoices = useMemo(() => {
    if (!jobQuery.trim()) return invoices;
    const q = jobQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      const payload = inv.payload || {};
      const title: string = payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`;
      const client: string | null = payload.clientName || null;
      return (
        title.toLowerCase().includes(q) ||
        (client ? client.toLowerCase().includes(q) : false) ||
        inv.id.toLowerCase().includes(q)
      );
    });
  }, [invoices, jobQuery]);

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

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const financeNavItems = [
    {
      key: "dashboard",
      label: "Dashboard",
      description: "KPIs and revenue trends",
      icon: LayoutDashboard,
      targetId: "finances-dashboard",
    },
    {
      key: "clients",
      label: "Clients",
      description: "Who you've billed and how much",
      icon: FileText,
      targetId: "finances-clients",
    },
    {
      key: "materials",
      label: "Materials",
      description: "Material lists for active jobs",
      icon: Handshake,
      targetId: "finances-materials",
    },
    {
      key: "estimates",
      label: "Estimates",
      description: "Quotes waiting for approval",
      icon: FileText,
      targetId: "finances-estimates",
    },
    {
      key: "jobs",
      label: "Jobs",
      description: "Job pipeline and workflow workspace",
      icon: Handshake,
      targetId: "finances-jobs",
    },
    {
      key: "invoices",
      label: "Invoices",
      description: "Open, paid, and standalone invoices",
      icon: FileText,
      targetId: "finances-invoices",
    },
    {
      key: "employees",
      label: "Employees",
      description: "People on your team",
      icon: LayoutDashboard,
      targetId: "finances-employees",
    },
    {
      key: "payroll",
      label: "Payroll",
      description: "Payouts and tax breakdowns",
      icon: BarChart3,
      targetId: "finances-payroll",
    },
    {
      key: "expenses",
      label: "Expenses",
      description: "Track money going out",
      icon: BarChart3,
      targetId: "finances-expenses",
    },
    {
      key: "vendors",
      label: "Vendors",
      description: "People and companies you pay",
      icon: Handshake,
      targetId: "finances-vendors",
    },
    {
      key: "bank-accounts",
      label: "Bank Accounts",
      description: "Connected accounts and syncs",
      icon: LayoutDashboard,
      targetId: "finances-bank-accounts",
    },
    {
      key: "reports",
      label: "Reports",
      description: "Deeper money analytics",
      icon: BarChart3,
      targetId: "finances-reports",
    },
    {
      key: "settings",
      label: "Settings",
      description: "Defaults, exports, and preferences",
      icon: Settings2,
      targetId: "finances-settings",
    },
  ];

  const handleNavClick = (key: string, targetId: string) => {
    setActiveNav(key);

    // All key flows now get their own dedicated routes
    if (key === "dashboard") {
      navigate("/finances");
      return;
    }
    if (key === "clients") {
      navigate("/finances/clients");
      return;
    }
    if (key === "materials") {
      navigate("/finances/materials");
      return;
    }
    if (key === "estimates") {
      navigate("/finances/estimates");
      return;
    }
    if (key === "jobs") {
      navigate("/finances/jobs");
      return;
    }
    if (key === "invoices") {
      navigate("/finances/invoices");
      return;
    }
    if (key === "employees") {
      navigate("/finances/employees");
      return;
    }
    if (key === "payroll") {
      navigate("/finances/payroll");
      return;
    }
    if (key === "expenses") {
      navigate("/finances/expenses");
      return;
    }
    if (key === "vendors") {
      navigate("/finances/vendors");
      return;
    }
    if (key === "bank-accounts") {
      navigate("/finances/bank-accounts");
      return;
    }
    if (key === "reports") {
      navigate("/finances/reports");
      return;
    }
    if (key === "settings") {
      navigate("/finances/settings");
      return;
    }
  };

  // Support deep-linking into a specific job via ?jobId= or ?projectId=
  useEffect(() => {
    if (!location || !invoices.length) return;
    const parts = location.split("?");
    if (!parts[1]) return;
    const params = new URLSearchParams(parts[1]);
    const jobId = params.get("jobId") || params.get("projectId");
    if (!jobId) return;
    const match = invoices.find((inv) => inv.job_id === jobId);
    if (!match) return;
    setSelectedJobId((current) => (current === match.job_id ? current : match.job_id));
  }, [location, invoices]);

  return (
    <Page className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0">
        <Card className="bg-tsCard border-white/10 mb-4 sticky top-0">
          <CardHeader className="pb-3 flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-white">Finances</CardTitle>
              {!navCollapsed && <CardDescription className="text-xs">Workspace</CardDescription>}
            </div>
            <button
              type="button"
              onClick={() => setNavCollapsed((prev) => !prev)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-tsCard text-white/70 hover:border-white/15 hover:bg-white/5"
              aria-label={
                navCollapsed ? "Expand finances navigation" : "Collapse finances navigation"
              }
            >
              {navCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          </CardHeader>
          {!navCollapsed && (
            <CardContent className="space-y-1.5">
              {financeNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeNav;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNavClick(item.key, item.targetId)}
                    className={`w-full flex items-start gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      isActive
                        ? "border-ts-orange/30 bg-ts-orange/10 text-white"
                        : "border-white/10 bg-black/30 text-white/70 hover:border-ts-orange/30 hover:bg-tsCard"
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-tsCard border border-white/10">
                      <Icon className="h-3.5 w-3.5 text-ts-orange" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[0.75rem] font-semibold leading-snug">
                        {item.label}
                      </span>
                      <span className="block text-[0.7rem] text-white/60 leading-snug">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </CardContent>
          )}
        </Card>
      </aside>

      <div className="flex-1 space-y-6">
        <section id="finances-dashboard" className="space-y-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">
                Finances command center
              </h1>
              <p className="text-sm text-white/60">
                Job money, records, and the path toward full books.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="h-8 px-3 text-[11px]"
                onClick={() => navigate("/finances/invoices")}
              >
                New invoice
              </Button>
            </div>
          </div>

          <Card className="bg-tsCard border-ts-orange/25">
            <CardContent className="p-4 md:p-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ts-orange">
                    <WalletCards className="h-4 w-4" />
                    QuickBooks replacement target
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    TradeScout is becoming the books layer for local work.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
                    What works today is document-centered: invoices, expenses, clients, records,
                    reports, and job flows. Full replacement still needs chart of accounts,
                    double-entry posting, bank reconciliation, tax handling, payroll boundaries,
                    accountant access, and close-period controls.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="h-8 px-3 text-[11px]"
                      onClick={() => navigate("/finances/records")}
                    >
                      Open records
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 border-white/15 text-[11px] text-white/75"
                      onClick={() => navigate("/finances/reports")}
                    >
                      Open reports
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 border-white/15 text-[11px] text-white/75"
                      onClick={() => navigate("/finances/jobs")}
                    >
                      Review jobs
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {booksStatusTiles.map(([label, state]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-white/10 bg-black/25 px-3 py-2"
                    >
                      <div className="text-white/55">{label}</div>
                      <div
                        className={
                          state === "Live" ||
                          state === "Ready" ||
                          String(state).includes("accounts")
                            ? "mt-1 font-semibold text-emerald-300"
                            : state === "Partial" ||
                                state === "Foundation" ||
                                String(state).includes("proposed") ||
                                String(state).includes("entries")
                              ? "mt-1 font-semibold text-amber-200"
                              : "mt-1 font-semibold text-white/75"
                        }
                      >
                        {state}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-white/70 uppercase tracking-wide">
                  Total Billed
                </CardTitle>
                <CardDescription>Lifetime</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-white">
                  {formatCurrency(lifetime?.totalAmount)}
                </div>
                <p className="mt-1 text-[11px] text-white/60">
                  {lifetime
                    ? `${lifetime.invoiceCount.toLocaleString()} documents`
                    : `${totalCount.toLocaleString()} documents`}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-white/70 uppercase tracking-wide">
                  Outstanding Invoices
                </CardTitle>
                <CardDescription>Work that has been billed but not yet paid.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-amber-300">
                  {formatCurrency(lifetime?.unpaidAmount)}
                </div>
                <p className="mt-1 text-[11px] text-white/60">
                  {lifetime
                    ? `${lifetime.unpaidCount.toLocaleString()} open invoice${
                        lifetime.unpaidCount === 1 ? "" : "s"
                      }`
                    : `${invoices.filter((i) => i.status !== "paid").length.toLocaleString()} open invoices`}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-white/70 uppercase tracking-wide">
                  Total Expenses
                </CardTitle>
                <CardDescription>Tracked costs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-300">
                  {formatCurrency(lifetime?.totalExpenses ?? 0)}
                </div>
                <p className="mt-1 text-[11px] text-white/60">
                  {expenses.length.toLocaleString()} recorded
                </p>
              </CardContent>
            </Card>

            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-white/70 uppercase tracking-wide">
                  Net Profit
                </CardTitle>
                <CardDescription>Revenue minus recorded expenses.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-sky-300">
                  {formatCurrency(lifetime ? lifetime.netProfit : 0)}
                </div>
                <p className="mt-1 text-[11px] text-white/60">
                  Based on invoices and expenses you track here.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-white">Review queue</CardTitle>
                <CardDescription className="text-xs text-white/60">
                  The dashboard should tell you what needs attention before money or records move.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {reviewQueue.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="rounded-lg border border-white/10 bg-black/25 px-3 py-3 text-left transition-colors hover:border-ts-orange/40 hover:bg-ts-orange/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-white">{item.label}</span>
                      <span className="text-lg font-semibold text-ts-orange">{item.count}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-white/55">{item.detail}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-white">Books foundation</CardTitle>
                <CardDescription className="text-xs text-white/60">
                  Required core before this can honestly replace full accounting software.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-[11px] text-white/65">
                {booksFoundationItems.map(([label, detail]) => (
                  <div
                    key={label}
                    className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
                    <div>
                      <div className="font-semibold text-white">{label}</div>
                      <div className="mt-0.5 text-white/55">{detail}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {chartData.length > 0 && (
            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white">Revenue Overview</CardTitle>
                <CardDescription>
                  Billed vs. collected amounts over your recent months.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ChartContainer
                  config={{
                    billed: {
                      label: "Billed",
                      color: "hsl(var(--chart-1))",
                    },
                    collected: {
                      label: "Collected",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-72 w-full"
                >
                  <LineChart data={chartData} margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) =>
                        typeof value === "number" ? value.toLocaleString() : String(value)
                      }
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="billed"
                      stroke="var(--color-billed)"
                      strokeWidth={2}
                      dot={false}
                      name="Billed"
                    />
                    <Line
                      type="monotone"
                      dataKey="collected"
                      stroke="var(--color-collected)"
                      strokeWidth={2}
                      dot={false}
                      name="Collected"
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)] gap-4">
            <Card className="bg-tsCard border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-white">
                    Recent invoices
                  </CardTitle>
                  <CardDescription className="text-xs text-white/60">
                    Latest job records you track here.
                  </CardDescription>
                </div>
                <Badge className="text-[10px] px-2 py-0.5 bg-white/5 border-white/15">
                  {recentInvoices.length} shown
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                {recentInvoices.length === 0 ? (
                  <div className="py-6 text-xs text-white/60">
                    No invoice history yet. As you create records, they'll appear here for quick
                    reference.
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <Table className="min-w-full text-xs">
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead className="w-[22%] text-white/60">Invoice</TableHead>
                          <TableHead className="w-[30%] text-white/60">Customer</TableHead>
                          <TableHead className="w-[22%] text-right text-white/60">Amount</TableHead>
                          <TableHead className="w-[26%] text-right text-white/60">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentInvoices.map((inv) => {
                          const payload = inv.payload || {};
                          const title: string =
                            payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`;
                          const client: string | null = payload.clientName || null;
                          const totalVal: number | null =
                            typeof payload.total === "number" ? payload.total : null;
                          const createdLabel = new Date(inv.created_at).toLocaleDateString();

                          const status = String(inv.status || "").toLowerCase();
                          const isPaid = status === "paid";
                          const isOverdue = status === "overdue" || status === "late";

                          return (
                            <TableRow key={inv.id} className="border-white/10 hover:bg-tsCard/95">
                              <TableCell className="align-top py-2">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-semibold text-white truncate max-w-[150px]">
                                    {title}
                                  </span>
                                  <span className="text-[10px] text-white/60">{createdLabel}</span>
                                </div>
                              </TableCell>
                              <TableCell className="align-top py-2">
                                <span className="text-[11px] text-white/70 truncate max-w-[160px]">
                                  {client || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="align-top py-2 text-right">
                                <span className="text-[11px] font-medium text-white">
                                  {totalVal !== null
                                    ? totalVal.toLocaleString(undefined, {
                                        style: "currency",
                                        currency: payload.currency || "USD",
                                      })
                                    : "—"}
                                </span>
                              </TableCell>
                              <TableCell className="align-top py-2 text-right">
                                <span
                                  className={`inline-flex items-center justify-end rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                                    isPaid
                                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                                      : isOverdue
                                        ? "bg-rose-500/10 text-rose-300 border-rose-500/40"
                                        : "bg-amber-500/10 text-amber-200 border-amber-500/40"
                                  }`}
                                >
                                  {inv.status || "Open"}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-white">
                  Recent money activity
                </CardTitle>
                <CardDescription className="text-xs text-white/60">Cash timeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentInvoices.length === 0 ? (
                  <div className="py-4 text-xs text-white/60">
                    Once you start marking invoices as paid, you'll see a quick money timeline here.
                  </div>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {recentInvoices.map((inv) => {
                      const payload = inv.payload || {};
                      const totalVal: number | null =
                        typeof payload.total === "number" ? payload.total : null;
                      const createdAt = new Date(inv.created_at);
                      const dateLabel = createdAt.toLocaleDateString();
                      const status = String(inv.status || "").toLowerCase();
                      const isPaid = status === "paid";

                      return (
                        <li
                          key={inv.id}
                          className="flex items-center justify-between gap-3 border-b border-white/10 last:border-0 pb-2 last:pb-0"
                        >
                          <div className="flex flex-col">
                            <span className="text-[11px] text-white">
                              {isPaid ? "Payment recorded" : "Invoice created"}
                            </span>
                            <span className="text-[10px] text-white/60">
                              {`${dateLabel} • ${payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`}`}
                            </span>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-[11px] font-semibold ${
                                isPaid ? "text-emerald-300" : "text-amber-200"
                              }`}
                            >
                              {totalVal !== null
                                ? (isPaid ? "+" : "") +
                                  totalVal.toLocaleString(undefined, {
                                    style: "currency",
                                    currency: payload.currency || "USD",
                                  })
                                : "—"}
                            </div>
                            <div className="text-[10px] text-white/60 capitalize">
                              {inv.status || "open"}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="finances-clients">
          <Card className="bg-tsCard border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white">Clients</CardTitle>
              <CardDescription className="text-xs text-white/60">Billed clients</CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              {invoices.length === 0 ? (
                <p className="text-xs text-white/60">
                  As you create invoices, you'll see clients summarized here.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <Table className="min-w-full text-xs">
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="w-[40%] text-white/60">Client</TableHead>
                        <TableHead className="w-[20%] text-right text-white/60">Jobs</TableHead>
                        <TableHead className="w-[20%] text-right text-white/60">Billed</TableHead>
                        <TableHead className="w-[20%] text-right text-white/60">
                          Outstanding
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(
                        invoices.reduce<
                          Record<string, { jobs: number; billed: number; outstanding: number }>
                        >((acc, inv) => {
                          const payload = inv.payload || {};
                          const name =
                            (payload.clientName as string | undefined)?.trim() ||
                            "Unlabeled client";
                          const total = typeof payload.total === "number" ? payload.total : 0;
                          const isPaid = String(inv.status || "").toLowerCase() === "paid";
                          if (!acc[name]) {
                            acc[name] = { jobs: 0, billed: 0, outstanding: 0 };
                          }
                          acc[name].jobs += 1;
                          acc[name].billed += total;
                          if (!isPaid) acc[name].outstanding += total;
                          return acc;
                        }, {})
                      ).map(([name, stats]) => (
                        <TableRow key={name} className="border-white/10 hover:bg-tsCard/95">
                          <TableCell className="py-2 text-white truncate max-w-[200px]">
                            {name}
                          </TableCell>
                          <TableCell className="py-2 text-right text-white/70">
                            {stats.jobs}
                          </TableCell>
                          <TableCell className="py-2 text-right text-white/70">
                            {stats.billed.toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                            })}
                          </TableCell>
                          <TableCell className="py-2 text-right text-white/70">
                            {stats.outstanding.toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="finances-materials">
          <Card className="bg-white/5 border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white mb-1">Materials</CardTitle>
              <CardDescription>
                Start and manage material lists from your job workflows. Pick a job under Jobs and
                use the material list actions there to kick off the cycle.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center text-xs text-white/70">
              <p className="max-w-xl">
                Material lists live at the job level so they stay tied to estimates, contracts, and
                invoices. Use the Money Workspace under Jobs to start a material list for a specific
                job.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 text-[11px]"
                onClick={() => handleNavClick("jobs", "finances-jobs")}
              >
                Go to Jobs
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="finances-estimates">
          <Card className="bg-white/5 border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white mb-1">Estimates</CardTitle>
              <CardDescription>
                Create, send, and approve estimates as part of each job workflow. Once approved,
                they automatically roll into contracts and invoices.
                <span className="block mt-1 text-xs text-ts-orange">
                  Need to double-check an estimate?{" "}
                  <a href="/tools/estimate-calculator" className="underline hover:text-ts-orange">
                    Estimate Calculator
                  </a>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center text-xs text-white/70">
              <p className="max-w-xl">
                Open a job under Jobs to see its current estimate, send it for approval, or approve
                it to generate a contract draft.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 text-[11px]"
                onClick={() => handleNavClick("jobs", "finances-jobs")}
              >
                Open job workflow
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="finances-invoices">
          <Card className="bg-white/5 border-white/10 mb-6">
            <CardHeader>
              <CardTitle className="text-white mb-1">New Invoice / Job Record</CardTitle>
              <CardDescription>
                Create a clean invoice record for work that ran off-platform so it still shows up in
                your ledger.
                <span className="block mt-1 text-xs text-ts-orange">
                  Need to check payment math?{" "}
                  <a href="/tools/invoice-calculator" className="underline hover:text-ts-orange">
                    Open Invoice Calculator
                  </a>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  placeholder="Project or job name"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="bg-tsCard/95 border-white/10 text-white text-sm"
                />
                <Input
                  placeholder="Client name (optional)"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="bg-tsCard/95 border-white/10 text-white text-sm"
                />
                <Input
                  placeholder="Total amount"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="bg-tsCard/95 border-white/10 text-white text-sm"
                />
              </div>
              <Input
                placeholder="Notes (what this work was for)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-tsCard/95 border-white/10 text-white text-sm"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => createInvoice.mutate()}
                  disabled={createInvoice.isPending}
                >
                  {createInvoice.isPending ? "Creating..." : "Create Invoice Record"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard border-white/10">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-white">All invoices</CardTitle>
                <CardDescription className="text-xs text-white/60">
                  Manage every standalone invoice you track here: send, record payment, or open in
                  the Money Workspace.
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1.5 text-[10px] text-white/60">
                  <button
                    type="button"
                    onClick={() => setInvoiceStatusFilter("all")}
                    className={`px-2 py-0.5 rounded-full border transition-colors ${
                      invoiceStatusFilter === "all"
                        ? "border-ts-orange/30 bg-ts-orange/10 text-white"
                        : "border-white/10 bg-tsCard text-white/70 hover:border-white/15"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceStatusFilter("open")}
                    className={`px-2 py-0.5 rounded-full border transition-colors ${
                      invoiceStatusFilter === "open"
                        ? "border-ts-orange/30 bg-ts-orange/10 text-white"
                        : "border-white/10 bg-tsCard text-white/70 hover:border-white/15"
                    }`}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceStatusFilter("paid")}
                    className={`px-2 py-0.5 rounded-full border transition-colors ${
                      invoiceStatusFilter === "paid"
                        ? "border-ts-orange/30 bg-ts-orange/10 text-white"
                        : "border-white/10 bg-tsCard text-white/70 hover:border-white/15"
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
                        ? "border-white/15 bg-white/5 text-white"
                        : "border-white/10 bg-tsBg text-white/70 hover:border-white/15"
                    }`}
                  >
                    All time
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceRangeFilter("90d")}
                    className={`px-2 py-0.5 rounded-full border transition-colors ${
                      invoiceRangeFilter === "90d"
                        ? "border-white/15 bg-white/5 text-white"
                        : "border-white/10 bg-tsBg text-white/70 hover:border-white/15"
                    }`}
                  >
                    Last 90 days
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceRangeFilter("365d")}
                    className={`px-2 py-0.5 rounded-full border transition-colors ${
                      invoiceRangeFilter === "365d"
                        ? "border-white/15 bg-white/5 text-white"
                        : "border-white/10 bg-tsBg text-white/70 hover:border-white/15"
                    }`}
                  >
                    Last year
                  </button>
                </div>
                <Badge className="text-[10px] px-2 py-0.5 bg-white/5 border-white/15">
                  {filteredInvoicesForTable.length} shown of {invoices.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              {invoices.length === 0 ? (
                <p className="text-xs text-white/60">
                  Once you start creating invoice records, you'll see them listed here with quick
                  actions.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-2">
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
                          const payment: any = (payload as any).payment || null;
                          const paidDateLabel = payment?.receivedAt
                            ? new Date(payment.receivedAt).toLocaleDateString()
                            : createdLabel;

                          return (
                            <TableRow key={inv.id} className="border-white/10 hover:bg-tsCard/95">
                              <TableCell className="py-2 text-white/70 text-[11px]">
                                {createdLabel}
                              </TableCell>
                              <TableCell className="py-2 text-white text-[11px] truncate max-w-[220px]">
                                {title}
                              </TableCell>
                              <TableCell className="py-2 text-white/70 text-[11px] truncate max-w-[180px]">
                                {client || "—"}
                              </TableCell>
                              <TableCell className="py-2 text-right text-[11px] text-white">
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
                                          : "bg-white/10 text-white/70 border-white/15"
                                    }`}
                                  >
                                    {inv.status || "draft"}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 border-white/15 text-[10px]"
                                      onClick={() => {
                                        setSelectedJobId(inv.job_id);
                                        handleNavClick("jobs", "finances-jobs");
                                      }}
                                    >
                                      Open
                                    </Button>
                                    {status === "draft" && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 border-white/15 text-[10px]"
                                        disabled={
                                          sendInvoice.isPending || markInvoicePaid.isPending
                                        }
                                        onClick={() => sendInvoice.mutate(inv.id)}
                                      >
                                        {sendInvoice.isPending ? "Sending..." : "Send"}
                                      </Button>
                                    )}
                                    {(status === "sent" || status === "approved") && !isPaid && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-2 border-white/15 text-[10px]"
                                        disabled={
                                          markInvoicePaid.isPending || sendInvoice.isPending
                                        }
                                        onClick={() => markInvoicePaid.mutate(inv.id)}
                                      >
                                        {markInvoicePaid.isPending
                                          ? "Recording..."
                                          : "Record payment"}
                                      </Button>
                                    )}
                                  </div>
                                  {isPaid && (
                                    <div className="text-[10px] text-white/60 mt-0.5 text-right">
                                      Paid {paidDateLabel}
                                      {payment?.method
                                        ? ` via ${String(payment.method).toLowerCase()}`
                                        : ""}
                                      {payment?.reference ? ` · Ref ${payment.reference}` : ""}
                                    </div>
                                  )}
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
        </section>

        <section id="finances-jobs">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="text-white">Money Workspace</CardTitle>
                  <CardDescription>
                    Pick a job record on the left, then manage it in the workflow panel.
                  </CardDescription>
                </div>
                <div className="flex flex-col items-stretch gap-2 w-full md:w-auto">
                  <Input
                    placeholder="Search jobs by name, client, or ID"
                    value={jobQuery}
                    onChange={(e) => setJobQuery(e.target.value)}
                    className="bg-tsCard/95 border-white/10 text-xs text-white h-8 min-w-[220px]"
                  />
                  {pageCount > 1 && (
                    <div className="flex items-center gap-2 text-[11px] text-white/60">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 border-white/15"
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
                        className="h-7 px-2 border-white/15"
                        disabled={page >= pageCount}
                        onClick={() => setPage((p) => (p < pageCount ? p + 1 : p))}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                  {effectiveJobId && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 border-white/15 text-[11px] text-white/70 mt-1"
                        onClick={() =>
                          navigate(
                            `/finances/jobs?jobId=${encodeURIComponent(effectiveJobId || "")}`
                          )
                        }
                      >
                        Open in finances jobs
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-6 text-center text-sm text-white/60">
                  Loading invoice records...
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-6 text-center text-sm text-white/60">
                  No invoice records yet. Use the form above to create your first invoice for a job,
                  even if it ran off TradeScout.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)] gap-6">
                  <div className="space-y-2">
                    {filteredJobInvoices.length === 0 ? (
                      <div className="py-4 text-center text-xs text-white/60">
                        No jobs match this search. Try a different name, client, or ID.
                      </div>
                    ) : (
                      filteredJobInvoices.map((inv) => {
                        const payload = inv.payload || {};
                        const title: string =
                          payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`;
                        const client: string | null = payload.clientName || null;
                        const totalVal: number | null =
                          typeof payload.total === "number" ? payload.total : null;
                        const createdLabel = new Date(inv.created_at).toLocaleDateString();

                        const isSelected = inv.job_id === effectiveJobId;

                        return (
                          <Card
                            key={inv.id}
                            className={`bg-tsCard/95 border-white/10 hover:border-ts-orange/30 transition-colors cursor-pointer ${
                              isSelected ? "ring-1 ring-ts-orange/70" : ""
                            }`}
                            onClick={() => setSelectedJobId(inv.job_id)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-sm font-semibold text-white truncate max-w-xs">
                                      {title}
                                    </h3>
                                    <Badge className="text-[10px] px-2 py-0.5 bg-white/5 border-white/15">
                                      {inv.status}
                                    </Badge>
                                  </div>
                                  {client && (
                                    <p className="text-[11px] text-white/70">Client: {client}</p>
                                  )}
                                  <p className="text-[11px] text-white/60 mt-1">
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
                      })
                    )}
                  </div>

                  <div className="min-h-[260px]">
                    {effectiveJobId ? (
                      <WorkflowPanel jobId={effectiveJobId} userRole={role} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-white/60 border border-dashed border-white/10 rounded-md bg-tsCard/95 p-4">
                        Select an invoice on the left to open it in the workflow panel.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="finances-employees">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Employees</CardTitle>
              <CardDescription className="text-xs text-white/60">Team snapshot</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-white/60">
                Manage hiring and crew from business tools.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="finances-payroll">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Payroll</CardTitle>
              <CardDescription className="text-xs text-white/60">Payout summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] text-white/60">
              <p>Use Wallet statements and payroll exports for reconciliation.</p>
            </CardContent>
          </Card>
        </section>

        <section id="finances-expenses">
          <Card className="bg-tsCard border-white/10">
            <CardHeader className="pb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-white">Expenses</CardTitle>
                <CardDescription className="text-xs text-white/60">
                  Track money going out so you can see true job profitability.
                  {expenseHelperLink && (
                    <span className="block mt-1 text-xs text-ts-orange">
                      Need help splitting or categorizing?{" "}
                      <a href="/tools/expense-helper" className="underline hover:text-ts-orange">
                        Expense Helper
                      </a>
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="text-[11px] text-white/60">
                {expenses.length.toLocaleString()} recorded expense
                {expenses.length === 1 ? "" : "s"}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input
                    placeholder="Project or job name"
                    value={expenseProjectTitle}
                    onChange={(e) => setExpenseProjectTitle(e.target.value)}
                    className="bg-tsCard/95 border-white/10 text-white text-sm"
                  />
                  <Input
                    placeholder="Vendor (optional)"
                    value={expenseVendor}
                    onChange={(e) => setExpenseVendor(e.target.value)}
                    className="bg-tsCard/95 border-white/10 text-white text-sm"
                  />
                  <Input
                    placeholder="Category (optional)"
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="bg-tsCard/95 border-white/10 text-white text-sm"
                  />
                  <Input
                    placeholder="Total amount"
                    value={expenseTotal}
                    onChange={(e) => setExpenseTotal(e.target.value)}
                    className="bg-tsCard/95 border-white/10 text-white text-sm"
                  />
                </div>
                <Input
                  placeholder="Notes (what this expense was for)"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="bg-tsCard/95 border-white/10 text-white text-sm"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => createExpense.mutate()}
                    disabled={createExpense.isPending}
                  >
                    {createExpense.isPending ? "Recording..." : "Record Expense"}
                  </Button>
                </div>
              </div>

              {expenses.length === 0 ? (
                <p className="text-[11px] text-white/60">
                  Once you start recording expenses, you'll see a simple ledger here alongside your
                  invoices.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <Table className="min-w-full text-xs">
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="w-[20%] text-white/60">Date</TableHead>
                        <TableHead className="w-[28%] text-white/60">Project</TableHead>
                        <TableHead className="w-[22%] text-white/60">Vendor</TableHead>
                        <TableHead className="w-[15%] text-white/60">Category</TableHead>
                        <TableHead className="w-[15%] text-right text-white/60">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((exp) => {
                        const payload = exp.payload || {};
                        const title: string =
                          payload.projectTitle || `Expense ${exp.id.slice(0, 8)}`;
                        const vendor: string | null = payload.vendorName || null;
                        const category: string | null = payload.category || null;
                        const totalVal: number | null =
                          typeof payload.total === "number" ? payload.total : null;
                        const createdLabel = new Date(exp.created_at).toLocaleDateString();

                        return (
                          <TableRow key={exp.id} className="border-white/10 hover:bg-tsCard/95">
                            <TableCell className="py-2 text-[11px] text-white/70">
                              {createdLabel}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-white truncate max-w-[220px]">
                              {title}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-white/70 truncate max-w-[180px]">
                              {vendor || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-white/70 truncate max-w-[160px]">
                              {category || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-right text-[11px] text-white">
                              {totalVal !== null
                                ? totalVal.toLocaleString(undefined, {
                                    style: "currency",
                                    currency: payload.currency || "USD",
                                  })
                                : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="finances-vendors">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Vendors</CardTitle>
              <CardDescription className="text-xs text-white/60">Supplier records</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-white/60">
                Vendor tooling available in upcoming updates.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="finances-bank-accounts">
          <Card className="bg-tsCard border-white/10">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-white">Bank accounts</CardTitle>
                <CardDescription className="text-xs text-white/60">
                  Connection status
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 border-white/15 text-[11px] text-white/70"
                disabled
              >
                Banking integration not enabled
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-white/60">
                Bank sync is not enabled on this page yet.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="finances-reports">
          <Card className="bg-tsCard border-white/10">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-white">Reports</CardTitle>
                <CardDescription className="text-xs text-white/60">Performance</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 border-white/15 text-[11px] text-white/70"
                onClick={handleExportInvoicesCsv}
                disabled={!invoices.length}
              >
                Export invoices CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!summary ? (
                <p className="text-[11px] text-white/60">No report data yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                    <div className="rounded-md border border-white/10 bg-tsCard px-3 py-2">
                      <div className="text-white/60 mb-1">Lifetime billed</div>
                      <div className="text-white font-semibold text-sm">
                        {formatCurrency(summary.lifetime.totalAmount)}
                      </div>
                      <div className="text-white/60 mt-0.5">
                        {summary.lifetime.invoiceCount.toLocaleString()} documents
                      </div>
                    </div>
                    <div className="rounded-md border border-white/10 bg-tsCard px-3 py-2">
                      <div className="text-white/60 mb-1">Collected</div>
                      <div className="text-emerald-300 font-semibold text-sm">
                        {formatCurrency(summary.lifetime.paidAmount)}
                      </div>
                      <div className="text-white/60 mt-0.5">
                        {summary.lifetime.paidCount.toLocaleString()} paid invoices
                      </div>
                    </div>
                    <div className="rounded-md border border-white/10 bg-tsCard px-3 py-2">
                      <div className="text-white/60 mb-1">Outstanding</div>
                      <div className="text-amber-300 font-semibold text-sm">
                        {formatCurrency(summary.lifetime.unpaidAmount)}
                      </div>
                      <div className="text-white/60 mt-0.5">
                        {summary.lifetime.unpaidCount.toLocaleString()} open invoices
                      </div>
                    </div>
                  </div>

                  {monthly.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-white/70">Monthly breakdown</h3>
                        <p className="text-[10px] text-white/60">Month to month</p>
                      </div>
                      <div className="overflow-x-auto -mx-2">
                        <Table className="min-w-full text-[11px]">
                          <TableHeader>
                            <TableRow className="border-white/10">
                              <TableHead className="w-[30%] text-white/60">Month</TableHead>
                              <TableHead className="w-[35%] text-right text-white/60">
                                Billed
                              </TableHead>
                              <TableHead className="w-[35%] text-right text-white/60">
                                Collected
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthly.map((row) => (
                              <TableRow key={row.month} className="border-white/10">
                                <TableCell className="py-2 text-white">{row.month}</TableCell>
                                <TableCell className="py-2 text-right text-white/70">
                                  {formatCurrency(row.totalAmount)}
                                </TableCell>
                                <TableCell className="py-2 text-right text-white/70">
                                  {formatCurrency(row.paidAmount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="finances-settings">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-white">Financial settings</CardTitle>
              <CardDescription className="text-xs text-white/60">Preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-white/60">Configure defaults and export settings.</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </Page>
  );
}
