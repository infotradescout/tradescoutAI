import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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
  stream: Array<{
    id: string;
    timestamp: string;
    kind?: string;
    title: string;
    narrative: string;
    source: string;
    priority: "critical" | "high" | "medium" | "low";
  }>;
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

export default function MissionControlV0() {
  const [, navigate] = useLocation();
  const [summary, setSummary] = useState<MissionControlSummary | null>(null);
  const [failures, setFailures] = useState<MissionControlFailure[]>([]);
  const [compromises, setCompromises] = useState<MissionControlCompromise[]>([]);
  const [scoutHealth, setScoutHealth] = useState<string>("");
  const [oneFix, setOneFix] = useState<OneFixResult | null>(null);
  const [liveStream, setLiveStream] = useState<LiveStreamPreview | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatusResponse | null>(null);
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
      ] = await Promise.all([
        fetch("/api/admin/mission-control/summary"),
        fetch("/api/admin/mission-control/failures"),
        fetch("/api/admin/mission-control/compromises"),
        fetch("/api/admin/mission-control/scout-health"),
        fetch("/api/admin/mission-control/one-fix"),
        fetch("/api/admin/observability/live-stream?limit=3"),
        fetch("/api/admin/observability/snapshot-status"),
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
      if (liveStreamRes.ok) {
        setLiveStream(await liveStreamRes.json());
      }
      if (snapshotStatusRes.ok) {
        setSnapshotStatus(await snapshotStatusRes.json());
      }
    } catch (err) {
      console.error("[MissionControl] Failed to fetch data", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const markDone = async () => {
    if (!oneFix) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/mission-control/one-fix/${oneFix.action.id}/done`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("[MissionControl] Failed to mark done", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const markDefer = async () => {
    if (!oneFix || !deferReason.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/mission-control/one-fix/${oneFix.action.id}/defer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deferReason.trim() }),
      });
      if (res.ok) {
        setDeferReason("");
        await fetchData();
      }
    } catch (err) {
      console.error("[MissionControl] Failed to defer", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const liveStreamSnapshot = snapshotStatus?.statuses?.find(
    (snapshot) => snapshot.key === "live_stream"
  );
  const liveEvidenceCount = liveStream?.stream?.length ?? 0;
  const topRouteDemand = (liveStream?.stream || []).find(
    (entry) => entry.kind === "crawler_route_demand"
  );
  const topCountyDemand = (liveStream?.stream || []).find(
    (entry) => entry.kind === "crawler_county_demand"
  );
  const topBotDemand = (liveStream?.stream || []).find(
    (entry) => entry.kind === "bot_demand_cluster"
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Mission Control</h1>
        <p className="text-muted-foreground">
          Admin launch surface for live system truth, observability, and partner intelligence.
        </p>
      </div>

      <Card className="p-6 border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Live System Evidence</h2>
            <p className="text-sm text-muted-foreground">
              This is the quickest proof that the stream is producing data now.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/admin/live-stream")}>Open Live Stream</Button>
            <Button variant="outline" onClick={() => navigate("/admin/observability")}>
              Open Observability
            </Button>
            <Button variant="outline" onClick={() => navigate("/admin/cumulus-intelligence")}>
              Open Cumulus Intelligence
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Truth Now</div>
            <div className="mt-2 text-sm text-white/85">
              {liveStream?.summary.truthNow || "No live stream truth available yet."}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Entries</div>
            <div className="mt-2 text-2xl font-semibold text-white">{liveEvidenceCount}</div>
            <div className="text-xs text-white/50">Current server-produced stream entries</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Crawler 24h</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              {liveStream?.summary.crawlerRequests24h ?? 0}
            </div>
            <div className="text-xs text-white/50">Observation volume feeding the stream</div>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Snapshot State</div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline">
                {liveStreamSnapshot ? (liveStreamSnapshot.isStale ? "stale" : "fresh") : "missing"}
              </Badge>
              <span className="text-sm text-white/80">
                {liveStreamSnapshot?.latestComputedAt
                  ? new Date(liveStreamSnapshot.latestComputedAt).toLocaleString()
                  : "No snapshot timestamp"}
              </span>
            </div>
            <div className="mt-1 text-xs text-white/50">Entries shown: {liveEvidenceCount}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">Top Demand Page</div>
            <div className="mt-2 text-sm text-white/85">
              {topRouteDemand?.narrative || "No route demand signal yet."}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/40">
              Top Demand County
            </div>
            <div className="mt-2 text-sm text-white/85">
              {topCountyDemand?.narrative || "No county demand signal yet."}
            </div>
          </div>
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">
              Bot Demand Cluster
            </div>
            <div className="mt-2 text-sm text-cyan-50">
              {topBotDemand?.narrative || "No bot demand cluster yet."}
            </div>
          </div>
        </div>

        {liveStream?.stream?.length ? (
          <div className="mt-5 space-y-3">
            {liveStream.stream.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{entry.source}</Badge>
                  <Badge variant="outline">{entry.priority}</Badge>
                  <span className="text-xs text-white/50">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 font-medium text-white">{entry.title}</div>
                <div className="mt-1 text-sm text-white/70">{entry.narrative}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            No live stream entries are visible from admin home yet. Open Live Stream directly and
            refresh if needed.
          </div>
        )}
      </Card>

      {summary && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Today's Reality</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{summary.totalConnectionAttempts}</div>
              <div className="text-sm text-muted-foreground">Connection Attempts</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {summary.successfulConnections}
              </div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{summary.blockedConnections}</div>
              <div className="text-sm text-muted-foreground">Blocked</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {summary.confusingExperiences}
              </div>
              <div className="text-sm text-muted-foreground">Confusing</div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 border-2 border-primary">
        <h2 className="text-xl font-semibold mb-4">One Fix That Matters Today</h2>
        {oneFix ? (
          <div className="space-y-4">
            <div>
              <Badge variant="outline" className="mb-2">
                Impact: {oneFix.action.impactScore}
              </Badge>
              <Badge variant="outline" className="ml-2">
                Fix: {oneFix.action.suggestedFix}
              </Badge>
              <h3 className="text-lg font-semibold mt-2">{oneFix.action.summary}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {oneFix.failure.who} | {oneFix.failure.where} | {oneFix.failure.why}
              </p>
              <p className="text-sm mt-2">
                {oneFix.failure.occurrences} occurrence{oneFix.failure.occurrences > 1 ? "s" : ""} |
                Severity {oneFix.failure.severity}/5
              </p>
            </div>

            <div className="flex gap-4 items-end">
              <Button onClick={markDone} disabled={isSubmitting} variant="default">
                Mark Done
              </Button>
              <div className="flex-1">
                <Textarea
                  placeholder="Why defer? (required)"
                  value={deferReason}
                  onChange={(e) => setDeferReason(e.target.value)}
                  rows={2}
                />
                <Button
                  onClick={markDefer}
                  disabled={isSubmitting || !deferReason.trim()}
                  variant="outline"
                  className="mt-2"
                >
                  Defer
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No fixes needed right now. Check back tomorrow.</p>
        )}
      </Card>

      {scoutHealth && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Scout Health</h2>
          <p className="text-sm">{scoutHealth}</p>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Connection Failures (Last 24h)</h2>
        {failures.length > 0 ? (
          <div className="space-y-2">
            {failures.slice(0, 10).map((failure) => (
              <div key={failure.id} className="border-l-4 border-red-500 pl-4 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant="error">{failure.impactScore}</Badge>
                  <span className="font-semibold">{failure.what}</span>
                  <Badge variant="outline">{failure.fixLever}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {failure.who} | {failure.where} | {failure.why} | {failure.occurrences}x
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No failures detected.</p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Compromises Detected</h2>
        {compromises.length > 0 ? (
          <div className="space-y-2">
            {compromises.map((compromise) => (
              <div key={compromise.id} className="flex items-start gap-2 py-2">
                <Badge variant="outline">{compromise.tag}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{compromise.description}</p>
                  {compromise.route && (
                    <p className="text-xs text-muted-foreground">{compromise.route}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No compromises detected.</p>
        )}
      </Card>
    </div>
  );
}
