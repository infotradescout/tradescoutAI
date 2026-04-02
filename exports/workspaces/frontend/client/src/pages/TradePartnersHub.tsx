import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, MapPinned, Megaphone } from "lucide-react";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";

type CampaignCounty = {
  slug: string;
  countyName: string;
  stateCode: string;
  displayLabel: string;
};

type CampaignSummary = {
  partnerSlug: string;
  partnerName: string;
  campaignTitle: string;
  heroKicker: string;
  heroHeadline: string;
  heroSubhead: string;
  dealAmountUsd: number;
  dealTerms: string;
  ctaLabel: string;
  ctaUrl?: string;
  counties: CampaignCounty[];
  isActive: boolean;
};

type CampaignListResponse = {
  items?: CampaignSummary[];
};

function normalizeCtaUrl(url: string | undefined, partnerSlug: string): string {
  if (typeof url === "string" && url.trim().length > 0) {
    const trimmed = url.trim();
    if (trimmed.startsWith("/")) {
      return trimmed;
    }
  }

  if (partnerSlug === "cumulus-media") {
    return "/tradepartners/cumulus-media";
  }

  return "/tradepartners";
}

const FALLBACK_CAMPAIGN: CampaignSummary = {
  partnerSlug: "cumulus-media",
  partnerName: "Cumulus Media",
  campaignTitle: "TradeDeals Promotion Partnership",
  heroKicker: "TradePartners Program",
  heroHeadline: "Cumulus Media + TradeScout",
  heroSubhead: "Promotion support for local TradeDeals campaigns across county-focused audiences.",
  dealAmountUsd: 2000,
  dealTerms: "Ad credit available through campaign qualification and partner scheduling.",
  ctaLabel: "View Partnership",
  ctaUrl: "/tradepartners/cumulus-media",
  counties: [
    {
      slug: "mobile-county-al",
      countyName: "Mobile County",
      stateCode: "AL",
      displayLabel: "Mobile County, AL",
    },
    {
      slug: "escambia-county-fl",
      countyName: "Escambia County",
      stateCode: "FL",
      displayLabel: "Escambia County, FL",
    },
    {
      slug: "okaloosa-county-fl",
      countyName: "Okaloosa County",
      stateCode: "FL",
      displayLabel: "Okaloosa County, FL",
    },
  ],
  isActive: true,
};

function normalizeCampaign(input: unknown): CampaignSummary | null {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  if (!obj) return null;

  const partnerSlug = typeof obj.partnerSlug === "string" ? obj.partnerSlug.trim() : "";
  const partnerName = typeof obj.partnerName === "string" ? obj.partnerName.trim() : "";
  if (!partnerSlug || !partnerName) return null;

  const countiesRaw = Array.isArray(obj.counties) ? obj.counties : [];
  const counties: CampaignCounty[] = countiesRaw
    .map((entry) => {
      const county = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!county) return null;
      const slug = typeof county.slug === "string" ? county.slug.trim() : "";
      const countyName = typeof county.countyName === "string" ? county.countyName.trim() : "";
      const stateCode = typeof county.stateCode === "string" ? county.stateCode.trim() : "";
      const displayLabel =
        typeof county.displayLabel === "string" ? county.displayLabel.trim() : "";
      if (!slug || !countyName || !stateCode || !displayLabel) return null;
      return { slug, countyName, stateCode, displayLabel };
    })
    .filter((county): county is CampaignCounty => Boolean(county));

  return {
    partnerSlug,
    partnerName,
    campaignTitle:
      typeof obj.campaignTitle === "string" && obj.campaignTitle.trim()
        ? obj.campaignTitle.trim()
        : `${partnerName} Partnership`,
    heroKicker: typeof obj.heroKicker === "string" ? obj.heroKicker.trim() : "TradePartners",
    heroHeadline:
      typeof obj.heroHeadline === "string" && obj.heroHeadline.trim()
        ? obj.heroHeadline.trim()
        : `${partnerName} Promotion Program`,
    heroSubhead: typeof obj.heroSubhead === "string" ? obj.heroSubhead.trim() : "",
    dealAmountUsd: typeof obj.dealAmountUsd === "number" ? obj.dealAmountUsd : 0,
    dealTerms: typeof obj.dealTerms === "string" ? obj.dealTerms.trim() : "",
    ctaLabel:
      typeof obj.ctaLabel === "string" && obj.ctaLabel.trim()
        ? obj.ctaLabel.trim()
        : "View Partner",
    ctaUrl: typeof obj.ctaUrl === "string" ? obj.ctaUrl.trim() : undefined,
    counties,
    isActive: obj.isActive !== false,
  };
}

export default function TradePartnersHub() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      try {
        const response = await fetch("/api/tradepartner-campaigns", {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const payload = (await response.json()) as CampaignListResponse;
        const normalized = Array.isArray(payload?.items)
          ? payload.items
              .map((item) => normalizeCampaign(item))
              .filter((item): item is CampaignSummary => Boolean(item))
              .filter((item) => item.isActive)
          : [];

        if (!cancelled) {
          setCampaigns(normalized.length ? normalized : [FALLBACK_CAMPAIGN]);
        }
      } catch {
        if (!cancelled) {
          setCampaigns([FALLBACK_CAMPAIGN]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCampaigns();

    return () => {
      cancelled = true;
    };
  }, []);

  const countyLinks = useMemo(() => {
    const seen = new Set<string>();
    const links: Array<{ slug: string; label: string }> = [];

    campaigns.forEach((campaign) => {
      campaign.counties.forEach((county) => {
        if (seen.has(county.slug)) return;
        seen.add(county.slug);
        links.push({ slug: county.slug, label: county.displayLabel });
      });
    });

    return links.sort((a, b) => a.label.localeCompare(b.label));
  }, [campaigns]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SEOHelmet
        title="TradePartners Hub | TradeScout"
        description="Browse active TradeScout TradePartners and county landing paths for TradeDeals promotion campaigns."
        canonical="/tradepartners"
      />

      <section className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
        <div className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border md:p-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Megaphone className="h-4 w-4" />
            TradePartners Central Hub
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            TradePartner Companies Promoting TradeDeals
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground md:text-base">
            This hub lists active company partnerships and county landing paths. Choose a partner to
            view campaign details, or jump straight to a county landing to begin discovery and next
            steps through Scout.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/trade-deals"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Open TradeDeals
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/scout"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              Talk to Scout
            </Link>
          </div>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Active TradePartners
          </div>

          {loading ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading active partnerships...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((campaign) => {
                const fallbackCountyHref = campaign.counties[0]?.slug
                  ? `/tradepartners/${encodeURIComponent(campaign.counties[0].slug)}`
                  : "/tradepartners";
                const partnerHref =
                  normalizeCtaUrl(campaign.ctaUrl, campaign.partnerSlug) || fallbackCountyHref;
                return (
                  <article
                    key={campaign.partnerSlug}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {campaign.heroKicker || "TradePartners"}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-foreground">
                      {campaign.partnerName}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{campaign.heroHeadline}</p>
                    {campaign.heroSubhead ? (
                      <p className="mt-2 text-sm text-muted-foreground">{campaign.heroSubhead}</p>
                    ) : null}
                    <div className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                      <span className="font-semibold">TradeDeals Promotion:</span>{" "}
                      {campaign.dealAmountUsd > 0
                        ? `$${campaign.dealAmountUsd.toLocaleString()} support`
                        : "Partner-supported campaign"}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Link
                        href={partnerHref === "/tradepartners" ? fallbackCountyHref : partnerHref}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                      >
                        {campaign.ctaLabel || "View Partner"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPinned className="h-4 w-4" />
            County Landing Paths
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            {countyLinks.length ? (
              <div className="flex flex-wrap gap-2">
                {countyLinks.map((county) => (
                  <Link
                    key={county.slug}
                    href={`/tradepartners/${encodeURIComponent(county.slug)}`}
                    className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-accent"
                  >
                    {county.label}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No county paths are currently published.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
