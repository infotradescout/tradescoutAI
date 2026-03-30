import { memo, useMemo } from "react";
import { Link, useParams } from "wouter";
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

  const counties = useMemo(() => (state ? getCountiesByState(state.code) : []), [state]);

  if (!trade || !state) {
    return (
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
    );
  }

  const title = `${trade.name} in ${state.name} | Local Directory | TradeScout`;
  const description = `Browse ${trade.name} in ${state.name} by local market. Start with the place you care about, then narrow to city or neighborhood.`;
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
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white">
              {trade.name} in {state.name}
            </CardTitle>
            <p className="text-white/60">
              Pick the local market you want to start in, then narrow by city or neighborhood.{" "}
              {localBrowseCopy()}
            </p>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {counties.map((county) => {
                const countySlug = nameToSlug(
                  county.name.replace(/\s+County$/i, "").trim() || county.name
                );
                return (
                  <Link
                    key={county.fipsCode}
                    href={`/trade/${encodeURIComponent(trade.canonicalSlug)}/${encodeURIComponent(
                      state.code.toLowerCase()
                    )}/${encodeURIComponent(countySlug)}`}
                  >
                    <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                      {toLocalMarketLabel(stripCountySuffix(county.name), state.code)}
                    </a>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
});

export default TradeStatePage;
