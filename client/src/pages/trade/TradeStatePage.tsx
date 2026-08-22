import { memo, useMemo } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPinned, ShieldCheck } from "lucide-react";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStateByCode, getCountiesByState } from "@shared/states-counties";
import { getTradeDisplay, nameToSlug } from "./tradeSeoHelpers";
import { localBrowseCopy, stripCountySuffix, toLocalMarketLabel } from "@/lib/userFacingCopy";

const TradeStatePage = memo(function TradeStatePage() {
  const { tradeSlug, stateCode } = useParams<{ tradeSlug: string; stateCode: string }>();
  const trade = useMemo(() => getTradeDisplay(tradeSlug), [tradeSlug]);
  const state = useMemo(
    () => (stateCode ? getStateByCode(stateCode.toUpperCase()) : null),
    [stateCode]
  );
  const canonicalTradeSlug = trade?.canonicalSlug || "";
  const canonicalStateCode = state?.code || "";

  const { data, isLoading, isError } = useQuery<{
    counties: Array<{ countySlug: string; businessCount: number }>;
  }>({
    queryKey: [
      "/api/public/seo/directory-navigation",
      canonicalTradeSlug,
      canonicalStateCode,
      "counties",
    ],
    enabled: Boolean(canonicalTradeSlug && canonicalStateCode),
    queryFn: async () => {
      const response = await fetch(
        `/api/public/seo/directory-navigation?tradeSlug=${encodeURIComponent(
          canonicalTradeSlug
        )}&stateCode=${encodeURIComponent(canonicalStateCode)}`
      );
      if (!response.ok) throw new Error(`Failed to load county navigation (${response.status})`);
      return response.json();
    },
    retry: 1,
  });

  if (!trade || !state) {
    return (
      <>
        <SEOHelmet
          title="Trade Directory | TradeScout"
          description="Browse trade categories and state market pages on TradeScout."
          canonical="https://www.thetradescout.com/trade"
          noIndex
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-center">
              <h1 className="text-2xl font-bold text-red-900 mb-2">Page Not Found</h1>
              <p className="text-red-700 mb-4">The requested trade/state could not be resolved.</p>
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

  const availableCounties = getCountiesByState(state.code);
  const counties = (data?.counties || [])
    .map((scope) => {
      const county = availableCounties.find(
        (item) =>
          nameToSlug(item.name.replace(/\s+County$/i, "").trim() || item.name) === scope.countySlug
      );
      return county
        ? { ...county, countySlug: scope.countySlug, businessCount: scope.businessCount }
        : null;
    })
    .filter(Boolean) as Array<
    (typeof availableCounties)[number] & { countySlug: string; businessCount: number }
  >;
  const shouldNoIndex = !isLoading && (isError || counties.length === 0);

  const title = `${trade.name} Contractors in ${state.name} | TradeScout`;
  const description = `Find ${trade.name} contractors in ${state.name}. Start with the local market you care about, then narrow to city or neighborhood.`;
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Trades", url: "/trade" },
    { name: trade.name, url: `/trade/${trade.canonicalSlug}` },
    { name: state.name, url: "" },
  ];

  return (
    <>
      <SEOHelmet
        title={title}
        description={description}
        keywords={`${trade.name}, ${state.name}, local contractors, directory, TradeScout`}
        canonical={`https://www.thetradescout.com/trade/${encodeURIComponent(
          trade.canonicalSlug
        )}/${encodeURIComponent(state.code.toLowerCase())}`}
        structuredData={createBreadcrumbStructuredData(breadcrumbs)}
        noIndex={shouldNoIndex}
      />

      <div className="bg-tsBg text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mb-8 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-sm font-medium text-ts-orange">
              <MapPinned className="h-4 w-4" />
              County-contained routing
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {trade.name} in {state.name}
            </h1>
            <p className="text-lg leading-relaxed text-white/70">
              Pick the local market you want to start in, then narrow by city or neighborhood.{" "}
              {localBrowseCopy()}
            </p>
          </div>

          <Card className="border-white/10 bg-white/[0.04] shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-white">
                <ShieldCheck className="h-5 w-5 text-ts-orange" />
                Select a county
              </CardTitle>
              <p className="text-white/60">Choose the market before comparing businesses.</p>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {counties.map((county) => {
                  return (
                    <Link
                      key={county.fipsCode}
                      href={`/trade/${encodeURIComponent(trade.canonicalSlug)}/${encodeURIComponent(
                        state.code.toLowerCase()
                      )}/${encodeURIComponent(county.countySlug)}`}
                    >
                      <a className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:border-ts-orange/40 hover:bg-white/[0.08]">
                        <span>
                          {toLocalMarketLabel(stripCountySuffix(county.name), state.code)}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-white/45">
                            {county.businessCount.toLocaleString()}
                          </span>
                          <ArrowRight className="h-4 w-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-ts-orange" />
                        </span>
                      </a>
                    </Link>
                  );
                })}
              </div>
              {!isLoading && counties.length === 0 ? (
                <p className="text-sm text-white/60">
                  No recent public directory coverage is available in this state for this trade yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
});

export default TradeStatePage;
