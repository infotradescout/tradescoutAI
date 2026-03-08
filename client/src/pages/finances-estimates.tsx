import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function FinancesEstimatesPage() {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-1">Estimates</h1>
          <p className="text-sm text-white/60">
            Quotes waiting for approval, driven by each job's deal room.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <CardTitle className="text-sm font-semibold text-white">Estimate pipeline</CardTitle>
          <CardDescription className="text-xs text-white/60">
            Estimates are created and sent from the job's deal room. This page will grow into a true
            estimate board (by stage, by client, by job).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] text-white/60">
            For now, go to a job's deal room to draft, send, or approve estimates. As the accounting
            layer deepens, this view will summarize open and approved estimates across your jobs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
