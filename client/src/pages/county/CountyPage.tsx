import { memo, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  SEOHelmet,
  createPlaceStructuredData,
  createAdministrativeAreaStructuredData,
  createFAQStructuredData,
  createBreadcrumbStructuredData,
} from "@/components/SEOHelmet";
import { getStateByCode, getCountiesByState } from "@shared/states-counties";
import { getTradeBySlug } from "@shared/tradeSeo";
import {
  ArrowRight,
  ChevronRight,
  MapPin,
  Search,
  ShieldCheck,
  Users,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  protectedContactCopy,
  stripCountySuffix,
  toLocalMarketLabel,
  trustScoreDescription,
  trustScoreLabel,
} from "@/lib/userFacingCopy";
import { getDiscoveryScopeRobotsDecision } from "@/lib/discoveryScopeIndexability";

interface CountyCoverageData {
  countyFips: string;
  countyName: string;
  stateCode: string;
  coverageStatus: "unassigned" | "partial" | "full";
  territoryManagerCount: number;
  affiliateCount: number;
  lastEntityChangeAt: string | null;
}

const FEATURED_TRADE_PLACEHOLDER_SLUGS: Record<string, string> = {
  plumbing: "plumbing",
  electrical: "electrical",
  roofing: "roofing",
  hvac: "hvac",
  "concrete-contractor": "masonry-concrete",
  landscaping: "landscaping-lawn-care",
  painting: "painting",
  flooring: "flooring",
  "pest-control": "pest-control",
  "general-contractor": "general-contractor",
  "tree-service": "tree-service",
  handyman: "handyman",
};

function getCategoryPlaceholderSrc(tradeSlug: string): string | null {
  const placeholderSlug = FEATURED_TRADE_PLACEHOLDER_SLUGS[tradeSlug];
  if (!placeholderSlug) return null;
  return `/images/tradescout/categories/${placeholderSlug}.svg`;
}

// Utility: Convert county name to kebab-case slug
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

// Utility: Find county by slug
function findCountyBySlug(state: any, slug: string): any {
  if (!state) return null;
  const counties = getCountiesByState(state.code);
  const normalized = String(slug || "").toLowerCase();
  return counties.find((c) => {
    const fullSlug = nameToSlug(c.name);
    const canonicalSlug = nameToSlug(c.name.replace(/\s+County$/i, "").trim() || c.name);
    return canonicalSlug === normalized || fullSlug === normalized;
  });
}

// Build FAQ content based on coverage status
function buildCountyFAQs(
  countyName: string,
  stateName: string,
  coverage: CountyCoverageData | null
): Array<{ question: string; answer: string }> {
  const marketName = stripCountySuffix(countyName) || countyName;
  if (!coverage) {
    return [
      {
        question: `How do I find contractors near ${marketName}?`,
        answer: `Use Direct Connect to search verified local contractors, compare the fit, and narrow by city or nearby neighborhood.`,
      },
      {
        question: `Does TradeScout cover ${marketName}?`,
        answer: `Coverage information is loading. Please check back.`,
      },
      {
        question: `What services are available near ${marketName}?`,
        answer: `Common services include roofing, plumbing, electrical, HVAC, and general contracting. Availability varies by city and local coverage.`,
      },
      {
        question: `How is TradeScout different from Angi/HomeAdvisor?`,
        answer: `TradeScout helps you see who looks strongest first, then reach out through the platform without the usual lead spam.`,
      },
      {
        question: `What is the ${trustScoreLabel()}?`,
        answer: `${trustScoreDescription()} Payment cannot buy a higher spot.`,
      },
    ];
  }

  const { coverageStatus, affiliateCount, territoryManagerCount } = coverage;

  return [
    {
      question: `How do I find contractors near ${marketName}?`,
      answer:
        coverageStatus === "full"
          ? `Use Direct Connect to search ${affiliateCount} verified contractors serving ${marketName}. Start broad, then narrow by city or neighborhood.`
          : coverageStatus === "partial"
            ? `Use Direct Connect to search ${affiliateCount} verified contractors currently serving ${marketName}. Coverage is growing across nearby neighborhoods.`
            : `${marketName} is still building out. Describe where you need help so we can prioritize local coverage.`,
    },
    {
      question: `How strong is TradeScout coverage near ${marketName}?`,
      answer:
        coverageStatus === "full"
          ? `Strong. ${affiliateCount} verified contractors and ${territoryManagerCount} local support lead${territoryManagerCount !== 1 ? "s" : ""} are already active around ${marketName}.`
          : coverageStatus === "partial"
            ? `Growing. ${affiliateCount} contractors are already active around ${marketName}, and more coverage is being added.`
            : `Coverage is still early around ${marketName}. We prioritize expansion based on real local demand.`,
    },
    {
      question: `What services are available near ${marketName}?`,
      answer: `Common services include roofing, plumbing, electrical, HVAC, and general home improvement. Specialties vary by city and neighborhood, so use Direct Connect to filter by trade.`,
    },
    {
      question: `How is TradeScout different from Angi/HomeAdvisor near ${marketName}?`,
      answer: `TradeScout shows you who looks strongest first, keeps contact tighter, and does not sell your request as a lead.`,
    },
    {
      question: `What is the ${trustScoreLabel()}?`,
      answer: `${trustScoreDescription()} Around ${marketName}, it helps you quickly see who has earned trust versus who is still building it.`,
    },
  ];
}

// Build SEO description
function buildCountyDescription(
  countyName: string,
  stateName: string,
  coverage: CountyCoverageData | null
): string {
  const marketLabel = toLocalMarketLabel(countyName, stateName);
  if (!coverage) {
    return `Find verified contractors in ${marketLabel}. Compare local options without lead spam or bidding wars.`;
  }

  const { coverageStatus, affiliateCount } = coverage;
  if (coverageStatus === "full") {
    return `Find ${affiliateCount} verified contractors in ${marketLabel}. See CVS, compare business details, and reach out through TradeScout.`;
  }
  if (coverageStatus === "partial") {
    return `${affiliateCount} verified contractors currently serve ${marketLabel}. Coverage is growing across nearby neighborhoods.`;
  }
  return `Find verified contractors in ${marketLabel}. Coverage is still building, but you can tell Scout where you need help and we'll prioritize it.`;
}

// Build keywords
function buildCountyKeywords(countyName: string, stateName: string): string {
  return `${countyName} contractors, ${stateName} contractors, verified contractors, trusted contractors, home improvement, roofing, plumbing, electrical, HVAC, free quotes, ${countyName.toLowerCase().replace(/\s+/g, "-")} ${stateName.toLowerCase().replace(/\s+/g, "-")}`;
}

// Build breadcrumbs
function buildBreadcrumbs(
  stateCode: string,
  stateName: string,
  countyName: string
): Array<{ name: string; url: string }> {
  return [
    { name: "Home", url: "/" },
    { name: "Markets", url: "/county-directory" },
    { name: stateName, url: `/states/${stateCode.toLowerCase()}` },
    { name: stripCountySuffix(countyName) || countyName, url: "" },
  ];
}

const CountyPage = memo(function CountyPage() {
  const { stateCode, countySlug } = useParams<{ stateCode: string; countySlug: string }>();

  // Resolve state and county
  const state = useMemo(
    () => (stateCode ? getStateByCode(stateCode.toUpperCase()) : null),
    [stateCode]
  );
  const county = useMemo(() => findCountyBySlug(state, countySlug || ""), [state, countySlug]);

  // Fetch coverage data
  const { data: coverage, isLoading: coverageLoading } = useQuery<CountyCoverageData | null>({
    queryKey: [`/api/geographic-coverage/county/${county?.fipsCode}`],
    enabled: !!county?.fipsCode,
    retry: 1,
  });
  const directoryCountySlug = county
    ? nameToSlug(county.name.replace(/\s+County$/i, "").trim() || county.name)
    : "";
  const directoryStateCode = String(state?.code || "");
  const {
    data: directoryNavigation,
    isLoading: directoryNavigationLoading,
    isError: directoryNavigationError,
  } = useQuery<{ trades: Array<{ tradeSlug: string; businessCount: number }> }>({
    queryKey: [
      "/api/public/seo/directory-navigation",
      directoryStateCode,
      directoryCountySlug,
      "trades",
    ],
    enabled: Boolean(directoryStateCode && directoryCountySlug),
    queryFn: async () => {
      const response = await fetch(
        `/api/public/seo/directory-navigation?stateCode=${encodeURIComponent(
          directoryStateCode
        )}&countySlug=${encodeURIComponent(directoryCountySlug)}`
      );
      if (!response.ok) throw new Error(`Failed to load county navigation (${response.status})`);
      return response.json();
    },
    retry: 1,
  });

  // 404 on mismatch
  if (!state || !county) {
    return (
      <>
        <SEOHelmet title="County Not Found | TradeScout" noIndex />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-center">
              <h1 className="text-2xl font-bold text-red-900 mb-2">County Not Found</h1>
              <p className="text-red-700 mb-4">
                {countySlug && stateCode
                  ? `${countySlug} in ${stateCode} could not be resolved.`
                  : "Invalid county or state."}
              </p>
              <Link href="/county-directory">
                <a className="inline-block px-4 py-2 bg-ts-orange text-white rounded hover:bg-ts-orange-dark">
                  Browse All Markets
                </a>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Build content
  const faqs = buildCountyFAQs(county.name, state.name, coverage || null);
  const description = buildCountyDescription(county.name, state.name, coverage || null);
  const keywords = buildCountyKeywords(county.name, state.name);
  const breadcrumbs = buildBreadcrumbs(state.code, state.name, county.name);

  // Build structured data
  const placeSchema = createPlaceStructuredData({
    name: county.name,
    state: state.name,
    stateCode: state.code,
    fipsCode: county.fipsCode,
  });

  const adminAreaSchema = createAdministrativeAreaStructuredData({
    name: county.name,
    areaType: "County",
    state: state.name,
  });

  const faqSchema = createFAQStructuredData(faqs);
  const breadcrumbSchema = createBreadcrumbStructuredData(breadcrumbs);

  const seoTitle = `${county.name}, ${state.code} | TradeScout`;
  const marketName = stripCountySuffix(county.name) || county.name;
  const marketLabel = toLocalMarketLabel(county.name, state.code);
  const directConnectHref = `/direct-connect?county=${county.fipsCode}&source=county-community-path`;
  const localSearchHref = `/scout?intent=local-search&county=${encodeURIComponent(
    county.name
  )}&countyFips=${encodeURIComponent(county.fipsCode)}&stateCode=${encodeURIComponent(
    state.code
  )}&source=county-community-path`;
  const communityFeedHref = `/community-feed?county=${county.fipsCode}`;
  const featuredTrades = (directoryNavigation?.trades || [])
    .map((scope) => {
      const trade = getTradeBySlug(scope.tradeSlug);
      return trade
        ? {
            slug: String((trade as any).slug || scope.tradeSlug),
            name: String((trade as any).name || scope.tradeSlug),
            businessCount: scope.businessCount,
          }
        : null;
    })
    .filter(Boolean) as Array<{ slug: string; name: string; businessCount: number }>;
  const countySlugForTradeLinks = directoryCountySlug;
  const robotsDecision = getDiscoveryScopeRobotsDecision({
    isLoading: directoryNavigationLoading,
    hasError: directoryNavigationError,
    itemCount: featuredTrades.length,
  });

  return (
    <>
      <SEOHelmet
        title={seoTitle}
        description={description}
        keywords={keywords}
        structuredData={placeSchema}
        canonical={`https://www.thetradescout.com/county/${state.code.toLowerCase()}/${directoryCountySlug}`}
        noIndex={robotsDecision.noIndex}
        preserveRobots={robotsDecision.preserveRobots}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-white/60 mb-8">
          {breadcrumbs.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {idx > 0 && <ChevronRight className="w-4 h-4" />}
              {item.url ? (
                <Link href={item.url}>
                  <a className="text-blue-600 hover:underline">{item.name}</a>
                </Link>
              ) : (
                <span className="font-semibold text-white">{item.name}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Header */}
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)] md:mb-8 md:rounded-2xl md:p-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-ts-orange">
            <MapPin className="h-3.5 w-3.5" />
            County community path
          </div>
          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">{marketLabel}</h1>
          <p className="mt-3 text-base leading-relaxed text-white/70 md:text-lg">
            Find local help near {marketName}, read community context, and start a protected request
            when you are ready to act.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Link href={directConnectHref}>
              <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ts-orange px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(236,107,32,0.24)] hover:bg-ts-orange-dark md:rounded-xl">
                Start request in Direct Connect
                <ArrowRight className="h-4 w-4" />
              </a>
            </Link>
            <Link href={localSearchHref}>
              <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-black/20 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 md:rounded-xl">
                <Search className="h-4 w-4" />
                Search local context
              </a>
            </Link>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-black/18 px-3 py-3 text-sm text-white/68 md:rounded-xl">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ts-orange" />
            <p>
              Contact stays inside the request flow until both sides have enough context to decide.
            </p>
          </div>
        </div>

        {/* Trade landing links (crawl paths) */}
        <Card className="bg-white/5 border-white/10 mb-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-white mb-3">Browse trades in {marketName}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {featuredTrades.map((trade) =>
                (() => {
                  const categoryImageSrc = getCategoryPlaceholderSrc(trade.slug);
                  return (
                    <Link
                      key={trade.slug}
                      href={`/trade/${encodeURIComponent(trade.slug)}/${encodeURIComponent(
                        state.code.toLowerCase()
                      )}/${encodeURIComponent(countySlugForTradeLinks)}`}
                    >
                      <a className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10">
                        <span className="flex items-center justify-between gap-2">
                          {categoryImageSrc ? (
                            <img
                              src={categoryImageSrc}
                              alt={`${trade.name} category placeholder illustration`}
                              className="h-6 w-6 shrink-0 rounded bg-white/10 p-0.5"
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : null}
                          <span>{trade.name}</span>
                          <span className="text-xs text-white/45">
                            {trade.businessCount.toLocaleString()}
                          </span>
                        </span>
                      </a>
                    </Link>
                  );
                })()
              )}
            </div>
            {!directoryNavigationLoading && featuredTrades.length === 0 ? (
              <p className="mt-3 text-sm text-white/60">
                No recent public trade coverage is available in this county yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* Coverage Status Banner */}
        {coverageLoading ? (
          <Card className="bg-white/5 border-white/10 mb-8">
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-ts-orange/30 border-t-transparent rounded-full" />
                <span>Loading coverage information...</span>
              </div>
            </CardContent>
          </Card>
        ) : coverage ? (
          <Card
            className={`mb-8 ${
              coverage.coverageStatus === "full"
                ? "bg-green-50 border-green-200"
                : coverage.coverageStatus === "partial"
                  ? "bg-blue-50 border-blue-200"
                  : "bg-white/5 border-white/10"
            }`}
          >
            <CardContent className="p-6">
              {coverage.coverageStatus === "full" && (
                <div className="flex items-start gap-3">
                  <div className="text-green-600 mt-1">✓</div>
                  <div>
                    <h3 className="font-semibold text-green-900 mb-1">Fully Covered</h3>
                    <p className="text-green-800 mb-3">
                      <strong>{coverage.affiliateCount}</strong> verified local providers +{" "}
                      <strong>{coverage.territoryManagerCount}</strong> territory manager
                      {coverage.territoryManagerCount !== 1 ? "s" : ""} serve {marketName}.
                    </p>
                    <Link href={directConnectHref}>
                      <a className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        Find Local Help →
                      </a>
                    </Link>
                  </div>
                </div>
              )}
              {coverage.coverageStatus === "partial" && (
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">Partial Coverage</h3>
                    <p className="text-blue-800 mb-3">
                      <strong>{coverage.affiliateCount}</strong> verified local providers currently
                      serve {marketName}. Coverage is growing.
                    </p>
                    <Link href={directConnectHref}>
                      <a className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Explore Matches →
                      </a>
                    </Link>
                  </div>
                </div>
              )}
              {coverage.coverageStatus === "unassigned" && (
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-white/60 mt-1" />
                  <div>
                    <h3 className="font-semibold text-white mb-1">Not Yet Covered</h3>
                    <p className="text-white/70 mb-3">
                      {marketName} is still early for us. Describe which city or neighborhood you
                      need help in so we can prioritize real local demand.
                    </p>
                    <Link href={localSearchHref}>
                      <a className="inline-block px-4 py-2 bg-white/10 text-white rounded hover:bg-white/10">
                        Search local context →
                      </a>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Direct Connect Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4">Direct Connect for {marketName}</h2>
            <p className="text-white/70 mb-6">
              Start a local request by need or trade, then narrow by city or neighborhood.{" "}
              {protectedContactCopy()}
            </p>
            <Link href={directConnectHref}>
              <a className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ts-orange px-4 py-2 text-sm font-semibold text-white hover:bg-ts-orange-dark">
                Open Direct Connect
                <ArrowRight className="h-4 w-4" />
              </a>
            </Link>
          </CardContent>
        </Card>

        {/* Community Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Community around {marketName}
            </h2>
            <p className="text-white/70 mb-6">
              TradeScout is businesses + communities: local businesses, neighbors, and professionals
              sharing useful context before a contact decision opens.
            </p>
            <Link href={communityFeedHref}>
              <a className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Open community feed
                <ArrowRight className="h-4 w-4" />
              </a>
            </Link>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {faqs.map((faq, idx) => (
                <div key={idx} className="pb-6 border-b last:pb-0 last:border-b-0">
                  <h3 className="font-semibold text-white mb-2">{faq.question}</h3>
                  <p className="text-white/70">{faq.answer}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
});

export default CountyPage;
