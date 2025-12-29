import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Page } from "@/components/layout/PagePrimitives";

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

export default function FinancesVendorsPage() {
  const { data, isLoading } = useQuery<ExpensesResponse>({
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

  const rows = useMemo(() => {
    const expenses = data?.expenses ?? [];
    const map = new Map<
      string,
      { name: string; expenseCount: number; total: number; categories: Record<string, number> }
    >();

    for (const exp of expenses) {
      const payload = exp.payload || {};
      const vendorName: string = payload.vendorName || "Unknown vendor";
      const category: string | null = payload.category || null;
      const totalVal: number | null = typeof payload.total === "number" ? payload.total : null;
      const key = vendorName.trim().toLowerCase() || "unknown";
      const existing =
        map.get(key) || {
          name: vendorName || "Unknown vendor",
          expenseCount: 0,
          total: 0,
          categories: {},
        };

      existing.expenseCount += 1;
      if (typeof totalVal === "number" && Number.isFinite(totalVal)) {
        existing.total += totalVal;
        if (category) {
          const catKey = category.trim().toLowerCase();
          existing.categories[catKey] = (existing.categories[catKey] || 0) + totalVal;
        }
      }

      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [data]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.totalVendors += 1;
          acc.totalSpent += row.total;
          return acc;
        },
        { totalVendors: 0, totalSpent: 0 },
      ),
    [rows],
  );

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  return (
    <Page className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 mb-1">Vendors</h1>
        <p className="text-sm text-slate-400">
          People and companies you pay for materials, subs, and services.
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-100">Vendor overview</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Rolled up from your recorded expenses so you can see who you're paying and how much.
            </CardDescription>
          </div>
          <div className="text-[11px] text-slate-400 text-right flex flex-col items-end gap-0.5">
            <span>
              {totals.totalVendors.toLocaleString()} vendor
              {totals.totalVendors === 1 ? "" : "s"}
            </span>
            {totals.totalVendors > 0 && (
              <span>Total spent: {formatCurrency(totals.totalSpent)}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-[11px] text-slate-400 py-4">Loading vendor spend…</p>
          ) : rows.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-4">
              Once you start recording expenses with vendor names, you'll see spend by vendor here.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <Table className="min-w-full text-xs">
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="w-[40%] text-slate-400">Vendor</TableHead>
                    <TableHead className="w-[20%] text-right text-slate-400">Transactions</TableHead>
                    <TableHead className="w-[20%] text-right text-slate-400">Total spent</TableHead>
                    <TableHead className="w-[20%] text-right text-slate-400">Top category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const categories = Object.entries(row.categories || {});
                    const topCategory = categories.length
                      ? categories.sort((a, b) => b[1] - a[1])[0][0]
                      : null;
                    return (
                      <TableRow key={row.name} className="border-slate-800 hover:bg-slate-900/70">
                        <TableCell className="py-2 text-[11px] text-slate-100 truncate max-w-[260px]">
                          {row.name}
                        </TableCell>
                        <TableCell className="py-2 text-right text-[11px] text-slate-200">
                          {row.expenseCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="py-2 text-right text-[11px] text-slate-100">
                          {formatCurrency(row.total)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-[11px] text-slate-200">
                          {topCategory ? topCategory : "Uncategorized"}
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
    </Page>
  );
}
