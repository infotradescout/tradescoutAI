import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Handshake,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SEOHelmet,
  createWebsiteStructuredData,
  createOrganizationStructuredData,
} from "@/components/SEOHelmet";

const sections = [
  {
    title: "Trust-First Matching",
    body: "Contractor visibility is earned through trust and verified activity, not ad spend.",
    icon: ShieldCheck,
  },
  {
    title: "1-3 Relevant Connections",
    body: "Every request routes through Scout and narrows to high-fit local options instead of open lead spam.",
    icon: Search,
  },
  {
    title: "Decision Before Contact",
    body: "Intent, context, and confidence are structured before contact unlocks.",
    icon: Handshake,
  },
];

const flow = [
  { step: "1", title: "Tell Scout What You Need", icon: MessageSquare },
  { step: "2", title: "Get County-Aware Paths", icon: MapPin },
  { step: "3", title: "Choose With Trust Signals", icon: BadgeCheck },
  { step: "4", title: "Connect Without Noise", icon: Users },
];

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen text-tsTextMain bg-transparent">
      <SEOHelmet
        title="TradeScout | Connection Without Compromise"
        description="Trust-first local matching for homeowners and contractors. No lead spam, no pay-to-play."
        canonical="https://www.thetradescout.com/landing"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [createWebsiteStructuredData(), createOrganizationStructuredData()],
        }}
      />

      <header className="sticky top-0 z-30 border-b border-white/10 backdrop-blur-sm bg-[color:var(--surface-base)]/80">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-3">
            <img
              src="/tradescout-logo-circle.png"
              alt="TradeScout"
              className="h-9 w-9 rounded-md"
            />
            <div className="leading-tight">
              <p className="text-xs tracking-[0.2em] text-tsTextMuted">TRADESCOUT</p>
              <p className="text-xs text-tsTextMuted">Connection without compromise</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/pre-scout-setup?mode=signin">
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/pre-scout-setup?mode=create">
              <Button size="sm" className="bg-tsAccent text-black hover:bg-tsAccent/90">
                Create free account
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pt-16 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 rounded-full border border-tsAccent/40 bg-tsAccent/10 px-4 py-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-tsAccent" />
            <span className="text-tsAccent">Scout-first local operating system</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mt-6 text-4xl md:text-6xl font-black leading-[0.98] tracking-tight"
          >
            Local trust, <span className="text-tsAccent">without compromise</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="mt-5 max-w-2xl text-base md:text-lg text-tsTextMuted"
          >
            TradeScout is built around intent, trust signals, and county reality. You get clear
            paths, structured decisions, and fewer dead-end interactions.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.24 }}
            className="mt-8 flex flex-col sm:flex-row gap-3"
          >
            <Button
              className="h-12 px-6 bg-tsAccent text-black hover:bg-tsAccent/90 font-semibold"
              onClick={() => navigate("/pre-scout-setup?mode=create")}
            >
              Start with Scout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-12 px-6"
              onClick={() => navigate("/contractors")}
            >
              Explore contractors
            </Button>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-6 grid md:grid-cols-3 gap-4">
          {sections.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
              >
                <Card className="border-tsBorder bg-tsCard/70 h-full">
                  <CardContent className="p-5">
                    <Icon className="h-5 w-5 text-tsAccent mb-3" />
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-sm text-tsTextMuted leading-relaxed">{item.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14">
          <div className="rounded-2xl border border-tsBorder bg-tsCard/70 overflow-hidden">
            <div className="px-6 py-5 border-b border-tsBorder">
              <h2 className="text-2xl md:text-3xl font-bold">How it flows</h2>
              <p className="mt-2 text-tsTextMuted">
                Structured request {"\u2192"} structured path {"\u2192"} confident action.
              </p>
            </div>
            <div className="grid md:grid-cols-4">
              {flow.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="p-6 border-t md:border-t-0 md:border-l first:md:border-l-0 border-tsBorder"
                  >
                    <p className="text-xs text-tsTextMuted">STEP {item.step}</p>
                    <Icon className="h-5 w-5 text-tsAccent mt-2" />
                    <p className="mt-3 text-sm font-medium">{item.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20">
          <div className="rounded-2xl border border-tsBorder bg-[linear-gradient(135deg,rgba(249,115,22,0.14),rgba(2,6,23,0.7))] p-7 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-2xl">
                <h3 className="text-2xl md:text-3xl font-bold">No pay-to-play routing</h3>
                <p className="mt-2 text-tsTextMuted">
                  Payment cannot override trust tiers. Visibility and connection quality are
                  governed by verified local signals.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs text-tsTextMuted">
                  <Ban className="h-3.5 w-3.5 text-tsAccent" />
                  <span>Direct lead spam path is intentionally blocked</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/pre-scout-setup?mode=create">
                  <Button className="bg-tsAccent text-black hover:bg-tsAccent/90">
                    Create account
                  </Button>
                </Link>
                <Link href="/how-tradescout-works">
                  <Button variant="outline">How TradeScout works</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
