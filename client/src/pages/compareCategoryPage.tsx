import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { SEOHelmet, createFAQStructuredData } from "@/components/SEOHelmet";
import { AlertTriangle, ArrowRight, Check, Eye, Shield, Zap } from "lucide-react";

export function Reveal({
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

type FAQItem = {
  question: string;
  answer: string;
};

type PlatformCard = {
  name: string;
  model: string;
  pressure: string;
};

type ComparisonRow = {
  feature: string;
  category: string;
  tradeScout: string;
  tradeScoutPositive?: boolean;
  categoryWarning?: boolean;
};

type DifferenceCard = {
  title: string;
  desc: string;
};

type MoreLink = {
  href: string;
  label: string;
};

export type CompareCategoryConfig = {
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonical: string;
  badgeLabel: string;
  categoryName: string;
  categorySummary: string;
  tradeScoutSummary: string;
  platforms: PlatformCard[];
  tableRows: ComparisonRow[];
  differences: DifferenceCard[];
  faqs: FAQItem[];
  ctaTitle: string;
  ctaDescription: string;
  moreLinks: MoreLink[];
};

export const CompareCategoryPage = memo(function CompareCategoryPage({
  config,
}: {
  config: CompareCategoryConfig;
}) {
  return (
    <>
      <SEOHelmet
        title={config.seoTitle}
        description={config.seoDescription}
        keywords={config.seoKeywords}
        canonical={config.canonical}
        structuredData={createFAQStructuredData(config.faqs)}
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
              <span className="text-sm font-medium text-ts-orange">{config.badgeLabel}</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4"
            >
              {config.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg text-white/70 max-w-3xl mx-auto leading-relaxed"
            >
              {config.description}
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
                  <h3 className="text-sm font-semibold text-red-400 mb-2">{config.categoryName}</h3>
                  <p className="text-xs text-white/60 leading-relaxed">{config.categorySummary}</p>
                </div>
                <div className="bg-tsCard border border-white/10 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-ts-orange mb-2">TradeScout</h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    {config.tradeScoutSummary}
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          <section>
            <Reveal className="text-center mb-5">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Zap className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Platform Coverage</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Platforms In This Category
              </h2>
            </Reveal>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {config.platforms.map((card, index) => (
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
                  <table className="w-full table-fixed text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="p-3 text-left text-xs font-semibold text-white/60 sm:p-4">
                          Feature
                        </th>
                        <th className="p-3 text-center text-xs font-semibold text-red-400 sm:p-4">
                          {config.categoryName}
                        </th>
                        <th className="p-3 text-center text-xs font-semibold text-ts-orange sm:p-4">
                          TradeScout
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {config.tableRows.map((row, index) => (
                        <tr key={index} className={index % 2 === 0 ? "bg-white/[0.02]" : ""}>
                          <td className="break-words p-3 text-xs font-medium text-white sm:p-4">
                            {row.feature}
                          </td>
                          <td className="p-3 text-center sm:p-4">
                            <div className="flex flex-col items-center gap-1">
                              {row.categoryWarning && (
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              )}
                              <span className="break-words text-xs text-white/50">
                                {row.category}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center sm:p-4">
                            <div className="flex flex-col items-center gap-1">
                              {row.tradeScoutPositive && (
                                <Check className="w-4 h-4 text-ts-orange" />
                              )}
                              <span className="break-words text-xs text-white/70">
                                {row.tradeScout}
                              </span>
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
              {config.differences.map((item, index) => (
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
              {config.faqs.map((faq, index) => (
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
                {config.ctaTitle}
              </h2>
              <p className="text-white/60 text-sm mb-4">{config.ctaDescription}</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href="/scout">
                  <a className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ts-orange px-5 text-sm font-bold text-white shadow-lg shadow-ts-orange/25 transition-all hover:scale-[1.02] hover:bg-ts-orange-dark sm:w-auto">
                    Search with Scout
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Link>
                <Link href="/direct-connect">
                  <a className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-5 text-sm font-semibold text-white transition-all hover:bg-white/10 sm:w-auto">
                    Explore TradeScout
                  </a>
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <nav className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-white/60 mb-3">Compare More</h3>
              <div className="grid md:grid-cols-4 gap-3">
                {config.moreLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <a className="text-ts-orange hover:text-ts-orange-light text-sm transition-colors">
                      {link.label}
                    </a>
                  </Link>
                ))}
              </div>
            </nav>
          </Reveal>
        </div>
      </div>
    </>
  );
});
