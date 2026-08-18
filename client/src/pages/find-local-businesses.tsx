import { Link } from "wouter";
import {
  SEOHelmet,
  createBreadcrumbStructuredData,
  createFAQStructuredData,
} from "@/components/SEOHelmet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HOMEOWNER_POPULAR_QUERIES } from "@/lib/popularSearchQueries";

const faqItems = [
  {
    question: "How do I find trustworthy local businesses or contractors near me?",
    answer:
      "Use TradeScout Direct Connect to post what you need, filter by your local county context, and review trusted local businesses and contractors before contact.",
  },
  {
    question: "Can I search by trade and county?",
    answer:
      "Yes. TradeScout supports trade and county surfaces so you can narrow options to your local market.",
  },
  {
    question: "Does TradeScout sell my request as a lead?",
    answer:
      "No. TradeScout helps you contact the right business for your request instead of reselling your request as a lead.",
  },
  {
    question: "What if I need help deciding who to contact?",
    answer:
      "Scout and Direct Connect help you compare signals, stay county-aware, and move from discovery to action without skipping trust steps.",
  },
];

export default function FindLocalBusinessesPage() {
  const tangipahoaHref =
    "/direct-connect?county=22105&source=tangipahoa-launch&intent=local_search";
  const tangipahoaCountyHref = "/county/la/tangipahoa/recent";
  const topQueries = HOMEOWNER_POPULAR_QUERIES.slice(0, 18);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Find Local Businesses, Services, and Contractors",
        description:
          "Find local businesses, services, and contractors on TradeScout. Compare options by county and trade, then contact businesses through TradeScout.",
        url: "https://www.thetradescout.com/find-local-businesses",
      },
      createBreadcrumbStructuredData([
        { name: "TradeScout", url: "/" },
        { name: "Find Local Businesses", url: "/find-local-businesses" },
      ]),
      createFAQStructuredData(faqItems),
    ],
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <SEOHelmet
        title="Find Local Businesses, Services, and Contractors | TradeScout"
        description="Find local businesses, services, and contractors by trade and county. Compare trustworthy options and connect through TradeScout Direct Connect."
        keywords="find local businesses, contractor search, local businesses near me, county contractors, local services, trusted local businesses and contractors, direct connect"
        canonical="https://www.thetradescout.com/find-local-businesses"
        structuredData={structuredData}
      />

      <section className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold text-white">
          Find local businesses without the noise
        </h1>
        <p className="text-white/70 max-w-3xl">
          TradeScout helps you find local businesses, services, and professionals who serve your
          area. Start with trade and county context, then connect through a trust-first flow.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={tangipahoaHref}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Get my Tangipahoa shortlist
            </Button>
          </Link>
          <Link href="/trade">
            <Button variant="outline" className="border-white/20 text-white">
              Browse contractor-heavy trades
            </Button>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-ts-orange/35 bg-ts-orange/10 p-5 md:p-6 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ts-orange font-semibold">
          Ground Zero Market
        </p>
        <h2 className="text-2xl font-bold text-white">Tangipahoa Parish, LA first</h2>
        <p className="text-sm text-white/75 max-w-3xl">
          We are hyper-focused on Tangipahoa Parish first so local users get stronger match quality
          and faster response loops while we scale outward.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={tangipahoaHref}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Start a Tangipahoa request
            </Button>
          </Link>
          <Link href="/tangipahoa">
            <Button variant="outline" className="border-white/20 text-white">
              Open Tangipahoa hub
            </Button>
          </Link>
          <Link href={tangipahoaCountyHref}>
            <Button variant="outline" className="border-white/20 text-white">
              View Tangipahoa activity
            </Button>
          </Link>
          <Link href="/trade/hvac/la">
            <Button variant="outline" className="border-white/20 text-white">
              Louisiana HVAC demand
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-lg font-semibold text-white">Search by what you need</h2>
            <p className="text-sm text-white/70">
              Start with your project type, then narrow by local context to avoid broad, low-fit
              results.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-lg font-semibold text-white">Stay county-aware</h2>
            <p className="text-sm text-white/70">
              TradeScout organizes operational intelligence by county so local decisions are
              grounded in place.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5 space-y-2">
            <h2 className="text-lg font-semibold text-white">Contact local businesses</h2>
            <p className="text-sm text-white/70">
              Contact businesses through TradeScout instead of sending the same request everywhere.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Popular searches right now</h2>
        <p className="text-sm text-white/70 max-w-3xl">
          These are real searches people are using, including contractor search and broader local
          business discovery. Pick one to jump into a local path, then create an account to save
          your shortlist and track replies.
        </p>
        <div className="flex flex-wrap gap-2">
          {topQueries.map((item) => (
            <Link key={item.query} href={item.href}>
              <a className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 hover:border-ts-orange/50 hover:text-white transition-colors">
                {item.query}
              </a>
            </Link>
          ))}
        </div>
      </section>

      {/* Pensacola, FL first — launch market focus */}
      <section className="rounded-2xl border border-ts-orange/35 bg-ts-orange/10 p-5 md:p-6 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ts-orange font-semibold">
          Ground Zero Market
        </p>
        <h2 className="text-2xl font-bold text-white">Pensacola, FL first</h2>
        <p className="text-sm text-white/75 max-w-3xl">
          TradeScout is expanding into Pensacola, FL. If you're in Escambia or Santa Rosa County,
          explore local service clusters and get matched with verified local businesses.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/direct-connect?county=12033&source=pensacola-launch&intent=local_search`}>
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Start a Pensacola request
            </Button>
          </Link>
          <Link href="/pensacola">
            <Button variant="outline" className="border-white/20 text-white">
              Pensacola hub
            </Button>
          </Link>
          <Link href="/pensacola/hvac-repair">
            <Button variant="outline" className="border-white/20 text-white">
              HVAC repair
            </Button>
          </Link>
          <Link href="/pensacola/plumbing">
            <Button variant="outline" className="border-white/20 text-white">
              Plumbing
            </Button>
          </Link>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold text-white">Next steps</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/county-directory">
            <Button variant="outline" className="border-white/20 text-white">
              Browse county directory
            </Button>
          </Link>
          <Link href="/community-feed">
            <Button variant="outline" className="border-white/20 text-white">
              Open community feed
            </Button>
          </Link>
          <Link href="/help">
            <Button variant="outline" className="border-white/20 text-white">
              Read help and FAQs
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
