import { memo, useMemo } from "react";
import { Link, useParams } from "wouter";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { US_STATES_COUNTIES } from "@shared/states-counties";
import { getTradeDisplay } from "./tradeSeoHelpers";

const TradeOverviewPage = memo(function TradeOverviewPage() {
  const { tradeSlug } = useParams<{ tradeSlug: string }>();
  const trade = useMemo(() => getTradeDisplay(tradeSlug), [tradeSlug]);

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

  return (
    <>
      <SEOHelmet
        title={title}
        description={description}
        keywords={`${trade.name}, ${trade.canonicalSlug}, contractors, directory, counties, TradeScout`}
        canonical={`https://www.thetradescout.com/trade/${encodeURIComponent(trade.canonicalSlug)}`}
        structuredData={createBreadcrumbStructuredData(breadcrumbs)}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white">{trade.name}</CardTitle>
            <p className="text-white/60">
              Choose a state to browse county directories. Listings may be unclaimed; verification
              is shown on each business page.
            </p>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {US_STATES_COUNTIES.map((state) => (
                <Link
                  key={state.code}
                  href={`/trade/${encodeURIComponent(trade.canonicalSlug)}/${encodeURIComponent(
                    state.code.toLowerCase()
                  )}`}
                >
                  <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                    {state.name}
                  </a>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
});

export default TradeOverviewPage;
