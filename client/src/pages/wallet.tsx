import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DollarSign, ArrowUpRight, Shield, ArrowDownLeft, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface WalletBalanceResponse {
  balance: string;
}

interface WalletTransactionDto {
  id: string;
  createdAt: string;
  direction: "credit" | "debit" | string;
  transactionType: string | null;
  amount: string;
  referenceType?: string | null;
  referenceId?: string | null;
  memo?: string | null;
}

interface WalletTaxStatementSummary {
  userId: string;
  period: {
    type: "year" | "quarter";
    year: number;
    quarter?: number;
    startDate: string;
    endDate: string;
  };
  totals: {
    totalCredits: number;
    totalDebits: number;
    netChange: number;
    taxableIncomeTotal?: number;
  };
  totalsByType: Array<{
    transactionType: string;
    totalCredits: number;
    totalDebits: number;
    netChange: number;
  }>;
}

export default function WalletPage() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

   const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
   const [selectedPeriodType, setSelectedPeriodType] = useState<"year" | "quarter">("year");
   const [selectedQuarter, setSelectedQuarter] = useState<number | undefined>(undefined);

  const [toUserId, setToUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const { data: walletData, isLoading } = useQuery<WalletBalanceResponse | null>({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/wallet/balance");
      } catch (error: any) {
        const message = (error?.message as string | undefined) ?? "";
        if (
          message.includes("401") ||
          message.toLowerCase().includes("unauthorized") ||
          message.toLowerCase().includes("not authenticated")
        ) {
          return null;
        }
        throw error;
      }
    },
  });

  const { data: txData, isLoading: txLoading } = useQuery<{ transactions: WalletTransactionDto[] } | null>({
    queryKey: ["/api/wallet/transactions"],
    queryFn: async () => {
      try {
        return await apiRequest(
          "GET",
          "/api/wallet/transactions?limit=25"
        );
      } catch (error: any) {
        const message = (error?.message as string | undefined) ?? "";
        if (
          message.includes("401") ||
          message.toLowerCase().includes("unauthorized") ||
          message.toLowerCase().includes("not authenticated")
        ) {
          return null;
        }
        throw error;
      }
    },
  });

  const { data: taxSummary } = useQuery<WalletTaxStatementSummary | null>({
    queryKey: [
      "/api/wallet/tax-statement",
      selectedYear,
      selectedPeriodType,
      selectedQuarter ?? "all",
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("year", String(selectedYear));
      params.set("periodType", selectedPeriodType);
      if (selectedPeriodType === "quarter" && selectedQuarter) {
        params.set("quarter", String(selectedQuarter));
      }
      return await apiRequest(
        "GET",
        `/api/wallet/tax-statement?${params.toString()}`
      );
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (payload: { toUserId: string; amount: number; memo?: string }) => {
      return apiRequest("POST", "/api/wallet/transfer", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      toast({
        title: "Transfer Complete",
        description: "Funds have been sent successfully.",
      });
      setAmount("");
      setMemo("");
      setToUserId("");
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error?.message || "Unable to complete transfer.",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen gradient-bg pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <Card className="border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-white">TradeScout Wallet</CardTitle>
              <CardDescription className="text-gray-300">
                Sign in to view and use your TradeScout balance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-300">
                Your wallet is tied to your TradeScout account. Please log in to see your balance and send funds.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const balanceValue = parseFloat(walletData?.balance || "0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numericAmount = Number(amount);

    if (!toUserId.trim()) {
      toast({
        title: "Recipient Required",
        description: "Please enter the recipient's user ID.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Enter a positive amount to send.",
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate({
      toUserId: toUserId.trim(),
      amount: numericAmount,
      memo: memo.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen gradient-bg pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-emerald-400" />
              TradeScout Wallet
            </h1>
            <p className="text-gray-300 mt-1 text-sm md:text-base">
              Use your on-platform earnings to pay for marketplace items or send funds to other members.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                Current Balance
              </CardTitle>
              <CardDescription className="text-xs text-gray-400">
                This is your spendable TradeScout balance from affiliate earnings and other on-platform sources.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-white">
                    {isLoading ? (
                      <span className="inline-block animate-pulse bg-slate-700 rounded-md h-8 w-32" />
                    ) : (
                      <>
                        ${balanceValue.toFixed(2)}
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Available to spend across marketplace and peer-to-peer transfers.
                  </p>
                </div>
              </div>

              {user?.id && (
                <div className="mt-4 text-xs text-gray-400 border-t border-slate-800 pt-3">
                  <div className="font-semibold text-gray-300 mb-1">Your user ID</div>
                  <div className="font-mono text-[11px] break-all text-gray-400">
                    {user.id}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Share this ID with people who want to send you funds. A richer lookup (by name or email) is coming soon.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-orange-400" />
                Send Funds
              </CardTitle>
              <CardDescription className="text-xs text-gray-400">
                Transfer balance to another TradeScout member by their user ID.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="recipient" className="text-xs text-gray-300">
                    Recipient User ID
                  </Label>
                  <Input
                    id="recipient"
                    value={toUserId}
                    onChange={(e) => setToUserId(e.target.value)}
                    placeholder="Paste the recipient's TradeScout user ID"
                    className="text-xs bg-slate-900 border-slate-700 focus-visible:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount" className="text-xs text-gray-300">
                      Amount (USD)
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="text-xs bg-slate-900 border-slate-700 focus-visible:ring-orange-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="memo" className="text-xs text-gray-300">
                      Note (optional)
                    </Label>
                    <Input
                      id="memo"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      placeholder="What is this for?"
                      className="text-xs bg-slate-900 border-slate-700 focus-visible:ring-orange-500"
                    />
                  </div>
                </div>

                <Separator className="my-1 border-slate-800" />

                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-xs font-semibold"
                  disabled={transferMutation.isPending}
                >
                  {transferMutation.isPending ? "Sending..." : "Send Funds"}
                </Button>

                <p className="text-[11px] text-gray-500 mt-1">
                  Transfers move balance instantly inside TradeScout. We handle bank routing behind the scenes as part of
                  your overall wallet reconciliation.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-medium text-gray-200">Recent Activity</CardTitle>
              <CardDescription className="text-xs text-gray-400">
                Last 25 wallet movements, including affiliate credits, purchases, and transfers.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-slate-800/80 rounded-md animate-pulse"
                  />
                ))}
              </div>
            ) : !txData || !txData.transactions || txData.transactions.length === 0 ? (
              <p className="text-xs text-gray-400">
                No wallet activity yet. As you earn affiliate commissions or move funds, they will appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {txData.transactions.map((tx) => {
                  const isCredit = tx.direction === "credit";
                  const amount = Number(tx.amount || 0);
                  const created = tx.createdAt ? new Date(tx.createdAt) : null;
                  const rawType = (tx.transactionType || "").toLowerCase();
                  const baseTypeLabel = (tx.transactionType || "").replace(/_/g, " ");

                  let friendlyType = "Wallet activity";
                  if (rawType === "affiliate_commission") friendlyType = "Affiliate commission";
                  else if (rawType === "marketplace_purchase") friendlyType = "Marketplace purchase";
                  else if (rawType === "marketplace_sale") friendlyType = "Marketplace sale";
                  else if (rawType === "p2p_send") friendlyType = "Sent to member";
                  else if (rawType === "p2p_receive") friendlyType = "Received from member";
                  else if (rawType === "admin_adjustment") friendlyType = "Admin adjustment";
                  else if (rawType === "deposit") friendlyType = "Deposit";
                  else if (rawType === "withdrawal") friendlyType = "Withdrawal";
                  else if (baseTypeLabel) friendlyType = baseTypeLabel;

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800">
                          {isCredit ? (
                            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-orange-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-100 truncate">
                            {friendlyType}
                          </div>
                          {tx.memo && (
                            <div className="text-[11px] text-gray-400 truncate">{tx.memo}</div>
                          )}
                          {created && (
                            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-500">
                              <Clock className="w-3 h-3" />
                              <span>{created.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs font-semibold">
                        <div className={isCredit ? "text-emerald-400" : "text-orange-400"}>
                          {isCredit ? "+" : "-"}${amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax Statements */}
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-3 flex flex-col gap-2">
            <div>
              <CardTitle className="text-sm font-medium text-gray-200">Tax Statements</CardTitle>
              <CardDescription className="text-xs text-gray-400">
                Download yearly or quarterly wallet movement snapshots to share with your accountant or deal room
                accounting.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-gray-300">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value) || new Date().getFullYear())}
              >
                {Array.from({ length: 5 }).map((_, idx) => {
                  const y = new Date().getFullYear() - idx;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>

              <select
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                value={selectedPeriodType}
                onChange={(e) => {
                  const v = e.target.value === "quarter" ? "quarter" : "year";
                  setSelectedPeriodType(v);
                  if (v === "year") setSelectedQuarter(undefined);
                }}
              >
                <option value="year">Full year</option>
                <option value="quarter">Quarter</option>
              </select>

              {selectedPeriodType === "quarter" && (
                <select
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                  value={selectedQuarter ?? ""}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value) || undefined)}
                >
                  <option value="">Select quarter</option>
                  <option value="1">Q1 (Jan–Mar)</option>
                  <option value="2">Q2 (Apr–Jun)</option>
                  <option value="3">Q3 (Jul–Sep)</option>
                  <option value="4">Q4 (Oct–Dec)</option>
                </select>
              )}

              <Button
                type="button"
                size="sm"
                className="ml-auto bg-orange-500 hover:bg-orange-600 text-xs font-semibold"
                disabled={selectedPeriodType === "quarter" && !selectedQuarter}
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("year", String(selectedYear));
                  params.set("periodType", selectedPeriodType);
                  if (selectedPeriodType === "quarter" && selectedQuarter) {
                    params.set("quarter", String(selectedQuarter));
                  }
                  params.set("format", "csv");
                  const url = `/api/wallet/tax-statement?${params.toString()}`;
                  window.location.href = url;
                }}
              >
                Download CSV
              </Button>
            </div>

            {taxSummary && (
              <div className="space-y-1 text-[11px] text-gray-300">
                <div className="flex justify-between">
                  <span>Total credits</span>
                  <span>${taxSummary.totals.totalCredits.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total debits</span>
                  <span>${taxSummary.totals.totalDebits.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Net change</span>
                  <span>${taxSummary.totals.netChange.toFixed(2)}</span>
                </div>
                {typeof taxSummary.totals.taxableIncomeTotal === "number" && (
                  <div className="flex justify-between">
                    <span>Estimated taxable income*</span>
                    <span>${taxSummary.totals.taxableIncomeTotal.toFixed(2)}</span>
                  </div>
                )}
                <p className="mt-1 text-[10px] text-gray-500">
                  *This estimate currently includes only obvious income-like wallet credits (affiliate
                  commissions and marketplace sales). Your tax professional or accounting system is
                  responsible for determining your actual taxable income.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
