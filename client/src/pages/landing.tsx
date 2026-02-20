/**
 * TradeScout Landing Page — "Forged Trust" Design
 *
 * Design: Bold craft-forward with diagonal sections, high-contrast orange/navy,
 * oversized typography (Sora display + Work Sans body), forge stamp badges.
 *
 * KEY TRUTHS:
 * - $0 forever (no payment model at all)
 * - Trust-first matching (CVS-based, not pay-to-play)
 * - 1-3 matches per request (no lead spam)
 * - Community-owned reinvestment model
 * - Payment CANNOT override trust tiers
 */

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import {
  Shield,
  ShieldCheck,
  Search,
  MessageSquare,
  Users,
  CheckCircle,
  ArrowRight,
  Star,
  Zap,
  Lock,
  Eye,
  TrendingUp,
  Award,
  ChevronDown,
  X,
  Menu,
  Sparkles,
  BadgeCheck,
  MapPin,
  FileCheck,
  UserCheck,
  Handshake,
  Ban,
  DollarSign,
  Briefcase,
  Heart,
  Target,
  AlertCircle,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Image URLs
const IMAGES = {
  logo: "/landing/logo.png",
  hero: "/landing/hero.jpg",
  trust: "/landing/trust.jpg",
  community: "/landing/community.jpg",
  scoutAi: "/landing/scoutAi.jpg",
  craft: "/landing/craft.jpg",
};

// ─── Animated counter ───
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

// ─── Section reveal wrapper ───
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
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Navigation ───
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const getStartedHref = "https://www.thetradescout.com/login";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Trust Model", href: "#trust" },
    { label: "Direct Connect", href: "#direct-connect" },
    { label: "For Contractors", href: "#contractors" },
    { label: "Pricing", href: "#pricing" },
  ];

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const id = href.replace("#", "");
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-transparent backdrop-blur-md shadow-lg shadow-black/20 border-b border-white/5" : "bg-transparent"}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <button onClick={() => handleNavClick("#")} className="flex items-center gap-3 group">
            <img
              src={IMAGES.logo}
              alt="TradeScout"
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg"
            />
            <span className="font-[var(--font-display)] font-bold text-lg lg:text-xl text-white tracking-tight">
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
            <a href={getStartedHref} target="_blank" rel="noopener noreferrer">
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white font-semibold px-6 h-10 rounded-lg shadow-lg shadow-ts-orange/20 transition-all hover:shadow-ts-orange/30 hover:scale-[1.02]">
                Get Started
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
          className="lg:hidden bg-transparent backdrop-blur-xl border-b border-white/5"
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
            <a href={getStartedHref} target="_blank" rel="noopener noreferrer">
              <Button className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white font-semibold h-12 rounded-lg mt-2">
                Get Started
              </Button>
            </a>
          </div>
        </motion.div>
      )}
    </nav>
  );
}

// ─── Hero Section ───
function HeroSection() {
  return (
    <section className="relative min-h-[82vh] lg:min-h-[88vh] flex items-center overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 w-full">
        <div className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-4 py-2 mb-8"
          >
            <ShieldCheck className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">Trust-First Platform</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6"
          >
            Connection
            <br />
            <span className="text-gradient-orange">Without</span>
            <br />
            Compromise
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-lg sm:text-xl text-white/70 max-w-xl mb-7 leading-relaxed"
          >
            Verified people connect to verified pros through Scout-powered matching. No lead spam.
            No pay-to-play. No payment at all. Just trust.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <a href="https://www.thetradescout.com/login" target="_blank" rel="noopener noreferrer">
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white font-bold text-lg px-8 h-14 rounded-lg shadow-xl shadow-ts-orange/25 transition-all hover:shadow-ts-orange/40 hover:scale-[1.02] w-full sm:w-auto">
                Find a Contractor
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            <Button
              onClick={() => {
                const elem = document.getElementById("how-it-works");
                elem?.scrollIntoView({ behavior: "smooth" });
              }}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 font-semibold text-lg px-8 h-14 rounded-lg w-full sm:w-auto bg-transparent"
            >
              See How It Works
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ChevronDown className="w-6 h-6 text-white/40" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Stats Bar ───
function StatsBar() {
  const stats = [
    { value: 0, prefix: "$", suffix: "", label: "Cost to Anyone", display: "$0" },
    { value: 100, suffix: "%", label: "Trust-Based Matching" },
    { value: 0, suffix: "", label: "Lead Spam", display: "Zero" },
    { value: 5, suffix: "-Layer", label: "Verification System" },
  ];

  return (
    <section className="relative z-10 bg-transparent border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-ts-orange font-[var(--font-display)] mb-1">
                  {stat.display || (
                    <>
                      {stat.prefix}
                      <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                    </>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-white/60 font-medium">{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works Section ───
function HowItWorksSection() {
  const steps = [
    {
      icon: MessageSquare,
      title: "Ask Scout",
      desc: "Tell Scout what you need: 'I need a plumber in Austin for a leak'",
    },
    {
      icon: Search,
      title: "Scout Matches",
      desc: "Scout analyzes trust, trade, location, and urgency. Finds 1-3 qualified pros.",
    },
    {
      icon: CheckCircle,
      title: "Pros Accept/Decline",
      desc: "Contractors review your request and choose to accept or pass. No spam.",
    },
    {
      icon: Handshake,
      title: "Direct Connection",
      desc: "Pros who accept contact you directly. You choose who to hire.",
    },
  ];

  return (
    <section id="how-it-works" className="relative py-16 lg:py-20 bg-transparent overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-4 py-2 mb-6">
            <Zap className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">The Process</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            How TradeScout Works
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Trust-first matching controlled by Scout. No payment determines ranking.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <Reveal key={i} delay={i * 0.1}>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-ts-orange/30 transition-colors">
                  <div className="w-12 h-12 bg-ts-orange/20 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-ts-orange" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/60">{step.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Trust Model Section ───
function TrustSection() {
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
    <section id="trust" className="relative py-16 lg:py-20 bg-transparent">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-4 py-2 mb-6">
                <Shield className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">
                  Community Verification Score
                </span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6">
                Trust, Not Payment
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Every contractor has a Community Verification Score (CVS) based on verified
                identity, active credentials, work history, community recommendations, and dispute
                resolution. Trust metrics are public and auditable.
              </p>
              <div className="space-y-4">
                {layers.map((layer, i) => {
                  const Icon = layer.icon;
                  return (
                    <Reveal key={i} delay={i * 0.05}>
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-ts-orange" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{layer.title}</h4>
                          <p className="text-sm text-white/60">{layer.desc}</p>
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
              src={IMAGES.trust}
              alt="Trust Model"
              className="w-full h-[260px] sm:h-[340px] lg:h-[520px] rounded-xl shadow-2xl shadow-ts-orange/20 object-cover object-[35%_center]"
              loading="lazy"
              decoding="async"
            />
          </Reveal>
        </div>

        {/* Key Principle */}
        <Reveal className="mt-16 bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-8">
          <div className="flex gap-4">
            <AlertCircle className="w-6 h-6 text-ts-orange flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Payment Cannot Override Trust</h3>
              <p className="text-white/70">
                A contractor with CVS 40 cannot pay to rank above a contractor with CVS 80. Boosts
                work <strong>within trust tiers</strong>, not across them. Trust always comes first.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Direct Connect Section ───
function DirectConnectSection() {
  const features = [
    { icon: Ban, title: "No Lead Spam", desc: "1-3 matches per request, not 20+" },
    { icon: TrendingUp, title: "Quality Over Quantity", desc: "Trust-ranked, not price-ranked" },
    { icon: Lock, title: "Privacy Protected", desc: "Your info stays private until you decide" },
    { icon: DollarSign, title: "No Hidden Costs", desc: "No hidden fees, ever" },
  ];

  return (
    <section id="direct-connect" className="relative py-16 lg:py-20 bg-transparent overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal delay={0.2}>
            <img
              src={IMAGES.craft}
              alt="Direct Connect"
              className="rounded-xl shadow-2xl shadow-black/30"
            />
          </Reveal>

          <Reveal>
            <div>
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-4 py-2 mb-6">
                <Handshake className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Direct Connection</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6">
                No Spam.
                <br />
                No Bidding Wars.
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Scout routes your request to 1-3 qualified contractors. They accept or decline
                upfront. No wasted time, no spam calls.
              </p>
              <div className="space-y-4">
                {features.map((feature, i) => {
                  const Icon = feature.icon;
                  return (
                    <Reveal key={i} delay={i * 0.05}>
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-ts-orange" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{feature.title}</h4>
                          <p className="text-sm text-white/60">{feature.desc}</p>
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

// ─── For Contractors Section ───
function ContractorsSection() {
  const benefits = [
    { icon: Award, title: "Build Your CVS", desc: "Reputation grows with every verified job" },
    { icon: Users, title: "No Pay-to-Play", desc: "Trust determines ranking, not payment" },
    { icon: Target, title: "Qualified Leads Only", desc: "Pre-matched homeowners, not spam" },
    { icon: Briefcase, title: "Control Your Schedule", desc: "Accept or decline requests freely" },
  ];

  return (
    <section id="contractors" className="relative py-16 lg:py-20 bg-transparent">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-4 py-2 mb-6">
            <Briefcase className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">For Contractors</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Build Your Reputation
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            No pay-to-play. No lead fees. Just trust-first matching that rewards quality work.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <Reveal key={i} delay={i * 0.1}>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-ts-orange/30 transition-colors">
                  <div className="w-12 h-12 bg-ts-orange/20 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-ts-orange" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{benefit.title}</h3>
                  <p className="text-sm text-white/60">{benefit.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-16 text-center">
          <a
            href="https://www.thetradescout.com/contractor-join"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white font-bold text-lg px-10 h-14 rounded-lg shadow-xl shadow-ts-orange/25 transition-all hover:shadow-ts-orange/40 hover:scale-[1.02]">
              Join as a Contractor
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </a>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Pricing Section ───
function PricingSection() {
  const features = [
    "Unlimited contractor search",
    "Direct Connect matching",
    "Community intel & playbooks",
    "Scout assistant",
    "Local checklists",
    "Role-specific dashboards",
  ];

  const sponsorFeatures = [
    "Occasional affiliate offers",
    "Paid advertisers (clearly labeled)",
    "No paywalls or upsells",
    "Core features stay $0",
  ];

  return (
    <section id="pricing" className="relative py-16 lg:py-20 bg-transparent overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">Simple Pricing</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">$0 Forever</h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Gotcha. TradeScout is for you, for free, forever.
          </p>
          <p className="text-sm text-white/50 max-w-2xl mx-auto mt-3">
            We make money, just not from the person reading this text.
          </p>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <Reveal>
            <div className="bg-white/5 border border-white/10 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-ts-orange" />
                What You Get
              </h3>
              <ul className="space-y-3">
                {features.map((feature, i) => (
                  <li key={i} className="flex gap-3 text-white/80">
                    <CheckCircle className="w-5 h-5 text-ts-orange flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="bg-white/5 border border-white/10 rounded-xl p-8">
              <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Shield className="w-6 h-6 text-ts-orange" />
                How We Keep It $0
              </h3>
              <ul className="space-y-3">
                {sponsorFeatures.map((feature, i) => (
                  <li key={i} className="flex gap-3 text-white/80">
                    <CheckCircle className="w-5 h-5 text-ts-orange flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal className="bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-3">
            Community Builders & Local Reinvestment
          </h3>
          <p className="text-white/70 mb-4">
            10% of all platform profits are allocated to the TradeScout Community Builders fund.
            100% of contributions are returned directly to the communities where they originated.
          </p>
          <p className="text-sm text-white/60">
            Community Builders earn badges that let them send and vote on causes funded from the
            community vault.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── FAQ Section ───
function FAQSection() {
  const faqs = [
    {
      q: "How much does TradeScout cost?",
      a: "Pricing is simple: $0 forever. No credit card. No paywalls. No upsells.",
    },
    {
      q: "How is TradeScout different from Angi or HomeAdvisor?",
      a: "We don't sell leads to the highest bidder. Trust determines ranking, not payment. Contractors cannot pay to appear first. You get 1-3 matches, not 20+ spam calls.",
    },
    {
      q: "What is the Community Verification Score (CVS)?",
      a: "It's a public, auditable score based on verified identity, active credentials, work history, community recommendations, and dispute resolution. You can see exactly why Scout matched you with a contractor.",
    },
    {
      q: "Can contractors pay to boost their ranking?",
      a: "Boosts work WITHIN trust tiers, not across them. A contractor with CVS 40 cannot pay to rank above one with CVS 80. Trust always comes first.",
    },
    {
      q: "How does Direct Connect work?",
      a: "Scout sends your request to 1-3 pre-matched contractors. They review your details and choose to accept or decline before contacting you. No spam, no pressure.",
    },
    {
      q: "What if I don't like the contractors Scout matched me with?",
      a: "You can browse the full contractor directory anytime. Scout's matches are recommendations based on trust and relevance, but you're always in control.",
    },
  ];

  return (
    <section className="relative py-16 lg:py-20 bg-transparent">
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-10">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-white/60">Everything you need to know about TradeScout</p>
        </Reveal>

        <Reveal>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-white/10 rounded-lg px-6 data-[state=open]:bg-white/5"
              >
                <AccordionTrigger className="text-white font-semibold hover:text-ts-orange transition-colors py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-white/70 pb-4">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

// ─── CTA Section ───
function CTASection() {
  return (
    <section id="get-started" className="relative py-16 lg:py-20 bg-transparent overflow-hidden">
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-4 py-2 mb-8">
            <Award className="w-4 h-4 text-ts-orange" />
            <span className="text-sm font-medium text-ts-orange">
              Join the Trust-First Movement
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
            Ready to find a contractor
            <br />
            <span className="text-gradient-orange">you can trust?</span>
          </h2>

          <p className="text-lg text-white/60 mb-7 max-w-xl mx-auto">
            Stop getting spammed by 20 contractors. Start getting matched with 1-3 verified pros who
            are actually right for your project.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://www.thetradescout.com/login" target="_blank" rel="noopener noreferrer">
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white font-bold text-lg px-10 h-14 rounded-lg shadow-xl shadow-ts-orange/25 transition-all hover:shadow-ts-orange/40 hover:scale-[1.02]">
                Get Started
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            <a
              href="https://www.thetradescout.com/contractor-join"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 font-semibold text-lg px-10 h-14 rounded-lg bg-transparent"
              >
                I'm a Contractor
              </Button>
            </a>
          </div>

          <p className="text-xs text-white/30 mt-6">No credit card required.</p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Footer ───
function Footer() {
  return (
    <footer className="bg-transparent border-t border-white/5 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={IMAGES.logo} alt="TradeScout" className="w-10 h-10 rounded-lg" />
              <span className="font-[var(--font-display)] font-bold text-lg text-white">
                Trade<span className="text-ts-orange">Scout</span>
              </span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed max-w-xs">
              Connection Without Compromise. Trust-first contractor matching powered by Scout.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-white/60">
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
            <h4 className="text-sm font-semibold text-white mb-4">For Contractors</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li>
                <a
                  href="https://www.thetradescout.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ts-orange transition-colors"
                >
                  Join TradeScout
                </a>
              </li>
              <li>
                <a
                  href="https://www.thetradescout.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ts-orange transition-colors"
                >
                  Contractor Dashboard
                </a>
              </li>
              <li>
                <a
                  href="https://www.thetradescout.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ts-orange transition-colors"
                >
                  Build Your CVS
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li>
                <button
                  onClick={() => toast({ title: "Coming soon!" })}
                  className="hover:text-ts-orange transition-colors"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  onClick={() => toast({ title: "Coming soon!" })}
                  className="hover:text-ts-orange transition-colors"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => toast({ title: "Coming soon!" })}
                  className="hover:text-ts-orange transition-colors"
                >
                  Contact
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8">
          <p className="text-xs text-white/30 text-center">
            © 2026 TradeScout. All rights reserved. Trust-first contractor matching.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ───
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-transparent text-white">
      <Navbar />
      <main>
        <HeroSection />
        <StatsBar />
        <HowItWorksSection />
        <TrustSection />
        <DirectConnectSection />
        <ContractorsSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
