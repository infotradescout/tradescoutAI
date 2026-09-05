export type PopularQuery = {
  query: string;
  href: string;
};

// Shared by the interactive entry page and its initial public HTML.
export const LOCAL_BUSINESS_DISCOVERY = {
  title: "Find Local Businesses, Services, and Contractors | TradeScout",
  description:
    "Find local businesses, services, and contractors by trade and county. Compare trustworthy options and connect through TradeScout Direct Connect.",
  heading: "Find local businesses without the noise",
  introduction:
    "TradeScout helps you find local businesses, services, and professionals who serve your area. Start with trade and county context, then connect through a trust-first flow.",
  tangipahoaRequestHref: "/direct-connect?county=22105&source=tangipahoa-launch",
  tangipahoaRecentHref: "/county/la/tangipahoa-parish/recent",
  browseLinks: [
    { label: "Tangipahoa Parish businesses", href: "/county/la/tangipahoa-parish" },
    { label: "Pensacola area businesses", href: "/county/fl/escambia" },
    { label: "Browse by county", href: "/county-directory" },
    { label: "Browse by trade", href: "/trade" },
  ],
} as const;

export const HOMEOWNER_POPULAR_QUERIES: PopularQuery[] = [
  { query: "contractors in tangipahoa parish", href: "/tangipahoa" },
  { query: "hammond la hvac repair", href: "/trade/hvac/la" },
  { query: "ponchatoula electrician", href: "/trade/electrical/la" },
  { query: "roofing contractor tangipahoa parish", href: "/trade/roofing/la" },
  { query: "drywall repair houston", href: "/trade/drywall-contractor/tx" },
  { query: "handyman montgomery county maryland", href: "/trade/handyman/md" },
  { query: "hvac contractors ri", href: "/trade/hvac/ri" },
  { query: "garage door repair utah", href: "/trade/garage-door/ut" },
  { query: "electrical contractors in maryland", href: "/trade/electrical/md" },
  { query: "fence installation", href: "/trade/fence-contractor" },
  {
    query: "wallpaper installation palm beach county florida",
    href: "/trade/wallpaper-installation/fl",
  },
  { query: "window repair wichita ks", href: "/trade/window-contractor/ks" },
  { query: "garage door repair near me", href: "/trade/garage-door" },
  { query: "gutter company", href: "/trade/gutter-contractor" },
  { query: "general contractor in arizona", href: "/trade/general-contractor/az" },
  { query: "iowa solar installers", href: "/trade/solar-contractor/ia" },
  { query: "deck repair", href: "/trade/deck-contractor" },
  { query: "bathroom remodeling", href: "/trade/bathroom-remodel" },
  { query: "kitchen remodeling", href: "/trade/kitchen-remodel" },
  { query: "gutter installation services", href: "/trade/gutter-contractor" },
  { query: "fence contractor", href: "/trade/fence-contractor" },
  { query: "lawn mowing near me", href: "/trade/landscaping" },
  { query: "cabinet painting near me", href: "/trade/cabinet-painting" },
  { query: "window installers", href: "/trade/window-contractor" },
  { query: "electrical contractor", href: "/trade/electrical" },
  { query: "gutter repair", href: "/trade/gutter-contractor" },
  { query: "drywall repair near me", href: "/trade/drywall-contractor" },
  { query: "fence company", href: "/trade/fence-contractor" },
  { query: "garage door repair", href: "/trade/garage-door" },
  { query: "cabinet painters", href: "/trade/cabinet-painting" },
  { query: "pool service", href: "/trade/pool-contractor" },
  { query: "commercial tree service", href: "/trade/tree-service" },
];

export const BUSINESS_POPULAR_QUERIES: PopularQuery[] = [
  { query: "tangipahoa parish business marketing", href: "/tangipahoa" },
  { query: "how to get local jobs in hammond la", href: "/tangipahoa" },
  { query: "local business leads tangipahoa parish", href: "/tangipahoa" },
  { query: "louisiana local service business growth", href: "/for-businesses" },
  { query: "trade scout", href: "/for-businesses" },
  { query: "tradescout", href: "/for-businesses" },
  { query: "trade scouts", href: "/for-businesses" },
  { query: "tradescouts", href: "/for-businesses" },
  { query: "small local business marketing", href: "/for-businesses" },
  { query: "small service business leads", href: "/for-businesses" },
  { query: "local business profile platform", href: "/for-businesses" },
  { query: "how to get more local jobs for my business", href: "/for-businesses" },
  { query: "local service business growth", href: "/for-businesses" },
  { query: "small electrical company marketing", href: "/trade/electrical" },
  { query: "small hvac business leads", href: "/trade/hvac" },
  { query: "small plumbing business marketing", href: "/trade/plumbing" },
  { query: "small service business jobs near me", href: "/for-businesses" },
  { query: "insulation contractors denver co", href: "/trade/insulation-contractor/co" },
  { query: "electrical contractors illinois", href: "/trade/electrical/il" },
  { query: "maine electrical contractors", href: "/trade/electrical/me" },
  { query: "concrete contractors richmond va", href: "/trade/concrete-contractor/va" },
  { query: "masonry contractor", href: "/trade/masonry-contractor" },
  { query: "window replacement berks county", href: "/trade/window-contractor/pa" },
  { query: "flooring iowa", href: "/trade/hardwood-flooring/ia" },
  { query: "cleaning company galveston tx", href: "/trade/cleaning-services/tx" },
  { query: "pest control kent county de", href: "/trade/pest-control/de" },
  { query: "roofing contractors bristol va", href: "/trade/roofing/va" },
  { query: "plumbing contractors nj", href: "/trade/plumbing/nj" },
  { query: "network security services hawaii", href: "/trade" },
];

type PopularTradeQueryOptions = {
  tradeSlug?: string;
  stateCode?: string;
  limit?: number;
};

export function getPopularQueriesForTrade({
  tradeSlug,
  stateCode,
  limit = 8,
}: PopularTradeQueryOptions): PopularQuery[] {
  const normalizedTrade = String(tradeSlug || "")
    .trim()
    .toLowerCase();
  const normalizedState = String(stateCode || "")
    .trim()
    .toLowerCase();

  const all = [...HOMEOWNER_POPULAR_QUERIES, ...BUSINESS_POPULAR_QUERIES].filter((item) =>
    item.href.startsWith("/trade")
  );

  const tradeMatched = normalizedTrade
    ? all.filter((item) => item.href.startsWith(`/trade/${normalizedTrade}`))
    : all;

  const stateMatched = normalizedState
    ? tradeMatched.filter((item) => item.href.toLowerCase().includes(`/${normalizedState}`))
    : [];

  const combined = [...stateMatched, ...tradeMatched, ...all];
  const seen = new Set<string>();
  const selected: PopularQuery[] = [];

  for (const item of combined) {
    const key = item.query.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(item);
    if (selected.length >= limit) break;
  }

  return selected;
}
