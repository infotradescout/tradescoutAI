import { memo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Compass, Network, Shield, Sparkles } from "lucide-react";
import { SEOHelmet, createFAQStructuredData } from "@/components/SEOHelmet";
import { Reveal } from "./compareCategoryPage";

const compareLanes = [
  {
    href: "/compare/home-services",
    title: "Home Services",
    subtitle: "Lead generation, directories, and contractor marketplaces",
    examples: "Angi, HomeAdvisor, Thumbtack, Porch, Networx, Houzz",
  },
  {
    href: "/compare/real-estate",
    title: "Real Estate",
    subtitle: "Listing and discovery platforms that stop short of community operating logic",
    examples: "Zillow, Realtor.com, Redfin, Trulia, Homes.com",
  },
  {
    href: "/compare/community",
    title: "Community Platforms",
    subtitle: "Neighborhood feeds and groups without authority-first routing",
    examples: "Nextdoor, Facebook Groups, neighborhood forums, community apps",
  },
  {
    href: "/compare/local-business",
    title: "Local Business Discovery",
    subtitle: "Directory and review surfaces that create awareness but not governed action",
    examples: "Yelp, Google Business Profiles, Yellow Pages, directories",
  },
  {
    href: "/compare/coordination",
    title: "Local Coordination",
    subtitle: "Scheduling and task tools that help transactions but not community trust",
    examples: "Taskrabbit, Craigslist services, gig boards, referral threads",
  },
];

const faqs = [
  {
    question: "What is this compare hub about?",
    answer:
      "This hub explains how TradeScout differs from intermediary platforms across home services, real estate, community, local business discovery, and coordination. TradeScout is the operating system for community interaction, not just a directory or lead source.",
  },
  {
    question: "Why compare TradeScout to Zillow, Realtor.com, or Nextdoor?",
    answer:
      "Because those systems create awareness, browsing, or conversation, but they do not govern the full path from discovery to routed action with trust and local authority at the center.",
  },
  {
    question: "Is TradeScout only for homeowners and contractors?",
    answer:
      "No. That was an early starting point, not the full product boundary. TradeScout serves every level of community interaction, including discovery, trust, local coordination, neighborhood context, and category-specific operating flows.",
  },
  {
    question: "How does TradeScout make money if it is not another intermediary platform?",
    answer:
      "TradeScout does not sell leads and does not charge to connect. It keeps trust, routing, and authority separate from paid visibility so system incentives stay aligned with local outcomes.",
  },
];

const CompareHubPage = memo(function CompareHubPage() {
  return (
    <>
      <SEOHelmet
        title="What Users Can Do on TradeScout | TradeScout vs. Zillow, Nextdoor, Yelp and More"
        description="See how TradeScout helps people ask Scout for help, find trusted local pros and businesses, browse homes, stay connected to community activity, buy and sell locally, and move from discovery to action."
        keywords="what can users do on tradescout, tradescout features, tradescout vs zillow, tradescout vs nextdoor, tradescout vs yelp, local help platform, local operating system"
        canonical="https://www.thetradescout.com/compare"
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
              <Network className="w-4 h-4 text-ts-orange" />
              <span className="text-sm font-medium text-ts-orange">Compare TradeScout</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4"
            >
              TradeScout vs. Intermediary Platforms
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg text-white/70 max-w-3xl mx-auto leading-relaxed"
            >
              TradeScout is the local operating system for community interaction. Most competing
              platforms create awareness, listings, or lead flow. TradeScout governs the path from
              discovery to routed action with trust, authority, and local decision logic intact.
            </motion.p>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
          <Reveal>
            <div className="bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-5 md:p-6">
              <h2 className="font-display text-xl font-extrabold text-white mb-4">
                What Makes TradeScout Different
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <Shield className="w-5 h-5 text-ts-orange mb-2" />
                  <h3 className="text-sm font-semibold text-white mb-2">Authority Before Access</h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Awareness never grants authority. Contact, visibility, and action stay governed.
                  </p>
                </div>
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <Compass className="w-5 h-5 text-ts-orange mb-2" />
                  <h3 className="text-sm font-semibold text-white mb-2">Scout Controls The Flow</h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Scout is the bridge from discovery to action, so users move through one
                    operating layer instead of disconnected tools.
                  </p>
                </div>
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <Sparkles className="w-5 h-5 text-ts-orange mb-2" />
                  <h3 className="text-sm font-semibold text-white mb-2">Trust Is Not For Sale</h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    TradeScout does not sell leads and does not charge to connect. Paid visibility
                    never overrides trust.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Compass className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Compare By Category</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Choose The Lane You Are Replacing
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {compareLanes.map((lane, index) => (
                <Reveal key={lane.href} delay={index * 0.05}>
                  <Link href={lane.href}>
                    <a className="block bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] h-full hover:border-ts-orange/40 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-semibold text-white text-base">{lane.title}</h3>
                          <p className="text-xs text-ts-orange mt-1">{lane.subtitle}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-ts-orange flex-shrink-0 mt-0.5" />
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">{lane.examples}</p>
                    </a>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>

          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Shield className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Exact-Match Pages</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Competitor-Specific Entry Pages Still Exist
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/compare/angi">
                <a className="bg-tsCard border border-white/10 rounded-xl p-5 text-sm text-white hover:border-ts-orange/40 transition-colors">
                  TradeScout vs. Angi
                </a>
              </Link>
              <Link href="/compare/homeadvisor">
                <a className="bg-tsCard border border-white/10 rounded-xl p-5 text-sm text-white hover:border-ts-orange/40 transition-colors">
                  TradeScout vs. HomeAdvisor
                </a>
              </Link>
              <Link href="/compare/lead-generation">
                <a className="bg-tsCard border border-white/10 rounded-xl p-5 text-sm text-white hover:border-ts-orange/40 transition-colors">
                  TradeScout vs. Lead Generation
                </a>
              </Link>
            </div>
          </section>

          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Sparkles className="w-4 h-4 text-ts-orange" />
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
        </div>
      </div>
    </>
  );
});

export default CompareHubPage;
