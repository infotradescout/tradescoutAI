import { CompareCategoryPage, type CompareCategoryConfig } from "./compareCategoryPage";

const config: CompareCategoryConfig = {
  title: "TradeScout vs. Real Estate Platforms",
  description:
    "Compare TradeScout to real-estate listing and discovery platforms like Zillow, Realtor.com, Redfin, Trulia, and Homes.com for people browsing homes, listing property, and making local housing decisions.",
  seoTitle: "Browse Homes and List Property | TradeScout vs. Real Estate Platforms",
  seoDescription:
    "See how TradeScout helps users browse homes, list property, and manage local housing decisions with Scout, trust, and community context instead of listing-only discovery.",
  seoKeywords:
    "browse homes on tradescout, list property on tradescout, tradescout vs zillow, tradescout vs realtor.com, redfin alternative, real estate platform alternative",
  canonical: "https://www.thetradescout.com/compare/real-estate",
  badgeLabel: "Real Estate Comparison",
  categoryName: "Real Estate Platforms",
  categorySummary:
    "Real-estate platforms are strong at listings, browsing, and market discovery, but they are not built to carry trust and follow-through beyond the listing itself.",
  tradeScoutSummary:
    "TradeScout treats real estate as one part of a bigger local product. Scout carries CVS, context, and next steps across discovery, verification, and decision-making.",
  platforms: [
    {
      name: "Zillow",
      model: "Listing and discovery platform",
      pressure: "Strong awareness and browsing, but action usually leaves the system quickly.",
    },
    {
      name: "Realtor.com",
      model: "Listing network",
      pressure:
        "Optimized for property discovery and lead handoff, not the full local decision flow.",
    },
    {
      name: "Redfin",
      model: "Brokerage plus discovery",
      pressure: "Great transaction tooling, but narrower than a full local workflow.",
    },
    {
      name: "Trulia",
      model: "Search and neighborhood browse layer",
      pressure: "Awareness-heavy discovery without helping much with the full action path.",
    },
    {
      name: "Homes.com",
      model: "Listing and search surface",
      pressure:
        "Supports real-estate discovery, but not broader community context or cross-category interaction.",
    },
    {
      name: "Portal-style real-estate sites",
      model: "Search marketplace",
      pressure: "Discovery is strong, but trust and ongoing local coordination stay fragmented.",
    },
  ],
  tableRows: [
    {
      feature: "Primary Strength",
      category: "Listings, search, browse, and market awareness",
      tradeScout: "Discovery plus clear local action across categories",
    },
    {
      feature: "System Scope",
      category: "Real-estate specific",
      tradeScout: "Real estate connected to the rest of the product",
      tradeScoutPositive: true,
    },
    {
      feature: "Action Model",
      category: "Often hands off to agents, forms, or external workflows",
      tradeScout: "Scout remains the bridge from discovery to action",
      tradeScoutPositive: true,
    },
    {
      feature: "Trust Layer",
      category: "Reviews, agent branding, and platform context vary",
      tradeScout: "CVS, verification, and local context are easy to see",
    },
    {
      feature: "Community Context",
      category: "Usually secondary to listings",
      tradeScout: "Community memory and local context remain central",
      tradeScoutPositive: true,
    },
    {
      feature: "Main Risk",
      category: "High awareness without enough help on what happens next",
      tradeScout: "TradeScout keeps discovery tied to the next local step",
      categoryWarning: true,
    },
  ],
  differences: [
    {
      title: "Real estate is not isolated",
      desc: "TradeScout connects real-estate activity to the wider local context instead of trapping it inside listing search alone.",
    },
    {
      title: "Scout keeps the next step clear",
      desc: "Users do not have to leave one platform to get from awareness to action.",
    },
    {
      title: "Local context stays attached",
      desc: "Markets, communities, and trusted operators remain part of the process instead of acting like optional metadata.",
    },
    {
      title: "Cross-category continuity",
      desc: "The same system can support homes, services, neighborhood context, and local relationships without restarting the user journey.",
    },
  ],
  faqs: [
    {
      question: "Is TradeScout trying to be another Zillow?",
      answer:
        "No. Zillow and similar platforms are strong discovery products. TradeScout focuses on what happens after discovery, with trusted next steps and local context built in.",
    },
    {
      question: "Why compare TradeScout to Realtor.com or Redfin?",
      answer:
        "Because people use those systems to navigate local decisions, but they do not cover the full community interaction model TradeScout is built for.",
    },
    {
      question: "Does TradeScout still support real-estate flows?",
      answer:
        "Yes. It supports them as part of the broader product instead of treating real estate as a silo.",
    },
    {
      question: "How does monetization differ?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. CVS and matching stay separate from paid visibility.",
    },
  ],
  ctaTitle: "Replace Listing-Only Local Discovery",
  ctaDescription: "Use one local platform that handles discovery and trusted action together.",
  moreLinks: [
    { href: "/compare", label: "Compare Hub →" },
    { href: "/compare/community", label: "Community Platforms →" },
    { href: "/compare/local-business", label: "Local Business →" },
    { href: "/compare/home-services", label: "Home Services →" },
  ],
};

export default function CompareRealEstatePage() {
  return <CompareCategoryPage config={config} />;
}
