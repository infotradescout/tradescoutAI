import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FinancesEmployeesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Employees</h1>
        <p className="text-sm text-white/60">
          High-level view of people doing the work. Detailed hiring and team tools live elsewhere in
          TradeScout.
        </p>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">Team overview</CardTitle>
          <CardDescription className="text-xs text-white/60">
            Today, crew management and invites live in your dashboards and Worker Marketplace. This
            page will eventually surface headcount, roles, payouts, and costs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-white/60">
            Use your contractor and helper dashboards plus Worker Marketplace to add or manage crew.
            As payroll and time tracking tighten into Finances, this tab will show headcount, roles,
            and pay summaries.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
