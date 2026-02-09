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
import { US_STATES_COUNTIES, getStateByCode, getCountiesByState } from "@shared/states-counties";
import { ChevronRight, MapPin, Users, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface CountyCoverageData {
  countyFips: string;
  countyName: string;
  stateCode: string;
  coverageStatus: "unassigned" | "partial" | "full";
  territoryManagerCount: number;
  affiliateCount: number;
  lastEntityChangeAt: string | null;
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
  return counties.find((c) => nameToSlug(c.name) === slug.toLowerCase());
}

// Build FAQ content based on coverage status
function buildCountyFAQs(
  countyName: string,
  stateName: string,
  coverage: CountyCoverageData | null
): Array<{ question: string; answer: string }> {
  if (!coverage) {
    return [
      {
        question: `How do I find contractors in ${countyName}?`,
        answer: `Use Direct Connect to search verified local contractors. Match on trust and relevance, not cost per lead.`,
      },
      {
        question: `Is ${countyName} covered by TradeScout?`,
        answer: `Coverage information is loading. Please check back.`,
      },
      {
        question: `What services are available in ${countyName}?`,
        answer: `Common services include roofing, plumbing, electrical, HVAC, and general contracting. Availability varies by county.`,
      },
      {
        question: `How is TradeScout different from Angi/HomeAdvisor?`,
        answer: `No lead spam. No bidding wars. Trust-first matching using Community Verification Score (CVS). We match on relevance and trust, not price competition.`,
      },
      {
        question: `What is the Community Verification Score (CVS)?`,
        answer: `A public trust metric based on verified identity, license/insurance status, work history, and community recommendations. Payment cannot override trust.`,
      },
    ];
  }

  const { coverageStatus, affiliateCount, territoryManagerCount } = coverage;

  return [
    {
      question: `How do I find contractors in ${countyName}?`,
      answer:
        coverageStatus === "full"
          ? `Use Direct Connect to search ${affiliateCount} verified contractors. Match on trust and relevance, not cost per lead. ${countyName} is fully covered with dedicated support.`
          : coverageStatus === "partial"
            ? `Use Direct Connect to search ${affiliateCount} verified contractors currently serving ${countyName}. Coverage is growing.`
            : `${countyName} is on our expansion roadmap. Request coverage to prioritize your county.`,
    },
    {
      question: `Is ${countyName} fully covered?`,
      answer:
        coverageStatus === "full"
          ? `Yes. ${affiliateCount} verified contractors + ${territoryManagerCount} territory manager serve ${countyName}. We maintain continuous support.`
          : coverageStatus === "partial"
            ? `Partially. ${affiliateCount} contractors are active in ${countyName}, and we're adding more. Growth is ongoing.`
            : `Not yet. ${countyName} is in our coverage roadmap. We prioritize based on demand.`,
    },
    {
      question: `What services are available in ${countyName}?`,
      answer: `Common services include roofing, plumbing, electrical, HVAC, and general home improvement. Contractor specializations vary by county. Use Direct Connect to filter by trade.`,
    },
    {
      question: `How is TradeScout different from Angi/HomeAdvisor in ${countyName}?`,
      answer: `No lead spam. No bidding wars. Trust-first matching using Community Verification Score (CVS). We match on trust and relevance, not price competition. ${countyName} contractors benefit from context-aware routing and no excessive request flooding.`,
    },
    {
      question: `What is the Community Verification Score (CVS)?`,
      answer: `A public, auditable trust metric based on verified identity, license/insurance, work history, and community recommendations. Payment cannot override it. It's the foundation of ${countyName} contractor credibility on TradeScout.`,
    },
  ];
}

// Build SEO description
function buildCountyDescription(
  countyName: string,
  stateName: string,
  coverage: CountyCoverageData | null
): string {
  if (!coverage) {
    return `Find verified contractors in ${countyName}, ${stateName}. Trust-first matching with no lead spam or bidding wars.`;
  }

  const { coverageStatus, affiliateCount } = coverage;
  if (coverageStatus === "full") {
    return `Find ${affiliateCount} verified contractors in ${countyName}, ${stateName}. Trust-first matching with Community Verification Score (CVS). No lead spam, no bidding wars.`;
  }
  if (coverageStatus === "partial") {
    return `${affiliateCount} verified contractors in ${countyName}, ${stateName}. Trust-first matching. Growing coverage. No lead spam.`;
  }
  return `Find verified contractors in ${countyName}, ${stateName}. Coverage is still building; request county coverage and use Scout to route verified intent.`;
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
    { name: "Counties", url: "/county-directory" },
    { name: stateName, url: `/states/${stateCode.toLowerCase()}` },
    { name: countyName, url: "" },
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

  // 404 on mismatch
  if (!state || !county) {
    return (
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
              <a className="inline-block px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
                Browse All Counties
              </a>
            </Link>
          </CardContent>
        </Card>
      </div>
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

  const seoTitle = `${county.name}, ${state.code} | TradeScout Local`;

  return (
    <>
      <SEOHelmet
        title={seoTitle}
        description={description}
        keywords={keywords}
        structuredData={placeSchema}
        canonical={`https://www.thetradescout.com/county/${state.code.toLowerCase()}/${nameToSlug(county.name)}`}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-gray-600 mb-8">
          {breadcrumbs.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {idx > 0 && <ChevronRight className="w-4 h-4" />}
              {item.url ? (
                <Link href={item.url}>
                  <a className="text-blue-600 hover:underline">{item.name}</a>
                </Link>
              ) : (
                <span className="font-semibold text-gray-900">{item.name}</span>
              )}
            </div>
          ))}
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">
            {county.name}, {state.code}
          </h1>
          <p className="text-lg text-gray-600 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {state.name}
          </p>
        </div>

        {/* Coverage Status Banner */}
        {coverageLoading ? (
          <Card className="bg-gray-50 border-gray-200 mb-8">
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full" />
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
                  : "bg-gray-50 border-gray-200"
            }`}
          >
            <CardContent className="p-6">
              {coverage.coverageStatus === "full" && (
                <div className="flex items-start gap-3">
                  <div className="text-green-600 mt-1">✓</div>
                  <div>
                    <h3 className="font-semibold text-green-900 mb-1">Fully Covered</h3>
                    <p className="text-green-800 mb-3">
                      <strong>{coverage.affiliateCount}</strong> verified contractors +{" "}
                      <strong>{coverage.territoryManagerCount}</strong> territory manager
                      {coverage.territoryManagerCount !== 1 ? "s" : ""} serve {county.name}.
                    </p>
                    <Link href={`/direct-connect?county=${county.fipsCode}`}>
                      <a className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                        Find Contractors →
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
                      <strong>{coverage.affiliateCount}</strong> verified contractors currently
                      serve {county.name}. Coverage is growing.
                    </p>
                    <Link href={`/direct-connect?county=${county.fipsCode}`}>
                      <a className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Explore Matches →
                      </a>
                    </Link>
                  </div>
                </div>
              )}
              {coverage.coverageStatus === "unassigned" && (
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-gray-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Not Yet Covered</h3>
                    <p className="text-gray-700 mb-3">{county.name} is on our expansion roadmap.</p>
                    <Link href="/contact">
                      <a className="inline-block px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Request Coverage →
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
            <h2 className="text-2xl font-bold mb-4">Find Contractors in {county.name}</h2>
            <p className="text-gray-700 mb-6">
              Search verified contractors by trade. Match on trust and relevance, not price wars.
            </p>
            <Link href={`/direct-connect?county=${county.fipsCode}`}>
              <a className="inline-block px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">
                Open Direct Connect →
              </a>
            </Link>
          </CardContent>
        </Card>

        {/* Community Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Community in {county.name}
            </h2>
            <p className="text-gray-700 mb-6">
              Join neighbors, contractors, and professionals. Share trusted local signals, post
              projects, and discover what's happening locally.
            </p>
            <Link href={`/community?county=${county.fipsCode}`}>
              <a className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Community Feed →
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
                  <h3 className="font-semibold text-gray-900 mb-2">{faq.question}</h3>
                  <p className="text-gray-700">{faq.answer}</p>
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
