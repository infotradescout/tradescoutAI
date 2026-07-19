import { Link } from "wouter";
import {
  SEOHelmet,
  createBreadcrumbStructuredData,
  createFAQStructuredData,
} from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

const BUSINESS_ENTRY_HREF = "/claim-my-business?source=for_businesses";

const faqItems = [
  {
    question: "How does TradeScout help my business?",
    answer:
      "TradeScout brings your public presence, proof, customer requests, active work, and follow-up together so people can choose you with confidence and you can manage the relationship in one place.",
  },
  {
    question: "Does paying more increase my ranking on TradeScout?",
    answer:
      "No. Businesses cannot buy placement or purchase customer leads. Visibility is shaped by relevance, verified facts, trust, and real outcomes.",
  },
  {
    question: "Do I have to rebuild everything from scratch?",
    answer:
      "No. Selective Inheritance can bring forward useful, provable material from your existing website, public reputation, credentials, catalogs, and other outside sources while leaving weak or outdated material behind.",
  },
  {
    question: "Where do I start?",
    answer:
      "Search for your business first. Claim it if it is already here, or create it if it is not. Then confirm what is true and publish when it is ready.",
  },
];

const advantages = [
  {
    icon: FileCheck2,
    title: "Keep what already works",
    body: "Selective Inheritance carries forward the strongest provable parts of your website, reputation, credentials, products, services, and past work—without copying the weak parts.",
  },
  {
    icon: BadgeCheck,
    title: "Show proof before promises",
    body: "Verification, trust context, real media, recommendations, availability, and completed outcomes help customers understand why you are the right fit.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Run the relationship in one place",
    body: "Direct Connect carries the customer's real intent into the request, conversation, job, follow-up, and recommendation cycle without selling the lead.",
  },
  {
    icon: RefreshCw,
    title: "Improve as the business evolves",
    body: "Your presence can stay current with new work, stronger proof, changing availability, and verified outcomes instead of becoming another forgotten website.",
  },
];

const startSteps = [
  "Find your business or create it once.",
  "Confirm the facts, ownership, service area, and proof that matter.",
  "Publish when it is ready, then respond, work, and evolve.",
];

export default function ForBusinessesPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "TradeScout for Local Businesses",
        description:
          "TradeScout gives local businesses one trusted public presence for discovery, proof, Direct Connect requests, active work, outcomes, and follow-up without pay-to-play lead selling.",
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
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:space-y-8 md:py-12">
      <SEOHelmet
        title="TradeScout for Local Businesses"
        description="Bring your public presence, proof, customer requests, active work, and follow-up together without buying leads or paying for placement."
        keywords="local business profile, trusted local business, business verification, customer requests, direct connect, local business discovery"
        canonical="https://www.thetradescout.com/for-businesses"
        structuredData={structuredData}
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,106,0,0.18),transparent_42%),linear-gradient(145deg,rgba(17,29,36,0.98),rgba(10,15,19,0.98))] px-6 py-10 shadow-2xl md:px-10 md:py-14">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-ts-orange/20" />
        <div className="relative max-w-4xl space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-ts-orange">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Connection Without Compromise</span>
          </div>
          <div className="space-y-4">
            <h1 className="max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
              Give people a clear reason to choose your business.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-white/70 md:text-lg md:leading-8">
              TradeScout brings your best proof, real offers, customer requests, active work, and
              follow-up together. Customers get clarity. You keep control. The relationship is never
              sold to the highest bidder.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link href={BUSINESS_ENTRY_HREF}>
              <Button className="h-12 rounded-full bg-ts-orange px-6 text-base font-bold text-white shadow-[0_14px_35px_rgba(255,106,0,0.28)] hover:bg-ts-orange-dark">
                Claim or create your business
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/how-it-works">
              <a className="inline-flex h-12 items-center px-3 text-sm font-semibold text-white/75 transition-colors hover:text-white">
                See what customers experience
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </a>
            </Link>
          </div>

          <p className="text-sm font-medium text-white/60">
            Free forever. No lead fees. No paid placement. Start once and keep everything connected.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:p-8">
        <div className="mb-6 max-w-3xl space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">
            More than a website
          </p>
          <h2 className="text-3xl font-black tracking-[-0.03em] text-white md:text-4xl">
            Your business should not have to manage five disconnected systems.
          </h2>
          <p className="leading-7 text-white/70">
            TradeScout connects the public presence to the real work behind it. What a customer
            sees, asks, decides, and completes stays connected instead of disappearing into tabs,
            inboxes, lead marketplaces, and forgotten software.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {advantages.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-2xl border border-white/10 bg-black/20 p-5 transition-colors hover:border-white/20"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-ts-orange/12 text-ts-orange">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950 p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ts-orange">One way in</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-white">
            Claim it if it exists. Create it if it does not.
          </h2>
          <div className="mt-6 space-y-4">
            {startSteps.map((step, index) => (
              <div key={step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ts-orange/35 bg-ts-orange/10 text-xs font-black text-ts-orange">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-sm leading-6 text-white/70">{step}</p>
              </div>
            ))}
          </div>
          <Link href={BUSINESS_ENTRY_HREF}>
            <Button className="mt-7 rounded-full bg-ts-orange px-6 font-bold text-white hover:bg-ts-orange-dark">
              Find my business
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>

        <div className="rounded-[2rem] border border-ts-orange/25 bg-[linear-gradient(145deg,rgba(255,106,0,0.13),rgba(255,255,255,0.025))] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ts-orange">The deal</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-white">
            You respond, work, and evolve. TradeScout carries the rest.
          </h2>
          <div className="mt-5 space-y-3">
            {[
              "Your information is not packaged and sold as a lead.",
              "A bigger ad budget cannot buy trust or priority.",
              "Customers can move from discovery through follow-up without losing context.",
            ].map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-6 text-white/70">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-ts-orange" aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
