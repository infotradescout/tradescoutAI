import type { FormEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, MapPinned, Search, ShieldCheck } from "lucide-react";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { Card, CardContent } from "@/components/ui/card";
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

      <div className="min-h-screen bg-tsBg text-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-col gap-4 border-b border-[color:var(--border-subtle)] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--ts-radius-chip)] border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-ts-orange">
                <MapPinned className="h-4 w-4" />
                County market
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {trade.name} in {marketLabel}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
                Start with the local market, then narrow by city or neighborhood.{" "}
                {localBrowseCopy()}
              </p>
            </div>
            <div className="grid grid-cols-3 overflow-hidden rounded-[var(--ts-radius-card)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-center">
              <div className="px-4 py-3">
                <div className="text-lg font-semibold">{items.length}</div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">Shown</div>
              </div>
              <div className="border-x border-[color:var(--border-subtle)] px-4 py-3">
                <div className="text-lg font-semibold">{limit}</div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Page size
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-lg font-semibold">{offset}</div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">Offset</div>
              </div>
            </div>
          </div>

          <Card className="mb-4">
            <CardContent className="p-4">
              <form className="grid gap-3 md:grid-cols-[1fr_0.75fr_auto]" onSubmit={onSearch}>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-white/45" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={`Search ${trade.name} in ${stripCountySuffix(county.name)}...`}
                    className="pl-10"
                  />
                </div>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City (optional)"
                />
                <Button type="submit" variant="secondary" className="gap-2">
                  <Search className="h-4 w-4" />
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
                  Keep moving: expand to state markets, reset the city filter, or use Scout search
                  to route this request.
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
                      Start a Request
                    </a>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((biz) => (
                <Link key={biz.id} href={`/business/${encodeURIComponent(biz.slug)}`}>
                  <a className="group overflow-hidden rounded-[var(--ts-radius-panel)] border border-white/10 bg-[color:var(--surface-card)] shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:border-ts-orange/40">
                    <div className="relative h-20 border-b border-white/10 bg-black">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_0%,rgba(255,107,0,0.26),transparent_34%),linear-gradient(135deg,rgba(255,107,0,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.72))]" />
                      <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/58">
                        <Building2 className="h-3.5 w-3.5 text-ts-orange" />
                        Business home
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="-mt-10 mb-3 flex items-end justify-between gap-3">
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-ts-orange bg-black text-lg font-bold text-white shadow-lg shadow-black/40">
                          {biz.name
                            .split(/\s+/)
                            .map((word) => word[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <Badge
                          variant={biz.claimStatus === "claimed" ? "default" : "secondary"}
                          className="w-fit shrink-0"
                        >
                          {biz.claimStatus === "claimed" ? (
                            <ShieldCheck className="mr-1 h-3 w-3" />
                          ) : null}
                          {biz.claimStatus === "claimed" ? "Claimed" : "Unclaimed"}
                        </Badge>
                      </div>
                      <div className="truncate text-lg font-semibold text-white group-hover:text-ts-orange">
                        {biz.name}
                      </div>
                      <p className="mt-2 text-sm leading-5 text-white/62">
                        {trade.name} profile in {marketLabel}. Contact stays protected through
                        Direct Connect.
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/70">
                        <div className="rounded-[var(--ts-radius-control)] border border-white/10 bg-white/[0.045] p-2">
                          <div className="font-semibold uppercase tracking-[0.12em] text-white/44">
                            Trade
                          </div>
                          <div className="mt-1 truncate">{trade.name}</div>
                        </div>
                        <div className="rounded-[var(--ts-radius-control)] border border-white/10 bg-white/[0.045] p-2">
                          <div className="font-semibold uppercase tracking-[0.12em] text-white/44">
                            Contact
                          </div>
                          <div className="mt-1">Protected</div>
                        </div>
                      </div>
                      <div className="mt-4 inline-flex items-center text-sm font-semibold text-ts-orange">
                        View Profile
                        <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </a>
                </Link>
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
      </div>
    </>
  );
});

export default TradeCountyPage;
