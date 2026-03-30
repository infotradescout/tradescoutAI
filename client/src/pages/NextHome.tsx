import {
  ArrowRight,
  Bell,
  Compass,
  Loader2,
  MessageSquare,
  Sparkles,
  TimerReset,
} from "lucide-react";
import { Link } from "wouter";
import { PageHead } from "@/components/PageHead";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
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

export default function NextHome() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { unreadCount } = useNotifications();
  const firstName = user?.firstName || user?.username || user?.email?.split("@")[0] || "there";
  const isBusinessUser = Boolean(
    user?.role === "contractor_user" ||
    user?.role === "accelerator_member" ||
    user?.role === "realtor" ||
    user?.role === "insurance_agent" ||
    user?.role === "mortgage_broker" ||
    user?.role === "property_manager" ||
    user?.role === "car_salesman"
  );
  const rhythmItems = isAuthenticated
    ? [
        "You have open work that can move forward with one more step.",
        unreadCount > 0
          ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} waiting.`
          : "Your inbox is quiet right now.",
        "Explore is still here when you want to look around on your own.",
      ]
    : [
        "Sign in to see your saved progress and messages.",
        "Scout is still the fastest way to get started.",
        "Explore is here if you want to look around first.",
      ];
  const utilities = [
    {
      title: "Messages",
      detail: isAuthenticated
        ? "See recent replies and keep active conversations together."
        : "Sign in to see replies and keep conversations moving.",
      href: "/messages",
      icon: MessageSquare,
    },
    {
      title: "Explore",
      detail: "Move through the calmer browse hub when you want more control.",
      href: "/next/browse",
      icon: Compass,
    },
    {
      title: unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications",
      detail: isAuthenticated
        ? "Check alerts and anything that needs attention."
        : "Sign in to see alerts and recent activity.",
      href: "/notifications",
      icon: Bell,
    },
  ];

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#050609] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 text-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-ts-orange" />
            Loading your home...
          </div>
        </div>
      </main>
    );
  }

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
              A calmer home
            </div>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              {isAuthenticated
                ? `Welcome back, ${firstName}.`
                : "Come back in without the clutter."}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/62">
              {isAuthenticated
                ? "Start where you left off, move the important work first, and keep the rest of the platform out of your way."
                : "This home is built to feel lighter: one clear way to start, a calmer browse path, and less dashboard noise."}
            </p>
          </div>
          <Link
            href="/next"
            className="rounded-full px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/6 hover:text-white"
          >
            Back to /next
          </Link>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/50">
            {isAuthenticated ? "Focused home" : "Lighter entry"}
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/50">
            {isAuthenticated ? "Action first" : "Scout first"}
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/50">
            Less dashboard noise
          </div>
        </div>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
            <div className="absolute right-[-4rem] top-[-3rem] h-40 w-40 rounded-full bg-ts-orange/10 blur-3xl" />
            <div className="relative">
              <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-ts-orange/20 bg-ts-orange/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ts-orange">
                <Sparkles className="h-3.5 w-3.5" />
                {isAuthenticated ? "Pick up where you left off" : "Start with Scout"}
              </div>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white">
                {isAuthenticated
                  ? "The next step should be easy to find"
                  : "The first step should be obvious"}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-white/62">
                {isAuthenticated
                  ? "Scout is still the quickest way to move active work forward without bouncing between sections."
                  : "If you are not sure where to begin, Scout gives you the clearest way into the product."}
              </p>
              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
                <div className="mb-3 text-sm font-medium text-white/55">
                  {isAuthenticated ? "Pick up where you left off" : "Start here"}
                </div>
                <Input
                  value={
                    isAuthenticated
                      ? "Compare these contractor responses before I contact anyone."
                      : "What do you need help with today?"
                  }
                  readOnly
                  className="h-12 border-0 bg-transparent px-0 text-base text-white shadow-none"
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/scout"
                  className={cn(buttonVariants({ size: "lg" }), "justify-center rounded-2xl px-6")}
                >
                  {isAuthenticated ? "Continue with Scout" : "Ask Scout"}
                </Link>
                <Link
                  href="/next/browse"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "justify-center rounded-2xl px-6"
                  )}
                >
                  Explore on your own
                </Link>
              </div>
            </div>
          </div>

          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <TimerReset className="mb-3 h-5 w-5 text-ts-orange" />
              <CardTitle className="text-2xl">What needs your attention</CardTitle>
              <CardDescription className="text-white/60">
                A short read on what matters now keeps home useful without making it noisy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/72">
              {rhythmItems.map((item, index) => (
                <div
                  key={item}
                  className={cn(
                    "rounded-2xl border px-4 py-3",
                    index === 0
                      ? "border-ts-orange/20 bg-ts-orange/8 text-white"
                      : "border-white/10 bg-black/20"
                  )}
                >
                  <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
                    {index === 0 ? "Now" : index === 1 ? "Watch" : "Optional"}
                  </div>
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]">
            <CardHeader>
              <CardTitle className="text-2xl">
                {isAuthenticated ? "Keep moving" : "What this home could hold"}
              </CardTitle>
              <CardDescription className="text-white/60">
                {isAuthenticated
                  ? "Keep in-flight work visible, but do not let it take over the whole screen."
                  : "Once you sign in, this space can hold your active work without turning into a crowded dashboard."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeWork.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-black/20 px-4 py-4 transition hover:-translate-y-0.5 hover:border-white/16"
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
                <Card
                  key={utility.title}
                  className="group border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] transition hover:-translate-y-0.5 hover:border-white/16"
                >
                  <CardHeader>
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                      <Icon className="h-5 w-5 text-ts-orange transition group-hover:scale-105" />
                    </div>
                    <CardTitle className="text-xl">{utility.title}</CardTitle>
                    <CardDescription className="text-white/58">{utility.detail}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={utility.href}
                      className="group/link flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3.5 text-sm text-white/78 transition hover:border-white/16 hover:bg-black/30 hover:text-white"
                    >
                      Go to {utility.title}
                      <ArrowRight className="h-4 w-4 text-white/35 transition group-hover/link:translate-x-0.5 group-hover/link:text-ts-orange" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
            {isBusinessUser ? (
              <Card className="group border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] transition hover:-translate-y-0.5 hover:border-white/16">
                <CardHeader>
                  <CardTitle className="text-xl">Business tools</CardTitle>
                  <CardDescription className="text-white/58">
                    Keep the heavier operator tools close, but out of the main flow.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link
                    href="/business-owner-dashboard"
                    className="group/link flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/78 transition hover:border-white/16 hover:bg-black/30 hover:text-white"
                  >
                    Open business workspace
                    <ArrowRight className="h-4 w-4 text-white/35 transition group-hover/link:translate-x-0.5 group-hover/link:text-ts-orange" />
                  </Link>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
