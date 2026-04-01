import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Compass,
  ExternalLink,
  Radar,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface MissionControlSummary {
  last24hRange: { start: string; end: string };
  totalConnectionAttempts: number;
  successfulConnections: number;
  blockedConnections: number;
  confusingExperiences: number;
}

interface MissionControlFailure {
  id: string;
  sourceType: string;
  who: string;
  what: string;
  where: string;
  why: string;
  fixLever: string;
  impactScore: number;
  occurrences: number;
  severity: number;
  latestAt: string;
  tags?: string[];
}

interface MissionControlCompromise {
  id: string;
  sourceType: string;
  description: string;
  route?: string;
  tag: string;
  observedAt: string;
}

interface OneFixResult {
  action: {
    id: string;
    sourceType: string;
    sourceId: string;
    summary: string;
    suggestedFix: string;
    impactScore: number;
  };
  failure: MissionControlFailure;
}

interface LiveStreamEntry {
  id: string;
  timestamp: string;
  kind?: string;
  title: string;
  narrative: string;
  source: string;
  priority: "critical" | "high" | "medium" | "low";
}

interface LiveStreamPreview {
  generatedAt: string;
  summary: {
    truthNow: string;
    currentLeadCounty: string | null;
    currentLeadState: string | null;
    crawlerRequests24h: number;
    activeAlerts: number;
    sourceCounts: Record<string, number>;
  };
  stream: LiveStreamEntry[];
}

interface SnapshotStatusResponse {
  generatedAt?: string;
  schedulerEnabled: boolean;
  statuses: Array<{
    key: string;
    label: string;
    rowCount: number;
    latestComputedAt: string | null;
    staleAfterMinutes?: number;
    isStale: boolean;
  }>;
}

interface MissionControlDecision {
  id: string;
  recommendedFixSourceType: string;
  recommendedFixSourceId: string;
  action: "done" | "defer";
  deferReason: string | null;
  createdAt: string;
}

interface PreferredSourceMetrics {
  promptsShown: number;
  promptsAccepted: number;
  acceptanceRate: number;
}

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatWhen(value?: string | null) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString();
}

function relativeWhen(value?: string | null) {
  if (!value) return "No recent activity";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function priorityBadgeVariant(priority: LiveStreamEntry["priority"]) {
  switch (priority) {
    case "critical":
      return "error";
    case "high":
      return "warning";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function failureBadgeVariant(failure: MissionControlFailure) {
  if (failure.severity >= 4 || failure.impactScore >= 20) return "error";
  if (failure.severity >= 3 || failure.impactScore >= 10) return "warning";
  return "secondary";
}

export default function MissionControlV0() {
  const [, navigate] = useLocation();
  const [summary, setSummary] = useState<MissionControlSummary | null>(null);
  const [failures, setFailures] = useState<MissionControlFailure[]>([]);
  const [compromises, setCompromises] = useState<MissionControlCompromise[]>([]);
  const [scoutHealth, setScoutHealth] = useState("");
  const [oneFix, setOneFix] = useState<OneFixResult | null>(null);
  const [liveStream, setLiveStream] = useState<LiveStreamPreview | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatusResponse | null>(null);
  const [todayDecisions, setTodayDecisions] = useState<MissionControlDecision[]>([]);
  const [preferredSourceMetrics, setPreferredSourceMetrics] =
    useState<PreferredSourceMetrics | null>(null);
  const [deferReason, setDeferReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [
        summaryRes,
        failuresRes,
        compromisesRes,
        healthRes,
        oneFixRes,
        liveStreamRes,
        snapshotStatusRes,
        todayDecisionsRes,
        preferredSourceRes,
      ] = await Promise.all([
        fetch("/api/admin/mission-control/summary"),
        fetch("/api/admin/mission-control/failures"),
        fetch("/api/admin/mission-control/compromises"),
        fetch("/api/admin/mission-control/scout-health"),
        fetch("/api/admin/mission-control/one-fix"),
        fetch("/api/admin/observability/live-stream?limit=6"),
        fetch("/api/admin/observability/snapshot-status"),
        fetch("/api/admin/mission-control/today-decisions"),
        fetch("/api/admin/mission-control/preferred-source-metrics"),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (failuresRes.ok) setFailures(await failuresRes.json());
      if (compromisesRes.ok) setCompromises(await compromisesRes.json());
      if (healthRes.ok) {
        const health = await healthRes.json();
        setScoutHealth(health.summary);
      }
      if (oneFixRes.status === 200) {
        setOneFix(await oneFixRes.json());
      } else if (oneFixRes.status === 204) {
        setOneFix(null);
      }
      if (liveStreamRes.ok) setLiveStream(await liveStreamRes.json());
      if (snapshotStatusRes.ok) setSnapshotStatus(await snapshotStatusRes.json());
      if (todayDecisionsRes.ok) setTodayDecisions(await todayDecisionsRes.json());
      if (preferredSourceRes.ok) setPreferredSourceMetrics(await preferredSourceRes.json());
    } catch (error) {
      console.error("[MissionControl] Failed to fetch data", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const markDone = async () => {
    if (!oneFix) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/mission-control/one-fix/${oneFix.action.id}/done`, {
        method: "POST",
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("[MissionControl] Failed to mark action done", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markDefer = async () => {
    if (!oneFix || !deferReason.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/mission-control/one-fix/${oneFix.action.id}/defer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deferReason.trim() }),
      });
      if (response.ok) {
        setDeferReason("");
        await fetchData();
      }
    } catch (error) {
      console.error("[MissionControl] Failed to defer action", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const liveStreamSnapshot = snapshotStatus?.statuses?.find(
    (snapshot) => snapshot.key === "live_stream"
  );
  const staleSnapshots = snapshotStatus?.statuses?.filter((status) => status.isStale) ?? [];
  const topFailures = failures.slice(0, 5);
  const topCompromises = compromises.slice(0, 4);
  const liveEntries = liveStream?.stream ?? [];
  const hottestRoute = liveEntries.find((entry) => entry.kind === "crawler_route_demand");
  const hottestCounty = liveEntries.find((entry) => entry.kind === "crawler_county_demand");
  const leadCountyLabel =
    liveStream?.summary.currentLeadCounty && liveStream?.summary.currentLeadState
      ? `${liveStream.summary.currentLeadCounty}, ${liveStream.summary.currentLeadState}`
      : liveStream?.summary.currentLeadCounty || "No county lead yet";

  const connectionRate = useMemo(() => {
    if (!summary?.totalConnectionAttempts) return 0;
    return Math.round((summary.successfulConnections / summary.totalConnectionAttempts) * 100);
  }, [summary]);

  const focusHeadline = oneFix?.action.summary
    ? oneFix.action.summary
    : topFailures[0]?.what || "No urgent issue right now";
  const focusDetail = oneFix
    ? `${oneFix.failure.where} issue affecting ${oneFix.failure.who}`
    : topFailures[0]
      ? `${topFailures[0].why} on ${topFailures[0].where}`
      : "Everything looks stable. Open a tool directly if you want to inspect details.";

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-5 md:px-6">
      <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_40%),linear-gradient(180deg,rgba(8,10,19,0.98),rgba(8,10,19,0.92))] p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge variant="outline" className="border-white/15 bg-white/5 text-white/70">
              Admin Home
            </Badge>
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
                See what needs attention.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-white/65 md:text-base">
                This view highlights current issues, demand shifts, and the next best place to act.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:min-w-[380px]">
            <Button onClick={() => navigate("/admin/live-stream")} className="justify-between">
              Live Stream
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/cumulus-intelligence")}
              className="justify-between"
            >
              Cumulus
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/observability")}
              className="justify-between"
            >
              Observability
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/scout-resilience")}
              className="justify-between"
            >
              Scout Resilience
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden border-amber-400/20 bg-[linear-gradient(180deg,rgba(33,20,5,0.96),rgba(17,12,10,0.96))]">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={oneFix ? "warning" : "secondary"}>
                {oneFix ? "Act now" : "No forced fix"}
              </Badge>
              <Badge variant="outline" className="border-white/15 text-white/60">
                {summary?.last24hRange?.end
                  ? `Updated ${relativeWhen(summary.last24hRange.end)}`
                  : "Live"}
              </Badge>
            </div>
            <CardTitle className="text-2xl">{focusHeadline}</CardTitle>
            <CardDescription className="max-w-3xl text-white/65">{focusDetail}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                  Connection rate
                </div>
                <div className="mt-2 text-3xl font-semibold text-white">{connectionRate}%</div>
                <div className="mt-1 text-sm text-white/60">
                  {formatCount(summary?.successfulConnections)} successful out of{" "}
                  {formatCount(summary?.totalConnectionAttempts)} attempts.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                  Blocked paths
                </div>
                <div className="mt-2 text-3xl font-semibold text-white">
                  {formatCount(summary?.blockedConnections)}
                </div>
                <div className="mt-1 text-sm text-white/60">
                  Hard stops that kept Scout from finishing the job.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                  Confusing experiences
                </div>
                <div className="mt-2 text-3xl font-semibold text-white">
                  {formatCount(summary?.confusingExperiences)}
                </div>
                <div className="mt-1 text-sm text-white/60">
                  Copy or UI friction before contact could happen.
                </div>
              </div>
            </div>

            {oneFix ? (
              <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={failureBadgeVariant(oneFix.failure)}>
                      Impact {oneFix.action.impactScore}
                    </Badge>
                    <Badge variant="outline" className="border-white/15 text-white/70">
                      {oneFix.action.suggestedFix}
                    </Badge>
                    <Badge variant="outline" className="border-white/15 text-white/70">
                      {oneFix.failure.occurrences} occurrence
                      {oneFix.failure.occurrences === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">Who</div>
                      <div className="mt-2 text-sm text-white/80">{oneFix.failure.who}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">Where</div>
                      <div className="mt-2 text-sm text-white/80">
                        {oneFix.failure.where} via {oneFix.failure.fixLever}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                        Why it matters
                      </div>
                      <div className="mt-2 text-sm text-white/80">{oneFix.failure.why}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-sm font-medium text-white">Close the loop</div>
                  <div className="mt-2 text-sm text-white/60">
                    Resolve this or defer it with context so today&apos;s queue stays honest.
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={markDone} disabled={isSubmitting}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark done
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/admin/scout-resilience")}
                      className="border-white/15 text-white"
                    >
                      Open fix surface
                    </Button>
                  </div>
                  <Textarea
                    className="mt-4 min-h-[92px]"
                    placeholder="If you defer, say what needs to happen first."
                    value={deferReason}
                    onChange={(event) => setDeferReason(event.target.value)}
                  />
                  <Button
                    onClick={markDefer}
                    disabled={isSubmitting || !deferReason.trim()}
                    variant="outline"
                    className="mt-3 border-white/15 text-white"
                  >
                    <Clock3 className="mr-2 h-4 w-4" />
                    Defer with reason
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                No urgent issue is queued. Use the action list and demand panels below to choose
                your next task.
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-cyan-400/15 bg-[linear-gradient(180deg,rgba(6,27,35,0.98),rgba(10,16,24,0.98))]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-300" />
              <CardTitle>System snapshot</CardTitle>
            </div>
            <CardDescription>Key health signals in one quick view.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">Lead county</div>
                <div className="mt-2 text-lg font-semibold text-white">{leadCountyLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">Crawler 24h</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {formatCount(liveStream?.summary.crawlerRequests24h)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                  Active alerts
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {formatCount(liveStream?.summary.activeAlerts)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">Snapshot</div>
                <div className="mt-2 flex items-center gap-2 text-sm text-white">
                  <Badge variant={liveStreamSnapshot?.isStale ? "warning" : "outline"}>
                    {liveStreamSnapshot
                      ? liveStreamSnapshot.isStale
                        ? "stale"
                        : "fresh"
                      : "missing"}
                  </Badge>
                  <span className="text-white/65">
                    {relativeWhen(liveStreamSnapshot?.latestComputedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <ShieldAlert className="h-4 w-4 text-amber-300" />
                Snapshot drift
              </div>
              <div className="mt-2 text-sm text-white/65">
                {staleSnapshots.length > 0
                  ? `${staleSnapshots.length} snapshot${staleSnapshots.length === 1 ? "" : "s"} are stale and likely making the admin lie by omission.`
                  : "Snapshots are current enough that this page should reflect real stored state."}
              </div>
              <div className="mt-3 text-xs text-white/45">
                {liveStreamSnapshot?.latestComputedAt
                  ? `Last live snapshot: ${formatWhen(liveStreamSnapshot.latestComputedAt)}`
                  : "No live snapshot timestamp returned."}
              </div>
            </div>

            {preferredSourceMetrics ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Compass className="h-4 w-4 text-emerald-300" />
                  Preferred source adoption
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {formatCount(preferredSourceMetrics.promptsShown)}
                    </div>
                    <div className="text-white/50">Shown</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {formatCount(preferredSourceMetrics.promptsAccepted)}
                    </div>
                    <div className="text-white/50">Accepted</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {preferredSourceMetrics.acceptanceRate}%
                    </div>
                    <div className="text-white/50">Rate</div>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-cyan-300" />
              <CardTitle>Current demand</CardTitle>
            </div>
            <CardDescription>What the platform is being pulled toward right now.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">Truth now</div>
                <div className="mt-2 text-sm leading-6 text-white/80">
                  {liveStream?.summary.truthNow || "No live truth summary returned yet."}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                    Hottest route
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    {hottestRoute?.narrative || "No route demand signal surfaced yet."}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                    Hottest county
                  </div>
                  <div className="mt-2 text-sm text-white/80">
                    {hottestCounty?.narrative || "No county demand signal surfaced yet."}
                  </div>
                </div>
              </div>

              <ScrollArea className="h-[280px] rounded-2xl border border-white/10 bg-black/20">
                <div className="space-y-3 p-4">
                  {liveEntries.length > 0 ? (
                    liveEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={priorityBadgeVariant(entry.priority)}>
                            {entry.priority}
                          </Badge>
                          <Badge variant="outline" className="border-white/15 text-white/65">
                            {entry.source}
                          </Badge>
                          <span className="text-xs text-white/45">
                            {relativeWhen(entry.timestamp)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-medium text-white">{entry.title}</div>
                        <div className="mt-1 text-sm text-white/65">{entry.narrative}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">No live entries yet.</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-300" />
              <CardTitle>Action queue</CardTitle>
            </div>
            <CardDescription>The next failures worth opening a tool for.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[430px] rounded-2xl border border-white/10 bg-black/20">
              <div className="space-y-3 p-4">
                {topFailures.length > 0 ? (
                  topFailures.map((failure) => (
                    <div
                      key={failure.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={failureBadgeVariant(failure)}>
                          Impact {failure.impactScore}
                        </Badge>
                        <Badge variant="outline" className="border-white/15 text-white/65">
                          {failure.fixLever}
                        </Badge>
                        <span className="text-xs text-white/45">
                          {relativeWhen(failure.latestAt)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm font-medium text-white">{failure.what}</div>
                      <div className="mt-1 text-sm text-white/65">{failure.why}</div>
                      <div className="mt-3 flex items-center justify-between text-xs text-white/45">
                        <span>
                          {failure.where} • {failure.occurrences} hit
                          {failure.occurrences === 1 ? "" : "s"}
                        </span>
                        <span>{failure.who}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/60">
                    No failures detected in the last 24 hours.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <CardTitle>Today&apos;s decisions</CardTitle>
              </div>
              <CardDescription>What was completed, and what was deferred.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[180px] rounded-2xl border border-white/10 bg-black/20">
                <div className="space-y-3 p-4">
                  {todayDecisions.length > 0 ? (
                    todayDecisions.map((decision) => (
                      <div
                        key={decision.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={decision.action === "done" ? "success" : "warning"}>
                            {decision.action}
                          </Badge>
                          <span className="text-xs text-white/45">
                            {relativeWhen(decision.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-white/80">
                          {decision.recommendedFixSourceType}:{decision.recommendedFixSourceId}
                        </div>
                        {decision.deferReason ? (
                          <div className="mt-1 text-sm text-white/60">{decision.deferReason}</div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">No decisions logged yet today.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-300" />
                <CardTitle>Compromises and notes</CardTitle>
              </div>
              <CardDescription>Fast read on trust leaks, stubs, and Scout health.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                  Scout health
                </div>
                <div className="mt-2 text-sm leading-6 text-white/75">
                  {scoutHealth || "No Scout health summary returned."}
                </div>
              </div>

              <ScrollArea className="h-[210px] rounded-2xl border border-white/10 bg-black/20">
                <div className="space-y-3 p-4">
                  {topCompromises.length > 0 ? (
                    topCompromises.map((compromise) => (
                      <div
                        key={compromise.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-white/15 text-white/70">
                            {compromise.tag}
                          </Badge>
                          <span className="text-xs text-white/45">
                            {relativeWhen(compromise.observedAt)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-white/80">{compromise.description}</div>
                        {compromise.route ? (
                          <div className="mt-1 text-xs text-white/45">{compromise.route}</div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-white/60">No compromises detected.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
