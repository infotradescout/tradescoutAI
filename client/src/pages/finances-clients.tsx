import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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

interface StandaloneInvoicesResponse {
  invoices: StandaloneInvoice[];
}

interface ClientRow {
  name: string;
  invoiceCount: number;
  totalBilled: number;
  paidAmount: number;
  unpaidAmount: number;
  agingCurrent: number;
  aging30: number;
  aging60: number;
  aging90Plus: number;
}

export default function FinancesClientsPage() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<StandaloneInvoicesResponse>({
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

  const rows: ClientRow[] = useMemo(() => {
    const invoices = data?.invoices ?? [];
    const map = new Map<string, ClientRow>();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (const inv of invoices) {
      const payload = inv.payload || {};
      const clientName: string = payload.clientName || "Unknown client";
      const totalVal: number | null = typeof payload.total === "number" ? payload.total : null;
      const key = clientName.trim().toLowerCase() || "unknown";
      const existing: ClientRow =
        map.get(key) || {
          name: clientName || "Unknown client",
          invoiceCount: 0,
          totalBilled: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          agingCurrent: 0,
          aging30: 0,
          aging60: 0,
          aging90Plus: 0,
        };

      existing.invoiceCount += 1;

      if (typeof totalVal === "number" && Number.isFinite(totalVal)) {
        existing.totalBilled += totalVal;
        const status = String(inv.status || "").toLowerCase();
        if (status === "paid") {
          existing.paidAmount += totalVal;
        } else {
          existing.unpaidAmount += totalVal;

          const createdTime = new Date(inv.created_at).getTime();
          if (Number.isFinite(createdTime)) {
            const ageDays = (now - createdTime) / dayMs;
            if (ageDays <= 30) existing.agingCurrent += totalVal;
            else if (ageDays <= 60) existing.aging30 += totalVal;
            else if (ageDays <= 90) existing.aging60 += totalVal;
            else existing.aging90Plus += totalVal;
          }
        }
      }

      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.unpaidAmount !== a.unpaidAmount) return b.unpaidAmount - a.unpaidAmount;
      return b.totalBilled - a.totalBilled;
    });
  }, [data]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.totalBilled += row.totalBilled;
          acc.totalUnpaid += row.unpaidAmount;
          return acc;
        },
        { totalBilled: 0, totalUnpaid: 0 },
      ),
    [rows],
  );

  const formatCurrency = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "–";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  };

  return (
    <Page className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Clients</h1>
          <p className="text-sm text-white/60">
            See who you've billed and how much, powered by your invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => navigate("/finances/invoices")}
          >
            View invoices
          </Button>
        </div>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-white">Clients ledger</CardTitle>
            <CardDescription className="text-xs text-white/60">
              Rolled up from your existing invoices. More detail will plug into jobs and CRM over time.
            </CardDescription>
          </div>
          <div className="text-[11px] text-white/60 text-right flex flex-col items-end gap-0.5">
            <span>
              {rows.length.toLocaleString()} client{rows.length === 1 ? "" : "s"}
            </span>
            {rows.length > 0 && (
              <span>
                Open balance: {formatCurrency(totals.totalUnpaid)}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-[11px] text-white/60 py-4">Loading clients…</p>
          ) : rows.length === 0 ? (
            <p className="text-[11px] text-white/60 py-4">
              Once you create invoices, you'll see a simple client ledger here.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <Table className="min-w-full text-xs">
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="w-[40%] text-white/60">Client</TableHead>
                    <TableHead className="w-[20%] text-right text-white/60">Open balance</TableHead>
                    <TableHead className="w-[20%] text-right text-white/60">Lifetime billed</TableHead>
                    <TableHead className="w-[20%] text-right text-white/60">Aging (oldest)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.name}
                      className="border-white/10 hover:bg-tsCard/95 cursor-pointer"
                      onClick={() => navigate(`/finances/invoices?client=${encodeURIComponent(row.name)}`)}
                    >
                      <TableCell className="py-2 text-[11px] text-white truncate max-w-[260px]">
                        <div className="flex flex-col gap-0.5">
                          <span>{row.name}</span>
                          <span className="text-[10px] text-white/60">
                            {row.invoiceCount.toLocaleString()} invoice
                            {row.invoiceCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right text-[11px] text-white/70">
                        {formatCurrency(row.unpaidAmount)}
                      </TableCell>
                      <TableCell className="py-2 text-right text-[11px] text-white">
                        {formatCurrency(row.totalBilled)}
                      </TableCell>
                      <TableCell className="py-2 text-right text-[11px] text-white/70">
                        {(() => {
                          if (row.unpaidAmount <= 0) return "–";
                          const buckets = [
                            { label: "0-30 days", value: row.agingCurrent },
                            { label: "31-60 days", value: row.aging30 },
                            { label: "61-90 days", value: row.aging60 },
                            { label: "90+ days", value: row.aging90Plus },
                          ];
                          const max = buckets.reduce(
                            (best, b) => (b.value > best.value ? b : best),
                            { label: "0-30 days", value: 0 },
                          );
                          if (max.value <= 0) return "Current";
                          return `${max.label}`;
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
