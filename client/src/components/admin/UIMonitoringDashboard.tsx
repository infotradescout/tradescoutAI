import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertTriangle,
  Bug,
  Zap,
  Eye,
  Layout,
  CheckCircle,
  Clock,
  X,
  RefreshCw,
  TrendingUp,
  Users,
  Monitor,
} from "lucide-react";

interface UIIssue {
  id: string;
  type: "bug" | "ux_issue" | "performance" | "accessibility" | "layout";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  element?: string;
  location: string;
  timestamp: Date;
  userAgent: string;
  suggestions: string[];
  status?: "new" | "investigating" | "resolved" | "ignored";
}

interface UIIssuesResponse {
  issues: UIIssue[];
  stats: {
    totalIssues: number;
    resolvedIssues: number;
    criticalIssues: number;
    lastAnalysis: Date;
  };
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

interface AIAnalysis {
  summary: {
    totalIssues: number;
    criticalIssues: number;
    unresolvedIssues: number;
    resolutionRate: string;
  };
  patterns: {
    topProblematicPages: Array<{ page: string; issueCount: number }>;
    commonIssueTypes: Record<string, number>;
    commonElements: Array<{ element: string; issueCount: number }>;
  };
  priorities: Array<{
    level: string;
    title: string;
    description: string;
    action: string;
  }>;
  recommendations: string[];
}

const severityColors = {
  low: "bg-blue-500",
  medium: "bg-yellow-500",
  high: "bg-ts-orange",
  critical: "bg-red-500",
};

const typeIcons = {
  bug: Bug,
  ux_issue: Users,
  performance: Zap,
  accessibility: Eye,
  layout: Layout,
};

export function UIMonitoringDashboard() {
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  // Fetch UI issues
  const {
    data: issuesData,
    isLoading,
    isError: issuesFailed,
    error: issuesError,
    refetch,
  } = useQuery<UIIssuesResponse>({
    queryKey: ["/api/admin/ui-issues"],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });

  // Fetch AI analysis
  const { data: analysis, isError: analysisFailed } = useQuery<AIAnalysis>({
    queryKey: ["/api/admin/ui-analysis"],
    refetchInterval: 60000, // Refresh every minute
    retry: false,
  });

  // Update issue status
  const updateIssueMutation = useMutation({
    mutationFn: async ({ issueId, status }: { issueId: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/ui-issues/${issueId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ui-issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ui-analysis"] });
    },
  });

  // Delete issue
  const deleteIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      return apiRequest("DELETE", `/api/admin/ui-issues/${issueId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ui-issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ui-analysis"] });
    },
  });

  const filteredIssues =
    issuesData?.issues.filter((issue) => {
      if (selectedFilter === "all") return true;
      if (selectedFilter === "critical") return issue.severity === "critical";
      if (selectedFilter === "unresolved") return issue.status !== "resolved";
      return issue.type === selectedFilter;
    }) || [];

  const handleUpdateStatus = (issueId: string, status: string) => {
    updateIssueMutation.mutate({ issueId, status });
  };

  const handleDeleteIssue = (issueId: string) => {
    if (confirm("Are you sure you want to delete this issue?")) {
      deleteIssueMutation.mutate(issueId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ts-orange/30"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Site Monitoring</h1>
          <p className="text-white/70">Real-time bug detection and UX analysis</p>
        </div>
        <Button onClick={() => refetch()} className="bg-ts-orange hover:bg-ts-orange-dark">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {(issuesFailed || analysisFailed) && (
        <Alert className="border-amber-500/70 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-300" />
          <AlertTitle className="text-amber-200">Monitoring data unavailable</AlertTitle>
          <AlertDescription className="text-amber-100/90">
            Some monitoring endpoints failed. Values below may be incomplete.
            {issuesFailed
              ? ` ${String((issuesError as any)?.message || "UI issues request failed")}`
              : ""}
          </AlertDescription>
        </Alert>
      )}

      {/* Critical Issues Alert */}
      {analysis && analysis.summary.criticalIssues > 0 && (
        <Alert className="border-red-500 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-500">Critical Issues Detected</AlertTitle>
          <AlertDescription className="text-red-400">
            {analysis.summary.criticalIssues} critical issues require immediate attention
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Monitor className="h-8 w-8 text-ts-orange" />
              <div className="ml-4">
                <p className="text-sm font-medium text-white/70">Total Issues</p>
                <p className="text-2xl font-bold text-white">
                  {issuesFailed ? "N/A" : (issuesData?.stats.totalIssues ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-white/70">Critical</p>
                <p className="text-2xl font-bold text-white">
                  {issuesFailed ? "N/A" : (issuesData?.stats.criticalIssues ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-white/70">Resolved</p>
                <p className="text-2xl font-bold text-white">
                  {issuesFailed ? "N/A" : (issuesData?.stats.resolvedIssues ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-white/70">Resolution Rate</p>
                <p className="text-2xl font-bold text-white">
                  {analysisFailed ? "N/A" : `${analysis?.summary.resolutionRate || "0"}%`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value="issues" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-tsCard">
          <TabsTrigger value="issues" className="data-[state=active]:bg-ts-orange">
            Issues
          </TabsTrigger>
          <TabsTrigger value="analysis" className="data-[state=active]:bg-ts-orange">
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="patterns" className="data-[state=active]:bg-ts-orange">
            Patterns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedFilter === "all" ? "default" : "outline"}
              onClick={() => setSelectedFilter("all")}
              className={selectedFilter === "all" ? "bg-ts-orange hover:bg-ts-orange-dark" : ""}
            >
              All ({issuesData?.issues.length || 0})
            </Button>
            <Button
              variant={selectedFilter === "critical" ? "default" : "outline"}
              onClick={() => setSelectedFilter("critical")}
              className={selectedFilter === "critical" ? "bg-red-500 hover:bg-red-600" : ""}
            >
              Critical ({issuesData?.summary.bySeverity.critical || 0})
            </Button>
            <Button
              variant={selectedFilter === "unresolved" ? "default" : "outline"}
              onClick={() => setSelectedFilter("unresolved")}
              className={selectedFilter === "unresolved" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
            >
              Unresolved (
              {(issuesData?.summary.total || 0) - (issuesData?.summary.byStatus.resolved || 0)})
            </Button>
            {Object.entries(issuesData?.summary.byType || {}).map(([type, count]) => (
              <Button
                key={type}
                variant={selectedFilter === type ? "default" : "outline"}
                onClick={() => setSelectedFilter(type)}
                className={selectedFilter === type ? "bg-blue-500 hover:bg-blue-600" : ""}
              >
                {type.replace("_", " ")} ({count})
              </Button>
            ))}
          </div>

          {/* Issues List */}
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {filteredIssues.map((issue) => {
                const TypeIcon = typeIcons[issue.type] || Bug;
                return (
                  <Card key={issue.id} className="bg-tsCard border-white/10">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <TypeIcon className="h-5 w-5 text-ts-orange mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-semibold text-white">{issue.title}</h3>
                              <Badge className={`${severityColors[issue.severity]} text-white`}>
                                {issue.severity}
                              </Badge>
                              <Badge variant="outline" className="text-white/70">
                                {issue.type.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-white/70 text-sm mb-2">{issue.description}</p>
                            <div className="text-xs text-white/60 space-y-1">
                              <p>Location: {issue.location}</p>
                              {issue.element && <p>Element: {issue.element}</p>}
                              <p>Time: {new Date(issue.timestamp).toLocaleString()}</p>
                            </div>
                            {issue.suggestions.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-medium text-ts-orange mb-1">
                                  Suggestions:
                                </p>
                                <ul className="text-xs text-white/70 space-y-1">
                                  {issue.suggestions.map((suggestion, idx) => (
                                    <li key={idx}>• {suggestion}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {issue.status !== "resolved" && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(issue.id, "resolved")}
                              className="bg-green-500 hover:bg-green-600"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {issue.status !== "investigating" && issue.status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(issue.id, "investigating")}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteIssue(issue.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          {analysis && (
            <>
              {/* AI Priorities */}
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">AI Priorities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.priorities.map((priority, idx) => (
                    <Alert
                      key={idx}
                      className={`border-${priority.level === "critical" ? "red" : priority.level === "high" ? "orange" : "blue"}-500`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{priority.title}</AlertTitle>
                      <AlertDescription>
                        {priority.description}
                        <br />
                        <span className="font-medium">Action: {priority.action}</span>
                      </AlertDescription>
                    </Alert>
                  ))}
                </CardContent>
              </Card>

              {/* AI Recommendations */}
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">AI Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((recommendation, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-ts-orange font-bold">•</span>
                        <span className="text-white/70">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          {analysis && (
            <>
              {/* Problematic Pages */}
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Most Problematic Pages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.patterns.topProblematicPages.map((page, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-white/70">{page.page}</span>
                        <Badge variant="error">{page.issueCount} issues</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Common Elements */}
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Problematic Elements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.patterns.commonElements.map((element, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-white/70 font-mono text-sm">{element.element}</span>
                        <Badge variant="outline">{element.issueCount} issues</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
