import { CompareCategoryPage, type CompareCategoryConfig } from "./compareCategoryPage";

const config: CompareCategoryConfig = {
  title: "TradeScout vs. Community Platforms",
  description:
    "Compare TradeScout to neighborhood feeds, community groups, and social discussion platforms like Nextdoor, Facebook Groups, and similar tools people use to stay connected locally.",
  seoTitle: "Stay Connected Locally | TradeScout vs. Community Platforms",
  seoDescription:
    "See how TradeScout helps users stay connected locally, ask questions, follow neighborhood activity, and move from conversation to action without relying on feed-only community apps.",
  seoKeywords:
    "local community platform, stay connected locally, ask neighbors online, tradescout vs nextdoor, nextdoor alternative, facebook groups alternative",
  canonical: "https://www.thetradescout.com/compare/community",
  badgeLabel: "Community Comparison",
  categoryName: "Community Platforms",
  categorySummary:
    "Community platforms are good at conversation and awareness, but they usually behave like feeds. Visibility, contact, and action are driven by posting patterns more than authority, trust, or governed local routing.",
  tradeScoutSummary:
    "TradeScout keeps community memory, local authority, and action pathways structured. Scout is the bridge from discovery to action, not just another chat or feed layer.",
  platforms: [
    {
      name: "Nextdoor",
      model: "Neighborhood feed",
      pressure: "Optimized for posting and local conversation, not governed action.",
    },
    {
      name: "Facebook Groups",
      model: "Social group layer",
      pressure: "Conversation happens, but trust and authority vary widely by group.",
    },
    {
      name: "Discord servers",
      model: "Community chat space",
      pressure: "Coordination is possible, but local authority is usually informal.",
    },
    {
      name: "Neighborhood apps",
      model: "Community awareness layer",
      pressure: "Great for updates, weaker for trusted operational flows.",
    },
    {
      name: "Forum-style local communities",
      model: "Discussion board",
      pressure: "Knowledge persists, but decision pathways are rarely governed.",
    },
    {
      name: "Message-first community tools",
      model: "Conversation utility",
      pressure: "Talk is easy; accountable action is harder to enforce.",
    },
  ],
  tableRows: [
    {
      feature: "Primary Pattern",
      category: "Posts, threads, and replies",
      tradeScout: "Community memory plus routed actions",
    },
    {
      feature: "Authority Model",
      category: "Often informal or moderator-driven",
      tradeScout: "Authority is explicit and system-governed",
      tradeScoutPositive: true,
    },
    {
      feature: "Discovery To Action",
      category: "Usually leaves the platform quickly",
      tradeScout: "Scout keeps discovery tied to next steps",
      tradeScoutPositive: true,
    },
    {
      feature: "Trust Signals",
      category: "Often social and uneven",
      tradeScout: "Verification, CVS, and local proof are explicit",
    },
    {
      feature: "Contact",
      category: "Often immediate or uncontrolled",
      tradeScout: "Contact remains governed by context and acceptance",
      tradeScoutPositive: true,
    },
    {
      feature: "Main Risk",
      category: "Visibility and influence can drift into feed dynamics",
      tradeScout: "TradeScout is designed around authority, not feed popularity",
      categoryWarning: true,
    },
  ],
  differences: [
    {
      title: "Communities keep memory",
      desc: "TradeScout is built for communities that retain memory and structured local context, not endless feed churn.",
    },
    {
      title: "Action is governed",
      desc: "Users can go from a local question to a local action without leaving trust behind.",
    },
    {
      title: "Authority stays explicit",
      desc: "Awareness does not silently become access or influence.",
    },
    {
      title: "Scout replaces feed confusion",
      desc: "Scout can surface next steps directly instead of forcing users to infer what to do from comment threads.",
    },
  ],
  faqs: [
    {
      question: "Is TradeScout trying to replace Nextdoor?",
      answer:
        "TradeScout serves a different role. It is not just a neighborhood feed; it is built to connect local conversation to trusted action.",
    },
    {
      question: "Why compare TradeScout to Facebook Groups?",
      answer:
        "Because many local communities try to coordinate through group threads even though authority, trust, and next steps are not governed.",
    },
    {
      question: "Can TradeScout still support community conversation?",
      answer:
        "Yes, but conversation is connected to authority, trust, and action instead of existing as an isolated feed.",
    },
    {
      question: "What keeps the system honest?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. Trust and authority remain public system rules rather than monetized shortcuts.",
    },
  ],
  ctaTitle: "Replace Feed-Only Community Tools",
  ctaDescription: "Move from neighborhood chatter to a platform built for trusted local action.",
  moreLinks: [
    { href: "/compare", label: "Compare Hub →" },
    { href: "/compare/real-estate", label: "Real Estate →" },
    { href: "/compare/local-business", label: "Local Business →" },
    { href: "/compare/coordination", label: "Coordination →" },
  ],
};

export default function CompareCommunityPage() {
  return <CompareCategoryPage config={config} />;
}
