import { memo, useMemo } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDiscoveryScopeRobotsDecision } from "@/lib/discoveryScopeIndexability";

type CityCountyFacet = {
  countyFips: string;
  countyName: string;
  stateCode: string;
  countySlug: string;
  businessCount: number;
};

type CityFacetResponse = {
  citySlug: string;
  stateCode: string;
  displayCity: string;
  counties: CityCountyFacet[];
};

function titleizeCitySlug(slug: string): string {
  const cleaned = String(slug || "")
    .trim()
    .replace(/-+/g, " ")
    .trim();
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

const CityPage = memo(function CityPage() {
  const { stateCode, citySlug } = useParams<{ stateCode: string; citySlug: string }>();
  const state = String(stateCode || "").toUpperCase();
  const city = String(citySlug || "").toLowerCase();

  const { data, isLoading, isError } = useQuery<CityFacetResponse>({
    queryKey: ["/api/public/cities", state, city],
    enabled: Boolean(state && city),
    queryFn: async () => {
      const res = await fetch(
        `/api/public/cities/${encodeURIComponent(state)}/${encodeURIComponent(city)}`
      );
      if (!res.ok) throw new Error(`Failed to load city (${res.status})`);
      return (await res.json()) as CityFacetResponse;
    },
    retry: 1,
  });

  const displayCity = data?.displayCity || titleizeCitySlug(city);
  const counties = Array.isArray(data?.counties) ? data!.counties : [];
  const robotsDecision = getDiscoveryScopeRobotsDecision({
    isLoading,
    hasError: isError,
    itemCount: counties.length,
  });

  const title = `${displayCity}, ${state} Contractors Directory | TradeScout`;
  const description = `Browse contractors and businesses in ${displayCity}, ${state}. Select a county to view directory listings. Contact remains protected through TradeScout Direct Connect.`;
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: `${displayCity}, ${state}`, url: "" },
  ];

  return (
    <>
      <SEOHelmet
        title={title}
        description={description}
        keywords={`${displayCity}, ${state}, contractors, directory, counties, TradeScout`}
        canonical={`https://www.thetradescout.com/city/${encodeURIComponent(
          state.toLowerCase()
        )}/${encodeURIComponent(city)}`}
        structuredData={createBreadcrumbStructuredData(breadcrumbs)}
        noIndex={robotsDecision.noIndex}
        preserveRobots={robotsDecision.preserveRobots}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            {displayCity}, {state}
          </h1>
          <p className="text-white/60">
            City landing pages link into county-contained directories (bots and humans). Listings
            may be unclaimed.
          </p>
        </div>

        <Card className="bg-white/5 border-white/10 mb-6">
          <CardContent className="p-4">
            <Input value={displayCity} readOnly />
          </CardContent>
        </Card>

        {isLoading ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 text-white/70">Loading city coverage…</CardContent>
          </Card>
        ) : isError ? (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-red-700">Failed to load city coverage.</CardContent>
          </Card>
        ) : counties.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 text-white/70">
              No directory coverage found for this city yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Counties</CardTitle>
              <p className="text-white/60 text-sm">
                Choose a county to browse directory listings filtered to this city.
              </p>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {counties.map((c) => (
                  <Link
                    key={c.countyFips}
                    href={`/county/${encodeURIComponent(state.toLowerCase())}/${encodeURIComponent(
                      c.countySlug
                    )}`}
                  >
                    <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                      {c.countyName} ({c.businessCount.toLocaleString()})
                    </a>
                  </Link>
                ))}
              </div>

              <div className="mt-4 text-xs text-white/60">
                Tip: trade pages work best at the county level. Example:{" "}
                <span className="text-white/70">
                  /trade/plumbing/{state.toLowerCase()}/{counties[0]?.countySlug}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
});

export default CityPage;
