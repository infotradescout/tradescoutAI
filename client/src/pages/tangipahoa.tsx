import { Link } from "wouter";
import {
  SEOHelmet,
  createBreadcrumbStructuredData,
  createFAQStructuredData,
} from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BUSINESS_POPULAR_QUERIES,
  HOMEOWNER_POPULAR_QUERIES,
  LOCAL_BUSINESS_DISCOVERY,
} from "@/lib/popularSearchQueries";

const TANGIPAHOA_COUNTY_CODE = "22105";

const faqItems = [
  {
    question: "How can local business owners in Tangipahoa Parish get found on TradeScout?",
    answer:
      "Start with business onboarding, set your service coverage to Tangipahoa Parish, and keep your profile complete. TradeScout matches based on local fit and trust signals.",
  },
  {
    question: "Does TradeScout sell local requests as leads?",
    answer:
      "No. TradeScout does not resell one request to everyone. It routes local demand through a trust-first flow with controlled contact.",
  },
  {
    question: "What areas does this Tangipahoa page support?",
    answer:
      "This page is for Tangipahoa Parish, including demand around Hammond, Ponchatoula, Amite, and nearby service lanes.",
  },
  {
    question: "How do people in Tangipahoa Parish start a request?",
    answer:
      "Use Direct Connect with Tangipahoa Parish selected, then create an account to save your shortlist and track replies.",
  },
];

export default function TangipahoaPage() {
  const localSearchHref = `/direct-connect?county=${TANGIPAHOA_COUNTY_CODE}&source=tangipahoa-launch&intent=local_search`;
  const providerDemandHref = `/direct-connect?county=${TANGIPAHOA_COUNTY_CODE}&source=tangipahoa-launch&intent=provider_demand`;
  const createAccountHref = `/create-account?source=tangipahoa-launch&county=${TANGIPAHOA_COUNTY_CODE}`;
  const applyHref = `/claim-my-business?stateCode=LA&countyFips=${TANGIPAHOA_COUNTY_CODE}&source=tangipahoa`;

  const homeownerQueries = HOMEOWNER_POPULAR_QUERIES.filter(
    (item) => item.query.toLowerCase().includes("louisiana") || item.href.endsWith("/la")
  ).slice(0, 10);
  const businessQueries = BUSINESS_POPULAR_QUERIES.filter(
    (item) => item.query.toLowerCase().includes("louisiana") || item.href.endsWith("/la")
  ).slice(0, 10);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Tangipahoa Parish, LA | TradeScout Local Services Hub",
        description:
          "TradeScout Tangipahoa Parish hub for local business owners, contractors, and people searching trusted local services in Louisiana.",
        url: "https://www.thetradescout.com/tangipahoa",
      },
      createBreadcrumbStructuredData([
        { name: "TradeScout", url: "/" },
        { name: "Tangipahoa Parish", url: "/tangipahoa" },
      ]),
      createFAQStructuredData(faqItems),
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <SEOHelmet
        title="Tangipahoa Parish, LA Local Business Hub | TradeScout"
        description="TradeScout Tangipahoa Parish launch hub for local businesses and contractors. Get in front of local demand in Hammond, Ponchatoula, and across Tangipahoa Parish."
        keywords="tangipahoa parish contractors, hammond louisiana contractors, ponchatoula local services, tangipahoa business marketing, louisiana local business leads"
        canonical="https://www.thetradescout.com/tangipahoa"
        structuredData={structuredData}
      />

      <section className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ts-orange font-semibold">
          Louisiana Launch Focus
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white">
          Tangipahoa Parish first. Built local.
        </h1>
        <p className="text-white/70 max-w-4xl">
          This is the TradeScout launch hub for Tangipahoa Parish, Louisiana. The goal is simple:
          get local business owners in front of real local demand without lead resale noise.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={LOCAL_BUSINESS_DISCOVERY.tangipahoaRequestHref}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Start a Tangipahoa request
            </Button>
          </Link>
          <Link href={createAccountHref}>
            <Button variant="outline" className="border-white/20 text-white">
              Create free account
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-xl font-semibold text-white">For people hiring local help</h2>
            <p className="text-sm text-white/70">
              Use Direct Connect with Tangipahoa Parish selected to keep results local and relevant.
              Save your shortlist and follow responses inside one flow.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={localSearchHref}>
                <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                  Find local help
                </Button>
              </Link>
              <Link href="/find-local-businesses">
                <Button variant="outline" className="border-white/20 text-white">
                  Search guide
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-xl font-semibold text-white">For contractors and businesses</h2>
            <p className="text-sm text-white/70">
              If you operate in Tangipahoa Parish, onboard now and establish local visibility early.
              Keep coverage accurate and stay active in Direct Connect demand.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={applyHref}>
                <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                  Onboard for Tangipahoa
                </Button>
              </Link>
              <Link href={providerDemandHref}>
                <Button variant="outline" className="border-white/20 text-white">
                  Provider demand flow
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">High-intent local search terms</h2>
        <p className="text-sm text-white/70 max-w-4xl">
          These search patterns are useful for building local SEO coverage in Tangipahoa Parish.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-lg font-semibold text-white">People hiring services</h3>
              <div className="flex flex-wrap gap-2">
                {homeownerQueries.map((item) => (
                  <Link key={item.query} href={item.href}>
                    <a className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:border-ts-orange/50 hover:text-white transition-colors">
                      {item.query}
                    </a>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-lg font-semibold text-white">Businesses looking for work</h3>
              <div className="flex flex-wrap gap-2">
                {businessQueries.map((item) => (
                  <Link key={item.query} href={item.href}>
                    <a className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:border-ts-orange/50 hover:text-white transition-colors">
                      {item.query}
                    </a>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="rounded-2xl border border-ts-orange/35 bg-ts-orange/10 p-5 md:p-6 space-y-3">
        <h2 className="text-2xl font-bold text-white">Best next move in Tangipahoa Parish</h2>
        <p className="text-sm text-white/80 max-w-3xl">
          Start by publishing county-specific coverage and service detail pages, then route users to
          Direct Connect when they want to act. That keeps the experience useful first and
          conversion-ready second.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={createAccountHref}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Create account and save progress
            </Button>
          </Link>
          <Link href="/for-businesses">
            <Button variant="outline" className="border-white/20 text-white">
              Business growth guide
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
