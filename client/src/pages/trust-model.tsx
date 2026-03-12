import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { SEOHelmet, createFAQStructuredData } from "@/components/SEOHelmet";
import {
  Shield,
  CheckCircle,
  Users,
  TrendingUp,
  Star,
  Lock,
  AlertCircle,
  ArrowRight,
  Eye,
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

const TrustModelPage = memo(function TrustModelPage() {
  const faqs = [
    {
      question: "What is the Community Verification Score (CVS)?",
      answer:
        "CVS is TradeScout's trust score. It looks at verified identity, license and insurance status, work history, community recommendations, and how problems were handled.",
    },
    {
      question: "How are contractors verified?",
      answer:
        "Pros go through identity, license, insurance, and background checks, then start building trust through real work and real reviews.",
    },
    {
      question: "Why are reviews not anonymous?",
      answer:
        "Because anonymous reviews are easy to fake. TradeScout ties reviews to real, verified people who actually worked with the pro.",
    },
    {
      question: "Can contractors pay to change trust score or ranking?",
      answer: "No. Paying more does not improve trust score or move someone ahead in ranking.",
    },
    {
      question: "What happens if a contractor's license expires?",
      answer:
        "Their trust status drops right away, and they stop receiving new Direct Connect requests until the issue is fixed.",
    },
  ];

  const cvsLayers = [
    {
      icon: Shield,
      title: "1. Verified Identity",
      points: 20,
      bullets: [
        "Real person with government-issued ID",
        "Registered business (LLC, sole proprietor, etc.)",
        "Verified business address (not P.O. box)",
        "Active phone number and email",
      ],
    },
    {
      icon: Lock,
      title: "2. License & Insurance",
      points: 30,
      bullets: [
        "Active state license: Verified against state registry",
        "General liability insurance: Minimum $1M coverage",
        "Workers comp insurance: If applicable (employees)",
        "Expiration monitoring: Auto-alerts 30 days before expiry",
      ],
      note: "If license or insurance lapses, CVS drops to 0 until restored.",
    },
    {
      icon: TrendingUp,
      title: "3. Work History",
      points: 20,
      bullets: [
        "Number of completed jobs on TradeScout",
        "Timeline adherence (on-time completion rate)",
        "Budget adherence (stayed within estimate)",
        "Repeat customers (% of clients who hired again)",
      ],
    },
    {
      icon: Users,
      title: "4. Community Recommendations",
      points: 20,
      bullets: [
        "Neighbor endorsements: From verified community members",
        "Review lineage: Every review tied to a real person who worked with the contractor",
        "No anonymous reviews: Prevents fake testimonials and retaliation",
        "Quality over quantity: Weighted by reviewer trust score",
      ],
    },
    {
      icon: Eye,
      title: "5. Dispute Resolution",
      points: 10,
      bullets: [
        "How conflicts were resolved (mediation, refunds, repairs)",
        "Response time to complaints",
        "Willingness to fix issues vs. ghosting",
        "Unresolved disputes penalize CVS heavily",
      ],
    },
  ];

  return (
    <>
      <SEOHelmet
        title="TradeScout Trust Model | Verified Local Help and Public Trust Rules"
        description="Learn how TradeScout uses verification, Community Verification Score, licensing, insurance, work history, and public trust rules to help users make safer local decisions."
        keywords="tradescout trust model, community verification score, trusted local help, contractor verification, license verification, insurance verification, review lineage"
        canonical="https://www.thetradescout.com/trust-model"
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
              <span className="text-sm font-medium text-ts-orange">
                Community Verification Score
              </span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4"
            >
              Trust, Not Payment
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed"
            >
              Every pro has a Community Verification Score based on identity checks, active
              credentials, work history, community recommendations, and dispute history.
            </motion.p>
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-14">
          {/* Key Principle */}
          <Reveal>
            <div className="bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-ts-orange flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-display text-base font-bold text-white mb-1">
                    Payment Cannot Override Trust
                  </h3>
                  <p className="text-sm text-white/70">
                    Someone with lower trust cannot buy their way above someone with higher trust.
                    Money is not part of the ranking rules.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* CVS Layers */}
          <section>
            <Reveal className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Star className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">CVS Breakdown</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-2">
                Five Verification Layers
              </h2>
              <p className="text-sm text-white/60 max-w-xl mx-auto">
                Each layer adds to a pro's CVS score. The goal is to show why someone is trusted,
                not just that they are.
              </p>
            </Reveal>
            <div className="space-y-4">
              {cvsLayers.map((layer, i) => {
                const Icon = layer.icon;
                return (
                  <Reveal key={i} delay={i * 0.07}>
                    <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
                      <div className="flex gap-3 mb-3">
                        <div className="w-8 h-8 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-ts-orange" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-white text-sm">{layer.title}</h3>
                            <span className="text-xs font-bold text-ts-orange bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2 py-0.5">
                              {layer.points} pts
                            </span>
                          </div>
                        </div>
                      </div>
                      <ul className="space-y-1.5 ml-11">
                        {layer.bullets.map((b, j) => (
                          <li key={j} className="flex gap-2 text-xs text-white/70">
                            <CheckCircle className="w-3.5 h-3.5 text-ts-orange flex-shrink-0 mt-0.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                      {layer.note && (
                        <p className="text-xs text-ts-orange mt-3 ml-11 font-medium">
                          {layer.note}
                        </p>
                      )}
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* Trust-Weighted Visibility */}
          <section>
            <Reveal className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <TrendingUp className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Ranking Logic</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Trust-Weighted Visibility
              </h2>
            </Reveal>
            <Reveal>
              <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] mb-4">
                <h3 className="font-semibold text-white text-sm mb-3">How Matching Works</h3>
                <p className="text-xs text-white/60 mb-3">
                  When Scout lines up options for you, ranking is based on:
                </p>
                <ol className="space-y-1.5">
                  {[
                    "CVS score",
                    "Fit for the job",
                    "Location and service area",
                    "Availability",
                    "Job details like urgency, budget, and complexity",
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2 text-xs text-white/70">
                      <span className="text-ts-orange font-bold flex-shrink-0">{i + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-white/50 mt-3 italic">
                  Subscriptions, promotions, and ad spend do not change ranking.
                </p>
              </div>
            </Reveal>
          </section>

          {/* Why Not Anonymous Reviews */}
          <section>
            <Reveal className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Users className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Review Lineage</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Why Reviews Are Not Anonymous
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "The Problem with Anonymous Reviews",
                  items: [
                    "Fake testimonials from contractors themselves",
                    "Retaliation reviews from competitors",
                    "No accountability for false claims",
                    "Gaming the system with bulk reviews",
                  ],
                  negative: true,
                },
                {
                  title: "TradeScout's Approach",
                  items: [
                    "Every review tied to a verified community member",
                    "Reviewer must have actually worked with the contractor",
                    "Review lineage is publicly auditable",
                    "Weighted by reviewer's own trust score",
                  ],
                  negative: false,
                },
              ].map((col, i) => (
                <Reveal key={i} delay={i * 0.1}>
                  <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
                    <h3 className="font-semibold text-white text-sm mb-3">{col.title}</h3>
                    <ul className="space-y-1.5">
                      {col.items.map((item, j) => (
                        <li key={j} className="flex gap-2 text-xs text-white/70">
                          {col.negative ? (
                            <span className="text-red-400 flex-shrink-0 mt-0.5">✗</span>
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-ts-orange flex-shrink-0 mt-0.5" />
                          )}
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
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

          {/* Internal Links */}
          <Reveal>
            <nav className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-white/60 mb-3">Learn More</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <Link href="/how-it-works">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    How It Works →
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

export default TrustModelPage;
