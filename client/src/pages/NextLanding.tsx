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
  "Find a roofer I can trust nearby",
  "Help me compare quotes before I call anyone",
  "What should I ask before I hire a plumber?",
];

function buildScoutPromptHref(prompt: string) {
  return `/scout?prompt=${encodeURIComponent(prompt)}`;
}

const modeCards = [
  {
    title: "Ask Scout",
    description:
      "Start here when you want the fastest path forward. Ask once, get direction, and keep the next move clear.",
    href: "/scout",
    badge: "Fastest path",
  },
  {
    title: "Browse on your own",
    description:
      "Start here when you know what you want and just need a calmer way to move through TradeScout.",
    href: "/next/browse",
    badge: "More control",
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
            <div className="mt-1 text-lg font-semibold tracking-tight">A simpler way in</div>
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
              Current site
            </Link>
          </div>
        </nav>

        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/60">
              <ShieldCheck className="h-3.5 w-3.5 text-ts-orange" />
              Find help without the noise
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Start with Scout, or explore at your own pace.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
                Use Scout when you want a quick answer and a clear next step. Browse when you want
                to look around without feeling buried in routes and options.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/scout"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "min-w-[12rem] justify-center rounded-2xl px-6"
                )}
              >
                Ask Scout
              </Link>
              <Link
                href="/next/browse"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "min-w-[12rem] justify-center rounded-2xl px-6"
                )}
              >
                Explore on your own
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {modeCards.map((card, index) => (
                <Card
                  key={card.title}
                  className={cn(
                    "border-white/10 bg-white/[0.04] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]",
                    index === 0 ? "md:translate-y-4" : ""
                  )}
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
                      {card.title}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b0d11]/95 p-6 shadow-[0_40px_140px_-60px_rgba(0,0,0,0.92)]">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="absolute right-[-4rem] top-[-3rem] h-40 w-40 rounded-full bg-ts-orange/12 blur-3xl" />
            <div className="relative space-y-6">
              <div>
                <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-ts-orange/20 bg-ts-orange/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ts-orange">
                  <Sparkles className="h-3.5 w-3.5" />
                  Ask Scout
                </div>
                <div className="text-sm uppercase tracking-[0.18em] text-white/42">Fast lane</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  Tell Scout what is going on.
                </h2>
                <p className="mt-3 max-w-lg text-base leading-7 text-white/62">
                  It helps sort the request, narrow the next step, and keep you from wandering the
                  product.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.18em] text-white/45">
                  Start here
                </div>
                <Input
                  value="What do you need help with today?"
                  readOnly
                  className="h-12 border-0 bg-transparent px-0 text-base text-white/90 shadow-none"
                />
              </div>

              <div className="grid gap-2">
                {samplePrompts.map((prompt) => (
                  <Link
                    key={prompt}
                    href={buildScoutPromptHref(prompt)}
                    className="group flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/72 transition hover:border-ts-orange/30 hover:bg-white/[0.05] hover:text-white"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="h-4 w-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-ts-orange" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]">
            <CardHeader>
              <CardTitle className="text-xl">Two good ways to use TradeScout</CardTitle>
              <CardDescription className="text-white/60">
                Some days you want guidance. Some days you want control. You should be able to tell
                which path fits right away.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <MessageSquareText className="mb-3 h-5 w-5 text-ts-orange" />
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
                  Fast lane
                </div>
                <div className="text-sm font-semibold text-white">Ask Scout</div>
                <div className="mt-2 text-sm leading-6 text-white/62">
                  Start here when you want the next step handed to you clearly.
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <Compass className="mb-3 h-5 w-5 text-sky-300" />
                <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
                  Open lane
                </div>
                <div className="text-sm font-semibold text-white">Browse TradeScout</div>
                <div className="mt-2 text-sm leading-6 text-white/62">
                  Start here when you want to move directly through the product.
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {browseBuckets.map((bucket, index) => {
              const icons = [Search, Compass, LayoutDashboard];
              const Icon = icons[index] ?? Search;
              return (
                <Card
                  key={bucket.title}
                  className="border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]"
                >
                  <CardHeader className="min-h-[10.5rem]">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
                      Preview
                    </div>
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
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "rounded-2xl px-6")}
          >
            See the calmer home
          </Link>
          <Button variant="ghost" size="lg" asChild>
            <a href="/landing">See current landing</a>
          </Button>
        </section>
      </div>
    </main>
  );
}
