import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Briefcase, Users } from "lucide-react";

export default function ContractorDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-primary">Contractor workspace</p>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Scout keeps your jobs, documents, and finances in one place. As you start responding to
            Direct Connect requests, sending quotes, and working jobs, this dashboard will reflect your real pipeline.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide">
                <FileText className="h-4 w-4" />
                <span>Finances</span>
              </div>
              <CardTitle className="text-sm text-foreground">Create your first invoice</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Record work you&apos;ve already done or bill a new job. Your invoices will show up in
                the Finances workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full" onClick={() => setLocation("/finances/invoices")}>
                Open invoices
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide">
                <Briefcase className="h-4 w-4" />
                <span>Jobs</span>
              </div>
              <CardTitle className="text-sm text-foreground">Open contractor board</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Track active jobs, bids, and field execution from one board.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="outline" className="w-full" onClick={() => setLocation("/contractor-board")}>
                Go to contractor board
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide">
                <Users className="h-4 w-4" />
                <span>Crew & helpers</span>
              </div>
              <CardTitle className="text-sm text-foreground">Coordinate crew and helpers</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Use Helpers to post crew and helper opportunities for your business. Homeowners still
                start coordination in Direct Connect – this space is for responders.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="outline" className="w-full" onClick={() => setLocation("/helpers")}>
                Open Helpers
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
