import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  Activity,
  Database,
  Globe,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Brain,
} from "lucide-react";

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

interface ScoutPolicyViolation {
  rule?: string;
  kind?: string;
}

interface ScoutPolicyEvent {
  id: string;
  createdAt: string;
  violationCount: number;
  violations: ScoutPolicyViolation[];
  countyCode?: string | null;
  stateCode?: string | null;
}

interface ScoutPolicyTelemetry {
  total: number;
  last7d: number;
  recent: ScoutPolicyEvent[];
}

interface ObservabilityBaselines {
  scheduler: Record<string, { p95Duration: number; avgRows: number }>;
  dbPool: {
    p95AcquireLatency: number;
  };
  http: {
    baseline5xxRate: number;
    delta5xx: number;
  };
}

interface LisaFeedItem {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  truthStatus?: "current" | "stale" | "superseded" | "suppressed";
  scopeType?: "global" | "county" | "category" | "surface" | "partner";
  scopeRef?: string | null;
  engineVersion?: string;
  sourceKind:
    | "scout_interactions"
    | "objectives"
    | "homescout_listings"
    | "observations"
    | "bot_visibility";
  headline: string;
  narrative: string;
  evidence: string[];
  freshnessMinutes: number | null;
}

interface LisaFeedResponse {
  generatedAt: string;
  summary: {
    truthNow: string;
    dataProductionSummary: string;
    llmOptimizationSummary: string;
  };
  feed: LisaFeedItem[];
  runtime: {
    mode: "tradescout_local" | "json_file" | "remote";
    source: string;
  };
}

interface CrawlerTelemetrySummary {
  generatedAt: string;
  totals24h: {
    total: number;
    ok: number;
    clientError: number;
    serverError: number;
  };
  topBots: Array<{
    botName: string;
    requestCount: number;
  }>;
  topRoutes: Array<{
    path: string;
    requestCount: number;
  }>;
  topSurfaces: Array<{
    sourceSurface: string;
    requestCount: number;
  }>;
  topCounties: Array<{
    countyName: string;
    stateCode: string | null;
    countyFips: string | null;
    sourceSurface: string;
    requestCount: number;
  }>;
  requestTypes: Array<{
    requestType: string;
    requestCount: number;
  }>;
  hourlyBuckets: Array<{
    bucketStart: string;
    total: number;
    ok: number;
    clientError: number;
    serverError: number;
  }>;
}

interface SnapshotStatusSummary {
  generatedAt: string;
  schedulerEnabled: boolean;
  statuses: Array<{
    key: string;
    label: string;
    latestComputedAt: string | null;
    rowCount: number;
    staleAfterMinutes: number;
    isStale: boolean;
  }>;
}

function coerceBaselines(payload: any): ObservabilityBaselines | null {
  const root = payload && typeof payload === "object" ? payload : null;
  const candidate =
    root && typeof (root as any).baselines === "object" ? (root as any).baselines : root;
  if (!candidate || typeof candidate !== "object") return null;

  const scheduler = (candidate as any).scheduler;
  const dbPool = (candidate as any).dbPool;
  const http = (candidate as any).http;

  if (!scheduler || typeof scheduler !== "object") return null;
  if (!dbPool || typeof dbPool !== "object") return null;
  if (!http || typeof http !== "object") return null;

  return candidate as ObservabilityBaselines;
}

export default function ObservabilityDashboard() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [scoutPolicy, setScoutPolicy] = useState<ScoutPolicyTelemetry | null>(null);
  const [baselines, setBaselines] = useState<ObservabilityBaselines | null>(null);
  const [lisaFeed, setLisaFeed] = useState<LisaFeedResponse | null>(null);
  const [crawlerTelemetry, setCrawlerTelemetry] = useState<CrawlerTelemetrySummary | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatusSummary | null>(null);
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
        setError(formatUserFacingErrorMessage(err, "Failed to fetch metrics."));
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

    const fetchScoutPolicy = async () => {
      try {
        const response = await fetch("/api/admin/observability/scout-policy");
        if (!response.ok) throw new Error("Failed to fetch Scout policy telemetry");
        const data = await response.json();
        setScoutPolicy(data);
      } catch (err) {
        console.error("Failed to fetch Scout policy telemetry:", err);
      }
    };

    const fetchBaselines = async () => {
      try {
        const response = await fetch("/api/admin/observability/baselines");
        if (!response.ok) throw new Error("Failed to fetch baselines");
        const data = await response.json();
        const parsed = coerceBaselines(data);
        if (!parsed) {
          throw new Error("Baselines payload missing required fields");
        }
        setBaselines(parsed);
      } catch (err) {
        console.error("Failed to fetch baselines:", err);
      }
    };

    const fetchLisaFeed = async () => {
      try {
        const response = await fetch("/api/admin/observability/lisa-feed");
        if (!response.ok) throw new Error("Failed to fetch LISA feed");
        const data = await response.json();
        setLisaFeed(data);
      } catch (err) {
        console.error("Failed to fetch LISA feed:", err);
      }
    };

    const fetchCrawlerTelemetry = async () => {
      try {
        const response = await fetch("/api/admin/observability/crawler-telemetry");
        if (!response.ok) throw new Error("Failed to fetch crawler telemetry");
        const data = await response.json();
        setCrawlerTelemetry(data);
      } catch (err) {
        console.error("Failed to fetch crawler telemetry:", err);
      }
    };

    const fetchSnapshotStatus = async () => {
      try {
        const response = await fetch("/api/admin/observability/snapshot-status");
        if (!response.ok) throw new Error("Failed to fetch snapshot status");
        const data = await response.json();
        setSnapshotStatus(data);
      } catch (err) {
        console.error("Failed to fetch snapshot status:", err);
      }
    };

    fetchMetrics();
    fetchAlerts();
    fetchScoutPolicy();
    fetchBaselines();
    fetchLisaFeed();
    fetchCrawlerTelemetry();
    fetchSnapshotStatus();
    const interval = setInterval(() => {
      fetchMetrics();
      fetchAlerts();
      fetchScoutPolicy();
      fetchBaselines();
      fetchLisaFeed();
      fetchCrawlerTelemetry();
      fetchSnapshotStatus();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "text-red-600 bg-red-50 border-red-200";
      case "WARN":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "INFO":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-white/60 bg-white/5 border-white/10";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <AlertCircle className="h-4 w-4" />;
      case "WARN":
        return <AlertTriangle className="h-4 w-4" />;
      case "INFO":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-600 text-white animate-pulse";
      case "WARN":
        return "bg-yellow-600 text-white";
      case "INFO":
        return "bg-blue-600 text-white";
      default:
        return "bg-white/10 text-white";
    }
  };

  const getLisaPriorityClass = (priority: LisaFeedItem["priority"]) => {
    switch (priority) {
      case "critical":
        return "border-red-500/40 bg-red-500/10 text-red-100";
      case "high":
        return "border-orange-500/40 bg-orange-500/10 text-orange-100";
      case "medium":
        return "border-yellow-500/30 bg-yellow-500/10 text-yellow-100";
      default:
        return "border-white/10 bg-white/5 text-white";
    }
  };

  const getTruthStatusClass = (truthStatus?: LisaFeedItem["truthStatus"]) => {
    switch (truthStatus) {
      case "current":
        return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
      case "stale":
        return "border-yellow-400/30 bg-yellow-500/10 text-yellow-100";
      case "superseded":
        return "border-slate-400/30 bg-slate-500/10 text-slate-100";
      case "suppressed":
        return "border-red-400/30 bg-red-500/10 text-red-100";
      default:
        return "border-white/10 bg-white/5 text-white/80";
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

  if (
    !metrics ||
    !alerts ||
    !scoutPolicy ||
    !baselines ||
    !lisaFeed ||
    !crawlerTelemetry ||
    !snapshotStatus
  ) {
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
        <div className="text-sm text-muted-foreground">Last updated: {lastUpdated}</div>
      </div>

      <Card className="p-6 border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-black/30 to-black/50">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-orange-300" />
          <h2 className="text-xl font-semibold text-white">LISA Live Feed</h2>
          <span className="text-xs text-white/50 ml-auto">
            Last feed update: {new Date(lisaFeed.generatedAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-white/70">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
            Runtime: {lisaFeed.runtime.mode}
          </span>
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
            Source: {lisaFeed.runtime.source}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">Truth Now</div>
            <p className="mt-2 text-sm text-white/90">{lisaFeed.summary.truthNow}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">Data Production</div>
            <p className="mt-2 text-sm text-white/90">{lisaFeed.summary.dataProductionSummary}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">
              LLM Optimization
            </div>
            <p className="mt-2 text-sm text-white/90">{lisaFeed.summary.llmOptimizationSummary}</p>
          </div>
        </div>
        <div className="space-y-3">
          {lisaFeed.feed.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border p-4 ${getLisaPriorityClass(item.priority)}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-current/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em]">
                    {item.priority}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] ${getTruthStatusClass(item.truthStatus)}`}
                  >
                    {item.truthStatus || "current"}
                  </span>
                  <span className="text-xs uppercase tracking-[0.18em] opacity-70">
                    {item.sourceKind.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-xs opacity-70">
                  {item.freshnessMinutes === null
                    ? "Freshness unknown"
                    : `${item.freshnessMinutes} min ago`}
                </div>
              </div>
              <div className="mt-3 text-base font-semibold text-white">{item.headline}</div>
              <p className="mt-2 text-sm text-white/85">{item.narrative}</p>
              <div className="mt-2 text-xs text-white/55">
                Scope: {item.scopeType || "global"}
                {item.scopeRef ? ` / ${item.scopeRef}` : ""}
                {item.engineVersion ? ` | Engine ${item.engineVersion}` : ""}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.evidence.map((evidence) => (
                  <span
                    key={evidence}
                    className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white/70"
                  >
                    {evidence}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-black/20 to-black/50">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-blue-300" />
          <h2 className="text-xl font-semibold text-white">Snapshot Status</h2>
          <span className="text-xs text-white/50 ml-auto">
            Last summary: {new Date(snapshotStatus.generatedAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="mb-4 text-sm text-white/75">
          Scheduler:{" "}
          <span
            className={snapshotStatus.schedulerEnabled ? "text-emerald-300" : "text-yellow-300"}
          >
            {snapshotStatus.schedulerEnabled ? "enabled" : "disabled"}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snapshotStatus.statuses.map((item) => (
            <div key={item.key} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="mt-1 text-xs text-white/55">{item.rowCount} rows</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    item.isStale
                      ? "border border-yellow-500/30 bg-yellow-500/20 text-yellow-200"
                      : "border border-emerald-500/30 bg-emerald-500/20 text-emerald-200"
                  }`}
                >
                  {item.isStale ? "stale" : "fresh"}
                </span>
              </div>
              <div className="mt-3 text-sm text-white/80">
                {item.latestComputedAt
                  ? `Updated ${new Date(item.latestComputedAt).toLocaleString()}`
                  : "No snapshot computed yet"}
              </div>
              <div className="mt-1 text-xs text-white/55">
                Stale after {item.staleAfterMinutes} minutes
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-black/20 to-black/50">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-cyan-300" />
          <h2 className="text-xl font-semibold text-white">Crawler Telemetry</h2>
          <span className="text-xs text-white/50 ml-auto">
            Last summary: {new Date(crawlerTelemetry.generatedAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">Total 24h</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {crawlerTelemetry.totals24h.total}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">2xx</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-300">
              {crawlerTelemetry.totals24h.ok}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">4xx</div>
            <div className="mt-2 text-2xl font-semibold text-yellow-300">
              {crawlerTelemetry.totals24h.clientError}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40">5xx</div>
            <div className="mt-2 text-2xl font-semibold text-red-300">
              {crawlerTelemetry.totals24h.serverError}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40 mb-3">
              Top Crawlers
            </div>
            <div className="space-y-2">
              {crawlerTelemetry.topBots.map((row) => (
                <div
                  key={row.botName}
                  className="flex items-center justify-between text-sm text-white/85"
                >
                  <span>{row.botName}</span>
                  <span>{row.requestCount}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40 mb-3">Top Routes</div>
            <div className="space-y-2">
              {crawlerTelemetry.topRoutes.map((row) => (
                <div
                  key={`${row.path}:${row.requestCount}`}
                  className="flex items-center justify-between gap-3 text-sm text-white/85"
                >
                  <span className="truncate">{row.path}</span>
                  <span>{row.requestCount}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40 mb-3">
              Top Surfaces
            </div>
            <div className="space-y-2">
              {crawlerTelemetry.topSurfaces.map((row) => (
                <div
                  key={row.sourceSurface}
                  className="flex items-center justify-between text-sm text-white/85"
                >
                  <span>{row.sourceSurface}</span>
                  <span>{row.requestCount}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40 mb-3">
              Top Counties
            </div>
            <div className="space-y-2">
              {crawlerTelemetry.topCounties.map((row) => (
                <div
                  key={`${row.countyFips || row.countyName}:${row.sourceSurface}`}
                  className="flex items-center justify-between gap-3 text-sm text-white/85"
                >
                  <span className="truncate">
                    {row.countyName}
                    {row.stateCode ? `, ${row.stateCode}` : ""}
                    <span className="ml-2 text-white/45">[{row.sourceSurface}]</span>
                  </span>
                  <span>{row.requestCount}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-white/40 mb-3">
              Request Types
            </div>
            <div className="space-y-2">
              {crawlerTelemetry.requestTypes.map((row) => (
                <div
                  key={row.requestType}
                  className="flex items-center justify-between text-sm text-white/85"
                >
                  <span>{row.requestType}</span>
                  <span>{row.requestCount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-white/40 mb-3">
            Hourly Crawler Volume
          </div>
          <div className="flex h-32 items-end gap-1">
            {crawlerTelemetry.hourlyBuckets.map((bucket) => {
              const maxTotal = Math.max(
                1,
                ...crawlerTelemetry.hourlyBuckets.map((row) => row.total || 0)
              );
              const totalHeight = Math.max(6, (bucket.total / maxTotal) * 100);
              return (
                <div key={bucket.bucketStart} className="flex-1">
                  <div className="flex h-24 items-end">
                    <div
                      className="w-full rounded-t-sm bg-cyan-400/80"
                      style={{ height: `${totalHeight}%` }}
                      title={`${new Date(bucket.bucketStart).toLocaleTimeString()} | total ${bucket.total} | 2xx ${bucket.ok} | 4xx ${bucket.clientError} | 5xx ${bucket.serverError}`}
                    />
                  </div>
                  <div className="mt-1 text-center text-[10px] text-white/50">
                    {new Date(bucket.bucketStart).getHours()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Active Alerts Panel */}
      {alerts.active.length > 0 && (
        <Card
          className={`p-6 ${alerts.active.some((a) => a.severity === "CRITICAL") ? "border-red-600 bg-red-50" : "border-yellow-200 bg-yellow-50"}`}
        >
          <div className="flex items-center gap-2 mb-4">
            {alerts.active.some((a) => a.severity === "CRITICAL") ? (
              <AlertCircle className="h-5 w-5 text-red-600 animate-pulse" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <h2
              className={`text-xl font-semibold ${alerts.active.some((a) => a.severity === "CRITICAL") ? "text-red-900" : "text-yellow-900"}`}
            >
              Active Alerts ({alerts.active.length})
              {alerts.active.some((a) => a.severity === "CRITICAL") && (
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
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${getSeverityBadgeClass(alert.severity)}`}
                        >
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
                          <strong>Kill Switch:</strong> Set SCHEDULER_ENABLED=false to pause
                          aggregations
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
            <span className="text-green-900 font-medium">
              All systems nominal — No active alerts
            </span>
          </div>
        </Card>
      )}

      {/* Alert Baselines */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Alert Baselines</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">HTTP</div>
            <div className="text-sm">
              5xx baseline rate: {(baselines.http.baseline5xxRate * 100).toFixed(2)}%
            </div>
            <div className="text-sm">
              5xx delta trigger: {(baselines.http.delta5xx * 100).toFixed(2)}%
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">DB Pool</div>
            <div className="text-sm">
              P95 acquire latency: {baselines.dbPool.p95AcquireLatency} ms
            </div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">Scheduler jobs</div>
            <div className="text-xs space-y-1">
              {Object.entries(baselines.scheduler).map(([jobName, value]) => (
                <div key={jobName}>
                  {jobName}: p95 {value.p95Duration}ms, avg rows {value.avgRows}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Scout Policy Violations */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Scout Policy Violations</h2>
          <span className="text-xs text-muted-foreground ml-auto">
            Telemetry: scout_policy_violation_detected
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Total violations</div>
            <div className="text-2xl font-semibold">{scoutPolicy.total}</div>
          </div>
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">Last 7 days</div>
            <div className="text-2xl font-semibold">{scoutPolicy.last7d}</div>
          </div>
        </div>
        {scoutPolicy.recent.length === 0 ? (
          <div className="text-sm text-muted-foreground">No recent violations logged.</div>
        ) : (
          <div className="space-y-3">
            {scoutPolicy.recent.map((event) => {
              const uniqueRules = Array.from(
                new Set((event.violations || []).map((v) => v.rule).filter(Boolean))
              );
              const location =
                event.countyCode && event.stateCode
                  ? `${event.countyCode}, ${event.stateCode}`
                  : event.stateCode || event.countyCode || "Unknown location";

              return (
                <div key={event.id} className="border rounded-lg p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">Violation batch</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Count</div>
                      <div className="font-semibold">{event.violationCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Location</div>
                      <div className="font-semibold">{location}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Rules</div>
                      <div className="font-semibold">
                        {uniqueRules.length > 0 ? uniqueRules.join(", ") : "n/a"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

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
                  <span
                    className={job.overlapCount > 0 ? "text-yellow-600 font-medium" : "font-medium"}
                  >
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{metrics.dbPool.current.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{metrics.dbPool.current.idle}</div>
            <div className="text-sm text-muted-foreground">Idle</div>
          </div>
          <div className="text-center">
            <div
              className={`text-3xl font-bold ${metrics.dbPool.current.waiting > 0 ? "text-yellow-600" : "text-white/60"}`}
            >
              {metrics.dbPool.current.waiting}
            </div>
            <div className="text-sm text-muted-foreground">Waiting</div>
          </div>
        </div>
        {metrics.dbPool.history.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground mb-2">
              Recent History (last {metrics.dbPool.history.length} samples)
            </div>
            <div className="flex gap-1 h-20 items-end">
              {metrics.dbPool.history.map((sample, i) => {
                const total = sample.active + sample.idle + sample.waiting;
                const activeHeight = total > 0 ? (sample.active / total) * 100 : 0;
                const idleHeight = total > 0 ? (sample.idle / total) * 100 : 0;
                const waitingHeight = total > 0 ? (sample.waiting / total) * 100 : 0;

                return (
                  <div key={i} className="flex-1 flex flex-col-reverse gap-0.5">
                    {sample.waiting > 0 && (
                      <div
                        className="bg-yellow-500 rounded-sm"
                        style={{ height: `${waitingHeight}%` }}
                        title={`Waiting: ${sample.waiting}`}
                      />
                    )}
                    {sample.active > 0 && (
                      <div
                        className="bg-green-500 rounded-sm"
                        style={{ height: `${activeHeight}%` }}
                        title={`Active: ${sample.active}`}
                      />
                    )}
                    {sample.idle > 0 && (
                      <div
                        className="bg-blue-500 rounded-sm"
                        style={{ height: `${idleHeight}%` }}
                        title={`Idle: ${sample.idle}`}
                      />
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
          <span className="text-xs text-muted-foreground ml-auto">
            Phase 4: Clean 4xx/5xx Separation
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {metrics.http.statusClasses["2xx"]}
            </div>
            <div className="text-sm text-muted-foreground">2xx Success</div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.http.total > 0
                ? ((metrics.http.statusClasses["2xx"] / metrics.http.total) * 100).toFixed(1)
                : 0}
              %
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {metrics.http.statusClasses["4xx"]}
            </div>
            <div className="text-sm text-muted-foreground">4xx Client</div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.http.total > 0
                ? ((metrics.http.statusClasses["4xx"] / metrics.http.total) * 100).toFixed(1)
                : 0}
              %
            </div>
            <div className="text-xs text-blue-600 mt-2">INFO/WARN logged (non-paging)</div>
          </div>
          <div className="text-center">
            <div
              className={`text-3xl font-bold ${metrics.http.statusClasses["5xx"] > 0 ? "text-red-600" : "text-white/60"}`}
            >
              {metrics.http.statusClasses["5xx"]}
            </div>
            <div className="text-sm text-muted-foreground">5xx Server</div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.http.total > 0
                ? ((metrics.http.statusClasses["5xx"] / metrics.http.total) * 100).toFixed(1)
                : 0}
              %
            </div>
            <div className="text-xs text-red-600 mt-2">
              {metrics.http.statusClasses["5xx"] > 0
                ? "ERROR/CRITICAL logged (alert candidate)"
                : "Zero server faults ✓"}
            </div>
          </div>
        </div>
        <div className="mt-4 text-center text-sm text-muted-foreground border-t pt-4">
          <div className="font-medium">Total Requests: {metrics.http.total}</div>
          <div className="text-xs mt-1">
            True 5xx rate:{" "}
            {metrics.http.total > 0
              ? ((metrics.http.statusClasses["5xx"] / metrics.http.total) * 100).toFixed(3)
              : 0}
            %{metrics.http.statusClasses["5xx"] === 0 && " (target: 0%)"}
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
              <div key={alert.id} className="p-3 rounded border bg-white/5 text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}
                    >
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
                          Duration:{" "}
                          {Math.round(
                            (new Date(alert.resolvedAt).getTime() -
                              new Date(alert.startedAt).getTime()) /
                              1000
                          )}
                          s
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
