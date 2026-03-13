import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { useLocation } from "wouter";

type MarketSignalWindow = "1h" | "24h" | "7d" | "30d";

type CountyObservationSnapshot = {
  status: "ok" | "suppressed";
  reason?: "minimum_threshold_not_met";
  partnerSlug?: string;
  window?: MarketSignalWindow;
  generatedAt?: string;
  counties?: Array<{
    countyFips: string;
    countyName: string;
    stateCode: string;
    requestCount: number;
    okRatePct: number;
    trend: "up" | "down" | "flat";
    changePct: number;
    dominantSurface: string;
    surfaceMix: Array<{
      surface: string;
      requestCount: number;
      sharePct: number;
    }>;
  }>;
};

type CumulusIntelligenceBrief = {
  partnerSlug: string;
  generatedAt: string;
  filters: {
    window: MarketSignalWindow;
    stateCode: string | null;
    surface: string | null;
    limit: number;
  };
  executiveSummary: string;
  activationSummary: string;
  topCounties: Array<{
    rank: number;
    countyFips: string;
    countyName: string;
    stateCode: string;
    requestCount: number;
    dominantSurface: string;
    trend: "up" | "down" | "flat";
    changePct: number;
  }>;
  lisa: {
    truthNow: string;
    dataProductionSummary: string;
    llmOptimizationSummary: string;
    topFindings: Array<{
      id: string;
      headline: string;
      narrative: string;
      priority: "critical" | "high" | "medium" | "low";
      truthStatus: "current" | "stale" | "superseded" | "suppressed";
      scopeType: "global" | "county" | "category" | "surface" | "partner";
    }>;
  };
};

type CumulusIntelligenceBriefHistoryResponse = {
  partnerSlug: string;
  window: MarketSignalWindow;
  stateCode: string | null;
  surface: string | null;
  history: CumulusIntelligenceBrief[];
};

const PARTNER_SLUG = "cumulus-media";

function buildExportPath(
  window: MarketSignalWindow,
  stateCode: string,
  surface: string,
  limit: string
): string {
  const params = new URLSearchParams();
  params.set("window", window);
  params.set("limit", limit || "100");
  if (stateCode !== "all") params.set("stateCode", stateCode);
  if (surface !== "all") params.set("surface", surface);
  return `/api/admin/cumulus-intelligence/export.csv?${params.toString()}`;
}

function getFilenameFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /filename="?([^"]+)"?/i.exec(headerValue);
  if (!match?.[1]) return null;
  return match[1];
}

export default function AdminCumulusIntelligencePage() {
  const [location, navigate] = useLocation();
  const [selectedWindow, setSelectedWindow] = useState<MarketSignalWindow>("24h");
  const [stateCode, setStateCode] = useState("all");
  const [surface, setSurface] = useState("all");
  const [limit, setLimit] = useState("100");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("window", selectedWindow);
    params.set("limit", limit || "100");
    if (stateCode !== "all") params.set("stateCode", stateCode);
    if (surface !== "all") params.set("surface", surface);
    return params.toString();
  }, [selectedWindow, stateCode, surface, limit]);
  const meetingMode = useMemo(() => {
    const rawQuery = location.includes("?") ? location.split("?")[1] || "" : "";
    return new URLSearchParams(rawQuery).get("meetingMode") === "1";
  }, [location]);

  const { data, isLoading } = useQuery<CountyObservationSnapshot>({
    queryKey: ["/api/market-signals/v1/partners/county-observation", PARTNER_SLUG, queryString],
    queryFn: async () =>
      apiRequest(
        "GET",
        `/api/market-signals/v1/partners/${PARTNER_SLUG}/county-observation?${queryString}`
      ),
    refetchInterval: 30000,
  });

  const { data: brief, isLoading: briefLoading } = useQuery<CumulusIntelligenceBrief>({
    queryKey: ["/api/admin/cumulus-intelligence/brief", queryString],
    queryFn: async () => apiRequest("GET", `/api/admin/cumulus-intelligence/brief?${queryString}`),
    refetchInterval: 30000,
  });

  const { data: briefHistory } = useQuery<CumulusIntelligenceBriefHistoryResponse>({
    queryKey: ["/api/admin/cumulus-intelligence/brief-history", queryString],
    queryFn: async () =>
      apiRequest("GET", `/api/admin/cumulus-intelligence/brief-history?${queryString}`),
    refetchInterval: 60000,
  });

  const counties = data?.status === "ok" ? data.counties || [] : [];
  const totalRequests = counties.reduce((sum, county) => sum + county.requestCount, 0);
  const avgOkRate =
    counties.length > 0
      ? Math.round(counties.reduce((sum, county) => sum + county.okRatePct, 0) / counties.length)
      : 0;
  const previousBrief = (briefHistory?.history || []).find(
    (item) => item.generatedAt !== brief?.generatedAt
  );
  const currentTopCounty = brief?.topCounties?.[0] || null;
  const previousTopCounty = previousBrief?.topCounties?.[0] || null;
  const currentTopRequests = currentTopCounty?.requestCount || 0;
  const previousTopRequests = previousTopCounty?.requestCount || 0;
  const topCountyDelta = currentTopRequests - previousTopRequests;
  const currentBriefCounties = brief?.topCounties?.length || 0;
  const previousBriefCounties = previousBrief?.topCounties?.length || 0;
  const countyCountDelta = currentBriefCounties - previousBriefCounties;
  const currentSurfaceLead = currentTopCounty?.dominantSurface || null;
  const previousSurfaceLead = previousTopCounty?.dominantSurface || null;
  const surfaceDelta =
    currentSurfaceLead && previousSurfaceLead && currentSurfaceLead !== previousSurfaceLead
      ? `Surface lead changed from ${previousSurfaceLead.replace(/_/g, " ")} to ${currentSurfaceLead.replace(/_/g, " ")}.`
      : currentSurfaceLead
        ? `${currentSurfaceLead.replace(/_/g, " ")} remains the leading surface.`
        : "";
  const deltaSummary = previousBrief
    ? `${topCountyDelta >= 0 ? "+" : ""}${topCountyDelta} top-county requests versus the previous brief. ${countyCountDelta >= 0 ? "+" : ""}${countyCountDelta} counties in the top snapshot set. ${currentTopCounty ? `Current lead is ${currentTopCounty.countyName}, ${currentTopCounty.stateCode}.` : ""} ${surfaceDelta}`.trim()
    : "No prior brief available yet for delta comparison.";

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);

    try {
      const path = buildExportPath(selectedWindow, stateCode, surface, limit);
      const response = await fetch(buildApiUrl(path), {
        method: "GET",
        credentials: "include",
        headers: { Accept: "text/csv" },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const headerFilename = getFilenameFromHeader(response.headers.get("content-disposition"));
      const fallbackFilename = `cumulus-intelligence-${selectedWindow}-${new Date().toISOString().slice(0, 10)}.csv`;
      const filename = headerFilename || fallbackFilename;

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      setExportError(err?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleMeetingModeToggle = () => {
    const params = new URLSearchParams(queryString);
    if (meetingMode) {
      params.delete("meetingMode");
    } else {
      params.set("meetingMode", "1");
    }
    navigate(`/admin/cumulus-intelligence?${params.toString()}`);
  };

  return (
    <div
      className={`space-y-6 print:bg-white print:text-black ${meetingMode ? "max-w-5xl mx-auto py-6" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="text-sm text-white/60">
          {meetingMode
            ? "Meeting mode is on. The page is focused on the presentable briefing surface."
            : "Operator mode shows the full admin intelligence surface."}
        </div>
        <Button onClick={handleMeetingModeToggle} variant="outline">
          {meetingMode ? "Exit Meeting Mode" : "Open Meeting Mode"}
        </Button>
      </div>

      <Card className="bg-tsCard/95 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Executive Brief</CardTitle>
          <CardDescription className="text-white/70">
            Server-generated summary for presenting live county intelligence without translating raw
            rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="text-sm text-white/60">
              Print this current brief directly for the meeting or save it as PDF from the browser
              print dialog.
            </div>
            <Button onClick={handlePrint} variant="outline">
              Print Brief
            </Button>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/85">
            {brief?.executiveSummary ||
              (briefLoading ? "Building current brief..." : "No brief available yet.")}
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/75">
            {brief?.activationSummary ||
              "Activation summary will appear once county snapshots are available."}
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/75">
            {deltaSummary}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Truth Now</div>
              <div className="mt-2 text-sm text-white/85">
                {brief?.lisa.truthNow || "Waiting for LISA truth state."}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                Data Production
              </div>
              <div className="mt-2 text-sm text-white/85">
                {brief?.lisa.dataProductionSummary || "Waiting for data production summary."}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                LLM Optimization
              </div>
              <div className="mt-2 text-sm text-white/85">
                {brief?.lisa.llmOptimizationSummary || "Waiting for LLM optimization summary."}
              </div>
            </div>
          </div>
          {brief?.topCounties?.length ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Top Counties</div>
              <div className="mt-3 space-y-2">
                {brief.topCounties.map((county) => (
                  <div
                    key={`${county.rank}:${county.countyFips}`}
                    className="text-sm text-white/80"
                  >
                    #{county.rank} {county.countyName}, {county.stateCode} | {county.requestCount}{" "}
                    requests | {county.dominantSurface.replace(/_/g, " ")} | {county.trend}{" "}
                    {county.changePct}%
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!meetingMode ? (
        <Card className="bg-tsCard/95 border-white/10 print:hidden">
          <CardHeader>
            <CardTitle className="text-white">Brief History</CardTitle>
            <CardDescription className="text-white/70">
              Stored briefing artifacts for comparing current truth against prior snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(briefHistory?.history || []).length === 0 ? (
                <div className="text-sm text-white/65">
                  No brief history yet for the selected filter set.
                </div>
              ) : (
                briefHistory?.history.map((item) => (
                  <div
                    key={`${item.generatedAt}:${item.filters.window}:${item.filters.stateCode || "all"}:${item.filters.surface || "all"}`}
                    className="rounded-lg border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="text-sm font-semibold text-white">
                        {new Date(item.generatedAt).toLocaleString()}
                      </div>
                      <div className="text-xs text-white/50">
                        {item.filters.window} | {item.filters.stateCode || "all states"} |{" "}
                        {item.filters.surface || "all surfaces"}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-white/80">{item.executiveSummary}</div>
                    <div className="mt-2 text-sm text-white/65">{item.activationSummary}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className={`bg-tsCard/95 border-white/10 ${meetingMode ? "print:hidden" : ""}`}>
        <CardHeader>
          <CardTitle className="text-white">Cumulus Intelligence</CardTitle>
          <CardDescription className="text-white/70">
            Admin-only county observation intelligence for Cumulus across all TradeScout counties.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>Window</Label>
              <Select
                value={selectedWindow}
                onValueChange={(value) => setSelectedWindow(value as MarketSignalWindow)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
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
              <Label>Surface</Label>
              <Select value={surface} onValueChange={setSurface}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All surfaces</SelectItem>
                  <SelectItem value="scout">Scout</SelectItem>
                  <SelectItem value="exchange">Exchange</SelectItem>
                  <SelectItem value="homescout_listings">HomeScout Listings</SelectItem>
                  <SelectItem value="trade_deals">TradeDeals</SelectItem>
                  <SelectItem value="tradepartners">TradePartners</SelectItem>
                  <SelectItem value="county_page">County Page</SelectItem>
                  <SelectItem value="trade_county_page">Trade County Page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Limit</Label>
              <Input
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, "") || "100")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Counties</div>
              <div className="mt-2 text-2xl font-semibold text-white">{counties.length}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                Observed Requests
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{totalRequests}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Avg OK Rate</div>
              <div className="mt-2 text-2xl font-semibold text-white">{avgOkRate}%</div>
            </div>
          </div>

          <div className="text-xs text-white/50">
            {data?.generatedAt
              ? `Updated ${new Date(data.generatedAt).toLocaleString()}`
              : isLoading
                ? "Loading live county observation..."
                : "No live county observation yet"}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/60">
              Download the current admin-only county intelligence snapshot for meeting use.
            </div>
            <Button onClick={handleExport} disabled={exporting || isLoading} variant="outline">
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>

          {exportError ? (
            <div className="rounded-md border border-red-600/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {exportError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!meetingMode ? (
        <Card className="bg-tsCard/95 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">County Rankings</CardTitle>
            <CardDescription className="text-white/70">
              County-level crawler attention with dominant surface and mix.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.status === "suppressed" ? (
              <div className="text-sm text-white/65">
                Signal is below threshold for the selected filter set.
              </div>
            ) : (
              <div className="space-y-3">
                {counties.map((county) => (
                  <div
                    key={`${county.countyFips}:${county.dominantSurface}`}
                    className="rounded-lg border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-base font-semibold text-white">
                          {county.countyName}, {county.stateCode}
                        </div>
                        <div className="text-xs text-white/55">
                          FIPS {county.countyFips} | dominant surface {county.dominantSurface}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-right">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                            Requests
                          </div>
                          <div className="mt-1 text-sm font-semibold text-white">
                            {county.requestCount}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                            OK Rate
                          </div>
                          <div className="mt-1 text-sm font-semibold text-white">
                            {county.okRatePct}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                            Trend
                          </div>
                          <div className="mt-1 text-sm font-semibold text-white">
                            {county.trend} {county.changePct}%
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {county.surfaceMix.map((surfaceRow) => (
                        <span
                          key={`${county.countyFips}:${surfaceRow.surface}`}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/75"
                        >
                          {surfaceRow.surface} {surfaceRow.sharePct}% ({surfaceRow.requestCount})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
