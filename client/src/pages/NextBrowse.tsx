import {
  ArrowRight,
  Briefcase,
  Building2,
  Compass,
  MessageCircle,
  Search,
  UserSquare2,
} from "lucide-react";
import { Link } from "wouter";
import { PageHead } from "@/components/PageHead";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const browseBuckets = [
  {
    title: "Find Help",
    description: "Start a request, find someone trustworthy, or move a project forward.",
    icon: Search,
    links: [
      { label: "Scout", href: "/scout" },
      { label: "Contractors", href: "/contractors" },
      { label: "Request Quote", href: "/request-quote" },
      { label: "Direct Connect", href: "/direct-connect" },
    ],
  },
  {
    title: "Explore Local",
    description: "Look through county, business, and local surfaces without route sprawl.",
    icon: Compass,
    links: [
      { label: "Business Directory", href: "/business-directory" },
      { label: "County Hub", href: "/county-hub" },
      { label: "Home", href: "/home" },
      { label: "Landing", href: "/landing" },
    ],
  },
  {
    title: "Community",
    description: "Check conversations, groups, and local activity in one place.",
    icon: MessageCircle,
    links: [
      { label: "Community", href: "/community" },
      { label: "Groups", href: "/groups" },
      { label: "Messages", href: "/messages" },
      { label: "Saved", href: "/saved-ads" },
    ],
  },
  {
    title: "My Activity",
    description: "See what needs your attention without opening a dashboard maze.",
    icon: UserSquare2,
    links: [
      { label: "Next Home", href: "/next/home" },
      { label: "Notifications", href: "/notifications" },
      { label: "Profile Settings", href: "/profile-settings" },
      { label: "Dashboard Jobs", href: "/dashboard/jobs" },
    ],
  },
  {
    title: "Business Tools",
    description: "Keep the heavier operator tools in their own lane.",
    icon: Briefcase,
    links: [
      { label: "CRM", href: "/crm" },
      { label: "Analytics", href: "/analytics" },
      { label: "Promotions", href: "/promotions" },
      { label: "Business Dashboard", href: "/business-owner-dashboard" },
    ],
  },
];

export default function NextBrowse() {
  return (
    <main className="min-h-screen bg-[#050609] text-white">
      <PageHead
        title="TradeScout Next Browse | Curated Hub Preview"
        description="A calmer browse-mode preview that compresses route sprawl into curated buckets."
        canonicalUrl="/next/browse"
      />

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">Browse mode</div>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              Explore TradeScout without feeling lost.
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/next"
              className="rounded-full px-3 py-1.5 text-white/70 transition hover:bg-white/6 hover:text-white"
            >
              Next
            </Link>
            <Link
              href="/next/home"
              className="rounded-full px-3 py-1.5 text-white/70 transition hover:bg-white/6 hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/scout"
              className="rounded-full px-3 py-1.5 text-white/70 transition hover:bg-white/6 hover:text-white"
            >
              Scout
            </Link>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-2xl">Browse with more control</CardTitle>
              <CardDescription className="max-w-2xl text-white/62">
                If you already know what you want, this gives you a cleaner way to get there.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {["Find Help", "Explore Local", "Business Tools"].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/72"
                >
                  {label}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(249,115,22,0.12),rgba(255,255,255,0.02))]">
            <CardHeader>
              <Building2 className="mb-3 h-5 w-5 text-ts-orange" />
              <CardTitle className="text-2xl">Need the faster path?</CardTitle>
              <CardDescription className="text-white/62">
                When you do not want to think about routes, jump back into Scout and let it guide
                the next move.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/scout" className={cn(buttonVariants({ size: "lg" }), "justify-between")}>
                Ask Scout instead
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {browseBuckets.map((bucket) => {
            const Icon = bucket.icon;
            return (
              <Card key={bucket.title} className="border-white/10 bg-white/[0.03] backdrop-blur-sm">
                <CardHeader>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/25">
                    <Icon className="h-5 w-5 text-ts-orange" />
                  </div>
                  <CardTitle className="text-xl">{bucket.title}</CardTitle>
                  <CardDescription className="text-white/58">{bucket.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {bucket.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/78 transition hover:border-white/16 hover:bg-black/30 hover:text-white"
                    >
                      <span>{link.label}</span>
                      <ArrowRight className="h-4 w-4 text-white/35" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}
