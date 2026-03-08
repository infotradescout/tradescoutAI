import { CompareCategoryPage, type CompareCategoryConfig } from "./compareCategoryPage";

const config: CompareCategoryConfig = {
  title: "TradeScout vs. Home Services Platforms",
  description:
    "Compare TradeScout to home-services intermediaries like Angi, HomeAdvisor, Thumbtack, Porch, Networx, Houzz, and other contractor lead or directory systems users rely on to find local help.",
  seoTitle: "Find Trusted Local Pros | TradeScout vs. Home Services Platforms",
  seoDescription:
    "See how TradeScout helps users find trusted local pros, compare options, and request help through Scout instead of relying on lead-generation marketplaces and contractor directories.",
  seoKeywords:
    "find trusted contractors, hire local pros, tradescout vs angi, tradescout vs homeadvisor, thumbtack alternative, home services platform alternative",
  canonical: "https://www.thetradescout.com/compare/home-services",
  badgeLabel: "Home Services Comparison",
  categoryName: "Home Services Platforms",
  categorySummary:
    "Home-services platforms often center on contractor discovery, lead flow, listings, quote competition, or early-open contact. The system pressure usually favors more activity before trust is fully established.",
  tradeScoutSummary:
    "TradeScout does not sell leads and does not charge to connect. Scout routes requests using trust, local context, and intent-gated contact so fit matters more than marketplace volume.",
  platforms: [
    {
      name: "Angi",
      model: "Lead marketplace",
      pressure: "Often optimized around quote volume and broad contractor exposure.",
    },
    {
      name: "HomeAdvisor",
      model: "Lead resale network",
      pressure: "Contractor economics depend on paid homeowner requests.",
    },
    {
      name: "Thumbtack",
      model: "Pay-to-compete lead flow",
      pressure: "Providers often compete for attention before trust is clear.",
    },
    {
      name: "Porch",
      model: "Referral and partner lead flow",
      pressure: "Distribution incentives can outweigh local relationship quality.",
    },
    {
      name: "Networx",
      model: "Lead generation marketplace",
      pressure: "Routing often starts with lead delivery instead of trust.",
    },
    {
      name: "Houzz",
      model: "Directory and inspiration layer",
      pressure: "Discovery can start long before governed routing or local fit.",
    },
  ],
  tableRows: [
    {
      feature: "Economic Incentive",
      category: "More homeowner requests and quote activity often increase marketplace value",
      tradeScout: "Better routing and stronger matches matter more than volume",
    },
    {
      feature: "Contact Timing",
      category: "Contact often opens early",
      tradeScout: "Intent-gated until a provider accepts",
      tradeScoutPositive: true,
    },
    {
      feature: "Routing Logic",
      category: "Often broad distribution or quote competition",
      tradeScout: "Scout routes to a smaller trust-qualified set",
      tradeScoutPositive: true,
    },
    {
      feature: "Visibility",
      category: "Can be shaped by marketplace dynamics or paid exposure",
      tradeScout: "CVS and trust signals govern exposure",
      tradeScoutPositive: true,
    },
    {
      feature: "Verification",
      category: "Varies by platform",
      tradeScout: "CVS combines identity, licensing, insurance, work history, and community proof",
    },
    {
      feature: "Main Risk",
      category: "Lead speed can outrun fit and accountability",
      tradeScout: "Friction stays where it protects local decision quality",
      categoryWarning: true,
    },
  ],
  differences: [
    {
      title: "Home services is one spoke, not the whole product",
      desc: "TradeScout can handle contractor discovery, but the platform is larger than a homeowner-contractor marketplace.",
    },
    {
      title: "Scout replaces form-hopping",
      desc: "Users can move from question to routing to decision inside one operating layer instead of jumping across listings and quote forms.",
    },
    {
      title: "Trust governs exposure",
      desc: "Visibility is governed by CVS and local proof rather than being unlocked by marketplace pressure.",
    },
    {
      title: "No lead resale",
      desc: "TradeScout does not sell leads and does not charge to connect, so the system does not need to maximize raw request volume.",
    },
  ],
  faqs: [
    {
      question: "Is TradeScout just another contractor marketplace?",
      answer:
        "No. Home services is one entry point, but TradeScout is the operating system for community interaction across multiple categories.",
    },
    {
      question: "How is TradeScout different from Angi or HomeAdvisor?",
      answer:
        "TradeScout does not sell leads. Scout routes with trust and context, and contact stays gated until there is an accepted match.",
    },
    {
      question: "Does TradeScout still work for hiring local pros?",
      answer:
        "Yes. It supports that path, but without making contractor lead flow the entire product identity.",
    },
    {
      question: "Is TradeScout free to use?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. Unlabeled requests for payment to unlock access or ranking should be treated as a scam.",
    },
  ],
  ctaTitle: "Replace Home Services Lead Flow",
  ctaDescription:
    "Use Scout to move from search to routed action without turning your local decision into a lead-sale event.",
  moreLinks: [
    { href: "/compare", label: "Compare Hub →" },
    { href: "/compare/lead-generation", label: "Lead Generation →" },
    { href: "/compare/real-estate", label: "Real Estate →" },
    { href: "/compare/community", label: "Community Platforms →" },
  ],
};

export default function CompareHomeServicesPage() {
  return <CompareCategoryPage config={config} />;
}
