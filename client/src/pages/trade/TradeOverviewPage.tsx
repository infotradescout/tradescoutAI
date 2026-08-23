import { memo, useMemo } from "react";
import { Link, useParams } from "wouter";
import { ArrowRight, MapPinned, ShieldCheck } from "lucide-react";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { US_STATES_COUNTIES } from "@shared/states-counties";
import { getTradeDisplay } from "./tradeSeoHelpers";
import { useQuery } from "@tanstack/react-query";
import { getDiscoveryScopeRobotsDecision } from "@/lib/discoveryScopeIndexability";

type TradeStateNavigationResponse = {
  states: Array<{ stateCode: string; coverageCount: number }>;
};

const TradeOverviewPage = memo(function TradeOverviewPage() {
  const { tradeSlug } = useParams<{ tradeSlug: string }>();
  const trade = useMemo(() => getTradeDisplay(tradeSlug), [tradeSlug]);
  const { data, isLoading, isError } = useQuery<TradeStateNavigationResponse>({
    queryKey: ["/api/public/seo/directory-navigation", trade?.canonicalSlug, "states"],
    enabled: Boolean(trade?.canonicalSlug),
    queryFn: async () => {
      const response = await fetch(
        `/api/public/seo/directory-navigation?tradeSlug=${encodeURIComponent(trade!.canonicalSlug)}`
      );
      if (!response.ok) throw new Error(`Failed to load trade states (${response.status})`);
      return response.json();
    },
    retry: 1,
  });

  if (!trade) {
    return (
      <>
        <SEOHelmet
          title="Trade Directory | TradeScout"
          description="Browse trade categories and local market pages on TradeScout."
          canonical="https://www.thetradescout.com/trade"
          noIndex
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-center">
              <h1 className="text-2xl font-bold text-red-900 mb-2">Trade Not Found</h1>
              <p className="text-red-700 mb-4">The requested trade could not be resolved.</p>
              <Link href="/county-directory">
                <a className="inline-block px-4 py-2 bg-ts-orange text-white rounded hover:bg-ts-orange-dark">
                  Browse Counties
                </a>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const title = `${trade.name} by State | TradeScout`;
  const description = `Browse ${trade.name} by state. Select a state and county to view local directory listings. Contact remains protected through TradeScout Direct Connect.`;
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Trades", url: "/trade" },
    { name: trade.name, url: "" },
  ];
  const activeStates = (data?.states || [])
    .map((scope) => {
      const state = US_STATES_COUNTIES.find(
        (candidate) => candidate.code.toUpperCase() === scope.stateCode.toUpperCase()
      );
      return state ? { ...state, coverageCount: scope.coverageCount } : null;
    })
    .filter(Boolean) as Array<(typeof US_STATES_COUNTIES)[number] & { coverageCount: number }>;
  const robotsDecision = getDiscoveryScopeRobotsDecision({
    isLoading,
    hasError: isError,
    itemCount: activeStates.length,
  });

  return (
    <>
      <SEOHelmet
        title={title}
        description={description}
        keywords={`${trade.name}, ${trade.canonicalSlug}, contractors, directory, counties, TradeScout`}
        canonical={`https://www.thetradescout.com/trade/${encodeURIComponent(trade.canonicalSlug)}`}
        structuredData={createBreadcrumbStructuredData(breadcrumbs)}
        noIndex={robotsDecision.noIndex}
        preserveRobots={robotsDecision.preserveRobots}
      />

      <div className="bg-tsBg text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mb-8 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-sm font-medium text-ts-orange">
              <MapPinned className="h-4 w-4" />
              State routing
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">{trade.name}</h1>
            <p className="text-lg leading-relaxed text-white/70">
              Choose a state to browse county directories. Listings may be unclaimed; verification
              is shown on each business page.
            </p>
          </div>

          <Card className="border-white/10 bg-white/[0.04] shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-white">
                <ShieldCheck className="h-5 w-5 text-ts-orange" />
                Select a state
              </CardTitle>
              <p className="text-white/60">Open the local market before any contact path opens.</p>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {activeStates.map((state) => (
                  <Link
                    key={state.code}
                    href={`/trade/${encodeURIComponent(trade.canonicalSlug)}/${encodeURIComponent(
                      state.code.toLowerCase()
                    )}`}
                  >
                    <a className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:border-ts-orange/40 hover:bg-white/[0.08]">
                      <span>{state.name}</span>
                      <ArrowRight className="h-4 w-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-ts-orange" />
                    </a>
                  </Link>
                ))}
              </div>
              {!isLoading && activeStates.length === 0 ? (
                <p className="text-sm text-white/60">
                  No recent public coverage is available for this trade yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
});

export default TradeOverviewPage;
