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

const CompareAngiPage = memo(function CompareAngiPage() {
  const faqs = [
    {
      question: "What is the main difference between TradeScout and Angi?",
      answer:
        "TradeScout does not sell leads. Scout routes requests using trust and context, and contact stays gated until a match accepts.",
    },
    {
      question: "Why does TradeScout keep contact gated?",
      answer:
        "Contact stays locked until a provider accepts your request. This keeps communication tied to a real match and prevents random outreach.",
    },
    {
      question: "Is TradeScout a bidding marketplace?",
      answer:
        "TradeScout is not a bidding marketplace. Scout matches on trust and relevance first, then pros accept or decline. You choose who to hire based on fit, availability, and scope.",
    },
    {
      question: "What is the Community Verification Score (CVS)?",
      answer:
        "CVS is a composite trust metric based on verified identity, license/insurance, work history, and community signals. Payment cannot override it.",
    },
    {
      question: "Is TradeScout really free?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. Payment never affects CVS, ranking, or matching.",
    },
  ];

  const tableRows: Array<{
    feature: string;
    angi: string;
    ts: string;
    angiNeg?: boolean;
    angiWarn?: boolean;
    tsPos?: boolean;
  }> = [
    {
      feature: "Business Model",
      angi: "Varies by platform",
      ts: "Trust-based matching (no lead sales)",
    },
    {
      feature: "Request Routing",
      angi: "Often broad distribution",
      ts: "Small set of pre-matched contractors",
    },
    {
      feature: "Contact",
      angi: "Often opens immediately",
      ts: "Intent-gated until acceptance",
      tsPos: true,
    },
    {
      feature: "Exposure Logic",
      angi: "Varies by platform",
      ts: "Trust (CVS) determines exposure",
      tsPos: true,
    },
    {
      feature: "Trust Verification",
      angi: "Varies by platform",
      ts: "CVS: license + insurance + work history + community",
    },
    { feature: "Access", angi: "Varies by platform", ts: "No charge to connect" },
  ];

  const changes = [
    {
      title: "Smaller Routing Set",
      desc: "Your request is routed to a small set of relevant, trust-verified contractors.",
    },
    {
      title: "Not A Bidding Marketplace",
      desc: "Scout matches on trust and relevance first. Pros accept or decline before contact opens.",
    },
    {
      title: "Trust Determines Visibility",
      desc: "Trust signals determine exposure. Payment cannot override CVS.",
    },
    {
      title: "Community-Verified Reviews",
      desc: "Reviews come from verified neighbors who actually worked with the contractor.",
    },
  ];

  return (
    <>
      <SEOHelmet
        title="TradeScout vs. Angi - Trust-First Matching | TradeScout"
        description="Compare approaches to contractor matching. TradeScout routes requests using trust and context, with intent-gated contact and no lead sales."
        keywords="tradescout vs angi, angi alternative, trust-first matching, intent-gated contact, no lead sales"
        canonical="https://www.thetradescout.com/compare/angi"
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
              TradeScout vs. Angi
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
                    Angi (Lead Sales Model)
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
                    No lead sales. No pay-to-play visibility. Incentive: match quality over volume.
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
                        <th className="text-center p-4 font-semibold text-red-400 text-xs">Angi</th>
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
                              {row.angiNeg && <X className="w-4 h-4 text-red-400" />}
                              {row.angiWarn && (
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              )}
                              <span className="text-xs text-white/50">{row.angi}</span>
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
                Experience trust-first matching with intent-gated contact.
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

export default CompareAngiPage;
