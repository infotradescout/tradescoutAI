import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { CheckCircle, PartyPopper, Shield, Sparkles, AlertTriangle } from "lucide-react";

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

const featureLines = [
  "Unlimited contractor search and messaging",
  "Community intel, playbooks, and local checklists",
  "Direct Connect board, quotes, and reminders",
  "Role-specific dashboards for homeowners, pros, and admins",
];

const sponsorLines = [
  "$0 for access to TradeScout features, connections, and information",
  "No contractor lead fees, no monthly subscription fees, and no post-job contractor fees",
  "Revenue comes from separate optional products and connected platforms, never from access",
  "Marketplace Promotions and third-party TradePartners offers are clearly labeled before checkout",
  "Financially blind ranking, recommendation, and trust systems",
  "No paid access tiers and no pay-for-ranking controls",
  "Core platform access remains open for all users",
];

const communityLines = [
  "Community Builder badge holders help decide which local causes the community vault funds",
  "Community Builders run local drives and campaigns to raise funds for their counties",
  "10% of all platform profits are allocated to the TradeScout Community Builders fund",
  "100% of Community Builders contributions are returned directly to the communities where they originated",
  "Transparency-first reporting so neighbors can see exactly where support goes",
];

const Pricing = memo(function Pricing() {
  return (
    <div className="text-white font-body">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {/* Hero */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-4"
          >
            <PartyPopper className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">
              $0 access to TradeScout features, connections, and information.
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4"
          >
            Simple pricing: $0
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed"
          >
            Use everything without a paywall. Search contractors, run community playbooks, manage
            your Direct Connect requests, and chat with Scout — all included. Revenue is generated
            from completed value movement, not from access or ranking.
          </motion.p>
        </div>

        {/* Feature + Sponsor Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <Reveal delay={0.05}>
            <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-ts-orange" />
                </div>
                <span className="font-semibold text-white text-sm">What you get for free</span>
              </div>
              <ul className="space-y-2.5">
                {featureLines.map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/70">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-ts-orange" />
                </div>
                <span className="font-semibold text-white text-sm">How we keep it free</span>
              </div>
              <ul className="space-y-2.5">
                {sponsorLines.map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/70">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        {/* Community Builders */}
        <Reveal>
          <div className="bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-ts-orange" />
              </div>
              <span className="font-semibold text-white text-sm">
                Community Builders &amp; local reinvestment
              </span>
            </div>
            <p className="text-sm text-white/70 mb-4 leading-relaxed">
              Community Builders aren't just organizing projects — they earn a badge that lets them
              send and vote on causes funded from the community vault. Our Community Builders model
              routes resources back to the neighborhoods that generated them.
            </p>
            <ul className="space-y-2.5">
              {communityLines.map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-white/70">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* No credit card CTA */}
        <Reveal>
          <div className="bg-tsCard border border-white/10 rounded-xl p-6 shadow-[0_18px_52px_rgba(0,0,0,0.36)] text-center">
            <h2 className="font-display text-2xl font-extrabold text-white mb-2">
              Start building without a credit card
            </h2>
            <p className="text-white/60 text-sm max-w-xl mx-auto">
              Jump in, invite your team, and explore every feature. No payment is used to alter trust
              authority, ranking, or connection access.
            </p>
          </div>
        </Reveal>

        {/* Payment Safety Notice */}
        <Reveal>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <h2 className="font-semibold text-red-300 text-sm">Payment Safety Notice</h2>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              Access to TradeScout features, connections, and information is{" "}
              <strong className="text-white">$0</strong>. Revenue comes from separate optional
              products and connected platforms. If someone requests payment in TradeScout's name
              outside clearly labeled checkout for Marketplace Promotions or third-party
              TradePartners offers, treat it as a scam and do not pay.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
});

export default Pricing;
