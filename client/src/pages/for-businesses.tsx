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
    question: "How does TradeScout help local businesses get work or sales?",
    answer:
      "TradeScout routes real local requests and profile purchases through gated flows. Businesses get matched on trust and fit instead of pay-to-play lead buying.",
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
    question: "How do I join as a business?",
    answer:
      "Use business onboarding, complete your profile and verification prompts, publish fixed-price services or items if you want, then respond to matched local requests in Direct Connect.",
  },
];

export default function ForBusinessesPage() {
  const tangipahoaApplyHref = "/businesses/apply?state=LA&county=22105&source=tangipahoa-launch";
  const tangipahoaDemandHref =
    "/direct-connect?county=22105&source=tangipahoa-launch&intent=provider_demand";
  const topQueries = BUSINESS_POPULAR_QUERIES.slice(0, 16);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "TradeScout for Local Businesses",
        description:
          "TradeScout helps local businesses earn trusted demand without pay-to-play lead selling. Build trust, sell services or items, respond to real requests, and grow county by county.",
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
        title="TradeScout for Local Businesses"
        description="TradeScout helps local businesses win more trusted local work and sales without pay-to-play lead selling. Build trust, publish offers, respond to real requests, and grow county by county."
        keywords="local business growth, small business marketing, local service business growth, sell local services online, sell local products online, direct connect requests, business profile platform"
        canonical="https://www.thetradescout.com/for-businesses"
        structuredData={structuredData}
      />

      <section className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold text-white">
          Get more work from people who already need it
        </h1>
        <p className="text-white/70 max-w-3xl">
          {
            "We put your business in front of people in your area who are actively looking for help, services, or products. No bidding for placement, no buying your way to the top — just real requests."
          }
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

      {/* Pensacola, FL business launch — expanding market */}
      <section className="rounded-2xl border border-ts-orange/35 bg-ts-orange/10 p-5 md:p-6 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ts-orange font-semibold">
          Launch Focus
        </p>
        <h2 className="text-2xl font-bold text-white">Pensacola, FL business launch</h2>
        <p className="text-sm text-white/75 max-w-3xl">
          TradeScout is expanding into Pensacola, FL. Businesses in Escambia and Santa Rosa County
          can activate now to get early local visibility and county-level demand coverage.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/businesses/apply?state=FL&county=12033&source=pensacola-launch`}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Start Pensacola onboarding
            </Button>
          </Link>
          <Link href="/pensacola">
            <Button variant="outline" className="border-white/20 text-white">
              Pensacola hub
            </Button>
          </Link>
          <Link href="/pensacola/electrical-contractors">
            <Button variant="outline" className="border-white/20 text-white">
              Electrical services
            </Button>
          </Link>
          <Link href="/pensacola/hvac-repair">
            <Button variant="outline" className="border-white/20 text-white">
              HVAC repair
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-lg font-semibold text-white">Real requests, not clicks</h2>
            <p className="text-sm text-white/70">
              Every request comes from someone nearby who actually needs the work done — not an ad
              click with no intent behind it.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-lg font-semibold text-white">You can't buy your way to the top</h2>
            <p className="text-sm text-white/70">
              How you show up depends on trust and fit for the job — not who pays the most.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-lg font-semibold text-white">Only jobs where you actually work</h2>
            <p className="text-sm text-white/70">
              We organize everything by county, so you only see requests from the areas you cover.
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
        <h2 className="text-2xl font-semibold text-white">See where the work is</h2>
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
