import type { FormEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStateByCode, getCountiesByState } from "@shared/states-counties";
import { getTradeDisplay, nameToSlug } from "./tradeSeoHelpers";
import { localBrowseCopy, stripCountySuffix, toLocalMarketLabel } from "@/lib/userFacingCopy";

type PublicBusinessListItem = {
  id: string;
  name: string;
  slug: string;
  claimStatus: "claimed" | "unclaimed";
  counties: Array<{ fips: string; stateCode: string; name: string }>;
};

type PublicBusinessListResponse = {
  items: PublicBusinessListItem[];
  limit: number;
  offset: number;
};

function findCountyBySlug(stateCode: string, countySlug: string) {
  const state = getStateByCode(stateCode.toUpperCase());
  if (!state) return null;
  const counties = getCountiesByState(state.code);
  return counties.find(
    (c) => nameToSlug(c.name.replace(/\s+County$/i, "").trim() || c.name) === countySlug
  );
}

const TradeCountyPage = memo(function TradeCountyPage() {
  const { tradeSlug, stateCode, countySlug } = useParams<{
    tradeSlug: string;
    stateCode: string;
    countySlug: string;
  }>();
  const [location] = useLocation();

  const trade = useMemo(() => getTradeDisplay(tradeSlug), [tradeSlug]);
  const state = useMemo(
    () => (stateCode ? getStateByCode(stateCode.toUpperCase()) : null),
    [stateCode]
  );
  const county = useMemo(
    () => (state && countySlug ? findCountyBySlug(state.code, countySlug) : null),
    [state, countySlug]
  );

  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    if (city.trim()) return;
    const idx = String(location || "").indexOf("?");
    if (idx < 0) return;
    const params = new URLSearchParams(String(location).slice(idx + 1));
    const cityParam = String(params.get("city") || "").trim();
    if (cityParam) setCity(cityParam);
  }, [city, location]);

  const queryKey = useMemo(
    () => [
      "/api/businesses",
      {
        countyFips: county?.fipsCode || "",
        stateCode: state?.code || "",
        trade: trade?.canonicalSlug || "",
        q,
        city,
        claimed: "any",
        limit,
        offset,
      },
    ],
    [county?.fipsCode, state?.code, trade?.canonicalSlug, q, city, limit, offset]
  );

  const { data, isLoading, isError, refetch } = useQuery<PublicBusinessListResponse>({
    queryKey,
    enabled: Boolean(county?.fipsCode && state?.code && trade?.canonicalSlug),
    queryFn: async () => {
      const params = new URLSearchParams({
        countyFips: String(county?.fipsCode || ""),
        stateCode: String(state?.code || ""),
        trade: String(trade?.canonicalSlug || ""),
        claimed: "any",
        limit: String(limit),
        offset: String(offset),
      });
      if (q.trim()) params.set("q", q.trim());
      if (city.trim()) params.set("city", city.trim());
      const res = await fetch(`/api/businesses?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load businesses (${res.status})`);
      return (await res.json()) as PublicBusinessListResponse;
    },
    retry: 1,
  });

  const onSearch = useCallback((e: FormEvent) => {
    e.preventDefault();
    setOffset(0);
  }, []);

  if (!trade || !state || !county) {
    return (
      <>
        <SEOHelmet
          title="Trade Directory | TradeScout"
          description="Browse county-contained trade directory pages on TradeScout."
          canonical="https://www.thetradescout.com/trade"
          noIndex
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-center">
              <h1 className="text-2xl font-bold text-red-900 mb-2">Page Not Found</h1>
              <p className="text-red-700 mb-4">The requested trade/county could not be resolved.</p>
              <Link href="/county-directory">
                <a className="inline-block px-4 py-2 bg-ts-orange text-white rounded hover:bg-ts-orange-dark">
                  Browse Markets
                </a>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const marketLabel = toLocalMarketLabel(county.name, state.code);
  const title = `Find ${trade.name} Contractors in ${marketLabel} | TradeScout`;
  const description = `Find ${trade.name} contractors serving ${marketLabel}. Narrow by city to get closer to the neighborhood you care about.`;
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Trades", url: "/trade" },
    { name: trade.name, url: `/trade/${trade.canonicalSlug}` },
    { name: state.name, url: `/trade/${trade.canonicalSlug}/${state.code.toLowerCase()}` },
    { name: county.name, url: "" },
  ];

  const items = Array.isArray(data?.items) ? data!.items : [];
  const shouldNoIndex = !isLoading && (isError || items.length === 0);
  const stateRoute = `/trade/${encodeURIComponent(trade.canonicalSlug)}/${encodeURIComponent(
    state.code.toLowerCase()
  )}`;
  const scoutEstimateHref = `/scout?intent=estimate&source=trade_county_empty&trade=${encodeURIComponent(
    trade.canonicalSlug
  )}&state=${encodeURIComponent(state.code)}&county=${encodeURIComponent(
    county.name
  )}&countyFips=${encodeURIComponent(county.fipsCode)}${
    city.trim() ? `&city=${encodeURIComponent(city.trim())}` : ""
  }`;

  return (
    <>
      <SEOHelmet
        title={title}
        description={description}
        keywords={`${trade.name}, ${county.name}, ${state.name}, directory, contractors, TradeScout`}
        canonical={`https://www.thetradescout.com/trade/${encodeURIComponent(
          trade.canonicalSlug
        )}/${encodeURIComponent(state.code.toLowerCase())}/${encodeURIComponent(countySlug)}`}
        structuredData={createBreadcrumbStructuredData(breadcrumbs)}
        noIndex={shouldNoIndex}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            {trade.name} in {marketLabel}
          </h1>
          <p className="text-white/60">
            Start with the local market, then narrow by city or neighborhood. {localBrowseCopy()}
          </p>
        </div>

        <Card className="bg-white/5 border-white/10 mb-6">
          <CardContent className="p-4">
            <form className="flex gap-2" onSubmit={onSearch}>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${trade.name} in ${stripCountySuffix(county.name)}...`}
              />
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City (optional)"
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 text-white/70">Loading directory…</CardContent>
          </Card>
        ) : isError ? (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 space-y-4">
              <p className="text-red-700">Failed to load directory.</p>
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
        ) : items.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 space-y-4">
              <p className="text-white/80">
                No {trade.name.toLowerCase()} listings matched this exact filter yet.
              </p>
              <p className="text-sm text-white/60">
                Keep moving: expand to state markets, reset the city filter, or ask Scout to route
                this request.
              </p>
              <div className="flex flex-wrap gap-2">
                {city.trim() ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCity("");
                      setOffset(0);
                    }}
                  >
                    Clear city filter
                  </Button>
                ) : null}
                <Link href={stateRoute}>
                  <a className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15">
                    Browse {state.name}
                  </a>
                </Link>
                <Link href={scoutEstimateHref}>
                  <a className="inline-flex items-center rounded-md bg-ts-orange px-4 py-2 text-sm font-medium text-white hover:bg-ts-orange-dark">
                    Ask Scout for help
                  </a>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {items.map((biz) => (
              <Card key={biz.id} className="bg-white/5 border-white/10">
                <CardHeader className="py-4">
                  <CardTitle className="text-white text-lg flex items-center justify-between gap-2">
                    <Link href={`/business/${encodeURIComponent(biz.slug)}`}>
                      <a className="hover:underline">{biz.name}</a>
                    </Link>
                    <Badge variant={biz.claimStatus === "claimed" ? "default" : "secondary"}>
                      {biz.claimStatus === "claimed" ? "Claimed" : "Unclaimed"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {items.length === limit ? (
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={() => setOffset((v) => v + limit)}>
              Load more
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
});

export default TradeCountyPage;
