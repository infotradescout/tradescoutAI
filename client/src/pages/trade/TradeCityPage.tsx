import { memo, useMemo } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, MapPinned } from "lucide-react";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTradeDisplay } from "./tradeSeoHelpers";
import { getDiscoveryScopeRobotsDecision } from "@/lib/discoveryScopeIndexability";

type TradeCityCountyFacet = {
  countyFips: string;
  countyName: string;
  stateCode: string;
  countySlug: string;
  businessCount: number;
};

type TradeCityFacetResponse = {
  tradeSlug: string;
  stateCode: string;
  citySlug: string;
  displayCity: string;
  counties: TradeCityCountyFacet[];
};

function titleizeCitySlug(slug: string): string {
  const cleaned = String(slug || "")
    .trim()
    .replace(/-+/g, " ")
    .trim();
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

const TradeCityPage = memo(function TradeCityPage() {
  const { tradeSlug, stateCode, citySlug } = useParams<{
    tradeSlug: string;
    stateCode: string;
    citySlug: string;
  }>();

  const trade = useMemo(() => getTradeDisplay(tradeSlug), [tradeSlug]);
  const state = String(stateCode || "").toUpperCase();
  const city = String(citySlug || "").toLowerCase();

  const { data, isLoading, isError, refetch } = useQuery<TradeCityFacetResponse>({
    queryKey: ["/api/public/trade-cities", trade?.canonicalSlug || "", state, city],
    enabled: Boolean(trade?.canonicalSlug && state && city),
    queryFn: async () => {
      const res = await fetch(
        `/api/public/trade-cities/${encodeURIComponent(trade!.canonicalSlug)}/${encodeURIComponent(
          state
        )}/${encodeURIComponent(city)}`
      );
      if (!res.ok) throw new Error(`Failed to load trade-city (${res.status})`);
      return (await res.json()) as TradeCityFacetResponse;
    },
    retry: 1,
  });

  if (!trade) {
    return (
      <>
        <SEOHelmet
          title="Trade Directory | TradeScout"
          description="Browse trade categories and local city coverage pages on TradeScout."
          canonical="https://www.thetradescout.com/trade"
          noIndex
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-center">
              <h1 className="text-2xl font-bold text-red-900 mb-2">Trade Not Found</h1>
              <p className="text-red-700 mb-4">The requested trade could not be resolved.</p>
              <Link href="/trade">
                <a className="inline-block px-4 py-2 bg-ts-orange text-white rounded hover:bg-ts-orange-dark">
                  Browse Trades
                </a>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const displayCity = data?.displayCity || titleizeCitySlug(city);
  const counties = Array.isArray(data?.counties) ? data!.counties : [];
  const robotsDecision = getDiscoveryScopeRobotsDecision({
    isLoading,
    hasError: isError,
    itemCount: counties.length,
  });
  const stateRoute = `/trade/${encodeURIComponent(trade.canonicalSlug)}/${encodeURIComponent(
    state.toLowerCase()
  )}`;
  const scoutEstimateHref = `/scout?intent=estimate&source=trade_city_empty&trade=${encodeURIComponent(
    trade.canonicalSlug
  )}&state=${encodeURIComponent(state)}&city=${encodeURIComponent(displayCity)}`;

  const title = `${trade.name} in ${displayCity}, ${state} | TradeScout`;
  const description = `Browse ${trade.name} in ${displayCity}, ${state}. Select a county to view county-contained directory listings.`;
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Trades", url: "/trade" },
    { name: trade.name, url: `/trade/${trade.canonicalSlug}` },
    { name: `${displayCity}, ${state}`, url: "" },
  ];

  return (
    <>
      <SEOHelmet
        title={title}
        description={description}
        keywords={`${trade.name}, ${displayCity}, ${state}, contractors, directory, TradeScout`}
        canonical={`https://www.thetradescout.com/trade/${encodeURIComponent(
          trade.canonicalSlug
        )}/${encodeURIComponent(state.toLowerCase())}/city/${encodeURIComponent(city)}`}
        structuredData={createBreadcrumbStructuredData(breadcrumbs)}
        noIndex={robotsDecision.noIndex}
        preserveRobots={robotsDecision.preserveRobots}
      />

      <div className="bg-tsBg text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mb-8 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-sm font-medium text-ts-orange">
              <MapPinned className="h-4 w-4" />
              City-to-county route
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {trade.name} in {displayCity}, {state}
            </h1>
            <p className="text-lg leading-relaxed text-white/70">
              City pages route into county directories (keeps counties as operational containers).
            </p>
          </div>

          {isLoading ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 text-white/70">Loading trade-city coverage…</CardContent>
            </Card>
          ) : isError ? (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6 space-y-4">
                <p className="text-red-700">Failed to load coverage.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void refetch()}>
                    Try again
                  </Button>
                  <Link href={stateRoute}>
                    <a className="inline-flex items-center rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-50">
                      Browse state markets
                    </a>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : counties.length === 0 ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 space-y-4">
                <p className="text-white/80">No county coverage matched this city page yet.</p>
                <p className="text-sm text-white/60">
                  Keep moving: open the state market, browse county directory, or use Scout search
                  to route your request.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href={stateRoute}>
                    <a className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15">
                      Browse {state}
                    </a>
                  </Link>
                  <Link href="/county-directory">
                    <a className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15">
                      Open county directory
                    </a>
                  </Link>
                  <Link href={scoutEstimateHref}>
                    <a className="inline-flex items-center rounded-md bg-ts-orange px-4 py-2 text-sm font-medium text-white hover:bg-ts-orange-dark">
                      Start a Request
                    </a>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/10 bg-white/[0.04] shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl text-white">
                  <Building2 className="h-5 w-5 text-ts-orange" />
                  Counties
                </CardTitle>
                <p className="text-white/60 text-sm">
                  Choose a county to browse listings filtered to this city.
                </p>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {counties.map((c) => (
                    <Link
                      key={c.countyFips}
                      href={`/trade/${encodeURIComponent(trade.canonicalSlug)}/${encodeURIComponent(
                        state.toLowerCase()
                      )}/${encodeURIComponent(c.countySlug)}?city=${encodeURIComponent(city)}`}
                    >
                      <a className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:border-ts-orange/40 hover:bg-white/[0.08]">
                        <span>
                          {c.countyName} ({c.businessCount.toLocaleString()})
                        </span>
                        <ArrowRight className="h-4 w-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-ts-orange" />
                      </a>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
});

export default TradeCityPage;
