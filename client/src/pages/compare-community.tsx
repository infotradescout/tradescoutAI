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
    "Community platforms are good at conversation and awareness, but they usually behave like feeds. What people see next often depends more on posting momentum than on trust or clear next steps.",
  tradeScoutSummary:
    "TradeScout keeps local conversation tied to real next steps. Scout helps people move from a question or recommendation to actual action instead of getting stuck in a feed.",
  platforms: [
    {
      name: "Nextdoor",
      model: "Neighborhood feed",
      pressure: "Optimized for posting and local conversation, not clear follow-through.",
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
      pressure: "Great for updates, weaker for trusted follow-through.",
    },
    {
      name: "Forum-style local communities",
      model: "Discussion board",
      pressure: "Knowledge persists, but next steps are usually loose and informal.",
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
      tradeScout: "Community memory plus clear next steps",
    },
    {
      feature: "Authority Model",
      category: "Often informal or moderator-driven",
      tradeScout: "Who can do what is clear",
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
      tradeScout: "Verification, CVS, and local proof are easy to see",
    },
    {
      feature: "Contact",
      category: "Often immediate or uncontrolled",
      tradeScout: "Contact stays tighter and opens after acceptance",
      tradeScoutPositive: true,
    },
    {
      feature: "Main Risk",
      category: "Visibility and influence can drift into feed dynamics",
      tradeScout: "TradeScout is designed around trusted outcomes, not feed popularity",
      categoryWarning: true,
    },
  ],
  differences: [
    {
      title: "Communities keep memory",
      desc: "TradeScout is built for communities that remember what happened and help people move forward, not endless feed churn.",
    },
    {
      title: "Action stays organized",
      desc: "Users can go from a local question to a real next step without losing trust or context.",
    },
    {
      title: "Who can act stays clear",
      desc: "Seeing something does not automatically open contact or give someone more influence.",
    },
    {
      title: "Scout replaces feed confusion",
      desc: "Scout can show the next step directly instead of making people guess from comment threads.",
    },
  ],
  faqs: [
    {
      question: "Is TradeScout trying to replace Nextdoor?",
      answer:
        "TradeScout serves a different role. It is not just a neighborhood feed; it is built to connect local conversation to real action.",
    },
    {
      question: "Why compare TradeScout to Facebook Groups?",
      answer:
        "Because many local communities try to coordinate through group threads even though trust is unclear and next steps get messy fast.",
    },
    {
      question: "Can TradeScout still support community conversation?",
      answer:
        "Yes, but conversation is connected to trust, recommendations, and action instead of existing as an isolated feed.",
    },
    {
      question: "What keeps the system honest?",
      answer:
        "TradeScout does not sell leads and does not charge to connect. Payment does not buy better placement or shortcut the system.",
    },
  ],
  ctaTitle: "Replace Feed-Only Community Tools",
  ctaDescription:
    "Move from neighborhood chatter to a platform that helps people actually get things done.",
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
