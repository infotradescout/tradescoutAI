import { ArrowRight, Bell, Compass, MessageSquare, Sparkles, TimerReset } from "lucide-react";
import { Link } from "wouter";
import { PageHead } from "@/components/PageHead";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const activeWork = [
  {
    title: "Roof inspection request",
    detail: "Scout has narrowed this to 2 next questions before contact is unlocked.",
    status: "Ready to continue",
  },
  {
    title: "County service comparison",
    detail: "Saved options in your county are waiting for a final preference check.",
    status: "In progress",
  },
  {
    title: "Quote review",
    detail: "One response needs a side-by-side decision pass before you move forward.",
    status: "Needs review",
  },
];

const utilities = [
  {
    title: "Messages",
    detail: "See recent replies and keep open threads from scattering across the app.",
    href: "/messages",
    icon: MessageSquare,
  },
  {
    title: "Browse categories",
    detail: "Jump into the curated browse hub when you want direct control.",
    href: "/next/browse",
    icon: Compass,
  },
  {
    title: "Notifications",
    detail: "Review alerts, saved work, and upcoming follow-up moments.",
    href: "/notifications",
    icon: Bell,
  },
];

export default function NextHome() {
  return (
    <main className="min-h-screen bg-[#050609] text-white">
      <PageHead
        title="TradeScout Next Home | Calmer Dashboard Preview"
        description="A calmer next-action-first signed-in home prototype for TradeScout."
        canonicalUrl="/next/home"
      />

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">
              Signed-in home preview
            </div>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              Start with the next move, not the whole platform.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/62">
              This concept turns the signed-in home into a quieter action surface: one clear Scout
              entry, active work in view, and secondary tools pushed back.
            </p>
          </div>
          <Link
            href="/next"
            className="rounded-full px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/6 hover:text-white"
          >
            Back to /next
          </Link>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]">
            <CardHeader>
              <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-ts-orange/20 bg-ts-orange/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ts-orange">
                <Sparkles className="h-3.5 w-3.5" />
                Continue with Scout
              </div>
              <CardTitle className="text-3xl">Keep the primary action unmistakable</CardTitle>
              <CardDescription className="max-w-xl text-white/62">
                For most people, the fastest way forward is still Scout. Home should reinforce that
                instead of competing with every workspace at once.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 text-sm font-medium text-white/55">
                  Pick up where you left off
                </div>
                <Input
                  value="Compare these contractor responses before I contact anyone."
                  readOnly
                  className="h-12 border-0 bg-transparent px-0 text-base text-white shadow-none"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/scout"
                  className={cn(buttonVariants({ size: "lg" }), "justify-center")}
                >
                  Open Scout
                </Link>
                <Link
                  href="/next/browse"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "justify-center"
                  )}
                >
                  Browse categories
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <TimerReset className="mb-3 h-5 w-5 text-ts-orange" />
              <CardTitle className="text-2xl">Today’s rhythm</CardTitle>
              <CardDescription className="text-white/60">
                A short operational summary keeps the home surface useful without becoming noisy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/72">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                2 active requests are waiting on a user decision.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                1 conversation needs a reply before end of day.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                Browse mode is available if you want direct route access instead.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-2xl">Active work</CardTitle>
              <CardDescription className="text-white/60">
                Keep in-flight work visible, but don’t let it take over the entire screen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeWork.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-black/20 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">{item.title}</div>
                      <div className="mt-1 text-sm leading-6 text-white/60">{item.detail}</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/55">
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-5">
            {utilities.map((utility) => {
              const Icon = utility.icon;
              return (
                <Card key={utility.title} className="border-white/10 bg-white/[0.03]">
                  <CardHeader>
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                      <Icon className="h-5 w-5 text-ts-orange" />
                    </div>
                    <CardTitle className="text-xl">{utility.title}</CardTitle>
                    <CardDescription className="text-white/58">{utility.detail}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={utility.href}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/78 transition hover:border-white/16 hover:bg-black/30 hover:text-white"
                    >
                      Open {utility.title}
                      <ArrowRight className="h-4 w-4 text-white/35" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
