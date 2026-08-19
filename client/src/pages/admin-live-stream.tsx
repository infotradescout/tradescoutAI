import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Globe2,
  RefreshCw,
  ShieldCheck,
  Signal,
  XCircle,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
  AdminWorkspaceSubnav,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type SignalPriority = "critical" | "high" | "medium" | "low";

type LiveStreamItem = {
  id: string;
  timestamp: string;
  kind: string;
  priority: SignalPriority;
  truthStatus?: "current" | "stale";
  title: string;
  narrative: string;
  source: string;
  lane?: string;
  signalClass?: string;
  baselineDeltaPct?: number;
  category?: string;
  county?: string;
  state?: string;
  recommendedPlay?: string;
  salesAngle?: string;
  targetMarket?: string;
  channelSuggestion?: string;
  assetSuggestion?: string;
  whyNow?: string;
  inventorySummary?: string;
  prospectSummary?: string;
  marketGapSummary?: string;
  evidence?: string[];
};

type LiveStreamResponse = {
  generatedAt: string;
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
    usabilityAccepted?: number;
    usabilityRejected?: number;
    usabilityRejectionReasons?: Record<string, number>;
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
  topBots: Array<{ botName: string; requestCount: number }>;
  topRoutes: Array<{ path: string; requestCount: number }>;
  topSurfaces: Array<{ sourceSurface: string; requestCount: number }>;
  topCounties: Array<{
    countyName: string;
    stateCode: string | null;
    countyFips: string | null;
    sourceSurface: string;
    requestCount: number;
  }>;
  requestTypes: Array<{ requestType: string; requestCount: number }>;
};

type BotArmySprintQueueItem = {
  id: string;
  route: string;
  failureType: string;
  severity: number;
  occurrences: number;
  latestAt: string;
  score: number;
  observedFact: string;
  recommendedAction: string;
  riskIfIgnored: string;
};

type BotArmySprintQueueResponse = {
  generatedAt: string;
  lookbackHours: number;
  limit: number;
  queue: BotArmySprintQueueItem[];
};

type BotArmyAutoPromotionResult = {
  generatedAt: string;
  lookbackHours: number;
  limit: number;
  minScore: number;
  candidatesEvaluated: number;
  promotedCount: number;
  skippedLowScoreCount: number;
  skippedResolvedCount: number;
};

type BotArmyAutoPromotionStatusResponse = {
  enabled: boolean;
  schedulerActive: boolean;
  schedule: string;
  settings: {
    lookbackHours: number;
    limit: number;
    minScore: number;
  };
};

const PRIORITY_ORDER: Record<SignalPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function readable(value: unknown): string {
  const text = String(value || "").trim();
  return text
    ? text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not recorded";
}

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}

function numberOrDash(value: unknown): number | string {
  const number = Number(value);
  return Number.isFinite(number) ? number : "—";
}

function priorityBadge(priority: SignalPriority) {
  const classes: Record<SignalPriority, string> = {
    critical: "border-red-400/30 bg-red-400/10 text-red-100",
    high: "border-orange-400/30 bg-orange-400/10 text-orange-100",
    medium: "border-sky-400/25 bg-sky-400/10 text-sky-100",
    low: "border-white/15 bg-white/5 text-white/50",
  };
  return <Badge className={classes[priority]}>{readable(priority)}</Badge>;
}

function truthBadge(value: unknown) {
  const current = String(value || "current") === "current";
  return current ? (
    <Badge className="border-emerald-400/25 bg-emerald-400/8 text-emerald-100">Current</Badge>
  ) : (
    <Badge className="border-amber-400/25 bg-amber-400/8 text-amber-100">Stale</Badge>
  );
}

function sourceList(summary: LiveStreamResponse["summary"] | undefined): string[] {
  return Object.keys(summary?.sourceCounts || {}).sort((a, b) => a.localeCompare(b));
}

function signalLocation(item: LiveStreamItem): string {
  return [item.county, item.state].filter(Boolean).join(", ") || "No location recorded";
}

function signalDetailRows(item: LiveStreamItem): Array<[string, string]> {
  return [
    ["Observed basis", item.whyNow || item.narrative],
    ["Operator step", item.recommendedPlay || "No direct action recorded"],
    ["Target market", item.targetMarket || "Not recorded"],
    ["Why it matters", item.salesAngle || "Not recorded"],
    ["Suggested surface", item.channelSuggestion || "Not recorded"],
    ["Needed asset", item.assetSuggestion || "Not recorded"],
    ["Inventory context", item.inventorySummary || "Not recorded"],
    ["Market gap", item.marketGapSummary || "Not recorded"],
    ["Audience", item.prospectSummary || "Not recorded"],
  ].filter(([, value]) => value !== "Not recorded");
}

export default function AdminLiveStreamPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [source, setSource] = useState("all");
  const [stateCode, setStateCode] = useState("all");
  const [county, setCounty] = useState("all");
  const [truth, setTruth] = useState("all");
  const [limit, setLimit] = useState("50");
  const [historyDays, setHistoryDays] = useState("7");

  const liveQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", limit || "50");
    if (source !== "all") params.set("source", source);
    if (stateCode !== "all") params.set("stateCode", stateCode);
    if (county !== "all") params.set("county", county);
    return params.toString();
  }, [county, limit, source, stateCode]);

  const historyQueryString = useMemo(() => {
    const params = new URLSearchParams(liveQueryString);
    params.set("lookbackDays", historyDays);
    return params.toString();
  }, [historyDays, liveQueryString]);

  const liveQuery = useQuery<LiveStreamResponse>({
    queryKey: ["/api/admin/observability/live-stream", liveQueryString],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/admin/observability/live-stream?${liveQueryString}`
      ) as Promise<LiveStreamResponse>,
    refetchInterval: 10_000,
    retry: false,
  });
  const historyQuery = useQuery<LiveStreamHistoryResponse>({
    queryKey: ["/api/admin/observability/live-stream/history", historyQueryString],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/admin/observability/live-stream/history?${historyQueryString}`
      ) as Promise<LiveStreamHistoryResponse>,
    refetchInterval: 30_000,
    retry: false,
  });
  const snapshotQuery = useQuery<SnapshotStatusResponse>({
    queryKey: ["/api/admin/observability/snapshot-status"],
    queryFn: () =>
      apiRequest(
        "GET",
        "/api/admin/observability/snapshot-status"
      ) as Promise<SnapshotStatusResponse>,
    refetchInterval: 30_000,
    retry: false,
  });
  const crawlerQuery = useQuery<CrawlerTelemetrySummary>({
    queryKey: ["/api/admin/observability/crawler-telemetry"],
    queryFn: () =>
      apiRequest(
        "GET",
        "/api/admin/observability/crawler-telemetry"
      ) as Promise<CrawlerTelemetrySummary>,
    refetchInterval: 30_000,
    retry: false,
  });
  const botQueueQuery = useQuery<BotArmySprintQueueResponse>({
    queryKey: ["/api/admin/mission-control/bot-army/sprint-queue", "lookback=6", "limit=25"],
    queryFn: () =>
      apiRequest(
        "GET",
        "/api/admin/mission-control/bot-army/sprint-queue?lookbackHours=6&limit=25"
      ) as Promise<BotArmySprintQueueResponse>,
    refetchInterval: 15_000,
    retry: false,
  });
  const botPromotionQuery = useQuery<BotArmyAutoPromotionStatusResponse>({
    queryKey: ["/api/admin/mission-control/bot-army/auto-promote/status"],
    queryFn: () =>
      apiRequest(
        "GET",
        "/api/admin/mission-control/bot-army/auto-promote/status"
      ) as Promise<BotArmyAutoPromotionStatusResponse>,
    refetchInterval: 30_000,
    retry: false,
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/observability/live-stream/refresh", {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/observability/live-stream"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/observability/live-stream/history"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/observability/snapshot-status"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/observability/crawler-telemetry"] }),
      ]);
      toast({ title: "System snapshots refreshed", description: "The observability sources were recomputed." });
    },
    onError: (error: unknown) => {
      toast({
        title: "System refresh failed",
        description: formatUserFacingErrorMessage(error, "The observability sources were not refreshed."),
        variant: "destructive",
      });
    },
  });

  const autoPromoteMutation = useMutation({
    mutationFn: () =>
      apiRequest(
        "POST",
        "/api/admin/mission-control/bot-army/auto-promote/trigger",
        {}
      ) as Promise<BotArmyAutoPromotionResult>,
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/mission-control/bot-army/sprint-queue"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/mission-control/bot-army/auto-promote/status"],
        }),
      ]);
      toast({
        title: "Bot Army promotion complete",
        description: `${result.promotedCount} promoted · ${result.skippedLowScoreCount} below score · ${result.skippedResolvedCount} already resolved.`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Bot Army promotion failed",
        description: formatUserFacingErrorMessage(error, "No automated repair work was promoted."),
        variant: "destructive",
      });
    },
  });

  const stream = useMemo(
    () =>
      (liveQuery.data?.stream || [])
        .filter((item) => truth === "all" || (item.truthStatus || "current") === truth)
        .sort((a, b) => {
          const priorityDifference = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          if (priorityDifference !== 0) return priorityDifference;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }),
    [liveQuery.data?.stream, truth]
  );

  const availableStates = useMemo(() => {
    const values = new Set<string>();
    for (const item of liveQuery.data?.stream || []) {
      if (item.state) values.add(item.state);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [liveQuery.data?.stream]);
  const availableCounties = useMemo(() => {
    const values = new Set<string>();
    for (const item of liveQuery.data?.stream || []) {
      if (item.county) values.add(item.county);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [liveQuery.data?.stream]);

  const staleSnapshots = snapshotQuery.data?.statuses.filter((item) => item.isStale) || [];
  const degradedSources = liveQuery.data?.summary.degradedSources || [];
  const currentLead = [
    liveQuery.data?.summary.currentLeadCounty,
    liveQuery.data?.summary.currentLeadState,
  ]
    .filter(Boolean)
    .join(", ");

  const refreshAllReads = () => {
    liveQuery.refetch();
    historyQuery.refetch();
    snapshotQuery.refetch();
    crawlerQuery.refetch();
    botQueueQuery.refetch();
    botPromotionQuery.refetch();
  };
  const anyFetching =
    liveQuery.isFetching ||
    historyQuery.isFetching ||
    snapshotQuery.isFetching ||
    crawlerQuery.isFetching ||
    botQueueQuery.isFetching ||
    botPromotionQuery.isFetching;

  const exportCsv = async () => {
    try {
      const response = await fetch(
        `/api/admin/observability/live-stream/export.csv?${liveQueryString}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("CSV export failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `tradescout-system-status-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      toast({ title: "CSV export started" });
    } catch (error: unknown) {
      toast({
        title: "CSV export failed",
        description: formatUserFacingErrorMessage(error, "The system status export could not be created."),
        variant: "destructive",
      });
    }
  };

  return (
    <AdminWorkspace data-testid="admin-system-status-v2">
      <AdminSection
        title="System status"
        description="Current observability, crawler, snapshot, and automated-repair state. Missing sources remain unavailable instead of being displayed as healthy zeroes."
        className="pt-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={refreshAllReads}
              disabled={anyFetching}
              className="border-white/12 bg-white/[0.025] text-white/65"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${anyFetching ? "animate-spin" : ""}`} />
              Recheck
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="border-white/12 bg-white/[0.025] text-white/65"
            >
              <Signal className="mr-2 h-4 w-4" />
              {refreshMutation.isPending ? "Refreshing…" : "Refresh snapshots"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={exportCsv}
              className="border-white/12 bg-white/[0.025] text-white/65"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Current signals",
              value: liveQuery.isError ? "—" : stream.length,
              detail: liveQuery.isError
                ? "Live stream unavailable"
                : `Generated ${formatDate(liveQuery.data?.generatedAt)}`,
              tone: liveQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Active alerts",
              value: liveQuery.isError
                ? "—"
                : numberOrDash(liveQuery.data?.summary.activeAlerts),
              detail: currentLead ? `Lead county: ${currentLead}` : "No lead county recorded",
              tone:
                liveQuery.isError || Number(liveQuery.data?.summary.activeAlerts || 0) > 0
                  ? "warning"
                  : "good",
            },
            {
              label: "Crawler requests 24h",
              value: crawlerQuery.isError
                ? "—"
                : numberOrDash(crawlerQuery.data?.totals24h.total),
              detail: crawlerQuery.isError
                ? "Crawler telemetry unavailable"
                : `${crawlerQuery.data?.totals24h.serverError || 0} server errors`,
              tone:
                crawlerQuery.isError || Number(crawlerQuery.data?.totals24h.serverError || 0) > 0
                  ? "warning"
                  : "good",
            },
            {
              label: "Stale snapshots",
              value: snapshotQuery.isError ? "—" : staleSnapshots.length,
              detail: snapshotQuery.isError
                ? "Snapshot status unavailable"
                : snapshotQuery.data?.schedulerEnabled
                  ? "Snapshot scheduler enabled"
                  : "Snapshot scheduler disabled",
              tone:
                snapshotQuery.isError || staleSnapshots.length > 0 ? "warning" : "good",
            },
          ]}
        />
      </AdminSection>

      <Tabs defaultValue="signals" className="space-y-6">
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
            {[
              ["signals", "Signals"],
              ["crawler", "Crawler"],
              ["snapshots", "Snapshots"],
              ["bot-army", "Bot Army"],
              ["history", "History"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </AdminWorkspaceSubnav>

        <TabsContent value="signals" className="mt-0">
          <AdminSection
            title="Current operating signals"
            description="Server-produced entries only. Priority and truth state determine the review order."
            className="pt-0"
          >
            <AdminToolbar>
              <div className="flex flex-wrap gap-2">
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    {sourceList(liveQuery.data?.summary).map((item) => (
                      <SelectItem key={item} value={item}>
                        {readable(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={truth} onValueChange={setTruth}>
                  <SelectTrigger className="w-[10rem] border-white/10 bg-black/20 text-white">
                    <SelectValue placeholder="Truth state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All truth states</SelectItem>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="stale">Stale</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stateCode} onValueChange={setStateCode}>
                  <SelectTrigger className="w-[10rem] border-white/10 bg-black/20 text-white">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All states</SelectItem>
                    {availableStates.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={county} onValueChange={setCounty}>
                  <SelectTrigger className="w-[13rem] border-white/10 bg-black/20 text-white">
                    <SelectValue placeholder="County" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All counties</SelectItem>
                    {availableCounties.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger className="w-[8rem] border-white/10 bg-black/20 text-white">
                    <SelectValue placeholder="Limit" />
                  </SelectTrigger>
                  <SelectContent>
                    {[20, 50, 100, 250].map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value} signals
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-white/35">
                {stream.length} shown · refreshes every 10 seconds
              </p>
            </AdminToolbar>

            {liveQuery.isLoading ? (
              <QueueLoading label="Loading current signals…" />
            ) : liveQuery.isError ? (
              <QueueUnavailable label="The live signal source is unavailable. No signal state was changed." />
            ) : stream.length ? (
              <AdminList className="mt-4">
                {stream.map((item) => (
                  <details key={item.id} className="group">
                    <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(10rem,0.6fr)_minmax(10rem,0.6fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {priorityBadge(item.priority)}
                          {truthBadge(item.truthStatus)}
                          <Badge className="border-white/15 bg-white/5 text-white/50">
                            {readable(item.source)}
                          </Badge>
                        </div>
                        <p className="mt-3 truncate font-semibold text-white">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/48">
                          {item.narrative}
                        </p>
                      </div>
                      <div className="text-sm text-white/52">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                          Where
                        </p>
                        <p className="mt-1">{signalLocation(item)}</p>
                      </div>
                      <div className="text-sm text-white/52">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                          When
                        </p>
                        <p className="mt-1">{formatDate(item.timestamp)}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-white/30 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        {signalDetailRows(item).map(([label, value]) => (
                          <div key={`${item.id}-${label}`} className="border-y border-white/10 px-3 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                              {label}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-white/58">{value}</p>
                          </div>
                        ))}
                      </div>
                      {item.evidence?.length ? (
                        <div className="mt-5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                            Evidence
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.evidence.map((evidence) => (
                              <Badge key={`${item.id}-${evidence}`} className="border-white/15 bg-white/5 text-white/50">
                                {evidence}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </details>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No current signals match these filters"
                description="Change the source, truth state, location, or signal limit."
              />
            )}

            {degradedSources.length ? (
              <div className="mt-5 border-y border-amber-400/20 bg-amber-400/5 px-4 py-4 text-sm text-amber-100">
                <p className="font-semibold">Degraded sources</p>
                <div className="mt-2 space-y-1 text-amber-100/70">
                  {degradedSources.map((item) => (
                    <p key={item}>
                      {readable(item)}: {liveQuery.data?.summary.degradedSourceReasons?.[item] || "No reason recorded"}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </AdminSection>
        </TabsContent>

        <TabsContent value="crawler" className="mt-0">
          <CrawlerWorkspace query={crawlerQuery} />
        </TabsContent>

        <TabsContent value="snapshots" className="mt-0">
          <SnapshotWorkspace query={snapshotQuery} />
        </TabsContent>

        <TabsContent value="bot-army" className="mt-0">
          <BotArmyWorkspace
            queueQuery={botQueueQuery}
            statusQuery={botPromotionQuery}
            triggerPending={autoPromoteMutation.isPending}
            onTrigger={() => autoPromoteMutation.mutate()}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <HistoryWorkspace
            query={historyQuery}
            historyDays={historyDays}
            onHistoryDaysChange={setHistoryDays}
          />
        </TabsContent>
      </Tabs>
    </AdminWorkspace>
  );
}

function CrawlerWorkspace({ query }: { query: ReturnType<typeof useQuery<CrawlerTelemetrySummary>> }) {
  const data = query.data;
  return (
    <AdminSection
      title="Crawler activity"
      description="Real crawler requests, status classes, routes, source surfaces, and county attribution from the last 24 hours."
      className="pt-0"
      actions={
        <Button type="button" variant="outline" onClick={() => query.refetch()} className="border-white/12 bg-transparent text-white/60">
          <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {query.isLoading ? (
        <QueueLoading label="Loading crawler telemetry…" />
      ) : query.isError || !data ? (
        <QueueUnavailable label="Crawler telemetry is unavailable." />
      ) : (
        <>
          <AdminSummaryStrip
            items={[
              { label: "Requests", value: data.totals24h.total, detail: `Generated ${formatDate(data.generatedAt)}` },
              { label: "Successful", value: data.totals24h.ok, detail: "2xx and accepted responses", tone: "good" },
              { label: "Client errors", value: data.totals24h.clientError, detail: "4xx responses", tone: data.totals24h.clientError > 0 ? "warning" : "good" },
              { label: "Server errors", value: data.totals24h.serverError, detail: "5xx responses", tone: data.totals24h.serverError > 0 ? "danger" : "good" },
            ]}
          />
          <div className="mt-7 grid gap-7 xl:grid-cols-2">
            <RankedList title="Top routes" items={data.topRoutes.map((item) => ({ label: item.path, value: item.requestCount }))} />
            <RankedList title="Top surfaces" items={data.topSurfaces.map((item) => ({ label: readable(item.sourceSurface), value: item.requestCount }))} />
            <RankedList title="Top bots" items={data.topBots.map((item) => ({ label: item.botName, value: item.requestCount }))} />
            <RankedList title="Top counties" items={data.topCounties.map((item) => ({ label: [item.countyName, item.stateCode].filter(Boolean).join(", ") || item.countyFips || "Unknown county", value: item.requestCount, detail: readable(item.sourceSurface) }))} />
          </div>
        </>
      )}
    </AdminSection>
  );
}

function SnapshotWorkspace({ query }: { query: ReturnType<typeof useQuery<SnapshotStatusResponse>> }) {
  const data = query.data;
  return (
    <AdminSection
      title="Snapshot health"
      description="Each data container reports its latest compute time, row count, stale threshold, and current stale state."
      className="pt-0"
      actions={
        <Button type="button" variant="outline" onClick={() => query.refetch()} className="border-white/12 bg-transparent text-white/60">
          <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {query.isLoading ? (
        <QueueLoading label="Loading snapshot status…" />
      ) : query.isError || !data ? (
        <QueueUnavailable label="Snapshot status is unavailable." />
      ) : data.statuses.length ? (
        <>
          <div className="mb-4 flex items-center gap-2 text-sm text-white/52">
            <ShieldCheck className={data.schedulerEnabled ? "h-4 w-4 text-emerald-300" : "h-4 w-4 text-amber-200"} />
            Scheduler {data.schedulerEnabled ? "enabled" : "disabled"} · generated {formatDate(data.generatedAt)}
          </div>
          <AdminList>
            {data.statuses
              .slice()
              .sort((a, b) => Number(b.isStale) - Number(a.isStale) || a.label.localeCompare(b.label))
              .map((item) => (
                <div key={item.key} className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(10rem,0.45fr)_minmax(12rem,0.65fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{item.label}</p>
                    <p className="mt-1 font-mono text-xs text-white/30">{item.key}</p>
                  </div>
                  <div className="text-sm text-white/55">
                    <p>{item.rowCount} rows</p>
                    <p className="mt-1 text-xs text-white/32">stale after {item.staleAfterMinutes} minutes</p>
                  </div>
                  <div className="text-sm text-white/55">{formatDate(item.latestComputedAt)}</div>
                  {item.isStale ? (
                    <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">Stale</Badge>
                  ) : (
                    <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Current</Badge>
                  )}
                </div>
              ))}
          </AdminList>
        </>
      ) : (
        <AdminEmptyState title="No snapshot containers" description="The snapshot-status source returned no containers." />
      )}
    </AdminSection>
  );
}

function BotArmyWorkspace({
  queueQuery,
  statusQuery,
  triggerPending,
  onTrigger,
}: {
  queueQuery: ReturnType<typeof useQuery<BotArmySprintQueueResponse>>;
  statusQuery: ReturnType<typeof useQuery<BotArmyAutoPromotionStatusResponse>>;
  triggerPending: boolean;
  onTrigger: () => void;
}) {
  const queue = queueQuery.data?.queue || [];
  const status = statusQuery.data;
  return (
    <AdminSection
      title="Bot Army repair queue"
      description="Observed crawler and interface failures ranked for repair promotion. Resolved work is not reopened by the automated promoter."
      className="pt-0"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => queueQuery.refetch()} className="border-white/12 bg-transparent text-white/60">
            <RefreshCw className={`mr-2 h-4 w-4 ${queueQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh queue
          </Button>
          <Button type="button" onClick={onTrigger} disabled={triggerPending} className="bg-orange-500 text-black hover:bg-orange-400">
            <Bot className="mr-2 h-4 w-4" />
            {triggerPending ? "Promoting…" : "Run Auto-Promote Now"}
          </Button>
        </div>
      }
    >
      <div className="mb-5 border-y border-white/10 px-3 py-4 sm:px-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={statusQuery.isError ? "border-red-400/30 bg-red-400/10 text-red-100" : status?.enabled ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-100"}>
            Auto-Promote Scheduler: {statusQuery.isError ? "Unavailable" : status?.enabled ? "Enabled" : "Disabled"}
          </Badge>
          {status ? (
            <span className="text-sm text-white/45">
              {status.schedule} · lookback {status.settings.lookbackHours}h · minimum score {status.settings.minScore} · limit {status.settings.limit}
            </span>
          ) : null}
        </div>
      </div>

      {queueQuery.isLoading ? (
        <QueueLoading label="Loading Bot Army repair queue…" />
      ) : queueQuery.isError ? (
        <QueueUnavailable label="The Bot Army repair queue is unavailable." />
      ) : queue.length ? (
        <AdminList>
          {queue.map((item) => (
            <details key={item.id} className="group">
              <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(9rem,0.45fr)_minmax(8rem,0.4fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{item.route}</p>
                  <p className="mt-1 truncate text-sm text-white/45">{readable(item.failureType)}</p>
                </div>
                <div className="text-sm text-white/55">
                  <p>Score {item.score}</p>
                  <p className="mt-1 text-xs text-white/32">Severity {item.severity}</p>
                </div>
                <div className="text-sm text-white/55">
                  <p>{item.occurrences} events</p>
                  <p className="mt-1 text-xs text-white/32">{formatDate(item.latestAt)}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-white/30 transition-transform group-open:rotate-90" />
              </summary>
              <div className="grid gap-4 border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4 md:grid-cols-3">
                <DetailBlock label="Observed fact" value={item.observedFact} />
                <DetailBlock label="Recommended action" value={item.recommendedAction} />
                <DetailBlock label="Risk if ignored" value={item.riskIfIgnored} />
              </div>
            </details>
          ))}
        </AdminList>
      ) : (
        <AdminEmptyState title="No Bot Army repair candidates" description="No current failure meets the queue criteria." />
      )}
    </AdminSection>
  );
}

function HistoryWorkspace({
  query,
  historyDays,
  onHistoryDaysChange,
}: {
  query: ReturnType<typeof useQuery<LiveStreamHistoryResponse>>;
  historyDays: string;
  onHistoryDaysChange: (value: string) => void;
}) {
  const history = query.data?.history || [];
  return (
    <AdminSection
      title="System snapshot history"
      description="Historical server-produced summaries for comparison."
      className="pt-0"
      actions={
        <Select value={historyDays} onValueChange={onHistoryDaysChange}>
          <SelectTrigger className="w-[10rem] border-white/10 bg-black/20 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last day</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {query.isLoading ? (
        <QueueLoading label="Loading system history…" />
      ) : query.isError ? (
        <QueueUnavailable label="System history is unavailable." />
      ) : history.length ? (
        <AdminList>
          {history.map((snapshot, index) => (
            <details key={`${snapshot.generatedAt}-${index}`} className="group">
              <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(10rem,0.45fr)_minmax(10rem,0.45fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="font-semibold text-white">{formatDate(snapshot.generatedAt)}</p>
                  <p className="mt-1 text-sm text-white/42">{snapshot.summary.truthNow || "No truth summary recorded"}</p>
                </div>
                <div className="text-sm text-white/52">{snapshot.stream.length} signals</div>
                <div className="text-sm text-white/52">{snapshot.summary.activeAlerts} alerts</div>
                <ExternalLink className="h-4 w-4 text-white/30 transition-transform group-open:rotate-90" />
              </summary>
              <div className="grid gap-4 border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4 md:grid-cols-4">
                <DetailBlock label="Lead county" value={[snapshot.summary.currentLeadCounty, snapshot.summary.currentLeadState].filter(Boolean).join(", ") || "Not recorded"} />
                <DetailBlock label="Crawler requests" value={String(snapshot.summary.crawlerRequests24h)} />
                <DetailBlock label="Bot crawl signals" value={String(snapshot.summary.botCrawlSignals || 0)} />
                <DetailBlock label="Degraded sources" value={(snapshot.summary.degradedSources || []).map(readable).join(", ") || "None recorded"} />
              </div>
            </details>
          ))}
        </AdminList>
      ) : (
        <AdminEmptyState title="No system history" description="No historical snapshot is available for this lookback window." />
      )}
    </AdminSection>
  );
}

function RankedList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; detail?: string }>;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">{title}</p>
      {items.length ? (
        <AdminList className="mt-3">
          {items.slice(0, 10).map((item, index) => (
            <div key={`${title}-${item.label}-${index}`} className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4">
              <span className="min-w-0 truncate text-white/55">
                {item.label}
                {item.detail ? <span className="ml-2 text-xs text-white/28">{item.detail}</span> : null}
              </span>
              <span className="font-mono text-white/70">{item.value}</span>
            </div>
          ))}
        </AdminList>
      ) : (
        <AdminEmptyState title={`No ${title.toLowerCase()}`} description="The source returned no records for this ranking." />
      )}
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-y border-white/10 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white/58">{value}</p>
    </div>
  );
}

function QueueLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
      <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function QueueUnavailable({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {label}
    </div>
  );
}
