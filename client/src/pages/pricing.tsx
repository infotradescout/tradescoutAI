import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { AlertTriangle, CheckCircle, PartyPopper, Shield, Sparkles } from "lucide-react";
import { RevenueDisclosureSection } from "@/components/RevenueDisclosureSection";
import { SEOHelmet } from "@/components/SEOHelmet";

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

const freeLines = [
  "Scout and the full classic TradeScout experience",
  "Local businesses, profiles, Community, HomeID, and the Exchange",
  "Direct Connect requests, responses, job progress, and follow-up",
  "Business profiles, proof, products, services, and completed-work outcomes",
];

const offerRules = [
  "The business or TradePartner must be verified",
  "The offer must be relevant to the person, place, or current need",
  "The offer must provide real value and quality—not just pay for attention",
  "Sponsored offers stay labeled and separate from earned trust and organic ranking",
];

const Pricing = memo(function Pricing() {
  return (
    <div className="text-white font-body">
      <SEOHelmet
        title="TradeScout Pricing | Free Forever"
        description="TradeScout is free forever. No sold leads, no paid ranking, and no payment required to connect."
        canonical="https://www.thetradescout.com/pricing"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 space-y-10">
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-xs font-black uppercase tracking-[0.2em] text-white/45"
          >
            Pricing
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl font-black leading-[0.9] tracking-[-0.055em] text-ts-orange mt-7 md:text-7xl"
          >
            Made you look.
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="mt-7 inline-flex items-center gap-2 rounded-full border border-ts-orange/30 bg-ts-orange/10 px-3 py-1"
          >
            <PartyPopper className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-semibold text-ts-orange">TradeScout is free forever</span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.36 }}
            className="text-lg text-white/68 max-w-2xl mx-auto leading-relaxed mt-6"
          >
            Use TradeScout without a subscription, access tier, lead fee, or charge to connect.
            Payment never buys trust, CVS, organic ranking, routing, or someone&apos;s contact
            information.
          </motion.p>
          <motion.a
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.42 }}
            href="#how-tradescout-earns"
            className="mt-5 inline-flex font-bold text-ts-orange no-underline"
          >
            See how we earn revenue here
          </motion.a>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Reveal delay={0.04}>
            <section className="bg-tsCard border border-white/10 rounded-2xl p-6 h-full shadow-[0_18px_52px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-9 h-9 bg-ts-orange/15 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-ts-orange" />
                </div>
                <h2 className="font-display text-xl font-extrabold text-white">What free means</h2>
              </div>
              <ul className="space-y-3">
                {freeLines.map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/72 leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          <Reveal delay={0.08}>
            <section className="bg-gradient-to-br from-ts-orange/14 to-tsCard border border-ts-orange/25 rounded-2xl p-6 h-full shadow-[0_18px_52px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-9 h-9 bg-ts-orange/15 rounded-xl flex items-center justify-center">
                  <Shield className="w-4 h-4 text-ts-orange" />
                </div>
                <h2 className="font-display text-xl font-extrabold text-white">
                  The offer standard
                </h2>
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-4">
                We may show useful offers from verified TradePartners and local businesses. Nobody
                gets to advertise merely because they can pay.
              </p>
              <ul className="space-y-3">
                {offerRules.map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/72 leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        </div>

        <Reveal>
          <RevenueDisclosureSection id="how-tradescout-earns" />
        </Reveal>

        <Reveal>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <h2 className="font-semibold text-red-300 text-sm">Payment Safety Notice</h2>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              It's $0 for access to TradeScout features, connections, and information. TradeScout
              does not charge for access or visibility. Any request for payment in TradeScout's name
              to unlock features, ranking, or access is a scam. Do not pay.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 md:p-8 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-extrabold text-white">
              No free trial. No upgrade trap. Just free.
            </h2>
            <p className="text-white/60 text-sm md:text-base max-w-2xl mx-auto mt-3 leading-relaxed">
              If anyone asks you to pay to unlock TradeScout access, ranking, a request, or contact,
              do not pay them. That is not TradeScout.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
              <a
                href="/scout"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ts-orange px-5 font-bold text-black no-underline"
              >
                Open Scout
              </a>
              <a
                href="/find-local-businesses"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 font-bold text-white no-underline"
              >
                Explore TradeScout
              </a>
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
});

export default Pricing;
