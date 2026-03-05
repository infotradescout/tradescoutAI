import { memo } from "react";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIMARY_TRADE_SLUGS, getTradeBySlug } from "@shared/tradeSeo";

const TradeDirectoryPage = memo(function TradeDirectoryPage() {
  const items = PRIMARY_TRADE_SLUGS.map((slug) => {
    const trade = getTradeBySlug(slug);
    return trade ? { slug: trade.slug, name: trade.name } : null;
  }).filter(Boolean) as Array<{ slug: string; name: string }>;

  return (
    <>
      <SEOHelmet
        title="Trades Directory | TradeScout"
        description="Browse trades by category, then select a state and county to view local directory listings."
        keywords="trades, contractors, directory, counties, TradeScout"
        canonical="https://www.thetradescout.com/trade"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white">Trades Directory</CardTitle>
            <p className="text-white/60">
              Select a trade to browse state and county landing pages. Listings may be unclaimed;
              contact stays gated through TradeScout Direct Connect.
            </p>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {items.map((trade) => (
                <Link key={trade.slug} href={`/trade/${encodeURIComponent(trade.slug)}`}>
                  <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                    {trade.name}
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

export default TradeDirectoryPage;
