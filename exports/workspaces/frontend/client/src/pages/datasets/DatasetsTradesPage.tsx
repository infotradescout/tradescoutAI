import { memo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TradesResponse = { items: Array<{ slug: string; name: string }> };

const DatasetsTradesPage = memo(function DatasetsTradesPage() {
  const { data, isLoading, isError } = useQuery<TradesResponse>({
    queryKey: ["/api/public/datasets/trades"],
    queryFn: async () => {
      const res = await fetch("/api/public/datasets/trades");
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return (await res.json()) as TradesResponse;
    },
    retry: 1,
  });

  const items = Array.isArray(data?.items) ? data!.items : [];

  return (
    <>
      <SEOHelmet
        title="Trades Dataset | TradeScout"
        description="Public list of trade categories for directory discovery."
        keywords="trades dataset, contractors, directory, TradeScout"
        canonical="https://www.thetradescout.com/datasets/trades"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white">Trades dataset</CardTitle>
            <p className="text-white/60 text-sm">Links jump into crawlable trade pages.</p>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            {isLoading ? (
              <div className="text-white/70 text-sm">Loading…</div>
            ) : isError ? (
              <div className="text-red-200 text-sm">Failed to load.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map((t) => (
                  <Link key={t.slug} href={`/trade/${encodeURIComponent(t.slug)}`}>
                    <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                      {t.name}
                    </a>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
});

export default DatasetsTradesPage;
