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
      question: "How does TradeScout decide who appears for my request?",
      answer:
        "Scout looks at your location, your request details, and provider reliability. Paid placement does not move someone ahead.",
    },
    {
      question: "What does CVS mean?",
      answer:
        "CVS is a reliability score based on checks people can understand, like identity, licensing, insurance, and service history.",
    },
    {
      question: "Can businesses pay to jump the line?",
      answer:
        "No. TradeScout does not allow pay-to-play ranking or lead selling. Spend never overrides trust rules.",
    },
    {
      question: "What is Scout actually responsible for?",
      answer:
        "Scout shows what to do next, takes you to the right page, and keeps progress moving.",
    },
    {
      question: "What happens in Direct Connect?",
      answer:
        "Direct Connect sends your request to a small set of relevant local providers so replies stay focused.",
    },
  ];

  const steps = [
    {
      icon: MessageSquare,
      title: "Open Scout",
      desc: "Describe what you need help with.",
    },
    {
      icon: Search,
      title: "Scout finds good options",
      desc: "Scout looks for a small set of local pros who fit your job.",
    },
    {
      icon: CheckCircle,
      title: "Pros say yes or no",
      desc: "Pros review your request and decide whether it fits before the conversation moves forward.",
    },
    {
      icon: Handshake,
      title: "You choose who to work with",
      desc: "If someone accepts, you can keep talking and decide who feels right.",
    },
  ];

  const mechanisms = [
    {
      icon: Search,
      title: "Good-fit matching",
      desc: "Scout looks at your job details, location, and timing to find people who actually fit.",
      bullets: [
        "Your request goes to a small set of local pros, not a giant blast list",
        "Job details, timing, and budget help people decide quickly",
        "Quality checks matter more than who pays the most",
      ],
    },
    {
      icon: Shield,
      title: "Community Verification Score",
      desc: "Every pro has a reliability score built from checks people can understand.",
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
      title: "Scout keeps it simple",
      desc: "Scout shows how to move through the platform without bouncing between disconnected pages.",
      bullets: [
        "Ask questions about contractors, projects, or pricing",
        "Start a request directly from chat",
        "Manage requests without digging through menus",
        "Keep the whole process in one place",
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
      desc: "Recommendations come from real neighbors, not anonymous accounts.",
    },
    {
      icon: Zap,
      title: "Less menu hunting",
      desc: "Scout shows guide the process so you spend less time figuring out what to click next.",
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
        title="How TradeScout Works | Open Scout and Find Trusted Local Help"
        description="Learn how TradeScout shows local options, supports clear requests, and moves from discovery to follow-through with trust built in."
        keywords="how tradescout works, open scout, find trusted local help, direct connect, community verification score, local operating system"
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
              Open Scout, review your local options, and move into action without spam or
              pay-to-play rankings.
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
                A simple path from asking for help to choosing who to work with.
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
                What happens behind the scenes
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
                Open Scout a question or start finding local help.
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
                    Local Directory
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
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                <Link href="/find-local-businesses">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Find local businesses →
                  </a>
                </Link>
                <Link href="/for-businesses">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    TradeScout for businesses →
                  </a>
                </Link>
              </div>
              <div className="grid md:grid-cols-1 gap-3 mt-3">
                <Link href="/pensacola">
                  <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                    Pensacola launch hub →
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
