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
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "TradeScout for Contractors and Local Businesses",
        description:
          "Grow with local intent-driven demand on TradeScout. Join as a contractor or local business, build trust, and connect through Direct Connect.",
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
        title="TradeScout for Contractors and Local Businesses"
        description="Join TradeScout to win local work without pay-to-play lead selling. Build trust, respond to local requests, and grow county by county."
        keywords="contractor leads, local business growth, contractor marketing, county contractor jobs, direct connect requests, trades business platform"
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
          <Link href="/contractors/apply">
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
              Join as a business
            </Button>
          </Link>
          <Link href="/direct-connect">
            <Button variant="outline" className="border-white/20 text-white">
              Open Direct Connect
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
