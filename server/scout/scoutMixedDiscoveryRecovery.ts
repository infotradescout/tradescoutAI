import { buildCommunityPostPath } from "../../shared/communityPostShare";
import { sanitizePublicDiscoveryText } from "../../shared/publicListingSafety";
import {
  buildScoutDealPath,
  isEligibleScoutDeal,
  type ScoutDealCandidate,
} from "./scoutDealDiscovery";

type CountyPost = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  createdAt?: unknown;
  hasWorkRequest?: unknown;
};

type PublicCountyBusiness = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  counties?: unknown;
  topicMatchSource?: unknown;
};

type PublicCountyTool = {
  id?: unknown;
  title?: unknown;
  detailPath?: unknown;
  countyFips?: unknown;
  topicMatchSource?: "title" | "description";
};

type PublicCountyPage = {
  id?: unknown;
  slug?: unknown;
  displayName?: unknown;
  businessName?: unknown;
  countyFips?: unknown;
  detailPath?: unknown;
};

function businessTopicMatchSource(
  business: PublicCountyBusiness,
  topicKey: string | null
): "name" | "category" | "service" | null {
  if (!topicKey) return null;
  if (String(business.name || "").toLowerCase().includes(topicKey)) return "name";
  return business.topicMatchSource === "name" ||
    business.topicMatchSource === "category" ||
    business.topicMatchSource === "service"
    ? business.topicMatchSource
    : null;
}

function displayArea(countyLabel: string | undefined): string {
  const value = String(countyLabel || "").trim();
  return /^[a-z .'-]+, [a-z]{2}$/i.test(value) && value.length <= 80 ? value : "your county";
}

function normalizeDiscoveryTopic(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const topic = value.replace(/\s+/g, " ").trim();
  if (
    topic.length < 2 ||
    topic.length > 60 ||
    topic.split(" ").length > 6 ||
    !/^[\p{L}\p{N}][\p{L}\p{N} &'\/-]*$/u.test(topic)
  ) {
    return null;
  }
  const generic = new Set([
    "a", "activity", "all", "and", "any", "anything", "business", "businesses",
    "county", "deal", "deals", "help", "in", "latest", "local", "me", "my",
    "near", "nearby", "page", "pages", "post", "posts", "recent", "request",
    "requests", "result", "results", "site", "the", "this", "tool", "tools",
    "tradescout", "week", "work",
  ]);
  return topic.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((word) => word && !generic.has(word))
    ? topic
    : null;
}

/** Keep broad county browsing broad. Only a clearly stated subject earns a topic match claim. */
export function extractScoutMixedDiscoveryTopic(message: string): string | null {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  const patterns = [
    /\bposts?\s*(?:&|and)\s*deals?\s+about\s+(.+?)(?=\s+(?:in|near|around)\b|[.,;!?]|$)/i,
    /\bposts?\s*(?:&|and)\s*deals?\s+for\s+(.+?)(?=\s+(?:in|near|around)\b|[.,;!?]|$)/i,
    /\b(?:find|search|show)\s+local\s+(.+?)\s+posts?\s*(?:&|and)\s*deals?\b(?=\s+(?:in|near|around)\b|[.,;!?]|$)/i,
    /\bfor\s+(.+?)\s+posts?\s*(?:&|and)\s*deals?\b/i,
  ];
  for (const pattern of patterns) {
    const topic = normalizeDiscoveryTopic(text.match(pattern)?.[1]);
    if (topic) return topic;
  }
  return null;
}

export function buildScoutMixedDiscoveryRecovery(input: {
  countyFips?: string | null;
  countyLabel?: string;
  topic?: string | null;
  communityPosts?: CountyPost[];
  postCheck?: "not_checked" | "checked" | "error";
  deals?: ScoutDealCandidate[];
  dealCheck?: "not_checked" | "checked" | "error";
  businesses?: PublicCountyBusiness[];
  businessCheck?: "not_checked" | "checked" | "error";
  tools?: PublicCountyTool[];
  toolCheck?: "not_checked" | "checked" | "error";
  pages?: PublicCountyPage[];
  pageCheck?: "not_checked" | "checked" | "error";
  now?: Date;
}) {
  if (!input.countyFips) {
    return {
      message:
        "Set your county to browse nearby posts. This Scout result does not verify county posts, deals, businesses, pages, tools, or requests. Nothing was sent.",
      entities: [],
      actions: [{ type: "NAVIGATE", label: "Set my local area", to: "/settings", primary: true }],
    };
  }

  const now = input.now ?? new Date();
  const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const area = displayArea(input.countyLabel);
  const topic = normalizeDiscoveryTopic(input.topic);
  const topicKey = topic?.toLowerCase() ?? null;
  const postCheck =
    input.postCheck ?? ((input.communityPosts?.length ?? 0) > 0 ? "checked" : "not_checked");
  const recentPosts = (postCheck === "checked" ? input.communityPosts || [] : []).filter((post) => {
    if (!buildCommunityPostPath(post.id)) return false;
    const created = new Date(String(post.createdAt || "")).getTime();
    const title = String(post.title || "").toLowerCase();
    const content = String(post.content || "").toLowerCase();
    return (
      Number.isFinite(created) &&
      created >= weekStart &&
      created <= now.getTime() &&
      (!topicKey || title.includes(topicKey) || content.includes(topicKey))
    );
  });

  const uniquePosts = new Map<string, CountyPost>();
  for (const post of recentPosts) {
    const path = buildCommunityPostPath(post.id);
    const existing = uniquePosts.get(path);
    if (!existing) {
      uniquePosts.set(path, post);
    } else if (post.hasWorkRequest === true && existing.hasWorkRequest !== true) {
      uniquePosts.set(path, { ...existing, hasWorkRequest: true });
    }
  }

  const postEntities = Array.from(uniquePosts, ([url, post]) => ({ url, post }))
    .slice(0, 3)
    .map(({ url, post }) => ({
      id: String(post.id),
      type: "community_post",
      name:
        String(post.title || post.content || "County post")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 110) || "County post",
      url,
      match_reasons: [
        post.hasWorkRequest === true
          ? "Published county post linked to a request"
          : "Published county post",
        `From the last 7 days in ${area}`,
        ...(topic ? [`Title or text includes "${topic}"`] : []),
      ],
    }));

  const dealEntities = (input.dealCheck === "checked" ? input.deals || [] : [])
    .filter((deal) => isEligibleScoutDeal(deal, input.countyFips, now))
    .slice(0, 3)
    .flatMap((deal) => {
      const url = buildScoutDealPath(deal.id, input.countyFips);
      if (!url) return [];
      return [
        {
          id: deal.id,
          type: "trade_deal",
          name: deal.title.replace(/\s+/g, " ").trim().slice(0, 110),
          url,
          match_reasons: [
            "Promotional TradeDeal; terms and availability are not independently verified",
            deal.countyFips.length === 0 ? "Listed for all counties" : `Listed for ${area}`,
            ...(topic ? ["Selected by county; not matched to your topic"] : []),
            "Confirm when the offer ends before acting",
          ],
        },
      ];
    });
  const businessEntities = (input.businessCheck === "checked" ? input.businesses || [] : [])
    .filter((business) => {
      const slug = String(business.slug || "").trim();
      return (
        Boolean(business.id) &&
        Boolean(String(business.name || "").trim()) &&
        (!topicKey || Boolean(businessTopicMatchSource(business, topicKey))) &&
        /^[a-z0-9][a-z0-9-]{0,119}$/i.test(slug) &&
        slug.toLowerCase() !== "requests" &&
        Array.isArray(business.counties) &&
        business.counties.some(
          (county) =>
            county &&
            typeof county === "object" &&
            String((county as { fips?: unknown }).fips || "") === input.countyFips
        )
      );
    })
    .slice(0, 2)
    .map((business) => ({
      id: String(business.id),
      type: "business",
      name: String(business.name).replace(/\s+/g, " ").trim().slice(0, 110),
      url: `/business/${encodeURIComponent(String(business.slug).trim())}`,
      match_reasons: [
        `Public business profile listed for ${area}`,
        ...(topic ? [
          businessTopicMatchSource(business, topicKey) === "name"
            ? `Business name matches "${topic}"`
            : businessTopicMatchSource(business, topicKey) === "category"
              ? `Listed category matches "${topic}"`
              : `Listed service matches "${topic}"`,
        ] : []),
        "Check current services and availability before contact",
      ],
    }));
  const toolEntities = (input.toolCheck === "checked" ? input.tools || [] : [])
    .filter((tool) => {
      const id = String(tool.id || "");
      const title = String(tool.title || "").trim();
      return (
        /^[a-z0-9_-]{1,100}$/i.test(id) &&
        Boolean(title) &&
        tool.countyFips === input.countyFips &&
        tool.detailPath === `/exchange/tools/${encodeURIComponent(id)}` &&
        (!topicKey || tool.topicMatchSource === "title" || tool.topicMatchSource === "description")
      );
    })
    .slice(0, 2)
    .map((tool) => ({
      id: String(tool.id),
      type: "public_tool",
      name: String(tool.title).replace(/\s+/g, " ").trim().slice(0, 110),
      url: String(tool.detailPath),
      match_reasons: [
        topic
          ? `Matches “${topic}” in the listing ${tool.topicMatchSource}; listed in ${area}`
          : `Listed in ${area}`,
        "Confirm availability; listing may be older than this week",
      ],
    }));
  const pageEntities = (input.pageCheck === "checked" ? input.pages || [] : [])
    .filter((page) => {
      const id = String(page.id || "").trim();
      const slug = String(page.slug || "").trim();
      return (
        Boolean(id) &&
        typeof page.displayName === "string" &&
        Boolean(page.displayName.trim()) &&
        page.countyFips === input.countyFips &&
        /^[a-z0-9][a-z0-9-]{0,119}$/i.test(slug) &&
        page.detailPath === `/u/${encodeURIComponent(slug)}`
      );
    })
    .slice(0, 2)
    .map((page) => {
      const pageTitle = sanitizePublicDiscoveryText(page.displayName, 200);
      const businessName = typeof page.businessName === "string"
        ? sanitizePublicDiscoveryText(page.businessName, 200)
        : "";
      return {
        id: String(page.id),
        type: "public_profile",
        name: businessName || pageTitle || "TradeScout public profile",
        url: String(page.detailPath),
        match_reasons: [
          ...(businessName && pageTitle && businessName.toLowerCase() !== pageTitle.toLowerCase()
            ? [`Page: ${pageTitle}`]
            : []),
          topic ? `Serves ${area} and matches “${topic}”` : `Serves ${area}`,
          "Check current services; page may be older than this week",
        ],
      };
    });
  // A county promotion is available by location, but is not a match for the
  // user's topic. Put public topic matches ahead of it in the result contract.
  const entities = topic
    ? [...postEntities, ...pageEntities, ...businessEntities, ...toolEntities, ...dealEntities]
    : [...postEntities, ...pageEntities, ...toolEntities, ...dealEntities, ...businessEntities];
  const sourceError =
    postCheck === "error" || input.dealCheck === "error" ||
    input.businessCheck === "error" || input.toolCheck === "error" || input.pageCheck === "error";
  const checkedEmpty =
    postCheck === "checked" &&
    postEntities.length === 0 &&
    input.dealCheck === "checked" &&
    dealEntities.length === 0 &&
    input.businessCheck === "checked" &&
    businessEntities.length === 0 &&
    input.toolCheck === "checked" &&
    toolEntities.length === 0 &&
    input.pageCheck === "checked" &&
    pageEntities.length === 0;
  const canReviewCountyRequest =
    !sourceError &&
    postCheck === "checked" &&
    input.dealCheck === "checked" &&
    input.businessCheck === "checked" &&
    input.toolCheck === "checked" &&
    input.pageCheck === "checked" &&
    /^\d{5}$/.test(input.countyFips);

  const firstSentence = postEntities.length
    ? `This Scout result includes ${postEntities.length} published county ${postEntities.length === 1 ? "post" : "posts"} from the last 7 days in ${area}${topic ? ` with "${topic}" in the title or text` : ""}.`
    : postCheck === "checked"
      ? topic
        ? `Scout checked published county posts from the last 7 days in ${area} for "${topic}"; none matched this topic.`
        : `Scout checked published county posts from the last 7 days in ${area}; none were returned.`
      : postCheck === "error"
        ? `Published county posts from the last 7 days in ${area} could not be checked right now.`
        : `This Scout result does not verify a county post from the last 7 days in ${area}.`;
  const dealSentence =
    input.dealCheck === "checked"
      ? dealEntities.length
        ? `It also found ${dealEntities.length} posted Scout ${dealEntities.length === 1 ? "TradeDeal" : "TradeDeals"} for ${area}. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting.`
        : `It checked Scout promotions for ${area}; no eligible TradeDeals were returned. Other deal sources were not checked.`
      : input.dealCheck === "error"
        ? "Scout promotions could not be checked right now."
        : "It does not verify deals.";
  const businessSentence =
    input.businessCheck === "checked"
      ? businessEntities.length
        ? `Scout also found ${businessEntities.length} public business ${businessEntities.length === 1 ? "profile" : "profiles"} listed for ${area}${topic ? ` by name, category, or listed service for "${topic}"` : ""}. Business profiles were not filtered to this week; check current services and availability before contact.`
        : topic
          ? `Scout checked public business names, categories, and listed services for "${topic}" in ${area}; none matched this topic.`
          : `Scout checked public business profiles for ${area}; none were returned.`
      : input.businessCheck === "error"
        ? `Public business profiles for ${area} could not be checked right now.`
        : "Businesses were not checked.";
  const toolSentence =
    input.toolCheck === "checked"
      ? toolEntities.length
        ? `Scout found ${toolEntities.length} active public Tools & Hardware ${toolEntities.length === 1 ? "listing" : "listings"} in ${area}${topic ? ` with "${topic}" in the title or description` : ""}. Listings were not limited to this week; confirm availability before contact.`
        : topic
          ? `Scout checked public Tools & Hardware listings in ${area} for "${topic}"; none matched this topic.`
          : `Scout checked active public Tools & Hardware listings in ${area}; none were returned.`
      : input.toolCheck === "error"
        ? `Public Tools & Hardware listings for ${area} could not be checked right now.`
        : "Public Tools & Hardware listings were not checked.";
  const pageSentence =
    input.pageCheck === "checked"
      ? pageEntities.length
        ? `Scout found ${pageEntities.length} public business profile ${pageEntities.length === 1 ? "page" : "pages"} for ${area}${topic ? ` matching "${topic}"` : ""}. Pages were not limited to this week; check current services before contact.`
        : topic
          ? `Scout checked public business profile pages for ${area} for "${topic}"; none matched this topic.`
          : `Scout checked public business profile pages for ${area}; none were returned.`
      : input.pageCheck === "error"
        ? `Public business profile pages for ${area} could not be checked right now.`
        : "Public business profile pages were not checked.";
  const nextStepSentence = topic
    ? sourceError
      ? "Some local sources could not be checked. Retry this search before relying on an empty result. Scout promotions are county offers, not topic matches."
      : "Scout promotions were selected by county, not matched to your topic."
    : sourceError && entities.length === 0
      ? "The local checks are incomplete. Retry this county search before relying on these results."
      : "These are county results, not matches for a specific topic. What kind of work or item should Scout look for?";

  return {
    message: `${firstSentence} ${dealSentence} ${businessSentence} ${toolSentence} ${pageSentence} ${nextStepSentence} Other Site pages and private requests were not checked. Nothing was sent.`,
    entities,
    actions: [
      ...(postEntities.length
        ? [
            {
              type: "NAVIGATE",
              label: topic ? "Open topic post" : "Open county post",
              to: entities[0].url,
              primary: !sourceError,
            },
          ]
        : []),
      ...(dealEntities.length
        ? [
            {
              type: "NAVIGATE",
              label: "Open promotional TradeDeal",
              to: dealEntities[0].url,
              primary: !sourceError && !topic && postEntities.length === 0 && pageEntities.length === 0 && toolEntities.length === 0,
            },
          ]
        : []),
      ...(businessEntities.length
        ? [
            {
              type: "NAVIGATE",
              label: "Open local business profile",
              to: businessEntities[0].url,
              primary: !sourceError && postEntities.length === 0 && pageEntities.length === 0 && (Boolean(topic) || (toolEntities.length === 0 && dealEntities.length === 0)),
            },
          ]
        : []),
      ...(toolEntities.length
        ? [
            {
              type: "NAVIGATE",
              label: "Open local tool listing",
              to: toolEntities[0].url,
              primary: !sourceError && postEntities.length === 0 && pageEntities.length === 0 && (Boolean(topic) ? businessEntities.length === 0 : true),
            },
          ]
        : []),
      ...(pageEntities.length
        ? [
            {
              type: "NAVIGATE",
              label: "Open public profile page",
              to: pageEntities[0].url,
              primary: !sourceError && postEntities.length === 0,
            },
          ]
        : []),
      ...(sourceError
        ? [
            {
              type: "ASK_SCOUT",
              label: "Retry local search",
              prompt: topic
                ? `Find TradeScout posts and deals about ${topic} in my county this week. Include public posts linked to requests and local businesses.`
                : "Search TradeScout and my area for posts & deals and public business profiles. Include matching pages, tools and requests.",
              primary: true,
            },
          ]
        : []),
      ...(canReviewCountyRequest
        ? [
            {
              type: "NAVIGATE",
              label: "Review a local request privately",
              to: "/direct-connect/post?source=scout",
              payload: { countyFips: input.countyFips },
              primary: entities.length === 0 || (Boolean(topic) && postEntities.length === 0 && pageEntities.length === 0 && businessEntities.length === 0 && toolEntities.length === 0),
            },
          ]
        : []),
      {
        type: "NAVIGATE",
        label: checkedEmpty && !topic ? "Browse recent Community beyond my county" : "Open recent Community",
        to: checkedEmpty && !topic
          ? "/community-feed?geo=global&feed=recent"
          : "/community-feed?geo=local&feed=recent",
        primary: checkedEmpty && !topic && !canReviewCountyRequest,
      },
      { type: "NAVIGATE", label: "Browse Businesses", to: "/contractors" },
      ...(checkedEmpty && !topic ? [{ type: "NAVIGATE", label: "Change my area", to: "/settings" }] : []),
    ],
  };
}
