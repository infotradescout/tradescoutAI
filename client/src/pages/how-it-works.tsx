import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { SEOHelmet, createFAQStructuredData } from "@/components/SEOHelmet";
import {
  Shield,
  Search,
  CheckCircle,
  Users,
  TrendingUp,
  MessageSquare,
  Handshake,
  Zap,
  Lock,
  Eye,
  Ban,
  ArrowRight,
} from "lucide-react";

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
      animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const HowItWorksPage = memo(function HowItWorksPage() {
  const faqs = [
    {
      question: "How does TradeScout match me with contractors?",
      answer:
        "Scout analyzes your request context (job type, location, urgency, budget signals) and matches you with contractors based on trust score, verification status, and relevance — not who paid the most. Payment never determines ranking.",
    },
    {
      question: "What is the trust system?",
      answer:
        "Every contractor has a Community Verification Score (CVS) based on verified identity, license/insurance checks, work history, and community recommendations. Trust metrics are public and auditable.",
    },
    {
      question: "How is TradeScout different from Angi or HomeAdvisor?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. Payment never influences ranking, routing, or trust authority.",
    },
    {
      question: "What is Scout?",
      answer:
        "Scout is your AI helper that controls the entire platform. You can ask Scout questions, request contractor matches, get estimates, and navigate features — all from a single conversation. Scout prioritizes outcomes over impressions.",
    },
    {
      question: "How does Direct Connect work?",
      answer:
        "When you request a contractor, Scout evaluates trust, availability, and context, then routes your request directly to 1-3 qualified pros. Contact stays gated until a match accepts.",
    },
  ];

  const steps = [
    {
      icon: MessageSquare,
      title: "Ask Scout",
      desc: "Tell Scout what you need. Scout is your community assistant for local work.",
    },
    {
      icon: Search,
      title: "Scout Matches",
      desc: "Scout uses community trust signals plus trade and location to find 1-3 fits.",
    },
    {
      icon: CheckCircle,
      title: "Pros Accept/Decline",
      desc: "Pros review your request and choose to accept or pass. Contact stays gated until acceptance.",
    },
    {
      icon: Handshake,
      title: "Direct Connection",
      desc: "Pros who accept contact you directly. You choose who to hire.",
    },
  ];

  const mechanisms = [
    {
      icon: Search,
      title: "Trust-Based Matching",
      desc: "Scout analyzes your request context (job type, location, urgency, budget signals) and matches based on trust score, verification, and relevance — not payment.",
      bullets: [
        "Small routing set: Your request goes to 1-3 relevant pros, not dozens",
        "Context-aware: Scout includes job details, urgency, and budget signals",
        "Trust-verified: Only verified contractors can receive requests",
      ],
    },
    {
      icon: Shield,
      title: "Community Verification Score",
      desc: "Every contractor has a CVS (0-100) based on five public, auditable layers.",
      bullets: [
        "Verified identity (real person, real business)",
        "Active license & insurance (state-verified)",
        "Work history (completion rate, timeline, budget adherence)",
        "Community recommendations (neighbor endorsements, not anonymous)",
        "Dispute resolution history",
      ],
    },
    {
      icon: MessageSquare,
      title: "Scout as Controller",
      desc: "Scout is your AI helper that controls the entire platform from a single conversation.",
      bullets: [
        "Ask Scout questions about contractors, projects, or pricing",
        "Request contractor matches directly from chat",
        "Manage Direct Connect requests without navigating menus",
        "Scout prioritizes outcomes over impressions",
      ],
    },
  ];

  const differences = [
    {
      icon: Ban,
      title: "No Pay-to-Play",
      desc: "Contractors can't pay to rank higher. Trust and relevance determine matches.",
    },
    {
      icon: Users,
      title: "Community-Verified",
      desc: "Recommendations come from real neighbors, not anonymous reviews.",
    },
    {
      icon: Zap,
      title: "AI-Controlled",
      desc: "Scout orchestrates everything — you don't need to navigate menus or forms.",
    },
    {
      icon: Lock,
      title: "Free to Use",
      desc: "TradeScout does not sell leads and does not charge to connect. Any payment request claiming to unlock matching, ranking, or visibility is a scam.",
    },
  ];

  return (
    <>
      <SEOHelmet
        title="How It Works - Trust-First Contractor Matching | TradeScout"
        description="TradeScout matches you with verified contractors based on trust and relevance, not payment. Learn how our AI-controlled platform works: matching, verification, Direct Connect, and community trust."
        keywords="how tradescout works, contractor matching, trust verification, direct connect, community verification score, no pay-to-play"
        canonical="https://www.thetradescout.com/how-it-works"
        structuredData={createFAQStructuredData(faqs)}
      />
      <div className="text-white font-body">
        {/* Hero */}
        <section className="relative py-12 md:py-20 bg-transparent overflow-hidden">
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-4"
            >
              <Zap className="w-4 h-4 text-ts-orange" />
              <span className="text-sm font-medium text-ts-orange">How It Works</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4"
            >
              How TradeScout Works
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed"
            >
              Connection without compromise. Trust-verified matching controlled by Scout, your AI
              helper.
            </motion.p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-14">
          {/* 4-Step Process */}
          <section>
            <Reveal className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Zap className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">The Process</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-2">
                Four Steps to a Trusted Match
              </h2>
              <p className="text-sm text-white/60 max-w-xl mx-auto">
                Trust-first matching controlled by Scout. No payment determines ranking.
              </p>
            </Reveal>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <Reveal key={step.title} delay={i * 0.08}>
                    <motion.div
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="bg-tsCard border border-white/10 rounded-xl p-4 hover:border-ts-orange/30 transition-colors shadow-[0_18px_52px_rgba(0,0,0,0.36)]"
                    >
                      <div className="w-8 h-8 bg-ts-orange/20 rounded-lg flex items-center justify-center mb-3">
                        <Icon className="w-4 h-4 text-ts-orange" />
                      </div>
                      <div className="text-xs font-bold text-ts-orange mb-1">Step {i + 1}</div>
                      <h3 className="text-sm font-bold text-white mb-1.5">{step.title}</h3>
                      <p className="text-xs text-white/60 leading-relaxed">{step.desc}</p>
                    </motion.div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* Core Mechanisms */}
          <section>
            <Reveal className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Shield className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Core Mechanism</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Under the Hood
              </h2>
            </Reveal>
            <div className="space-y-4">
              {mechanisms.map((m, i) => {
                const Icon = m.icon;
                return (
                  <Reveal key={i} delay={i * 0.08}>
                    <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
                      <div className="flex gap-3 mb-3">
                        <div className="w-8 h-8 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-ts-orange" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-sm">{m.title}</h3>
                          <p className="text-xs text-white/60 mt-0.5">{m.desc}</p>
                        </div>
                      </div>
                      <ul className="space-y-1.5 ml-11">
                        {m.bullets.map((b, j) => (
                          <li key={j} className="flex gap-2 text-xs text-white/70">
                            <CheckCircle className="w-3.5 h-3.5 text-ts-orange flex-shrink-0 mt-0.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* What Makes TradeScout Different */}
          <section>
            <Reveal className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <TrendingUp className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">The Difference</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                What Makes TradeScout Different
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-4">
              {differences.map((d, i) => {
                const Icon = d.icon;
                return (
                  <Reveal key={i} delay={i * 0.08}>
                    <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] flex gap-3">
                      <div className="w-8 h-8 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-ts-orange" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm mb-1">{d.title}</h3>
                        <p className="text-xs text-white/60 leading-relaxed">{d.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* FAQ */}
          <section>
            <Reveal className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Eye className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">FAQ</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Frequently Asked Questions
              </h2>
            </Reveal>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
                    <h3 className="font-semibold text-white text-sm mb-2">{faq.question}</h3>
                    <p className="text-xs text-white/60 leading-relaxed">{faq.answer}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* CTA */}
          <Reveal>
            <div className="bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-6 text-center">
              <h2 className="font-display text-2xl font-extrabold text-white mb-2">
                Ready to Get Started?
              </h2>
              <p className="text-white/70 text-sm mb-4">
                Ask Scout anything, or browse verified contractors.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href="/scout">
                  <a className="inline-flex items-center gap-2 bg-ts-orange hover:bg-ts-orange-dark text-white font-bold px-5 h-10 rounded-lg shadow-lg shadow-ts-orange/25 transition-all hover:scale-[1.02] text-sm">
                    Talk to Scout
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Link>
                <Link href="/direct-connect">
                  <a className="inline-flex items-center gap-2 border border-white/20 text-white hover:bg-white/10 font-semibold px-5 h-10 rounded-lg transition-all text-sm">
                    Find Contractors
                  </a>
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Internal Links */}
          <Reveal>
            <nav className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-white/60 mb-3">Learn More</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <Link href="/trust-model">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Trust Model →
                  </a>
                </Link>
                <Link href="/compare">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Compare TradeScout →
                  </a>
                </Link>
                <Link href="/compare/angi">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Compare: Angi →
                  </a>
                </Link>
                <Link href="/compare/homeadvisor">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Compare: HomeAdvisor →
                  </a>
                </Link>
              </div>
            </nav>
          </Reveal>
        </div>
      </div>
    </>
  );
});

export default HowItWorksPage;
