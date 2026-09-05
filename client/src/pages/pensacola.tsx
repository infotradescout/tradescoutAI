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
import { PENSACOLA_CLUSTERS, PENSACOLA_COUNTY_CODE } from "@/lib/pensacolaClusters";

const faqItems = [
  {
    question: "How is TradeScout Pensacola different from lead marketplaces?",
    answer:
      "TradeScout does not resell one request to everyone. It keeps contact intent-gated and routes through trust-first matching and county context.",
  },
  {
    question: "How do I get better results in Pensacola?",
    answer:
      "Start in Direct Connect with Escambia County selected, then create an account to save your shortlist and track responses.",
  },
  {
    question: "How should businesses win in Pensacola?",
    answer:
      "Complete onboarding, keep county coverage accurate, and build trust signals through verified profile details and high-quality outcomes.",
  },
];

export default function PensacolaPage() {
  const localSearchHref = `/direct-connect?county=${PENSACOLA_COUNTY_CODE}&source=pensacola-launch&intent=local_search`;
  const providerDemandHref = `/direct-connect?county=${PENSACOLA_COUNTY_CODE}&source=pensacola-launch&intent=provider_demand`;
  const createAccountHref = `/create-account?source=pensacola-launch&county=${PENSACOLA_COUNTY_CODE}`;
  const applyHref = `/claim-my-business?stateCode=FL&countyFips=${PENSACOLA_COUNTY_CODE}&source=pensacola`;

  const homeownerQueries = HOMEOWNER_POPULAR_QUERIES.slice(0, 12);
  const businessQueries = BUSINESS_POPULAR_QUERIES.slice(0, 10);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Pensacola, FL | TradeScout Launch Hub",
        description:
          "Pensacola-first TradeScout launch hub for people searching local services and businesses onboarding in Escambia County.",
        url: "https://www.thetradescout.com/pensacola",
      },
      createBreadcrumbStructuredData([
        { name: "TradeScout", url: "/" },
        { name: "Pensacola", url: "/pensacola" },
      ]),
      createFAQStructuredData(faqItems),
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <SEOHelmet
        title="Pensacola, FL Local Services Hub | TradeScout"
        description="TradeScout Pensacola launch hub for homeowners, businesses, and contractors in Escambia County. Start requests, onboard, and create an account."
        keywords="pensacola contractors, escambia county contractors, pensacola local services, find contractors pensacola, pensacola business onboarding"
        canonical="https://www.thetradescout.com/pensacola"
        structuredData={structuredData}
      />

      <section className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ts-orange font-semibold">
          Ground Zero Market
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-white">Pensacola first. Built local.</h1>
        <p className="text-white/70 max-w-4xl">
          Pensacola, Florida is launch ground zero for TradeScout. We are using Escambia County to
          prove a better model for local discovery and action without lead reselling or pay-to-play.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={LOCAL_BUSINESS_DISCOVERY.pensacolaRequestHref}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Start a Pensacola request
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
              Use Direct Connect with county context so your request reaches relevant local pros.
              Then create an account to save your shortlist and continue where you left off.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={localSearchHref}>
                <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                  Find in Pensacola
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
              Pensacola is the priority onboarding market. Build your TradeScout presence early and
              win trust-first local visibility by county.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={applyHref}>
                <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                  Onboard for Pensacola
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
        <h2 className="text-2xl font-semibold text-white">High-intent Pensacola demand clusters</h2>
        <p className="text-sm text-white/70 max-w-4xl">
          These are the service lanes we are prioritizing first in Escambia County.
        </p>
        <div className="flex flex-wrap gap-2">
          {PENSACOLA_CLUSTERS.map((cluster) => (
            <Link key={cluster.slug} href={`/pensacola/${cluster.slug}`}>
              <a className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:border-ts-orange/50 hover:text-white transition-colors">
                {cluster.title}
              </a>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">
          Popular search behavior we can convert
        </h2>
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
        <h2 className="text-2xl font-bold text-white">Conversion move for both sides</h2>
        <p className="text-sm text-white/80 max-w-3xl">
          Start with demand intent, then ask for account creation at the point where users want to
          save, compare, and track decisions. That keeps TradeScout useful first and transactional
          second.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={createAccountHref}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Create account and save progress
            </Button>
          </Link>
          <Link href="/how-it-works">
            <Button variant="outline" className="border-white/20 text-white">
              Why this model works
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
