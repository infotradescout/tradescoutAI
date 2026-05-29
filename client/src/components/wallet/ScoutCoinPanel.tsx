import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type ScoutCoinWalletResponse = {
  registry: {
    kycStatus: "unverified" | "pending" | "verified" | "rejected";
    frozen: boolean;
    walletAddress: string;
  };
  balance: number;
  token: {
    symbol: string;
    status: "disabled" | "testnet" | "mainnet";
  };
  price: {
    enabled: boolean;
    providerConfigured: boolean;
    sourceType: string;
  };
};

type ScoutCoinTx = {
  id: string;
  txType: string;
  amount: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export function ScoutCoinPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallet } = useQuery<ScoutCoinWalletResponse>({
    queryKey: ["/api/scoutcoin/wallet"],
    queryFn: async () => apiRequest("GET", "/api/scoutcoin/wallet"),
  });

  const { data: history } = useQuery<{ transactions: ScoutCoinTx[] }>({
    queryKey: ["/api/scoutcoin/transactions"],
    queryFn: async () => apiRequest("GET", "/api/scoutcoin/transactions?limit=25"),
  });

  const buyEnabled = useMemo(() => {
    if (!wallet) return false;
    if (wallet.token.status === "disabled") return false;
    if (!wallet.price.providerConfigured) return false;
    if (wallet.registry.kycStatus !== "verified") return false;
    if (wallet.registry.frozen) return false;
    return true;
  }, [wallet]);

  const buyMutation = useMutation({
    mutationFn: async (amount: number) => apiRequest("POST", "/api/scoutcoin/buy", { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scoutcoin/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scoutcoin/transactions"] });
      toast({
        title: "ScoutCoin purchase submitted",
        description: "Your wallet activity has been recorded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to buy ScoutCoin",
        description: formatUserFacingErrorMessage(
          error,
          "Please review your wallet and compliance status."
        ),
        variant: "destructive",
      });
    },
  });

  const redeemMutation = useMutation({
    mutationFn: async (target: "trade_scout_perk" | "meal_partner_perk") =>
      apiRequest("POST", "/api/scoutcoin/redeem", { amount: 1, target }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scoutcoin/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scoutcoin/transactions"] });
      toast({ title: "Redemption submitted", description: "Your perk redemption was recorded." });
    },
    onError: (error: any) => {
      toast({
        title: "Unable to redeem ScoutCoin",
        description: formatUserFacingErrorMessage(
          error,
          "Please verify your balance and account status."
        ),
        variant: "destructive",
      });
    },
  });

  const statusText = wallet
    ? `Status: ${wallet.token.status} • KYC: ${wallet.registry.kycStatus} • Wallet freeze: ${
        wallet.registry.frozen ? "on" : "off"
      }`
    : "Status unavailable";

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base">ScoutCoin Wallet</CardTitle>
        <CardDescription>
          View balance, review risk disclosures, and redeem perks. Buy actions remain disabled until
          provider setup and compliance checks are complete.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div>{statusText}</div>
          <div className="mt-1">
            Risk disclosure: digital token access can be restricted by compliance controls, service
            availability, and jurisdiction rules. This utility is currently configured for
            controlled testing.
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div className="text-sm font-medium">Balance</div>
          <div className="text-sm font-semibold">
            {wallet ? `${wallet.balance.toFixed(4)} ${wallet.token.symbol}` : "--"}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="scoutcoin-buy-amount" className="text-xs text-muted-foreground">
            Buy amount
          </Label>
          <Input id="scoutcoin-buy-amount" type="number" min="1" step="1" defaultValue="1" />
          <Button
            type="button"
            disabled={!buyEnabled || buyMutation.isPending}
            onClick={() => {
              const el = document.getElementById("scoutcoin-buy-amount") as HTMLInputElement | null;
              const amount = Number(el?.value || "0");
              buyMutation.mutate(amount);
            }}
            className="w-full"
          >
            {buyEnabled ? "Buy ScoutCoin" : "Buy unavailable until provider is configured"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={redeemMutation.isPending}
            onClick={() => redeemMutation.mutate("meal_partner_perk")}
          >
            Redeem for Meal partner perk
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={redeemMutation.isPending}
            onClick={() => redeemMutation.mutate("trade_scout_perk")}
          >
            Redeem for Trade Scout perk
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Transaction history</div>
          {!history?.transactions?.length ? (
            <div className="text-xs text-muted-foreground">No ScoutCoin transactions yet.</div>
          ) : (
            <div className="space-y-1">
              {history.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded border border-border px-2 py-1"
                >
                  <div className="text-xs">
                    <div className="font-medium">{tx.txType}</div>
                    <div className="text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs font-semibold">{tx.amount}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
