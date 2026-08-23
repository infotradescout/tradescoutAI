import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Card, CardContent } from "@/components/ui/card";

type BestResponse = {
  scope: { tradeSlug: string; stateCode: string; countySlug: string };
  definition: string;
  items: Array<{ slug: string; name: string }>;
};

export default function BestTradeCountyPage() {
  const { tradeSlug, stateCode, countySlug } = useParams<{
    tradeSlug: string;
    stateCode: string;
    countySlug: string;
  }>();

  const url = `/api/public/seo/best/trade-county?tradeSlug=${encodeURIComponent(
    tradeSlug || ""
  )}&stateCode=${encodeURIComponent(stateCode || "")}&countySlug=${encodeURIComponent(
    countySlug || ""
  )}`;

  const { data, isLoading, error } = useQuery<BestResponse>({
    queryKey: [url],
    retry: 1,
  });

  const title = data
    ? `Best ${data.scope.tradeSlug} in ${data.scope.countySlug}, ${data.scope.stateCode} | TradeScout`
    : "Best listings | TradeScout";
  const canonical = `https://www.thetradescout.com/best/${encodeURIComponent(
    tradeSlug || ""
  )}/${encodeURIComponent((stateCode || "").toLowerCase())}/${encodeURIComponent(countySlug || "")}`;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SEOHelmet
        title={title}
        description={data?.definition || "Verified listings in this scope."}
        canonical={canonical}
        noIndex
      />

      <Card>
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold text-white mb-2">Best listings</h1>
          {data?.definition ? <p className="text-white/70 mb-4">{data.definition}</p> : null}

          {isLoading ? <p className="text-white/70">Loading…</p> : null}
          {error ? <p className="text-red-200">Failed to load this page.</p> : null}

          {data && data.items?.length ? (
            <ul className="space-y-2">
              {data.items.map((biz) => (
                <li key={biz.slug}>
                  <Link href={`/business/${encodeURIComponent(biz.slug)}`}>
                    <a className="text-blue-200 hover:underline">{biz.name}</a>
                  </Link>
                </li>
              ))}
            </ul>
          ) : data && !data.items?.length ? (
            <p className="text-white/70">
              No verified listings found in this scope.{" "}
              <Link
                href={`/trade/${encodeURIComponent(tradeSlug || "")}/${encodeURIComponent(
                  (stateCode || "").toLowerCase()
                )}/${encodeURIComponent(countySlug || "")}`}
              >
                <a className="text-blue-200 hover:underline">View all directory listings</a>
              </Link>
              .
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
