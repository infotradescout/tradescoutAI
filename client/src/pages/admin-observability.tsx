import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, Database, Globe, TrendingUp, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

interface JobMetric {
  jobName: string;
  totalRuns: number;
  errorCount: number;
  overlapCount: number;
  duration: {
    p50: number;
    p95: number;
    p99: number;
  } | null;
  rowsWritten: {
    min: number;
    avg: number;
    max: number;
  };
}

interface MetricsSummary {
  timestamp: string;
  scheduler: JobMetric[];
  dbPool: {
    current: {
      active: number;
      idle: number;
      waiting: number;
    };
    history: Array<{
      active: number;
      idle: number;
      waiting: number;
    }>;
  };
  http: {
    statusClasses: {
      "2xx": number;
      "4xx": number;
      "5xx": number;
    };
    total: number;
  };
}

interface AlertItem {
  id: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  status: "firing" | "resolved";
  name: string;
  description: string;
  labels: Record<string, string>;
  startedAt: string;
  resolvedAt?: string;
  lastEvaluatedAt: string;
  consecutiveHits: number;
}

interface AlertsResponse {
  active: AlertItem[];
  history: AlertItem[];
  total: number;
}

export default function ObservabilityDashboard() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/admin/observability/summary");
        if (!response.ok) throw new Error("Failed to fetch metrics");
        const data = await response.json();
        setMetrics(data);
        setLastUpdated(new Date().toLocaleTimeString());
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    const fetchAlerts = async () => {
      try {
        const response = await fetch("/api/admin/observability/alerts");
        if (!response.ok) throw new Error("Failed to fetch alerts");
        const data = await response.json();
        setAlerts(data);
      } catch (err) {
        console.error("Failed to fetch alerts:", err);
      }
    };

    fetchMetrics();
    fetchAlerts();
    const interval = setInterval(() => {
      fetchMetrics();
      fetchAlerts();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "text-red-600 bg-red-50 border-red-200";
      case "WARN": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "INFO": return "text-blue-600 bg-blue-50 border-blue-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return <AlertCircle className="h-4 w-4" />;
      case "WARN": return <AlertTriangle className="h-4 w-4" />;
      case "INFO": return <CheckCircle2 className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "bg-red-600 text-white animate-pulse";
      case "WARN": return "bg-yellow-600 text-white";
      case "INFO": return "bg-blue-600 text-white";
      default: return "bg-gray-600 text-white";
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!metrics || !alerts) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-pulse mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Observability Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Phase 5 Live: CRITICAL Alerts (Paging) — Server faults trigger immediate pages
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </div>
      </div>

      {/* Active Alerts Panel */}
      {alerts.active.length > 0 && (
        <Card className={`p-6 ${alerts.active.some(a => a.severity === "CRITICAL") ? "border-red-600 bg-red-50" : "border-yellow-200 bg-yellow-50"}`}>
          <div className="flex items-center gap-2 mb-4">
            {alerts.active.some(a => a.severity === "CRITICAL") ? (
              <AlertCircle className="h-5 w-5 text-red-600 animate-pulse" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <h2 className={`text-xl font-semibold ${alerts.active.some(a => a.severity === "CRITICAL") ? "text-red-900" : "text-yellow-900"}`}>
              Active Alerts ({alerts.active.length})
              {alerts.active.some(a => a.severity === "CRITICAL") && (
                <span className="ml-2 text-sm font-normal text-red-700">— PAGING IN PROGRESS</span>
              )}
            </h2>
          </div>
          <div className="space-y-3">
            {alerts.active.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)} ${alert.severity === "CRITICAL" ? "shadow-lg" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{alert.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${getSeverityBadgeClass(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <div className="text-sm mt-1">{alert.description}</div>
                      <div className="text-xs mt-2 space-y-1">
                        {Object.entries(alert.labels).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium">{key}:</span> {value}
                          </div>
                        ))}
                      </div>
                      {alert.severity === "CRITICAL" && (
                        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-900">
                          <strong>Kill Switch:</strong> Set SCHEDULER_ENABLED=false to pause aggregations
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-right">
                    <div>Started: {new Date(alert.startedAt).toLocaleString()}</div>
                    <div className="mt-1">Consecutive: {alert.consecutiveHits}/3</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {alerts.active.length === 0 && (
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-green-900 font-medium">All systems nominal — No active alerts</span>
          </div>
        </Card>
      )}

      {/* Scheduler Metrics */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Scheduler Jobs</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.scheduler.map((job) => (
            <div key={job.jobName} className="border rounded-lg p-4">
              <div className="font-semibold mb-2">{job.jobName}</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Runs:</span>
                  <span className="font-medium">{job.totalRuns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Errors:</span>
                  <span className={job.errorCount > 0 ? "text-red-600 font-medium" : "font-medium"}>
                    {job.errorCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overlaps:</span>
                  <span className={job.overlapCount > 0 ? "text-yellow-600 font-medium" : "font-medium"}>
                    {job.overlapCount}
                  </span>
                </div>
                {job.duration && (
                  <>
                    <div className="border-t pt-2 mt-2">
                      <div className="text-xs text-muted-foreground mb-1">Duration (ms)</div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">p50:</span>
                      <span className="font-medium">{job.duration.p50.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">p95:</span>
                      <span className="font-medium">{job.duration.p95.toFixed(0)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">p99:</span>
                      <span className="font-medium">{job.duration.p99.toFixed(0)}ms</span>
                    </div>
                  </>
                )}
                <div className="border-t pt-2 mt-2">
                  <div className="text-xs text-muted-foreground mb-1">Rows Written</div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg:</span>
                  <span className="font-medium">{job.rowsWritten.avg.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max:</span>
                  <span className="font-medium">{job.rowsWritten.max}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Database Pool Metrics */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Database Connection Pool</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{metrics.dbPool.current.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{metrics.dbPool.current.idle}</div>
            <div className="text-sm text-muted-foreground">Idle</div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${metrics.dbPool.current.waiting > 0 ? 'text-yellow-600' : 'text-gray-600'}`}>
              {metrics.dbPool.current.waiting}
            </div>
            <div className="text-sm text-muted-foreground">Waiting</div>
          </div>
        </div>
        {metrics.dbPool.history.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground mb-2">Recent History (last {metrics.dbPool.history.length} samples)</div>
            <div className="flex gap-1 h-20 items-end">
              {metrics.dbPool.history.map((sample, i) => {
                const total = sample.active + sample.idle + sample.waiting;
                const activeHeight = total > 0 ? (sample.active / total) * 100 : 0;
                const idleHeight = total > 0 ? (sample.idle / total) * 100 : 0;
                const waitingHeight = total > 0 ? (sample.waiting / total) * 100 : 0;
                
                return (
                  <div key={i} className="flex-1 flex flex-col-reverse gap-0.5">
                    {sample.waiting > 0 && (
                      <div className="bg-yellow-500 rounded-sm" style={{ height: `${waitingHeight}%` }} title={`Waiting: ${sample.waiting}`} />
                    )}
                    {sample.active > 0 && (
                      <div className="bg-green-500 rounded-sm" style={{ height: `${activeHeight}%` }} title={`Active: ${sample.active}`} />
                    )}
                    {sample.idle > 0 && (
                      <div className="bg-blue-500 rounded-sm" style={{ height: `${idleHeight}%` }} title={`Idle: ${sample.idle}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* HTTP Status Distribution */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5" />
          <h2 className="text-xl font-semibold">HTTP Status Distribution</h2>
          <span className="text-xs text-muted-foreground ml-auto">Phase 4: Clean 4xx/5xx Separation</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{metrics.http.statusClasses["2xx"]}</div>
            <div className="text-sm text-muted-foreground">2xx Success</div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.http.total > 0 ? ((metrics.http.statusClasses["2xx"] / metrics.http.total) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{metrics.http.statusClasses["4xx"]}</div>
            <div className="text-sm text-muted-foreground">4xx Client</div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.http.total > 0 ? ((metrics.http.statusClasses["4xx"] / metrics.http.total) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-xs text-blue-600 mt-2">
              INFO/WARN logged (non-paging)
            </div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${metrics.http.statusClasses["5xx"] > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {metrics.http.statusClasses["5xx"]}
            </div>
            <div className="text-sm text-muted-foreground">5xx Server</div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.http.total > 0 ? ((metrics.http.statusClasses["5xx"] / metrics.http.total) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-xs text-red-600 mt-2">
              {metrics.http.statusClasses["5xx"] > 0 ? "ERROR/CRITICAL logged (alert candidate)" : "Zero server faults ✓"}
            </div>
          </div>
        </div>
        <div className="mt-4 text-center text-sm text-muted-foreground border-t pt-4">
          <div className="font-medium">Total Requests: {metrics.http.total}</div>
          <div className="text-xs mt-1">
            True 5xx rate: {metrics.http.total > 0 ? ((metrics.http.statusClasses["5xx"] / metrics.http.total) * 100).toFixed(3) : 0}% 
            {metrics.http.statusClasses["5xx"] === 0 && " (target: 0%)"}
          </div>
        </div>
      </Card>

      {/* Recent Alert History */}
      {alerts.history.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Recent Alert History (Last 10)</h2>
          </div>
          <div className="space-y-2">
            {alerts.history.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded border bg-gray-50 text-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="ml-2 font-medium">{alert.name}</span>
                    <div className="text-xs text-muted-foreground mt-1">{alert.description}</div>
                  </div>
                  <div className="text-xs text-right text-muted-foreground">
                    {alert.resolvedAt ? (
                      <>
                        <div>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</div>
                        <div className="mt-1">
                          Duration: {Math.round((new Date(alert.resolvedAt).getTime() - new Date(alert.startedAt).getTime()) / 1000)}s
                        </div>
                      </>
                    ) : (
                      <div>Active since {new Date(alert.startedAt).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
