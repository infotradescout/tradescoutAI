import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { SEOHelmet, createFAQStructuredData } from "@/components/SEOHelmet";
import { AlertTriangle, ArrowRight, Check, Eye, Shield, Zap } from "lucide-react";

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

const competitorCards = [
  {
    name: "Angi",
    model: "Lead marketplace",
    pressure: "Often optimized around quote volume and fast distribution.",
  },
  {
    name: "HomeAdvisor",
    model: "Lead resale network",
    pressure: "Contractor economics depend on paid homeowner requests.",
  },
  {
    name: "Thumbtack",
    model: "Pay-to-compete lead flow",
    pressure: "Contractors often compete for attention before trust is clear.",
  },
  {
    name: "Porch",
    model: "Referral and partner lead flow",
    pressure: "Distribution incentives can outweigh local relationship quality.",
  },
  {
    name: "Networx",
    model: "Lead generation marketplace",
    pressure: "Routing often begins with lead delivery, not community trust.",
  },
  {
    name: "Houzz and directory-style platforms",
    model: "Discovery directory",
    pressure: "Browsing and contact can start before intent is qualified.",
  },
];

const tableRows: Array<{
  feature: string;
  leadGen: string;
  tradeScout: string;
  tradeScoutPositive?: boolean;
  leadGenWarning?: boolean;
}> = [
  {
    feature: "Economic Incentive",
    leadGen: "More requests sent often means more monetization",
    tradeScout: "Better routing and trusted matches matter more than volume",
  },
  {
    feature: "Contact Timing",
    leadGen: "Often opens early in the process",
    tradeScout: "Intent-gated until a provider accepts",
    tradeScoutPositive: true,
  },
  {
    feature: "Routing Logic",
    leadGen: "Often broad distribution across available pros",
    tradeScout: "Scout routes to a smaller set of relevant, trust-qualified pros",
    tradeScoutPositive: true,
  },
  {
    feature: "Visibility",
    leadGen: "Can be shaped by paid exposure or marketplace dynamics",
    tradeScout: "CVS and trust signals govern exposure",
    tradeScoutPositive: true,
  },
  {
    feature: "Verification",
    leadGen: "Varies by platform and market",
    tradeScout: "CVS combines identity, licensing, insurance, work history, and community proof",
  },
  {
    feature: "User Cost",
    leadGen: "Consumer experience may look free while contractor costs shape behavior",
    tradeScout: "TradeScout does not sell leads and does not charge to connect",
    tradeScoutPositive: true,
  },
  {
    feature: "Main Risk",
    leadGen: "Speed and volume can outrun fit and accountability",
    tradeScout: "Friction stays where it protects trust and local decision quality",
    leadGenWarning: true,
  },
];

const differences = [
  {
    title: "Category-level alternative",
    desc: "TradeScout is not competing to sell cleaner leads. It replaces the lead-generation incentive with a trust-and-routing incentive.",
  },
  {
    title: "Scout controls the flow",
    desc: "Users can move from discovery to request to decision through Scout instead of bouncing between listings, forms, and callbacks.",
  },
  {
    title: "Trust comes before access",
    desc: "Contact remains gated until there is a real accepted match, which prevents random outreach and protects decision quality.",
  },
  {
    title: "Community memory beats generic volume",
    desc: "TradeScout uses community-anchored trust signals and local proof instead of relying on broad lead circulation.",
  },
];

const faqs = [
  {
    question: "What does TradeScout mean by lead generation?",
    answer:
      "Lead generation means the platform's economics improve when more homeowner requests are distributed, sold, or competed over. TradeScout is designed around routing quality and trust instead of lead volume.",
  },
  {
    question: "Is this page only about HomeAdvisor or Angi?",
    answer:
      "No. This page covers the broader category of lead-generation and directory-style contractor platforms, including brands like Angi, HomeAdvisor, Thumbtack, Porch, Networx, Houzz, and similar marketplaces.",
  },
  {
    question: "Why does TradeScout keep contact gated?",
    answer:
      "TradeScout keeps contact gated until a provider accepts because awareness should not automatically grant access. That keeps communication tied to a real match instead of opening random outreach too early.",
  },
  {
    question: "How does TradeScout decide who gets seen?",
    answer:
      "TradeScout uses Community Verification Score (CVS), local proof, and routing context. Payment cannot override CVS or unlock visibility.",
  },
  {
    question: "Is TradeScout free to use?",
    answer:
      "TradeScout does not sell leads and does not charge to connect. Any unlabeled payment request claiming to unlock access, ranking, or visibility should be treated as a scam.",
  },
  {
    question: "Where should I go if I searched for a specific competitor?",
    answer:
      "Use the competitor pages for exact-match comparisons like TradeScout vs Angi or TradeScout vs HomeAdvisor. This hub explains the broader lead-generation category those platforms sit inside.",
  },
];

const CompareLeadGenerationPage = memo(function CompareLeadGenerationPage() {
  return (
    <>
      <SEOHelmet
        title="TradeScout vs. Lead Generation Platforms | TradeScout"
        description="Compare TradeScout against lead-generation and directory-style contractor platforms. See how trust-first routing differs from lead sales, broad distribution, and early-open contact models."
        keywords="tradescout vs lead generation, lead generation alternative, contractor lead sites alternative, angi alternative, homeadvisor alternative, thumbtack alternative, no lead sales"
        canonical="https://www.thetradescout.com/compare/lead-generation"
        structuredData={createFAQStructuredData(faqs)}
      />
      <div className="text-white font-body">
        <section className="relative py-12 md:py-20 bg-transparent overflow-hidden">
          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-4"
            >
              <Shield className="w-4 h-4 text-ts-orange" />
              <span className="text-sm font-medium text-ts-orange">Home Services Spoke</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4"
            >
              TradeScout vs. Lead Generation
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg text-white/70 max-w-3xl mx-auto leading-relaxed"
            >
              This page is the home-services lead-generation spoke inside the broader TradeScout
              compare system. It explains how TradeScout differs from lead marketplaces and
              contractor directories that optimize for volume before fit.
            </motion.p>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
          <Reveal>
            <div className="bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-5 md:p-6">
              <h2 className="font-display text-xl font-extrabold text-white mb-4">
                Core Difference
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-red-400 mb-2">
                    Lead Generation Platforms
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    The category includes brands like Angi, HomeAdvisor, Thumbtack, Porch, Networx,
                    Houzz, and similar services. The core economic pressure is often to distribute
                    or monetize requests quickly.
                  </p>
                </div>
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-ts-orange mb-2">TradeScout</h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    TradeScout does not sell leads. TradeScout does not charge to connect. Scout
                    routes requests using trust, local context, and intent-gated contact.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Zap className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Competitor Coverage</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Platforms In This Category
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {competitorCards.map((card, index) => (
                <Reveal key={card.name} delay={index * 0.05}>
                  <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] h-full">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-semibold text-white text-sm">{card.name}</h3>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-ts-orange/80 mt-1">
                          {card.model}
                        </p>
                      </div>
                      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">{card.pressure}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Zap className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Model Comparison</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Side-by-Side
              </h2>
            </Reveal>
            <Reveal>
              <div className="bg-tsCard border border-white/10 rounded-xl overflow-hidden shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 font-semibold text-white/60 text-xs">
                          Feature
                        </th>
                        <th className="text-center p-4 font-semibold text-red-400 text-xs">
                          Lead Generation Category
                        </th>
                        <th className="text-center p-4 font-semibold text-ts-orange text-xs">
                          TradeScout
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tableRows.map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? "bg-white/[0.02]" : ""}>
                          <td className="p-4 text-xs font-medium text-white">{row.feature}</td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {row.leadGenWarning && (
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              )}
                              <span className="text-xs text-white/50">{row.leadGen}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {row.tradeScoutPositive && (
                                <Check className="w-4 h-4 text-ts-orange" />
                              )}
                              <span className="text-xs text-white/70">{row.tradeScout}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          </section>

          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Shield className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Why It Matters</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                What TradeScout Changes
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-4">
              {differences.map((item, index) => (
                <Reveal key={item.title} delay={index * 0.08}>
                  <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] h-full">
                    <div className="flex gap-2 mb-2">
                      <Check className="w-4 h-4 text-ts-orange flex-shrink-0 mt-0.5" />
                      <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed ml-6">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Eye className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">FAQ</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Frequently Asked Questions
              </h2>
            </Reveal>
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <Reveal key={faq.question} delay={index * 0.05}>
                  <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
                    <h3 className="font-semibold text-white text-sm mb-2">{faq.question}</h3>
                    <p className="text-xs text-white/60 leading-relaxed">{faq.answer}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <Reveal>
            <div className="bg-tsCard border border-white/10 rounded-xl p-6 shadow-[0_18px_52px_rgba(0,0,0,0.36)] text-center">
              <h2 className="font-display text-2xl font-extrabold text-white mb-2">
                Try The Alternative
              </h2>
              <p className="text-white/60 text-sm mb-4">
                Move from lead-generation browsing to Scout-guided, trust-first routing.
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

          <Reveal>
            <nav className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-white/60 mb-3">Compare More</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <Link href="/compare">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Compare Hub →
                  </a>
                </Link>
                <Link href="/compare/home-services">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Home Services →
                  </a>
                </Link>
                <Link href="/compare/real-estate">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Real Estate →
                  </a>
                </Link>
                <Link href="/compare/angi">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Compare: Angi →
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

export default CompareLeadGenerationPage;
