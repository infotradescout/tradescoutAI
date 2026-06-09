import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Sparkles,
  Zap,
  MapPin,
  ShieldCheck,
  ThumbsUp,
  Briefcase,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateCountySelector } from "@/components/state-county-selector";
import {
  useLocationContext,
  hasCountyContext,
  setSessionLocationOverride,
} from "@/hooks/useLocationContext";
import { sanitizeAreaLabel } from "@/lib/copyHelpers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

const quickActions = [
  { title: "View Connections", desc: "Check new project opportunities" },
  { title: "Update Profile", desc: "Keep your pro card current" },
  { title: "Submit Quote", desc: "Send pricing on new requests" },
];

type Contractor = {
  id: string;
  name?: string;
  businessName?: string;
  rating?: number;
  reviewCount?: number;
  recommendationCount?: number;
  connectionRecommendationCount?: number | null;
  trades?: string[];
  location?: string;
  county?: string;
  state?: string;
  licenseNumber?: string | null;
  reachTier?: "local" | "regional" | "wide";
  localCredibilityScore?: number;
  localStats?: {
    jobsCompleted: number;
    peopleHelped: number;
    activeWeeks: number;
  };
  presenceLabel?: string;
  canonicalBusinessProfileUrl?: string | null;
};

type FindContractorsProps = {
  title?: string;
};

const FindContractors = memo(function FindContractors({
  title = "Find Local Contractors",
}: FindContractorsProps) {
  const location = useLocationContext();
  const [stateCode, setStateCode] = useState(location.stateCode || "");
  const [countyFips, setCountyFips] = useState(location.countyFips || "");
  const [tradeSlug, setTradeSlug] = useState("");
  const countyCommitted = hasCountyContext(location);

  const { data: trades = [] } = useQuery({
    queryKey: ["/api/trades"],
    queryFn: async () => apiRequest("GET", "/api/trades"),
  });

  const {
    data: topContractors = [],
    isLoading: topLoading,
    isFetching: topFetching,
    refetch: refetchTopContractors,
  } = useQuery<Contractor[]>({
    queryKey: ["/api/contractors/top", countyFips, tradeSlug],
    enabled: countyCommitted && Boolean(tradeSlug),
    queryFn: async () => {
      const params = new URLSearchParams({ county: countyFips, trade: tradeSlug, limit: "5" });
      return apiRequest("GET", `/api/contractors/top?${params.toString()}`);
    },
  });

  const ranked = useMemo(() => {
    const items = [...(topContractors || [])];
    const tierRank: Record<"local" | "regional" | "wide", number> = {
      local: 0,
      regional: 1,
      wide: 2,
    };
    return items.sort((a, b) => {
      const aTier = a.reachTier ? tierRank[a.reachTier] : 2;
      const bTier = b.reachTier ? tierRank[b.reachTier] : 2;
      if (aTier !== bTier) return aTier - bTier;
      const aScore = a.localCredibilityScore ?? 0;
      const bScore = b.localCredibilityScore ?? 0;
      // Fallback to rating + recs as a tie-breaker
      if (aScore === bScore) {
        const aRec = a.recommendationCount ?? a.reviewCount ?? 0;
        const bRec = b.recommendationCount ?? b.reviewCount ?? 0;
        const aRatingScore = (a.rating ?? 0) * 100 + aRec;
        const bRatingScore = (b.rating ?? 0) * 100 + bRec;
        return bRatingScore - aRatingScore;
      }
      return bScore - aScore;
    });
  }, [topContractors]);

  const snapshot = useMemo(() => {
    const rated = ranked.filter((c) => typeof c.rating === "number");
    const avgRating =
      rated.length > 0 ? rated.reduce((sum, c) => sum + (c.rating ?? 0), 0) / rated.length : null;
    const totalRecs = ranked.reduce(
      (sum, c) => sum + (c.recommendationCount ?? c.reviewCount ?? 0),
      0
    );
    const topRating = rated.reduce((max, c) => Math.max(max, c.rating ?? 0), 0);
    return {
      results: ranked.length,
      avgRating,
      totalRecs,
      topRating: rated.length > 0 ? topRating : null,
    };
  }, [ranked]);

  const featured = useMemo(() => ranked.slice(0, 3), [ranked]);

  const handleStateChange = (value: string) => {
    setStateCode(value);
  };

  const handleCountyChange = (value: string) => {
    setCountyFips(value);
    if (value && stateCode) {
      setSessionLocationOverride({
        stateCode,
        countyFips: value,
        countyName: undefined,
        countyId: undefined,
        lat: undefined,
        lng: undefined,
        label: undefined,
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8 space-y-10">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-ts-orange/10 px-3 py-1.5 text-sm text-ts-orange">
          <Zap className="h-4 w-4" />
          <span>Scout drives the workflow end-to-end</span>
        </div>
        <h1 className="text-4xl font-bold text-white">{title}</h1>
        <p className="text-white/70 max-w-3xl">
          Pick your location and trade to see the most recommended pros in your area.
        </p>
      </header>

      <div className="ts-section space-y-4">
        <div className="flex items-center gap-2 text-ts-orange">
          <Search className="h-5 w-5" />
          <span className="font-semibold">Search contractors</span>
        </div>

        <StateCountySelector
          selectedState={stateCode}
          selectedCounty={countyFips}
          onStateChange={handleStateChange}
          onCountyChange={handleCountyChange}
          className="mt-2"
        />

        <div className="grid md:grid-cols-3 gap-4">
          <Select value={tradeSlug} onValueChange={setTradeSlug}>
            <SelectTrigger className="bg-tsCard text-white border border-white/10">
              <SelectValue placeholder="Select trade/occupation" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {trades.map((trade: any) => (
                <SelectItem key={trade.slug} value={trade.slug}>
                  {trade.name || trade.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            disabled={!countyCommitted || !tradeSlug}
            onClick={() => refetchTopContractors()}
            className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 text-sm rounded-xl flex items-center gap-2 font-semibold transition-all border border-ts-orange/30 focus-visible:ring-2 focus-visible:ring-ts-orange/70"
          >
            {topFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>{topFetching ? "Fetching…" : "Fetch top contractors"}</span>
          </Button>
        </div>
      </div>

      <div className="ts-tile p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
          <Sparkles className="h-4 w-4 text-ts-orange" />
          <span>Helper</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-white/70">
          <Badge variant="outline" className="border-ts-orange/30 text-ts-orange">
            Pick your state + county
          </Badge>
          <Badge variant="outline" className="border-blue-400/40 text-blue-200">
            Choose the trade (occupation)
          </Badge>
          <Badge variant="outline" className="border-emerald-400/40 text-emerald-200">
            Ranked by local presence + credibility
          </Badge>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Top contractors in your area</h2>
            <p className="text-sm text-white/70">
              Ranked by local presence, community credibility, and service area.
            </p>
          </div>
          <Badge className="bg-ts-orange-dark text-white">
            {countyFips && tradeSlug ? `${ranked.length} results` : "Select location + trade"}
          </Badge>
        </div>

        {!countyFips || !tradeSlug ? (
          <div className="ts-tile p-6 text-sm text-white/60">
            Choose your location and trade to see the top recommended contractors near you.
          </div>
        ) : topLoading ? (
          <div className="flex items-center gap-3 text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching ranked contractors…
          </div>
        ) : ranked.length === 0 ? (
          <div className="ts-tile p-6 text-sm text-white/70">
            No contractors found for that trade in your area yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {ranked.map((contractor, idx) => (
              <div
                key={contractor.id}
                className="ts-card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <Badge className="bg-ts-orange-dark text-white text-sm px-3 py-1">
                    #{idx + 1}
                  </Badge>
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {contractor.businessName || contractor.name || "Contractor"}
                    </div>
                    <div className="text-sm text-white/60 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-ts-orange" />
                      {(contractor.trades && contractor.trades.join(", ")) || "Trade not listed"}
                    </div>
                    <div className="text-sm text-white/60 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-teal-300" />
                      {sanitizeAreaLabel(
                        contractor.location || contractor.county || "County selected"
                      )}
                    </div>
                    {contractor.presenceLabel && (
                      <div className="text-xs text-white/70 mt-1">
                        {contractor.presenceLabel}
                        {contractor.localStats &&
                          (contractor.localStats.jobsCompleted > 0 ||
                            contractor.localStats.peopleHelped > 0) && (
                            <span className="text-white/60">
                              {" "}
                              - {contractor.localStats.jobsCompleted} jobs completed,{" "}
                              {contractor.localStats.peopleHelped} people helped
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-white/70">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-ts-orange" />
                    <span>
                      CVS{" "}
                      {typeof (contractor as any).cvsScore === "number"
                        ? Math.round((contractor as any).cvsScore)
                        : typeof contractor.rating === "number"
                          ? Math.round(contractor.rating)
                          : "pending"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4 text-emerald-400" />
                    <span>
                      {contractor.recommendationCount ?? contractor.reviewCount ?? 0} recs
                    </span>
                  </div>
                  {typeof contractor.connectionRecommendationCount === "number" && (
                    <div className="text-xs text-blue-200">
                      {contractor.connectionRecommendationCount} from your connections
                    </div>
                  )}
                  {contractor.licenseNumber && (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-100">
                      Licensed
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 ts-section space-y-3">
          <div className="flex items-center gap-2 text-teal-200">
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold">Search snapshot</span>
          </div>
          <p className="text-sm text-white/70">
            {countyFips && tradeSlug
              ? "Summary for your current location + trade selection."
              : "Select a location and trade to see summary stats."}
          </p>
        </div>

        <div className="ts-section space-y-4">
          <div className="flex items-center gap-2 text-ts-orange">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-semibold">At a glance</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="ts-tile p-4">
              <div className="text-xs uppercase tracking-wide text-white/60">Results</div>
              <div className="text-2xl font-semibold text-ts-orange">
                {countyFips && tradeSlug ? snapshot.results : "-"}
              </div>
            </div>
            <div className="ts-tile p-4">
              <div className="text-xs uppercase tracking-wide text-white/60">Avg. CVS</div>
              <div className="text-2xl font-semibold text-ts-orange">
                {countyFips && tradeSlug && snapshot.avgRating !== null
                  ? snapshot.avgRating.toFixed(0)
                  : "-"}
              </div>
            </div>
            <div className="ts-tile p-4">
              <div className="text-xs uppercase tracking-wide text-white/60">Total Recs</div>
              <div className="text-2xl font-semibold text-ts-orange">
                {countyFips && tradeSlug ? snapshot.totalRecs : "-"}
              </div>
            </div>
            <div className="ts-tile p-4">
              <div className="text-xs uppercase tracking-wide text-white/60">Top CVS</div>
              <div className="text-2xl font-semibold text-ts-orange">
                {countyFips && tradeSlug && snapshot.topRating !== null
                  ? snapshot.topRating.toFixed(0)
                  : "-"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ts-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Quick actions</h2>
          <span className="text-sm text-white/60">For pros and homeowners</span>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <div key={action.title} className="ts-card p-4">
              <h3 className="text-lg font-semibold text-ts-orange">{action.title}</h3>
              <p className="text-white/70 text-sm mt-2">{action.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ts-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Top trust matches</h2>
          <span className="text-sm text-white/60">Verified and community-backed</span>
        </div>
        {!countyFips || !tradeSlug ? (
          <div className="ts-tile p-6 text-sm text-white/60">
            Select a location and trade to see trust-ranked contractors.
          </div>
        ) : featured.length === 0 ? (
          <div className="ts-tile p-6 text-sm text-white/70">
            No trust-ranked contractors available for this selection yet.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((contractor) => (
              <div key={contractor.id} className="ts-card p-5">
                <h3 className="text-xl font-semibold mb-2 ts-accent-text-muted">
                  {contractor.businessName || contractor.name || "Contractor"}
                </h3>
                <p className="text-white/70 mb-4">
                  {(contractor.trades && contractor.trades.join(", ")) || "Trade not listed"}
                </p>
                <div className="flex justify-between items-center text-sm">
                  <span className="ts-accent-text">
                    Trust (CVS):{" "}
                    {typeof (contractor as any).cvsScore === "number"
                      ? (contractor as any).cvsScore.toFixed(0)
                      : typeof (contractor as any).rating === "number"
                        ? (contractor as any).rating.toFixed(0)
                        : "pending"}
                  </span>
                  <a
                    className="ts-accent-btn px-3 py-2 rounded-lg transition-colors"
                    href={
                      contractor.canonicalBusinessProfileUrl ||
                      `/contractors/${encodeURIComponent(contractor.id)}`
                    }
                  >
                    View profile
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ts-card accent-soft p-6 text-center space-y-3">
        <h3 className="text-xl font-semibold ts-accent-text-muted">Not sure where to start?</h3>
        <p
          className="text-white max-w-3xl mx-auto"
          style={{ color: "var(--theme-text-secondary)" }}
        >
          Start a request to draft bids, verify licenses, or queue tasks on your board. Or jump in
          with search, quick actions, and the featured list - no waiting on chat.
        </p>
      </section>
    </div>
  );
});

export default FindContractors;
