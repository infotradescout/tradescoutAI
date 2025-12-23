import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FinancesPayrollPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 mb-1">Payroll</h1>
        <p className="text-sm text-slate-400">
          Summaries of payouts and tax statements driven by your wallet and external payroll tools.
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100">Payouts and taxes</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Today, TradeScout Wallet and your tax statements provide the source of truth for on-platform payouts.
            This workspace will consolidate period statements and integrate with payroll providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-slate-400">
            Use the Wallet page to download period statements for bookkeeping and tax prep. As we wire deeper
            payroll integrations, this view will show gross vs. net, employer taxes, and links into your payroll
            provider.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
