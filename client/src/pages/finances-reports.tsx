import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

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

export default function FinancesReportsPage() {
  const { user } = useAuth();
  const isCommunityFirst = Boolean((user as any)?.communityFirst);
  const [range, setRange] = useState<"all" | "90d" | "365d">("90d");

  const { data } = useQuery<AccountingSummary>({
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

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery<StandaloneInvoicesResponse>({
    queryKey: ["/api/accounting/standalone-invoices", 1, 500],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "500" });
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

  const lifetime = data?.lifetime;

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  const period = useMemo(() => {
    const invoices = invoicesData?.invoices ?? [];
    const expenses = expensesData?.expenses ?? [];

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const inRange = (ts: string) => {
      if (range === "all") return true;
      const createdTime = new Date(ts).getTime();
      if (!Number.isFinite(createdTime)) return false;
      const ageDays = (now - createdTime) / dayMs;
      if (range === "90d") return ageDays <= 90;
      return ageDays <= 365;
    };

    let income = 0;
    let collected = 0;
    let open = 0;
    let expensesTotal = 0;

    for (const inv of invoices) {
      if (!inRange(inv.created_at)) continue;
      const payload = inv.payload || {};
      const totalVal: number | null = typeof payload.total === "number" ? payload.total : null;
      if (typeof totalVal !== "number" || !Number.isFinite(totalVal)) continue;
      income += totalVal;
      const status = String(inv.status || "").toLowerCase();
      if (status === "paid") collected += totalVal;
      else open += totalVal;
    }

    for (const exp of expenses) {
      if (!inRange(exp.created_at)) continue;
      const payload = exp.payload || {};
      const totalVal: number | null = typeof payload.total === "number" ? payload.total : null;
      if (typeof totalVal !== "number" || !Number.isFinite(totalVal)) continue;
      expensesTotal += totalVal;
    }

    const net = income - expensesTotal;
    const taxRate = 0.25;
    const recommendedTax = net > 0 ? net * taxRate : 0;

    return { income, collected, open, expensesTotal, net, taxRate, recommendedTax };
  }, [invoicesData, expensesData, range]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Reports</h1>
          <p className="text-sm text-white/60">
            High-level money analytics powered by your invoices and expenses.
          </p>
        </div>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">Summary snapshot</CardTitle>
          <CardDescription className="text-xs text-white/60">
            This is the same core summary that powers the Finances dashboard, broken out here so you can focus on
            reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-[11px] text-white/70">
          {!lifetime ? (
            <div className="space-y-2">
              <p className="text-white/60">
                {isCommunityFirst
                  ? "You don’t need to wire up reports before you work. When you log invoices and expenses, this snapshot will fill in automatically."
                  : "Once you start issuing invoices and logging expenses, you’ll see totals here."}
              </p>
              {isCommunityFirst && (
                <div className="flex items-center gap-2 text-[11px]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 border-white/10 text-white/70"
                  >
                    Go to invoices
                  </Button>
                  <Link href="/community">
                    <a className="text-sky-400 hover:text-sky-300">See what’s happening nearby</a>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <p>
                Total billed: {formatCurrency(lifetime.totalAmount)}
              </p>
              <p>
                Collected: {formatCurrency(lifetime.paidAmount)}
              </p>
              <p>
                Outstanding: {formatCurrency(lifetime.unpaidAmount)}
              </p>
              <p>
                Expenses: {formatCurrency(lifetime.totalExpenses)}
              </p>
              <p>
                Net profit (simple): {formatCurrency(lifetime.netProfit)}
              </p>
            </>
          )}
          <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/60">P&amp;L by period</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={range === "90d" ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setRange("90d")}
                >
                  Last 90 days
                </Button>
                <Button
                  type="button"
                  variant={range === "365d" ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setRange("365d")}
                >
                  Last 12 months
                </Button>
                <Button
                  type="button"
                  variant={range === "all" ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setRange("all")}
                >
                  All time
                </Button>
              </div>
            </div>
            {isInvoicesLoading || isExpensesLoading ? (
              <p className="text-[11px] text-white/60">Loading P&amp;L…</p>
            ) : (
              <>
                <p>
                  Income (invoiced): {formatCurrency(period.income)}
                </p>
                <p>
                  Collected (paid): {formatCurrency(period.collected)}
                </p>
                <p>
                  Outstanding: {formatCurrency(period.open)}
                </p>
                <p>
                  Expenses in period: {formatCurrency(period.expensesTotal)}
                </p>
                <p>
                  Net profit (simple): {formatCurrency(period.net)}
                </p>
                <p>
                  Suggested tax set-aside (~{Math.round(period.taxRate * 100)}%): {formatCurrency(period.recommendedTax)}
                </p>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => window.print()}
          >
            Print snapshot
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
