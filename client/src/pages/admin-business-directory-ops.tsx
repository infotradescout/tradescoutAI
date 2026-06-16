import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, RefreshCw } from "lucide-react";
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
  payload: any;
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

export default function AdminBusinessDirectoryOpsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [locationText, setLocationText] = useState("Pensacola, FL");
  const [countyFips, setCountyFips] = useState("");
  const [stateCode, setStateCode] = useState("FL");
  const [terms, setTerms] = useState("business, plumber, electrician, roofing");
  const [delayMs, setDelayMs] = useState("1500");

  const [suggestionsStatus, setSuggestionsStatus] = useState<"open" | "resolved" | "rejected">(
    "open"
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const runsQuery = useQuery({
    queryKey: ["admin-seed-runs"],
    queryFn: async () => (await apiRequest("/api/admin/business-seeding/runs?limit=50")) as any,
  });

  const runs: SeedRun[] = Array.isArray(runsQuery.data?.items) ? runsQuery.data.items : [];

  const suggestionsQuery = useQuery({
    queryKey: ["admin-business-suggestions", suggestionsStatus],
    queryFn: async () =>
      (await apiRequest(
        `/api/admin/business-directory/suggestions?status=${encodeURIComponent(suggestionsStatus)}&limit=200`
      )) as any,
  });

  const suggestions: Suggestion[] = Array.isArray(suggestionsQuery.data?.items)
    ? suggestionsQuery.data.items
    : [];

  const pensacolaLiquidityQuery = useQuery<PensacolaLiquiditySupplySummary>({
    queryKey: ["admin-pensacola-liquidity-supply"],
    queryFn: async () =>
      (await apiRequest("/api/admin/business-directory/pensacola-liquidity/summary")) as any,
  });

  const pensacolaLiquidity = pensacolaLiquidityQuery.data;

  const logsQuery = useQuery({
    queryKey: ["admin-seed-run-logs", selectedRunId],
    enabled: Boolean(selectedRunId),
    queryFn: async () =>
      (await apiRequest(
        `/api/admin/business-seeding/runs/${encodeURIComponent(String(selectedRunId))}/logs?limit=400`
      )) as any,
  });

  const logs: SeedRunLog[] = Array.isArray(logsQuery.data?.items) ? logsQuery.data.items : [];

  const startSeedMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        locationText: locationText.trim(),
        countyFips: countyFips.trim(),
        stateCode: stateCode.trim().toUpperCase(),
        terms: terms.trim(),
        delayMs: Number(delayMs),
      };
      return await apiRequest("POST", "/api/admin/business-seeding/places-textsearch/run", payload);
    },
    onSuccess: async (data: any) => {
      toast({
        title: "Seed started",
        description: data?.seedRunId ? `Run ${data.seedRunId}` : "Seeding job spawned",
      });
      await qc.invalidateQueries({ queryKey: ["admin-seed-runs"] });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to start seed",
        description: formatUserFacingErrorMessage(err, "Could not start seeding job"),
        variant: "destructive",
      });
    },
  });

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "resolved" | "rejected" }) => {
      return await apiRequest(
        "POST",
        `/api/admin/business-directory/suggestions/${encodeURIComponent(id)}/status`,
        { status }
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-business-suggestions"] });
      toast({ title: "Updated", description: "Suggestion status updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Failed",
        description: formatUserFacingErrorMessage(err, "Could not update suggestion."),
        variant: "destructive",
      });
    },
  });

  const runningCount = useMemo(
    () => runs.filter((r) => String(r.status) === "running").length,
    [runs]
  );

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Business Directory Ops</CardTitle>
          <div className="text-sm text-muted-foreground">
            Seed unclaimed listings (Places API New) and review the edit/removal queue.
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="seeding">
        <TabsList>
          <TabsTrigger value="seeding">Seeding</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>

        <TabsContent value="seeding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>Pensacola / Escambia Supply Health</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pensacolaLiquidityQuery.refetch()}
                  disabled={pensacolaLiquidityQuery.isFetching}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Aggregated counts only for county FIPS 12033. No contact lists or lead exports.
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {pensacolaLiquidityQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading Pensacola supply…</div>
              ) : !pensacolaLiquidity ? (
                <div className="text-sm text-muted-foreground">
                  Pensacola supply summary unavailable.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      ["Candidate businesses", pensacolaLiquidity.supply.candidateCount],
                      ["Verified-active providers", pensacolaLiquidity.supply.verifiedActiveCount],
                      ["Claimed", pensacolaLiquidity.supply.claimedCount],
                      ["Unclaimed", pensacolaLiquidity.supply.unclaimedCount],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-lg border border-border p-3">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="mt-1 text-2xl font-semibold">{String(value)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-sm font-medium">Verified-active by trade/category</div>
                      <div className="mt-2 space-y-1 text-sm">
                        {pensacolaLiquidity.tradeCategoryCounts.length === 0 ? (
                          <div className="text-muted-foreground">No category counts yet.</div>
                        ) : (
                          pensacolaLiquidity.tradeCategoryCounts.slice(0, 8).map((row) => (
                            <div
                              key={row.tradeCategory}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="truncate">{row.tradeCategory}</span>
                              <span className="font-mono">
                                {row.verifiedActiveCount}/{row.candidateCount}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-sm font-medium">Derived status notes</div>
                      <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                        <p>{pensacolaLiquidity.supply.verifiedActiveSource}</p>
                        <p>
                          Contacted/interested provider counts are unsupported until an existing
                          safe audit event source is available.
                        </p>
                        <p>
                          Recent seed inserts: {pensacolaLiquidity.recentSeeding.insertedCount};
                          errors: {pensacolaLiquidity.recentSeeding.errorCount}.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Run Places Seeding</span>
                <div className="flex items-center gap-2">
                  {runningCount > 0 ? (
                    <Badge variant="secondary">{runningCount} running</Badge>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runsQuery.refetch()}
                    disabled={runsQuery.isFetching}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">SEED_LOCATION</div>
                <Input value={locationText} onChange={(e) => setLocationText(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">County FIPS</div>
                  <Input
                    value={countyFips}
                    onChange={(e) => setCountyFips(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    placeholder="12033"
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">State</div>
                  <Input
                    value={stateCode}
                    onChange={(e) =>
                      setStateCode(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z]/g, "")
                          .slice(0, 2)
                      )
                    }
                    placeholder="FL"
                  />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Delay (ms)</div>
                  <Input
                    value={delayMs}
                    onChange={(e) => setDelayMs(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground mb-1">
                  SEED_TERMS (comma-separated)
                </div>
                <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Button
                  onClick={() => startSeedMutation.mutate()}
                  disabled={startSeedMutation.isPending}
                >
                  {startSeedMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" /> Start seed run
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent seed runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : runs.length === 0 ? (
                <div className="text-sm text-muted-foreground">No runs yet.</div>
              ) : (
                runs.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-mono text-xs">{r.id}</div>
                        <Badge
                          variant={
                            r.status === "succeeded"
                              ? "secondary"
                              : r.status === "failed"
                                ? "error"
                                : "outline"
                          }
                        >
                          {r.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {r.stateCode}-{r.countyFips}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        inserted={r.insertedCount} duplicates={r.duplicateCount} errors=
                        {r.errorCount}
                        {r.errorMessage ? ` • ${r.errorMessage}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedRunId(r.id)}>
                        View logs
                      </Button>
                    </div>
                  </div>
                ))
              )}

              {selectedRunId ? (
                <Card className="mt-3">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Logs</span>
                      <Button variant="outline" size="sm" onClick={() => setSelectedRunId(null)}>
                        Close
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {logsQuery.isLoading ? (
                      <div className="text-sm text-muted-foreground">Loading logs…</div>
                    ) : logs.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No logs.</div>
                    ) : (
                      <div className="space-y-2">
                        {logs.map((l) => (
                          <div
                            key={l.id}
                            className="rounded border border-border p-2 text-xs font-mono whitespace-pre-wrap"
                          >
                            <span className="text-muted-foreground">[{l.level}] </span>
                            {l.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Suggestions queue</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant={suggestionsStatus === "open" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setSuggestionsStatus("open")}
                  >
                    Open
                  </Button>
                  <Button
                    variant={suggestionsStatus === "resolved" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setSuggestionsStatus("resolved")}
                  >
                    Resolved
                  </Button>
                  <Button
                    variant={suggestionsStatus === "rejected" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setSuggestionsStatus("rejected")}
                  >
                    Rejected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => suggestionsQuery.refetch()}
                    disabled={suggestionsQuery.isFetching}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestionsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : suggestions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No suggestions.</div>
              ) : (
                suggestions.map((s) => {
                  const message = typeof s.payload?.message === "string" ? s.payload.message : "";
                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border border-border p-3 flex flex-col md:flex-row md:items-start md:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{s.kind}</Badge>
                          <a
                            className="font-semibold hover:underline"
                            href={`/business/${encodeURIComponent(s.businessSlug)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.businessName}
                          </a>
                          <span className="text-xs text-muted-foreground">{s.businessSlug}</span>
                        </div>
                        {message ? (
                          <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                            {message}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-muted-foreground">(no message)</div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground font-mono">{s.id}</div>
                      </div>

                      {s.status === "open" ? (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updateSuggestionMutation.isPending}
                            onClick={() =>
                              updateSuggestionMutation.mutate({ id: s.id, status: "resolved" })
                            }
                          >
                            Resolve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={updateSuggestionMutation.isPending}
                            onClick={() =>
                              updateSuggestionMutation.mutate({ id: s.id, status: "rejected" })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary">{s.status}</Badge>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
