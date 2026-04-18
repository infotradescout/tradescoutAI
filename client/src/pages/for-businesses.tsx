import { Link } from "wouter";
import {
  SEOHelmet,
  createBreadcrumbStructuredData,
  createFAQStructuredData,
} from "@/components/SEOHelmet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BUSINESS_POPULAR_QUERIES } from "@/lib/popularSearchQueries";

const faqItems = [
  {
    question: "How does TradeScout help contractors and local businesses get work?",
    answer:
      "TradeScout routes real local requests through Direct Connect and keeps contact intent-gated. Businesses get matched on trust and fit instead of pay-to-play lead buying.",
  },
  {
    question: "Does paying more increase ranking on TradeScout?",
    answer:
      "No. Visibility and contact pathways are governed by trust and platform rules, not paid priority placement.",
  },
  {
    question: "Can I use TradeScout if I serve only specific counties?",
    answer:
      "Yes. County routing is core to TradeScout. You can focus where you operate and respond to requests in those service areas.",
  },
  {
    question: "How do I join as a contractor or business?",
    answer:
      "Use the contractor/business onboarding flow, complete your profile and verification prompts, then begin responding to matched local requests in Direct Connect.",
  },
];

export default function ForBusinessesPage() {
  const tangipahoaApplyHref = "/contractors/apply?state=LA&county=22105&source=tangipahoa-launch";
  const tangipahoaDemandHref =
    "/direct-connect?county=22105&source=tangipahoa-launch&intent=provider_demand";
  const topQueries = BUSINESS_POPULAR_QUERIES.slice(0, 16);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "TradeScout for Small Local Service Businesses",
        description:
          "TradeScout helps small local service businesses earn trusted local demand without pay-to-play lead selling. Build trust, respond to real requests, and grow county by county.",
        url: "https://www.thetradescout.com/for-businesses",
      },
      createBreadcrumbStructuredData([
        { name: "TradeScout", url: "/" },
        { name: "For Businesses", url: "/for-businesses" },
      ]),
      createFAQStructuredData(faqItems),
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <SEOHelmet
        title="TradeScout for Small Local Service Businesses"
        description="TradeScout helps small local service businesses win more trusted local work without pay-to-play lead selling. Build trust, respond to real requests, and grow county by county."
        keywords="small business marketing for contractors, small local service business growth, local contractor leads, how to get more local jobs, direct connect requests, trades business platform"
        canonical="https://www.thetradescout.com/for-businesses"
        structuredData={structuredData}
      />

      <section className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold text-white">
          Grow your business with trust-first local demand
        </h1>
        <p className="text-white/70 max-w-3xl">
          TradeScout helps contractors and local service businesses get in front of people who are
          actively looking for help. Contact is gated by intent and trust, not bought rankings.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={tangipahoaApplyHref}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Claim Tangipahoa coverage
            </Button>
          </Link>
          <Link href={tangipahoaDemandHref}>
            <Button variant="outline" className="border-white/20 text-white">
              View Tangipahoa demand flow
            </Button>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-white/5 p-5 md:p-6 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/70 font-semibold">
          Popular Searches Right Now
        </p>
        <h2 className="text-2xl font-semibold text-white">High-intent business queries</h2>
        <p className="text-sm text-white/70 max-w-3xl">
          These are the terms businesses are actively using. Build profile coverage around these
          clusters so demand lands on your surface first.
        </p>
        <div className="flex flex-wrap gap-2">
          {topQueries.map((item) => (
            <Link key={item.query} href={item.href}>
              <a className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:border-ts-orange/50 hover:text-white transition-colors">
                {item.query}
              </a>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-ts-orange/35 bg-ts-orange/10 p-5 md:p-6 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ts-orange font-semibold">
          Launch Focus
        </p>
        <h2 className="text-2xl font-bold text-white">Tangipahoa Parish, LA business launch</h2>
        <p className="text-sm text-white/75 max-w-3xl">
          We are concentrating onboarding in Tangipahoa Parish first. Businesses that activate now
          get early local visibility with county-level demand coverage.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={tangipahoaApplyHref}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Start Tangipahoa onboarding
            </Button>
          </Link>
          <Link href="/tangipahoa">
            <Button variant="outline" className="border-white/20 text-white">
              Open Tangipahoa hub
            </Button>
          </Link>
          <Link href="/trade/hvac/la">
            <Button variant="outline" className="border-white/20 text-white">
              Browse LA trade demand
            </Button>
          </Link>
          <Link href="/trade/electrical/la">
            <Button variant="outline" className="border-white/20 text-white">
              Louisiana electrical lane
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-lg font-semibold text-white">Real local intent</h2>
            <p className="text-sm text-white/70">
              Requests come from people looking for real help in real counties, not generic ad
              clicks.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-lg font-semibold text-white">No pay-to-play ranking</h2>
            <p className="text-sm text-white/70">
              Exposure is governed by trust and fit signals. Payment does not override trust
              placement.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-lg font-semibold text-white">County-level focus</h2>
            <p className="text-sm text-white/70">
              Operate where you actually work. TradeScout routes and context are built around county
              operations.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Where to start</h2>
        <ul className="list-disc pl-5 text-white/70 space-y-2">
          <li>Complete your business profile and role setup.</li>
          <li>Publish service details and county coverage.</li>
          <li>Use Direct Connect to review and respond to local requests.</li>
          <li>Build trust through high-quality outcomes and consistency.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Explore demand surfaces</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/trade">
            <Button variant="outline" className="border-white/20 text-white">
              Browse trade categories
            </Button>
          </Link>
          <Link href="/county-directory">
            <Button variant="outline" className="border-white/20 text-white">
              Browse counties
            </Button>
          </Link>
          <Link href="/how-it-works">
            <Button variant="outline" className="border-white/20 text-white">
              Read how TradeScout works
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
