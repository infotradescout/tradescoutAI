import { memo, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CityRow = { stateCode: string; citySlug: string; updatedAt: string | null };
type CitiesResponse = { items: CityRow[]; limit: number; offset: number };

const PAGE_SIZE = 2000;

const DatasetsCitiesPage = memo(function DatasetsCitiesPage() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError } = useQuery<CitiesResponse>({
    queryKey: ["/api/public/datasets/cities", offset],
    queryFn: async () => {
      const res = await fetch(`/api/public/datasets/cities?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      return (await res.json()) as CitiesResponse;
    },
    retry: 1,
  });

  const items = useMemo(() => (Array.isArray(data?.items) ? data!.items : []), [data]);

  return (
    <>
      <SEOHelmet
        title="Cities Dataset | TradeScout"
        description="Public list of cities (slug form) with directory coverage."
        keywords="cities dataset, contractors, directory, TradeScout"
        canonical="https://www.thetradescout.com/datasets/cities"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white">Cities dataset</CardTitle>
            <p className="text-white/60 text-sm">Paged list (2,000 per page).</p>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            {isLoading ? (
              <div className="text-white/70 text-sm">Loading…</div>
            ) : isError ? (
              <div className="text-red-200 text-sm">Failed to load.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map((c) => (
                  <Link
                    key={`${c.stateCode}:${c.citySlug}`}
                    href={`/city/${encodeURIComponent(c.stateCode.toLowerCase())}/${encodeURIComponent(
                      c.citySlug
                    )}`}
                  >
                    <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                      {c.citySlug}, {c.stateCode}
                    </a>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
                disabled={offset === 0}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                onClick={() => setOffset((v) => v + PAGE_SIZE)}
                disabled={items.length < PAGE_SIZE}
              >
                Next
              </Button>
              <div className="text-xs text-white/60 self-center">Offset: {offset}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
});

export default DatasetsCitiesPage;
