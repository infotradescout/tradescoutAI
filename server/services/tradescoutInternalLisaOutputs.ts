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
    headline: `Entity discovery is active on public business surfaces in ${countyLabel}.`,
    narrative: `${signal.botFamily} generated ${signal.hits} hits across ${signal.uniqueUrls} public business URLs${signal.recrawlUrls > 0 ? ` with ${signal.recrawlUrls} recrawls` : ""}. ${signal.topPath ? `${signal.topPath} is the hottest entity route right now.` : "Public business discovery is carrying the strongest current external attention."}`,
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
    headline: `${countyName}${stateCode ? `, ${stateCode}` : ""} is the leading county/category discovery surface right now.`,
    narrative: `${requestCount} crawler requests concentrated on the ${sourceSurface.replace(/_/g, " ")} surface in ${countyName}${stateCode ? `, ${stateCode}` : ""}. This is county-first discovery pressure and should influence coverage, content, and route prioritization.`,
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
    headline: `Repair pressure is building on ${path}.`,
    narrative:
      errors > 0
        ? `${path} took ${hits} crawler hits with ${errors} failed responses (${missing} were 404). This route is attracting attention but failing to convert that attention into healthy visibility.`
        : `${path} is drawing ${hits} crawler hits without current error pressure. Keep this route enriched and canonical so demand keeps compounding cleanly.`,
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

export function buildTradeScoutInternalLisaOutputs(params: {
  topBotCrawlSignal: BotCrawlAggregateSignal | null;
  topCrawlerCounty: CrawlerCountySignalRow | null;
  topBrokenCrawlerRoute: CrawlerRouteInsightRow | null;
}): LisaFeedItem[] {
  return [
    toEntityDiscoveryFinding(params.topBotCrawlSignal),
    toCountyCategoryDiscoveryFinding(params.topCrawlerCounty),
    toRepairPressureFinding(params.topBrokenCrawlerRoute),
  ].filter((item): item is LisaFeedItem => Boolean(item));
}
