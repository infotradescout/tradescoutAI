import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function FinancesBankAccountsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 mb-1">Bank accounts</h1>
          <p className="text-sm text-slate-400">
            Connected accounts and syncs that power your ledger and reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-slate-600 text-[11px] text-slate-200"
            onClick={() => navigate("/wallet")}
          >
            Open wallet
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100">Account connections</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Today, TradeScout Wallet is your primary on-platform balance. This workspace will eventually show
            external bank connections, sync status, and reconciliations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-slate-400">
            Use the Wallet workspace for payouts and statements. As we add external bank integrations, this tab
            will show balances, feeds, and reconciliation status across accounts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
