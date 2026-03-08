import { CompareCategoryPage, type CompareCategoryConfig } from "./compareCategoryPage";

const config: CompareCategoryConfig = {
  title: "TradeScout vs. Local Business Discovery Platforms",
  description:
    "Compare TradeScout to local business discovery and review surfaces like Yelp, Google Business Profiles, and directory-style local search products people use to find nearby businesses.",
  seoTitle: "Find Local Businesses | TradeScout vs. Discovery Platforms",
  seoDescription:
    "See how TradeScout helps users find local businesses, compare options, and take the next step through Scout instead of stopping at reviews, directories, and map listings.",
  seoKeywords:
    "find local businesses, local business platform, tradescout vs yelp, google business profile alternative, local directory alternative",
  canonical: "https://www.thetradescout.com/compare/local-business",
  badgeLabel: "Local Business Comparison",
  categoryName: "Local Business Discovery Platforms",
  categorySummary:
    "Discovery and review platforms help users find businesses, but they usually stop at awareness, reviews, and basic contact. They are not full local operating systems.",
  tradeScoutSummary:
    "TradeScout turns local discovery into governed local action. Businesses do not just get seen; their exposure, trust, and action paths stay connected to system rules and local outcomes.",
  platforms: [
    {
      name: "Yelp",
      model: "Review and discovery platform",
      pressure: "Strong awareness and reviews, but limited governed follow-through.",
    },
    {
      name: "Google Business Profiles",
      model: "Search discovery surface",
      pressure: "Very high visibility, but action quality varies outside the platform.",
    },
    {
      name: "Yellow Pages-style directories",
      model: "Local listing directory",
      pressure: "Useful for lookup, not for trust-governed operating flow.",
    },
    {
      name: "Local business apps",
      model: "Directory or map browse layer",
      pressure: "Good at visibility, weak at authority-first coordination.",
    },
    {
      name: "Marketplace directories",
      model: "Discovery plus contact utility",
      pressure: "Awareness often outpaces meaningful qualification.",
    },
    {
      name: "Review-first platforms",
      model: "Reputation surface",
      pressure: "Perception is visible, but next-step governance is thin.",
    },
  ],
  tableRows: [
    {
      feature: "Primary Value",
      category: "Discovery, reviews, and lookup",
      tradeScout: "Discovery plus trust-governed local action",
    },
    {
      feature: "Business Exposure",
      category: "Often driven by search, reviews, and listing presence",
      tradeScout: "Exposure remains accountable to trust and system rules",
      tradeScoutPositive: true,
    },
    {
      feature: "User Journey",
      category: "Awareness first, then external follow-up",
      tradeScout: "Scout guides users from awareness to decision",
      tradeScoutPositive: true,
    },
    {
      feature: "Trust Model",
      category: "Review quality and platform norms vary",
      tradeScout: "CVS and local proof stay explicit",
      tradeScoutPositive: true,
    },
    {
      feature: "Scope",
      category: "Business discovery only",
      tradeScout: "Local business discovery inside a larger community operating system",
    },
    {
      feature: "Main Risk",
      category: "Visibility can become the product instead of trustworthy outcomes",
      tradeScout: "TradeScout is designed for trusted action, not just clicks",
      categoryWarning: true,
    },
  ],
  differences: [
    {
      title: "Discovery is not enough",
      desc: "TradeScout does more than help people find local options. It structures what happens after finding them.",
    },
    {
      title: "Businesses operate inside community trust",
      desc: "TradeScout connects business visibility to community trust and local proof instead of leaving them as separate layers.",
    },
    {
      title: "Scout compresses the path",
      desc: "Users can ask, evaluate, and move toward action in one system.",
    },
    {
      title: "No lead-sale distortion",
      desc: "TradeScout does not sell leads and does not charge to connect, so discovery does not get twisted into a monetized handoff.",
    },
  ],
  faqs: [
    {
      question: "Is TradeScout another Yelp?",
      answer:
        "No. Yelp is primarily a discovery and review layer. TradeScout is the local operating system for community interaction.",
    },
    {
      question: "Why compare TradeScout to Google Business Profiles?",
      answer:
        "Because many local journeys begin in search visibility, but those systems do not govern the full trust and action path.",
    },
    {
      question: "Can TradeScout still help local businesses get found?",
      answer:
        "Yes, but visibility is tied to system trust and operating logic rather than being treated as the whole product.",
    },
    {
      question: "How does payment work?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. Payment never overrides CVS, ranking, or trust.",
    },
  ],
  ctaTitle: "Replace Discovery-Only Local Search",
  ctaDescription: "Use a platform that can govern what local discovery turns into.",
  moreLinks: [
    { href: "/compare", label: "Compare Hub →" },
    { href: "/compare/community", label: "Community Platforms →" },
    { href: "/compare/real-estate", label: "Real Estate →" },
    { href: "/compare/coordination", label: "Coordination →" },
  ],
};

export default function CompareLocalBusinessPage() {
  return <CompareCategoryPage config={config} />;
}
