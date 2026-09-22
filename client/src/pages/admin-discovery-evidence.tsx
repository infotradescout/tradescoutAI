import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Database,
  RefreshCw,
  Search,
  ShieldCheck,
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
import { Input } from "@/components/ui/input";
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

type ObservationForm = {
  source: string;
  surface: string;
  queryEvidenceState: string;
  query: string;
  resultState: string;
  entitySlug: string;
  citedUrl: string;
  location: string;
  device: string;
  observedAt: string;
  observedAtPrecision: string;
  sourceFreshUntil: string;
  sourceFreshUntilPrecision: string;
};

function formatAge(seconds: number | null | undefined): string {
  if (seconds == null) return "Unknown";
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
  if (!text) return "Unavailable";
  if (precision === "day") return `${text} (day precision)`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "Unavailable" : parsed.toLocaleString();
}

function readable(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "Not recorded";
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceBadge(status: string) {
  return status === "current" ? (
    <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
      Current
    </Badge>
  ) : (
    <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
      Unavailable
    </Badge>
  );
}

function ObservationField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-white/42">
      <span>{label}</span>
      {children}
    </label>
  );
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export default function AdminDiscoveryObservatory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [windowDays, setWindowDays] = useState("30");
  const [form, setForm] = useState<ObservationForm>(() => ({
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

  const observatoryQuery = useQuery<ObservatorySnapshot>({
    queryKey: ["/api/admin/discovery-observatory", windowDays],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/admin/discovery-observatory?windowDays=${encodeURIComponent(windowDays)}`
      ) as Promise<ObservatorySnapshot>,
    retry: false,
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
      toast({
        title: "Observation recorded",
        description: "The evidence was stored without assigning causal credit.",
      });
      setForm((current) => ({ ...current, query: "", citedUrl: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/discovery-observatory"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Observation not recorded",
        description: formatUserFacingErrorMessage(
          error,
          "Check the required evidence and freshness fields."
        ),
        variant: "destructive",
      });
    },
  });

  const data = observatoryQuery.data;
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of data?.classifications || []) {
      const key = String(row.classification || "unclassified");
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [data?.classifications]);

  const currentSources = data?.sourceStates.filter((source) => source.status === "current").length || 0;
  const unknownFunnelRecords =
    data?.funnel.reduce((total, stage) => total + Number(stage.unknownUnavailable || 0), 0) || 0;
  const firstStage = data?.funnel[0];
  const lastStage = data?.funnel[data.funnel.length - 1];

  return (
    <AdminWorkspace data-testid="admin-discovery-observatory-v2">
      <AdminSection
        title="Discovery observatory"
        description="Evidence for outside reach, TradeScout entry, deliberate requests, provider response, and requester-confirmed outcomes. Unknown evidence stays visible and is never converted into causal credit."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => observatoryQuery.refetch()}
            disabled={observatoryQuery.isFetching}
            className="border-white/12 bg-transparent text-white/65"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${observatoryQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: firstStage?.label || "Entry evidence",
              value: observatoryQuery.isError ? "—" : firstStage?.count ?? 0,
              detail: firstStage
                ? `${firstStage.unknownUnavailable} unknown or unavailable`
                : "No funnel stage returned",
              tone: observatoryQuery.isError ? "warning" : "neutral",
            },
            {
              label: lastStage?.label || "Confirmed outcome",
              value: observatoryQuery.isError ? "—" : lastStage?.count ?? 0,
              detail:
                lastStage?.ratePercent == null
                  ? "Rate unavailable"
                  : `${lastStage.ratePercent}% of ${lastStage.denominatorLabel}`,
              tone: observatoryQuery.isError ? "warning" : "good",
            },
            {
              label: "Current evidence sources",
              value: observatoryQuery.isError ? "—" : currentSources,
              detail: `${data?.sourceStates.length || 0} total source states`,
              tone:
                observatoryQuery.isError || currentSources < Number(data?.sourceStates.length || 0)
                  ? "warning"
                  : "good",
            },
            {
              label: "Unknown funnel records",
              value: observatoryQuery.isError ? "—" : unknownFunnelRecords,
              detail: observatoryQuery.isError
                ? "Observatory unavailable"
                : `${data?.quality.issues.length || 0} quality issues`,
              tone:
                observatoryQuery.isError ||
                unknownFunnelRecords > 0 ||
                Number(data?.quality.issues.length || 0) > 0
                  ? "warning"
                  : "good",
            },
          ]}
        />
      </AdminSection>

      {observatoryQuery.isLoading ? (
        <div className="flex min-h-52 items-center justify-center border-y border-white/10 text-sm text-white/45">
          <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
          Loading discovery evidence…
        </div>
      ) : observatoryQuery.isError || !data ? (
        <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Observatory data is unavailable. No missing source was treated as zero.
        </div>
      ) : (
        <Tabs defaultValue="chain" className="space-y-6">
          <AdminWorkspaceSubnav>
            <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
              {[
                ["chain", "Evidence Chain"],
                ["gaps", "Operating Gaps"],
                ["observations", "Observations"],
                ["queries", "Queries & Surfaces"],
                ["experiments", "Experiments"],
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

          <TabsContent value="chain" className="mt-0 space-y-7">
            <AdminSection
              title="Customer evidence chain"
              description={`Generated ${new Date(data.generatedAt).toLocaleString()} · ${data.aggregation.method} · join multiplication ${data.aggregation.joinMultiplication ? "detected" : "not detected"}.`}
              className="pt-0"
              actions={
                <Select value={windowDays} onValueChange={setWindowDays}>
                  <SelectTrigger className="w-[10rem] border-white/10 bg-black/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                  </SelectContent>
                </Select>
              }
            >
              {data.funnel.length ? (
                <AdminList>
                  {data.funnel.map((stage, index) => (
                    <div
                      key={stage.stage}
                      className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[3rem_minmax(12rem,1fr)_minmax(8rem,0.45fr)_minmax(12rem,0.7fr)_minmax(9rem,0.45fr)] lg:items-center"
                    >
                      <span className="font-mono text-sm text-white/28">{index + 1}</span>
                      <div>
                        <p className="font-semibold text-white">{stage.label}</p>
                        <p className="mt-1 font-mono text-xs text-white/30">{stage.stage}</p>
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-white">{stage.count}</p>
                        <p className="text-xs text-white/35">records</p>
                      </div>
                      <div className="text-sm text-white/55">
                        <p>
                          {stage.ratePercent == null ? "Rate unavailable" : `${stage.ratePercent}%`}
                        </p>
                        <p className="mt-1 text-xs text-white/35">
                          denominator {stage.denominator}: {stage.denominatorLabel}
                        </p>
                      </div>
                      <div className="text-sm text-amber-100">
                        {stage.unknownUnavailable} unknown
                      </div>
                    </div>
                  ))}
                </AdminList>
              ) : (
                <AdminEmptyState
                  title="No funnel evidence"
                  description="The observatory returned no evidence-chain stages for this window."
                />
              )}
            </AdminSection>

            <div className="grid gap-7 xl:grid-cols-2">
              <AdminSection
                title="Source freshness"
                description="Current source age and availability."
                className="pt-0"
              >
                {data.sourceStates.length ? (
                  <AdminList>
                    {data.sourceStates.map((source) => (
                      <div
                        key={source.source}
                        className="grid gap-3 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(10rem,0.7fr)_auto_minmax(0,1fr)] lg:items-center"
                      >
                        <div>
                          <p className="font-semibold text-white">{readable(source.source)}</p>
                          <p className="mt-1 text-xs text-white/35">
                            observed {formatEvidenceTimestamp(source.observedAt, "instant")}
                          </p>
                        </div>
                        <div>
                          {evidenceBadge(source.status)}
                          <p className="mt-1 text-xs text-white/35">age {formatAge(source.ageSeconds)}</p>
                        </div>
                        <p className="text-sm leading-6 text-white/52">{source.detail}</p>
                      </div>
                    ))}
                  </AdminList>
                ) : (
                  <AdminEmptyState
                    title="No source-state evidence"
                    description="No source freshness records were returned."
                  />
                )}
              </AdminSection>

              <AdminSection
                title="Data-quality verifier"
                description={`${data.quality.checkedRecordCount} event records checked.`}
                className="pt-0"
              >
                <div className="flex items-center gap-3 border-y border-white/10 px-3 py-4 text-sm text-white/62 sm:px-4">
                  {data.quality.status === "pass" ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-200" />
                  )}
                  {data.quality.status === "pass"
                    ? "Quality checks pass"
                    : "Quality attention required"}
                </div>
                <AdminList className="mt-4">
                  {data.quality.guarantees.map((guarantee) => (
                    <div key={guarantee} className="px-3 py-3 text-sm text-white/55 sm:px-4">
                      {guarantee}
                    </div>
                  ))}
                </AdminList>
                {data.quality.issues.length ? (
                  <div className="mt-4 space-y-2">
                    {data.quality.issues.map((issue) => (
                      <div
                        key={`${issue.recordId}-${issue.code}`}
                        className="border-l-2 border-amber-400 bg-amber-400/5 px-3 py-3 text-sm text-amber-100"
                      >
                        <p className="font-semibold">{readable(issue.code)}</p>
                        <p className="mt-1 text-amber-100/70">{issue.detail}</p>
                        <p className="mt-1 font-mono text-xs text-amber-100/45">{issue.recordId}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </AdminSection>
            </div>
          </TabsContent>

          <TabsContent value="gaps" className="mt-0">
            <AdminSection
              title="Operating gaps and transfer signals"
              description="Observed demand and action gaps. Source hints remain hints, not causal attribution."
              className="pt-0"
            >
              <div className="grid gap-7 xl:grid-cols-2">
                <OperatingGroup
                  title="Entry source hints"
                  empty="No entries in the current window."
                  rows={data.operatingViews.entrySourceHints}
                  render={(row) => ({
                    key: `${row.sourceHint}-${row.referrerHost}`,
                    title: row.sourceHint || row.referrerHost || "Unavailable",
                    detail: `${row.entryCount} distinct entries · landing hint only`,
                  })}
                />
                <OperatingGroup
                  title="Unclaimed entities with demand"
                  empty="No unclaimed entity demand in this window."
                  rows={data.operatingViews.unclaimedDemand}
                  render={(row) => ({
                    key: row.entityId,
                    title: row.name || row.entityId,
                    detail: `${row.entryCount} distinct entries · ${row.actionCount} distinct actions`,
                  })}
                />
                <OperatingGroup
                  title="Entries with no action"
                  empty="No entry-without-action records in this window."
                  rows={data.operatingViews.entriesWithoutActions.slice(0, 20)}
                  render={(row) => ({
                    key: `${row.businessSlug}-${row.canonicalRoute}`,
                    title: row.canonicalRoute || row.businessSlug,
                    detail: `${row.entryCount} unmatched entries · ${row.businessSlug}`,
                  })}
                />
                <OperatingGroup
                  title="Repeated outside sources"
                  empty="No repeated outside source in this window."
                  rows={data.operatingViews.repeatedOutsideSources}
                  render={(row) => ({
                    key: `${row.source}-${row.surface}-${row.observedHost}`,
                    title: `${row.source || "Unknown source"} · ${row.surface || "Unknown surface"}`,
                    detail: `${row.count} observations · host ${row.observedHost || "unknown"}`,
                  })}
                />
                <OperatingGroup
                  title="Explicit repeated competitors"
                  empty="No explicit repeated competitor evidence."
                  rows={data.operatingViews.repeatedExplicitCompetitors}
                  render={(row) => ({
                    key: row.name,
                    title: row.name,
                    detail: `${row.count} explicit competitor observations`,
                  })}
                />
              </div>
              <div className="mt-6 border-y border-amber-400/20 bg-amber-400/5 px-4 py-4 text-sm text-amber-100">
                {data.operatingViews.caveat}
              </div>
            </AdminSection>
          </TabsContent>

          <TabsContent value="observations" className="mt-0 space-y-7">
            <AdminSection
              title="Record an outside observation"
              description="This writes through the existing admin-only capture path. It does not alter a public page or assign causation."
              className="pt-0"
            >
              <div className="grid gap-3 border-y border-white/10 px-3 py-4 sm:px-4 md:grid-cols-2 xl:grid-cols-4">
                <ObservationField label="Business slug">
                  <Input
                    value={form.entitySlug}
                    onChange={(event) => setForm({ ...form, entitySlug: event.target.value })}
                    placeholder="business-slug"
                    className="border-white/10 bg-black/20 text-white"
                  />
                </ObservationField>
                <ObservationField label="Source">
                  <Input
                    value={form.source}
                    onChange={(event) => setForm({ ...form, source: event.target.value })}
                    placeholder="web_search"
                    className="border-white/10 bg-black/20 text-white"
                  />
                </ObservationField>
                <ObservationField label="Surface">
                  <Input
                    value={form.surface}
                    onChange={(event) => setForm({ ...form, surface: event.target.value })}
                    placeholder="web_search"
                    className="border-white/10 bg-black/20 text-white"
                  />
                </ObservationField>
                <ObservationField label="Result state">
                  <Select
                    value={form.resultState}
                    onValueChange={(value) => setForm({ ...form, resultState: value })}
                  >
                    <SelectTrigger className="border-white/10 bg-black/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="observed">Observed</SelectItem>
                      <SelectItem value="not_observed">Not observed</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </ObservationField>
                <ObservationField label="Query evidence">
                  <Select
                    value={form.queryEvidenceState}
                    onValueChange={(value) => setForm({ ...form, queryEvidenceState: value })}
                  >
                    <SelectTrigger className="border-white/10 bg-black/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="known">Known</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </ObservationField>
                <ObservationField label="Exact query">
                  <Input
                    disabled={form.queryEvidenceState !== "known"}
                    value={form.query}
                    onChange={(event) => setForm({ ...form, query: event.target.value })}
                    placeholder="Exact query when known"
                    className="border-white/10 bg-black/20 text-white"
                  />
                </ObservationField>
                <ObservationField label="Cited URL">
                  <Input
                    value={form.citedUrl}
                    onChange={(event) => setForm({ ...form, citedUrl: event.target.value })}
                    placeholder="Optional"
                    className="border-white/10 bg-black/20 text-white"
                  />
                </ObservationField>
                <ObservationField label="Location">
                  <Input
                    value={form.location}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    placeholder="Blank means unknown"
                    className="border-white/10 bg-black/20 text-white"
                  />
                </ObservationField>
                <ObservationField label="Device">
                  <Input
                    value={form.device}
                    onChange={(event) => setForm({ ...form, device: event.target.value })}
                    placeholder="Blank means unknown"
                    className="border-white/10 bg-black/20 text-white"
                  />
                </ObservationField>
                <ObservationField label="Observed precision">
                  <Select
                    value={form.observedAtPrecision}
                    onValueChange={(precision) =>
                      setForm({
                        ...form,
                        observedAtPrecision: precision,
                        observedAt:
                          precision === "day"
                            ? form.observedAt.slice(0, 10)
                            : isoForLocalInput(new Date()),
                      })
                    }
                  >
                    <SelectTrigger className="border-white/10 bg-black/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Exact instant</SelectItem>
                      <SelectItem value="day">Day only</SelectItem>
                    </SelectContent>
                  </Select>
                </ObservationField>
                <ObservationField label="Observed at">
                  <Input
                    type={form.observedAtPrecision === "day" ? "date" : "datetime-local"}
                    value={form.observedAt}
                    onChange={(event) => setForm({ ...form, observedAt: event.target.value })}
                    className="border-white/10 bg-black/20 text-white"
                  />
                </ObservationField>
                <ObservationField label="Freshness precision">
                  <Select
                    value={form.sourceFreshUntilPrecision}
                    onValueChange={(precision) =>
                      setForm({
                        ...form,
                        sourceFreshUntilPrecision: precision,
                        sourceFreshUntil:
                          precision === "day"
                            ? form.sourceFreshUntil.slice(0, 10)
                            : isoForLocalInput(
                                new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
                              ),
                      })
                    }
                  >
                    <SelectTrigger className="border-white/10 bg-black/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instant">Exact instant</SelectItem>
                      <SelectItem value="day">Day only</SelectItem>
                    </SelectContent>
                  </Select>
                </ObservationField>
                <ObservationField label="Refresh by">
                  <Input
                    type={
                      form.sourceFreshUntilPrecision === "day" ? "date" : "datetime-local"
                    }
                    value={form.sourceFreshUntil}
                    onChange={(event) =>
                      setForm({ ...form, sourceFreshUntil: event.target.value })
                    }
                    className="border-white/10 bg-black/20 text-white"
                  />
                </ObservationField>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={() => captureMutation.mutate()}
                    disabled={
                      captureMutation.isPending ||
                      !form.entitySlug.trim() ||
                      !form.observedAt ||
                      !form.sourceFreshUntil
                    }
                    className="w-full bg-orange-500 text-black hover:bg-orange-400"
                  >
                    {captureMutation.isPending ? "Recording…" : "Record observation"}
                  </Button>
                </div>
              </div>
            </AdminSection>

            <AdminSection
              title="Current outside observations"
              description={`${data.observations.length} current database observation${data.observations.length === 1 ? "" : "s"} in this window.`}
              className="pt-0"
            >
              {data.observations.length ? (
                <AdminList>
                  {data.observations.slice(0, 50).map((row, index) => (
                    <details key={row.id || row.observationId || index} className="group">
                      <summary className="grid cursor-pointer list-none gap-3 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(9rem,0.4fr)_minmax(10rem,0.5fr)] lg:items-center [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {row.queryEvidenceState === "known"
                              ? row.query || "Known query not recorded"
                              : `Query ${row.queryEvidenceState || "unknown"}`}
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            {readable(row.source)} · {readable(row.surface)}
                          </p>
                        </div>
                        <Badge className="border-white/15 bg-white/5 text-white/55">
                          {readable(row.resultState)}
                        </Badge>
                        <span className="text-xs text-white/38">
                          age {formatAge(row.ageSeconds)} · {readable(row.freshnessState)}
                        </span>
                      </summary>
                      <div className="grid gap-4 border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4 md:grid-cols-2 xl:grid-cols-3">
                        <DetailBlock
                          label="Observed"
                          value={formatEvidenceTimestamp(
                            row.observedAt,
                            row.observedAtPrecision
                          )}
                        />
                        <DetailBlock
                          label="Refresh by"
                          value={formatEvidenceTimestamp(
                            row.sourceFreshUntil,
                            row.sourceFreshUntilPrecision
                          )}
                        />
                        <DetailBlock
                          label="Entity"
                          value={row.entity?.slug || row.entity?.id || "Unavailable"}
                        />
                        <DetailBlock label="Location" value={row.location || "Unknown"} />
                        <DetailBlock label="Device" value={row.device || "Unknown"} />
                        <DetailBlock
                          label="Cited page"
                          value={row.citedUrl || "Not observed or unavailable"}
                        />
                      </div>
                    </details>
                  ))}
                </AdminList>
              ) : (
                <AdminEmptyState
                  title="No outside observations"
                  description="No current database observations exist for this window."
                />
              )}
            </AdminSection>
          </TabsContent>

          <TabsContent value="queries" className="mt-0 space-y-7">
            <div className="grid gap-7 xl:grid-cols-2">
              <AdminSection
                title="Zero-result language"
                description="Privacy-safe internal queries that returned no result."
                className="pt-0"
              >
                {data.zeroResultQueries.length ? (
                  <AdminList>
                    {data.zeroResultQueries.slice(0, 30).map((row) => (
                      <div
                        key={row.query}
                        className="grid gap-3 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                      >
                        <div>
                          <p className="text-sm text-white/62">{row.query}</p>
                          <p className="mt-1 text-xs text-white/32">
                            last observed {new Date(row.lastObservedAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
                          {row.count} zero result
                        </Badge>
                      </div>
                    ))}
                  </AdminList>
                ) : (
                  <AdminEmptyState
                    title="No zero-result query evidence"
                    description="No current privacy-safe zero-result language was returned."
                  />
                )}
              </AdminSection>

              <AdminSection
                title="Living query collection"
                description="Current stored query language and intent classification."
                className="pt-0"
              >
                {data.livingQueries.length ? (
                  <AdminList>
                    {data.livingQueries.slice(0, 60).map((row, index) => (
                      <div key={row.query || index} className="px-3 py-3 sm:px-4">
                        <div className="flex items-start gap-2">
                          <Search className="mt-0.5 h-4 w-4 shrink-0 text-white/35" />
                          <div className="min-w-0">
                            <p className="text-sm text-white/62">{row.query || "Query unavailable"}</p>
                            <p className="mt-1 text-xs text-white/32">
                              {readable(row.source)} · {readable(row.intent)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </AdminList>
                ) : (
                  <AdminEmptyState
                    title="No living queries"
                    description="The observatory returned no stored query language."
                  />
                )}
              </AdminSection>
            </div>

            <div className="grid gap-7 xl:grid-cols-2">
              <AdminSection
                title="Public-surface classification"
                description="Current discovery classification and the recorded reason."
                className="pt-0"
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  {Object.entries(classCounts).map(([classification, count]) => (
                    <Badge
                      key={classification}
                      className="border-white/15 bg-white/5 text-white/55"
                    >
                      {readable(classification)}: {count}
                    </Badge>
                  ))}
                </div>
                {data.classifications.length ? (
                  <AdminList>
                    {data.classifications.slice(0, 50).map((row, index) => (
                      <div
                        key={`${row.entityType}-${row.entityId}-${index}`}
                        className="grid gap-3 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                      >
                        <div>
                          <p className="font-semibold text-white">{row.name || row.entityId}</p>
                          <p className="mt-1 text-xs leading-5 text-white/38">
                            {row.reason || "No reason recorded"}
                          </p>
                        </div>
                        <Badge className="border-white/15 bg-white/5 text-white/55">
                          {readable(row.classification)}
                        </Badge>
                      </div>
                    ))}
                  </AdminList>
                ) : (
                  <AdminEmptyState
                    title="No classified surfaces"
                    description="No public-surface classification records were returned."
                  />
                )}
              </AdminSection>

              <AdminSection
                title="Market pages"
                description="Current stored market-page evidence returned by the observatory."
                className="pt-0"
              >
                {data.marketPages.length ? (
                  <AdminList>
                    {data.marketPages.slice(0, 50).map((row, index) => (
                      <details key={row.id || row.route || row.slug || index} className="group">
                        <summary className="grid cursor-pointer list-none gap-3 px-3 py-3 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              {row.name || row.title || row.route || row.slug || "Market page"}
                            </p>
                            <p className="mt-1 truncate text-xs text-white/35">
                              {row.route || row.canonicalRoute || row.url || "Route not recorded"}
                            </p>
                          </div>
                          <Badge className="border-white/15 bg-white/5 text-white/55">
                            {readable(row.status || row.classification || "recorded")}
                          </Badge>
                        </summary>
                        <div className="grid gap-3 border-t border-white/10 bg-white/[0.015] px-3 py-4 sm:px-4 md:grid-cols-2">
                          {Object.entries(row)
                            .filter(([key]) => !["name", "title", "route", "slug"].includes(key))
                            .slice(0, 10)
                            .map(([key, value]) => (
                              <DetailBlock
                                key={`${index}-${key}`}
                                label={readable(key)}
                                value={compactValue(value)}
                              />
                            ))}
                        </div>
                      </details>
                    ))}
                  </AdminList>
                ) : (
                  <AdminEmptyState
                    title="No market-page evidence"
                    description="The observatory returned no market-page records."
                  />
                )}
              </AdminSection>
            </div>
          </TabsContent>

          <TabsContent value="experiments" className="mt-0 space-y-7">
            <AdminSection
              title="Ranked owner-review experiment queue"
              description="Proposed controlled tests only. An experiment must be predeclared before its result is counted."
              className="pt-0"
            >
              {data.experiments.length ? (
                <AdminList>
                  {data.experiments.map((experiment, index) => (
                    <details
                      key={experiment.experimentId || index}
                      className="group"
                    >
                      <summary className="grid cursor-pointer list-none gap-3 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[5rem_minmax(0,1fr)_minmax(9rem,0.4fr)] lg:items-center [&::-webkit-details-marker]:hidden">
                        <div className="font-mono text-sm text-white/38">
                          #{experiment.rank || index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white">
                            {experiment.exactQuestion || "Question not recorded"}
                          </p>
                          <p className="mt-1 text-xs text-white/35">
                            {experiment.assignmentCount || 0} stored assignment(s) · decision {" "}
                            {experiment.latestOwnerDecisionRef || "unavailable"}
                          </p>
                        </div>
                        <Badge className="border-white/15 bg-white/5 text-white/55">
                          Score {experiment.score ?? "—"}
                        </Badge>
                      </summary>
                      <div className="grid gap-4 border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4 md:grid-cols-2">
                        <DetailBlock
                          label="Current state"
                          value={readable(experiment.currentState)}
                        />
                        <DetailBlock
                          label="Current evidence baseline"
                          value={experiment.currentBaseline || "Not recorded"}
                        />
                        <DetailBlock
                          label="One controlled change"
                          value={experiment.oneControlledChange || "Not recorded"}
                        />
                        <DetailBlock
                          label="Intended customer action"
                          value={experiment.intendedCustomerAction || "Not recorded"}
                        />
                        <DetailBlock
                          label="Owner action"
                          value={experiment.ownerAction || "Not recorded"}
                        />
                        <DetailBlock
                          label="Evidence boundary"
                          value={experiment.evidenceBoundary || "Not recorded"}
                        />
                      </div>
                    </details>
                  ))}
                </AdminList>
              ) : (
                <AdminEmptyState
                  title="No proposed experiments"
                  description="No ranked owner-review experiment is currently stored."
                />
              )}
            </AdminSection>

            <AdminSection
              title="Supporting crawler telemetry"
              description="Supporting attention evidence only; it does not prove outside-source causation."
              className="pt-0"
            >
              <div className="flex items-center gap-4 border-y border-white/10 px-4 py-5">
                <Database className="h-5 w-5 text-sky-300" />
                <div>
                  <p className="text-2xl font-semibold text-white">
                    {data.supportingTelemetry.crawlerRequestCount ?? "Unknown"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/48">
                    {data.supportingTelemetry.caveat}
                  </p>
                </div>
              </div>
            </AdminSection>
          </TabsContent>
        </Tabs>
      )}
    </AdminWorkspace>
  );
}

function OperatingGroup({
  title,
  empty,
  rows,
  render,
}: {
  title: string;
  empty: string;
  rows: Array<Record<string, any>>;
  render: (row: Record<string, any>) => { key: string; title: string; detail: string };
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
        {title}
      </p>
      {rows.length ? (
        <AdminList className="mt-3">
          {rows.map((row, index) => {
            const rendered = render(row);
            return (
              <div key={`${rendered.key}-${index}`} className="px-3 py-3 sm:px-4">
                <p className="text-sm font-semibold text-white">{rendered.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/38">{rendered.detail}</p>
              </div>
            );
          })}
        </AdminList>
      ) : (
        <div className="mt-3 border-y border-dashed border-white/12 px-3 py-5 text-sm text-white/38">
          {empty}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-y border-white/10 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
        {label}
      </p>
      <p className="mt-2 break-words text-sm leading-6 text-white/58">{value}</p>
    </div>
  );
}
