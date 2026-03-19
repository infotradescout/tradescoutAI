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

function formatDecisionNarrative(parts: { what: string; why: string; doNext: string }): string {
  return `${parts.what} Why it matters: ${parts.why} What to do: ${parts.doNext}`;
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
    narrative: formatDecisionNarrative({
      what: `${signal.hits} crawler visits touched ${signal.uniqueUrls} public business pages${signal.recrawlUrls > 0 ? `, including ${signal.recrawlUrls} repeat visits` : ""}. ${signal.topPath ? `Right now ${signal.topPath} is attracting the most repeat machine attention.` : "Machine attention is clustering around local business visibility here."}`,
      why: "external systems are not just glancing at this area — they are coming back to understand it, which is one of the clearest signs that visibility is strengthening.",
      doNext:
        "improve business page quality, strengthen category coverage, and make sure the paths attracting repeat attention convert into useful discovery and action.",
    }),
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
    narrative: formatDecisionNarrative({
      what: `${requestCount} crawler requests concentrated on the ${sourceSurface.replace(/_/g, " ")} surface in ${countyName}${stateCode ? `, ${stateCode}` : ""}.`,
      why: "the outside world is trying harder to understand what exists in this county, which makes it a stronger visibility, coverage, and follow-up priority.",
      doNext:
        "treat this county as a higher-priority market for better pages, stronger entity coverage, and cleaner route readiness.",
    }),
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
        ? formatDecisionNarrative({
            what: `${path} drew ${hits} crawler visits, but ${errors} of those visits hit failures (${missing} were 404).`,
            why: "outside systems are trying to understand or index this route before the product is ready for them, so attention is being wasted.",
            doNext:
              "fix or redirect this path quickly so machine attention lands on a healthy, canonical destination instead of a dead end.",
          })
        : formatDecisionNarrative({
            what: `${path} is drawing ${hits} crawler visits without current error pressure.`,
            why: "machine attention is already landing here, which makes the route more valuable than a normal cold page.",
            doNext:
              "keep this route accurate, rich, and canonical so the attention compounds instead of decays.",
          }),
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
    narrative: formatDecisionNarrative({
      what: `${summary.interactionCount} real Scout interactions produced ${summary.successfulCount} completed or handed-off outcomes, a ${successRate}% success rate. ${summary.topCountyName ? `${summary.topCountyName} is leading this action flow` : "No single county is dominating yet"}${summary.topIntent ? `, driven most by ${summary.topIntent.replace(/_/g, " ")} intent` : ""}.`,
      why: "this is the human-side counterpart to machine attention: people are not just looking, they are moving forward.",
      doNext:
        "compare these action signals against machine attention so you can spot where visibility is converting well and where interest is stalling before action.",
    }),
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

export function toAttentionActionGapFinding(params: {
  topBotCrawlSignal: BotCrawlAggregateSignal | null;
  actionSummary: ScoutActionSummary | null;
}): LisaFeedItem | null {
  const { topBotCrawlSignal, actionSummary } = params;
  if (!topBotCrawlSignal || !actionSummary) return null;
  if (topBotCrawlSignal.hits <= 0 || actionSummary.interactionCount <= 0) return null;

  const attentionPerAction = Number(
    (topBotCrawlSignal.hits / Math.max(1, actionSummary.interactionCount)).toFixed(2)
  );

  return {
    id: `internal-lisa-attention-action-gap-${topBotCrawlSignal.county || topBotCrawlSignal.state || "global"}`,
    priority: attentionPerAction >= 3 ? "high" : attentionPerAction >= 1.5 ? "medium" : "low",
    sourceKind: "bot_crawl_signals",
    headline: `Machine attention and human action are diverging in useful ways.`,
    narrative: formatDecisionNarrative({
      what: `Top machine attention is generating ${topBotCrawlSignal.hits} crawl hits while Scout is seeing ${actionSummary.interactionCount} real interactions, or about ${attentionPerAction} attention signals per action.`,
      why: "this helps reveal whether visibility is outrunning action or whether attention is converting into real movement.",
      doNext:
        "look at counties and categories where attention is high but action is lagging, because those are the clearest places to improve pages, routing, or supply before spending more money.",
    }),
    evidence: [
      "internal_lisa_output=attention_action_gap",
      "lane=action",
      "signal_class=attention_action_gap",
      `machine_attention_hits=${topBotCrawlSignal.hits}`,
      `human_interactions=${actionSummary.interactionCount}`,
      `attention_per_action=${attentionPerAction}`,
      topBotCrawlSignal.county ? `county=${topBotCrawlSignal.county}` : "county=none",
      topBotCrawlSignal.state ? `state=${topBotCrawlSignal.state}` : "state=none",
    ],
    freshnessMinutes: 15,
    scopeType: topBotCrawlSignal.county ? "county" : "global",
    scopeRef:
      topBotCrawlSignal.county && topBotCrawlSignal.state
        ? `${String(topBotCrawlSignal.state).toUpperCase()}-${topBotCrawlSignal.county}`
        : topBotCrawlSignal.state || "global",
  };
}

export function toVisibilityOutrunningCoverageFinding(params: {
  topBotCrawlSignal: BotCrawlAggregateSignal | null;
  topCrawlerCounty: CrawlerCountySignalRow | null;
}): LisaFeedItem | null {
  const { topBotCrawlSignal, topCrawlerCounty } = params;
  if (!topBotCrawlSignal || !topCrawlerCounty) return null;
  const visibilityPressure = Number(topBotCrawlSignal.hits || 0);
  const countyCoverage = Number(topCrawlerCounty.request_count || 0);
  if (visibilityPressure <= 0 || countyCoverage <= 0) return null;

  const ratio = Number((visibilityPressure / Math.max(1, countyCoverage)).toFixed(2));

  return {
    id: `internal-lisa-visibility-coverage-gap-${topBotCrawlSignal.county || topBotCrawlSignal.state || "global"}`,
    priority: ratio >= 2 ? "high" : ratio >= 1.2 ? "medium" : "low",
    sourceKind: "bot_crawl_signals",
    headline: `Visibility is outrunning coverage in ${topBotCrawlSignal.county || topCrawlerCounty.county_name || "this market"}.`,
    narrative: formatDecisionNarrative({
      what: `Machine attention is generating ${visibilityPressure} top-line crawl hits while the leading county discovery surface is only carrying ${countyCoverage} requests, a visibility-to-coverage ratio of ${ratio}.`,
      why: "this usually means outside systems are trying to learn more about a market faster than your current county/category surface is absorbing that attention.",
      doNext:
        "expand county pages, strengthen category and entity coverage, and make sure the public surface in this market is rich enough to hold the visibility it is already attracting.",
    }),
    evidence: [
      "internal_lisa_output=visibility_outpacing_coverage",
      "lane=crawl_visibility",
      "signal_class=visibility_outpacing_coverage",
      `machine_attention_hits=${visibilityPressure}`,
      `county_surface_requests=${countyCoverage}`,
      `visibility_coverage_ratio=${ratio}`,
      topBotCrawlSignal.county ? `county=${topBotCrawlSignal.county}` : "county=none",
      topBotCrawlSignal.state ? `state=${topBotCrawlSignal.state}` : "state=none",
    ],
    freshnessMinutes: 15,
    scopeType: topBotCrawlSignal.county || topCrawlerCounty.county_name ? "county" : "global",
    scopeRef:
      topBotCrawlSignal.county && topBotCrawlSignal.state
        ? `${String(topBotCrawlSignal.state).toUpperCase()}-${topBotCrawlSignal.county}`
        : topCrawlerCounty.county_fips || topBotCrawlSignal.state || "global",
  };
}

export function toCountyOpportunityConcentrationFinding(params: {
  topBotCrawlSignal: BotCrawlAggregateSignal | null;
  topCrawlerCounty: CrawlerCountySignalRow | null;
  actionSummary: ScoutActionSummary | null;
}): LisaFeedItem | null {
  const { topBotCrawlSignal, topCrawlerCounty, actionSummary } = params;
  if (!topCrawlerCounty) return null;
  const countyRequests = Number(topCrawlerCounty.request_count || 0);
  if (countyRequests <= 0) return null;

  const machineAttention = Number(topBotCrawlSignal?.hits || 0);
  const humanAction = Number(actionSummary?.interactionCount || 0);
  const combinedMomentum = countyRequests + machineAttention + humanAction;

  return {
    id: `internal-lisa-county-opportunity-${topCrawlerCounty.county_fips || topCrawlerCounty.county_name || "global"}`,
    priority: combinedMomentum >= 120 ? "high" : combinedMomentum >= 45 ? "medium" : "low",
    sourceKind: "bot_visibility",
    headline: `${topCrawlerCounty.county_name || "This county"} is concentrating opportunity across attention, coverage, and action.`,
    narrative: formatDecisionNarrative({
      what: `${topCrawlerCounty.county_name || "This county"}${topCrawlerCounty.state_code ? `, ${topCrawlerCounty.state_code}` : ""} is carrying ${countyRequests} county-surface discovery requests${machineAttention > 0 ? `, ${machineAttention} machine-attention hits` : ""}${humanAction > 0 ? `, and ${humanAction} real Scout interactions` : ""}.`,
      why: "when county discovery, outside attention, and human action start stacking in the same place, that county becomes more important than a simple traffic number would suggest.",
      doNext:
        "treat this county as a concentration zone: strengthen coverage, improve routes and pages, and look for categories where demand can be captured before attention disperses.",
    }),
    evidence: [
      "internal_lisa_output=county_opportunity_concentration",
      "lane=county_intelligence",
      "signal_class=county_opportunity_concentration",
      `county_surface_requests=${countyRequests}`,
      `machine_attention_hits=${machineAttention}`,
      `human_action_count=${humanAction}`,
      topCrawlerCounty.county_name
        ? `county_name=${topCrawlerCounty.county_name}`
        : "county_name=none",
      topCrawlerCounty.state_code ? `state_code=${topCrawlerCounty.state_code}` : "state_code=none",
      topCrawlerCounty.county_fips
        ? `county_fips=${topCrawlerCounty.county_fips}`
        : "county_fips=none",
    ],
    freshnessMinutes: minutesSince(topCrawlerCounty.last_seen_at),
    scopeType: "county",
    scopeRef:
      topCrawlerCounty.county_fips ||
      `${String(topCrawlerCounty.state_code || "").toUpperCase()}-${String(topCrawlerCounty.county_name || "unknown")}`,
  };
}

export function toAttentionFindingDeadEndsFinding(params: {
  topBotCrawlSignal: BotCrawlAggregateSignal | null;
  topBrokenCrawlerRoute: CrawlerRouteInsightRow | null;
}): LisaFeedItem | null {
  const { topBotCrawlSignal, topBrokenCrawlerRoute } = params;
  if (!topBrokenCrawlerRoute) return null;
  const brokenHits = Number(topBrokenCrawlerRoute.request_count || 0);
  const brokenErrors = Number(topBrokenCrawlerRoute.error_count || 0);
  const missing = Number(topBrokenCrawlerRoute.missing_count || 0);
  if (brokenHits <= 0 || brokenErrors <= 0) return null;

  const machineAttention = Number(topBotCrawlSignal?.hits || 0);
  const deadEndPressure = Number(
    (brokenHits / Math.max(1, machineAttention || brokenHits)).toFixed(2)
  );
  const path = String(topBrokenCrawlerRoute.path || "/");

  return {
    id: `internal-lisa-attention-dead-ends-${path}`,
    priority: brokenErrors >= 25 || missing >= 10 ? "high" : "medium",
    sourceKind: "bot_visibility",
    headline: `Machine attention is finding dead ends before people can benefit from them.`,
    narrative: formatDecisionNarrative({
      what: `${path} absorbed ${brokenHits} crawler visits and ${brokenErrors} failed responses (${missing} were 404). Relative to top machine attention, that produces a dead-end pressure ratio of ${deadEndPressure}.`,
      why: "this means outside systems are discovering value or relevance signals here, but the public surface is failing before that attention can become useful visibility or action.",
      doNext:
        "fix, redirect, or replace this route fast. Dead ends are one of the easiest ways to waste valuable machine attention and lose compounding discovery.",
    }),
    evidence: [
      "internal_lisa_output=attention_finding_dead_ends",
      "lane=crawl_visibility",
      "signal_class=attention_finding_dead_ends",
      `path=${path}`,
      `broken_hits=${brokenHits}`,
      `broken_errors=${brokenErrors}`,
      `missing_count=${missing}`,
      `dead_end_pressure=${deadEndPressure}`,
    ],
    freshnessMinutes: minutesSince(topBrokenCrawlerRoute.last_seen_at),
    scopeType: "surface",
    scopeRef: path,
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
    toAttentionActionGapFinding({
      topBotCrawlSignal: params.topBotCrawlSignal,
      actionSummary: params.actionSummary,
    }),
    toVisibilityOutrunningCoverageFinding({
      topBotCrawlSignal: params.topBotCrawlSignal,
      topCrawlerCounty: params.topCrawlerCounty,
    }),
    toCountyOpportunityConcentrationFinding({
      topBotCrawlSignal: params.topBotCrawlSignal,
      topCrawlerCounty: params.topCrawlerCounty,
      actionSummary: params.actionSummary,
    }),
    toAttentionFindingDeadEndsFinding({
      topBotCrawlSignal: params.topBotCrawlSignal,
      topBrokenCrawlerRoute: params.topBrokenCrawlerRoute,
    }),
  ].filter((item): item is LisaFeedItem => Boolean(item));
}
