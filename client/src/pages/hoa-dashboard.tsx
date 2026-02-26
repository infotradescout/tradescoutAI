import { memo, useEffect, useState } from "react";
import {
  Home,
  DollarSign,
  Users,
  Calendar,
  FileText,
  Vote,
  Wrench,
  BarChart3,
  MessageSquare,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HOADashboardShell } from "@/shells/HOADashboardShell";
import { useNotifications } from "@/hooks/useNotifications";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { useParams } from "wouter";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import { SEOHelmet } from "@/components/SEOHelmet";
import { HOANextStepsCard } from "@/components/hoa/HOANextStepsCard";

const HOA_SIMPLE_VIEW_KEY = "ts:hoa:simple_view:v1";

type HoaDashboard = {
  hoaId: string;
  hoaName: string;
  memberCount: number;
  activeMembers: number;
  openVotesCount: number;
  groupType: "hoa";
  recentVotes: {
    id: string;
    title: string;
    status: string;
    closesAt: string | null;
  }[];
  balance?: number;
  recentTransactions?: {
    id: string;
    type: string;
    amount: number;
    occurredAt: string;
  }[];
  governance?: {
    votingEnabled?: boolean;
    financialsEnabled?: boolean;
    vendorManagementEnabled?: boolean;
    documentLibraryEnabled?: boolean;
    eventCalendarEnabled?: boolean;
    communicationsEnabled?: boolean;
    architecturalReviewEnabled?: boolean;
    violationsEnabled?: boolean;
    maintenanceRequestsEnabled?: boolean;
    residentDirectoryEnabled?: boolean;
    commonAreaReservationsEnabled?: boolean;
    customRoles?: any;
    quorumPercentage?: number;
    votePassThreshold?: number;
  };
};

const HOADashboard = memo(function HOADashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [simpleView, setSimpleView] = useState(false);
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const params = useParams();
  const hoaId = params?.hoaId as string | undefined;
  const location = useLocationContext({
    layer: "hoa",
    hoaId: hoaId ?? undefined,
  });
  const countyCommitted = hasCountyContext(location);

  const { data, isLoading, isError } = useQuery<{ dashboard: HoaDashboard }>({
    queryKey: [
      "/api/hoa/dashboard",
      location.layer,
      location.stateCode,
      location.countyFips,
      location.hoaId,
    ],
    queryFn: async () => {
      const query = hoaId ? `?hoaId=${encodeURIComponent(hoaId)}` : "";
      const res = await fetch(`/api/hoa/dashboard${query}`);
      if (!res.ok) {
        throw new Error("Failed to load HOA dashboard");
      }
      const json = await res.json();

      if (countyCommitted) {
        try {
          const { recordActivity } = await import("../agent/activity");
          recordActivity({
            type: "county_gated_query_success",
            ts: new Date().toISOString(),
            path: typeof window !== "undefined" ? window.location.pathname : "",
            meta: { surface: "hoa_dashboard", queryKey: "hoa_dashboard" },
          });
        } catch {
          // ignore telemetry failures
        }
      }

      return json;
    },
    enabled: !!user && countyCommitted,
  });

  const dashboard = data?.dashboard;

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      setSimpleView(window.localStorage.getItem(HOA_SIMPLE_VIEW_KEY) === "1");
    } catch {
      // no-op
    }
  }, []);

  const toggleSimpleView = () => {
    setSimpleView((prev) => {
      const next = !prev;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(HOA_SIMPLE_VIEW_KEY, next ? "1" : "0");
        }
      } catch {
        // no-op
      }
      if (next) {
        setActiveTab("overview");
      }
      return next;
    });
  };

  if (countyCommitted && isLoading) {
    return (
      <HOADashboardShell locationOverride={location}>
        <SEOHelmet
          title="HOA Dashboard | TradeScout"
          description="Private HOA dashboard for verified members."
          canonical="https://www.thetradescout.com/hoa-dashboard"
          noIndex
        />
        <div className="w-full py-12 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-300">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
            <p>Loading your HOA dashboard&hellip;</p>
          </div>
        </div>
      </HOADashboardShell>
    );
  }

  if (countyCommitted && (isError || !dashboard)) {
    return (
      <HOADashboardShell locationOverride={location}>
        <SEOHelmet
          title="HOA Dashboard | TradeScout"
          description="Private HOA dashboard for verified members."
          canonical="https://www.thetradescout.com/hoa-dashboard"
          noIndex
        />
        <div className="w-full py-12 flex items-center justify-center">
          <Card className="bg-navy-800/60 border-navy-600 max-w-xl w-full">
            <CardHeader>
              <CardTitle className="text-white">No HOA linked yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-4 text-sm">
                You don&apos;t currently have an HOA linked to your TradeScout account. Once you
                join or register your neighborhood HOA, this dashboard will show live stats only for
                your community.
              </p>
              <p className="text-gray-400 text-sm">
                If you believe you should already be connected to an HOA, please verify your address
                from your profile or contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </HOADashboardShell>
    );
  }

  return (
    <HOADashboardShell locationOverride={location}>
      <SEOHelmet
        title="HOA Dashboard | TradeScout"
        description="Private HOA dashboard for verified members."
        canonical="https://www.thetradescout.com/hoa-dashboard"
        noIndex
      />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Home className="h-8 w-8 text-orange-400" />
          <h1 className="text-4xl font-bold text-white">HOA Management</h1>
        </div>
        <p className="text-gray-300 text-lg">{`${dashboard?.hoaName ?? "Your HOA"} Dashboard`}</p>
      </div>

      <div className="mb-6">
        <HOANextStepsCard
          title="What to do next"
          description="Use this dashboard as your HOA home base. Start with one action and TradeScout keeps everything in the right workflow."
          steps={[
            "Check Overview for current HOA status.",
            "Open Maintenance to submit or track service requests.",
            "Review Voting when community decisions are active.",
          ]}
          simpleViewEnabled={simpleView}
          onToggleSimpleView={toggleSimpleView}
        />
      </div>

      {/* Quick Stats */}
      <div
        className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        data-testid="hoa-dashboard-metrics"
      >
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Units</p>
                <p className="text-2xl font-bold text-white">{dashboard?.memberCount ?? 0}</p>
              </div>
              <Home className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Monthly Revenue</p>
                <p className="text-2xl font-bold text-white">
                  {typeof dashboard?.balance === "number"
                    ? `$${dashboard.balance.toLocaleString()}`
                    : "--"}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Residents</p>
                <p className="text-2xl font-bold text-white">{dashboard?.activeMembers ?? 0}</p>
              </div>
              <Users className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Collection Rate</p>
                <p className="text-2xl font-bold text-white">
                  {typeof dashboard?.balance === "number" ? "100%" : "--"}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid w-full ${simpleView ? "grid-cols-3" : "grid-cols-6"} bg-navy-800/50 backdrop-blur-sm`}
        >
          <TabsTrigger value="overview" className="data-[state=active]:bg-orange-600">
            Overview
          </TabsTrigger>
          {!simpleView && (
            <TabsTrigger value="financials" className="data-[state=active]:bg-orange-600">
              Financials
            </TabsTrigger>
          )}
          <TabsTrigger value="maintenance" className="data-[state=active]:bg-orange-600">
            Maintenance
          </TabsTrigger>
          {dashboard?.governance?.votingEnabled !== false && (
            <TabsTrigger value="voting" className="data-[state=active]:bg-orange-600">
              Voting
            </TabsTrigger>
          )}
          {!simpleView && (
            <TabsTrigger value="documents" className="data-[state=active]:bg-orange-600">
              Documents
            </TabsTrigger>
          )}
          {!simpleView && (
            <TabsTrigger value="residents" className="data-[state=active]:bg-orange-600">
              Residents
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activities */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Recent Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard?.recentTransactions && dashboard.recentTransactions.length > 0 ? (
                    dashboard.recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center gap-3 p-3 bg-navy-700/50 rounded-lg"
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            tx.type === "revenue" ? "bg-green-400" : "bg-red-400"
                          }`}
                        />
                        <div className="flex-1">
                          <p className="text-white text-sm">
                            {tx.type === "revenue" ? "Revenue" : "Expense"} · $
                            {tx.amount.toLocaleString()}
                          </p>
                          <p className="text-gray-400 text-xs">{tx.occurredAt}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-sm">
                      No recent financial activity recorded yet for this HOA.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Current Issues */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Active Maintenance Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    Maintenance requests and vendor work are managed from the HOA Management view.
                    As your association begins tracking work there, this overview will summarize
                    open issues for your neighborhood only.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financials" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Budget Overview */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  2024 Budget Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    Detailed category breakdowns come from your HOA&apos;s financial records as
                    boards upload budgets and actuals. For now this card summarizes overall balances
                    only and never mixes data between different HOAs.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payment Status */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Payment Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    As collections and delinquencies are tracked for your HOA, this card will show
                    live collection health for your neighborhood. Payment actions are handled in the
                    HOA Management finances tab.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Approved Vendors */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Approved Vendors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    Approved vendors are configured per HOA. Use the HOA Management vendors tab to
                    add and rate vendors for your community; this dashboard will then surface
                    activity summaries here.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Maintenance Requests */}
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Recent Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    Service requests submitted by residents will appear here once your HOA starts
                    using TradeScout for maintenance. Until then, there is no mock or sample
                    resident data shown.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {dashboard?.governance?.votingEnabled !== false && (
          <TabsContent value="voting" className="mt-6">
            <div className="space-y-6">
              {/* Active Votes */}
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Vote className="h-5 w-5" />
                    Active Voting
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {dashboard?.recentVotes && dashboard.recentVotes.length > 0 ? (
                      dashboard.recentVotes.map((vote) => (
                        <div key={vote.id} className="p-4 bg-navy-700/50 rounded-lg">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-white font-semibold text-lg">{vote.title}</h3>
                              <p className="text-gray-400 text-sm mt-1">Status: {vote.status}</p>
                            </div>
                            {vote.closesAt && (
                              <Badge
                                variant="outline"
                                className="text-yellow-400 border-yellow-400"
                              >
                                Closes {new Date(vote.closesAt).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs">
                            Voting details and participation are available on the HOA Management
                            voting tab.
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-sm">
                        No active HOA votes right now for your association.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        <TabsContent value="documents" className="mt-6">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5" />
                HOA Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-navy-700/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-orange-400 mt-1" />
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm">Governing documents</h4>
                      <p className="text-gray-400 text-xs mt-1">
                        CC&Rs, bylaws, rules, and other documents are managed from the HOA
                        Management documents tab for your specific association.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-navy-700/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-orange-400 mt-1" />
                    <div className="flex-1">
                      <h4 className="text-white font-medium text-sm">Financial reports</h4>
                      <p className="text-gray-400 text-xs mt-1">
                        As boards upload financials, this dashboard will summarize them here for
                        your neighborhood only.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="residents" className="mt-6">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                Resident Directory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 text-sm">
                Resident directories live in the HOA Management view for members of your association
                only. This summary will never display residents from HOAs you are not a member of.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </HOADashboardShell>
  );
});

export default HOADashboard;
