import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Calendar, MessageSquare, Filter } from "lucide-react";
import { EmptyState } from "@/components/ui/states";

interface DashboardProject {
  id: string;
  title: string;
  status?: string;
  value?: string | number | null;
  createdAt?: string | Date | null;
}

interface DashboardQuote {
  id: string;
  status?: string;
}

interface DashboardConversation {
  id: string;
  status?: string;
  lastMessageAt?: string | Date | null;
}

interface DashboardResponse {
  myProjects?: DashboardProject[];
  quotes?: DashboardQuote[];
  conversations?: DashboardConversation[];
}

const formatCurrency = (value?: string | number | null) => {
  if (value === null || value === undefined) return "Not specified";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "Not specified";
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "new":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "contacted":
    case "qualified":
    case "matched":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "closed":
      return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    default:
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  }
};

const ContractorLeads = memo(function ContractorLeads() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<DashboardResponse>({
    queryKey: ["/api/dashboard", user?.id],
    enabled: !!user?.id,
  });

  const leads = (data?.myProjects ?? []).map((project) => ({
    id: project.id,
    title: project.title,
    status: project.status || "new",
    value: project.value,
    createdAt: project.createdAt,
  }));

  const newTodayCount = leads.filter((lead) => {
    if (!lead.createdAt) return false;
    const created = new Date(lead.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    const diffMs = Date.now() - created.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return diffMs <= oneDayMs;
  }).length;

  const responseCount = (data?.quotes ?? []).length;
  const pendingReplies = (data?.conversations ?? []).filter((c) => c.status !== "closed").length;

  return (
    <div className="pb-20 lg:pb-0">
      <div className="container mx-auto px-4 py-6 lg:py-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 lg:mb-12">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-sm">
                  <TrendingUp className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl lg:text-5xl font-bold text-foreground mb-1">
                    Project Opportunities
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Connect with homeowners looking for your services
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-border text-muted-foreground hover:bg-muted"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-tsCard border-tsBorder">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-500 mb-1">
                    {isLoading ? "—" : leads.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Available Projects</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-tsCard border-tsBorder">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500 mb-1">
                    {isLoading ? "—" : newTodayCount}
                  </p>
                  <p className="text-sm text-muted-foreground">New Today</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-tsCard border-tsBorder">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500 mb-1">
                    {isLoading ? "—" : responseCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Your Responses</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-tsCard border-tsBorder">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-500 mb-1">
                    {isLoading ? "—" : pendingReplies}
                  </p>
                  <p className="text-sm text-muted-foreground">Open Conversations</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Leads List */}
          <div className="space-y-4">
            {!isLoading && leads.length === 0 && (
              <EmptyState
              icon={<TrendingUp />}
              title="No Projects Available"
              description="Check back soon for new project opportunities in your area"
            />
            )}

            {leads.map((lead) => (
              <Card
                key={lead.id}
                className="bg-tsCard border-tsBorder shadow-xl hover:border-orange-500/30 transition-all"
              >
                <CardHeader className="border-b border-tsBorder pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl text-foreground">{lead.title}</CardTitle>
                        <Badge className={`${getStatusColor(lead.status)} border`}>
                          {lead.status.toUpperCase()}
                        </Badge>
                      </div>
                      {lead.createdAt && (
                        <p className="text-sm text-muted-foreground">
                          Created{" "}
                          {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground mb-1">Est. Value</p>
                      <p className="text-2xl font-bold text-orange-500">
                        {formatCurrency(lead.value)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-foreground mb-6 leading-relaxed">
                    Project request from your dashboard
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <DollarSign className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Budget</p>
                        <p className="text-foreground font-medium">{formatCurrency(lead.value)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Status</p>
                        <p className="text-foreground font-medium">{lead.status}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-8 w-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-4 w-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Created</p>
                        <p className="text-foreground font-medium">
                          {lead.createdAt
                            ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })
                            : "Not available"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      data-testid={`button-respond-${lead.id}`}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Respond to Project
                    </Button>
                    <Button
                      variant="outline"
                      className="border-border text-muted-foreground hover:bg-muted"
                    >
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      className="border-border text-muted-foreground hover:bg-muted"
                    >
                      Save for Later
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty state handled above when there are no leads */}
        </div>
      </div>
    </div>
  );
});

export default ContractorLeads;
