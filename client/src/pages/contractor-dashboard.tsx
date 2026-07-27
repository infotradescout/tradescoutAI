import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Briefcase, Users } from "lucide-react";
import { Page, Section } from "@/components/layout/PagePrimitives";
import { Badge } from "@/components/ui/badge";

type ContractorRoutedRequest = {
  requestId: string;
  requestType: string;
  category: string;
  county: string | null;
  cityArea: string | null;
  urgency: string | null;
  description: string;
  eligibilityReasons: string[];
  contactGateState: string;
  responseState: string | null;
  lifecycleStatus?: string | null;
  latestStatus?: string | null;
  unreadStatusCount?: number;
  createdAt: string | null;
};

export default function ContractorDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: routedRequests = [] } = useQuery<ContractorRoutedRequest[]>({
    queryKey: ["/api/direct-connect/contractor/requests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/direct-connect/contractor/requests");
      return Array.isArray(response) ? response : [];
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (input: { requestId: string; responseType: string }) =>
      apiRequest("POST", `/api/direct-connect/contractor/requests/${input.requestId}/respond`, {
        responseType: input.responseType,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/direct-connect/contractor/requests"],
      });
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (requestId: string) =>
      apiRequest("POST", `/api/direct-connect/contractor/requests/${requestId}/request-contact`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/direct-connect/contractor/requests"],
      });
    },
  });

  return (
    <Page>
      <Section
        title={`Welcome${user?.firstName ? `, ${user.firstName}` : ""}`}
        subtitle="Scout keeps your jobs, documents, and finances in one place. As you start responding to Direct Connect requests, sending quotes, and working jobs, this dashboard will reflect your real pipeline."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wide">
                <FileText className="h-4 w-4" />
                <span>Finances</span>
              </div>
              <CardTitle className="text-sm text-foreground">Create your first invoice</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Record work you&apos;ve already done or bill a new job. Your invoices will show up
                in Finances.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full" onClick={() => setLocation("/finances")}>
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
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/contractor-board")}
              >
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
                Use Helpers to post crew and helper opportunities for your business. Homeowners
                still start coordination in Direct Connect – this space is for responders.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button variant="outline" className="w-full" onClick={() => setLocation("/helpers")}>
                Open Helpers
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base text-foreground">Routed local requests</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                These requests are routed to you based on category, territory, trust, and profile
                readiness.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {routedRequests.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                  No routed requests yet. When a matching local request appears, it will show here.
                </div>
              ) : (
                routedRequests.map((request) => (
                  <div
                    key={request.requestId}
                    className="rounded-xl border border-border bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {request.requestType || "Local request"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.cityArea || request.county || "Local area"}
                          {request.urgency ? ` • ${request.urgency}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {request.contactGateState === "released"
                          ? "Contact released"
                          : "Contact locked"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-foreground/90 line-clamp-2">
                      {request.description}
                    </p>
                    {request.latestStatus && (
                      <p className="mt-2 text-xs font-medium text-foreground">
                        {request.latestStatus}
                        {typeof request.unreadStatusCount === "number" &&
                        request.unreadStatusCount > 0
                          ? ` (${request.unreadStatusCount} new)`
                          : ""}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Why this fits:{" "}
                      {request.eligibilityReasons?.[0] || "Category and territory match."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(request.responseState) || respondMutation.isPending}
                        onClick={() =>
                          respondMutation.mutate({
                            requestId: request.requestId,
                            responseType: "interested",
                          })
                        }
                      >
                        Respond interested
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(request.responseState) || respondMutation.isPending}
                        onClick={() =>
                          respondMutation.mutate({
                            requestId: request.requestId,
                            responseType: "need_more_info",
                          })
                        }
                      >
                        Need more info
                      </Button>
                      <Button
                        size="sm"
                        disabled={contactMutation.isPending}
                        onClick={() => contactMutation.mutate(request.requestId)}
                      >
                        Request contact
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </Section>
    </Page>
  );
}
