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
    "Home-services platforms often center on listings, quote volume, and early contact. That usually means more noise before you know who is actually solid.",
  tradeScoutSummary:
    "TradeScout does not sell leads and does not charge to connect. It helps you see stronger local options first, then talk to a pro after acceptance instead of getting flooded.",
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
      pressure: "People can browse for a long time before they know who is actually a good hire.",
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
      tradeScout: "Contact opens after a pro accepts",
      tradeScoutPositive: true,
    },
    {
      feature: "Routing Logic",
      category: "Often broad distribution or quote competition",
      tradeScout: "A smaller set of local pros who actually fit the job",
      tradeScoutPositive: true,
    },
    {
      feature: "Visibility",
      category: "Can be shaped by marketplace dynamics or paid exposure",
      tradeScout: "CVS helps shape who appears first",
      tradeScoutPositive: true,
    },
    {
      feature: "Verification",
      category: "Varies by platform",
      tradeScout: "Verified identity, credentials, work history, and community feedback",
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
      desc: "Users can move from question to shortlist in one place instead of bouncing between listings and quote forms.",
    },
    {
      title: "Trust shapes who you see",
      desc: "CVS helps move stronger providers up based on verified identity, license, insurance, work history, and recommendations.",
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
        "No. Home services is one entry point, but TradeScout spans more than contractor discovery alone.",
    },
    {
      question: "How is TradeScout different from Angi or HomeAdvisor?",
      answer:
        "TradeScout does not sell leads. It shows you who looks strongest, keeps contact closed until a pro accepts, and cuts down on random outreach.",
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
    "Use Scout to move from search to a better shortlist without turning your local decision into a lead-sale event.",
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
