/**
 * TradeScout Landing Page - "Forged Trust" Design
 *
 * Design: Bold craft-forward with diagonal sections, high-contrast orange/navy,
 * oversized typography (Sora display + Work Sans body), forge stamp badges.
 *
 * KEY TRUTHS:
 * - No lead reselling; fair visibility rules
 * - Quality-first matching built on verified local trust signals
 * - Usually 1-3 strong matches per request, with contact shared when you are ready
 * - Community-owned reinvestment model
 * - Money never jumps the line
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import {
  Shield,
  ShieldCheck,
  Search,
  MessageSquare,
  Users,
  CheckCircle,
  ArrowRight,
  Zap,
  Lock,
  Eye,
  TrendingUp,
  Award,
  ChevronDown,
  X,
  Menu,
  Sparkles,
  FileCheck,
  UserCheck,
  Handshake,
  Ban,
  DollarSign,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RevenueDisclosureSection } from "@/components/RevenueDisclosureSection";
import { SEOHelmet } from "@/components/SEOHelmet";
import { FirstUseGuidanceCard } from "@/components/guidance/FirstUseGuidanceCard";
import { FirstUsefulStepLauncher } from "@/components/guidance/FirstUsefulStepLauncher";
import {
  DIRECT_CONNECT_GUIDANCE_TEXT,
  HOMEID_GUIDANCE_TEXT,
  SCOUT_GUIDANCE_TEXT,
  TRADE_SCOUT_PRODUCT_EXPLANATION,
} from "@/lib/firstUseGuidance";
import { resolveLandingVariant } from "./landingVariants";
import {
  bootstrapDemandAttribution,
  trackDemandEvent,
  withDemandQueryParams,
} from "@/lib/demandEngine";
import { useAuth } from "@/hooks/useAuth";
import { trackFirstUseGuidanceViewed } from "@/lib/firstUseAnalytics";
import { resolvePublicLandingIndexability } from "@shared/publicLandingIndexability";

function useLandingVariant() {
  const [location] = useLocation();
  const raw = String(location || "");
  const pathOnly = raw.split("?")[0].replace(/\/+$/, "") || "/";
  const queryString = raw.includes("?") ? raw.split("?").slice(1).join("?") : "";
  const query = useMemo(() => new URLSearchParams(queryString), [queryString]);

  const [, p1] = useRoute<{ variant: string }>("/landing/:variant");
  const [, p2] = useRoute<{ variant: string }>("/lp/:variant");
  const pathVariant =
    (p1?.variant ? String(p1.variant) : null) || (p2?.variant ? String(p2.variant) : null);

  const effectiveVariant = pathOnly === "/lp" ? null : pathVariant;

  return useMemo(
    () => resolveLandingVariant({ pathVariant: effectiveVariant, query }),
    [effectiveVariant, query]
  );
}

// ---- Animated counter ----
function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
}: {
  target: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// ---- Section reveal wrapper ----
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

// ---- Navigation ----
function Navbar({ variant }: { variant: ReturnType<typeof useLandingVariant> }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = variant.navLinks;

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    if (!href.startsWith("#")) {
      window.location.assign(href);
      return;
    }
    const id = href.replace("#", "");
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav
      className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-transparent backdrop-blur-xl border-b border-white/10" : "bg-transparent"}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 lg:h-16">
          <button onClick={() => handleNavClick("#")} className="flex items-center gap-2.5 group">
            <TradeScoutLogo size="sm" className="h-5 w-5 lg:h-7 lg:w-7" />
            <span className="font-display font-bold text-base lg:text-lg text-white tracking-tight">
              Trade<span className="text-ts-orange">Scout</span>
            </span>
          </button>

          <div className="hidden lg:flex items-center gap-8">
            {links.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                className="text-sm font-medium text-white/70 hover:text-ts-orange transition-colors duration-200"
              >
                {link.label}
              </button>
            ))}
            <a
              href={variant.primaryCta.href}
              onClick={() =>
                void trackDemandEvent("cta_click", {
                  placement: "nav_primary",
                  variant: variant.key,
                  href: variant.primaryCta.href,
                })
              }
            >
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white font-semibold px-6 h-10 rounded-lg shadow-lg shadow-ts-orange/20 transition-all hover:shadow-ts-orange/30 hover:scale-[1.02]">
                {variant.primaryCta.label}
              </Button>
            </a>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-white/80 hover:text-white p-2"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden bg-transparent backdrop-blur-xl border-b border-white/10"
        >
          <div className="px-4 py-4 space-y-3">
            {links.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                className="block w-full text-left text-base font-medium text-white/80 hover:text-ts-orange py-2 transition-colors"
              >
                {link.label}
              </button>
            ))}
            <a
              href={variant.primaryCta.href}
              onClick={() =>
                void trackDemandEvent("cta_click", {
                  placement: "nav_mobile_primary",
                  variant: variant.key,
                  href: variant.primaryCta.href,
                })
              }
            >
              <Button className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white font-semibold h-12 rounded-lg mt-2">
                {variant.primaryCta.label}
              </Button>
            </a>
          </div>
        </motion.div>
      )}
    </nav>
  );
}

// ---- Hero Section ----
function HeroSection({ variant }: { variant: ReturnType<typeof useLandingVariant> }) {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 56]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.82]);

  return (
    <section
      ref={heroRef}
      className="ts-landing-hero relative flex min-h-[34vh] items-start overflow-hidden md:min-h-[40vh] lg:min-h-[48vh]"
    >
      <motion.div
        // eslint-disable-next-line no-restricted-syntax -- framer-motion transform props (non-color styles)
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 pt-6 sm:px-6 md:pb-10 md:pt-9 lg:px-8 lg:pb-12 lg:pt-10"
      >
        <div className="w-full md:max-w-3xl">
          {variant.showBadge !== false && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2"
            >
              <ShieldCheck className="w-4 h-4 text-ts-orange" />
              <span className="text-sm font-medium text-ts-orange">{variant.badgeText}</span>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="font-display mb-4 max-w-3xl text-[2rem] font-extrabold leading-[1.02] text-white [text-wrap:balance] sm:text-4xl md:text-5xl lg:text-[4.25rem]"
          >
            {variant.headlineLines.map((line, index) => {
              const isAccent = index === 1 || (variant.headlineLines.length === 1 && index === 0);
              return (
                <span key={line}>
                  <span className={isAccent ? "text-gradient-orange" : undefined}>{line}</span>
                  {index < variant.headlineLines.length - 1 ? <br /> : null}
                </span>
              );
            })}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg"
          >
            {variant.subhead}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <a
              href={variant.primaryCta.href}
              onClick={() =>
                void trackDemandEvent("cta_click", {
                  placement: "hero_primary",
                  variant: variant.key,
                  href: variant.primaryCta.href,
                })
              }
            >
              <Button className="h-12 w-full bg-ts-orange px-6 text-sm font-bold text-white shadow-xl shadow-ts-orange/20 transition-all hover:bg-ts-orange-dark hover:shadow-ts-orange/30 sm:w-auto sm:text-base">
                {variant.primaryCta.label}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            {variant.secondaryCta?.scrollToId ? (
              <Button
                onClick={() => {
                  const elem = document.getElementById(variant.secondaryCta?.scrollToId || "");
                  elem?.scrollIntoView({ behavior: "smooth" });
                }}
                variant="outline"
                className="h-12 w-full bg-transparent px-6 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto sm:text-base"
              >
                {variant.secondaryCta.label}
              </Button>
            ) : variant.secondaryCta?.href ? (
              <a
                href={variant.secondaryCta.href}
                onClick={() =>
                  void trackDemandEvent("cta_click", {
                    placement: "hero_secondary",
                    variant: variant.key,
                    href: variant.secondaryCta?.href,
                  })
                }
              >
                <Button
                  variant="outline"
                  className="h-12 w-full bg-transparent px-6 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto sm:text-base"
                >
                  {variant.secondaryCta.label}
                </Button>
              </a>
            ) : null}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-4 text-xs text-white/50"
          >
            No account required to start. Save progress later if you want to.
          </motion.p>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ChevronDown className="w-6 h-6 text-white/40" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ---- Stats Bar ----
function StatsBar() {
  const stats = [
    { value: 100, suffix: "%", label: "Community-Driven" },
    { value: 0, suffix: "", label: "Lead spam", display: "Zero" },
    { value: 0, suffix: "", label: "Paid placement", display: "No" },
  ];

  return (
    <section className="relative z-10 bg-transparent border-y border-white/10 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {stats.map((stat, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div className="text-center rounded-xl border border-white/10 bg-white/[0.03] py-4 px-3">
                <div className="font-display text-3xl sm:text-4xl font-extrabold text-ts-orange mb-1">
                  {stat.display ?? <AnimatedCounter target={stat.value} suffix={stat.suffix} />}
                </div>
                <div className="text-xs sm:text-sm text-white/65 font-medium">{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- How It Works Section ----
function HowItWorksSection() {
  const steps = [
    {
      icon: MessageSquare,
      title: "Scout",
      desc: "Use Scout for automatic guidance so you know the best next step before taking action.",
    },
    {
      icon: Handshake,
      title: "Direct Connect",
      desc: "Make requests and view the local directory to compare providers and move your project forward.",
    },
    {
      icon: Users,
      title: "Community",
      desc: "Ask neighbors questions, discuss local experiences, and make decisions with community input.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 py-14 md:py-20 bg-transparent overflow-hidden"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
            <Zap className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">The Process</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-3">
            How TradeScout Works
          </h2>
          <p className="text-base text-white/70 max-w-2xl mx-auto">
            Describe what you need and get a clear next step without digging through directories.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="bg-tsCard border border-white/10 rounded-2xl p-5 md:p-6 hover:border-ts-orange/30 transition-colors shadow-[0_18px_52px_rgba(0,0,0,0.36)]"
              >
                <div className="w-10 h-10 bg-ts-orange/20 rounded-xl flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-ts-orange" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---- Trust Model Section ----
function TrustSection({ variant }: { variant: ReturnType<typeof useLandingVariant> }) {
  const layers = [
    { icon: UserCheck, title: "Identity Verified", desc: "Real person, real business" },
    { icon: FileCheck, title: "License & Insurance", desc: "Active, up-to-date credentials" },
    { icon: TrendingUp, title: "Work History", desc: "Completed jobs, timeline adherence" },
    {
      icon: Users,
      title: "Community Recommendations",
      desc: "Neighbor endorsements, not anonymous recommendations",
    },
    { icon: Eye, title: "Dispute Resolution", desc: "How conflicts were handled" },
  ];

  return (
    <section id="trust" className="relative scroll-mt-20 py-14 md:py-20 bg-transparent">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
                <Shield className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Trust Score</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-3">
                Trust, Not Payment
              </h2>
              <p className="text-base text-white/70 mb-5">
                Every business has a Trust Score based on verified identity, active credentials,
                work history, community recommendations, and dispute resolution. You can quickly see
                why someone is a strong fit before you reach out.
              </p>
              <div className="space-y-2.5">
                {layers.map((layer, i) => {
                  const Icon = layer.icon;
                  return (
                    <Reveal key={i} delay={i * 0.05}>
                      <div className="flex gap-2.5">
                        <div className="w-8 h-8 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-ts-orange" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-white leading-tight">
                            {layer.title}
                          </h4>
                          <p className="text-xs text-white/60 leading-snug">{layer.desc}</p>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <img
              src={variant.images.trust}
              alt="Trust and safety overview"
              className="w-full h-[150px] sm:h-[200px] lg:h-[260px] rounded-xl shadow-2xl shadow-ts-orange/20 object-cover object-[35%_center]"
              loading="lazy"
              decoding="async"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---- Direct Connect Section ----
function DirectConnectSection({ variant }: { variant: ReturnType<typeof useLandingVariant> }) {
  const features = [
    {
      icon: Ban,
      title: "Calmer Inbox",
      desc: "Your request is not blasted to dozens of providers",
    },
    { icon: TrendingUp, title: "Better Fit", desc: "See the most relevant local options first" },
    { icon: Lock, title: "Privacy Protected", desc: "Your info stays private until you decide" },
    {
      icon: DollarSign,
      title: "$0 Core Access",
      desc: "You can browse and compare options before deciding whether to contact",
    },
    {
      icon: Ban,
      // No lead sales — TradeScout does not sell your request to contractors
      title: "No lead sales",
      desc: "TradeScout does not sell your request. Claiming to unlock access, ranking, or visibility is a scam.",
    },
  ];

  return (
    <section
      id="direct-connect"
      className="relative scroll-mt-20 py-14 md:py-20 bg-transparent overflow-hidden"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          <Reveal delay={0.2}>
            <img
              src={variant.images.craft}
              alt="Get matched with local businesses"
              className="w-full h-[150px] sm:h-[200px] lg:h-[260px] rounded-xl shadow-2xl shadow-black/30 object-cover"
            />
          </Reveal>

          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
                <Handshake className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Protected Request Flow</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-3">
                Less noise.
                <br />
                Better matches.
              </h2>
              <p className="text-base text-white/70 mb-5">
                Scout shows focused local options first, then opens contact only when you are ready.
              </p>
              <div className="space-y-2.5">
                {features.map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <Reveal key={i} delay={i * 0.05}>
                      <div className="flex gap-2.5">
                        <div className="w-8 h-8 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-ts-orange" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-white leading-tight">
                            {feature.title}
                          </h4>
                          <p className="text-xs text-white/60 leading-snug">{feature.desc}</p>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---- For Contractors Section ----
function AudienceSection({ variant }: { variant: ReturnType<typeof useLandingVariant> }) {
  return (
    <section id="audience" className="relative scroll-mt-20 py-14 md:py-20 bg-transparent">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
            <Briefcase className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">
              {variant.audience.sectionLabel}
            </span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-3">
            {variant.audience.sectionTitle}
          </h2>
          <p className="text-base text-white/70 max-w-2xl mx-auto">
            {variant.audience.sectionDesc}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-4 md:gap-5">
          {variant.audience.cards.map((card, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="bg-tsCard border border-white/10 rounded-2xl p-5 md:p-6 hover:border-ts-orange/30 transition-colors shadow-[0_18px_52px_rgba(0,0,0,0.36)]"
              >
                <h3 className="font-display text-lg font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/70 leading-relaxed">{card.desc}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- Pricing Section ----
function PricingSection() {
  const quickStart = [
    "Describe your exact project and timeline",
    "Review 1-3 trust-ranked matches before contact opens",
    "Approve contact only when the fit looks right",
  ];

  return (
    <section
      id="pricing"
      className="relative scroll-mt-20 py-14 md:py-20 bg-transparent overflow-hidden"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
            <Sparkles className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">What To Expect</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Faster path. Less noise.
          </h2>
          <p className="text-base text-white/70 max-w-2xl mx-auto">
            Start here if you want a simple local decision flow from question to contact.
          </p>
          <p className="text-xs text-white/50 max-w-2xl mx-auto mt-1.5">
            Start free, compare options clearly, and move forward when the fit looks right.
          </p>
        </Reveal>

        <Reveal className="bg-tsCard border border-white/10 rounded-2xl p-5 md:p-6 shadow-[0_18px_52px_rgba(0,0,0,0.36)] mb-5">
          <h3 className="font-display text-lg font-bold text-white mb-2.5">Before You Start</h3>
          <ul className="space-y-1.5">
            {quickStart.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-white/80">
                <CheckCircle className="w-4 h-4 text-ts-orange flex-shrink-0 mt-0.5" />
                {step}
              </li>
            ))}
          </ul>
        </Reveal>

        <div className="mt-3">
          <Reveal>
            <RevenueDisclosureSection title="How we make money (without selling leads)" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ---- FAQ Section ----
function FAQSection() {
  const faqs = [
    {
      q: "How much does TradeScout cost?",
      a: "Access is simple: no charge to connect, and information is free. Any payment request claiming to unlock access, ranking, or visibility is a scam.",
    },
    {
      q: "How is TradeScout different from Angi or HomeAdvisor?",
      a: "Many platforms trigger a flood of calls after one request. TradeScout keeps routing focused so you can review fewer, better-fit options first.",
    },
    {
      q: "What is the Trust Score?",
      a: "The Trust Score gives you a quick read on identity, active credentials, work history, community recommendations, and dispute history, so you can understand why Scout matched you with someone.",
    },
    {
      q: "Can businesses pay to change their ranking?",
      a: "No. Ranking is based on trust and fit, and payment does not move someone ahead.",
    },
    {
      q: "How does Direct Connect work?",
      a: "Scout routes your request to a small set of relevant local businesses. You review options and open contact when you are ready.",
    },
    {
      q: "What if I don't like the matches Scout sent me?",
      a: "You can browse the full directory anytime. Scout's matches are recommendations based on trust and relevance, but you're always in control.",
    },
  ];

  return (
    <section id="faq" className="relative py-14 md:py-20 bg-transparent">
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-white/70">
            Quick answers on cost, matching, trust score, and what to do if your first matches are
            off.
          </p>
        </Reveal>

        <Reveal>
          <Accordion type="single" collapsible className="space-y-1.5">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-white/10 rounded-lg px-3 data-[state=open]:bg-tsCard shadow-[0_10px_38px_rgba(0,0,0,0.34)]"
              >
                <AccordionTrigger className="text-white font-semibold hover:text-ts-orange transition-colors py-2.5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-white/70 pb-2.5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

// ---- CTA Section ----
function CTASection({ variant }: { variant: ReturnType<typeof useLandingVariant> }) {
  return (
    <section id="get-started" className="relative py-14 md:py-20 bg-transparent overflow-hidden">
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-3">
            <Award className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">{variant.cta.label}</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
            {variant.cta.titleLines.map((line, idx) => (
              <span key={idx}>
                {idx === 1 ? <span className="text-gradient-orange">{line}</span> : line}
                <br />
              </span>
            ))}
          </h2>

          <p className="text-base text-white/70 mb-5 max-w-xl mx-auto">{variant.cta.desc}</p>

          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <a
              href={variant.cta.primaryHref}
              onClick={() =>
                void trackDemandEvent("cta_click", {
                  placement: "bottom_primary",
                  variant: variant.key,
                  href: variant.cta.primaryHref,
                })
              }
            >
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white font-bold text-sm sm:text-base px-8 h-12 rounded-lg shadow-xl shadow-ts-orange/25 transition-all hover:shadow-ts-orange/40 hover:scale-[1.02]">
                {variant.cta.primaryLabel}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            {variant.cta.secondaryHref && variant.cta.secondaryLabel ? (
              <a
                href={variant.cta.secondaryHref}
                onClick={() =>
                  void trackDemandEvent("cta_click", {
                    placement: "bottom_secondary",
                    variant: variant.key,
                    href: variant.cta.secondaryHref,
                  })
                }
              >
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 font-semibold text-sm sm:text-base px-8 h-12 rounded-lg bg-transparent"
                >
                  {variant.cta.secondaryLabel}
                </Button>
              </a>
            ) : null}
          </div>

          <p className="text-xs text-white/30 mt-3">Clear choices first. Contact on your terms.</p>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Footer ----
function Footer({ variant }: { variant: ReturnType<typeof useLandingVariant> }) {
  return (
    <footer className="bg-transparent border-t border-white/10 pt-10 pb-10 sm:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={variant.images.logo} alt="TradeScout" className="w-10 h-10 rounded-lg" />
              <span className="font-display font-bold text-lg text-white">
                Trade<span className="text-ts-orange">Scout</span>
              </span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed max-w-xs">
              Ask one question, see your best local options, and move forward with less friction.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <button
                  onClick={() =>
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-ts-orange transition-colors"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  onClick={() =>
                    document.getElementById("trust")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-ts-orange transition-colors"
                >
                  Trust & Safety
                </button>
              </li>
              <li>
                <button
                  onClick={() =>
                    document
                      .getElementById("direct-connect")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-ts-orange transition-colors"
                >
                  Get Connected
                </button>
              </li>
              <li>
                <button
                  onClick={() =>
                    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-ts-orange transition-colors"
                >
                  Pricing
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">For You</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <button
                  onClick={() =>
                    document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-ts-orange transition-colors"
                >
                  Quick answers
                </button>
              </li>
              <li>
                <a
                  href={variant.primaryCta.href}
                  className="hover:text-ts-orange transition-colors"
                  onClick={() =>
                    void trackDemandEvent("cta_click", {
                      placement: "footer_primary",
                      variant: variant.key,
                      href: variant.primaryCta.href,
                    })
                  }
                >
                  Get started
                </a>
              </li>
              <li>
                <a
                  href="/pensacola"
                  className="hover:text-ts-orange transition-colors"
                  onClick={() =>
                    void trackDemandEvent("cta_click", {
                      placement: "footer_pensacola_hub",
                      variant: variant.key,
                      href: "/pensacola",
                    })
                  }
                >
                  Pensacola launch hub
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <a
                  href="/terms"
                  className="hover:text-ts-orange transition-colors"
                  onClick={() =>
                    void trackDemandEvent("cta_click", {
                      placement: "footer_legal_terms",
                      variant: variant.key,
                      href: "/terms",
                    })
                  }
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a
                  href="/privacy"
                  className="hover:text-ts-orange transition-colors"
                  onClick={() =>
                    void trackDemandEvent("cta_click", {
                      placement: "footer_legal_privacy",
                      variant: variant.key,
                      href: "/privacy",
                    })
                  }
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/help"
                  className="hover:text-ts-orange transition-colors"
                  onClick={() =>
                    void trackDemandEvent("cta_click", {
                      placement: "footer_legal_contact",
                      variant: variant.key,
                      href: "/help",
                    })
                  }
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-5 space-y-1">
          {/* Scout is the operating layer for local interaction */}
          <p className="text-xs text-white/20 text-center">
            The local operating system for community interaction. Trust-first local action powered
            by Scout.
          </p>
          <p className="text-xs text-white/15 text-center">
            TradeScout is not a lead funnel. Scout runs the local operating flow from discovery to
            governed action.
          </p>
          <p className="text-xs text-white/30 text-center">
            &copy; 2026 TradeScout. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---- Main Page ----
export default function CampaignLandingPage() {
  const { user } = useAuth();
  const firstUseUserState = user ? "authenticated" : "anonymous";
  const [location] = useLocation();
  const rawLocation = String(location || "");
  const landingIndexability = resolvePublicLandingIndexability({ requestPath: rawLocation });
  const canonicalLandingPath = landingIndexability.canonicalPath;
  const canonicalLandingUrl = `https://www.thetradescout.com${canonicalLandingPath}`;
  const shouldIndexLandingPage = landingIndexability.indexable;

  const variant = useLandingVariant();
  const trackedVariant = useMemo(
    () => ({
      ...variant,
      navLinks: variant.navLinks.map((link) => ({
        ...link,
        href: link.href.startsWith("/") ? withDemandQueryParams(link.href) : link.href,
      })),
      primaryCta: {
        ...variant.primaryCta,
        href: withDemandQueryParams(variant.primaryCta.href),
      },
      secondaryCta:
        variant.secondaryCta?.href != null
          ? {
              ...variant.secondaryCta,
              href: withDemandQueryParams(variant.secondaryCta.href),
            }
          : variant.secondaryCta,
      cta: {
        ...variant.cta,
        primaryHref: withDemandQueryParams(variant.cta.primaryHref),
        secondaryHref: variant.cta.secondaryHref
          ? withDemandQueryParams(variant.cta.secondaryHref)
          : undefined,
      },
    }),
    [variant]
  );

  useEffect(() => {
    bootstrapDemandAttribution();
    void trackDemandEvent("landing_view", { variant: trackedVariant.key });
  }, [trackedVariant.key]);

  useEffect(() => {
    trackFirstUseGuidanceViewed("landing", firstUseUserState);
  }, [firstUseUserState]);

  return (
    <div className="ts-landing relative flex flex-col overflow-x-clip text-white font-body">
      <div aria-hidden className="ts-landing__field pointer-events-none absolute inset-0" />
      {/* Scout is the operating layer for local interaction */}
      <SEOHelmet
        title={
          variant.key === "local-operating-system"
            ? "TradeScout | The Local Operating System for Community Interaction"
            : canonicalLandingPath === "/"
              ? "TradeScout | Find Any Local Business Near You"
              : `${variant.displayName} | TradeScout`
        }
        description={variant.subhead}
        canonical={canonicalLandingUrl}
        noIndex={!shouldIndexLandingPage}
      />
      <Navbar variant={trackedVariant} />
      <main className="relative z-10">
        <section
          data-testid="first-use-guidance-surface"
          className="mx-auto w-full max-w-7xl px-4 pt-2 sm:px-6 sm:pt-3 lg:px-8"
        >
          <div className="grid grid-cols-1 gap-2.5">
            <div className="rounded-xl border border-white/10 bg-tsCard/90 p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.24)] md:p-4">
              <p className="text-sm text-white/80">{TRADE_SCOUT_PRODUCT_EXPLANATION}</p>
            </div>
            <div data-testid="first-use-launcher">
              <FirstUsefulStepLauncher surface="landing" userState={firstUseUserState} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FirstUseGuidanceCard
                title="Scout is your discovery page."
                description={SCOUT_GUIDANCE_TEXT}
              />
              <FirstUseGuidanceCard
                title="HomeID keeps your home history organized."
                description={HOMEID_GUIDANCE_TEXT}
              />
              <FirstUseGuidanceCard
                title="Direct Connect prepares your request."
                description={DIRECT_CONNECT_GUIDANCE_TEXT}
              />
            </div>
          </div>
        </section>
        <HeroSection variant={trackedVariant} />
        <StatsBar />
        <HowItWorksSection />
        <TrustSection variant={trackedVariant} />
        <DirectConnectSection variant={trackedVariant} />
        <PricingSection />
        <FAQSection />
        <CTASection variant={trackedVariant} />
      </main>
      <Footer variant={trackedVariant} />
    </div>
  );
}
