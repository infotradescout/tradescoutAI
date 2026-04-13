import { Link } from "wouter";
import {
  SEOHelmet,
  createBreadcrumbStructuredData,
  createFAQStructuredData,
} from "@/components/SEOHelmet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const faqItems = [
  {
    question: "How do I find trustworthy local contractors near me?",
    answer:
      "Use TradeScout Direct Connect to post what you need, filter by your local county context, and review matched businesses before contact.",
  },
  {
    question: "Can I search by trade and county?",
    answer:
      "Yes. TradeScout supports trade and county surfaces so you can narrow options to your local market.",
  },
  {
    question: "Does TradeScout sell my request as a lead?",
    answer:
      "No. TradeScout is built around intent-gated contact and trust controls rather than lead resale.",
  },
  {
    question: "What if I need help deciding who to contact?",
    answer:
      "Scout and Direct Connect help you compare signals, stay county-aware, and move from discovery to action without skipping trust steps.",
  },
];

export default function FindLocalBusinessesPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Find Local Businesses and Contractors",
        description:
          "Find local businesses and contractors on TradeScout. Compare options by county and trade, then connect through intent-gated contact.",
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
        title="Find Local Businesses and Contractors | TradeScout"
        description="Find local contractors and businesses by trade and county. Compare trustworthy options and connect through TradeScout Direct Connect."
        keywords="find local contractors, local businesses near me, county contractors, home service businesses, trusted contractor search, direct connect"
        canonical="https://www.thetradescout.com/find-local-businesses"
        structuredData={structuredData}
      />

      <section className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold text-white">
          Find local businesses without the noise
        </h1>
        <p className="text-white/70 max-w-3xl">
          TradeScout helps you find businesses and contractors who serve your local area. Start with
          trade and county context, then connect through a trust-first flow.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/direct-connect">
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Start in Direct Connect
            </Button>
          </Link>
          <Link href="/trade">
            <Button variant="outline" className="border-white/20 text-white">
              Browse trades
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
            <h2 className="text-lg font-semibold text-white">Contact with intention</h2>
            <p className="text-sm text-white/70">
              Contact is gated through intent and decision steps, helping reduce spammy outreach.
            </p>
          </CardContent>
        </Card>
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
