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
  postCheck?: "not_checked" | "checked" | "error";
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
  const area = displayArea(input.countyLabel);
  const postCheck =
    input.postCheck ?? ((input.communityPosts?.length ?? 0) > 0 ? "checked" : "not_checked");
  const recentPosts = (postCheck === "checked" ? input.communityPosts || [] : []).filter((post) => {
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
      post.hasWorkRequest === true
        ? "Published county post linked to a request"
        : "Published county post",
      `From the last 7 days in ${area}`,
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
            "Confirm when the offer ends before acting",
          ],
        },
      ];
    });
  const entities = [...postEntities, ...dealEntities];
  const sourceError = postCheck === "error" || input.dealCheck === "error";
  const checkedEmpty =
    postCheck === "checked" &&
    postEntities.length === 0 &&
    input.dealCheck === "checked" &&
    dealEntities.length === 0;

  const firstSentence = postEntities.length
    ? `This Scout result includes ${postEntities.length} published county ${postEntities.length === 1 ? "post" : "posts"} from the last 7 days in ${area}.`
    : postCheck === "checked"
      ? `Scout checked published county posts from the last 7 days in ${area}; none were returned.`
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
      ...(sourceError
        ? [
            {
              type: "ASK_SCOUT",
              label: "Retry local posts and deals",
              prompt:
                "Search TradeScout and my area for posts & deals. Include matching pages, tools and requests.",
              primary: entities.length === 0,
            },
          ]
        : []),
      {
        type: "NAVIGATE",
        label: checkedEmpty ? "Browse recent Community beyond my county" : "Open recent Community",
        to: checkedEmpty
          ? "/community-feed?geo=global&feed=recent"
          : "/community-feed?geo=local&feed=recent",
        primary: checkedEmpty,
      },
      { type: "NAVIGATE", label: "Browse Businesses", to: "/contractors" },
      ...(checkedEmpty ? [{ type: "NAVIGATE", label: "Change my area", to: "/settings" }] : []),
    ],
  };
}
