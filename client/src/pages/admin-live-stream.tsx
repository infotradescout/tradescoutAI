import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { useLocation } from "wouter";

type LiveStreamItem = {
  id: string;
  timestamp: string;
  kind: string;
  priority: "critical" | "high" | "medium" | "low";
  truthStatus?: "current" | "stale";
  title: string;
  narrative: string;
  source: string;
  lane?: string;
  signalClass?: string;
};

type LiveStreamResponse = {
  generatedAt: string;
  filters?: {
    source: string | null;
    stateCode: string | null;
    county: string | null;
    limit: number;
  };
  summary: {
    truthNow: string;
    currentLeadCounty: string | null;
    currentLeadState: string | null;
    crawlerRequests24h: number;
    activeAlerts: number;
    botCrawlSignals?: number;
    topBotCrawlHeadline?: string | null;
    sourceCounts: Record<string, number>;
    degradedSources?: string[];
    degradedSourceReasons?: Record<string, string>;
  };
  stream: LiveStreamItem[];
};

type LiveStreamHistoryResponse = {
  history: LiveStreamResponse[];
};

type SnapshotStatusResponse = {
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
};

type CrawlerTelemetrySummary = {
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
};

function getFilenameFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /filename="?([^"]+)"?/i.exec(headerValue);
  if (!match?.[1]) return null;
  return match[1];
}

const priorityTone: Record<LiveStreamItem["priority"], string> = {
  critical: "bg-red-600/20 text-red-200 border-red-500/30",
  high: "bg-orange-600/20 text-orange-200 border-orange-500/30",
  medium: "bg-blue-600/20 text-blue-200 border-blue-500/30",
  low: "bg-white/10 text-white/70 border-white/10",
};

const truthTone: Record<"current" | "stale", string> = {
  current: "bg-emerald-600/20 text-emerald-100 border-emerald-500/30",
  stale: "bg-amber-600/20 text-amber-100 border-amber-500/30",
};

const durabilityTone: Record<"volatile" | "stable" | "persistent", string> = {
  volatile: "bg-rose-600/20 text-rose-100 border-rose-500/30",
  stable: "bg-blue-600/20 text-blue-100 border-blue-500/30",
  persistent: "bg-violet-600/20 text-violet-100 border-violet-500/30",
};

function resolveDurabilityClass(source: string): "volatile" | "stable" | "persistent" {
  if (source === "crawler" || source === "alerts" || source === "bot_crawl_signals") {
    return "volatile";
  }
  if (source === "cumulus") {
    return "persistent";
  }
  return "stable";
}

export default function AdminLiveStreamPage() {
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [source, setSource] = useState("all");
  const [truthFilter, setTruthFilter] = useState("all");
  const [durabilityFilter, setDurabilityFilter] = useState("all");
  const [stateCode, setStateCode] = useState("all");
  const [county, setCounty] = useState("all");
  const [limit, setLimit] = useState("20");
  const [historyDays, setHistoryDays] = useState("7");
  const [expandedHistorySnapshot, setExpandedHistorySnapshot] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const presentationMode = useMemo(() => {
    const rawQuery = location.includes("?") ? location.split("?")[1] || "" : "";
    return new URLSearchParams(rawQuery).get("presentationMode") === "1";
  }, [location]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", limit || "20");
    if (source !== "all") params.set("source", source);
    if (stateCode !== "all") params.set("stateCode", stateCode);
    if (county !== "all") params.set("county", county);
    return params.toString();
  }, [source, stateCode, county, limit]);

  const historyQueryString = useMemo(() => {
    const params = new URLSearchParams(queryString);
    const normalizedHistoryDays = Math.min(
      30,
      Math.max(1, Number.parseInt(historyDays || "7", 10) || 7)
    );
    params.set("lookbackDays", String(normalizedHistoryDays));
    return params.toString();
  }, [queryString, historyDays]);

  const { data, isLoading, error } = useQuery<LiveStreamResponse>({
    queryKey: ["/api/admin/observability/live-stream", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/admin/observability/live-stream?${queryString}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch live stream");
      }
      return response.json();
    },
    refetchInterval: 10000,
  });

  const { data: historyData } = useQuery<LiveStreamHistoryResponse>({
    queryKey: ["/api/admin/observability/live-stream/history", historyQueryString],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/observability/live-stream/history?${historyQueryString}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch live stream history");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const filteredStream = useMemo(() => {
    return (data?.stream || []).filter((item) => {
      const truthStatus = item.truthStatus === "current" ? "current" : "stale";
      const durabilityClass = resolveDurabilityClass(item.source);
      const truthMatch = truthFilter === "all" || truthStatus === truthFilter;
      const durabilityMatch = durabilityFilter === "all" || durabilityClass === durabilityFilter;
      return truthMatch && durabilityMatch;
    });
  }, [data?.stream, truthFilter, durabilityFilter]);

  const { data: snapshotStatus } = useQuery<SnapshotStatusResponse>({
    queryKey: ["/api/admin/observability/snapshot-status"],
    queryFn: async () => {
      const response = await fetch("/api/admin/observability/snapshot-status", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch snapshot status");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: crawlerTelemetry } = useQuery<CrawlerTelemetrySummary>({
    queryKey: ["/api/admin/observability/crawler-telemetry"],
    queryFn: async () => {
      const response = await fetch("/api/admin/observability/crawler-telemetry", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch crawler telemetry");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const liveStreamStatus = snapshotStatus?.statuses.find((entry) => entry.key === "live_stream");
  const visibleEntryCount = filteredStream.length;
  const topRouteDemand = (data?.stream || []).find((item) => item.kind === "crawler_route_demand");
  const topCountyDemand = (data?.stream || []).find(
    (item) => item.kind === "crawler_county_demand"
  );
  const topBotDemandCluster = (data?.stream || []).find(
    (item) => item.kind === "bot_demand_cluster"
  );
  const topSurfaceBreakdown = useMemo(() => {
    return (crawlerTelemetry?.topSurfaces || []).slice(0, 6);
  }, [crawlerTelemetry?.topSurfaces]);
  const signalSurfaceCount = useMemo(() => {
    const signalFamilies = new Set([
      "public_business",
      "trade_county_page",
      "trade_region_page",
      "county_page",
      "county_recent",
      "public_profile",
      "commerce_surface",
      "public_marketing",
      "tradepartners",
      "homescout_listings",
      "community",
      "exchange",
      "trade_deals",
      "direct_connect",
      "scout",
    ]);
    return (crawlerTelemetry?.topSurfaces || []).reduce((sum, item) => {
      return sum + (signalFamilies.has(item.sourceSurface) ? item.requestCount : 0);
    }, 0);
  }, [crawlerTelemetry?.topSurfaces]);
  const noiseSurfaceCount = useMemo(() => {
    const noiseFamilies = new Set(["infra", "crawl_meta", "static_asset"]);
    return (crawlerTelemetry?.topSurfaces || []).reduce((sum, item) => {
      return sum + (noiseFamilies.has(item.sourceSurface) ? item.requestCount : 0);
    }, 0);
  }, [crawlerTelemetry?.topSurfaces]);
  const unknownSurfaceCount = useMemo(() => {
    return (crawlerTelemetry?.topSurfaces || []).reduce((sum, item) => {
      return (
        sum + (["other", "unknown_public"].includes(item.sourceSurface) ? item.requestCount : 0)
      );
    }, 0);
  }, [crawlerTelemetry?.topSurfaces]);
  const topUnknownSurface = useMemo(() => {
    return (crawlerTelemetry?.topSurfaces || []).find((item) =>
      ["other", "unknown_public"].includes(item.sourceSurface)
    );
  }, [crawlerTelemetry?.topSurfaces]);
  const topRepairRoutes = useMemo(() => {
    return (crawlerTelemetry?.topRoutes || []).slice(0, 5);
  }, [crawlerTelemetry?.topRoutes]);
  const topCountyDiscovery = useMemo(() => {
    return (crawlerTelemetry?.topCounties || []).slice(0, 5);
  }, [crawlerTelemetry?.topCounties]);
  const topCountyDiscoveryLead = topCountyDiscovery[0] || null;
  const internalLisaOutputs = useMemo(() => {
    return (data?.stream || []).filter((item) => item.id.startsWith("internal-lisa-"));
  }, [data?.stream]);
  const derivedIntelligenceOutputs = useMemo(() => {
    return internalLisaOutputs.filter((item) =>
      [
        "attention_action_gap",
        "visibility_outpacing_coverage",
        "county_opportunity_concentration",
        "attention_finding_dead_ends",
        "category_signal_concentration",
      ].includes(item.signalClass || "")
    );
  }, [internalLisaOutputs]);
  const opportunityOutputs = useMemo(() => {
    return derivedIntelligenceOutputs.filter((item) =>
      [
        "county_opportunity_concentration",
        "visibility_outpacing_coverage",
        "category_signal_concentration",
      ].includes(item.signalClass || "")
    );
  }, [derivedIntelligenceOutputs]);
  const frictionOutputs = useMemo(() => {
    return derivedIntelligenceOutputs.filter((item) =>
      ["attention_action_gap"].includes(item.signalClass || "")
    );
  }, [derivedIntelligenceOutputs]);
  const wasteOutputs = useMemo(() => {
    return derivedIntelligenceOutputs.filter((item) =>
      ["attention_finding_dead_ends"].includes(item.signalClass || "")
    );
  }, [derivedIntelligenceOutputs]);
  const crawlerErrorTotal = useMemo(() => {
    if (!crawlerTelemetry) return 0;
    return (
      (crawlerTelemetry.totals24h?.clientError || 0) +
      (crawlerTelemetry.totals24h?.serverError || 0)
    );
  }, [crawlerTelemetry]);
  const liveStreamStateLabel = liveStreamStatus
    ? liveStreamStatus.isStale
      ? "stale"
      : "fresh"
    : "missing";
  const schedulerDisabledWarning =
    snapshotStatus &&
    snapshotStatus.schedulerEnabled === false &&
    (!liveStreamStatus || liveStreamStatus.isStale || liveStreamStateLabel === "missing");

  useEffect(() => {
    if (!refreshMessage) return;
    const timeout = window.setTimeout(() => setRefreshMessage(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [refreshMessage]);

  const handlePresentationModeToggle = () => {
    const params = new URLSearchParams(queryString);
    if (presentationMode) {
      params.delete("presentationMode");
    } else {
      params.set("presentationMode", "1");
    }
    navigate(`/admin/live-stream?${params.toString()}`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage("");
    setRefreshError("");
    try {
      const response = await fetch(`/api/admin/observability/live-stream/refresh?${queryString}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to refresh live stream");
      }
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/observability/live-stream"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/observability/live-stream/history"],
      });
      setRefreshMessage("Live stream refreshed.");
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Failed to refresh live stream");
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch(
        buildApiUrl(`/api/admin/observability/live-stream/export.csv?${queryString}`),
        {
          method: "GET",
          credentials: "include",
          headers: { Accept: "text/csv" },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to export live stream");
      }
      const blob = await response.blob();
      const headerFilename = getFilenameFromHeader(response.headers.get("content-disposition"));
      const fallbackFilename = `live-stream-${new Date().toISOString().slice(0, 10)}.csv`;
      const filename = headerFilename || fallbackFilename;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Failed to export live stream");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`space-y-6 ${presentationMode ? "max-w-5xl mx-auto py-6" : ""}`}>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/observability")}>
              Observability
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/cumulus-intelligence")}
            >
              Cumulus Intelligence
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/mission-control")}>
              Mission Control
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-white">TradeScout Live Stream</CardTitle>
              <CardDescription className="text-white/70">
                Real-time natural-language stream of current system truth, crawler activity, partner
                intelligence, and LISA findings.
              </CardDescription>
            </div>
            <Button onClick={handlePresentationModeToggle} variant="outline">
              {presentationMode ? "Exit Presentation Mode" : "Open Presentation Mode"}
            </Button>
            <Button onClick={handleExport} variant="outline" disabled={exporting}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh Live Stream"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedulerDisabledWarning ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Scheduler is disabled. Live stream snapshots can go stale or missing until you run a
              manual refresh or turn scheduled jobs back on.
            </div>
          ) : null}

          {data?.summary.degradedSources?.length ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Live stream is using fallback data for: {data.summary.degradedSources.join(", ")}.
              {data.summary.degradedSourceReasons &&
              Object.keys(data.summary.degradedSourceReasons).length ? (
                <div className="mt-2 space-y-1 text-xs text-destructive/90">
                  {Object.entries(data.summary.degradedSourceReasons).map(
                    ([sourceName, reason]) => (
                      <div key={sourceName}>
                        {sourceName}: {reason}
                      </div>
                    )
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Last Refresh
              </div>
              <div className="mt-2 text-sm text-foreground">
                {data?.generatedAt
                  ? new Date(data.generatedAt).toLocaleString()
                  : isLoading
                    ? "Loading..."
                    : "Unavailable"}
              </div>
              <div className="mt-2">
                <Badge variant="outline">{liveStreamStateLabel}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Entries shown: {visibleEntryCount}
              </div>
              <div className="text-xs text-muted-foreground">
                Stale after {liveStreamStatus?.staleAfterMinutes ?? 0} min
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Truth Now
              </div>
              <div className="mt-2 text-sm text-foreground">
                {data?.summary.truthNow || "Unavailable"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Top Demand Page
              </div>
              <div className="mt-2 text-sm text-foreground">
                {topRouteDemand?.narrative || "No route-level demand signal yet"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Top Demand County
              </div>
              <div className="mt-2 text-sm text-foreground">
                {topCountyDemand?.narrative || "No county concentration signal yet"}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">
              Bot Demand Cluster
            </div>
            <div className="mt-2 text-sm text-cyan-50">
              {topBotDemandCluster?.narrative ||
                data?.summary.topBotCrawlHeadline ||
                "No bot demand cluster yet"}
            </div>
          </div>

          <div className="rounded-lg border border-violet-500/20 bg-violet-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-violet-100/70">
                  TradeScout Internal LISA Outputs
                </div>
                <div className="mt-2 text-sm text-violet-50">
                  {internalLisaOutputs.length > 0
                    ? `TradeScout internal LISA is emitting ${internalLisaOutputs.length} normalized outputs into the live feed right now.`
                    : "No normalized internal-LISA outputs have surfaced in the live feed yet."}
                </div>
              </div>
              <Badge variant="outline" className="border-violet-200/20 text-violet-50">
                {internalLisaOutputs.length} outputs
              </Badge>
            </div>

            {derivedIntelligenceOutputs.length > 0 ? (
              <div className="mt-4 rounded-md border border-fuchsia-300/20 bg-fuchsia-500/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-fuchsia-100/70">
                    Derived Intelligence
                  </div>
                  <Badge variant="outline" className="border-fuchsia-200/20 text-fuchsia-50">
                    {derivedIntelligenceOutputs.length} surfaced
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-1 xl:grid-cols-3 gap-3">
                  <div className="rounded-md border border-emerald-300/20 bg-emerald-500/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-100/70">
                        Opportunity
                      </div>
                      <Badge variant="outline" className="border-emerald-200/20 text-emerald-50">
                        {opportunityOutputs.length}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {opportunityOutputs.length === 0 ? (
                        <div className="text-xs text-emerald-100/70">
                          No opportunity signals surfaced yet.
                        </div>
                      ) : (
                        opportunityOutputs.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-md border border-emerald-200/10 bg-black/20 px-3 py-2"
                          >
                            <div className="text-sm text-emerald-50">{item.title}</div>
                            <div className="mt-1 text-xs text-emerald-100/75">{item.narrative}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-amber-300/20 bg-amber-500/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-amber-100/70">
                        Friction
                      </div>
                      <Badge variant="outline" className="border-amber-200/20 text-amber-50">
                        {frictionOutputs.length}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {frictionOutputs.length === 0 ? (
                        <div className="text-xs text-amber-100/70">
                          No friction signals surfaced yet.
                        </div>
                      ) : (
                        frictionOutputs.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-md border border-amber-200/10 bg-black/20 px-3 py-2"
                          >
                            <div className="text-sm text-amber-50">{item.title}</div>
                            <div className="mt-1 text-xs text-amber-100/75">{item.narrative}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-rose-300/20 bg-rose-500/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-[0.24em] text-rose-100/70">
                        Waste
                      </div>
                      <Badge variant="outline" className="border-rose-200/20 text-rose-50">
                        {wasteOutputs.length}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {wasteOutputs.length === 0 ? (
                        <div className="text-xs text-rose-100/70">
                          No waste signals surfaced yet.
                        </div>
                      ) : (
                        wasteOutputs.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-md border border-rose-200/10 bg-black/20 px-3 py-2"
                          >
                            <div className="text-sm text-rose-50">{item.title}</div>
                            <div className="mt-1 text-xs text-rose-100/75">{item.narrative}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {internalLisaOutputs.length === 0 ? (
                <div className="text-sm text-violet-100/70">
                  Waiting for entity discovery, county/category discovery, repair pressure, or
                  derived intelligence outputs.
                </div>
              ) : (
                internalLisaOutputs.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-violet-200/10 bg-black/20 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-violet-50">{item.title}</div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            truthTone[item.truthStatus === "current" ? "current" : "stale"]
                          }
                        >
                          {item.truthStatus === "current" ? "current" : "stale"}
                        </Badge>
                        <Badge variant="outline" className={priorityTone[item.priority]}>
                          {item.priority}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      {item.lane ? (
                        <Badge variant="outline" className="border-violet-200/20 text-violet-100">
                          lane: {item.lane}
                        </Badge>
                      ) : null}
                      {item.signalClass ? (
                        <Badge variant="outline" className="border-violet-200/20 text-violet-100">
                          signal: {item.signalClass}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-violet-100/75">{item.narrative}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-emerald-100/70">
                Useful Signal vs Noise
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/60">
                    Signal
                  </div>
                  <div className="mt-1 text-xl font-semibold text-emerald-50">
                    {signalSurfaceCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-amber-100/60">
                    Noise
                  </div>
                  <div className="mt-1 text-xl font-semibold text-amber-50">
                    {noiseSurfaceCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-rose-100/60">
                    Leakage
                  </div>
                  <div className="mt-1 text-xl font-semibold text-rose-50">
                    {unknownSurfaceCount}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-emerald-100/70">
                Signal is meaningful public discovery. Noise is infra/meta/assets. Leakage is
                fallback traffic still landing in other/unknown_public.
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                Top Signal Buckets
              </div>
              <div className="mt-3 space-y-2">
                {topSurfaceBreakdown.length === 0 ? (
                  <div className="text-sm text-white/55">No crawler surface data yet.</div>
                ) : (
                  topSurfaceBreakdown.map((surface) => (
                    <div
                      key={surface.sourceSurface}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="text-white/75">{surface.sourceSurface}</div>
                      <Badge variant="outline" className="border-white/10 text-white/70">
                        {surface.requestCount}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-rose-100/70">
                Attribution Leakage
              </div>
              <div className="mt-2 text-sm text-rose-50">
                {topUnknownSurface
                  ? `${topUnknownSurface.sourceSurface} is still carrying ${topUnknownSurface.requestCount} requests in the current surface summary.`
                  : "No fallback leakage surfaced in the current top routes."}
              </div>
              <div className="mt-3 text-xs text-rose-100/70">
                Keep shrinking other/unknown_public until fallback mostly means true unknowns
                instead of missed known route families.
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-indigo-100/70">
                  County + Category Discovery
                </div>
                <div className="mt-2 text-sm text-indigo-50">
                  {topCountyDiscoveryLead
                    ? `${topCountyDiscoveryLead.countyName}${topCountyDiscoveryLead.stateCode ? `, ${topCountyDiscoveryLead.stateCode}` : ""} is the current lead county surface with ${topCountyDiscoveryLead.requestCount} crawler requests.`
                    : "No county discovery concentration surfaced yet."}
                </div>
              </div>
              <Badge variant="outline" className="border-indigo-200/20 text-indigo-50">
                {topCountyDiscovery.length} surfaced counties
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {topCountyDiscovery.length === 0 ? (
                <div className="text-sm text-indigo-100/70">
                  No county discovery routes available yet.
                </div>
              ) : (
                topCountyDiscovery.map((countyEntry) => (
                  <div
                    key={`${countyEntry.sourceSurface}:${countyEntry.countyName}:${countyEntry.stateCode || "na"}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-indigo-200/10 bg-black/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-indigo-50">
                        {countyEntry.countyName}
                        {countyEntry.stateCode ? `, ${countyEntry.stateCode}` : ""}
                      </div>
                      <div className="text-xs text-indigo-100/60">
                        {countyEntry.sourceSurface}
                        {countyEntry.countyFips ? ` • FIPS ${countyEntry.countyFips}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="border-indigo-200/20 text-indigo-50">
                      {countyEntry.requestCount}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-amber-100/70">
                  Repair Pressure
                </div>
                <div className="mt-2 text-sm text-amber-50">
                  {crawlerErrorTotal > 0
                    ? `${crawlerErrorTotal} crawler error responses were observed in the last 24 hours. Focus on high-demand broken routes first.`
                    : "No crawler error pressure surfaced in the current 24-hour summary."}
                </div>
              </div>
              <Badge variant="outline" className="border-amber-200/20 text-amber-50">
                {crawlerErrorTotal} errors / 24h
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {topRepairRoutes.length === 0 ? (
                <div className="text-sm text-amber-100/70">
                  No top crawler routes available yet.
                </div>
              ) : (
                topRepairRoutes.map((route) => (
                  <div
                    key={route.path}
                    className="flex items-center justify-between gap-3 rounded-md border border-amber-200/10 bg-black/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-amber-50">{route.path}</div>
                      <div className="text-xs text-amber-100/60">
                        Prioritize repair or redirect if this route is broken or stale.
                      </div>
                    </div>
                    <Badge variant="outline" className="border-amber-200/20 text-amber-50">
                      {route.requestCount}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Active Alerts
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {data?.summary.activeAlerts ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                LISA Entries
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {data?.summary.sourceCounts?.lisa ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Cumulus Entries
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {data?.summary.sourceCounts?.cumulus ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Crawler Entries
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {data?.summary.sourceCounts?.crawler ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Bot Crawl Signals
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {data?.summary.botCrawlSignals ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Alert Entries
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {data?.summary.sourceCounts?.alerts ?? 0}
              </div>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${presentationMode ? "md:grid-cols-7" : "md:grid-cols-7"} gap-4`}
          >
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="lisa">LISA</SelectItem>
                  <SelectItem value="bot_crawl_signals">Bot Crawl</SelectItem>
                  <SelectItem value="cumulus">Cumulus</SelectItem>
                  <SelectItem value="crawler">Crawler</SelectItem>
                  <SelectItem value="alerts">Alerts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Truth</Label>
              <Select value={truthFilter} onValueChange={setTruthFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All truth states</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="stale">Stale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Durability</Label>
              <Select value={durabilityFilter} onValueChange={setDurabilityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All durability</SelectItem>
                  <SelectItem value="volatile">Volatile</SelectItem>
                  <SelectItem value="stable">Stable</SelectItem>
                  <SelectItem value="persistent">Persistent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <Input
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.trim().toUpperCase() || "all")}
                placeholder="all or FL"
              />
            </div>
            <div className="space-y-1">
              <Label>County</Label>
              <Input
                value={county}
                onChange={(e) => setCounty(e.target.value.trim().toLowerCase() || "all")}
                placeholder="all or mobile"
              />
            </div>
            <div className="space-y-1">
              <Label>Limit</Label>
              <Input
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, "") || "20")}
              />
            </div>
            <div className="space-y-1">
              <Label>History Days</Label>
              <Input
                value={historyDays}
                onChange={(e) => setHistoryDays(e.target.value.replace(/[^\d]/g, "") || "7")}
                placeholder="7"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Truth Now</div>
              <div className="mt-2 text-sm text-white/85">
                {data?.summary.truthNow || (isLoading ? "Loading..." : "Unavailable")}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Lead County</div>
              <div className="mt-2 text-sm text-white/85">
                {data?.summary.currentLeadCounty || "Unavailable"}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Lead State</div>
              <div className="mt-2 text-sm text-white/85">
                {data?.summary.currentLeadState || "Unavailable"}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                Crawler Requests 24h
              </div>
              <div className="mt-2 text-sm text-white/85">
                {typeof data?.summary.crawlerRequests24h === "number"
                  ? data.summary.crawlerRequests24h
                  : "Unavailable"}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Active Alerts</div>
              <div className="mt-2 text-sm text-white/85">
                {typeof data?.summary.activeAlerts === "number"
                  ? data.summary.activeAlerts
                  : "Unavailable"}
              </div>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">
                Bot Crawl Lead
              </div>
              <div className="mt-2 text-sm text-cyan-50">
                {data?.summary.topBotCrawlHeadline || "No bot crawl lead yet"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data?.summary.sourceCounts || {}).length === 0 ? (
              <div className="text-sm text-white/55">No source counts available yet.</div>
            ) : (
              Object.entries(data?.summary.sourceCounts || {}).map(([entrySource, count]) => (
                <div
                  key={entrySource}
                  className="rounded-lg border border-white/10 bg-black/20 p-4"
                >
                  <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                    {entrySource}
                  </div>
                  <div className="mt-2 text-sm text-white/85">{count} live entries</div>
                </div>
              ))
            )}
          </div>

          <div className="text-xs text-white/50">
            {data?.generatedAt
              ? `Updated ${new Date(data.generatedAt).toLocaleString()}`
              : isLoading
                ? "Loading live stream..."
                : "No live stream available"}
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Failed to load live stream.
            </div>
          ) : null}

          {refreshError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {refreshError}
            </div>
          ) : null}

          {refreshMessage ? (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {refreshMessage}
            </div>
          ) : null}

          {exportError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {exportError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className={`bg-card border-border ${presentationMode ? "print:hidden" : ""}`}>
        <CardHeader>
          <CardTitle className="text-white">Live Feed</CardTitle>
          <CardDescription className="text-white/70">
            Server-produced entries only. The UI does not synthesize intelligence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredStream.length === 0 ? (
              <div className="text-sm text-white/65">
                {isLoading ? "Loading stream..." : "No live entries available."}
              </div>
            ) : (
              filteredStream.map((item) => {
                const truthStatus = item.truthStatus === "current" ? "current" : "stale";
                const durabilityClass = resolveDurabilityClass(item.source);
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-white">{item.title}</div>
                        <Badge className={priorityTone[item.priority]}>{item.priority}</Badge>
                        <Badge className={truthTone[truthStatus]}>{truthStatus}</Badge>
                        <Badge className={durabilityTone[durabilityClass]}>{durabilityClass}</Badge>
                        <Badge variant="outline" className="border-white/10 text-white/60">
                          {item.source}
                        </Badge>
                      </div>
                      <div className="text-xs text-white/50">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-white/80">{item.narrative}</div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {!presentationMode ? (
        <Card className="bg-tsCard/95 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Stream History</CardTitle>
            <CardDescription className="text-white/70">
              Stored snapshots of the live stream for replay and comparison (last{" "}
              {Math.min(30, Math.max(1, Number.parseInt(historyDays || "7", 10) || 7))} days).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(historyData?.history || []).length === 0 ? (
                <div className="text-sm text-white/65">No stored history available yet.</div>
              ) : (
                historyData?.history.map((snapshot) => (
                  <div
                    key={snapshot.generatedAt}
                    className="rounded-lg border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">
                        {new Date(snapshot.generatedAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-white/50">
                        {snapshot.filters?.source || "all sources"} |{" "}
                        {snapshot.filters?.stateCode || "all states"} |{" "}
                        {snapshot.filters?.county || "all counties"}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-white/80">
                      {snapshot.summary.truthNow || "No truth summary recorded."}
                    </div>
                    <div className="mt-2 text-xs text-white/55">
                      {snapshot.stream?.length || 0} entries captured
                    </div>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-white/15 text-white/75"
                        onClick={() =>
                          setExpandedHistorySnapshot((prev) =>
                            prev === snapshot.generatedAt ? null : snapshot.generatedAt
                          )
                        }
                      >
                        {expandedHistorySnapshot === snapshot.generatedAt
                          ? "Hide captured entries"
                          : "Show captured entries"}
                      </Button>
                    </div>
                    {expandedHistorySnapshot === snapshot.generatedAt ? (
                      <div className="mt-3 space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
                        {(snapshot.stream || []).length === 0 ? (
                          <div className="text-xs text-white/55">
                            No entries stored in this snapshot.
                          </div>
                        ) : (
                          (snapshot.stream || []).map((entry) => {
                            const truthStatus =
                              entry.truthStatus === "current" ? "current" : "stale";
                            const durabilityClass = resolveDurabilityClass(entry.source);
                            return (
                              <div
                                key={entry.id}
                                className="rounded border border-white/10 bg-black/20 p-2"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold text-white/90">
                                    {entry.title}
                                  </span>
                                  <Badge className={priorityTone[entry.priority]}>
                                    {entry.priority}
                                  </Badge>
                                  <Badge className={truthTone[truthStatus]}>{truthStatus}</Badge>
                                  <Badge className={durabilityTone[durabilityClass]}>
                                    {durabilityClass}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="border-white/10 text-white/60"
                                  >
                                    {entry.source}
                                  </Badge>
                                </div>
                                <div className="mt-1 text-xs text-white/50">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </div>
                                <div className="mt-1 text-xs text-white/80">{entry.narrative}</div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
