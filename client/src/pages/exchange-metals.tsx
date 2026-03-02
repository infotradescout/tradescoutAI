import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, ArrowLeft, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type MetalChoice = "XAU" | "XAG" | "XPT" | "XPD" | "OTHER";

type ExchangeItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  images: string[];
  location: string;
  seller: { id: string; name: string; rating: number; verified: boolean };
  createdAt: string;
  featured: boolean;
  views: number;
  favorites: number;
};

type PricesResponse = {
  snapshot: {
    asOf: string;
    baseCurrency: "USD";
    pricesUsdPerOz: Record<string, number | null>;
  };
  stale: boolean;
  refreshCadenceMinutes: number;
};

type PortfolioSummaryResponse = {
  summary: {
    metals: Array<{
      metalCode: string;
      quantityOz: number;
      costBasisUsd: number;
      realizedUsd: number;
      avgCostUsdPerOz: number | null;
      priceUsdPerOz: number | null;
      marketValueUsd: number | null;
      unrealizedUsd: number | null;
    }>;
    totals: {
      costBasisUsd: number;
      realizedUsd: number;
      marketValueUsd: number | null;
      unrealizedUsd: number | null;
    };
  };
  priceAsOf: string | null;
};

type TransactionsResponse = {
  transactions: Array<{
    id: string;
    direction: "buy" | "sell";
    metalCode: string;
    metalName?: string | null;
    quantityOz: number;
    totalUsd: number;
    executedAt: string;
    notes?: string | null;
  }>;
};

const createTxSchema = z.object({
  direction: z.enum(["buy", "sell"]),
  metalChoice: z.enum(["XAU", "XAG", "XPT", "XPD", "OTHER"]),
  otherCode: z.string().trim().max(8).optional(),
  otherName: z.string().trim().max(64).optional(),
  quantityOz: z.string().trim(),
  totalUsd: z.string().trim(),
  executedAt: z.string().trim().optional(),
  notes: z.string().trim().max(4000).optional(),
});

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatNumber(value: number | null | undefined, digits = 4) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export default function MetalsExchange() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"prices" | "listings" | "portfolio">("prices");
  const [form, setForm] = useState<{
    direction: "buy" | "sell";
    metalChoice: MetalChoice;
    otherCode: string;
    otherName: string;
    quantityOz: string;
    totalUsd: string;
    executedAt: string;
    notes: string;
  }>({
    direction: "buy",
    metalChoice: "XAU",
    otherCode: "",
    otherName: "",
    quantityOz: "",
    totalUsd: "",
    executedAt: "",
    notes: "",
  });

  const pricesQuery = useQuery<PricesResponse>({
    queryKey: ["/api/metals/prices"],
    queryFn: async () => {
      const res = await fetch("/api/metals/prices");
      if (!res.ok) throw new Error("Failed to load metals prices");
      return res.json();
    },
    refetchInterval: 15 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const listingsQuery = useQuery<ExchangeItem[]>({
    queryKey: ["/api/exchange/items", "metals"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("categoryId", "metals");
      params.set("limit", "50");
      const res = await fetch(`/api/exchange/items?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load metals listings");
      return res.json();
    },
    enabled: tab === "listings",
  });

  const transactionsQuery = useQuery<TransactionsResponse>({
    queryKey: ["/api/metals/portfolio/transactions"],
    queryFn: async () => {
      const res = await fetch("/api/metals/portfolio/transactions", { credentials: "include" });
      if (res.status === 401) return { transactions: [] };
      if (!res.ok) throw new Error("Failed to load portfolio transactions");
      return res.json();
    },
    enabled: Boolean(user),
  });

  const summaryQuery = useQuery<PortfolioSummaryResponse>({
    queryKey: ["/api/metals/portfolio/summary"],
    queryFn: async () => {
      const res = await fetch("/api/metals/portfolio/summary", { credentials: "include" });
      if (res.status === 401) {
        return {
          summary: {
            metals: [],
            totals: { costBasisUsd: 0, realizedUsd: 0, marketValueUsd: null, unrealizedUsd: null },
          },
          priceAsOf: null,
        };
      }
      if (!res.ok) throw new Error("Failed to load portfolio summary");
      return res.json();
    },
    enabled: Boolean(user),
    refetchInterval: 15 * 60 * 1000,
  });

  const createTxMutation = useMutation({
    mutationFn: async () => {
      const parsed = createTxSchema.parse(form);
      const quantityOz = Number(parsed.quantityOz);
      const totalUsd = Number(parsed.totalUsd);
      if (!Number.isFinite(quantityOz) || quantityOz <= 0)
        throw new Error("Quantity must be a positive number");
      if (!Number.isFinite(totalUsd) || totalUsd < 0)
        throw new Error("Total USD must be a valid number");

      const metalCode =
        parsed.metalChoice === "OTHER"
          ? String(parsed.otherCode || "")
              .trim()
              .toUpperCase()
          : parsed.metalChoice;

      if (!metalCode || metalCode.length < 2 || metalCode.length > 8) {
        throw new Error("Metal code is required for Other metals");
      }

      const payload = {
        direction: parsed.direction,
        metalCode,
        metalName: parsed.metalChoice === "OTHER" ? parsed.otherName || undefined : undefined,
        quantityOz,
        totalUsd,
        executedAt: parsed.executedAt || undefined,
        notes: parsed.notes || undefined,
      };

      const res = await apiRequest("POST", "/api/metals/portfolio/transactions", payload);
      return res.json();
    },
    onSuccess: async () => {
      setForm((prev) => ({ ...prev, quantityOz: "", totalUsd: "", notes: "" }));
      await queryClient.invalidateQueries({ queryKey: ["/api/metals/portfolio/transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/metals/portfolio/summary"] });
      toast({ title: "Saved", description: "Transaction added to your metals portfolio." });
      setTab("portfolio");
    },
    onError: (err: any) => {
      toast({
        title: "Could not save",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/metals/portfolio/transactions/${id}`);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/metals/portfolio/transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/metals/portfolio/summary"] });
      toast({ title: "Deleted", description: "Transaction removed." });
    },
    onError: (err: any) => {
      toast({
        title: "Could not delete",
        description: String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  const metalRows = useMemo(() => {
    const snapshot = pricesQuery.data?.snapshot;
    if (!snapshot) return [];
    const entries = Object.entries(snapshot.pricesUsdPerOz || {});
    const preferredOrder = ["XAU", "XAG", "XPT", "XPD"];
    entries.sort((a, b) => {
      const ai = preferredOrder.indexOf(a[0]);
      const bi = preferredOrder.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    return entries;
  }, [pricesQuery.data]);

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="px-2" onClick={() => setLocation("/exchange")}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-xl font-semibold text-white truncate">Metals Exchange</h1>
            <Badge variant="secondary" className="bg-white/10 text-white/70">
              Physical • USD
            </Badge>
          </div>
          <div className="text-sm text-white/60 mt-1">
            Live spot snapshots refresh every 15 minutes. Portfolio tracking is private and manual.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/10 text-white/80"
            onClick={() =>
              setLocation("/marketplace/new?categoryName=Precious%20Metals%20(Physical)")
            }
          >
            List Metal
          </Button>
          <Button
            variant="outline"
            className="border-white/10 text-white/80"
            onClick={() => pricesQuery.refetch()}
            disabled={pricesQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="prices">Prices</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        </TabsList>

        <TabsContent value="prices" className="mt-4 space-y-4">
          <Card className="bg-tsCard border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Spot Prices (USD / oz)</CardTitle>
              <div className="text-xs text-white/60">
                As of:{" "}
                {pricesQuery.data?.snapshot?.asOf
                  ? new Date(pricesQuery.data.snapshot.asOf).toLocaleString()
                  : "—"}
                {pricesQuery.data?.stale ? " (stale)" : ""}
              </div>
            </CardHeader>
            <CardContent>
              {pricesQuery.isLoading ? (
                <div className="text-white/60 text-sm">Loading prices…</div>
              ) : pricesQuery.isError ? (
                <div className="text-white/60 text-sm">
                  Prices unavailable. If you control the server, set `METALS_API_KEY`.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metal</TableHead>
                      <TableHead className="text-right">USD / oz</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metalRows.map(([code, price]) => (
                      <TableRow key={code}>
                        <TableCell className="font-medium text-white">{code}</TableCell>
                        <TableCell className="text-right text-white">
                          {price != null ? formatUsd(price) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-3 text-xs text-white/50">
                Note: Local premiums, mint spreads, and dealer fees vary; TradeScout tracks spot
                only.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings" className="mt-4 space-y-4">
          <Card className="bg-tsCard border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Physical Metals Listings</CardTitle>
              <div className="text-xs text-white/60">
                Browse listings here or open the full Exchange surface for messaging/contact.
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Button
                  variant="outline"
                  className="border-white/10 text-white/80"
                  onClick={() => setLocation("/exchange?category=metals")}
                >
                  Open in Exchange
                </Button>
                <Button
                  variant="outline"
                  className="border-white/10 text-white/80"
                  onClick={() => listingsQuery.refetch()}
                  disabled={listingsQuery.isFetching}
                >
                  Refresh listings
                </Button>
              </div>

              {listingsQuery.isLoading ? (
                <div className="text-white/60 text-sm">Loading listings…</div>
              ) : listingsQuery.isError ? (
                <div className="text-white/60 text-sm">Could not load listings.</div>
              ) : (listingsQuery.data?.length || 0) === 0 ? (
                <div className="text-white/60 text-sm">No active metals listings yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listingsQuery.data!.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-white">{item.title}</TableCell>
                        <TableCell className="text-white/80">{item.seller?.name || "—"}</TableCell>
                        <TableCell className="text-white/70">{item.location || "—"}</TableCell>
                        <TableCell className="text-right text-white">
                          {formatUsd(item.price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio" className="mt-4 space-y-4">
          {!user ? (
            <Card className="bg-tsCard border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Your Portfolio</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-white/70">
                Sign in to track your holdings and transactions.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="bg-tsCard border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">Summary</CardTitle>
                  <div className="text-xs text-white/60">
                    Price as of:{" "}
                    {summaryQuery.data?.priceAsOf
                      ? new Date(summaryQuery.data.priceAsOf).toLocaleString()
                      : "—"}
                  </div>
                </CardHeader>
                <CardContent>
                  {summaryQuery.isLoading ? (
                    <div className="text-white/60 text-sm">Loading…</div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-xs text-white/60">Cost Basis</div>
                        <div className="text-white font-semibold">
                          {formatUsd(summaryQuery.data?.summary.totals.costBasisUsd)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-xs text-white/60">Market Value</div>
                        <div className="text-white font-semibold">
                          {formatUsd(summaryQuery.data?.summary.totals.marketValueUsd ?? null)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-xs text-white/60">Unrealized P/L</div>
                        <div className="text-white font-semibold">
                          {formatUsd(summaryQuery.data?.summary.totals.unrealizedUsd ?? null)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="text-xs text-white/60">Realized P/L</div>
                        <div className="text-white font-semibold">
                          {formatUsd(summaryQuery.data?.summary.totals.realizedUsd ?? 0)}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-tsCard border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">Add Transaction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-white/80">Direction</Label>
                      <Select
                        value={form.direction}
                        onValueChange={(v) => setForm((p) => ({ ...p, direction: v as any }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Buy / Sell" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buy">Buy</SelectItem>
                          <SelectItem value="sell">Sell</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-white/80">Metal</Label>
                      <Select
                        value={form.metalChoice}
                        onValueChange={(v) => setForm((p) => ({ ...p, metalChoice: v as any }))}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Select metal" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="XAU">Gold (XAU)</SelectItem>
                          <SelectItem value="XAG">Silver (XAG)</SelectItem>
                          <SelectItem value="XPT">Platinum (XPT)</SelectItem>
                          <SelectItem value="XPD">Palladium (XPD)</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-white/80">Executed At</Label>
                      <Input
                        type="date"
                        value={form.executedAt}
                        onChange={(e) => setForm((p) => ({ ...p, executedAt: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>

                  {form.metalChoice === "OTHER" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-white/80">Metal Code</Label>
                        <Input
                          placeholder="e.g. CU"
                          value={form.otherCode}
                          onChange={(e) => setForm((p) => ({ ...p, otherCode: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/80">Name (optional)</Label>
                        <Input
                          placeholder="e.g. Copper"
                          value={form.otherName}
                          onChange={(e) => setForm((p) => ({ ...p, otherName: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-white/80">Quantity (oz)</Label>
                      <Input
                        placeholder="e.g. 2.5"
                        value={form.quantityOz}
                        onChange={(e) => setForm((p) => ({ ...p, quantityOz: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-white/80">Total (USD)</Label>
                      <Input
                        placeholder="e.g. 5125.00"
                        value={form.totalUsd}
                        onChange={(e) => setForm((p) => ({ ...p, totalUsd: e.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-white/80">Notes (optional)</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white min-h-[90px]"
                    />
                  </div>

                  <Button
                    className="bg-ts-orange hover:bg-ts-orange/90 text-black"
                    onClick={() => createTxMutation.mutate()}
                    disabled={createTxMutation.isPending}
                  >
                    Save Transaction
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-tsCard border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  {transactionsQuery.isLoading ? (
                    <div className="text-white/60 text-sm">Loading…</div>
                  ) : (transactionsQuery.data?.transactions?.length || 0) === 0 ? (
                    <div className="text-white/60 text-sm">No transactions yet.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Metal</TableHead>
                          <TableHead>Dir</TableHead>
                          <TableHead className="text-right">Qty (oz)</TableHead>
                          <TableHead className="text-right">Total (USD)</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactionsQuery.data!.transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-white/80">
                              {tx.executedAt ? new Date(tx.executedAt).toLocaleDateString() : "—"}
                            </TableCell>
                            <TableCell className="text-white">
                              {tx.metalCode}
                              {tx.metalName ? (
                                <span className="text-white/60"> • {tx.metalName}</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-white/80">
                              <Badge
                                className={
                                  tx.direction === "buy"
                                    ? "bg-green-500/15 text-green-200"
                                    : "bg-red-500/15 text-red-200"
                                }
                              >
                                {tx.direction.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-white/80">
                              {formatNumber(tx.quantityOz, 6)}
                            </TableCell>
                            <TableCell className="text-right text-white">
                              {formatUsd(tx.totalUsd)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                className="text-white/70 hover:text-white"
                                onClick={() => deleteTxMutation.mutate(tx.id)}
                                disabled={deleteTxMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
