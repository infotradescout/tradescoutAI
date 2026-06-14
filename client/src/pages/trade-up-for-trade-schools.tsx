import { memo } from "react";
import { Link } from "wouter";
import { ArrowRight, Mail, PlayCircle, Route, ShieldCheck, Share2, Sparkles } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

const contactHref =
  "mailto:contact@thetradescout.com?subject=Trade-Up%20For%20Trade%20Schools%20trade%20offer";

const steps = [
  {
    title: "Start with a carpenter pencil",
    description:
      "The campaign begins with one carpenter’s pencil - the first item in the trade-up chain.",
  },
  {
    title: "Trade up one step at a time",
    description: "Each accepted swap moves the campaign closer to the scholarship goal.",
  },
  {
    title: "Build toward $250,000",
    description: "The target is $250,000 worth of trade school scholarships.",
  },
];

const participation = [
  {
    title: "Offer a Trade",
    description: "Have something worth trading into the chain? Submit the offer for review.",
    icon: Route,
  },
  {
    title: "Connect the next step",
    description:
      "Know a business, maker, supplier, or supporter who could help the campaign trade up? Send the lead.",
    icon: Sparkles,
  },
  {
    title: "Follow and share",
    description: "Watch the video series and help the next trade find the right person.",
    icon: Share2,
  },
];

const TradeUpForTradeSchoolsPage = memo(function TradeUpForTradeSchoolsPage() {
  return (
    <>
      <SEOHelmet
        title="Trade-Up For Trade Schools | TradeScout"
        description="A TradeScout campaign series following the journey from one carpenter’s pencil to $250,000 in trade school scholarships."
        canonical="https://www.thetradescout.com/trade-up-for-trade-schools"
      />

      <main className="min-h-screen overflow-x-hidden bg-stone-50 text-zinc-950">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/">
              <a className="inline-flex items-center gap-2 text-sm font-bold text-zinc-950">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-950 text-[11px] text-white">
                  TS
                </span>
                TradeScout
              </a>
            </Link>
            <a
              href={contactHref}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Offer a Trade
            </a>
          </div>
        </header>

        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-14">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-zinc-700 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-ts-orange" />
                TradeScout Campaign Series
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-normal text-zinc-950 sm:text-5xl lg:text-[3.75rem]">
                Trade-Up For Trade Schools
              </h1>
              <p className="mt-5 max-w-3xl text-xl font-bold leading-8 text-zinc-900">
                Following the journey from a single carpenter’s pencil to $250,000 in trade school
                scholarships.
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-700">
                Follow the series, make a trade, or help connect the next step in the chain.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={contactHref}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3 text-sm font-bold text-white hover:bg-zinc-800"
                >
                  Offer a Trade
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#current-status"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-zinc-50"
                >
                  Follow the Trade-Up Series
                  <PlayCircle className="h-4 w-4" />
                </a>
                <a
                  href={contactHref}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-zinc-50"
                >
                  Connect the Next Trade
                  <Mail className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-3 text-sm font-semibold text-zinc-700">
                Direct donation portal is separate.
              </p>
            </div>

            <aside className="w-full min-w-0 rounded-lg border border-zinc-200 bg-stone-50 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                Starting point
              </p>
              <div className="mt-4 rounded-md border border-zinc-300 bg-white p-4">
                <div className="h-3 w-full rounded-sm bg-zinc-900" />
                <div className="mt-2 h-3 w-4/5 rounded-sm bg-[color:var(--theme-accent-primary,#ff6600)]" />
                <div className="mt-2 h-3 w-3/5 rounded-sm bg-zinc-300" />
              </div>
              <h2 className="mt-5 text-2xl font-black leading-tight text-zinc-950">
                One carpenter’s pencil. One public trade-up chain.
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-700">
                The pencil is the first trade, not a product line. Verified updates will be
                published as the campaign series progresses.
              </p>
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="mb-6 max-w-3xl">
            <h2 className="text-3xl font-black leading-tight text-zinc-950">
              How the trade-up works
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-lg border border-zinc-200 bg-white p-5">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950 text-sm font-bold text-white">
                  {index + 1}
                </div>
                <h3 className="text-lg font-black leading-snug text-zinc-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-700">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <div className="mb-6 max-w-3xl">
              <h2 className="text-3xl font-black leading-tight text-zinc-950">
                How to participate
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {participation.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border border-zinc-200 p-5">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-stone-50 text-zinc-900">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-black leading-snug text-zinc-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{item.description}</p>
                  </article>
                );
              })}
            </div>
            <a
              href={contactHref}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3 text-sm font-bold text-white hover:bg-zinc-800"
            >
              Offer a Trade
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section
          id="current-status"
          className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-10"
        >
          <article className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-2xl font-black leading-tight text-zinc-950">
              Current campaign status
            </h2>
            <p className="mt-3 text-base leading-7 text-zinc-700">
              Current starting item: TradeScout Carpenter’s Pencil. Verified trade updates will be
              published as the series progresses.
            </p>
            <p className="mt-3 rounded-md border border-zinc-200 bg-stone-50 px-3 py-2 text-sm font-bold text-zinc-800">
              Next accepted trade: not yet published.
            </p>
          </article>
          <article className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-2xl font-black leading-tight text-zinc-950">The goal</h2>
            <p className="mt-3 text-base leading-7 text-zinc-700">
              Turn one carpenter’s pencil into $250,000 worth of trade school scholarships through a
              public trade-up campaign.
            </p>
          </article>
        </section>

        <section className="border-y border-zinc-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-10">
            <h2 className="text-3xl font-black leading-tight text-zinc-950">Direct donations</h2>
            <p className="text-base leading-7 text-zinc-700">
              Direct donations will be handled through a separate portal. This page is for the
              trade-up campaign and participation path.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:grid-cols-[auto_1fr]">
            <ShieldCheck className="h-6 w-6 text-zinc-500" />
            <div>
              <h2 className="text-lg font-black text-zinc-950">Campaign boundary</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-zinc-800">
                Trade-Up For Trade Schools is an independent initiative run by TradeScout. Direct
                donations are separate. No nonprofit, tax-deductible, formal institutional
                affiliation, school endorsement, scholarship recipient, or distribution process is
                implied unless formally stated by TradeScout.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
});

export default TradeUpForTradeSchoolsPage;
