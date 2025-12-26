import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FinancesPayrollPage() {
  return (
    <div className="flex flex-col gap-4 bg-tsBg">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-tsText mb-1">Payroll</h1>
        <p className="text-sm text-tsTextMuted">
          Summaries of payouts and tax statements driven by your wallet and external payroll tools.
        </p>
      </div>

      <Card className="bg-tsCard border-tsBorder">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-tsText">Payouts and taxes</CardTitle>
          <CardDescription className="text-xs text-tsTextMuted">
            Today, TradeScout Wallet and your tax statements provide the source of truth for on-platform payouts.
            This workspace will consolidate period statements and integrate with payroll providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-tsTextMuted">
            Use the Wallet page to download period statements for bookkeeping and tax prep. As we wire deeper
            payroll integrations, this view will show gross vs. net, employer taxes, and links into your payroll
            provider.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
