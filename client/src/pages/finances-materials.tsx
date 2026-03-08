import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Page } from "@/components/layout/PagePrimitives";

export default function FinancesMaterialsPage() {
  const [, navigate] = useLocation();

  return (
    <Page className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Materials</h1>
          <p className="text-sm text-white/60">
            Material lists tied to active jobs, managed directly from Finances workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => navigate("/finances/estimates")}
          >
            Open estimates
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-white/15 text-[11px] text-white/70"
            onClick={() => navigate("/finances/jobs")}
          >
            Open jobs
          </Button>
        </div>
      </div>

      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white">
            How material lists work
          </CardTitle>
          <CardDescription className="text-xs text-white/60">
            Material lists are tracked per job and aligned with estimates, invoices, and expenses.
            This tab gives you a high-level view while finance-native material actions are expanded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-white/60">
            For now, use Jobs and Estimates as the operational path for material planning and keep
            costs synced through Expenses. This keeps the full workflow inside Finances.
          </p>
        </CardContent>
      </Card>
    </Page>
  );
}
