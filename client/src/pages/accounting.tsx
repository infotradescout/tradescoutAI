import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { DealRoomRole } from "@/lib/dealRoomState";
import { DealRoomPanel } from "@/components/jobs/DealRoomPanel";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { LayoutDashboard, FileText, Handshake, BarChart3, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";

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
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const invoices = data?.invoices ?? [];
  const expenses = expensesData?.expenses ?? [];
  const totalCount = data?.pagination?.totalCount ?? invoices.length;
  const pageCount = data?.pagination?.pageCount ?? 1;
  const selectedInvoice = invoices.find((inv) => inv.job_id === selectedJobId) ?? invoices[0] ?? null;
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
      description: "Job pipeline and deal room",
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

    // Key money flows get their own dedicated routes; the rest still scroll
    if (key === "dashboard") {
      navigate("/finances");
      return;
    }
    if (key === "invoices") {
      navigate("/finances/invoices");
      return;
    }
    if (key === "expenses") {
      navigate("/finances/expenses");
      return;
    }

    if (typeof document !== "undefined") {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0">
        <Card className="bg-slate-900 border-slate-800 mb-4 sticky top-0">
          <CardHeader className="pb-3 flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-white">Finances</CardTitle>
              {!navCollapsed && (
                <CardDescription className="text-xs">
                  Navigate your money workspace: jobs, invoices, expenses, and more.
                </CardDescription>
              )}
            </div>
            <button
              type="button"
              onClick={() => setNavCollapsed((prev) => !prev)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
              aria-label={navCollapsed ? "Expand finances navigation" : "Collapse finances navigation"}
            >
              {navCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
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
                        ? "border-orange-500 bg-orange-500/10 text-white"
                        : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-orange-500/60 hover:bg-slate-900"
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 border border-slate-700">
                      <Icon className="h-3.5 w-3.5 text-orange-400" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[0.75rem] font-semibold leading-snug">
                        {item.label}
                      </span>
                      <span className="block text-[0.7rem] text-slate-400 leading-snug">
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
          <div className="mb-4">
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 mb-1">
              Dashboard
            </h1>
            <p className="text-sm text-slate-400">
              Welcome back! Here's an overview of your contracting business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-slate-300 uppercase tracking-wide">
                  Total Billed
                </CardTitle>
                <CardDescription>Lifetime revenue across all job records.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-white">
                  {formatCurrency(lifetime?.totalAmount)}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {lifetime
                    ? `${lifetime.invoiceCount.toLocaleString()} documents`
                    : `${totalCount.toLocaleString()} documents`}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-slate-300 uppercase tracking-wide">
                  Outstanding Invoices
                </CardTitle>
                <CardDescription>Work that has been billed but not yet paid.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-amber-300">
                  {formatCurrency(lifetime?.unpaidAmount)}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {lifetime
                    ? `${lifetime.unpaidCount.toLocaleString()} open invoice${
                        lifetime.unpaidCount === 1 ? "" : "s"
                      }`
                    : `${invoices.filter((i) => i.status !== "paid").length.toLocaleString()} open invoices`}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-slate-300 uppercase tracking-wide">
                  Total Expenses
                </CardTitle>
                <CardDescription>Recorded costs tied to your jobs and business.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-300">
                  {formatCurrency(lifetime?.totalExpenses ?? 0)}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Recorded expenses across this standalone finances workspace.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-slate-300 uppercase tracking-wide">
                  Net Profit
                </CardTitle>
                <CardDescription>Revenue minus recorded expenses.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-sky-300">
                  {formatCurrency(lifetime ? lifetime.netProfit : (lifetime?.totalAmount ?? 0) - (lifetime?.totalExpenses ?? 0))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Based on invoices and expenses you track here.
                </p>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 0 && (
            <Card className="bg-slate-900 border-slate-700">
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
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-100">Recent invoices</CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Latest job records you track here.
                  </CardDescription>
                </div>
                <Badge className="text-[10px] px-2 py-0.5 bg-slate-800 border-slate-600">
                  {recentInvoices.length} shown
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                {recentInvoices.length === 0 ? (
                  <div className="py-6 text-xs text-slate-400">
                    No invoice history yet. As you create records, they'll appear here for quick reference.
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <Table className="min-w-full text-xs">
                      <TableHeader>
                        <TableRow className="border-slate-800">
                          <TableHead className="w-[22%] text-slate-400">Invoice</TableHead>
                          <TableHead className="w-[30%] text-slate-400">Customer</TableHead>
                          <TableHead className="w-[22%] text-right text-slate-400">Amount</TableHead>
                          <TableHead className="w-[26%] text-right text-slate-400">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentInvoices.map((inv) => {
                          const payload = inv.payload || {};
                          const title: string = payload.projectTitle || `Invoice ${inv.id.slice(0, 8)}`;
                          const client: string | null = payload.clientName || null;
                          const totalVal: number | null =
                            typeof payload.total === "number" ? payload.total : null;
                          const createdLabel = new Date(inv.created_at).toLocaleDateString();

                          const status = String(inv.status || "").toLowerCase();
                          const isPaid = status === "paid";
                          const isOverdue = status === "overdue" || status === "late";

                          return (
                            <TableRow key={inv.id} className="border-slate-800 hover:bg-slate-900/80">
                              <TableCell className="align-top py-2">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-semibold text-slate-100 truncate max-w-[150px]">
                                    {title}
                                  </span>
                                  <span className="text-[10px] text-slate-500">{createdLabel}</span>
                                </div>
                              </TableCell>
                              <TableCell className="align-top py-2">
                                <span className="text-[11px] text-slate-200 truncate max-w-[160px]">
                                  {client || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="align-top py-2 text-right">
                                <span className="text-[11px] font-medium text-slate-100">
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

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-100">Recent money activity</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Paid invoices show up as positive inflows; everything else stays as open work.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentInvoices.length === 0 ? (
                  <div className="py-4 text-xs text-slate-400">
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
                          className="flex items-center justify-between gap-3 border-b border-slate-800 last:border-0 pb-2 last:pb-0"
                        >
                          <div className="flex flex-col">
                            <span className="text-[11px] text-slate-100">
                              {isPaid ? "Payment recorded" : "Invoice created"}
                            </span>
                            <span className="text-[10px] text-slate-500">
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
                            <div className="text-[10px] text-slate-500 capitalize">{inv.status || "open"}</div>
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
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-100">Clients</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Roll-up of who you've billed through this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              {invoices.length === 0 ? (
                <p className="text-xs text-slate-400">
                  As you create invoices, you'll see clients summarized here.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <Table className="min-w-full text-xs">
                    <TableHeader>
                      <TableRow className="border-slate-800">
                        <TableHead className="w-[40%] text-slate-400">Client</TableHead>
                        <TableHead className="w-[20%] text-right text-slate-400">Jobs</TableHead>
                        <TableHead className="w-[20%] text-right text-slate-400">Billed</TableHead>
                        <TableHead className="w-[20%] text-right text-slate-400">Outstanding</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(
                        invoices.reduce<Record<string, { jobs: number; billed: number; outstanding: number }>>(
                          (acc, inv) => {
                            const payload = inv.payload || {};
                            const name = (payload.clientName as string | undefined)?.trim() || "Unlabeled client";
                            const total = typeof payload.total === "number" ? payload.total : 0;
                            const isPaid = String(inv.status || "").toLowerCase() === "paid";
                            if (!acc[name]) {
                              acc[name] = { jobs: 0, billed: 0, outstanding: 0 };
                            }
                            acc[name].jobs += 1;
                            acc[name].billed += total;
                            if (!isPaid) acc[name].outstanding += total;
                            return acc;
                          },
                          {},
                        ),
                      ).map(([name, stats]) => (
                        <TableRow key={name} className="border-slate-800 hover:bg-slate-900/80">
                          <TableCell className="py-2 text-slate-100 truncate max-w-[200px]">{name}</TableCell>
                          <TableCell className="py-2 text-right text-slate-200">{stats.jobs}</TableCell>
                          <TableCell className="py-2 text-right text-slate-200">
                            {stats.billed.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                          </TableCell>
                          <TableCell className="py-2 text-right text-slate-200">
                            {stats.outstanding.toLocaleString(undefined, { style: "currency", currency: "USD" })}
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
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white mb-1">Materials</CardTitle>
              <CardDescription>
                Start and manage material lists from your job deal rooms. Pick a job under Jobs 
                and use the material list actions there to kick off the cycle.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center text-xs text-slate-300">
              <p className="max-w-xl">
                Material lists live at the job level so they stay tied to estimates, contracts, and invoices.
                Use the Money Workspace under Jobs to start a material list for a specific job.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 text-[11px]"
                onClick={() => handleNavClick("jobs", "finances-jobs")}
              >
                Go to Jobs workspace
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="finances-estimates">
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white mb-1">Estimates</CardTitle>
              <CardDescription>
                Create, send, and approve estimates as part of each job's deal room. Once approved, they
                automatically roll into contracts and invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center text-xs text-slate-300">
              <p className="max-w-xl">
                Open a job under Jobs to see its current estimate, send it for approval, or approve it to
                generate a contract draft.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 text-[11px]"
                onClick={() => handleNavClick("jobs", "finances-jobs")}
              >
                Open job deal room
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="finances-invoices">
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

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-100">All invoices</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Manage every standalone invoice you track here: send, record payment, or open in the Money Workspace.
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
                <Badge className="text-[10px] px-2 py-0.5 bg-slate-800 border-slate-600">
                  {filteredInvoicesForTable.length} shown of {invoices.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              {invoices.length === 0 ? (
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
                          const payment: any = (payload as any).payment || null;
                          const paidDateLabel = payment?.receivedAt
                            ? new Date(payment.receivedAt).toLocaleDateString()
                            : createdLabel;

                          return (
                            <TableRow key={inv.id} className="border-slate-800 hover:bg-slate-900/70">
                              <TableCell className="py-2 text-slate-200 text-[11px]">{createdLabel}</TableCell>
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
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 border-slate-600 text-[10px]"
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
                                  {isPaid && (
                                    <div className="text-[10px] text-slate-400 mt-0.5 text-right">
                                      Paid {paidDateLabel}
                                      {payment?.method ? ` via ${String(payment.method).toLowerCase()}` : ""}
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
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="text-white">Money Workspace</CardTitle>
                  <CardDescription>Pick a job record on the left, then manage it in the deal room.</CardDescription>
                </div>
                <div className="flex flex-col items-stretch gap-2 w-full md:w-auto">
                  <Input
                    placeholder="Search jobs by name, client, or ID"
                    value={jobQuery}
                    onChange={(e) => setJobQuery(e.target.value)}
                    className="bg-slate-900/60 border-slate-700 text-xs text-slate-100 h-8 min-w-[220px]"
                  />
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
                  {effectiveJobId && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-3 border-slate-600 text-[11px] text-slate-200 mt-1"
                        onClick={() => navigate(`/deal-room/${encodeURIComponent(effectiveJobId || "")}`)}
                      >
                        Open full deal room
                      </Button>
                    </div>
                  )}
                </div>
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
                    {filteredJobInvoices.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-500">
                        No jobs match this search. Try a different name, client, or ID.
                      </div>
                    ) : (
                      filteredJobInvoices.map((inv) => {
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
                    }))}
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
        </section>

        <section id="finances-employees">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-100">Employees</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                High-level view of people doing the work. Detailed hiring and team tools live elsewhere in TradeScout.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-slate-400">
                Use your contractor dashboard and Worker Marketplace to add or manage crew. As payroll and
                time tracking tighten into Finances, this tab will show headcount, roles, and pay summaries.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="finances-payroll">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-100">Payroll</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Summaries of payouts and tax statements driven by your wallet and external payroll tools.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] text-slate-400">
              <p>
                Today, TradeScout Wallet and your tax statements provide the source of truth for on-platform
                payouts. Use the Wallet page to download period statements for bookkeeping and tax prep.
              </p>
              <p>
                As payroll integrations are wired, this tab will surface gross vs. net, employer taxes, and
                links into your payroll provider.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="finances-expenses">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-100">Expenses</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Track money going out so you can see true job profitability.
                </CardDescription>
              </div>
              <div className="text-[11px] text-slate-400">
                {expenses.length.toLocaleString()} recorded expense{expenses.length === 1 ? "" : "s"}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input
                    placeholder="Project or job name"
                    value={expenseProjectTitle}
                    onChange={(e) => setExpenseProjectTitle(e.target.value)}
                    className="bg-slate-900/60 border-slate-700 text-white text-sm"
                  />
                  <Input
                    placeholder="Vendor (optional)"
                    value={expenseVendor}
                    onChange={(e) => setExpenseVendor(e.target.value)}
                    className="bg-slate-900/60 border-slate-700 text-white text-sm"
                  />
                  <Input
                    placeholder="Category (optional)"
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="bg-slate-900/60 border-slate-700 text-white text-sm"
                  />
                  <Input
                    placeholder="Total amount"
                    value={expenseTotal}
                    onChange={(e) => setExpenseTotal(e.target.value)}
                    className="bg-slate-900/60 border-slate-700 text-white text-sm"
                  />
                </div>
                <Input
                  placeholder="Notes (what this expense was for)"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="bg-slate-900/60 border-slate-700 text-white text-sm"
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
                <p className="text-[11px] text-slate-400">
                  Once you start recording expenses, you'll see a simple ledger here alongside your invoices.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <Table className="min-w-full text-xs">
                    <TableHeader>
                      <TableRow className="border-slate-800">
                        <TableHead className="w-[20%] text-slate-400">Date</TableHead>
                        <TableHead className="w-[28%] text-slate-400">Project</TableHead>
                        <TableHead className="w-[22%] text-slate-400">Vendor</TableHead>
                        <TableHead className="w-[15%] text-slate-400">Category</TableHead>
                        <TableHead className="w-[15%] text-right text-slate-400">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((exp) => {
                        const payload = exp.payload || {};
                        const title: string = payload.projectTitle || `Expense ${exp.id.slice(0, 8)}`;
                        const vendor: string | null = payload.vendorName || null;
                        const category: string | null = payload.category || null;
                        const totalVal: number | null =
                          typeof payload.total === "number" ? payload.total : null;
                        const createdLabel = new Date(exp.created_at).toLocaleDateString();

                        return (
                          <TableRow
                            key={exp.id}
                            className="border-slate-800 hover:bg-slate-900/70"
                          >
                            <TableCell className="py-2 text-[11px] text-slate-200">
                              {createdLabel}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-slate-100 truncate max-w-[220px]">
                              {title}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-slate-200 truncate max-w-[180px]">
                              {vendor || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-slate-200 truncate max-w-[160px]">
                              {category || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-right text-[11px] text-slate-100">
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
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-100">Vendors</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Suppliers, subs, and services you rely on to get jobs done.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-slate-400">
                TradeScout already tracks HOA vendors and verified providers. As business-vendor tooling lands
                here, this tab will connect those records to your job and expense history.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="finances-bank-accounts">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-100">Bank accounts</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  TradeScout tracks job money flows today. Direct bank connections will plug in here when enabled.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 border-slate-600 text-[11px] text-slate-200"
                disabled
              >
                Connect banking (coming soon)
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-slate-400">
                For now, use invoice records, Wallet, and the money workspace to keep your off-platform jobs
                organized. When live, connected accounts will surface balances and recent bank activity here.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="finances-reports">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-100">Reports</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  High-level breakdowns of billed vs. collected revenue over time.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 border-slate-600 text-[11px] text-slate-200"
                onClick={handleExportInvoicesCsv}
                disabled={!invoices.length}
              >
                Export invoices CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!summary ? (
                <p className="text-[11px] text-slate-400">
                  The Dashboard gives you month-over-month revenue trends, while Wallet tax statements summarize
                  income for specific periods. When more data is available, this Reports tab will surface
                  exportable breakdowns and accountant-friendly views.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
                      <div className="text-slate-400 mb-1">Lifetime billed</div>
                      <div className="text-slate-50 font-semibold text-sm">
                        {formatCurrency(summary.lifetime.totalAmount)}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {summary.lifetime.invoiceCount.toLocaleString()} documents
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
                      <div className="text-slate-400 mb-1">Collected</div>
                      <div className="text-emerald-300 font-semibold text-sm">
                        {formatCurrency(summary.lifetime.paidAmount)}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {summary.lifetime.paidCount.toLocaleString()} paid invoices
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
                      <div className="text-slate-400 mb-1">Outstanding</div>
                      <div className="text-amber-300 font-semibold text-sm">
                        {formatCurrency(summary.lifetime.unpaidAmount)}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {summary.lifetime.unpaidCount.toLocaleString()} open invoices
                      </div>
                    </div>
                  </div>

                  {monthly.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-semibold text-slate-200">Monthly breakdown</h3>
                        <p className="text-[10px] text-slate-500">
                          Use this to see how work and cash collection move month to month.
                        </p>
                      </div>
                      <div className="overflow-x-auto -mx-2">
                        <Table className="min-w-full text-[11px]">
                          <TableHeader>
                            <TableRow className="border-slate-800">
                              <TableHead className="w-[30%] text-slate-400">Month</TableHead>
                              <TableHead className="w-[35%] text-right text-slate-400">Billed</TableHead>
                              <TableHead className="w-[35%] text-right text-slate-400">Collected</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthly.map((row) => (
                              <TableRow key={row.month} className="border-slate-800">
                                <TableCell className="py-2 text-slate-100">{row.month}</TableCell>
                                <TableCell className="py-2 text-right text-slate-200">
                                  {formatCurrency(row.totalAmount)}
                                </TableCell>
                                <TableCell className="py-2 text-right text-slate-200">
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
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-100">Financial settings</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Control currency defaults, numbering, and export preferences for your Finances workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-slate-400">
                As the accounting engine deepens, this tab will let you tune invoice numbering, tax settings,
                and export destinations so TradeScout matches how your bookkeeper and CPA work.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

