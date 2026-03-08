import { CompareCategoryPage, type CompareCategoryConfig } from "./compareCategoryPage";

const config: CompareCategoryConfig = {
  title: "TradeScout vs. Local Coordination Tools",
  description:
    "Compare TradeScout to local task boards, gig platforms, coordination threads, and scheduling tools that help transactions but do not act like community operating systems.",
  seoTitle: "TradeScout vs. Local Coordination Tools | TradeScout",
  seoDescription:
    "Compare TradeScout to Taskrabbit, Craigslist services, gig boards, and local coordination tools. See how Scout differs from transaction-first coordination layers.",
  seoKeywords:
    "tradescout vs taskrabbit, craigslist services alternative, local coordination platform alternative, gig board alternative",
  canonical: "https://www.thetradescout.com/compare/coordination",
  badgeLabel: "Coordination Comparison",
  categoryName: "Local Coordination Tools",
  categorySummary:
    "Coordination tools can help people post jobs, schedule work, or find a fast responder, but they usually optimize around transaction speed instead of trust-governed community interaction.",
  tradeScoutSummary:
    "TradeScout coordinates action through Scout, CVS, local context, and authority-first routing. That keeps transactions inside a system of trust instead of treating them like isolated gigs.",
  platforms: [
    {
      name: "Taskrabbit",
      model: "Task marketplace",
      pressure: "Fast transaction utility, but narrower community memory and authority.",
    },
    {
      name: "Craigslist services",
      model: "Classified coordination",
      pressure: "Low-friction awareness with uneven trust.",
    },
    {
      name: "Gig boards",
      model: "Job and task posting",
      pressure: "Speed and availability often outrun local proof.",
    },
    {
      name: "Scheduling tools",
      model: "Coordination utility",
      pressure: "Good for managing appointments, not for governing trust.",
    },
    {
      name: "Referral threads",
      model: "Informal local coordination",
      pressure: "Useful social signals, but little operating structure.",
    },
    {
      name: "Booking-first tools",
      model: "Availability surface",
      pressure: "Action is easy, but authority and community context remain thin.",
    },
  ],
  tableRows: [
    {
      feature: "Primary Pattern",
      category: "Fast task coordination or booking",
      tradeScout: "Coordinated action inside a trust-governed operating layer",
    },
    {
      feature: "Trust Model",
      category: "Varies by ratings, thread history, or platform rules",
      tradeScout: "CVS, authority rules, and local proof remain explicit",
      tradeScoutPositive: true,
    },
    {
      feature: "Scope",
      category: "Task or booking specific",
      tradeScout: "Coordination lives inside a broader community system",
      tradeScoutPositive: true,
    },
    {
      feature: "Action Layer",
      category: "Optimized for getting a task moving quickly",
      tradeScout: "Optimized for trusted outcomes and context-aware routing",
    },
    {
      feature: "Community Memory",
      category: "Usually fragmented",
      tradeScout: "Communities retain memory rather than acting like disposable threads",
      tradeScoutPositive: true,
    },
    {
      feature: "Main Risk",
      category: "Speed can outrun accountability",
      tradeScout: "TradeScout keeps friction where it protects the decision",
      categoryWarning: true,
    },
  ],
  differences: [
    {
      title: "Not just a gig layer",
      desc: "TradeScout can coordinate local work without collapsing into a generic task marketplace.",
    },
    {
      title: "Context stays attached",
      desc: "Scout carries local and trust context through the interaction instead of resetting every time a new task starts.",
    },
    {
      title: "Authority scales across categories",
      desc: "The same operating system can coordinate service, business, neighborhood, and local decision flows.",
    },
    {
      title: "Outcome over speed",
      desc: "TradeScout is designed to prevent low-trust, high-speed interactions from becoming the default.",
    },
  ],
  faqs: [
    {
      question: "Is TradeScout another Taskrabbit?",
      answer:
        "No. It can coordinate local action, but it is not a narrow gig marketplace. It is the local operating system for community interaction.",
    },
    {
      question: "Why compare TradeScout to Craigslist services?",
      answer:
        "Because both can route people toward local help, but only one is designed around trust, authority, and community continuity.",
    },
    {
      question: "Can TradeScout still help people get something done quickly?",
      answer:
        "Yes, but it does not sacrifice trust and local decision quality just to remove friction.",
    },
    {
      question: "What about monetization?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. Paid shortcuts do not override trust.",
    },
  ],
  ctaTitle: "Replace Transaction-Only Coordination",
  ctaDescription:
    "Coordinate local action inside a trust-governed system, not a disposable task board.",
  moreLinks: [
    { href: "/compare", label: "Compare Hub →" },
    { href: "/compare/community", label: "Community Platforms →" },
    { href: "/compare/home-services", label: "Home Services →" },
    { href: "/compare/local-business", label: "Local Business →" },
  ],
};

export default function CompareCoordinationPage() {
  return <CompareCategoryPage config={config} />;
}
