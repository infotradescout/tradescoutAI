import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { Link } from "wouter";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

type LedgerRange = "7d" | "30d" | "90d" | "all";
type LedgerDirection = "all" | "credit" | "debit";

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

function formatMoney(value: number | null | undefined, signed = false): string {
  const numeric = Number(value || 0);
  const absolute = Math.abs(numeric).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  if (!signed || numeric === 0) return absolute;
  return `${numeric > 0 ? "+" : "−"}${absolute}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}

function readable(value: string | null | undefined): string {
  const text = String(value || "").trim();
  if (!text) return "Not recorded";
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DirectionBadge({ direction }: { direction: FinanceLedgerTransaction["direction"] }) {
  return direction === "credit" ? (
    <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
      Credit
    </Badge>
  ) : (
    <Badge className="border-rose-400/25 bg-rose-400/10 text-rose-100">Debit</Badge>
  );
}

export function FinanceLedgerPanel() {
  const [range, setRange] = useState<LedgerRange>("30d");
  const [direction, setDirection] = useState<LedgerDirection>("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const { from, to } = useMemo(() => {
    if (range === "all") {
      return { from: undefined as string | undefined, to: undefined as string | undefined };
    }
    const now = new Date();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return {
      from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    };
  }, [range]);

  const ledgerQuery = useQuery<FinanceLedgerResponse>({
    queryKey: ["/api/admin/finance/ledger", { range, direction, typeFilter, from, to }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (direction !== "all") params.set("direction", direction);
      if (typeFilter.trim()) params.set("transactionType", typeFilter.trim());
      return (await apiRequest(
        "GET",
        `/api/admin/finance/ledger?${params.toString()}`
      )) as FinanceLedgerResponse;
    },
    staleTime: 30_000,
    retry: false,
  });

  const transactions = ledgerQuery.data?.transactions || [];
  const summary = ledgerQuery.data?.summary;
  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return transactions;
    return transactions.filter((transaction) =>
      [
        transaction.id,
        transaction.userId,
        transaction.counterpartyUserId,
        transaction.transactionType,
        transaction.referenceType,
        transaction.referenceId,
        transaction.memo,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [search, transactions]);

  const uniqueUsers = useMemo(
    () =>
      new Set(
        transactions.flatMap((transaction) =>
          [transaction.userId, transaction.counterpartyUserId].filter(Boolean)
        )
      ).size,
    [transactions]
  );
  const uniqueTypes = useMemo(
    () => new Set(transactions.map((transaction) => transaction.transactionType).filter(Boolean)).size,
    [transactions]
  );
  const referenceCoverage = useMemo(() => {
    if (!transactions.length) return 0;
    return Math.round(
      (transactions.filter((transaction) => transaction.referenceType || transaction.referenceId).length /
        transactions.length) *
        100
    );
  }, [transactions]);

  return (
    <AdminWorkspace data-testid="admin-finance-ledger-v2">
      <AdminSection
        title="Finance ledger"
        description="Read-only wallet movement across TradeScout. Positive net change means more credits than debits in the selected server window; it is not a bank balance or recognized revenue statement."
        className="pt-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => ledgerQuery.refetch()}
              disabled={ledgerQuery.isFetching}
              className="border-white/12 bg-transparent text-white/65"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${ledgerQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Link href="/admin/vault-contributions">
              <Button
                type="button"
                variant="outline"
                className="border-white/12 bg-transparent text-white/65"
              >
                Vault contributions
              </Button>
            </Link>
          </div>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Net movement",
              value: ledgerQuery.isError ? "—" : formatMoney(summary?.balanceDelta, true),
              detail: ledgerQuery.isError
                ? "Ledger source unavailable"
                : "Credits minus debits in this filtered window",
              tone:
                ledgerQuery.isError
                  ? "warning"
                  : Number(summary?.balanceDelta || 0) >= 0
                    ? "good"
                    : "danger",
            },
            {
              label: "Credits",
              value: ledgerQuery.isError ? "—" : formatMoney(summary?.totalCredits),
              detail: "Server-reported credit total",
              tone: ledgerQuery.isError ? "warning" : "good",
            },
            {
              label: "Debits",
              value: ledgerQuery.isError ? "—" : formatMoney(summary?.totalDebits),
              detail: "Server-reported debit total",
              tone: ledgerQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Transactions",
              value: ledgerQuery.isError ? "—" : summary?.count ?? 0,
              detail: ledgerQuery.isError
                ? "Transaction source unavailable"
                : `${uniqueUsers} users · ${uniqueTypes} types`,
              tone: ledgerQuery.isError ? "warning" : "neutral",
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        title="Transaction evidence"
        description="Filter the server window, direction, and transaction type. Local search then narrows the returned records by account, reference, memo, type, or transaction identifier."
        className="pt-0"
      >
        <AdminToolbar>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <div className="relative min-w-[15rem] flex-1 md:max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/28" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search user, reference, memo, type, or transaction ID"
                className="border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/28"
              />
            </div>
            <Select value={range} onValueChange={(value) => setRange(value as LedgerRange)}>
              <SelectTrigger className="w-[10rem] border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={direction}
              onValueChange={(value) => setDirection(value as LedgerDirection)}
            >
              <SelectTrigger className="w-[10rem] border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All directions</SelectItem>
                <SelectItem value="credit">Credits</SelectItem>
                <SelectItem value="debit">Debits</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              placeholder="Transaction type"
              className="w-[13rem] border-white/10 bg-black/20 text-white placeholder:text-white/28"
            />
          </div>
          <span className="text-xs text-white/35">
            {filteredTransactions.length} of {transactions.length} returned · {referenceCoverage}%
            referenced
          </span>
        </AdminToolbar>

        {ledgerQuery.isLoading ? (
          <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
            <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
            Loading finance ledger…
          </div>
        ) : ledgerQuery.isError || !ledgerQuery.data ? (
          <div className="border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
            Finance ledger data is unavailable. No missing movement was represented as zero.
          </div>
        ) : filteredTransactions.length ? (
          <AdminList className="mt-4">
            {filteredTransactions.map((transaction) => (
              <details key={transaction.id} className="group">
                <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(10rem,0.45fr)_minmax(12rem,0.65fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-white">
                        {readable(transaction.transactionType)}
                      </p>
                      <DirectionBadge direction={transaction.direction} />
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-white/30">
                      {transaction.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                      Amount
                    </p>
                    <p
                      className={`mt-2 text-lg font-semibold ${
                        transaction.direction === "credit" ? "text-emerald-200" : "text-rose-100"
                      }`}
                    >
                      {transaction.direction === "credit" ? "+" : "−"}
                      {formatMoney(transaction.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                      Account
                    </p>
                    <p className="mt-2 truncate font-mono text-xs text-white/58">
                      {transaction.userId}
                    </p>
                    {transaction.counterpartyUserId ? (
                      <p className="mt-1 truncate font-mono text-xs text-white/30">
                        ↔ {transaction.counterpartyUserId}
                      </p>
                    ) : null}
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/30 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <DetailBlock label="When" value={formatDate(transaction.createdAt)} />
                    <DetailBlock
                      label="Reference type"
                      value={readable(transaction.referenceType)}
                    />
                    <DetailBlock
                      label="Reference ID"
                      value={transaction.referenceId || "Not recorded"}
                    />
                    <DetailBlock
                      label="Counterparty"
                      value={transaction.counterpartyUserId || "Not recorded"}
                    />
                  </div>
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                      Memo
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/58">
                      {transaction.memo || "No memo recorded."}
                    </p>
                  </div>
                </div>
              </details>
            ))}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No transactions match these filters"
            description="Change the server window, direction, type, or local search filter."
          />
        )}
      </AdminSection>
    </AdminWorkspace>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
        {label}
      </p>
      <p className="mt-2 break-words text-sm leading-6 text-white/58">{value}</p>
    </div>
  );
}
