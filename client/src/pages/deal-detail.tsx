import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { formatPostedDealEndTime } from "@shared/scoutDealDisplay";

const DEAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTY_FIPS = /^\d{5}$/;

type PublicDeal = {
  id: string;
  title: string;
  description: string;
  startsAt: string | null;
  endsAt: string | null;
  scope: "county" | "global";
  source: string;
};

type PublicDealResponse = { deal: PublicDeal };

class DealRequestError extends Error {
  constructor(readonly status: number) {
    super("TradeDeal request failed");
  }
}

function requestedCounty(): { countyFips: string | null; valid: boolean } {
  if (typeof window === "undefined") return { countyFips: null, valid: true };
  const params = new URLSearchParams(window.location.search);
  if ([...params.keys()].some((key) => key !== "county")) {
    return { countyFips: null, valid: false };
  }
  const counties = params.getAll("county");
  if (counties.length === 0) return { countyFips: null, valid: true };
  return counties.length === 1 && COUNTY_FIPS.test(counties[0])
    ? { countyFips: counties[0], valid: true }
    : { countyFips: null, valid: false };
}

function availableDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export default function DealDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { countyFips, valid: validCounty } = requestedCounty();
  const validId = DEAL_ID.test(id);

  const { data, isLoading, isError, error, refetch } = useQuery<PublicDealResponse>({
    queryKey: ["public-deal-detail", id, countyFips],
    enabled: validId && validCounty,
    retry: false,
    refetchInterval: 30_000,
    queryFn: async () => {
      const countyQuery = countyFips ? `?county=${encodeURIComponent(countyFips)}` : "";
      const response = await fetch(`/api/deals/${encodeURIComponent(id)}${countyQuery}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new DealRequestError(response.status);
      return (await response.json()) as PublicDealResponse;
    },
  });

  const deal = data?.deal;
  const endDate = availableDate(deal?.endsAt ?? null);
  const postedEndTime = formatPostedDealEndTime(endDate);
  const startDate = availableDate(deal?.startsAt ?? null);
  const scopeMatches =
    deal?.scope === "global" || (deal?.scope === "county" && countyFips !== null);
  const readable = Boolean(
    validId &&
    validCounty &&
    deal?.id === id &&
    scopeMatches &&
    (!endDate || endDate.getTime() >= Date.now()) &&
    (!startDate || startDate.getTime() <= Date.now())
  );

  const temporaryError = isError && !(error instanceof DealRequestError && error.status === 404);
  const unavailable =
    !validId ||
    !validCounty ||
    (isError && !temporaryError) ||
    (!isLoading && !isError && !readable);

  return (
    <main className="min-h-[60vh] px-4 py-8 text-primary" data-testid="deal-detail-page">
      <div className="mx-auto max-w-2xl space-y-5">
        {isLoading && !unavailable ? (
          <p role="status" data-testid="deal-detail-loading">
            Checking this TradeDeal…
          </p>
        ) : temporaryError ? (
          <section
            className="rounded-2xl border border-white/15 bg-card p-6"
            data-testid="deal-detail-temporary-error"
          >
            <h1 className="text-2xl font-semibold">
              TradeDeal details are temporarily unavailable
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">Please try again in a moment.</p>
            <button
              className="mt-5 rounded-lg border border-orange-500 px-4 py-2 text-orange-500"
              onClick={() => void refetch()}
              type="button"
            >
              Retry
            </button>
          </section>
        ) : unavailable ? (
          <section
            className="rounded-2xl border border-white/15 bg-card p-6"
            data-testid="deal-detail-unavailable"
          >
            <h1 className="text-2xl font-semibold">This TradeDeal is unavailable here</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              It may have ended, changed, or be available only in another area.
            </p>
            <Link className="mt-5 inline-block text-orange-500 underline" href="/scout">
              Back to Scout
            </Link>
          </section>
        ) : deal ? (
          <>
            <SEOHelmet
              title={`${deal.title} | TradeDeal | TradeScout`}
              description={deal.description}
            />
            <article
              className="rounded-2xl border border-white/15 bg-card p-6"
              data-testid="deal-detail-content"
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-orange-500">
                Promotional TradeDeal
              </p>
              <h1 className="mt-2 text-3xl font-semibold" data-testid="deal-detail-title">
                {deal.title}
              </h1>
              <p className="mt-4 whitespace-pre-wrap text-base">{deal.description}</p>
              <div className="mt-5 space-y-1 text-sm text-muted-foreground">
                <p data-testid="deal-detail-scope">
                  {deal.scope === "global"
                    ? "Listed for all counties"
                    : "Listed for the selected county"}
                </p>
                {endDate && postedEndTime ? (
                  <p>
                    Posted end time: <time dateTime={endDate.toISOString()}>{postedEndTime}</time>
                  </p>
                ) : null}
              </div>
            </article>
            <p className="text-sm text-muted-foreground">
              This is a posted promotion. Confirm its terms and availability before you act. Viewing
              it does not contact anyone.
            </p>
            <Link className="inline-block text-orange-500 underline" href="/scout">
              Back to Scout
            </Link>
          </>
        ) : null}
      </div>
    </main>
  );
}
