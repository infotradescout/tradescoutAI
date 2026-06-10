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
    subtitle: "Listing and home-search sites",
    examples: "Zillow, Realtor.com, Redfin, Trulia, Homes.com",
  },
  {
    href: "/compare/community",
    title: "Community Platforms",
    subtitle: "Neighborhood feeds, groups, and community apps",
    examples: "Nextdoor, Facebook Groups, neighborhood forums, community apps",
  },
  {
    href: "/compare/local-business",
    title: "Local Business Discovery",
    subtitle: "Directory and review sites",
    examples: "Yelp, Google Business Profiles, Yellow Pages, directories",
  },
  {
    href: "/compare/coordination",
    title: "Local Coordination",
    subtitle: "Task boards, scheduling tools, and fast-response marketplaces",
    examples: "Taskrabbit, Craigslist services, gig boards, referral threads",
  },
];

const faqs = [
  {
    question: "What is this compare hub about?",
    answer:
      "This hub shows how TradeScout compares with sites people already use for local help, home search, community activity, local business discovery, and fast coordination.",
  },
  {
    question: "Why compare TradeScout to Zillow, Realtor.com, or Nextdoor?",
    answer:
      "Because those products are often part of the local journey. They help people browse, search, or talk, but they usually stop before the decision and follow-through stage.",
  },
  {
    question: "Is TradeScout only for homeowners and contractors?",
    answer:
      "No. That was an early starting point, not the full product. TradeScout covers discovery, CVS, local coordination, neighborhood context, and the next steps that follow.",
  },
  {
    question: "How does TradeScout make money if it is not another intermediary platform?",
    answer:
      "TradeScout does not sell leads and does not charge people to connect. The goal is to keep trust and decision quality separate from pay-to-play visibility.",
  },
];

const CompareHubPage = memo(function CompareHubPage() {
  return (
    <>
      <SEOHelmet
        title="What Users Can Do on TradeScout | TradeScout vs. Zillow, Nextdoor, Yelp and More"
        description="See how TradeScout uses Scout local search and summaries to compare options, find trusted local pros and businesses, browse homes, stay connected to community activity, buy and sell locally, and move from discovery to action."
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
              Most local platforms help you browse, search, or post. TradeScout is built to help you
              keep going from discovery to a real local decision without getting pushed into lead
              spam, random outreach, or disconnected tools.
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
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Real fit before random outreach
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Seeing someone does not automatically open the door to spammy contact or a flood
                    of bad-fit replies.
                  </p>
                </div>
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <Compass className="w-5 h-5 text-ts-orange mb-2" />
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Scout helps you move forward
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    You can ask questions, find help, compare options, and take the next step in one
                    place.
                  </p>
                </div>
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <Sparkles className="w-5 h-5 text-ts-orange mb-2" />
                  <h3 className="text-sm font-semibold text-white mb-2">Trust is not for sale</h3>
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
