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
  title: string;
  narrative: string;
  source: string;
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
    sourceCounts: Record<string, number>;
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

export default function AdminLiveStreamPage() {
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [source, setSource] = useState("all");
  const [stateCode, setStateCode] = useState("all");
  const [county, setCounty] = useState("all");
  const [limit, setLimit] = useState("20");
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
    queryKey: ["/api/admin/observability/live-stream/history", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/admin/observability/live-stream/history?${queryString}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch live stream history");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

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

  const liveStreamStatus = snapshotStatus?.statuses.find((entry) => entry.key === "live_stream");
  const liveStreamStateLabel = liveStreamStatus
    ? liveStreamStatus.isStale
      ? "stale"
      : "fresh"
    : "missing";

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
                Rows: {liveStreamStatus?.rowCount ?? 0}
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
                Lead Geography
              </div>
              <div className="mt-2 text-sm text-foreground">
                {data?.summary.currentLeadCounty && data?.summary.currentLeadState
                  ? `${data.summary.currentLeadCounty}, ${data.summary.currentLeadState}`
                  : "No lead geography"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Active Alerts
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {data?.summary.activeAlerts ?? 0}
              </div>
            </div>
          </div>

          <div
            className={`grid grid-cols-1 ${presentationMode ? "md:grid-cols-4" : "md:grid-cols-4"} gap-4`}
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
                  <SelectItem value="cumulus">Cumulus</SelectItem>
                  <SelectItem value="crawler">Crawler</SelectItem>
                  <SelectItem value="alerts">Alerts</SelectItem>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            {(data?.stream || []).length === 0 ? (
              <div className="text-sm text-white/65">
                {isLoading ? "Loading stream..." : "No live entries available."}
              </div>
            ) : (
              data?.stream.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <Badge className={priorityTone[item.priority]}>{item.priority}</Badge>
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
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {!presentationMode ? (
        <Card className="bg-tsCard/95 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Stream History</CardTitle>
            <CardDescription className="text-white/70">
              Stored snapshots of the live stream for replay and comparison.
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
