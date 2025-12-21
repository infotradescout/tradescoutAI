import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FinanceLedgerSummary {
  count: number;
  totalCredits: number;
  totalDebits: number;
  balanceDelta: number;
}

interface FinanceLedgerTransaction {
  id: string;
  userId: string;
  counterpartyUserId: string | null;
  direction: "credit" | "debit";
  amount: number;
  transactionType: string;
  referenceType: string | null;
  referenceId: string | null;
  memo: string | null;
  createdAt: string | null;
}

interface FinanceLedgerResponse {
  transactions: FinanceLedgerTransaction[];
  summary: FinanceLedgerSummary;
}

export function FinanceLedgerPanel() {
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [direction, setDirection] = useState<"all" | "credit" | "debit">("all");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const { from, to } = useMemo(() => {
    if (range === "all") return { from: undefined as string | undefined, to: undefined as string | undefined };
    const now = new Date();
    const endIso = now.toISOString();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { from: start.toISOString(), to: endIso };
  }, [range]);

  const { data, isLoading, isError } = useQuery<FinanceLedgerResponse>({
    queryKey: ["/api/admin/finance/ledger", { range, direction, typeFilter, from, to }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (direction !== "all") params.set("direction", direction);
      if (typeFilter.trim()) params.set("transactionType", typeFilter.trim());
      const res = await apiRequest("GET", `/api/admin/finance/ledger?${params.toString()}`);
      return res as FinanceLedgerResponse;
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="py-8 text-center text-slate-300">Loading finance ledger…</CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="py-8 text-center text-red-300">
          Unable to load finance ledger. Please try again.
        </CardContent>
      </Card>
    );
  }

  const { transactions, summary } = data;

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-100">Ledger Summary (latest {summary.count} tx)</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Totals across all wallet accounts. Positive balance delta indicates net credits into the system.
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
            <div className="flex gap-2 items-center">
              <span className="text-slate-400">Window:</span>
              <select
                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100"
                value={range}
                onChange={(e) => setRange(e.target.value as any)}
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <span className="text-slate-600 mx-1">|</span>
              <span className="text-slate-400">Direction:</span>
              <select
                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100"
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="credit">Credits</option>
                <option value="debit">Debits</option>
              </select>
              <span className="text-slate-600 mx-1">|</span>
              <input
                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 min-w-[140px]"
                placeholder="Filter by type (e.g. marketplace_sale)"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <span className="text-slate-400">Credits:</span>
              <span className="text-emerald-300 font-semibold">${summary.totalCredits.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-400">Debits:</span>
              <span className="text-rose-300 font-semibold">${summary.totalDebits.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-400">Net change:</span>
              <span className={summary.balanceDelta >= 0 ? "text-emerald-300 font-semibold" : "text-rose-300 font-semibold"}>
                {summary.balanceDelta >= 0 ? "+" : "-"}${Math.abs(summary.balanceDelta).toFixed(2)}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100">Recent Transactions</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Most recent wallet transactions across all users. For detailed investigation, pivot by user ID and
            reference type.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader className="bg-slate-900/70 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-xs text-slate-400">When</TableHead>
                  <TableHead className="text-xs text-slate-400">User</TableHead>
                  <TableHead className="text-xs text-slate-400">Direction</TableHead>
                  <TableHead className="text-xs text-slate-400">Amount</TableHead>
                  <TableHead className="text-xs text-slate-400">Type</TableHead>
                  <TableHead className="text-xs text-slate-400">Reference</TableHead>
                  <TableHead className="text-xs text-slate-400">Memo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const created = tx.createdAt ? new Date(tx.createdAt) : null;
                  const when = created ? created.toLocaleString() : "—";
                  const amountLabel = `${tx.direction === "credit" ? "+" : "-"}${tx.amount.toFixed(2)}`;
                  return (
                    <TableRow key={tx.id} className="hover:bg-slate-800/60">
                      <TableCell className="text-xs text-slate-200 whitespace-nowrap">{when}</TableCell>
                      <TableCell className="text-xs text-slate-300">
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px]">{tx.userId}</span>
                          {tx.counterpartyUserId && (
                            <span className="font-mono text-[10px] text-slate-400">
                              ↔ {tx.counterpartyUserId}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className={tx.direction === "credit" ? "text-emerald-300" : "text-rose-300"}>
                          {tx.direction === "credit" ? "Credit" : "Debit"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-100">{amountLabel}</TableCell>
                      <TableCell className="text-xs text-slate-300 whitespace-nowrap">
                        {tx.transactionType || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-300">
                        <div className="flex flex-col">
                          {tx.referenceType && (
                            <span className="text-[11px] text-slate-300">{tx.referenceType}</span>
                          )}
                          {tx.referenceId && (
                            <span className="font-mono text-[10px] text-slate-400">{tx.referenceId}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-300 max-w-xs truncate">
                        {tx.memo || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
