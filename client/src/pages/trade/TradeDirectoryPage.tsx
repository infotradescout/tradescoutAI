import { memo } from "react";
import { Link } from "wouter";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTradeBySlug } from "@shared/tradeSeo";
import { localBrowseCopy } from "@/lib/userFacingCopy";
import { useQuery } from "@tanstack/react-query";
import { getDiscoveryScopeRobotsDecision } from "@/lib/discoveryScopeIndexability";

type TradeNavigationResponse = {
  trades: Array<{ tradeSlug: string; coverageCount: number }>;
};

const TradeDirectoryPage = memo(function TradeDirectoryPage() {
  const { data, isLoading, isError } = useQuery<TradeNavigationResponse>({
    queryKey: ["/api/public/seo/directory-navigation", "trades"],
    queryFn: async () => {
      const response = await fetch("/api/public/seo/directory-navigation");
      if (!response.ok) throw new Error(`Failed to load trade navigation (${response.status})`);
      return response.json();
    },
    retry: 1,
  });
  const items = (data?.trades || [])
    .map((scope) => {
      const trade = getTradeBySlug(scope.tradeSlug);
      return trade
        ? { slug: trade.slug, name: trade.name, coverageCount: scope.coverageCount }
        : null;
    })
    .filter(Boolean) as Array<{ slug: string; name: string; coverageCount: number }>;
  const robotsDecision = getDiscoveryScopeRobotsDecision({
    isLoading,
    hasError: isError,
    itemCount: items.length,
  });

  return (
    <>
      <SEOHelmet
        title="Trades Directory | TradeScout"
        description="Browse trades by category, then jump into the city or local market you care about."
        keywords="trades, contractors, directory, local services, TradeScout"
        canonical="https://www.thetradescout.com/trade"
        noIndex={robotsDecision.noIndex}
        preserveRobots={robotsDecision.preserveRobots}
      />

      <div className="bg-tsBg text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mb-8 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-sm font-medium text-ts-orange">
              <Search className="h-4 w-4" />
              Browse by trade first
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">Trades Directory</h1>
            <p className="text-lg leading-relaxed text-white/70">
              Select a trade, pick your market, and narrow from there by city or neighborhood.{" "}
              {localBrowseCopy()}
            </p>
          </div>

          <Card className="border-white/10 bg-white/[0.04] shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-white">
                <ShieldCheck className="h-5 w-5 text-ts-orange" />
                Start with the work category
              </CardTitle>
              <p className="text-white/60">Browse locally before any contact decision opens.</p>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((trade) => (
                  <Link key={trade.slug} href={`/trade/${encodeURIComponent(trade.slug)}`}>
                    <a className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:border-ts-orange/40 hover:bg-white/[0.08]">
                      <span>{trade.name}</span>
                      <ArrowRight className="h-4 w-4 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-ts-orange" />
                    </a>
                  </Link>
                ))}
              </div>
              {!isLoading && items.length === 0 ? (
                <p className="text-sm text-white/60">No recent public trade coverage yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
});

export default TradeDirectoryPage;
