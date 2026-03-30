import { CompareCategoryPage, type CompareCategoryConfig } from "./compareCategoryPage";

const config: CompareCategoryConfig = {
  title: "TradeScout vs. Local Coordination Tools",
  description:
    "Compare TradeScout to local task boards, gig platforms, coordination threads, and scheduling tools people use to book help and get local tasks moving.",
  seoTitle: "Coordinate Local Help | TradeScout vs. Local Coordination Tools",
  seoDescription:
    "See how TradeScout helps users coordinate local help, book next steps, and move from question to action through Scout instead of relying on gig boards and task threads.",
  seoKeywords:
    "coordinate local help, book local services, tradescout vs taskrabbit, craigslist services alternative, local coordination platform alternative",
  canonical: "https://www.thetradescout.com/compare/coordination",
  badgeLabel: "Coordination Comparison",
  categoryName: "Local Coordination Tools",
  categorySummary:
    "Coordination tools can help people post jobs, schedule work, or find a fast responder, but they usually optimize around speed instead of trust and follow-through.",
  tradeScoutSummary:
    "TradeScout coordinates action through Scout, CVS, and local context. That keeps the process inside one trusted system instead of treating it like a one-off gig.",
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
      pressure: "Good for managing appointments, not for helping people judge trust.",
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
      tradeScout: "Coordinated action inside one trusted local system",
    },
    {
      feature: "Trust Model",
      category: "Varies by ratings, thread history, or platform rules",
      tradeScout: "CVS and local proof are easy to see",
      tradeScoutPositive: true,
    },
    {
      feature: "Scope",
      category: "Task or booking specific",
      tradeScout: "Coordination lives inside a broader local system",
      tradeScoutPositive: true,
    },
    {
      feature: "Action Layer",
      category: "Optimized for getting a task moving quickly",
      tradeScout: "Optimized for stronger outcomes and smarter matching",
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
      desc: "Scout carries local context and trust signals through the interaction instead of resetting every time a new task starts.",
    },
    {
      title: "One system across categories",
      desc: "The same system can coordinate service, business, neighborhood, and local decisions.",
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
        "No. It can coordinate local action, but it is not a narrow gig marketplace. It is built for trusted local coordination across categories.",
    },
    {
      question: "Why compare TradeScout to Craigslist services?",
      answer:
        "Because both can point people toward local help, but only one is designed around trust, CVS, and community continuity.",
    },
    {
      question: "Can TradeScout still help people get something done quickly?",
      answer:
        "Yes, but it does not sacrifice trust and local decision quality just to remove friction.",
    },
    {
      question: "What about monetization?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. Paid shortcuts do not override CVS.",
    },
  ],
  ctaTitle: "Replace Transaction-Only Coordination",
  ctaDescription: "Coordinate local action inside a trusted system, not a disposable task board.",
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
