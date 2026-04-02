import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FinancesPayrollPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-semibold text-tsText mb-1">Payroll</h1>
          <p className="text-sm text-white/60">
            Summaries of payouts and tax statements driven by your wallet and external payroll
            tools.
          </p>
        </div>
        <a
          href="/finances/payroll"
          className="text-xs text-ts-orange hover:underline font-medium"
          style={{ whiteSpace: "nowrap" }}
        >
          Payroll math
        </a>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-tsText">Payouts and taxes</CardTitle>
          <CardDescription className="text-xs text-white/60">
            Today, TradeScout Wallet and your tax statements provide the source of truth for
            on-platform payouts. This page will consolidate period statements and integrate with
            payroll providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-white/60">
            Use the Wallet page to download period statements for bookkeeping and tax prep. As we
            wire deeper payroll integrations, this view will show gross vs. net, employer taxes, and
            links into your payroll provider.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
