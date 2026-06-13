import { memo } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ClipboardList,
  Drill,
  HardHat,
  Mail,
  PenLine,
  Ruler,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

const campaignItems = [
  {
    title: "Campaign construction pencils",
    description:
      "Flat carpenter pencil-style branding items for crews, shops, classrooms, and campaign tables.",
    action: "Request item list",
    icon: PenLine,
  },
  {
    title: "Jobsite decals",
    description:
      "Simple campaign marks for toolboxes, job folders, shop doors, and training spaces.",
    action: "Sponsor an item",
    icon: BadgeCheck,
  },
  {
    title: "Sponsor cards",
    description:
      "Compact handout cards that explain the scholarship initiative and campaign item path.",
    action: "Sponsor an item",
    icon: ClipboardList,
  },
  {
    title: "Shop or crew signage",
    description:
      "Cause-dedicated signage concepts for trade shops, crews, events, and local partners.",
    action: "Get campaign updates",
    icon: Ruler,
  },
  {
    title: "Branded apparel",
    description:
      "Campaign apparel concepts for supporters who want visible skilled-trades education support.",
    action: "Request item list",
    icon: HardHat,
  },
];

const tradeFields = ["welding", "electrical", "HVAC", "plumbing", "construction"];

const TradeUpForTradeSchoolsPage = memo(function TradeUpForTradeSchoolsPage() {
  return (
    <>
      <SEOHelmet
        title="Trade-Up For Trade Schools | TradeScout"
        description="A TradeScout initiative supporting trade school scholarships through cause-dedicated campaign branding items."
        canonical="https://www.thetradescout.com/trade-up-for-trade-schools"
      />

      <main className="min-h-screen bg-tsBg text-white">
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="absolute left-6 top-12 hidden h-6 w-72 rotate-[-8deg] rounded-sm bg-ts-orange/80 shadow-[0_0_36px_rgba(236,107,32,0.34)] md:block">
            <div className="absolute left-0 top-0 h-full w-10 bg-zinc-900/80" />
            <div className="absolute right-0 top-0 h-full w-12 bg-white/15" />
          </div>
          <div className="absolute bottom-10 right-8 hidden h-4 w-56 rotate-[9deg] rounded-sm bg-zinc-200/70 md:block">
            <div className="absolute left-0 top-0 h-full w-8 bg-ts-orange" />
            <div className="absolute right-0 top-0 h-full w-10 bg-zinc-900/70" />
          </div>

          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8 lg:py-20">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-ts-orange">
                <HardHat className="h-4 w-4" />
                TradeScout campaign initiative
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Trade-Up For Trade Schools
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">
                Purchase campaign branding items dedicated to funding trade school scholarships.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#campaign-items"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ts-orange px-5 py-3 text-sm font-semibold text-white hover:bg-ts-orange-dark"
                >
                  View campaign items
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="mailto:contact@thetradescout.com?subject=Trade-Up%20For%20Trade%20Schools%20sponsor%20interest"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/8 px-5 py-3 text-sm font-semibold text-white hover:bg-white/14"
                >
                  Sponsor the campaign
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
              <div className="rounded-md border border-ts-orange/30 bg-ts-orange/10 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-ts-orange text-white">
                    <PenLine className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ts-orange">
                      Construction pencil motif
                    </p>
                    <p className="text-sm text-white/70">Practical, jobsite-ready campaign mark.</p>
                  </div>
                </div>
                <div className="relative h-16 rounded-md bg-zinc-950/80">
                  <div className="absolute left-5 top-1/2 h-7 w-[78%] -translate-y-1/2 rounded-sm bg-ts-orange">
                    <div className="absolute left-3 top-1/2 h-px w-[85%] -translate-y-1/2 bg-black/35" />
                  </div>
                  <div className="absolute right-5 top-1/2 h-7 w-12 -translate-y-1/2 rounded-sm bg-zinc-200" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-white/65">
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-2">
                  Tools
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-2">
                  Shops
                </span>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-2">
                  Crews
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ts-orange">
                Mission
              </p>
              <h2 className="mt-2 text-3xl font-bold">Support the next generation of trades.</h2>
            </div>
            <div className="space-y-4 text-base leading-relaxed text-white/72">
              <p>
                Trade-Up For Trade Schools supports trade school scholarships and skilled-trades
                education through cause-dedicated campaign branding items people can purchase.
              </p>
              <p>
                The campaign is built around practical fields like {tradeFields.join(", ")}, and
                other skilled trades that keep local communities working.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-ts-orange" />
              <h2 className="text-2xl font-bold">How It Works</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                "Choose a campaign branding item",
                "Purchase through the campaign catalog",
                "Your purchase supports the scholarship initiative",
              ].map((step, index) => (
                <div key={step} className="rounded-lg border border-white/10 bg-tsCard p-5">
                  <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-ts-orange text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-lg font-semibold text-white">{step}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-white/80">
              Direct donation portal handled separately.
            </p>
          </div>
        </section>

        <section id="campaign-items" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-7 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ts-orange">
              Campaign Items
            </p>
            <h2 className="mt-2 text-3xl font-bold">Informational catalog preview</h2>
            <p className="mt-3 text-white/70">
              These are campaign item categories only. Final item availability and catalog details
              belong in the campaign catalog, not this public info page.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaignItems.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-lg border border-white/10 bg-tsCard p-5"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-white/8 text-ts-orange">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 min-h-[72px] text-sm leading-relaxed text-white/65">
                    {item.description}
                  </p>
                  <a
                    href="mailto:contact@thetradescout.com?subject=Trade-Up%20For%20Trade%20Schools%20campaign%20items"
                    className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white hover:bg-white/14"
                  >
                    {item.action}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="grid gap-4 rounded-lg border border-white/10 bg-black/25 p-5 md:grid-cols-[auto_1fr]">
            <ShieldCheck className="h-6 w-6 text-ts-orange" />
            <div>
              <h2 className="text-lg font-semibold text-white">Campaign boundary</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/68">
                This page explains the Trade-Up For Trade Schools campaign and campaign item
                categories. It does not process purchases, collect payments, or publish donation
                totals.
              </p>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-white/80">
                Direct donation portal handled separately. No tax-deductibility or nonprofit status
                is implied unless formally stated by the campaign.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-white/[0.03]">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-white/60 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div className="flex items-center gap-2">
              <Drill className="h-4 w-4 text-ts-orange" />
              <span>Trade-Up For Trade Schools is a TradeScout campaign initiative.</span>
            </div>
            <Link href="/training-center">
              <a className="inline-flex items-center gap-2 font-semibold text-ts-orange hover:underline">
                View skilled-trades learning context
                <BookOpen className="h-4 w-4" />
              </a>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
});

export default TradeUpForTradeSchoolsPage;
