import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function FinancesMaterialsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 mb-1">Materials</h1>
          <p className="text-sm text-slate-400">
            Material lists tied to active jobs, managed through each jobs deal room.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-slate-600 text-[11px] text-slate-200"
            onClick={() => navigate("/finances/jobs")}
          >
            Open jobs workspace
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-100">How material lists work</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Material lists are created and sent from the deal room for each job. This tab gives you a high-level
            explanation and will later surface cross-job rollups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-slate-400">
            To create or manage a material list today, open the job in the deal room from the Jobs workspace.
            There you can draft lists, send them to clients, and move the job into estimates and contracts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
