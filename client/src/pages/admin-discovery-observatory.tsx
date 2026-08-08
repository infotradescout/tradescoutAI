import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Database, Search, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type FunnelStage = {
  stage: string;
  label: string;
  count: number;
  denominator: number;
  denominatorLabel: string;
  ratePercent: number | null;
  rateNumerator?: number;
  unknownUnavailable: number;
};

type ObservatorySnapshot = {
  generatedAt: string;
  window: { days: number; from: string; to: string };
  aggregation: { method: string; joinMultiplication: boolean };
  funnel: FunnelStage[];
  sourceStates: Array<{
    source: string;
    status: "current" | "unavailable";
    observedAt: string | null;
    ageSeconds: number | null;
    detail: string;
  }>;
  observations: Array<Record<string, any>>;
  operatingViews: {
    entrySourceHints: Array<Record<string, any>>;
    unclaimedDemand: Array<Record<string, any>>;
    entriesWithoutActions: Array<Record<string, any>>;
    repeatedOutsideSources: Array<Record<string, any>>;
    repeatedExplicitCompetitors: Array<Record<string, any>>;
    caveat: string;
  };
  zeroResultQueries: Array<{ query: string; count: number; lastObservedAt: string }>;
  livingQueries: Array<Record<string, any>>;
  classifications: Array<Record<string, any>>;
  marketPages: Array<Record<string, any>>;
  supportingTelemetry: { crawlerRequestCount: number | null; caveat: string };
  quality: {
    status: "pass" | "attention_required";
    checkedRecordCount: number;
    issues: Array<{ code: string; recordId: string; detail: string }>;
    guarantees: string[];
  };
  experiments: Array<Record<string, any>>;
};

function formatAge(seconds: number | null): string {
  if (seconds == null) return "unknown";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function isoForLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatEvidenceTimestamp(value: unknown, precision: unknown): string {
  const text = String(value || "");
  if (precision === "day") return `${text} (day precision)`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "unavailable" : parsed.toLocaleString();
}

export default function AdminDiscoveryObservatory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [windowDays, setWindowDays] = useState(30);
  const [form, setForm] = useState(() => ({
    source: "web_search",
    surface: "web_search",
    queryEvidenceState: "known",
    query: "",
    resultState: "observed",
    entitySlug: "",
    citedUrl: "",
    location: "",
    device: "",
    observedAt: isoForLocalInput(new Date()),
    observedAtPrecision: "instant",
    sourceFreshUntil: isoForLocalInput(new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)),
    sourceFreshUntilPrecision: "instant",
  }));

  const endpoint = `/api/admin/discovery-observatory?windowDays=${windowDays}`;
  const { data, isLoading, error } = useQuery<ObservatorySnapshot>({
    queryKey: ["/api/admin/discovery-observatory", windowDays],
    queryFn: () => apiRequest("GET", endpoint),
  });

  const captureMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/discovery-observatory/observations", {
        source: form.source,
        surface: form.surface,
        queryEvidenceState: form.queryEvidenceState,
        query: form.queryEvidenceState === "known" ? form.query : null,
        resultState: form.resultState,
        entity: { type: "business", slug: form.entitySlug },
        citedUrl: form.citedUrl || undefined,
        location: form.location || null,
        device: form.device || null,
        observedAt:
          form.observedAtPrecision === "day"
            ? form.observedAt
            : new Date(form.observedAt).toISOString(),
        observedAtPrecision: form.observedAtPrecision,
        sourceFreshUntil:
          form.sourceFreshUntilPrecision === "day"
            ? form.sourceFreshUntil
            : new Date(form.sourceFreshUntil).toISOString(),
        sourceFreshUntilPrecision: form.sourceFreshUntilPrecision,
        provenance: { method: "operator_manual", collector: "admin_observatory" },
      }),
    onSuccess: () => {
      toast({ title: "Observation recorded", description: "No causal inference was assigned." });
      setForm((value) => ({ ...value, query: "", citedUrl: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discovery-observatory"] });
    },
    onError: (captureError: any) => {
      toast({
        title: "Observation not recorded",
        description: captureError?.message || "Check required evidence and freshness fields.",
        variant: "destructive",
      });
    },
  });

  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of data?.classifications || []) {
      counts[String(row.classification)] = (counts[String(row.classification)] || 0) + 1;
    }
    return counts;
  }, [data?.classifications]);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-ts-orange" />
                Discovery Observatory
              </CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-[color:var(--text-secondary)]">
                Admin-only evidence for outside reach, TradeScout entry, deliberate request,
                provider response, and requester-confirmed outcome. Unknown evidence stays visible.
              </p>
            </div>
            <label className="text-xs text-[color:var(--text-secondary)]">
              Window
              <select
                className="ml-2 rounded border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-2 py-1 text-[color:var(--text-primary)]"
                value={windowDays}
                onChange={(event) => setWindowDays(Number(event.target.value))}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
              </select>
            </label>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm">Loading current evidence…</CardContent>
        </Card>
      ) : error || !data ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            Observatory data is unavailable. No missing source has been treated as zero.
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-labelledby="funnel-heading" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="funnel-heading" className="text-sm font-semibold">
                  Customer evidence chain
                </h2>
                <p className="text-xs text-[color:var(--text-secondary)]">
                  As of {new Date(data.generatedAt).toLocaleString()} · unique identifiers · no
                  fan-out joins
                </p>
              </div>
              <Badge variant="outline">
                {data.quality.status === "pass" ? "Data-quality checks pass" : "Quality attention"}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {data.funnel.map((stage) => (
                <Card
                  key={stage.stage}
                  className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
                >
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs font-medium text-[color:var(--text-secondary)]">
                      {stage.label}
                    </p>
                    <p className="text-2xl font-semibold">{stage.count}</p>
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      {stage.ratePercent == null ? "Rate unavailable" : `${stage.ratePercent}%`} ·
                      denominator {stage.denominator}: {stage.denominatorLabel}
                    </p>
                    <p className="text-xs text-amber-200">
                      Unknown/unavailable: {stage.unknownUnavailable}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardHeader>
                <CardTitle className="text-sm">Source freshness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.sourceStates.map((source) => (
                  <div
                    key={source.source}
                    className="rounded-lg border border-[color:var(--border-subtle)] p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{source.source}</span>
                      <Badge variant={source.status === "current" ? "outline" : "secondary"}>
                        {source.status} · age {formatAge(source.ageSeconds)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                      {source.detail}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardHeader>
                <CardTitle className="text-sm">Data-quality verifier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  {data.quality.status === "pass" ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  )}
                  {data.quality.checkedRecordCount} event records checked
                </div>
                <ul className="list-disc space-y-1 pl-5 text-xs text-[color:var(--text-secondary)]">
                  {data.quality.guarantees.map((guarantee) => (
                    <li key={guarantee}>{guarantee}</li>
                  ))}
                </ul>
                {data.quality.issues.map((issue) => (
                  <div
                    key={`${issue.recordId}-${issue.code}`}
                    className="rounded border border-amber-500/30 p-2 text-xs"
                  >
                    <span className="font-medium">{issue.code}</span>: {issue.detail} (
                    {issue.recordId})
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
            <CardHeader>
              <CardTitle className="text-sm">Operating gaps and transfer signals</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm lg:grid-cols-2 xl:grid-cols-5">
              <div>
                <h3 className="font-medium">Entry source hints</h3>
                <div className="mt-2 space-y-2">
                  {data.operatingViews.entrySourceHints.length === 0 && (
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      No entries in the current window.
                    </p>
                  )}
                  {data.operatingViews.entrySourceHints.map((row) => (
                    <div
                      key={`${row.sourceHint}-${row.referrerHost}`}
                      className="rounded border border-[color:var(--border-subtle)] p-2"
                    >
                      <p>{row.sourceHint || row.referrerHost || "Unavailable"}</p>
                      <p className="text-xs text-[color:var(--text-secondary)]">
                        {row.entryCount} distinct entries · landing hint only, not causal reach
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium">Unclaimed entities with demand</h3>
                <div className="mt-2 space-y-2">
                  {data.operatingViews.unclaimedDemand.length === 0 && (
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      None in the current window.
                    </p>
                  )}
                  {data.operatingViews.unclaimedDemand.map((row) => (
                    <div
                      key={row.entityId}
                      className="rounded border border-[color:var(--border-subtle)] p-2"
                    >
                      <p>{row.name}</p>
                      <p className="text-xs text-[color:var(--text-secondary)]">
                        {row.entryCount} distinct entries · {row.actionCount} distinct actions
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium">Entries with no action</h3>
                <div className="mt-2 space-y-2">
                  {data.operatingViews.entriesWithoutActions.length === 0 && (
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      None in the current window.
                    </p>
                  )}
                  {data.operatingViews.entriesWithoutActions.slice(0, 12).map((row) => (
                    <div
                      key={`${row.businessSlug}-${row.canonicalRoute}`}
                      className="rounded border border-[color:var(--border-subtle)] p-2"
                    >
                      <p className="truncate">{row.canonicalRoute}</p>
                      <p className="text-xs text-[color:var(--text-secondary)]">
                        {row.entryCount} distinct unmatched entries · {row.businessSlug}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium">Repeated outside sources</h3>
                <div className="mt-2 space-y-2">
                  {data.operatingViews.repeatedOutsideSources.length === 0 && (
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      No repeated source in this window.
                    </p>
                  )}
                  {data.operatingViews.repeatedOutsideSources.map((row) => (
                    <div
                      key={`${row.source}-${row.surface}-${row.observedHost}`}
                      className="rounded border border-[color:var(--border-subtle)] p-2"
                    >
                      <p>
                        {row.source} · {row.surface}
                      </p>
                      <p className="text-xs text-[color:var(--text-secondary)]">
                        {row.count} observations · host {row.observedHost || "unknown"} ·
                        relationship unknown
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-medium">Explicit repeated competitors</h3>
                <div className="mt-2 space-y-2">
                  {data.operatingViews.repeatedExplicitCompetitors.length === 0 && (
                    <p className="text-xs text-[color:var(--text-secondary)]">
                      None explicitly recorded.
                    </p>
                  )}
                  {data.operatingViews.repeatedExplicitCompetitors.map((row) => (
                    <div
                      key={row.name}
                      className="rounded border border-[color:var(--border-subtle)] p-2"
                    >
                      <p>{row.name}</p>
                      <p className="text-xs text-[color:var(--text-secondary)]">
                        {row.count} explicit competitor observations
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-amber-200">{data.operatingViews.caveat}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
            <CardHeader>
              <CardTitle className="text-sm">Record an outside observation</CardTitle>
              <p className="text-xs text-[color:var(--text-secondary)]">
                This writes through the same admin-only capture path. It does not change a public
                page or claim causation.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input
                value={form.entitySlug}
                onChange={(e) => setForm({ ...form, entitySlug: e.target.value })}
                placeholder="Business slug"
              />
              <Input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="Source"
              />
              <Input
                value={form.surface}
                onChange={(e) => setForm({ ...form, surface: e.target.value })}
                placeholder="Surface"
              />
              <select
                className="rounded border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3"
                value={form.resultState}
                onChange={(e) => setForm({ ...form, resultState: e.target.value })}
              >
                <option value="observed">Observed</option>
                <option value="not_observed">Not observed</option>
                <option value="unavailable">Unavailable</option>
              </select>
              <select
                className="rounded border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3"
                value={form.queryEvidenceState}
                onChange={(e) => setForm({ ...form, queryEvidenceState: e.target.value })}
              >
                <option value="known">Query known</option>
                <option value="unknown">Query unknown</option>
                <option value="unavailable">Query unavailable</option>
              </select>
              <Input
                disabled={form.queryEvidenceState !== "known"}
                value={form.query}
                onChange={(e) => setForm({ ...form, query: e.target.value })}
                placeholder="Exact query when known"
              />
              <Input
                value={form.citedUrl}
                onChange={(e) => setForm({ ...form, citedUrl: e.target.value })}
                placeholder="Cited URL (optional)"
              />
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Location or blank = unknown"
              />
              <Input
                value={form.device}
                onChange={(e) => setForm({ ...form, device: e.target.value })}
                placeholder="Device or blank = unknown"
              />
              <label className="text-xs text-[color:var(--text-secondary)]">
                Observed at
                <select
                  className="mb-1 w-full rounded border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2"
                  value={form.observedAtPrecision}
                  onChange={(e) => {
                    const precision = e.target.value;
                    setForm({
                      ...form,
                      observedAtPrecision: precision,
                      observedAt: precision === "day" ? form.observedAt.slice(0, 10) : "",
                    });
                  }}
                >
                  <option value="instant">Exact instant</option>
                  <option value="day">Day only</option>
                </select>
                <Input
                  type={form.observedAtPrecision === "day" ? "date" : "datetime-local"}
                  value={form.observedAt}
                  onChange={(e) => setForm({ ...form, observedAt: e.target.value })}
                />
              </label>
              <label className="text-xs text-[color:var(--text-secondary)]">
                Refresh by
                <select
                  className="mb-1 w-full rounded border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-3 py-2"
                  value={form.sourceFreshUntilPrecision}
                  onChange={(e) => {
                    const precision = e.target.value;
                    setForm({
                      ...form,
                      sourceFreshUntilPrecision: precision,
                      sourceFreshUntil:
                        precision === "day" ? form.sourceFreshUntil.slice(0, 10) : "",
                    });
                  }}
                >
                  <option value="instant">Exact instant</option>
                  <option value="day">Day only</option>
                </select>
                <Input
                  type={form.sourceFreshUntilPrecision === "day" ? "date" : "datetime-local"}
                  value={form.sourceFreshUntil}
                  onChange={(e) => setForm({ ...form, sourceFreshUntil: e.target.value })}
                />
              </label>
              <Button
                disabled={
                  captureMutation.isPending ||
                  !form.entitySlug ||
                  !form.observedAt ||
                  !form.sourceFreshUntil
                }
                onClick={() => captureMutation.mutate()}
              >
                Record observation
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardHeader>
                <CardTitle className="text-sm">Current outside observations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.observations.length === 0 && (
                  <p className="text-[color:var(--text-secondary)]">
                    No current database observations in this window.
                  </p>
                )}
                {data.observations.slice(0, 20).map((row) => (
                  <div
                    key={row.id || row.observationId}
                    className="rounded border border-[color:var(--border-subtle)] p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>
                        {row.queryEvidenceState === "known"
                          ? row.query
                          : `Query ${row.queryEvidenceState}`}
                      </span>
                      <Badge variant="outline">{row.resultState}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                      {row.source} · {row.surface} · age {formatAge(row.ageSeconds)} ·{" "}
                      {row.freshnessState} · observed{" "}
                      {formatEvidenceTimestamp(row.observedAt, row.observedAtPrecision)} · refresh
                      by{" "}
                      {formatEvidenceTimestamp(row.sourceFreshUntil, row.sourceFreshUntilPrecision)}
                    </p>
                    <p className="mt-1 text-xs text-amber-200">
                      Location: {row.location || "unknown"} · Device: {row.device || "unknown"} ·
                      Causation: none
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                      Entity: {row.entity?.slug || row.entity?.id || "unavailable"} · cited page:{" "}
                      {row.citedUrl || "not observed or unavailable"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardHeader>
                <CardTitle className="text-sm">Real internal zero-result language</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.zeroResultQueries.length === 0 && (
                  <p className="text-[color:var(--text-secondary)]">
                    No current privacy-safe zero-result query evidence.
                  </p>
                )}
                {data.zeroResultQueries.slice(0, 20).map((row) => (
                  <div
                    key={row.query}
                    className="flex justify-between gap-3 rounded border border-[color:var(--border-subtle)] p-3"
                  >
                    <span>{row.query}</span>
                    <Badge variant="secondary">{row.count} zero result</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
            <CardHeader>
              <CardTitle className="text-sm">Living query collection</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {data.livingQueries.slice(0, 60).map((row) => (
                <div
                  key={row.query}
                  className="rounded border border-[color:var(--border-subtle)] p-3 text-sm"
                >
                  <div className="flex gap-2">
                    <Search className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{row.query}</span>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    {row.source} · {row.intent}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardHeader>
                <CardTitle className="text-sm">Public-surface classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(classCounts).map(([key, count]) => (
                    <Badge key={key} variant="outline">
                      {key}: {count}
                    </Badge>
                  ))}
                </div>
                {data.classifications.slice(0, 30).map((row) => (
                  <div
                    key={`${row.entityType}-${row.entityId}`}
                    className="rounded border border-[color:var(--border-subtle)] p-3"
                  >
                    <div className="flex justify-between gap-2">
                      <span>{row.name}</span>
                      <Badge variant="secondary">{row.classification}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{row.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <CardHeader>
                <CardTitle className="text-sm">Ranked owner-review experiment queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {data.experiments.map((experiment) => (
                  <details
                    key={experiment.experimentId}
                    className="rounded border border-[color:var(--border-subtle)] p-3"
                  >
                    <summary className="cursor-pointer font-medium">
                      #{experiment.rank} · score {experiment.score} · {experiment.exactQuestion}
                    </summary>
                    <div className="mt-3 space-y-2 text-xs text-[color:var(--text-secondary)]">
                      <p>
                        <Badge variant="outline">{experiment.currentState}</Badge> ·{" "}
                        {experiment.assignmentCount} stored assignment(s) · decision{" "}
                        {experiment.latestOwnerDecisionRef || "unavailable"}
                      </p>
                      <p>
                        <span className="text-[color:var(--text-primary)]">
                          Current evidence baseline:
                        </span>{" "}
                        {experiment.currentBaseline}
                      </p>
                      <p>
                        <span className="text-[color:var(--text-primary)]">One change:</span>{" "}
                        {experiment.oneControlledChange}
                      </p>
                      <p>
                        <span className="text-[color:var(--text-primary)]">
                          Intended customer action:
                        </span>{" "}
                        {experiment.intendedCustomerAction}
                      </p>
                      <p>
                        <span className="text-[color:var(--text-primary)]">Owner action:</span>{" "}
                        {experiment.ownerAction}
                      </p>
                      <p>
                        <span className="text-[color:var(--text-primary)]">Period:</span>{" "}
                        {experiment.period}
                      </p>
                      <p>
                        <span className="text-[color:var(--text-primary)]">Success:</span>{" "}
                        {experiment.success}
                      </p>
                      <p>
                        <span className="text-[color:var(--text-primary)]">Failure:</span>{" "}
                        {experiment.failure}
                      </p>
                      <p>
                        <span className="text-[color:var(--text-primary)]">Rollback:</span>{" "}
                        {experiment.rollback}
                      </p>
                      <p className="text-amber-200">
                        Evidence boundary: {experiment.evidenceBoundary}
                      </p>
                      <Badge variant="outline">Proposed only · predeclare before counting</Badge>
                    </div>
                  </details>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4" />
                Supporting crawler telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-2xl font-semibold">
                {data.supportingTelemetry.crawlerRequestCount ?? "Unknown"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                {data.supportingTelemetry.caveat}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
