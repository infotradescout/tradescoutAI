import { buildCommunityPostPath } from "../../shared/communityPostShare";
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

function displayArea(countyLabel: string | undefined): string {
  const value = String(countyLabel || "").trim();
  return /^[a-z .'-]+, [a-z]{2}$/i.test(value) && value.length <= 80 ? value : "your county";
}

export function buildScoutMixedDiscoveryRecovery(input: {
  countyFips?: string | null;
  countyLabel?: string;
  communityPosts?: CountyPost[];
  deals?: ScoutDealCandidate[];
  dealCheck?: "not_checked" | "checked" | "error";
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
  const recentPosts = (input.communityPosts || []).filter((post) => {
    if (!buildCommunityPostPath(post.id)) return false;
    const created = new Date(String(post.createdAt || "")).getTime();
    return Number.isFinite(created) && created >= weekStart && created <= now.getTime();
  });

  const postEntities = recentPosts.slice(0, 3).map((post) => ({
    id: String(post.id),
    type: "community_post",
    name:
      String(post.title || post.content || "County post")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 110) || "County post",
    url: buildCommunityPostPath(post.id),
    match_reasons: [
      post.hasWorkRequest === true ? "Published local request" : "Published county post",
      "From the last 7 days",
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
            deal.countyFips.length === 0 ? "Listed for all counties" : "Listed for your county",
            "Confirm when the offer ends before acting",
          ],
        },
      ];
    });
  const entities = [...postEntities, ...dealEntities];

  const area = displayArea(input.countyLabel);
  const firstSentence = postEntities.length
    ? `This Scout result includes ${postEntities.length} published county ${postEntities.length === 1 ? "post" : "posts"} from the last 7 days in ${area}.`
    : `This Scout result does not verify a county post from the last 7 days in ${area}.`;
  const dealSentence =
    input.dealCheck === "checked"
      ? dealEntities.length
        ? `It also found ${dealEntities.length} posted Scout ${dealEntities.length === 1 ? "TradeDeal" : "TradeDeals"} for ${area}. These are promotional listings; terms and availability are not independently verified. Confirm when each offer ends before acting.`
        : `It checked Scout promotions for ${area}; no eligible TradeDeals were returned. Other deal sources were not checked.`
      : input.dealCheck === "error"
        ? "Scout promotions could not be checked right now."
        : "It does not verify deals.";

  return {
    message: `${firstSentence} ${dealSentence} Businesses, pages, tools, and other requests were not checked. Nothing was sent.`,
    entities,
    actions: [
      ...(postEntities.length
        ? [
            {
              type: "NAVIGATE",
              label: "Open matching county post",
              to: entities[0].url,
              primary: true,
            },
          ]
        : []),
      ...(dealEntities.length
        ? [
            {
              type: "NAVIGATE",
              label: "Open promotional TradeDeal",
              to: dealEntities[0].url,
              primary: postEntities.length === 0,
            },
          ]
        : []),
      ...(input.dealCheck === "error"
        ? [
            {
              type: "ASK_SCOUT",
              label: "Retry local posts and deals",
              prompt:
                "Search TradeScout and my area for posts & deals. Include matching pages, tools and requests.",
            },
          ]
        : []),
      {
        type: "NAVIGATE",
        label: "Open recent Community",
        to: "/community-feed?geo=local&feed=recent",
        primary: entities.length === 0,
      },
      { type: "NAVIGATE", label: "Browse Businesses", to: "/contractors" },
    ],
  };
}
