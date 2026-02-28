import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { SEOHelmet, createFAQStructuredData } from "@/components/SEOHelmet";
import { Check, X, AlertTriangle, Shield, ArrowRight, Eye, Zap } from "lucide-react";

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

const CompareHomeAdvisorPage = memo(function CompareHomeAdvisorPage() {
  const faqs = [
    {
      question: "What is the main difference between TradeScout and HomeAdvisor?",
      answer:
        "HomeAdvisor uses a lead-sales model where contractors pay per request. TradeScout uses trust-based matching with no lead sales and no pay-to-play visibility. This changes incentives: lead volume vs. match quality.",
    },
    {
      question: "Why do I get bombarded with calls on HomeAdvisor?",
      answer:
        "When you request a quote, platforms can route your request to many contractors. Each wants to reach you before competitors. TradeScout sends your request to 1-3 pre-matched contractors only.",
    },
    {
      question: "Why do HomeAdvisor quotes often come in low then balloon?",
      answer:
        "TradeScout is not a bidding marketplace. Scout matches on trust and relevance first, then pros accept or decline. You choose who to hire based on fit, availability, and scope.",
    },
    {
      question: "How does HomeAdvisor verify contractors?",
      answer:
        "HomeAdvisor uses reviews and ratings, which can be gamed. TradeScout uses Community Verification Score (CVS): verified identity, license/insurance, work history, and community recommendations. CVS is public, auditable, and payment cannot override it.",
    },
    {
      question: "What is different about Scout?",
      answer:
        "Scout is TradeScout's AI helper that controls the platform. You ask Scout questions, request matches, and manage projects from one conversation. Scout prioritizes outcomes over impressions. HomeAdvisor requires navigating forms and browsing listings.",
    },
    {
      question: "Is TradeScout really $0 to use?",
      answer:
        "Core access is $0 for features, connections, and information. TradeScout does not sell leads and does not charge to connect. Optional paid services (if offered) are clearly labeled before checkout and never affect CVS, ranking, or matching. Any request for payment claiming to unlock access or visibility is a scam.",
    },
  ];

  const tableRows = [
    {
      feature: "Business Model",
      ha: "Lead sales (pay-per-request)",
      ts: "Trust-based matching (no lead sales)",
    },
    { feature: "Contractor Cost", ha: "$15–$60 per lead (win or lose)", ts: "$0 platform fees" },
    {
      feature: "Lead Routing",
      ha: "1 request → 10-20+ contractors",
      ts: "1 request → 1-3 pre-matched contractors",
    },
    {
      feature: "User Experience",
      ha: "Bombarded with calls",
      ts: "1-3 qualified matches",
      haNeg: true,
      tsPos: true,
    },
    {
      feature: "Ranking Logic",
      ha: "Payment influences visibility",
      ts: "Trust (CVS) determines ranking",
      haWarn: true,
      tsPos: true,
    },
    {
      feature: "Trust Verification",
      ha: "Reviews (can be gamed)",
      ts: "CVS: license + insurance + work history + community",
    },
    {
      feature: "Incentive",
      ha: "Match volume over quality",
      ts: "Match quality over volume",
      haNeg: true,
      tsPos: true,
    },
    { feature: "Access Cost", ha: "Free for homeowners", ts: "Free for homeowners" },
  ];

  const changes = [
    {
      title: "No More Lead Spam",
      desc: "Your request goes to 1-3 pre-matched contractors, not 20+. You choose who to hire, not who reached you first.",
    },
    {
      title: "No More Bidding Wars",
      desc: "Contractors are matched on trust + relevance, not who bid lowest. No desperation pricing, no cutting corners.",
    },
    {
      title: "Trust Determines Visibility",
      desc: "High CVS contractors rank higher, regardless of ad spend. Low-trust contractors cannot pay to appear first.",
    },
    {
      title: "Community-Verified Reviews",
      desc: "Reviews come from verified neighbors who actually worked with the contractor. No anonymous fake testimonials.",
    },
  ];

  return (
    <>
      <SEOHelmet
        title="TradeScout vs. HomeAdvisor – Trust vs. Lead Sales | TradeScout"
        description="Compare TradeScout and HomeAdvisor. Learn how business models, incentives, and trust verification differ. Why TradeScout matches on trust, not payment."
        keywords="tradescout vs homeadvisor, homeadvisor alternative, no lead spam, trust-verified contractors, no pay-per-lead, no bidding wars"
        canonical="https://www.thetradescout.com/compare/homeadvisor"
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
              <Shield className="w-4 h-4 text-ts-orange" />
              <span className="text-sm font-medium text-ts-orange">Comparison</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4"
            >
              TradeScout vs. HomeAdvisor
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed"
            >
              How business models and incentives shape your contractor search experience.
            </motion.p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
          {/* Core Difference */}
          <Reveal>
            <div className="bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-5 md:p-6">
              <h2 className="font-display text-xl font-extrabold text-white mb-4">
                Core Difference
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-red-400 mb-2">
                    HomeAdvisor (Lead Sales Model)
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Contractors pay for every homeowner request. More leads sold = more revenue.
                    Incentive: maximize lead volume, not match quality.
                  </p>
                </div>
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-ts-orange mb-2">
                    TradeScout (Trust Model)
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    $0 platform access. No lead sales. No pay-to-play visibility. Incentive: match
                    quality over volume.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Feature Comparison Table */}
          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Zap className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Feature Comparison</span>
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
                          HomeAdvisor
                        </th>
                        <th className="text-center p-4 font-semibold text-ts-orange text-xs">
                          TradeScout
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tableRows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white/[0.02]" : ""}>
                          <td className="p-4 text-xs font-medium text-white">{row.feature}</td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {row.haNeg && <X className="w-4 h-4 text-red-400" />}
                              {row.haWarn && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                              <span className="text-xs text-white/50">{row.ha}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {row.tsPos && <Check className="w-4 h-4 text-ts-orange" />}
                              <span className="text-xs text-white/70">{row.ts}</span>
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

          {/* What TradeScout Changes */}
          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Shield className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">The Difference</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                What TradeScout Changes
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-4">
              {changes.map((c, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
                    <div className="flex gap-2 mb-2">
                      <Check className="w-4 h-4 text-ts-orange flex-shrink-0 mt-0.5" />
                      <h3 className="font-semibold text-white text-sm">{c.title}</h3>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed ml-6">{c.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* FAQ */}
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
            <div className="bg-tsCard border border-white/10 rounded-xl p-6 shadow-[0_18px_52px_rgba(0,0,0,0.36)] text-center">
              <h2 className="font-display text-2xl font-extrabold text-white mb-2">
                Try TradeScout
              </h2>
              <p className="text-white/60 text-sm mb-4">
                Experience trust-first matching. No lead spam. No bidding wars.
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
              <div className="grid md:grid-cols-3 gap-3">
                <Link href="/how-it-works">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    How TradeScout Works →
                  </a>
                </Link>
                <Link href="/trust-model">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Trust Model →
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

export default CompareHomeAdvisorPage;
