import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../db";
import { getHttpMetrics } from "../observability/metrics";
import type {
  LisaFeedItem,
  LisaFeedResponse,
  LisaRuntimeMode,
  LisaFeedSourceKind,
  LisaTruthStatus,
} from "../../shared/lisa";
import { reconcileLisaFindings } from "./lisaFindingsService";
import {
  ensureCrawlerRequestEventsTable,
  getBotCrawlAggregateSignals,
} from "./crawlerTelemetryService";
import {
  computeSignalTruthState,
  minutesSinceTimestamp,
  resolveMaxAgeMinutesForSignal,
} from "../../shared/signalDurability";
import { buildTradeScoutInternalLisaOutputs } from "./tradescoutInternalLisaOutputs";

type QueryResultRow = Record<string, unknown>;
type ScoutDemandRow = {
  interaction_count: number;
  avg_confidence: number;
  successful_count: number;
  last_seen_at: string | Date | null;
};
type ScoutTopCountyRow = {
  county_fips: string | null;
  county_name: string | null;
  intent: string | null;
  volume: number;
};
type ObjectiveStatsRow = {
  active_count: number;
  created_24h: number;
  distinct_intents: number;
  last_seen_at: string | Date | null;
};
type ObservationStatsRow = {
  observation_count: number;
  county_count: number;
  top_source_type: string;
  last_seen_at: string | Date | null;
};
type BotUiStatsRow = {
  finding_count: number;
  top_route: string;
  top_failure_type: string;
  max_severity: number;
  last_seen_at: string | Date | null;
};
type CrawlerTelemetryRow = {
  total_count: number;
  ok_count: number;
  client_error_count: number;
  server_error_count: number;
  top_bot_name: string;
  last_seen_at: string | Date | null;
};
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
type HomeScoutStatsRow = {
  created_count: number;
  price_changed_count: number;
  county_count: number;
  last_seen_at: string | Date | null;
};

const LISA_TRUTH_NOW_MAX_AGE_MINUTES = Math.max(
  30,
  Number(process.env.LISA_TRUTH_NOW_MAX_AGE_MINUTES || 180)
);
const LISA_VISIBLE_HISTORY_MAX_AGE_MINUTES = Math.max(
  LISA_TRUTH_NOW_MAX_AGE_MINUTES,
  Number(process.env.LISA_VISIBLE_HISTORY_MAX_AGE_MINUTES || 1440)
);
const LISA_SOURCE_MAX_AGE_MINUTES: Record<LisaFeedSourceKind, number> = {
  scout_interactions: Math.max(30, Number(process.env.LISA_MAX_AGE_SCOUT_INTERACTIONS || 180)),
  objectives: Math.max(30, Number(process.env.LISA_MAX_AGE_OBJECTIVES || 180)),
  homescout_listings: Math.max(30, Number(process.env.LISA_MAX_AGE_HOMESCOUT || 360)),
  observations: Math.max(30, Number(process.env.LISA_MAX_AGE_OBSERVATIONS || 360)),
  bot_visibility: Math.max(30, Number(process.env.LISA_MAX_AGE_BOT_VISIBILITY || 240)),
  bot_crawl_signals: Math.max(30, Number(process.env.LISA_MAX_AGE_BOT_CRAWL || 180)),
};
const LISA_DURABILITY_AGE_OVERRIDES = {
  volatile: Math.max(30, Number(process.env.LISA_MAX_AGE_VOLATILE || 180)),
  stable: Math.max(30, Number(process.env.LISA_MAX_AGE_STABLE || 720)),
  persistent: Math.max(60, Number(process.env.LISA_MAX_AGE_PERSISTENT || 43200)),
} as const;

function isRecoverableSignalQueryError(error: unknown): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  return (
    code === "42P01" || // undefined_table
    code === "42703" || // undefined_column
    code === "42702" || // ambiguous_column
    code === "22P02" // invalid_text_representation (enum/value drift)
  );
}

async function safeSignalQuery<T extends QueryResultRow>(args: {
  label: string;
  sql: string;
  fallbackRows: T[];
}): Promise<{ rows: T[] }> {
  try {
    return (await pool.query(args.sql)) as { rows: T[] };
  } catch (error) {
    if (!isRecoverableSignalQueryError(error)) {
      throw error;
    }
    console.warn(`[lisa] degraded ${args.label}:`, error);
    return { rows: args.fallbackRows };
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function minutesSince(isoLike?: string | Date | null): number | null {
  return minutesSinceTimestamp(isoLike);
}

function isFreshTimestamp(
  isoLike: string | Date | null | undefined,
  maxAgeMinutes: number
): boolean {
  return (
    computeSignalTruthState({
      observedAt: isoLike,
      sourceKind: "truth_now",
      sourceOverrides: { truth_now: maxAgeMinutes },
      durabilityOverrides: LISA_DURABILITY_AGE_OVERRIDES,
    }) === "current"
  );
}

function resolveLisaTruthStatus(item: LisaFeedItem): LisaTruthStatus {
  const observedAt =
    item.freshnessMinutes !== null
      ? new Date(Date.now() - item.freshnessMinutes * 60_000).toISOString()
      : null;
  const truth = computeSignalTruthState({
    observedAt,
    sourceKind: item.sourceKind,
    sourceOverrides: LISA_SOURCE_MAX_AGE_MINUTES,
    durabilityOverrides: LISA_DURABILITY_AGE_OVERRIDES,
  });
  return truth === "current" ? "current" : "stale";
}

function resolveLisaRuntimeMode(): LisaRuntimeMode {
  const raw = String(process.env.LISA_RUNTIME_MODE || "tradescout_local")
    .trim()
    .toLowerCase();
  if (raw === "json_file") return "json_file";
  if (raw === "remote") return "remote";
  return "tradescout_local";
}

async function loadJsonFileFeed(filePath: string): Promise<LisaFeedResponse> {
  const absolutePath = path.resolve(filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);

  return {
    ...parsed,
    runtime: {
      mode: "json_file",
      source: absolutePath,
    },
  } as LisaFeedResponse;
}

async function finalizeLisaFeed(feed: LisaFeedResponse): Promise<LisaFeedResponse> {
  try {
    const persisted = await reconcileLisaFindings(feed);
    return {
      ...feed,
      feed: persisted,
    };
  } catch (error) {
    console.error("[lisa] failed to reconcile findings; returning in-memory feed", error);
    return feed;
  }
}

async function loadRemoteFeed(url: string): Promise<LisaFeedResponse> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Remote LISA runtime failed with ${response.status}`);
  }

  const parsed = (await response.json()) as LisaFeedResponse;
  return {
    ...parsed,
    runtime: {
      mode: "remote",
      source: url,
    },
  };
}

async function buildTradeScoutLocalFeed(): Promise<LisaFeedResponse> {
  await ensureCrawlerRequestEventsTable();
  const httpMetrics = getHttpMetrics();
  const inProcessBot2xx = Number(httpMetrics["2xx:bot"] || 0);
  const inProcessBot4xx = Number(httpMetrics["4xx:bot"] || 0);
  const inProcessBot5xx = Number(httpMetrics["5xx:bot"] || 0);

  const [
    scoutDemandResult,
    scoutTopCountyResult,
    objectivesResult,
    observationsResult,
    botUiResult,
    crawlerTelemetryResult,
    crawlerCountySignalResult,
    crawlerRouteInsightResult,
    homeScoutResult,
  ] = await Promise.all([
    safeSignalQuery<ScoutDemandRow>({
      label: "scout-demand",
      fallbackRows: [
        { interaction_count: 0, avg_confidence: 0, successful_count: 0, last_seen_at: null },
      ],
      sql: `
        select
          count(*)::int as interaction_count,
          round(avg(scout_confidence))::int as avg_confidence,
          count(*) filter (where outcome in ('completed', 'handed_off'))::int as successful_count,
          max(created_at) as last_seen_at
        from scout_interactions
        where created_at >= now() - interval '24 hours'
      `,
    }),
    safeSignalQuery<ScoutTopCountyRow>({
      label: "scout-top-county",
      fallbackRows: [],
      sql: `
        select
          si.county_fips,
          coalesce(c.name, si.county_fips) as county_name,
          si.intent,
          count(*)::int as volume
        from scout_interactions si
        left join counties c on c.fips = si.county_fips
        where si.created_at >= now() - interval '24 hours'
        group by si.county_fips, c.name, si.intent
        order by volume desc, county_name asc
        limit 1
      `,
    }),
    safeSignalQuery<ObjectiveStatsRow>({
      label: "objectives",
      fallbackRows: [{ active_count: 0, created_24h: 0, distinct_intents: 0, last_seen_at: null }],
      sql: `
        select
          count(*) filter (where status = 'active')::int as active_count,
          count(*) filter (where created_at >= now() - interval '24 hours')::int as created_24h,
          count(distinct intent_class)::int as distinct_intents,
          max(created_at) as last_seen_at
        from objectives
      `,
    }),
    safeSignalQuery<ObservationStatsRow>({
      label: "observations",
      fallbackRows: [
        { observation_count: 0, county_count: 0, top_source_type: "none", last_seen_at: null },
      ],
      sql: `
        select
          count(*)::int as observation_count,
          count(distinct county_fips)::int as county_count,
          coalesce((
            select source_type::text as source_type
            from observations o2
            where o2.created_at >= now() - interval '24 hours'
            group by source_type::text
            order by count(*) desc, source_type asc
            limit 1
          ), 'none'::text) as top_source_type,
          max(created_at) as last_seen_at
        from observations
        where created_at >= now() - interval '24 hours'
      `,
    }),
    safeSignalQuery<BotUiStatsRow>({
      label: "bot-ui-findings",
      fallbackRows: [
        {
          finding_count: 0,
          top_route: "",
          top_failure_type: "",
          max_severity: 0,
          last_seen_at: null,
        },
      ],
      sql: `
        select
          count(*)::int as finding_count,
          coalesce((
            select route
            from bot_ui_findings b2
            where b2.created_at >= now() - interval '24 hours'
            group by route
            order by count(*) desc, route asc
            limit 1
          ), '') as top_route,
          coalesce((
            select failure_type::text
            from bot_ui_findings b3
            where b3.created_at >= now() - interval '24 hours'
            group by failure_type
            order by count(*) desc, failure_type asc
            limit 1
          ), '') as top_failure_type,
          max(severity)::int as max_severity,
          max(created_at) as last_seen_at
        from bot_ui_findings
        where created_at >= now() - interval '24 hours'
      `,
    }),
    safeSignalQuery<CrawlerTelemetryRow>({
      label: "crawler-telemetry",
      fallbackRows: [
        {
          total_count: 0,
          ok_count: 0,
          client_error_count: 0,
          server_error_count: 0,
          top_bot_name: "",
          last_seen_at: null,
        },
      ],
      sql: `
        select
          count(*)::int as total_count,
          count(*) filter (where status_class = '2xx')::int as ok_count,
          count(*) filter (where status_class = '4xx')::int as client_error_count,
          count(*) filter (where status_class = '5xx')::int as server_error_count,
          coalesce((
            select bot_name
            from crawler_request_events c2
            where c2.observed_at >= now() - interval '24 hours'
            group by bot_name
            order by count(*) desc, bot_name asc
            limit 1
          ), '') as top_bot_name,
          max(observed_at) as last_seen_at
        from crawler_request_events
        where observed_at >= now() - interval '24 hours'
      `,
    }),
    safeSignalQuery<CrawlerCountySignalRow>({
      label: "crawler-county-signal",
      fallbackRows: [],
      sql: `
        select
          r.county_fips,
          coalesce(c.name, r.county_slug, 'unknown') as county_name,
          coalesce(r.state_code, c.state_code) as state_code,
          coalesce(r.source_surface, 'unknown') as source_surface,
          sum(r.request_count)::int as request_count,
          max(r.bucket_start) as last_seen_at
        from crawler_request_hourly_rollups r
        left join counties c on c.fips = r.county_fips
        where r.bucket_start >= date_trunc('hour', now() - interval '23 hours')
          and r.county_fips is not null
        group by r.county_fips, c.name, c.state_code, r.state_code, r.source_surface, r.county_slug
        order by request_count desc, county_name asc
        limit 3
      `,
    }),
    safeSignalQuery<CrawlerRouteInsightRow>({
      label: "crawler-route-insights",
      fallbackRows: [],
      sql: `
        select
          e.path,
          count(*)::int as request_count,
          count(*) filter (where e.status_class in ('4xx', '5xx'))::int as error_count,
          count(*) filter (where e.status_code = 404)::int as missing_count,
          max(e.observed_at) as last_seen_at
        from crawler_request_events e
        where e.observed_at >= now() - interval '24 hours'
        group by e.path
        order by request_count desc, e.path asc
        limit 10
      `,
    }),
    safeSignalQuery<HomeScoutStatsRow>({
      label: "homescout-motion",
      fallbackRows: [
        { created_count: 0, price_changed_count: 0, county_count: 0, last_seen_at: null },
      ],
      sql: `
        select
          count(*) filter (where e.event_type = 'created')::int as created_count,
          count(*) filter (where e.event_type = 'price_changed')::int as price_changed_count,
          count(distinct l.county_fips)::int as county_count,
          max(e.observed_at) as last_seen_at
        from home_scout_listing_events e
        inner join home_scout_listings l on l.id = e.listing_id
        where e.observed_at >= now() - interval '24 hours'
      `,
    }),
  ]);
  const botCrawlSignals = await getBotCrawlAggregateSignals();

  const demand = scoutDemandResult.rows?.[0] || {};
  const topCounty: Partial<ScoutTopCountyRow> = scoutTopCountyResult.rows?.[0] || {};
  const objectiveStats = objectivesResult.rows?.[0] || {};
  const observationStats = observationsResult.rows?.[0] || {};
  const botUiStats = botUiResult.rows?.[0] || {};
  const crawlerTelemetryStats = crawlerTelemetryResult.rows?.[0] || {};
  const crawlerCountySignals = crawlerCountySignalResult.rows || [];
  const crawlerRouteInsights = crawlerRouteInsightResult.rows || [];
  const homeScoutStats = homeScoutResult.rows?.[0] || {};
  const topBotCrawlSignal = botCrawlSignals[0] || null;
  const topCrawlerRoute = crawlerRouteInsights[0] || null;
  const topBrokenCrawlerRoute =
    crawlerRouteInsights.find((row) => Number(row.error_count || 0) > 0) || null;

  const interactionCount = Number(demand.interaction_count || 0);
  const avgConfidence = Number(demand.avg_confidence || 0);
  const successfulCount = Number(demand.successful_count || 0);
  const activeObjectives = Number(objectiveStats.active_count || 0);
  const createdObjectives24h = Number(objectiveStats.created_24h || 0);
  const distinctObjectiveIntents = Number(objectiveStats.distinct_intents || 0);
  const observationCount = Number(observationStats.observation_count || 0);
  const observationCountyCount = Number(observationStats.county_count || 0);
  const botFindingCount = Number(botUiStats.finding_count || 0);
  const botMaxSeverity = Number(botUiStats.max_severity || 0);
  const persistedBot2xx = Number(crawlerTelemetryStats.ok_count || 0);
  const persistedBot4xx = Number(crawlerTelemetryStats.client_error_count || 0);
  const persistedBot5xx = Number(crawlerTelemetryStats.server_error_count || 0);
  const persistedBotTotal = Number(crawlerTelemetryStats.total_count || 0);
  const bot2xx = persistedBotTotal > 0 ? persistedBot2xx : inProcessBot2xx;
  const bot4xx = persistedBotTotal > 0 ? persistedBot4xx : inProcessBot4xx;
  const bot5xx = persistedBotTotal > 0 ? persistedBot5xx : inProcessBot5xx;
  const botTotal =
    persistedBotTotal > 0 ? persistedBotTotal : inProcessBot2xx + inProcessBot4xx + inProcessBot5xx;
  const botHealthyPct = botTotal > 0 ? clampPercent((bot2xx / botTotal) * 100) : 0;
  const topCrawlerCounty: CrawlerCountySignalRow | null = crawlerCountySignals[0] || null;
  const homeScoutCreated = Number(homeScoutStats.created_count || 0);
  const homeScoutPriceChanged = Number(homeScoutStats.price_changed_count || 0);
  const homeScoutCountyCount = Number(homeScoutStats.county_count || 0);
  const isScoutFresh = isFreshTimestamp(
    demand.last_seen_at,
    resolveMaxAgeMinutesForSignal({
      sourceKind: "scout_interactions",
      sourceOverrides: LISA_SOURCE_MAX_AGE_MINUTES,
      durabilityOverrides: LISA_DURABILITY_AGE_OVERRIDES,
    })
  );
  const isObjectivesFresh = isFreshTimestamp(
    objectiveStats.last_seen_at,
    resolveMaxAgeMinutesForSignal({
      sourceKind: "objectives",
      sourceOverrides: LISA_SOURCE_MAX_AGE_MINUTES,
      durabilityOverrides: LISA_DURABILITY_AGE_OVERRIDES,
    })
  );
  const isHomeScoutFresh = isFreshTimestamp(
    homeScoutStats.last_seen_at,
    resolveMaxAgeMinutesForSignal({
      sourceKind: "homescout_listings",
      sourceOverrides: LISA_SOURCE_MAX_AGE_MINUTES,
      durabilityOverrides: LISA_DURABILITY_AGE_OVERRIDES,
    })
  );
  const isObservationFresh = isFreshTimestamp(
    observationStats.last_seen_at,
    resolveMaxAgeMinutesForSignal({
      sourceKind: "observations",
      sourceOverrides: LISA_SOURCE_MAX_AGE_MINUTES,
      durabilityOverrides: LISA_DURABILITY_AGE_OVERRIDES,
    })
  );
  const isBotFresh = isFreshTimestamp(
    (crawlerTelemetryStats.last_seen_at || botUiStats.last_seen_at) as any,
    resolveMaxAgeMinutesForSignal({
      sourceKind: "bot_visibility",
      sourceOverrides: LISA_SOURCE_MAX_AGE_MINUTES,
      durabilityOverrides: LISA_DURABILITY_AGE_OVERRIDES,
    })
  );
  const topCrawlerCountyFresh = isFreshTimestamp(
    topCrawlerCounty?.last_seen_at || null,
    resolveMaxAgeMinutesForSignal({
      sourceKind: "bot_visibility",
      sourceOverrides: LISA_SOURCE_MAX_AGE_MINUTES,
      durabilityOverrides: LISA_DURABILITY_AGE_OVERRIDES,
    })
  );

  const feed: LisaFeedItem[] = [];

  feed.push({
    id: "scout-demand-24h",
    priority: interactionCount >= 100 ? "high" : interactionCount >= 25 ? "medium" : "low",
    sourceKind: "scout_interactions",
    headline:
      interactionCount > 0
        ? `Scout handled ${interactionCount} real user interactions in the last 24 hours.`
        : "Scout has not recorded real user interactions in the last 24 hours.",
    narrative:
      interactionCount > 0
        ? `${successfulCount} of those interactions ended in a completed or handed-off outcome, with average Scout confidence at ${avgConfidence}. ${topCounty.county_name ? `${topCounty.county_name} is the strongest county signal right now` : "No county lead is dominant yet"}${topCounty.intent ? `, led by ${String(topCounty.intent).replace(/_/g, " ")} intent.` : "."}`
        : "Right now the human-intent layer is quiet, so observation and crawl signals matter more than user-resolution data.",
    evidence: [
      `interactions_24h=${interactionCount}`,
      `successful_outcomes_24h=${successfulCount}`,
      `avg_confidence=${avgConfidence}`,
      topCounty.county_name ? `top_county=${topCounty.county_name}` : "top_county=none",
      topCounty.intent ? `top_intent=${topCounty.intent}` : "top_intent=none",
    ],
    freshnessMinutes: minutesSince(demand.last_seen_at),
  });

  feed.push({
    id: "objective-state",
    priority: activeObjectives >= 100 ? "high" : activeObjectives >= 20 ? "medium" : "low",
    sourceKind: "objectives",
    headline:
      activeObjectives > 0
        ? `${activeObjectives} active objectives are live in the operating system right now.`
        : "No active objectives are currently live in the operating system.",
    narrative:
      activeObjectives > 0
        ? `${createdObjectives24h} new objectives were created in the last 24 hours across ${distinctObjectiveIntents} intent classes. This is the cleanest signal of what people are actively trying to move forward, not just browse.`
        : "Objective creation is flat right now, which means the OS is not seeing enough new intent threads to claim a strong live-demand narrative.",
    evidence: [
      `active_objectives=${activeObjectives}`,
      `created_24h=${createdObjectives24h}`,
      `distinct_intent_classes=${distinctObjectiveIntents}`,
    ],
    freshnessMinutes: minutesSince(objectiveStats.last_seen_at),
  });

  feed.push({
    id: "homescout-motion",
    priority:
      homeScoutCreated + homeScoutPriceChanged >= 50
        ? "high"
        : homeScoutCreated + homeScoutPriceChanged >= 10
          ? "medium"
          : "low",
    sourceKind: "homescout_listings",
    headline:
      homeScoutCreated + homeScoutPriceChanged > 0
        ? `HomeScout Listings moved in ${homeScoutCountyCount} counties over the last 24 hours.`
        : "HomeScout Listings did not record meaningful movement in the last 24 hours.",
    narrative:
      homeScoutCreated + homeScoutPriceChanged > 0
        ? `${homeScoutCreated} new listing events and ${homeScoutPriceChanged} price changes were recorded. That is live supply-side motion, which is useful even before direct buyer demand is dominant.`
        : "The listing layer is quiet right now, so inventory-pressure outputs should be treated as low-signal until more listing events arrive.",
    evidence: [
      `listing_created_events_24h=${homeScoutCreated}`,
      `price_changed_events_24h=${homeScoutPriceChanged}`,
      `counties_with_motion=${homeScoutCountyCount}`,
    ],
    freshnessMinutes: minutesSince(homeScoutStats.last_seen_at),
  });

  feed.push({
    id: "observation-ingestion",
    priority: observationCount >= 100 ? "high" : observationCount >= 25 ? "medium" : "low",
    sourceKind: "observations",
    headline:
      observationCount > 0
        ? `TradeScout ingested ${observationCount} canonical observations in the last 24 hours.`
        : "No new canonical observations were ingested in the last 24 hours.",
    narrative:
      observationCount > 0
        ? `Those observations span ${observationCountyCount} counties, with ${String(observationStats.top_source_type || "other")} as the strongest source family. This is part of the non-user reality layer that can still produce sellable market truth.`
        : "The observation layer is idle right now, which weakens the system's ability to describe external market reality without relying on direct user activity.",
    evidence: [
      `observations_24h=${observationCount}`,
      `observation_counties=${observationCountyCount}`,
      `top_source_type=${String(observationStats.top_source_type || "none")}`,
    ],
    freshnessMinutes: minutesSince(observationStats.last_seen_at),
  });

  feed.push({
    id: "bot-visibility",
    priority:
      botFindingCount > 0 && botMaxSeverity >= 3
        ? "critical"
        : botTotal >= 50 || botFindingCount > 0
          ? "medium"
          : "low",
    sourceKind: "bot_visibility",
    headline:
      botTotal > 0
        ? `Bots and crawlers generated ${botTotal} tracked HTTP responses in the last 24 hours.`
        : "No bot or crawler HTTP activity has been observed in the last 24 hours.",
    narrative:
      botTotal > 0
        ? `${botHealthyPct}% of observed bot traffic returned 2xx responses. ${botFindingCount > 0 ? `${botFindingCount} bot UI findings were logged in the last 24 hours` : "No bot UI failures were logged in the last 24 hours"}, ${botFindingCount > 0 ? `with ${String(botUiStats.top_route || "unknown route")} as the hottest failure route and ${String(botUiStats.top_failure_type || "unknown")} as the dominant failure type.` : "which suggests crawl visibility is healthy enough to keep harvesting observation value."}${crawlerTelemetryStats.top_bot_name ? ` ${String(crawlerTelemetryStats.top_bot_name)} is the most active crawler right now.` : ""}`
        : "Crawler visibility has not produced enough persisted telemetry in the last 24 hours to support a strong live observation claim yet.",
    evidence: [
      `bot_http_2xx=${bot2xx}`,
      `bot_http_4xx=${bot4xx}`,
      `bot_http_5xx=${bot5xx}`,
      `bot_ui_findings_24h=${botFindingCount}`,
      crawlerTelemetryStats.top_bot_name
        ? `top_crawler=${crawlerTelemetryStats.top_bot_name}`
        : "top_crawler=none",
      botUiStats.top_route
        ? `top_bot_failure_route=${botUiStats.top_route}`
        : "top_bot_failure_route=none",
    ],
    freshnessMinutes: minutesSince(crawlerTelemetryStats.last_seen_at || botUiStats.last_seen_at),
  });

  if (topBotCrawlSignal) {
    const countyLabel = topBotCrawlSignal.county
      ? `${topBotCrawlSignal.county}${topBotCrawlSignal.state ? ` County, ${topBotCrawlSignal.state}` : ""}`
      : topBotCrawlSignal.state
        ? `${topBotCrawlSignal.state} statewide`
        : "public surfaces";
    const tradeLabel = topBotCrawlSignal.trade
      ? ` for ${topBotCrawlSignal.trade.replace(/-/g, " ")}`
      : "";
    feed.push({
      id: `bot-demand-${topBotCrawlSignal.date}-${topBotCrawlSignal.routeFamily}-${topBotCrawlSignal.county || topBotCrawlSignal.state || "global"}`,
      priority:
        topBotCrawlSignal.hits >= 20 || topBotCrawlSignal.status404Count >= 5
          ? "high"
          : topBotCrawlSignal.hits >= 8
            ? "medium"
            : "low",
      sourceKind: "bot_crawl_signals",
      headline:
        topBotCrawlSignal.status404Count >= 5
          ? `Bots are repeatedly hitting missing ${topBotCrawlSignal.routeFamily.replace(/_/g, " ")} URLs in ${countyLabel}.`
          : `High bot crawl demand is forming on ${topBotCrawlSignal.routeFamily.replace(/_/g, " ")}${tradeLabel} in ${countyLabel}.`,
      narrative:
        topBotCrawlSignal.status404Count >= 5
          ? `${topBotCrawlSignal.botFamily} logged ${topBotCrawlSignal.hits} hits with ${topBotCrawlSignal.status404Count} 404 responses in the last day. ${topBotCrawlSignal.topPath ? `${topBotCrawlSignal.topPath} is the hottest missing URL and should be repaired or redirected.` : "Missing URLs are attracting repeated crawl demand and need repair."}`
          : `${topBotCrawlSignal.botFamily} generated ${topBotCrawlSignal.hits} observed hits across ${topBotCrawlSignal.uniqueUrls} canonical URLs in the last day. ${topBotCrawlSignal.recrawlUrls > 0 ? `${topBotCrawlSignal.recrawlUrls} of those were recrawls, which is stronger than one-off discovery.` : `${topBotCrawlSignal.firstSeenUrls} newly discovered URLs were picked up by bots.`}${topBotCrawlSignal.topPath ? ` ${topBotCrawlSignal.topPath} is the hottest route in this cluster.` : ""}`,
      evidence: [
        `bot_family=${topBotCrawlSignal.botFamily}`,
        `route_family=${topBotCrawlSignal.routeFamily}`,
        topBotCrawlSignal.county ? `county=${topBotCrawlSignal.county}` : "county=none",
        topBotCrawlSignal.state ? `state=${topBotCrawlSignal.state}` : "state=none",
        topBotCrawlSignal.trade ? `trade=${topBotCrawlSignal.trade}` : "trade=none",
        `hits=${topBotCrawlSignal.hits}`,
        `unique_urls=${topBotCrawlSignal.uniqueUrls}`,
        `recrawl_urls=${topBotCrawlSignal.recrawlUrls}`,
        `first_seen_urls=${topBotCrawlSignal.firstSeenUrls}`,
        `status_404_count=${topBotCrawlSignal.status404Count}`,
        topBotCrawlSignal.topPath ? topBotCrawlSignal.topPath : "top_path=none",
      ],
      freshnessMinutes: 15,
      scopeType: topBotCrawlSignal.county ? "county" : "surface",
      scopeRef:
        topBotCrawlSignal.county && topBotCrawlSignal.state
          ? `${topBotCrawlSignal.state}-${topBotCrawlSignal.county}`
          : topBotCrawlSignal.routeFamily,
    });
  }

  if (topCrawlerCounty) {
    const countyName = String(topCrawlerCounty.county_name || "Unknown county");
    const stateCode = String(topCrawlerCounty.state_code || "")
      .trim()
      .toUpperCase();
    const sourceSurface = String(topCrawlerCounty.source_surface || "unknown");
    const requestCount = Number(topCrawlerCounty.request_count || 0);

    feed.push({
      id: "bot-county-signal",
      priority: requestCount >= 50 ? "high" : requestCount >= 15 ? "medium" : "low",
      sourceKind: "bot_visibility",
      headline: `${countyName}${stateCode ? `, ${stateCode}` : ""} is the strongest crawler-observed county right now.`,
      narrative: `${requestCount} crawler requests hit the ${sourceSurface.replace(/_/g, " ")} surface there in the last 24 hours. That is county-scoped public-attention data, not just generic bot traffic.`,
      evidence: [
        `county_fips=${String(topCrawlerCounty.county_fips || "none")}`,
        `county_name=${countyName}`,
        stateCode ? `state_code=${stateCode}` : "state_code=none",
        `source_surface=${sourceSurface}`,
        `crawler_requests_24h=${requestCount}`,
      ],
      freshnessMinutes: minutesSince(topCrawlerCounty.last_seen_at),
      scopeType: "county",
      scopeRef: String(topCrawlerCounty.county_fips || countyName),
    });
  }

  if (topCrawlerRoute) {
    const routePath = String(topCrawlerRoute.path || "/");
    const routeHits = Number(topCrawlerRoute.request_count || 0);
    const routeErrors = Number(topCrawlerRoute.error_count || 0);
    const route404s = Number(topCrawlerRoute.missing_count || 0);

    feed.push({
      id: "crawler-route-demand",
      priority: routeHits >= 100 ? "high" : routeHits >= 25 ? "medium" : "low",
      sourceKind: "bot_visibility",
      headline: `Crawler demand is concentrated on ${routePath}.`,
      narrative:
        routeErrors > 0
          ? `${routePath} received ${routeHits} crawler hits in the last 24 hours, with ${routeErrors} error responses (${route404s} were 404). Action now: repair this route or add a redirect so crawl demand converts into indexable surface.`
          : `${routePath} received ${routeHits} crawler hits in the last 24 hours with no recorded error pressure. Action now: enrich this page with stronger county/trade details because crawlers are already prioritizing it.`,
      evidence: [
        `path=${routePath}`,
        `crawler_hits_24h=${routeHits}`,
        `crawler_error_responses_24h=${routeErrors}`,
        `crawler_404_responses_24h=${route404s}`,
      ],
      freshnessMinutes: minutesSince(topCrawlerRoute.last_seen_at),
      scopeType: "surface",
      scopeRef: routePath,
    });
  }

  if (topBrokenCrawlerRoute) {
    const brokenPath = String(topBrokenCrawlerRoute.path || "/");
    const brokenHits = Number(topBrokenCrawlerRoute.request_count || 0);
    const brokenErrors = Number(topBrokenCrawlerRoute.error_count || 0);
    const broken404s = Number(topBrokenCrawlerRoute.missing_count || 0);
    feed.push({
      id: "crawler-route-repair",
      priority: brokenErrors >= 25 || broken404s >= 10 ? "high" : "medium",
      sourceKind: "bot_visibility",
      headline: `Crawler-visible route health issue: ${brokenPath}.`,
      narrative: `${brokenPath} took ${brokenHits} crawler hits with ${brokenErrors} failed responses in the last 24 hours (${broken404s} were 404). Action now: either publish/fix this path or redirect it to the canonical county/category route.`,
      evidence: [
        `broken_path=${brokenPath}`,
        `broken_path_hits_24h=${brokenHits}`,
        `broken_path_errors_24h=${brokenErrors}`,
        `broken_path_404_24h=${broken404s}`,
      ],
      freshnessMinutes: minutesSince(topBrokenCrawlerRoute.last_seen_at),
      scopeType: "surface",
      scopeRef: brokenPath,
    });
  }

  feed.push(
    ...buildTradeScoutInternalLisaOutputs({
      topBotCrawlSignal,
      topCrawlerCounty,
      topBrokenCrawlerRoute,
      actionSummary: {
        interactionCount,
        successfulCount,
        avgConfidence,
        topCountyName: topCounty.county_name || null,
        topIntent: topCounty.intent || null,
        lastSeenAt: demand.last_seen_at,
      },
    })
  );

  const truthNow =
    isScoutFresh && interactionCount > 0
      ? `TradeScout is producing real human-intent data right now, and the strongest live signal is ${topCounty.county_name ? `${topCounty.county_name}` : "county-agnostic activity"}${topCounty.intent ? ` around ${String(topCounty.intent).replace(/_/g, " ")}` : ""}.`
      : topCrawlerCounty && topCrawlerCountyFresh
        ? `TradeScout is producing county-scoped observation truth right now, led by ${String(topCrawlerCounty.county_name || "an attributed county")}${topCrawlerCounty.state_code ? `, ${String(topCrawlerCounty.state_code).toUpperCase()}` : ""} on the ${String(topCrawlerCounty.source_surface || "public")} surface.`
        : (isObservationFresh && observationCount > 0) || (isBotFresh && botTotal > 0)
          ? "TradeScout is producing observation-grade market truth right now even where direct user volume is still thin."
          : `TradeScout is not producing enough fresh telemetry in the last ${LISA_TRUTH_NOW_MAX_AGE_MINUTES} minutes to make a strong live-market claim.`;

  const dataProductionSummary = [
    `${interactionCount} Scout interactions`,
    `${activeObjectives} active objectives`,
    `${observationCount} canonical observations`,
    `${homeScoutCreated + homeScoutPriceChanged} HomeScout listing events`,
    `${botTotal} bot HTTP responses`,
    topCrawlerRoute
      ? `top route ${String(topCrawlerRoute.path || "/")} (${Number(topCrawlerRoute.request_count || 0)} hits)`
      : "top route unavailable",
  ].join(" | ");

  const llmOptimizationSummary =
    botTotal > 0 || observationCount > 0
      ? topBrokenCrawlerRoute
        ? `Primary optimization target now: fix ${String(topBrokenCrawlerRoute.path || "/")} because crawler demand is hitting failures.`
        : "Primary optimization target now: strengthen content on the top crawled route and county surfaces to convert visibility into user outcomes."
      : "LLM optimization is currently constrained by low crawl and observation volume, so public-surface discoverability needs more pressure.";

  const feedWithTruth: LisaFeedItem[] = feed.map((item) => {
    const truthStatus = resolveLisaTruthStatus(item);
    return {
      ...item,
      truthStatus,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      truthNow,
      dataProductionSummary,
      llmOptimizationSummary,
    },
    feed: feedWithTruth,
    runtime: {
      mode: "tradescout_local",
      source: "TradeScout telemetry synthesis",
    },
  };
}

export async function getLisaFeed(): Promise<LisaFeedResponse> {
  const mode = resolveLisaRuntimeMode();

  if (mode === "json_file") {
    const filePath = String(process.env.LISA_JSON_PATH || "").trim();
    if (!filePath) {
      throw new Error("LISA_JSON_PATH is required when LISA_RUNTIME_MODE=json_file");
    }
    return finalizeLisaFeed(await loadJsonFileFeed(filePath));
  }

  if (mode === "remote") {
    const url = String(process.env.LISA_REMOTE_URL || "").trim();
    if (!url) {
      throw new Error("LISA_REMOTE_URL is required when LISA_RUNTIME_MODE=remote");
    }
    return finalizeLisaFeed(await loadRemoteFeed(url));
  }

  return finalizeLisaFeed(await buildTradeScoutLocalFeed());
}
