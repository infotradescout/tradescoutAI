import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, TrendingUp, Users, DollarSign, Heart, Award, Globe, Building } from "lucide-react";
import { EmptyState, SkeletonBlock, SkeletonTable } from "@/components/ui/states";

interface NationwideMetrics {
  totalUsers: number;
  totalContractors: number;
  totalProjects: number;
  totalRevenue: string;
}

interface TopCounty {
  fips: string;
  contractorCount: number;
  avgRating: number;
  growthRate: number;
}

interface ExpansionRecord {
  county: string;
  state: string;
  population: number;
  status: string;
  priority: string;
  estimatedLaunch: string;
}

export default function NationwideExpansion() {
  const { user } = useAuth();

  const {
    data: metrics,
    isLoading: metricsLoading,
    isError: metricsError,
  } = useQuery<NationwideMetrics | undefined>({
    queryKey: ["/api/nationwide/metrics"],
    queryFn: async () => {
      const res = await fetch("/api/nationwide/metrics");
      if (!res.ok) throw new Error("Failed to fetch nationwide metrics");
      return res.json();
    },
  });

  const {
    data: topCounties = [],
    isLoading: countiesLoading,
    isError: countiesError,
  } = useQuery<TopCounty[]>({
    queryKey: ["/api/nationwide/top-counties"],
    queryFn: async () => {
      const res = await fetch("/api/nationwide/top-counties?limit=10");
      if (!res.ok) throw new Error("Failed to fetch county data");
      return res.json();
    },
  });

  const {
    data: expansionPipeline = [],
    isLoading: pipelineLoading,
    isError: pipelineError,
  } = useQuery<ExpansionRecord[]>({
    queryKey: ["/api/nationwide/expansion-pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/nationwide/expansion-pipeline");
      if (!res.ok) throw new Error("Failed to fetch expansion data");
      return res.json();
    },
  });

  const {
    data: foundationImpact,
    isLoading: impactLoading,
    isError: impactError,
  } = useQuery<
    | {
        totalRaised: number;
        totalDonors: number;
        activeCauses: number;
        countiesSupported: number;
      }
    | undefined
  >({
    queryKey: ["/api/nationwide/foundation-impact"],
    queryFn: async () => {
      const res = await fetch("/api/nationwide/foundation-impact");
      if (!res.ok) throw new Error("Failed to fetch foundation impact");
      return res.json();
    },
  });

  const { isLoading: affiliateLoading, isError: affiliateError } = useQuery<
    { message?: string } | undefined
  >({
    queryKey: ["/api/nationwide/affiliate-performance"],
    queryFn: async () => {
      const res = await fetch("/api/nationwide/affiliate-performance");
      if (!res.ok) throw new Error("Failed to fetch affiliate performance");
      return res.json();
    },
  });

  if (metricsLoading) {
    return (
      <div className="gradient-bg p-6 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-2 text-slate-400">Loading nationwide metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg p-6 py-8" data-testid="nationwide-expansion-page">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">Nationwide Expansion</h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            This page reflects TradeScout's current nationwide footprint and community impact based
            on real activity.
          </p>
        </div>

        {/* Key Metrics Dashboard */}
        {metrics && !metricsError ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="border-slate-700" style={{ backgroundColor: "var(--surface-card)" }}>
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                {typeof metrics.totalUsers === "number" ? (
                  <div className="text-xl font-bold text-white">
                    {metrics.totalUsers.toLocaleString()}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Users metric unavailable</div>
                )}
                <p className="text-xs text-slate-400">Registered Users</p>
              </CardContent>
            </Card>

            <Card className="border-slate-700" style={{ backgroundColor: "var(--surface-card)" }}>
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <MapPin className="w-4 h-4 text-orange-400" />
                </div>
                {typeof metrics.totalContractors === "number" ? (
                  <div className="text-xl font-bold text-white">
                    {metrics.totalContractors.toLocaleString()}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Contractor metric unavailable</div>
                )}
                <p className="text-xs text-slate-400">Verified Contractors</p>
              </CardContent>
            </Card>

            <Card className="border-slate-700" style={{ backgroundColor: "var(--surface-card)" }}>
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="w-4 h-4 text-teal-400" />
                </div>
                <div className="text-lg font-bold text-white">
                  ${Number(metrics.totalRevenue || 0).toLocaleString()}
                </div>
                <p className="text-xs text-slate-400">Platform Revenue (lifetime)</p>
              </CardContent>
            </Card>

            <Card className="border-slate-700" style={{ backgroundColor: "var(--surface-card)" }}>
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <MapPin className="w-4 h-4 text-purple-400" />
                </div>
                {typeof metrics.totalProjects === "number" ? (
                  <div className="text-xl font-bold text-white">
                    {metrics.totalProjects.toLocaleString()}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Project metric unavailable</div>
                )}
                <p className="text-xs text-slate-400">Projects Recorded</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div
            className="border border-slate-700 rounded-lg p-4 text-center text-slate-400"
            style={{ backgroundColor: "var(--surface-card)" }}
          >
            Nationwide metrics are temporarily unavailable. No estimates are shown.
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList
            className="grid w-full grid-cols-5"
            style={{ backgroundColor: "var(--surface-frame)" }}
          >
            <TabsTrigger value="overview" className="data-[state=active]:bg-purple-500">
              Overview
            </TabsTrigger>
            <TabsTrigger value="counties" className="data-[state=active]:bg-purple-500">
              Top Areas
            </TabsTrigger>
            <TabsTrigger value="expansion" className="data-[state=active]:bg-purple-500">
              Expansion
            </TabsTrigger>
            <TabsTrigger value="foundation" className="data-[state=active]:bg-purple-500">
              Community Builders
            </TabsTrigger>
            <TabsTrigger value="affiliates" className="data-[state=active]:bg-purple-500">
              Affiliates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-slate-700" style={{ backgroundColor: "var(--surface-card)" }}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Globe className="w-5 h-5 text-green-400" />
                    <span>Nationwide Snapshot</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {metrics && !metricsError ? (
                    <div className="space-y-2 text-sm text-slate-300">
                      <p>
                        These figures reflect aggregated nationwide activity recorded on TradeScout.
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {typeof metrics.totalUsers === "number" && (
                          <li>{metrics.totalUsers.toLocaleString()} registered users</li>
                        )}
                        {typeof metrics.totalContractors === "number" && (
                          <li>
                            {metrics.totalContractors.toLocaleString()} contractors with profiles
                          </li>
                        )}
                        {typeof metrics.totalProjects === "number" && (
                          <li>
                            {metrics.totalProjects.toLocaleString()} projects recorded in the system
                          </li>
                        )}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Nationwide metrics are not available at this time. No estimates are shown.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="counties" className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                <Award className="w-5 h-5 text-yellow-400" />
                <span>County Contractor Activity</span>
              </h3>
              {countiesLoading && <SkeletonTable rows={3} />}
              {!countiesLoading && (countiesError || !topCounties.length) && (
                <EmptyState
                  title="No County Data"
                  description="County-level contractor activity is not available right now."
                />
              )}
              {!countiesLoading && !countiesError && topCounties.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {topCounties.map((county) => (
                    <Card
                      key={county.fips}
                      className="border-slate-700"
                      style={{ backgroundColor: "var(--surface-card)" }}
                      data-testid={`county-${county.fips}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <CardTitle className="text-white text-lg">
                              County FIPS {county.fips}
                            </CardTitle>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="border-slate-600 text-slate-300">
                                Contractor presence snapshot
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-yellow-400">
                              {county.avgRating.toFixed(1)}
                            </div>
                            <p className="text-xs text-slate-400">Average Rating</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="space-y-1">
                            <div className="text-lg font-bold text-orange-400">
                              {county.contractorCount}
                            </div>
                            <p className="text-xs text-slate-400">Contractors</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="expansion" className="space-y-6">
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                <span>Expansion Planning Snapshot</span>
              </h3>
              {pipelineLoading && (
                <p className="text-sm text-slate-400">Loading expansion planning data…</p>
              )}
              {!pipelineLoading && (pipelineError || !expansionPipeline.length) && (
                <p className="text-sm text-slate-400">
                  Expansion planning data is temporarily unavailable. No projections are shown.
                </p>
              )}
              {!pipelineLoading &&
                !pipelineError &&
                expansionPipeline.length > 0 &&
                expansionPipeline.map((phase, index) => (
                  <Card
                    key={index}
                    className="border-slate-700"
                    style={{ backgroundColor: "var(--surface-card)" }}
                    data-testid={`expansion-phase-${index}`}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <CardTitle className="text-white">
                            {phase.county}, {phase.state}
                          </CardTitle>
                          <Badge
                            variant={phase.status === "in_progress" ? "default" : "secondary"}
                            className={
                              phase.status === "in_progress"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-slate-900/40 text-slate-400"
                            }
                          >
                            {phase.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-400">
                            {(phase.population || 0).toLocaleString()}
                          </div>
                          <p className="text-sm text-slate-400">Population (census)</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-slate-300">
                        This county appears in TradeScout's internal expansion planning records.
                        Status and priority reflect planning state only and are not guarantees of
                        launch timing.
                      </p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="foundation" className="space-y-6">
            <Card className="border-slate-700" style={{ backgroundColor: "var(--surface-card)" }}>
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Heart className="w-5 h-5 text-pink-400" />
                  <span>Foundation Impact</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {impactLoading && (
                  <p className="text-sm text-slate-400">Loading foundation impact…</p>
                )}
                {!impactLoading && (impactError || !foundationImpact) && (
                  <p className="text-sm text-slate-400">
                    Foundation impact data is not available at this time. No estimates are shown.
                  </p>
                )}
                {!impactLoading && !impactError && foundationImpact && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Raised</span>
                      <span className="text-pink-400 font-semibold">
                        ${foundationImpact.totalRaised.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Donors</span>
                      <span className="text-blue-400 font-semibold">
                        {foundationImpact.totalDonors.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Active Causes</span>
                      <span className="text-green-400 font-semibold">
                        {foundationImpact.activeCauses.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Counties Supported</span>
                      <span className="text-orange-400 font-semibold">
                        {foundationImpact.countiesSupported.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="affiliates" className="space-y-6">
            <Card className="border-slate-700" style={{ backgroundColor: "var(--surface-card)" }}>
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Award className="w-5 h-5 text-yellow-400" />
                  <span>Affiliate Program</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {affiliateLoading && (
                  <p className="text-sm text-slate-400">Loading affiliate metrics…</p>
                )}
                {!affiliateLoading && (
                  <p className="text-sm text-slate-400">
                    Affiliate performance data is not available yet. No projections or earnings
                    estimates are shown.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
