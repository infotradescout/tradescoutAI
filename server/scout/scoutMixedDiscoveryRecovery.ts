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

type PublicCountyBusiness = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  counties?: unknown;
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
  businesses?: PublicCountyBusiness[];
  businessCheck?: "not_checked" | "checked" | "error";
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
  const businessEntities = (input.businessCheck === "checked" ? input.businesses || [] : [])
    .filter((business) => {
      const slug = String(business.slug || "").trim();
      return (
        Boolean(business.id) &&
        Boolean(String(business.name || "").trim()) &&
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
        "Check current services and availability before contact",
      ],
    }));
  const entities = [...postEntities, ...dealEntities, ...businessEntities];
  const sourceError =
    postCheck === "error" || input.dealCheck === "error" || input.businessCheck === "error";
  const checkedEmpty =
    postCheck === "checked" &&
    postEntities.length === 0 &&
    input.dealCheck === "checked" &&
    dealEntities.length === 0 &&
    input.businessCheck === "checked" &&
    businessEntities.length === 0;
  const canDraftCountyRequest = checkedEmpty && /^\d{5}$/.test(input.countyFips);

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
  const businessSentence =
    input.businessCheck === "checked"
      ? businessEntities.length
        ? `Scout also found ${businessEntities.length} public business ${businessEntities.length === 1 ? "profile" : "profiles"} listed for ${area}. Business profiles were not filtered to this week; check current services and availability before contact.`
        : `Scout checked public business profiles for ${area}; none were returned.`
      : input.businessCheck === "error"
        ? `Public business profiles for ${area} could not be checked right now.`
        : "Businesses were not checked.";

  return {
    message: `${firstSentence} ${dealSentence} ${businessSentence} Pages, tools, and other requests were not checked. Nothing was sent.`,
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
      ...(businessEntities.length
        ? [
            {
              type: "NAVIGATE",
              label: "Open local business profile",
              to: businessEntities[0].url,
              primary: postEntities.length === 0 && dealEntities.length === 0,
            },
          ]
        : []),
      ...(sourceError
        ? [
            {
              type: "ASK_SCOUT",
              label: "Retry local search",
              prompt:
                "Search TradeScout and my area for posts & deals and public business profiles. Include matching pages, tools and requests.",
              primary: entities.length === 0,
            },
          ]
        : []),
      ...(canDraftCountyRequest
        ? [
            {
              type: "NAVIGATE",
              label: "Draft a request for my county",
              to: "/direct-connect?source=scout",
              payload: { countyFips: input.countyFips },
              primary: true,
            },
          ]
        : []),
      {
        type: "NAVIGATE",
        label: checkedEmpty ? "Browse recent Community beyond my county" : "Open recent Community",
        to: checkedEmpty
          ? "/community-feed?geo=global&feed=recent"
          : "/community-feed?geo=local&feed=recent",
        primary: checkedEmpty && !canDraftCountyRequest,
      },
      { type: "NAVIGATE", label: "Browse Businesses", to: "/contractors" },
      ...(checkedEmpty ? [{ type: "NAVIGATE", label: "Change my area", to: "/settings" }] : []),
    ],
  };
}
