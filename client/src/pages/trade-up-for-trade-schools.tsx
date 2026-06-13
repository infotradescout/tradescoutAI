import { memo } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Mail,
  Megaphone,
  Ruler,
  ShieldCheck,
  Shirt,
  Wrench,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

const campaignItems = [
  {
    title: "Campaign construction pencils",
    description: "Flat carpenter pencils branded for the Trade-Up For Trade Schools campaign.",
    action: "Request item list",
    icon: ClipboardList,
  },
  {
    title: "Jobsite decals",
    description: "Campaign decals for trucks, trailers, toolboxes, shops, and job boards.",
    action: "Ask about sponsoring",
    icon: BadgeCheck,
  },
  {
    title: "Sponsor cards",
    description: "Printed campaign cards for businesses and supporters.",
    action: "Ask about sponsoring",
    icon: ClipboardList,
  },
  {
    title: "Crew and shop signage",
    description: "Simple campaign signage for participating crews, shops, and sponsor locations.",
    action: "Get campaign updates",
    icon: Ruler,
  },
  {
    title: "Branded apparel",
    description: "Campaign apparel options for supporters and participating businesses.",
    action: "Request item list",
    icon: Shirt,
  },
];

const previewItems = [
  "Construction pencils",
  "Jobsite decals",
  "Sponsor cards",
  "Crew signage",
  "Branded apparel",
];

const howItWorks = [
  {
    title: "Request the campaign item list",
    description: "TradeScout shares the available campaign-branded item options.",
  },
  {
    title: "Choose the items that fit",
    description:
      "Supporters and sponsors choose practical branded materials connected to the campaign.",
  },
  {
    title: "Support the scholarship initiative",
    description:
      "Campaign item support is dedicated to the Trade-Up For Trade Schools scholarship initiative.",
  },
];

const contactHref =
  "mailto:contact@thetradescout.com?subject=Trade-Up%20For%20Trade%20Schools%20campaign";

const TradeUpForTradeSchoolsPage = memo(function TradeUpForTradeSchoolsPage() {
  return (
    <>
      <SEOHelmet
        title="Trade-Up For Trade Schools | TradeScout"
        description="Buy campaign-branded items that help support future trade school scholarships."
        canonical="https://www.thetradescout.com/trade-up-for-trade-schools"
      />

      <main className="min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-950">
        <header className="border-b border-zinc-200/80 bg-white">
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
              Sponsor
            </a>
          </div>
        </header>

        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-7 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8 lg:py-12">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-zinc-700 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-ts-orange" />
                TradeScout Campaign Initiative
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-normal text-zinc-950 sm:text-5xl lg:text-[4rem]">
                Trade-Up For Trade Schools
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-700">
                Buy campaign-branded items that help support future trade school scholarships.
              </p>
              <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-700">
                A TradeScout-run campaign built around practical branded items, sponsor support, and
                a separate direct donation path.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="#campaign-items"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3 text-sm font-bold text-white hover:bg-zinc-800"
                >
                  Request campaign item list
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={contactHref}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-950 hover:bg-zinc-50"
                >
                  Sponsor the campaign
                  <Mail className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-3 text-sm font-semibold text-zinc-700">
                Direct donation portal handled separately.
              </p>
            </div>

            <aside className="w-full min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-900">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Campaign catalog
                  </p>
                  <h2 className="mt-1 text-2xl font-black leading-tight text-zinc-950">
                    Campaign item list
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-700">
                Request the current Trade-Up item list for branded campaign materials connected to
                the scholarship initiative.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {previewItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-800"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <a
                href={contactHref}
                className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-zinc-50"
              >
                Request item list
                <ArrowRight className="h-4 w-4" />
              </a>
            </aside>
          </div>
        </section>

        <section
          id="campaign-items"
          className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
        >
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-zinc-500">
              Campaign Items
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight text-zinc-950">
              Campaign items dedicated to the initiative
            </h2>
            <p className="mt-3 text-base leading-7 text-zinc-700">
              Supporters, businesses, crews, shops, and sponsors can request Trade-Up For Trade
              Schools branded items connected to the campaign.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaignItems.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-900">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-black leading-snug text-zinc-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-700">{item.description}</p>
                  <a
                    href={contactHref}
                    className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-bold text-zinc-950 hover:bg-zinc-50"
                  >
                    {item.action}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <div className="mb-6 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-zinc-500" />
              <h2 className="text-2xl font-black text-zinc-950">How the campaign works</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {howItWorks.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="text-lg font-black leading-snug text-zinc-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-700">{step.description}</p>
                </article>
              ))}
            </div>
            <p className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-800">
              Direct donation portal handled separately.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-zinc-500">
              Sponsor/support path
            </p>
            <h2 className="mt-2 text-3xl font-black leading-tight text-zinc-950">
              For sponsors and supporters
            </h2>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-base leading-7 text-zinc-700">
              Sponsors can support the campaign by backing branded item runs, requesting
              sponsor-ready item packages, or helping distribute campaign materials.
            </p>
            <a
              href={contactHref}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 py-3 text-sm font-bold text-white hover:bg-zinc-800"
            >
              Sponsor the campaign
              <Megaphone className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-zinc-500">Purpose</p>
              <h2 className="mt-2 text-3xl font-black leading-tight text-zinc-950">
                Why Trade-Up exists
              </h2>
            </div>
            <p className="text-base leading-7 text-zinc-700">
              TradeScout believes skilled trades deserve stronger local support. Trade-Up For Trade
              Schools turns practical campaign branding into support for future trade school
              scholarships.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:grid-cols-[auto_1fr]">
            <ShieldCheck className="h-6 w-6 text-zinc-500" />
            <div>
              <h2 className="text-lg font-black text-zinc-950">Campaign boundary</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-zinc-800">
                Trade-Up For Trade Schools is a TradeScout-run campaign initiative. No school
                partnership, school endorsement, nonprofit status, tax-deductibility, scholarship
                recipient, or distribution process is implied unless formally stated by TradeScout.
                Direct donation portal handled separately.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
});

export default TradeUpForTradeSchoolsPage;
