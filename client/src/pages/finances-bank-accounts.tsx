import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Page } from "@/components/layout/PagePrimitives";

export default function FinancesBankAccountsPage() {
  const [, navigate] = useLocation();

  return (
    <Page className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Bank accounts</h1>
          <p className="text-sm text-white/60">
            Connected accounts and syncs that power your ledger and reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => navigate("/wallet")}
          >
            Open wallet
          </Button>
        </div>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">Account connections</CardTitle>
          <CardDescription className="text-xs text-white/60">
            Today, TradeScout Wallet is your primary on-platform balance. This workspace will eventually show
            external bank connections, sync status, and reconciliations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-white/60">
            Use the Wallet workspace for payouts and statements. As we add external bank integrations, this tab
            will show balances, feeds, and reconciliation status across accounts.
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
