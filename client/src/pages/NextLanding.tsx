import {
  ArrowRight,
  Compass,
  LayoutDashboard,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { PageHead } from "@/components/PageHead";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const samplePrompts = [
  "Find a roofer I can trust in my county",
  "Help me compare quotes before I contact anyone",
  "What should I ask before hiring a plumber?",
];

const modeCards = [
  {
    title: "Guided mode",
    description:
      "Start with Scout when you want clarity fast. Ask once, get routed, and keep the next step obvious.",
    href: "/scout",
    badge: "Fast lane",
  },
  {
    title: "Browse mode",
    description:
      "Use a calmer navigation system when you want to explore categories, tools, and local surfaces directly.",
    href: "/next/browse",
    badge: "Structured",
  },
];

const browseBuckets = [
  {
    title: "Find Help",
    description: "Quotes, requests, direct connect, and trusted ways to move work forward.",
  },
  {
    title: "Explore Local",
    description: "County, business, and community surfaces grouped into a calmer browse layer.",
  },
  {
    title: "Business Tools",
    description:
      "Operational workspaces for contractors and business owners without mixing them into every consumer path.",
  },
];

export default function NextLanding() {
  return (
    <main className="min-h-screen bg-[#06070a] text-white">
      <PageHead
        title="TradeScout Next | Dual-Mode Preview"
        description="A reversible preview of a calmer dual-mode TradeScout experience."
        canonicalUrl="/next"
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-6rem] h-80 w-80 rounded-full bg-ts-orange/12 blur-3xl" />
        <div className="absolute right-[-8rem] top-32 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-16 pt-6 sm:px-6 lg:px-8">
        <nav className="mb-14 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">
              TradeScout Next
            </div>
            <div className="mt-1 text-lg font-semibold tracking-tight">Parallel UX preview</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
            <Link
              href="/next"
              className="rounded-full px-3 py-1.5 transition hover:bg-white/6 hover:text-white"
            >
              Preview
            </Link>
            <Link
              href="/next/browse"
              className="rounded-full px-3 py-1.5 transition hover:bg-white/6 hover:text-white"
            >
              Browse
            </Link>
            <Link
              href="/next/home"
              className="rounded-full px-3 py-1.5 transition hover:bg-white/6 hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/landing"
              className="rounded-full px-3 py-1.5 transition hover:bg-white/6 hover:text-white"
            >
              Current landing
            </Link>
          </div>
        </nav>

        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/60">
              <ShieldCheck className="h-3.5 w-3.5 text-ts-orange" />
              Calm, dual-mode navigation
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                One product, two clear ways to move through TradeScout.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                Scout mode is the guided fast lane. Browse mode is the calmer structured lane. This
                preview separates them on purpose so the product feels easier to trust and easier to
                use.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {modeCards.map((card) => (
                <Card
                  key={card.title}
                  className="border-white/10 bg-white/[0.04] backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <CardHeader>
                    <div className="mb-3 inline-flex w-fit rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/55">
                      {card.badge}
                    </div>
                    <CardTitle className="text-2xl">{card.title}</CardTitle>
                    <CardDescription className="max-w-sm text-white/62">
                      {card.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={card.href}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "w-full justify-between"
                      )}
                    >
                      Open {card.title}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="overflow-hidden border-white/10 bg-[#0b0d11]/95 shadow-[0_40px_140px_-60px_rgba(0,0,0,0.92)]">
            <CardHeader className="border-b border-white/8 pb-5">
              <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-ts-orange/20 bg-ts-orange/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ts-orange">
                <Sparkles className="h-3.5 w-3.5" />
                Ask Scout
              </div>
              <CardTitle className="text-2xl">Guided when you want speed</CardTitle>
              <CardDescription className="text-white/62">
                Keep the primary action obvious. Ask once, let Scout normalize intent, then route
                the next move.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                <Input
                  value="Need help finding a trusted electrician in my county"
                  readOnly
                  className="h-12 border-0 bg-transparent px-1 text-base text-white/90 shadow-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {samplePrompts.map((prompt) => (
                  <div
                    key={prompt}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70"
                  >
                    {prompt}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/scout"
                  className={cn(buttonVariants({ size: "lg" }), "min-w-[12rem] justify-center")}
                >
                  Continue to Scout
                </Link>
                <Link
                  href="/next/browse"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "min-w-[12rem] justify-center"
                  )}
                >
                  Browse instead
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-16 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-xl">The distinction should feel obvious</CardTitle>
              <CardDescription className="text-white/60">
                Guided mode handles uncertainty. Browse mode handles exploration. Both stay inside
                the same TradeScout product truth.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <MessageSquareText className="mb-3 h-5 w-5 text-ts-orange" />
                <div className="text-sm font-semibold text-white">Ask Scout</div>
                <div className="mt-2 text-sm leading-6 text-white/62">
                  Best when the user wants guidance, not route hunting.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <Compass className="mb-3 h-5 w-5 text-sky-300" />
                <div className="text-sm font-semibold text-white">Browse TradeScout</div>
                <div className="mt-2 text-sm leading-6 text-white/62">
                  Best when the user wants direct access to structured sections.
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {browseBuckets.map((bucket, index) => {
              const icons = [Search, Compass, LayoutDashboard];
              const Icon = icons[index] ?? Search;
              return (
                <Card key={bucket.title} className="border-white/10 bg-white/[0.03]">
                  <CardHeader>
                    <Icon className="mb-3 h-5 w-5 text-ts-orange" />
                    <CardTitle className="text-lg">{bucket.title}</CardTitle>
                    <CardDescription className="text-white/58">
                      {bucket.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mt-14 flex flex-wrap items-center gap-3">
          <Link
            href="/next/home"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
          >
            Preview calmer home
          </Link>
          <Button variant="ghost" size="lg" asChild>
            <a href="/landing">Compare against current production landing</a>
          </Button>
        </section>
      </div>
    </main>
  );
}
