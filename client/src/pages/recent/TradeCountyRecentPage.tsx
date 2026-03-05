import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Card, CardContent } from "@/components/ui/card";

type RecentItem = { id: string; type: string; occurredAt: string; text: string };
type RecentResponse = { scope: any; items: RecentItem[] };

export default function TradeCountyRecentPage() {
  const { tradeSlug, stateCode, countySlug } = useParams<{
    tradeSlug: string;
    stateCode: string;
    countySlug: string;
  }>();

  const url = `/api/public/seo/recent/trade-county?tradeSlug=${encodeURIComponent(
    tradeSlug || ""
  )}&stateCode=${encodeURIComponent(stateCode || "")}&countySlug=${encodeURIComponent(countySlug || "")}`;

  const { data, isLoading, error } = useQuery<RecentResponse>({
    queryKey: [url],
    retry: 1,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <SEOHelmet
        title="Recent activity | TradeScout"
        description="Public, non-PII activity summaries for this trade scope."
      />

      <Card>
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold text-white mb-2">Recent activity</h1>
          <p className="text-white/70 mb-4">Public summaries only. No contact info.</p>
          <p className="text-white/70 mb-4">
            <Link
              href={`/trade/${encodeURIComponent(tradeSlug || "")}/${encodeURIComponent(
                stateCode || ""
              )}/${encodeURIComponent(countySlug || "")}`}
            >
              <a className="text-blue-200 hover:underline">Back to directory scope</a>
            </Link>
          </p>

          {isLoading ? <p className="text-white/70">Loading…</p> : null}
          {error ? <p className="text-red-200">Failed to load recent activity.</p> : null}

          {data?.items?.length ? (
            <ul className="space-y-2">
              {data.items.map((it) => (
                <li key={it.id} className="text-white/80">
                  {it.text || it.type.replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          ) : data ? (
            <p className="text-white/70">No recent public activity is available for this scope.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
