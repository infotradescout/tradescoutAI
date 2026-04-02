import { CompareCategoryPage, type CompareCategoryConfig } from "./compareCategoryPage";

const config: CompareCategoryConfig = {
  title: "TradeScout vs. Local Business Discovery Platforms",
  description:
    "Compare TradeScout to local business discovery and review surfaces like Yelp, Google Business Profiles, and directory-style local search products people use to find nearby businesses.",
  seoTitle: "Find Local Businesses | TradeScout vs. Discovery Platforms",
  seoDescription:
    "See how TradeScout helps users find local businesses, compare options, and take the next step through Scout instead of stopping at recommendations, directories, and map listings.",
  seoKeywords:
    "find local businesses, local business platform, tradescout vs yelp, google business profile alternative, local directory alternative",
  canonical: "https://www.thetradescout.com/compare/local-business",
  badgeLabel: "Local Business Comparison",
  categoryName: "Local Business Discovery Platforms",
  categorySummary:
    "Discovery and recommendation platforms help users find businesses, but they usually stop at awareness, recommendations, and basic contact.",
  tradeScoutSummary:
    "TradeScout turns local discovery into something more useful. Businesses do not just get seen; users can compare CVS, recommendations, and next steps in one place.",
  platforms: [
    {
      name: "Yelp",
      model: "Review and discovery platform",
      pressure: "Strong awareness and recommendations, but limited follow-through.",
    },
    {
      name: "Google Business Profiles",
      model: "Search discovery surface",
      pressure: "Very high visibility, but action quality varies outside the platform.",
    },
    {
      name: "Yellow Pages-style directories",
      model: "Local listing directory",
      pressure: "Useful for lookup, not for helping people through the full decision.",
    },
    {
      name: "Local business apps",
      model: "Directory or map browse layer",
      pressure: "Good at visibility, weak at helping people move to the next step.",
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
      category: "Discovery, recommendations, and lookup",
      tradeScout: "Discovery plus clear next steps",
    },
    {
      feature: "Business Exposure",
      category: "Often driven by search, recommendations, and listing presence",
      tradeScout: "Exposure stays tied to CVS and business quality",
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
      tradeScout: "CVS and local proof are easy to see",
      tradeScoutPositive: true,
    },
    {
      feature: "Scope",
      category: "Business discovery only",
      tradeScout: "Business discovery connected to the rest of the local workflow",
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
      desc: "TradeScout connects business visibility to CVS, recommendations, and local proof instead of leaving them as separate layers.",
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
        "No. Yelp is primarily a discovery and recommendation layer. TradeScout is built to help people move from discovery to the next step.",
    },
    {
      question: "Why compare TradeScout to Google Business Profiles?",
      answer:
        "Because many local journeys begin in search visibility, but those systems do not help much once someone is trying to decide who to trust.",
    },
    {
      question: "Can TradeScout still help local businesses get found?",
      answer:
        "Yes, but visibility is tied to CVS, recommendations, and business quality rather than being treated as the whole product.",
    },
    {
      question: "How does payment work?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. Payment never overrides CVS or ranking.",
    },
  ],
  ctaTitle: "Replace Discovery-Only Local Search",
  ctaDescription: "Use a platform that helps local discovery turn into a real decision.",
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
