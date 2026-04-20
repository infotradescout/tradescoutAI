import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Hammer, Heart, Users, Shield, Target, Award, Building, Globe } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { RevenueDisclosureSection } from "@/components/RevenueDisclosureSection";

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

const About = memo(function About() {
  const missionPoints = [
    {
      icon: Hammer,
      title: "Connecting Quality Contractors",
      description:
        "We verify and showcase the best local pros, organizations, and leaders in every community — so residents and partners can find the right people fast.",
    },
    {
      icon: Heart,
      title: "Supporting Communities",
      description:
        "10% of our profits support the Mike Rowe Works Foundation and local community projects.",
    },
    {
      icon: Users,
      title: "Building Trust",
      description:
        "Verification and community feedback help people find reliable local pros with more confidence.",
    },
    {
      icon: Shield,
      title: "Ensuring Quality",
      description:
        "Rigorous verification, insurance requirements, and quality standards protect everyone using TradeScout: residents, contractors, businesses, and community teams.",
    },
  ];

  const stats = [
    {
      number: "3,112",
      label: "Counties Covered",
      description: "Nationwide coverage across all 50 states",
    },
    {
      number: "15,000+",
      label: "Verified Contractors",
      description: "Licensed and insured professionals",
    },
    {
      number: "250,000+",
      label: "Projects Completed",
      description: "Successful home improvements",
    },
    {
      number: "$50M+",
      label: "Community Investment",
      description: "Economic impact in local communities",
    },
  ];

  const timeline = [
    {
      year: "2023",
      title: "Launch",
      description:
        "TradeScout founded with a mission to connect local people, pros, and organizations around real projects and decisions",
    },
    {
      year: "2024",
      title: "National Expansion",
      description: "Expanded to cover all 3,112 counties across the United States",
    },
    {
      year: "2024",
      title: "HOA Partnership",
      description: "Launched comprehensive HOA management and community features",
    },
    {
      year: "2024",
      title: "Foundation Partnership",
      description: "Partnered with Mike Rowe Works Foundation to support skilled trades",
    },
  ];

  const values = [
    {
      icon: Target,
      title: "Quality First",
      description:
        "We prioritize quality contractors and workmanship above all else. Every contractor goes through our rigorous verification process.",
    },
    {
      icon: Users,
      title: "Built Around Local Communities",
      description:
        "Local communities are at the heart of everything we do. We organize by local areas to strengthen connections between neighbors, pros, and community groups.",
    },
    {
      icon: Shield,
      title: "Trust & Transparency",
      description:
        "Open feedback, verified recommendations, and clear pricing help build trust between neighbors and local pros.",
    },
    {
      icon: Heart,
      title: "Giving Back",
      description:
        "We donate 10% of profits to support trade education and community development programs.",
    },
  ];

  return (
    <>
      <SEOHelmet
        title="About TradeScout – The Trusted Local Business Directory"
        description="TradeScout connects residents with trusted local businesses, from restaurants and retail to home services. Learn about our mission, values, and community impact."
        canonical="https://www.thetradescout.com/about"
      />
      <div className="text-white font-body">
        {/* Hero */}
        <section className="relative py-16 md:py-24 bg-transparent overflow-hidden">
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-4"
            >
              <Shield className="w-4 h-4 text-ts-orange" />
              <span className="text-sm font-medium text-ts-orange">About TradeScout</span>
            </motion.div>{" "}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-display text-4xl md:text-6xl font-extrabold text-white leading-tight tracking-tight mb-4"
            >
              Building America's <span className="text-ts-orange">Local Business Future</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed"
            >
              We're on a mission to bring trust, transparency, and quality back to local business
              discovery—from restaurants and retail to home services—while supporting the
              communities we live in.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <a
                href="/register"
                className="inline-flex items-center justify-center bg-ts-orange hover:bg-ts-orange-dark text-white font-bold px-6 h-11 rounded-lg shadow-xl shadow-ts-orange/25 transition-all hover:shadow-ts-orange/40 hover:scale-[1.02]"
              >
                Join Our Mission
              </a>
              <a
                href="/how-it-works"
                className="inline-flex items-center justify-center border border-white/20 text-white hover:bg-white/10 font-semibold px-6 h-11 rounded-lg transition-all"
              >
                Learn More
              </a>
            </motion.div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-16">
          {/* Mission Section */}
          <section>
            <Reveal className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Target className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Our Mission</span>
              </div>
              <h2 className="font-display text-3xl font-extrabold text-white mb-3">Why We Exist</h2>
              <p className="text-white/60 max-w-2xl mx-auto">
                To make it easier for local residents, skilled pros, and community groups to find
                each other, work together, and get real projects done.
              </p>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {missionPoints.map((point, index) => {
                const Icon = point.icon;
                return (
                  <Reveal key={index} delay={index * 0.08}>
                    <motion.div
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="bg-tsCard border border-white/10 rounded-xl p-5 hover:border-ts-orange/30 transition-colors shadow-[0_18px_52px_rgba(0,0,0,0.36)] text-center"
                    >
                      <div className="w-10 h-10 bg-ts-orange/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <Icon className="w-5 h-5 text-ts-orange" />
                      </div>
                      <h3 className="font-semibold text-white mb-2 text-sm">{point.title}</h3>
                      <p className="text-xs text-white/60 leading-relaxed">{point.description}</p>
                    </motion.div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* Stats Section */}
          <section>
            <Reveal className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Award className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Impact</span>
              </div>
              <h2 className="font-display text-3xl font-extrabold text-white mb-3">
                Impact by the Numbers
              </h2>
              <p className="text-white/60">
                See how TradeScout is transforming the home improvement industry
              </p>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <Reveal key={index} delay={index * 0.08}>
                  <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] text-center">
                    <div className="font-display text-3xl font-extrabold text-ts-orange mb-1">
                      {stat.number}
                    </div>
                    <h3 className="font-semibold text-white mb-1 text-sm">{stat.label}</h3>
                    <p className="text-xs text-white/50">{stat.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Values Section */}
          <section>
            <Reveal className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Heart className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Our Values</span>
              </div>
              <h2 className="font-display text-3xl font-extrabold text-white mb-3">
                The Principles That Guide Us
              </h2>
              <p className="text-white/60">The principles that guide everything we do</p>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <Reveal key={index} delay={index * 0.08}>
                    <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] flex gap-4">
                      <div className="w-10 h-10 bg-ts-orange/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-ts-orange" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white mb-1">{value.title}</h3>
                        <p className="text-sm text-white/60 leading-relaxed">{value.description}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          <Reveal>
            <RevenueDisclosureSection />
          </Reveal>

          {/* Timeline Section */}
          <section>
            <Reveal className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-ts-orange/10 border border-ts-orange/30 rounded-full px-3 py-1 mb-3">
                <Building className="w-4 h-4 text-ts-orange" />
                <span className="text-sm font-medium text-ts-orange">Our Story</span>
              </div>
              <h2 className="font-display text-3xl font-extrabold text-white mb-3">
                How We Got Here
              </h2>
            </Reveal>
            <div className="space-y-3">
              {timeline.map((event, index) => (
                <Reveal key={index} delay={index * 0.08}>
                  <div className="bg-tsCard border border-white/10 rounded-xl p-5 shadow-[0_18px_52px_rgba(0,0,0,0.36)] flex gap-4 items-start">
                    <div className="inline-flex items-center justify-center bg-ts-orange/20 border border-ts-orange/30 rounded-full px-3 py-1 text-xs font-bold text-ts-orange flex-shrink-0">
                      {event.year}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{event.title}</h3>
                      <p className="text-sm text-white/60">{event.description}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Foundation Partnership */}
          <Reveal>
            <div className="bg-gradient-to-r from-ts-orange/20 via-ts-orange/10 to-transparent border border-ts-orange/30 rounded-xl p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-ts-orange/20 rounded-lg flex items-center justify-center">
                      <Award className="w-5 h-5 text-ts-orange" />
                    </div>
                    <h2 className="font-display text-2xl font-extrabold text-white">
                      Mike Rowe Works Foundation
                    </h2>
                  </div>
                  <p className="text-white/70 mb-5 text-sm leading-relaxed">
                    We're proud to partner with the Mike Rowe Works Foundation, donating 10% of our
                    profits to support skilled trades education and workforce development. This
                    partnership helps ensure the next generation of skilled workers has the tools
                    and training they need to succeed.
                  </p>
                  <a
                    href="/scout"
                    className="inline-flex items-center justify-center bg-ts-orange hover:bg-ts-orange-dark text-white font-bold px-5 h-10 rounded-lg shadow-lg shadow-ts-orange/25 transition-all hover:scale-[1.02] text-sm"
                  >
                    Learn About Our Partnership
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Building, label: "Trade Schools", sub: "Supported nationwide" },
                    { icon: Users, label: "Students", sub: "Scholarships provided" },
                    { icon: Globe, label: "Communities", sub: "Local programs funded" },
                    { icon: Heart, label: "Impact", sub: "Lives changed" },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={i}
                        className="bg-tsCard border border-white/10 rounded-xl p-4 text-center"
                      >
                        <Icon className="w-6 h-6 text-ts-orange mx-auto mb-2" />
                        <p className="font-semibold text-white text-sm">{item.label}</p>
                        <p className="text-xs text-white/50">{item.sub}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Call to Action */}
          <Reveal>
            <div className="bg-tsCard border border-white/10 rounded-xl p-8 shadow-[0_18px_52px_rgba(0,0,0,0.36)] text-center">
              <h2 className="font-display text-3xl font-extrabold text-white mb-3">
                Join the TradeScout Community
              </h2>
              <p className="text-white/60 mb-6 max-w-xl mx-auto">
                Whether you're a resident, contractor, local business, organizer, or civic leader,
                TradeScout is here to help you and your community succeed.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="/register"
                  className="inline-flex items-center justify-center bg-ts-orange hover:bg-ts-orange-dark text-white font-bold px-6 h-11 rounded-lg shadow-xl shadow-ts-orange/25 transition-all hover:scale-[1.02]"
                >
                  Find Contractors
                </a>
                <a
                  href="/register"
                  className="inline-flex items-center justify-center border border-white/20 text-white hover:bg-white/10 font-semibold px-6 h-11 rounded-lg transition-all"
                >
                  Become a Contractor
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
});

export default About;
