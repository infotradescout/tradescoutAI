/**
 * TradeScout Landing Page - "Forged Trust" Design
 *
 * Design: Bold craft-forward with diagonal sections, high-contrast orange/navy,
 * oversized typography (Sora display + Work Sans body), forge stamp badges.
 *
 * KEY TRUTHS:
 * - No lead sales; no pay-to-play visibility
 * - Trust-first matching (CVS-based, not pay-to-play)
 * - 1-3 matches per request (contact stays intent-gated)
 * - Community-owned reinvestment model
 * - Payment CANNOT override trust tiers
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
  AlertCircle,
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
import { resolveLandingVariant } from "./landingVariants";
import {
  bootstrapDemandAttribution,
  trackDemandEvent,
  withDemandQueryParams,
} from "@/lib/demandEngine";

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
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-12 lg:h-14">
          <button onClick={() => handleNavClick("#")} className="flex items-center gap-3 group">
            <TradeScoutLogo size="sm" className="lg:w-10 lg:h-10" />
            <span className="font-display font-bold text-lg lg:text-xl text-white tracking-tight">
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
      className="relative min-h-[34vh] md:min-h-[40vh] lg:min-h-[46vh] flex items-start overflow-hidden"
    >
      <motion.div
        // eslint-disable-next-line no-restricted-syntax -- framer-motion transform props (non-color styles)
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative z-10 max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 pt-3 pb-4 md:pt-4 md:pb-5 lg:pt-5 lg:pb-6 w-full"
      >
        <div className="w-full md:max-w-2xl">
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
            className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.03] tracking-tight mb-2"
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
            className="text-sm sm:text-base text-white/70 max-w-none md:max-w-xl mb-2.5 leading-relaxed"
          >
            {variant.subhead}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mb-3 rounded-xl border border-ts-orange/25 bg-ts-orange/10 px-3 py-2"
          >
            <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
              Scout is the operating layer for local interaction: it interprets what you need,
              routes the right next step, explains trust, and keeps contact governed instead of
              chaotic.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-2.5"
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
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white font-bold text-sm sm:text-base px-5 h-11 rounded-lg shadow-xl shadow-ts-orange/25 transition-all hover:shadow-ts-orange/40 hover:scale-[1.02] w-full sm:w-auto">
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
                className="border-white/20 text-white hover:bg-white/10 font-semibold text-sm sm:text-base px-5 h-11 rounded-lg w-full sm:w-auto bg-transparent"
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
                  className="border-white/20 text-white hover:bg-white/10 font-semibold text-sm sm:text-base px-5 h-11 rounded-lg w-full sm:w-auto bg-transparent"
                >
                  {variant.secondaryCta.label}
                </Button>
              </a>
            ) : null}
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-0.5 md:bottom-2 left-1/2 -translate-x-1/2"
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
    { value: 1, suffix: "", label: "Scout Control Plane" },
    { value: 0, suffix: "", label: "Lead Spam", display: "Zero" },
    { value: 5, suffix: "", label: "Governed Stages", display: "Five" },
    { value: 0, suffix: "", label: "Pay-to-Play", display: "No" },
  ];

  return (
    <section className="relative z-10 bg-transparent border-y border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 lg:py-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {stats.map((stat, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div className="text-center">
                <div className="font-display text-xl sm:text-2xl font-extrabold text-ts-orange mb-0.5">
                  {stat.display ?? <AnimatedCounter target={stat.value} suffix={stat.suffix} />}
                </div>
                <div className="text-[11px] sm:text-xs text-white/60 font-medium">{stat.label}</div>
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
      title: "Ask Scout",
      desc: "Tell Scout what you need so the system starts from your real intent, not from a category guess.",
    },
    {
      icon: Search,
      title: "Scout Interprets",
      desc: "Scout turns your request into a local decision path using trust, trade fit, and location context.",
    },
    {
      icon: CheckCircle,
      title: "Scout Routes",
      desc: "The system routes the request to the right next step, whether that is a match, a decision card, or a governed hold.",
    },
    {
      icon: Handshake,
      title: "Contact Stays Governed",
      desc: "Only after fit and intent are clear does contact open. You stay in control without losing privacy or context.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 py-4 md:py-6 bg-transparent overflow-hidden"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-3">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
            <Zap className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">The Process</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-2">
            How TradeScout Works
          </h2>
          <p className="text-sm text-white/60 max-w-2xl mx-auto">
            TradeScout is not a lead funnel. Scout runs the local operating flow from discovery to
            governed action.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="bg-tsCard border border-white/10 rounded-xl p-3 md:p-4 hover:border-ts-orange/30 transition-colors shadow-[0_18px_52px_rgba(0,0,0,0.36)]"
              >
                <div className="w-8 h-8 bg-ts-orange/20 rounded-lg flex items-center justify-center mb-2">
                  <Icon className="w-4 h-4 text-ts-orange" />
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">{step.title}</h3>
                <p className="text-xs text-white/60 leading-relaxed">{step.desc}</p>
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
      desc: "Neighbor endorsements, not anonymous reviews",
    },
    { icon: Eye, title: "Dispute Resolution", desc: "How conflicts were handled" },
  ];

  return (
    <section id="trust" className="relative scroll-mt-20 py-4 md:py-6 bg-transparent">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 items-center">
          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
                <Shield className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">
                  Community Verification Score
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-2">
                Trust, Not Payment
              </h2>
              <p className="text-sm text-white/60 mb-3">
                Every pro has a Community Verification Score (CVS) based on verified identity,
                active credentials, work history, community recommendations, and dispute resolution.
                Trust metrics are public and auditable.
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
              alt="Trust Model"
              className="w-full h-[150px] sm:h-[200px] lg:h-[260px] rounded-xl shadow-2xl shadow-ts-orange/20 object-cover object-[35%_center]"
              loading="lazy"
              decoding="async"
            />
          </Reveal>
        </div>

        {/* Key Principle */}
        <Reveal className="mt-4 lg:mt-6 bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-3">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-ts-orange flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-display text-base font-bold text-white mb-1">
                Payment Cannot Override Trust
              </h3>
              <p className="text-sm text-white/70">
                A pro with CVS 40 cannot pay to rank above a pro with CVS 80. Financial activity is
                excluded from ranking logic. Trust always comes first.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Direct Connect Section ----
function DirectConnectSection({ variant }: { variant: ReturnType<typeof useLandingVariant> }) {
  const features = [
    { icon: Ban, title: "No Lead Spam", desc: "1-3 matches per request, not 20+" },
    { icon: TrendingUp, title: "Quality Over Quantity", desc: "Trust-ranked, not price-ranked" },
    { icon: Lock, title: "Privacy Protected", desc: "Your info stays private until you decide" },
    {
      icon: DollarSign,
      title: "$0 Core Access",
      desc: "No charge to connect; information is free; unlabeled payment asks are scams",
    },
  ];

  return (
    <section
      id="direct-connect"
      className="relative scroll-mt-20 py-4 md:py-6 bg-transparent overflow-hidden"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 items-center">
          <Reveal delay={0.2}>
            <img
              src={variant.images.craft}
              alt="Direct Connect"
              className="w-full h-[150px] sm:h-[200px] lg:h-[260px] rounded-xl shadow-2xl shadow-black/30 object-cover"
            />
          </Reveal>

          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
                <Handshake className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Direct Connection</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-2">
                No Spam.
                <br />
                No Bidding Wars.
              </h2>
              <p className="text-sm text-white/60 mb-3">
                Scout routes your request to 1-3 qualified pros. They accept or decline upfront. No
                wasted time, no spam calls.
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
    <section id="audience" className="relative scroll-mt-20 py-4 md:py-6 bg-transparent">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-3">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
            <Briefcase className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">
              {variant.audience.sectionLabel}
            </span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-2">
            {variant.audience.sectionTitle}
          </h2>
          <p className="text-sm text-white/60 max-w-2xl mx-auto">{variant.audience.sectionDesc}</p>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-2.5 md:gap-3">
          {variant.audience.cards.map((card, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="bg-tsCard border border-white/10 rounded-xl p-3 md:p-4 hover:border-ts-orange/30 transition-colors shadow-[0_18px_52px_rgba(0,0,0,0.36)]"
              >
                <h3 className="font-display text-base font-bold text-white mb-1.5">{card.title}</h3>
                <p className="text-xs text-white/60 leading-relaxed">{card.desc}</p>
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
  const features = [
    "Unlimited directory search",
    "Direct Connect matching",
    "Community intel & playbooks",
    "Scout assistant",
    "Local checklists",
    "Role-specific dashboards",
  ];

  const sponsorFeatures = [
    "$0 access for features, connections, and information",
    "No lead sales and no pay-to-play visibility",
    "Payment-blind trust and ranking systems",
    "No paywalls and no access tiers",
    "No paid ranking and no paid lead routing",
  ];

  return (
    <section
      id="pricing"
      className="relative scroll-mt-20 py-4 md:py-6 bg-transparent overflow-hidden"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-3">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-2">
            <Sparkles className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">Simple Pricing</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-2">$0</h2>
          <p className="text-sm text-white/60 max-w-2xl mx-auto">For you. For free. Forever.</p>
          <p className="text-xs text-white/50 max-w-2xl mx-auto mt-1.5">
            We make money, just not from you reading this. No paywalls. No lead sales. No
            pay-to-play.
          </p>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-3 mb-3">
          <Reveal>
            <div className="bg-tsCard border border-white/10 rounded-xl p-3 md:p-4 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
              <h3 className="font-display text-lg font-bold text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-ts-orange" />
                What You Get
              </h3>
              <ul className="space-y-1.5">
                {features.map((feature, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/80">
                    <CheckCircle className="w-4 h-4 text-ts-orange flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="bg-tsCard border border-white/10 rounded-xl p-3 md:p-4 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
              <h3 className="font-display text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-ts-orange" />
                How We Keep It $0
              </h3>
              <ul className="space-y-1.5">
                {sponsorFeatures.map((feature, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/80">
                    <CheckCircle className="w-4 h-4 text-ts-orange flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal className="bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-3 text-center">
          <h3 className="font-display text-lg font-bold text-white mb-1.5">
            Community Builders & Local Reinvestment
          </h3>
          <p className="text-sm text-white/70 mb-2">
            Community Builders help direct community vault support back to their counties with
            transparency-first reporting.
          </p>
          <p className="text-xs text-white/60">
            Community Builders earn badges that let them send and vote on causes funded from the
            community vault.
          </p>
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
      a: "The big pain point is lead reselling: one homeowner request gets sold to many contractors, and the homeowner gets flooded. TradeScout does not resell your request. Scout routes to 1-3 relevant matches, and trust determines ranking, not payment.",
    },
    {
      q: "What is the Community Verification Score (CVS)?",
      a: "It's a public, auditable score based on verified identity, active credentials, work history, community recommendations, and dispute resolution. You can see exactly why Scout matched you with a pro.",
    },
    {
      q: "Can pros pay to change their ranking?",
      a: "No. Ranking is trust-and-context based, and financial activity is excluded from ranking logic.",
    },
    {
      q: "How does Direct Connect work?",
      a: "Scout sends your request to 1-3 pre-matched pros. They review your details and choose to accept or decline before contacting you. No spam, no pressure.",
    },
    {
      q: "What if I don't like the matches Scout sent me?",
      a: "You can browse the full directory anytime. Scout's matches are recommendations based on trust and relevance, but you're always in control.",
    },
  ];

  return (
    <section className="relative py-4 md:py-6 bg-transparent">
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-3">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-white/60">Everything you need to know about TradeScout</p>
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
    <section id="get-started" className="relative py-4 md:py-6 bg-transparent overflow-hidden">
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-2.5 py-1 mb-3">
            <Award className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">{variant.cta.label}</span>
          </div>

          <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight mb-3">
            {variant.cta.titleLines.map((line, idx) => (
              <span key={idx}>
                {idx === 1 ? <span className="text-gradient-orange">{line}</span> : line}
                <br />
              </span>
            ))}
          </h2>

          <p className="text-sm text-white/60 mb-3 max-w-xl mx-auto">{variant.cta.desc}</p>

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
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white font-bold text-sm sm:text-base px-7 h-11 rounded-lg shadow-xl shadow-ts-orange/25 transition-all hover:shadow-ts-orange/40 hover:scale-[1.02]">
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
                  className="border-white/20 text-white hover:bg-white/10 font-semibold text-sm sm:text-base px-7 h-11 rounded-lg bg-transparent"
                >
                  {variant.cta.secondaryLabel}
                </Button>
              </a>
            ) : null}
          </div>

          <p className="text-xs text-white/30 mt-3">No lead sales. No pay-to-play.</p>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Footer ----
function Footer({ variant }: { variant: ReturnType<typeof useLandingVariant> }) {
  return (
    <footer className="bg-transparent border-t border-white/10 pt-5 pb-8 sm:pb-5">
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
              The local operating system for community interaction. Trust-first local action powered
              by Scout.
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
                  Trust Model
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
                  Direct Connect
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
                    document.getElementById("audience")?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="hover:text-ts-orange transition-colors"
                >
                  Who it's for
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

        <div className="border-t border-white/5 pt-5">
          <p className="text-xs text-white/30 text-center">
            (c) 2026 TradeScout. All rights reserved. The local operating system for community
            interaction.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---- Main Page ----
export default function Home() {
  const [location] = useLocation();
  const rawLocation = String(location || "");
  const pathOnly = rawLocation.split("?")[0].replace(/\/+$/, "") || "/";
  const hasQueryParams = rawLocation.includes("?");
  const canonicalLandingPath = pathOnly.startsWith("/lp/")
    ? pathOnly.replace(/^\/lp\//, "/landing/")
    : pathOnly === "/lp"
      ? "/landing"
      : pathOnly.startsWith("/landing/")
        ? pathOnly
        : "/landing";
  const canonicalLandingUrl = `https://www.thetradescout.com${canonicalLandingPath}`;
  const isAliasLandingPath = pathOnly === "/lp" || pathOnly.startsWith("/lp/");
  const shouldIndexLandingPage = !isAliasLandingPath && !hasQueryParams;

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

  return (
    <div className="flex flex-col bg-transparent text-white font-body">
      <SEOHelmet
        title={
          canonicalLandingPath === "/landing"
            ? "TradeScout | The Local Operating System for Community Interaction"
            : `${variant.displayName} | TradeScout`
        }
        description={variant.subhead}
        canonical={canonicalLandingUrl}
        noIndex={!shouldIndexLandingPage}
      />
      <Navbar variant={trackedVariant} />
      <main>
        <HeroSection variant={trackedVariant} />
        <StatsBar />
        <HowItWorksSection />
        <TrustSection variant={trackedVariant} />
        <DirectConnectSection variant={trackedVariant} />
        <AudienceSection variant={trackedVariant} />
        <PricingSection />
        <FAQSection />
        <CTASection variant={trackedVariant} />
      </main>
      <Footer variant={trackedVariant} />
    </div>
  );
}
