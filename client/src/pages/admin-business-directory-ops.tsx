import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  TerminalSquare,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type SeedRun = {
  id: string;
  source: string;
  locationText: string | null;
  countyFips: string | null;
  stateCode: string | null;
  terms: string[];
  requestedByUserId: string | null;
  status: "running" | "succeeded" | "failed" | string;
  insertedCount: number;
  duplicateCount: number;
  errorCount: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string | null;
};

type SeedRunLog = {
  id: string;
  level: string;
  message: string;
  createdAt: string;
};

type Suggestion = {
  id: string;
  businessId: string;
  kind: "edit" | "removal" | string;
  status: "open" | "resolved" | "rejected" | string;
  payload: unknown;
  createdByUserId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  businessName: string;
  businessSlug: string;
};

type PensacolaLiquiditySupplySummary = {
  county: { countyFips: string; label: string; stateCode: string };
  supply: {
    candidateCount: number;
    verifiedActiveCount: number;
    claimedCount: number;
    unclaimedCount: number;
    verifiedActiveSource: string;
  };
  tradeCategoryCounts: Array<{
    tradeCategory: string;
    candidateCount: number;
    verifiedActiveCount: number;
  }>;
  claimStateCounts: Array<{ claimStatus: string; businessStatus: string; total: number }>;
  recentSeeding: {
    windowDays: number;
    totalRuns: number;
    succeededRuns: number;
    insertedCount: number;
    duplicateCount: number;
    errorCount: number;
  };
  suggestionCounts: Array<{ status: string; total: number }>;
  outreachStatus: {
    contacted: { supported: boolean; count: number; reason?: string };
    interested: { supported: boolean; count: number; reason?: string };
  };
  blockers: Record<string, { supported: boolean; count: number }>;
};

type SuggestionStatus = "open" | "resolved" | "rejected";

function readable(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}

function seedStatusBadge(status: string) {
  if (status === "succeeded") {
    return (
      <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
        Succeeded
      </Badge>
    );
  }
  if (status === "failed") {
    return <Badge className="border-red-400/30 bg-red-400/10 text-red-200">Failed</Badge>;
  }
  if (status === "running") {
    return (
      <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">Running</Badge>
    );
  }
  return <Badge className="border-white/15 bg-white/5 text-white/55">{readable(status)}</Badge>;
}

function suggestionMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const message = (payload as Record<string, unknown>).message;
  return typeof message === "string" ? message.trim() : "";
}

export default function AdminBusinessDirectoryOpsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [locationText, setLocationText] = useState("Pensacola, FL");
  const [countyFips, setCountyFips] = useState("");
  const [stateCode, setStateCode] = useState("FL");
  const [terms, setTerms] = useState("business, plumber, electrician, roofing");
  const [delayMs, setDelayMs] = useState("1500");
  const [suggestionsStatus, setSuggestionsStatus] = useState<SuggestionStatus>("open");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ["admin-seed-runs"],
    queryFn: async () => apiRequest("GET", "/api/admin/business-seeding/runs?limit=50"),
  });
  const runs: SeedRun[] = Array.isArray(runsQuery.data?.items) ? runsQuery.data.items : [];

  const suggestionsQuery = useQuery({
    queryKey: ["admin-business-suggestions", suggestionsStatus],
    queryFn: async () =>
      apiRequest(
        "GET",
        `/api/admin/business-directory/suggestions?status=${encodeURIComponent(suggestionsStatus)}&limit=200`
      ),
  });
  const suggestions: Suggestion[] = Array.isArray(suggestionsQuery.data?.items)
    ? suggestionsQuery.data.items
    : [];

  const pensacolaLiquidityQuery = useQuery<PensacolaLiquiditySupplySummary>({
    queryKey: ["admin-pensacola-liquidity-supply"],
    queryFn: async () =>
      apiRequest("GET", "/api/admin/business-directory/pensacola-liquidity/summary"),
  });

  const logsQuery = useQuery({
    queryKey: ["admin-seed-run-logs", selectedRunId],
    enabled: Boolean(selectedRunId),
    queryFn: async () =>
      apiRequest(
        "GET",
        `/api/admin/business-seeding/runs/${encodeURIComponent(String(selectedRunId))}/logs?limit=400`
      ),
  });
  const logs: SeedRunLog[] = Array.isArray(logsQuery.data?.items) ? logsQuery.data.items : [];

  const startSeedMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/admin/business-seeding/places-textsearch/run", {
        locationText: locationText.trim(),
        countyFips: countyFips.trim(),
        stateCode: stateCode.trim().toUpperCase(),
        terms: terms.trim(),
        delayMs: Number(delayMs),
      }),
    onSuccess: async (data: unknown) => {
      const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      toast({
        title: "Directory seed started",
        description: record.seedRunId ? `Run ${String(record.seedRunId)}` : "The seeding job started.",
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-seed-runs"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Directory seed was not started",
        description: formatUserFacingErrorMessage(error, "Could not start the seeding job."),
        variant: "destructive",
      });
    },
  });

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "rejected" }) =>
      apiRequest(
        "POST",
        `/api/admin/business-directory/suggestions/${encodeURIComponent(id)}/status`,
        { status }
      ),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-business-suggestions"] });
      toast({
        title: variables.status === "resolved" ? "Suggestion resolved" : "Suggestion rejected",
        description: "The directory suggestion state was updated.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Suggestion was not updated",
        description: formatUserFacingErrorMessage(error, "Could not update the suggestion."),
        variant: "destructive",
      });
    },
  });

  const runningCount = useMemo(
    () => runs.filter((run) => String(run.status) === "running").length,
    [runs]
  );
  const canStartSeed =
    Boolean(locationText.trim()) &&
    Boolean(terms.trim()) &&
    Boolean(stateCode.trim()) &&
    Number.isFinite(Number(delayMs)) &&
    Number(delayMs) >= 0;
  const liquidity = pensacolaLiquidityQuery.data;

  return (
    <AdminWorkspace data-testid="admin-business-directory-v2">
      <Tabs defaultValue="seeding" className="space-y-6">
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
            <TabsTrigger
              value="seeding"
              className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
            >
              Directory supply
            </TabsTrigger>
            <TabsTrigger
              value="suggestions"
              className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
            >
              Suggested changes
            </TabsTrigger>
          </TabsList>
        </AdminWorkspaceSubnav>

        <TabsContent value="seeding" className="mt-0 space-y-7">
          <AdminSection
            title="Pensacola and Escambia supply"
            description="Aggregated county supply health only. This view does not expose contact lists or sell leads."
            className="pt-0"
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() => pensacolaLiquidityQuery.refetch()}
                disabled={pensacolaLiquidityQuery.isFetching}
                className="border-white/12 bg-transparent text-white/60"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${pensacolaLiquidityQuery.isFetching ? "animate-spin" : ""}`}
                />
                Refresh supply
              </Button>
            }
          >
            {pensacolaLiquidityQuery.isLoading ? (
              <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
                <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
                Loading supply health…
              </div>
            ) : pensacolaLiquidityQuery.isError || !liquidity ? (
              <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                The Pensacola supply summary is unavailable. Existing directory records were not changed.
              </div>
            ) : (
              <>
                <AdminSummaryStrip
                  items={[
                    {
                      label: "Candidates",
                      value: liquidity.supply.candidateCount,
                      detail: "Businesses in the county supply set",
                    },
                    {
                      label: "Verified active",
                      value: liquidity.supply.verifiedActiveCount,
                      detail: "Providers meeting the current verified-active rule",
                      tone: liquidity.supply.verifiedActiveCount > 0 ? "good" : "warning",
                    },
                    {
                      label: "Claimed",
                      value: liquidity.supply.claimedCount,
                      detail: "Businesses with a current claim state",
                    },
                    {
                      label: "Unclaimed",
                      value: liquidity.supply.unclaimedCount,
                      detail: "Potential claim and verification work",
                      tone: liquidity.supply.unclaimedCount > 0 ? "warning" : "neutral",
                    },
                  ]}
                />

                <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                      Verified-active by category
                    </p>
                    {liquidity.tradeCategoryCounts.length ? (
                      <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
                        {liquidity.tradeCategoryCounts.slice(0, 10).map((row) => (
                          <div
                            key={row.tradeCategory}
                            className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4"
                          >
                            <span className="truncate text-white/62">{row.tradeCategory}</span>
                            <span className="font-mono text-white/45">
                              {row.verifiedActiveCount}/{row.candidateCount}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <AdminEmptyState
                        title="No category counts yet"
                        description="The county summary has no category breakdown to display."
                      />
                    )}
                  </div>

                  <div className="border-y border-white/10 px-3 py-4 text-sm leading-6 text-white/48 sm:px-4">
                    <p className="font-medium text-white/70">Current evidence</p>
                    <p className="mt-2">{liquidity.supply.verifiedActiveSource}</p>
                    <p className="mt-3">
                      Recent seed window: {liquidity.recentSeeding.windowDays} days · {liquidity.recentSeeding.totalRuns} runs · {liquidity.recentSeeding.insertedCount} inserted · {liquidity.recentSeeding.errorCount} errors.
                    </p>
                    <p className="mt-3">
                      Contacted and interested counts stay unavailable until a safe operating event source exists.
                    </p>
                  </div>
                </div>
              </>
            )}
          </AdminSection>

          <AdminSection
            title="Run directory search"
            description="Create unclaimed directory candidates from the approved Places text-search source."
            actions={
              <div className="flex items-center gap-2">
                {runningCount > 0 ? (
                  <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-100">
                    {runningCount} running
                  </Badge>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => runsQuery.refetch()}
                  disabled={runsQuery.isFetching}
                  className="border-white/12 bg-transparent text-white/60"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${runsQuery.isFetching ? "animate-spin" : ""}`} />
                  Refresh runs
                </Button>
              </div>
            }
          >
            <div className="grid gap-4 border-y border-white/10 px-3 py-5 md:grid-cols-2 sm:px-4">
              <div className="space-y-2">
                <Label htmlFor="seed-location" className="text-white/65">Location</Label>
                <Input
                  id="seed-location"
                  value={locationText}
                  onChange={(event) => setLocationText(event.target.value)}
                  placeholder="Pensacola, FL"
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="seed-fips" className="text-white/65">County FIPS</Label>
                  <Input
                    id="seed-fips"
                    value={countyFips}
                    onChange={(event) => setCountyFips(event.target.value.replace(/\D/g, "").slice(0, 5))}
                    placeholder="12033"
                    className="border-white/10 bg-black/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seed-state" className="text-white/65">State</Label>
                  <Input
                    id="seed-state"
                    value={stateCode}
                    onChange={(event) =>
                      setStateCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))
                    }
                    placeholder="FL"
                    className="border-white/10 bg-black/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seed-delay" className="text-white/65">Delay ms</Label>
                  <Input
                    id="seed-delay"
                    value={delayMs}
                    onChange={(event) => setDelayMs(event.target.value.replace(/\D/g, "").slice(0, 5))}
                    className="border-white/10 bg-black/20 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="seed-terms" className="text-white/65">Search terms</Label>
                <Textarea
                  id="seed-terms"
                  value={terms}
                  onChange={(event) => setTerms(event.target.value)}
                  placeholder="business, plumber, electrician, roofing"
                  className="min-h-24 border-white/10 bg-black/20 text-white"
                />
                <p className="text-xs text-white/32">Comma-separated terms. The server records inserts, duplicates, and errors for each run.</p>
              </div>
              <div className="md:col-span-2">
                <Button
                  type="button"
                  onClick={() => startSeedMutation.mutate()}
                  disabled={startSeedMutation.isPending || !canStartSeed}
                  className="bg-orange-500 text-black hover:bg-orange-400"
                >
                  {startSeedMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {startSeedMutation.isPending ? "Starting…" : "Start seed run"}
                </Button>
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="Recent seed runs"
            description="Review outcomes before opening the detailed log stream."
          >
            {runsQuery.isLoading ? (
              <div className="flex min-h-40 items-center justify-center border-y border-white/10 text-sm text-white/45">
                <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
                Loading seed runs…
              </div>
            ) : runsQuery.isError ? (
              <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Seed run history is unavailable.
              </div>
            ) : runs.length ? (
              <AdminList>
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.75fr)_minmax(12rem,0.75fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {seedStatusBadge(String(run.status))}
                        <span className="truncate font-mono text-xs text-white/38">{run.id}</span>
                      </div>
                      <p className="mt-2 truncate text-sm text-white/62">
                        {run.locationText || [run.stateCode, run.countyFips].filter(Boolean).join("-") || "Location not recorded"}
                      </p>
                      <p className="mt-1 text-xs text-white/32">Started {formatDate(run.startedAt)}</p>
                    </div>
                    <div className="text-sm text-white/55">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">Results</p>
                      <p className="mt-1">{run.insertedCount} inserted · {run.duplicateCount} duplicates</p>
                    </div>
                    <div className="text-sm text-white/55">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">Errors</p>
                      <p className={`mt-1 ${run.errorCount > 0 ? "text-red-200" : ""}`}>{run.errorCount}</p>
                      {run.errorMessage ? <p className="mt-1 line-clamp-1 text-xs text-red-200/70">{run.errorMessage}</p> : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedRunId(run.id)}
                      className="border-white/12 bg-transparent text-white/65"
                    >
                      <TerminalSquare className="mr-2 h-4 w-4" />
                      View logs
                    </Button>
                  </div>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState title="No seed runs yet" description="Start a directory search to create the first audited run." />
            )}

            {selectedRunId ? (
              <div className="mt-5 border-y border-white/10 bg-black/20">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-4">
                  <div>
                    <p className="font-semibold text-white">Run logs</p>
                    <p className="mt-1 font-mono text-xs text-white/35">{selectedRunId}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRunId(null)}
                    className="border-white/12 bg-transparent text-white/60"
                  >
                    Close
                  </Button>
                </div>
                {logsQuery.isLoading ? (
                  <div className="px-4 py-8 text-sm text-white/45">Loading logs…</div>
                ) : logsQuery.isError ? (
                  <div className="px-4 py-8 text-sm text-red-200">The log stream could not be loaded.</div>
                ) : logs.length ? (
                  <div className="max-h-[34rem] divide-y divide-white/8 overflow-y-auto">
                    {logs.map((log) => (
                      <div key={log.id} className="grid gap-2 px-3 py-3 font-mono text-xs sm:grid-cols-[7rem_minmax(0,1fr)] sm:px-4">
                        <span className="text-white/32">[{String(log.level).toUpperCase()}]</span>
                        <span className="whitespace-pre-wrap text-white/58">{log.message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-sm text-white/45">No logs were recorded for this run.</div>
                )}
              </div>
            ) : null}
          </AdminSection>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-0">
          <AdminSection
            title="Suggested directory changes"
            description="Review edit and removal suggestions against the public business record before resolving or rejecting them."
            className="pt-0"
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() => suggestionsQuery.refetch()}
                disabled={suggestionsQuery.isFetching}
                className="border-white/12 bg-transparent text-white/60"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${suggestionsQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            }
          >
            <AdminToolbar>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={suggestionsStatus}
                  onValueChange={(value) => setSuggestionsStatus(value as SuggestionStatus)}
                >
                  <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-white/35">{suggestions.length} suggestions</p>
            </AdminToolbar>

            {suggestionsQuery.isLoading ? (
              <div className="flex min-h-48 items-center justify-center border-y border-white/10 text-sm text-white/45">
                <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
                Loading suggestions…
              </div>
            ) : suggestionsQuery.isError ? (
              <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                The suggestion queue is unavailable. No suggestion state was changed.
              </div>
            ) : suggestions.length ? (
              <AdminList className="mt-4">
                {suggestions.map((suggestion) => {
                  const message = suggestionMessage(suggestion.payload);
                  return (
                    <div
                      key={suggestion.id}
                      className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-white/15 bg-white/5 text-white/55">{readable(suggestion.kind)}</Badge>
                          <a
                            href={`/business/${encodeURIComponent(suggestion.businessSlug)}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex min-w-0 items-center gap-2 font-semibold text-white hover:text-orange-200"
                          >
                            <Building2 className="h-4 w-4 shrink-0" />
                            <span className="truncate">{suggestion.businessName}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                          <span className="truncate text-xs text-white/32">/{suggestion.businessSlug}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/52">
                          {message || "No explanatory message was provided."}
                        </p>
                        <p className="mt-3 font-mono text-[10px] text-white/24">{suggestion.id}</p>
                      </div>

                      {suggestion.status === "open" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              updateSuggestionMutation.mutate({
                                id: suggestion.id,
                                status: "resolved",
                              })
                            }
                            disabled={updateSuggestionMutation.isPending}
                            className="bg-emerald-400 text-black hover:bg-emerald-300"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Resolve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateSuggestionMutation.mutate({
                                id: suggestion.id,
                                status: "rejected",
                              })
                            }
                            disabled={updateSuggestionMutation.isPending}
                            className="border-red-300/25 bg-transparent text-red-100 hover:bg-red-400/10"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Badge className="border-white/15 bg-white/5 text-white/55">
                          {readable(suggestion.status)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </AdminList>
            ) : (
              <AdminEmptyState
                title={`No ${suggestionsStatus} suggestions`}
                description="Choose another status to inspect a different part of the suggestion queue."
              />
            )}
          </AdminSection>
        </TabsContent>
      </Tabs>
    </AdminWorkspace>
  );
}
