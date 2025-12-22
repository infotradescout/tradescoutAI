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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { LayoutDashboard, FileText, Handshake, BarChart3, Settings2 } from "lucide-react";
import { LayoutDashboard, FileText, Handshake, BarChart3, Settings2 } from "lucide-react";

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
  const [activeNav, setActiveNav] = useState<string>("overview");

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

  const lifetime = summary?.lifetime;
  const monthly = summary?.byMonth ?? [];

  const chartData = monthly.map((m) => ({
    month: m.month,
    billed: m.totalAmount,
    collected: m.paidAmount,
  }));

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const financeNavItems = [
    {
      key: "overview",
      label: "Overview",
      description: "KPIs and revenue trends",
      icon: LayoutDashboard,
      targetId: "finances-overview",
    },
    {
      key: "invoices",
      label: "Invoices & jobs",
      description: "Off-platform records you track here",
      icon: FileText,
      targetId: "finances-invoices",
    },
    {
      key: "deal-room",
      label: "Deal rooms",
      description: "Job conversations and terms",
      icon: Handshake,
      targetId: "finances-deal-room",
    },
    {
      key: "reports",
      label: "Reports",
      description: "More detailed money views (coming soon)",
      icon: BarChart3,
      targetId: "finances-overview",
    },
    {
      key: "settings",
      label: "Settings",
      description: "Banking, exports, and preferences",
      icon: Settings2,
      targetId: "finances-overview",
    },
  ];

  const handleNavClick = (key: string, targetId: string) => {
    setActiveNav(key);
    if (typeof document !== "undefined") {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-64 xl:w-72 flex-shrink-0">
        <Card className="bg-slate-900 border-slate-800 mb-4 sticky top-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white">Finances</CardTitle>
            <CardDescription className="text-xs">
              Navigate your money workspace: overview, invoices, and deal rooms.
            </CardDescription>
          </CardHeader>
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
        </Card>
      </aside>

      <div className="flex-1 space-y-6">
        <section id="finances-overview" className="space-y-4">
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
                  Collected
                </CardTitle>
                <CardDescription>Payments that have been recorded as paid.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-300">
                  {formatCurrency(lifetime?.paidAmount)}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {lifetime
                    ? `${lifetime.paidCount.toLocaleString()} paid invoice${
                        lifetime.paidCount === 1 ? "" : "s"
                      }`
                    : `${invoices.filter((i) => i.status === "paid").length.toLocaleString()} paid invoices`}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-medium text-slate-300 uppercase tracking-wide">
                  Job Documents
                </CardTitle>
                <CardDescription>All standalone records you manage here.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-sky-300">{totalCount.toLocaleString()}</div>
                <p className="mt-1 text-[11px] text-slate-400">Includes paid and unpaid invoices.</p>
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
        </section>

        <section id="finances-deal-room">
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
        </section>
      </div>
    </div>
  );
}
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
