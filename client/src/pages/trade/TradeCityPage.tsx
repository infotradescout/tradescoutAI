import { memo, useMemo } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTradeDisplay } from "./tradeSeoHelpers";

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

  const { data, isLoading, isError } = useQuery<TradeCityFacetResponse>({
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
    );
  }

  const displayCity = data?.displayCity || titleizeCitySlug(city);
  const counties = Array.isArray(data?.counties) ? data!.counties : [];

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
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            {trade.name} in {displayCity}, {state}
          </h1>
          <p className="text-white/60">
            City pages route into county directories (keeps counties as operational containers).
          </p>
        </div>

        {isLoading ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 text-white/70">Loading trade-city coverage…</CardContent>
          </Card>
        ) : isError ? (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-red-700">Failed to load coverage.</CardContent>
          </Card>
        ) : counties.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 text-white/70">No results found.</CardContent>
          </Card>
        ) : (
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Counties</CardTitle>
              <p className="text-white/60 text-sm">
                Choose a county to browse listings filtered to this city.
              </p>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {counties.map((c) => (
                  <Link
                    key={c.countyFips}
                    href={`/trade/${encodeURIComponent(trade.canonicalSlug)}/${encodeURIComponent(
                      state.toLowerCase()
                    )}/${encodeURIComponent(c.countySlug)}?city=${encodeURIComponent(city)}`}
                  >
                    <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                      {c.countyName} ({c.businessCount.toLocaleString()})
                    </a>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
});

export default TradeCityPage;
