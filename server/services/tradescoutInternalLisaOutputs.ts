import type { LisaFeedItem, LisaFeedPriority } from "../../shared/lisa";

type CrawlerCountySignalRow = {
  county_fips: string | null;
  county_name: string | null;
  state_code: string | null;
  source_surface: string | null;
  request_count: number;
  last_seen_at: string | Date | null;
};

type CrawlerRouteInsightRow = {
  path: string | null;
  request_count: number;
  error_count: number;
  missing_count: number;
  last_seen_at: string | Date | null;
};

type BotCrawlAggregateSignal = {
  date: string;
  routeFamily: string;
  county: string | null;
  state: string | null;
  trade: string | null;
  botFamily: string;
  hits: number;
  uniqueUrls: number;
  avgResponseTimeMs: number | null;
  avgResponseBytes: number | null;
  status200Count: number;
  status404Count: number;
  recrawlUrls: number;
  firstSeenUrls: number;
  topPath: string | null;
};

type ScoutActionSummary = {
  interactionCount: number;
  successfulCount: number;
  avgConfidence: number;
  topCountyName: string | null;
  topIntent: string | null;
  lastSeenAt: string | Date | null;
};

function minutesSince(isoLike?: string | Date | null): number | null {
  if (!isoLike) return null;
  const date = new Date(isoLike);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function priorityFromCount(count: number, high = 50, medium = 15): LisaFeedPriority {
  if (count >= high) return "high";
  if (count >= medium) return "medium";
  return "low";
}

export function toEntityDiscoveryFinding(
  signal: BotCrawlAggregateSignal | null
): LisaFeedItem | null {
  if (!signal) return null;
  if (signal.routeFamily !== "public_business") return null;

  const countyLabel = signal.county
    ? `${signal.county}${signal.state ? `, ${signal.state}` : ""}`
    : signal.state
      ? signal.state
      : "public surfaces";

  return {
    id: `internal-lisa-entity-discovery-${signal.date}-${signal.county || signal.state || "global"}`,
    priority: priorityFromCount(signal.hits, 20, 8),
    sourceKind: "bot_crawl_signals",
    headline: `Outside attention is concentrating on businesses in ${countyLabel}.`,
    narrative: `${signal.hits} crawler visits touched ${signal.uniqueUrls} public business pages${signal.recrawlUrls > 0 ? `, including ${signal.recrawlUrls} repeat visits` : ""}. That means external systems are not just glancing at this area — they are coming back to understand it. ${signal.topPath ? `Right now ${signal.topPath} is attracting the most repeat machine attention.` : "This is one of the clearest signals that business visibility is strengthening here."}`,
    evidence: [
      "internal_lisa_output=entity_discovery",
      "lane=crawl_visibility",
      "signal_class=entity_discovery",
      `route_family=${signal.routeFamily}`,
      `bot_family=${signal.botFamily}`,
      `hits=${signal.hits}`,
      `unique_urls=${signal.uniqueUrls}`,
      `recrawls=${signal.recrawlUrls}`,
      signal.county ? `county=${signal.county}` : "county=none",
      signal.state ? `state=${signal.state}` : "state=none",
      signal.topPath ? `top_path=${signal.topPath}` : "top_path=none",
    ],
    freshnessMinutes: 15,
    scopeType: signal.county ? "county" : "surface",
    scopeRef:
      signal.county && signal.state
        ? `${String(signal.state).toUpperCase()}-${signal.county}`
        : signal.routeFamily,
  };
}

export function toCountyCategoryDiscoveryFinding(
  countySignal: CrawlerCountySignalRow | null
): LisaFeedItem | null {
  if (!countySignal) return null;
  const countyName = String(countySignal.county_name || "Unknown county");
  const stateCode = String(countySignal.state_code || "")
    .trim()
    .toUpperCase();
  const sourceSurface = String(countySignal.source_surface || "unknown");
  const requestCount = Number(countySignal.request_count || 0);

  return {
    id: `internal-lisa-county-discovery-${countySignal.county_fips || `${stateCode}-${countyName}`}`,
    priority: priorityFromCount(requestCount, 40, 12),
    sourceKind: "bot_visibility",
    headline: `${countyName}${stateCode ? `, ${stateCode}` : ""} is drawing stronger outside attention.`,
    narrative: `${requestCount} crawler requests concentrated on the ${sourceSurface.replace(/_/g, " ")} surface in ${countyName}${stateCode ? `, ${stateCode}` : ""}. In plain English: the outside world is trying harder to understand what exists in this county, which makes it a stronger visibility, coverage, and follow-up priority.`,
    evidence: [
      "internal_lisa_output=county_category_discovery",
      "lane=crawl_visibility",
      "signal_class=county_category_discovery",
      `county_name=${countyName}`,
      stateCode ? `state_code=${stateCode}` : "state_code=none",
      `source_surface=${sourceSurface}`,
      `request_count=${requestCount}`,
      countySignal.county_fips ? `county_fips=${countySignal.county_fips}` : "county_fips=none",
    ],
    freshnessMinutes: minutesSince(countySignal.last_seen_at),
    scopeType: "county",
    scopeRef: String(countySignal.county_fips || `${stateCode}-${countyName}`),
  };
}

export function toRepairPressureFinding(
  routeSignal: CrawlerRouteInsightRow | null
): LisaFeedItem | null {
  if (!routeSignal) return null;
  const path = String(routeSignal.path || "/");
  const hits = Number(routeSignal.request_count || 0);
  const errors = Number(routeSignal.error_count || 0);
  const missing = Number(routeSignal.missing_count || 0);
  if (hits <= 0) return null;

  return {
    id: `internal-lisa-repair-pressure-${path}`,
    priority: errors >= 25 || missing >= 10 ? "high" : "medium",
    sourceKind: "bot_visibility",
    headline: `Machine attention is finding a weak spot at ${path}.`,
    narrative:
      errors > 0
        ? `${path} drew ${hits} crawler visits, but ${errors} of those visits hit failures (${missing} were 404). In other words, outside systems are trying to understand or index this route before the product is ready for them. Fixing or redirecting it should recover lost visibility fast.`
        : `${path} is drawing ${hits} crawler visits without current error pressure. This route is already attracting machine attention, which makes it worth keeping accurate, rich, and canonical.`,
    evidence: [
      "internal_lisa_output=repair_pressure",
      "lane=crawl_visibility",
      "signal_class=repair_pressure",
      `path=${path}`,
      `hits=${hits}`,
      `error_count=${errors}`,
      `missing_count=${missing}`,
    ],
    freshnessMinutes: minutesSince(routeSignal.last_seen_at),
    scopeType: "surface",
    scopeRef: path,
  };
}

export function toActionGatingSummaryFinding(
  summary: ScoutActionSummary | null
): LisaFeedItem | null {
  if (!summary) return null;
  if (summary.interactionCount <= 0) return null;

  const successRate =
    summary.interactionCount > 0
      ? Math.round((summary.successfulCount / summary.interactionCount) * 100)
      : 0;

  return {
    id: `internal-lisa-action-gating-${String(summary.topCountyName || "global")
      .toLowerCase()
      .replace(/\s+/g, "-")}`,
    priority: priorityFromCount(summary.interactionCount, 100, 25),
    sourceKind: "scout_interactions",
    headline: `Human intent is successfully turning into action inside Scout.`,
    narrative: `${summary.interactionCount} real Scout interactions produced ${summary.successfulCount} completed or handed-off outcomes, a ${successRate}% success rate. ${summary.topCountyName ? `${summary.topCountyName} is leading this action flow` : "No single county is dominating yet"}${summary.topIntent ? `, driven most by ${summary.topIntent.replace(/_/g, " ")} intent` : ""}. This is the human-side counterpart to the machine attention signal: people are not just looking, they are moving forward.`,
    evidence: [
      "internal_lisa_output=action_gating_summary",
      "lane=action",
      "signal_class=action_gating_summary",
      `interaction_count=${summary.interactionCount}`,
      `successful_count=${summary.successfulCount}`,
      `success_rate_pct=${successRate}`,
      `avg_confidence=${summary.avgConfidence}`,
      summary.topCountyName ? `top_county=${summary.topCountyName}` : "top_county=none",
      summary.topIntent ? `top_intent=${summary.topIntent}` : "top_intent=none",
    ],
    freshnessMinutes: minutesSince(summary.lastSeenAt),
    scopeType: summary.topCountyName ? "county" : "global",
    scopeRef: summary.topCountyName || "global",
  };
}

export function buildTradeScoutInternalLisaOutputs(params: {
  topBotCrawlSignal: BotCrawlAggregateSignal | null;
  topCrawlerCounty: CrawlerCountySignalRow | null;
  topBrokenCrawlerRoute: CrawlerRouteInsightRow | null;
  actionSummary: ScoutActionSummary | null;
}): LisaFeedItem[] {
  return [
    toEntityDiscoveryFinding(params.topBotCrawlSignal),
    toCountyCategoryDiscoveryFinding(params.topCrawlerCounty),
    toRepairPressureFinding(params.topBrokenCrawlerRoute),
    toActionGatingSummaryFinding(params.actionSummary),
  ].filter((item): item is LisaFeedItem => Boolean(item));
}
