import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, DollarSign, Eye, Calendar, Target, MapPin, Clock } from "lucide-react";
import { getStatusColorClass } from "@/lib/colors";

const Analytics = memo(function Analytics() {
  type SummaryResponse = {
    totalRequests: number;
    revenue: number;
    profileViews: number;
    conversionRate: number;
  };

  type SourcesResponse = {
    sources: {
      source: string;
      requests: number;
    }[];
  };

  type ProjectsResponse = {
    projects: {
      id: string;
      title: string;
      client: string | null;
      value: number;
      status: string;
      date: string;
      location: string | null;
    }[];
  };

  type RevenueTrendResponse = {
    points: {
      date: string;
      label: string;
      value: number;
    }[];
  };

  type FunnelResponse = {
    requestsReceived: number;
    contacted: number;
    quoted: number;
    converted: number;
  };

  const { data: summary, isLoading: summaryLoading } = useQuery<SummaryResponse>({
    queryKey: ["/api/pro/analytics/summary"],
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery<SourcesResponse>({
    queryKey: ["/api/pro/analytics/sources"],
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery<ProjectsResponse>({
    queryKey: ["/api/pro/analytics/projects"],
  });

  const { data: revenueTrend, isLoading: revenueTrendLoading } = useQuery<RevenueTrendResponse>({
    queryKey: ["/api/pro/analytics/revenue-trend"],
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery<FunnelResponse>({
    queryKey: ["/api/pro/analytics/funnel"],
  });

  const metrics = [
    {
      label: "Total Requests",
      value: summary ? summary.totalRequests.toLocaleString() : "—",
      icon: Users,
      color: "blue",
    },
    {
      label: "Revenue",
      value: summary
        ? `$${summary.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : "—",
      icon: DollarSign,
      color: "emerald",
    },
    {
      label: "Profile Views",
      value: summary ? summary.profileViews.toLocaleString() : "—",
      icon: Eye,
      color: "purple",
    },
    {
      label: "Conversion Rate",
      value: summary ? `${summary.conversionRate.toFixed(1)}%` : "—",
      icon: Target,
      color: "orange",
    },
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "emerald":
        return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "purple":
        return "text-purple-400 bg-purple-400/10 border-purple-400/20";
      case "orange":
        return "text-ts-orange bg-ts-orange/10 border-ts-orange/30";
      default:
        return "text-white/60 bg-white/10 border-white/15";
    }
  };

  const getStatusColor = (status: string) => {
    return getStatusColorClass(status);
  };

  return (
    <div className="px-6 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-4">Business Analytics</h1>
          <p className="text-lg md:text-xl text-white/70">
            Track your performance, opportunities, and revenue with detailed insights
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {summaryLoading && !summary
            ? Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="bg-white/5 border-white/10">
                  <CardContent className="p-6 animate-pulse">
                    <div className="h-6 bg-white/10 rounded mb-4" />
                    <div className="h-4 bg-white/10 rounded w-1/2" />
                  </CardContent>
                </Card>
              ))
            : metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <Card key={index} className="bg-white/5 border-white/10">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-lg ${getColorClasses(metric.color)}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-1">{metric.value}</h3>
                      <p className="text-white/60 text-sm">{metric.label}</p>
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/5">
            <TabsTrigger value="overview" className="data-[state=active]:bg-ts-orange-dark">
              Overview
            </TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-ts-orange-dark">
              Requests
            </TabsTrigger>
            <TabsTrigger value="projects" className="data-[state=active]:bg-ts-orange-dark">
              Projects
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-ts-orange-dark">
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Request Sources */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Request Sources</CardTitle>
                  <CardDescription className="text-white/60">
                    Where your project requests are coming from this month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sourcesLoading && !sourcesData ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="h-4 bg-white/10 rounded animate-pulse" />
                        ))}
                      </div>
                    ) : !sourcesData || sourcesData.sources.length === 0 ? (
                      <p className="text-white/60 text-sm">
                        No request source analytics available yet.
                      </p>
                    ) : (
                      sourcesData.sources.map((source, index) => {
                        const total =
                          sourcesData.sources.reduce((sum, s) => sum + s.requests, 0) || 1;
                        const percentage = (source.requests / total) * 100;
                        return (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-3 h-3 bg-ts-orange rounded-full"></div>
                              <span className="text-white/70">{source.source}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-24 bg-white/10 rounded-full h-2">
                                <div
                                  className="bg-ts-orange h-2 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-white font-medium w-8">{source.requests}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Revenue Trend */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Revenue Trend
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Monthly revenue over the last 6 months
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {revenueTrendLoading && !revenueTrend ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="h-3 bg-white/10 rounded w-full animate-pulse" />
                        </div>
                      ))
                    ) : !revenueTrend || revenueTrend.points.length === 0 ? (
                      <p className="text-white/60 text-sm">No revenue trend data available yet.</p>
                    ) : (
                      revenueTrend.points.map((point) => {
                        const maxValue = Math.max(...revenueTrend.points.map((p) => p.value)) || 1;
                        const percentage = (point.value / maxValue) * 100;
                        return (
                          <div key={point.date} className="flex items-center justify-between">
                            <span className="text-white/70 w-8">{point.label}</span>
                            <div className="flex items-center gap-3 flex-1 ml-4">
                              <div className="w-full bg-white/10 rounded-full h-3">
                                <div
                                  className="bg-emerald-500 h-3 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-white font-medium w-16">
                                ${(point.value / 1000).toFixed(0)}k
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="requests">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Request Management</CardTitle>
                <CardDescription className="text-white/60">
                  Track and analyze your opportunity pipeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {funnelLoading && !funnel ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="p-4 bg-white/5 border border-white/10 rounded-lg animate-pulse"
                      />
                    ))
                  ) : (
                    <>
                      <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg text-center">
                        <h3 className="text-2xl font-bold text-blue-400 mb-1">
                          {funnel ? funnel.requestsReceived : 0}
                        </h3>
                        <p className="text-white/70">Requests Received</p>
                        <p className="text-xs text-white/60">Last 30 days</p>
                      </div>
                      <div className="p-4 bg-yellow-600/10 border border-yellow-600/20 rounded-lg text-center">
                        <h3 className="text-2xl font-bold text-yellow-400 mb-1">
                          {funnel ? funnel.quoted : 0}
                        </h3>
                        <p className="text-white/70">Quoted</p>
                        <p className="text-xs text-white/60">Last 30 days</p>
                      </div>
                      <div className="p-4 bg-emerald-600/10 border border-emerald-600/20 rounded-lg text-center">
                        <h3 className="text-2xl font-bold text-emerald-400 mb-1">
                          {funnel ? funnel.converted : 0}
                        </h3>
                        <p className="text-white/70">Converted</p>
                        <p className="text-xs text-white/60">Last 30 days</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-white">Conversion Funnel</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white/70">Requests Received</span>
                      <span className="text-white font-medium">
                        {funnel ? funnel.requestsReceived : 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white/70">Contacted</span>
                      <span className="text-white font-medium">
                        {funnel ? funnel.contacted : 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white/70">Quoted</span>
                      <span className="text-white font-medium">{funnel ? funnel.quoted : 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                      <span className="text-white/70">Converted</span>
                      <span className="text-white font-medium">
                        {funnel ? funnel.converted : 0}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Recent Projects</CardTitle>
                <CardDescription className="text-white/60">
                  Overview of your latest project activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projectsLoading && !projectsData ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="p-4 bg-white/10 rounded-lg animate-pulse h-20"
                      />
                    ))
                  ) : !projectsData || projectsData.projects.length === 0 ? (
                    <p className="text-white/60 text-sm">
                      No recent project analytics available yet.
                    </p>
                  ) : (
                    projectsData.projects.map((project) => (
                      <div key={project.id} className="p-4 bg-white/10 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-white mb-1">{project.title}</h3>
                            {project.client && (
                              <p className="text-white/60 text-sm">Client: {project.client}</p>
                            )}
                          </div>
                          <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2 text-white/70">
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                            <span>Value: ${project.value.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-white/70">
                            <MapPin className="w-4 h-4 text-blue-400" />
                            <span>{project.location || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-white/70">
                            <Calendar className="w-4 h-4 text-purple-400" />
                            <span>{new Date(project.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Response Time</CardTitle>
                  <CardDescription className="text-white/60">
                    How quickly you respond to new requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-ts-orange-dark/10 border-4 border-ts-orange/30 mb-4">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-ts-orange">2.3</span>
                        <span className="text-lg text-white/60 ml-1">hrs</span>
                      </div>
                    </div>
                    <p className="text-white/70">Average Response Time</p>
                    <Badge
                      variant="outline"
                      className="mt-2 text-emerald-400 border-emerald-400/50"
                    >
                      -15% from last month
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Customer Satisfaction</CardTitle>
                  <CardDescription className="text-white/60">
                    Average rating from completed projects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-600/10 border-4 border-emerald-600/20 mb-4">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-emerald-400">4.8</span>
                        <span className="text-lg text-white/60 ml-1">/5</span>
                      </div>
                    </div>
                    <p className="text-white/70">Overall Rating</p>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg key={star} className="w-5 h-5 fill-yellow-400" viewBox="0 0 20 20">
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <Button className="bg-ts-orange-dark hover:bg-ts-orange-dark text-white">
            <TrendingUp className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/5">
            <Calendar className="w-4 h-4 mr-2" />
            View Full History
          </Button>
        </div>
      </div>
    </div>
  );
});

export default Analytics;
