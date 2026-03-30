import { pool } from "../db";
import { getActiveAlerts } from "../observability/alerts";
import { getBotCrawlAggregateSignals, getCrawlerTelemetrySummary } from "./crawlerTelemetryService";
import { getLisaFeed } from "./lisaRuntime";
import { getPartnerIntelligenceBriefSnapshot } from "./partnerIntelligenceBriefSnapshotService";
import { getPublicationRules } from "../publicationRules";
import {
  buildPublicBusinessSignals,
  derivePublicationTier,
  deriveTradeSlugFromProfileData,
} from "../publicationBusiness";
import { isPublicAndCrawlableBusiness } from "../../shared/publication";
import { getTradeSeoMatch } from "../../shared/tradeSeo";
import {
  computeSignalTruthState,
  resolveSignalDurability,
  resolveMaxAgeMinutesForSignal,
} from "../../shared/signalDurability";
import type { LisaFeedItem } from "../../shared/lisa";

type LiveStreamPriority = "critical" | "high" | "medium" | "low";
type CommercialBucket =
  | "ad plays"
  | "advertiser pitches"
  | "market moves"
  | "monetization leaks"
  | "watchlist";
type MonetizationStage = "spend" | "sell" | "expand" | "repair" | "watch";
type MarketExampleBusiness = {
  name: string;
  slug: string | null;
};
type ProspectClassSummary = {
  label: string;
  count: number;
};

export type LiveStreamSnapshotEntry = {
  id: string;
  timestamp: string;
  kind: string;
  priority: LiveStreamPriority;
  truthStatus?: "current" | "stale";
  title: string;
  narrative: string;
  source: string;
  lane?: string;
  signalClass?: string;
  baselineDeltaPct?: number;
  category?: string;
  county?: string;
  state?: string;
  commercialBucket?: CommercialBucket;
  recommendedPlay?: string;
  salesAngle?: string;
  targetMarket?: string;
  monetizationStage?: MonetizationStage;
  channelSuggestion?: string;
  assetSuggestion?: string;
  whyNow?: string;
  inventorySummary?: string;
  exampleBusinesses?: MarketExampleBusiness[];
  prospectSummary?: string;
  prospectClasses?: ProspectClassSummary[];
  marketGapSummary?: string;
  revenueScore?: number;
  stateCode: string | null;
  countyName: string | null;
};

export type LiveStreamSnapshot = {
  generatedAt: string;
  filters: {
    source: string | null;
    stateCode: string | null;
    county: string | null;
    limit: number;
  };
  summary: {
    truthNow: string;
    currentLeadCounty: string | null;
    currentLeadState: string | null;
    crawlerRequests24h: number;
    activeAlerts: number;
    botCrawlSignals: number;
    topBotCrawlHeadline: string | null;
    sourceCounts: Record<string, number>;
    degradedSources: string[];
    degradedSourceReasons?: Record<string, string>;
  };
  stream: LiveStreamSnapshotEntry[];
};

let ensurePromise: Promise<void> | null = null;
let prunePromise: Promise<void> | null = null;
let lastPruneAt = 0;

const LIVE_STREAM_HISTORY_RETENTION_DAYS = Math.max(
  3,
  Number(process.env.LIVE_STREAM_HISTORY_RETENTION_DAYS || 7)
);
const LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES = Math.max(
  30,
  Number(process.env.LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES || 360)
);
const LIVE_STREAM_STABLE_MAX_AGE_MINUTES = Math.max(
  LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES,
  Number(process.env.LIVE_STREAM_STABLE_MAX_AGE_MINUTES || 1440)
);
const LIVE_STREAM_PERSISTENT_MAX_AGE_MINUTES = Math.max(
  LIVE_STREAM_STABLE_MAX_AGE_MINUTES,
  Number(process.env.LIVE_STREAM_PERSISTENT_MAX_AGE_MINUTES || 43200)
);
const LIVE_STREAM_HISTORY_LOOKBACK_DAYS = Math.max(
  1,
  Number(process.env.LIVE_STREAM_HISTORY_LOOKBACK_DAYS || 7)
);
const LIVE_STREAM_DEGRADED_RETRY_MINUTES = Math.max(
  1,
  Number(process.env.LIVE_STREAM_DEGRADED_RETRY_MINUTES || 2)
);

export async function ensureLiveStreamSnapshotTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_live_stream_snapshots (
          id bigserial PRIMARY KEY,
          source_filter text,
          state_code varchar(2),
          county_filter text,
          limit_value integer NOT NULL DEFAULT 20,
          summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          stream_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          computed_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_live_stream_snapshots_unique
        ON admin_live_stream_snapshots (
          coalesce(source_filter, ''),
          coalesce(state_code, ''),
          coalesce(county_filter, ''),
          limit_value
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_live_stream_snapshot_history (
          id bigserial PRIMARY KEY,
          source_filter text,
          state_code varchar(2),
          county_filter text,
          limit_value integer NOT NULL DEFAULT 20,
          summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          stream_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          computed_at timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_admin_live_stream_snapshot_history_lookup
        ON admin_live_stream_snapshot_history (
          coalesce(source_filter, ''),
          coalesce(state_code, ''),
          coalesce(county_filter, ''),
          computed_at DESC
        );
      `);
    })();
  }
  await ensurePromise;
}

async function pruneLiveStreamSnapshotHistoryIfNeeded(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < 6 * 60 * 60 * 1000) return;
  if (prunePromise) return prunePromise;

  prunePromise = (async () => {
    try {
      await ensureLiveStreamSnapshotTables();
      await pool.query(
        `
        delete from admin_live_stream_snapshot_history
        where computed_at < now() - ($1::interval)
        `,
        [`${LIVE_STREAM_HISTORY_RETENTION_DAYS} days`]
      );
      lastPruneAt = Date.now();
    } finally {
      prunePromise = null;
    }
  })();

  await prunePromise;
}

function normalizeFilters(params: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
}) {
  return {
    source:
      String(params.source || "")
        .trim()
        .toLowerCase() || "",
    stateCode:
      String(params.stateCode || "")
        .trim()
        .toUpperCase() || "",
    county:
      String(params.county || "")
        .trim()
        .toLowerCase() || "",
    limit: Math.max(5, Math.min(100, Number(params.limit || 20))),
  };
}

function summarizeRejectionReason(reason: unknown): string {
  if (reason instanceof Error) {
    const message = String(reason.message || "").trim();
    if (message) return message.slice(0, 220);
    return reason.name || "unknown_error";
  }
  if (typeof reason === "string") return reason.trim().slice(0, 220) || "unknown_error";
  if (reason && typeof reason === "object") {
    const candidate = (reason as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().slice(0, 220);
    }
  }
  return "unknown_error";
}

function isPersistentEntryKind(entry: Pick<LiveStreamSnapshotEntry, "kind" | "source">): boolean {
  if (entry.kind === "partner_brief" || entry.kind === "partner_delta") return true;
  if (entry.kind === "county_lead" || entry.kind === "state_lead") return true;
  if (entry.source === "cumulus") return true;
  return false;
}

function resolveEntryTruthStatus(entry: LiveStreamSnapshotEntry): "current" | "stale" {
  if (entry.truthStatus) return entry.truthStatus;
  const sourceKey = entry.kind === "finding" ? entry.source : entry.kind;
  const truth = computeSignalTruthState({
    observedAt: entry.timestamp,
    sourceKind: sourceKey,
    sourceOverrides: {
      [sourceKey]: resolveMaxAgeMinutesForSignal({
        sourceKind: sourceKey,
        durabilityOverrides: {
          volatile: LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES,
          stable: LIVE_STREAM_STABLE_MAX_AGE_MINUTES,
          persistent: LIVE_STREAM_PERSISTENT_MAX_AGE_MINUTES,
        },
      }),
    },
    durabilityOverrides: {
      volatile: LIVE_STREAM_VOLATILE_MAX_AGE_MINUTES,
      stable: LIVE_STREAM_STABLE_MAX_AGE_MINUTES,
      persistent: LIVE_STREAM_PERSISTENT_MAX_AGE_MINUTES,
    },
  });

  if (truth === "current") return "current";
  const durability = resolveSignalDurability(sourceKey);
  if (durability === "persistent" || isPersistentEntryKind(entry)) return "current";
  return "stale";
}

function getEvidenceValue(evidence: string[] | undefined, key: string): string | null {
  if (!Array.isArray(evidence)) return null;
  const match = evidence.find((entry) => entry.startsWith(`${key}=`));
  if (!match) return null;
  const value = match.slice(key.length + 1).trim();
  if (!value || value === "none") return null;
  return value;
}

function extractRouteTarget(text: string): string | null {
  const match = text.match(/(\/[A-Za-z0-9\-/_]+)/);
  return match?.[1] || null;
}

function buildTargetMarket(entry: LiveStreamSnapshotEntry): string | undefined {
  const countyLabel =
    entry.county && entry.state ? `${entry.county}, ${entry.state}` : entry.county || entry.state;
  if (countyLabel && entry.category) return `${entry.category} in ${countyLabel}`;
  if (countyLabel) return countyLabel;
  if (entry.category) return entry.category;
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  return routeTarget || undefined;
}

function extractLargestNumber(text: string): number {
  const matches = Array.from(text.matchAll(/\b(\d+(?:\.\d+)?)\b/g));
  if (!matches.length) return 0;
  return matches.reduce((max, match) => {
    const value = Number(match[1]);
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
}

function formatCountyState(entry: LiveStreamSnapshotEntry): string | undefined {
  if (entry.county && entry.state) return `${entry.county}, ${entry.state}`;
  return entry.county || entry.state || undefined;
}

function inferSurfaceLabel(entry: LiveStreamSnapshotEntry): string | undefined {
  const text = `${entry.title} ${entry.narrative}`.toLowerCase();
  if (text.includes("county page")) return "county page";
  if (text.includes("public business")) return "public business surface";
  if (text.includes("category")) return "category surface";
  if (text.includes("trade county")) return "trade county surface";
  return undefined;
}

function formatBaselineShift(entry: LiveStreamSnapshotEntry): string | undefined {
  if (typeof entry.baselineDeltaPct !== "number" || !Number.isFinite(entry.baselineDeltaPct)) {
    return undefined;
  }
  const rounded = Math.round(entry.baselineDeltaPct);
  if (rounded === 0) return "flat to baseline";
  return rounded > 0 ? `up ${rounded}% vs baseline` : `down ${Math.abs(rounded)}% vs baseline`;
}

function resolveRevenueScore(entry: LiveStreamSnapshotEntry): number {
  const priorityWeight = { critical: 35, high: 24, medium: 15, low: 8 } as const;
  const bucketWeight = {
    "advertiser pitches": 20,
    "ad plays": 18,
    "market moves": 14,
    "monetization leaks": 12,
    watchlist: 5,
  } as const;
  const freshnessWeight = entry.truthStatus === "current" ? 8 : 2;
  const targetWeight = entry.targetMarket ? 8 : 0;
  const categoryWeight = entry.category ? 5 : 0;
  const countyWeight = entry.county ? 5 : 0;
  const baselineWeight = Math.min(12, Math.round(Math.abs(entry.baselineDeltaPct || 0) / 10));
  const numericDemandWeight = Math.min(
    18,
    Math.round(extractLargestNumber(`${entry.title} ${entry.narrative}`) / 20)
  );
  return (
    priorityWeight[entry.priority] +
    bucketWeight[entry.commercialBucket || "watchlist"] +
    freshnessWeight +
    targetWeight +
    categoryWeight +
    countyWeight +
    baselineWeight +
    numericDemandWeight
  );
}

function withRevenueScore(entry: LiveStreamSnapshotEntry): LiveStreamSnapshotEntry {
  return {
    ...entry,
    revenueScore: resolveRevenueScore(entry),
  };
}

function buildWhyNow(entry: LiveStreamSnapshotEntry): string {
  const score = extractLargestNumber(`${entry.title} ${entry.narrative}`);
  const baselineShift = formatBaselineShift(entry);
  if (score > 0 && baselineShift) {
    return `Observed pressure is already in the feed at roughly ${score}, with demand ${baselineShift}.`;
  }
  if (score > 0) return `Observed pressure is already in the feed at roughly ${score}.`;
  if (baselineShift) return `Demand is ${baselineShift}.`;
  if (entry.truthStatus === "current") return "This signal is current right now.";
  return "This signal is still worth watching, but it is less time-sensitive.";
}

function buildLeakPlay(entry: LiveStreamSnapshotEntry, targetMarket?: string): string {
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  if (routeTarget)
    return `Repair ${routeTarget} before routing any more paid or sales traffic into it.`;
  if (targetMarket)
    return `Fix the conversion leak around ${targetMarket} before spending harder there.`;
  return "Repair the leak before routing more paid or sales attention here.";
}

function buildLeakChannel(entry: LiveStreamSnapshotEntry): string {
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  if (routeTarget) {
    return `${routeTarget} repair, redirect/canonical cleanup, and conversion-path QA`;
  }
  const countyState = formatCountyState(entry);
  if (entry.category && countyState) {
    return `${entry.category} landing fix in ${countyState}, plus conversion-path cleanup`;
  }
  return "surface fix, redirect, and conversion-path cleanup";
}

function buildLeakAsset(entry: LiveStreamSnapshotEntry): string {
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  if (routeTarget) return `${routeTarget} repair ticket and post-fix monetization checklist`;
  if (entry.category) return `${entry.category} conversion audit and repair ticket`;
  return "repair ticket and post-fix monetization follow-up";
}

function buildAdPlay(entry: LiveStreamSnapshotEntry, targetMarket?: string): string {
  const countyState = formatCountyState(entry);
  if (entry.category && countyState) {
    return `Launch a ${entry.category} county ad push in ${countyState} while attention is active.`;
  }
  if (countyState) return `Launch a county ad push in ${countyState} while attention is active.`;
  if (targetMarket) return `Open a county ad push around ${targetMarket}.`;
  return "Open a county-level ad push while attention is present.";
}

function buildAdChannel(entry: LiveStreamSnapshotEntry): string {
  const countyState = formatCountyState(entry);
  if (entry.category && countyState) {
    return `${entry.category} county-page ads, local search ads, and paid social in ${countyState}`;
  }
  if (countyState) return `county landing ads, local search ads, and paid social in ${countyState}`;
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  if (routeTarget) return `search and retargeting traffic into ${routeTarget}`;
  return "county landing ads, paid social, and local search coverage";
}

function buildAdAsset(entry: LiveStreamSnapshotEntry): string {
  const countyState = formatCountyState(entry);
  if (entry.category && countyState) {
    return `${entry.category} ad package for ${countyState} and a county market one-sheet`;
  }
  if (countyState) return `${countyState} county ad package and local market one-sheet`;
  return "county ad package and local market one-sheet";
}

function buildAdvertiserPlay(entry: LiveStreamSnapshotEntry, targetMarket?: string): string {
  const countyState = formatCountyState(entry);
  if (entry.category && countyState) {
    return `Pitch ${entry.category} advertisers serving ${countyState} while demand is visible.`;
  }
  if (entry.category)
    return `Pitch ${entry.category} advertisers around this active demand pocket.`;
  if (targetMarket) return `Pitch advertisers around ${targetMarket}.`;
  return "Pitch advertisers around this active demand pocket.";
}

function buildAdvertiserChannel(entry: LiveStreamSnapshotEntry): string {
  const countyState = formatCountyState(entry);
  if (entry.category && countyState) {
    return `${entry.category} sponsor outreach in ${countyState}, outbound sales, and local package follow-up`;
  }
  if (entry.category)
    return `${entry.category} sponsor outreach, outbound sales, and category package pitch`;
  return "sponsor outreach, outbound sales, and category package pitch";
}

function buildAdvertiserAsset(entry: LiveStreamSnapshotEntry): string {
  const countyState = formatCountyState(entry);
  if (entry.category && countyState) {
    return `${entry.category} advertiser deck for ${countyState} and sponsor package`;
  }
  if (entry.category) return `${entry.category} advertiser deck and sponsor package`;
  return "advertiser deck and sponsor package";
}

function buildMarketMove(entry: LiveStreamSnapshotEntry, targetMarket?: string): string {
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  const countyState = formatCountyState(entry);
  if (routeTarget)
    return `Prioritize ${routeTarget} for route fixes, redirects, and budget allocation.`;
  if (countyState) return `Shift expansion and coverage priority toward ${countyState}.`;
  if (targetMarket) {
    return `Use ${targetMarket} as a market movement signal for expansion, redirects, or prioritization.`;
  }
  return "Use this route pressure to guide expansion, redirects, or prioritization.";
}

function buildMarketChannel(entry: LiveStreamSnapshotEntry): string {
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  if (routeTarget) return `${routeTarget} prioritization, redirect planning, and SEO budget shift`;
  const countyState = formatCountyState(entry);
  if (countyState)
    return `county expansion planning, route prioritization, and budget shift into ${countyState}`;
  return "market expansion planning, route prioritization, and budget shift";
}

function buildMarketAsset(entry: LiveStreamSnapshotEntry): string {
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  if (routeTarget) return `${routeTarget} route-priority worksheet and expansion brief`;
  const countyState = formatCountyState(entry);
  if (countyState) return `${countyState} market move brief and route-priority worksheet`;
  return "market move brief and route-priority worksheet";
}

function buildSalesAngle(
  entry: LiveStreamSnapshotEntry,
  bucket: CommercialBucket,
  targetMarket?: string
): string {
  const countyState = formatCountyState(entry);
  const surface = inferSurfaceLabel(entry);
  const baselineShift = formatBaselineShift(entry);

  if (bucket === "monetization leaks") {
    if (targetMarket && baselineShift) {
      return `${targetMarket} is already drawing attention, but revenue is leaking before conversion and demand is ${baselineShift}.`;
    }
    if (targetMarket) {
      return `${targetMarket} is already drawing attention, but revenue is leaking before conversion.`;
    }
    return "Attention is present, but monetization is leaking before conversion.";
  }

  if (bucket === "ad plays") {
    if (entry.category && countyState && surface) {
      return `${entry.category} attention is concentrating on the ${surface} in ${countyState}, which is usable for immediate paid reach.`;
    }
    if (entry.category && countyState) {
      return `${entry.category} attention is concentrating in ${countyState}, which is usable for immediate paid reach.`;
    }
    if (targetMarket)
      return `${targetMarket} is showing live demand you can package into paid reach.`;
    return "This is a live county demand pocket you can package into paid reach.";
  }

  if (bucket === "advertiser pitches") {
    if (entry.category && countyState) {
      return `${entry.category} demand is visible in ${countyState}, which makes a direct advertiser or sponsor pitch credible right now.`;
    }
    if (entry.category) {
      return `${entry.category} has active attention you can turn into a sponsor or advertiser story.`;
    }
    return "This demand pocket can support a sponsor or advertiser pitch.";
  }

  if (bucket === "market moves") {
    if (countyState && baselineShift) {
      return `${countyState} is where attention is moving right now, with demand ${baselineShift}.`;
    }
    if (targetMarket) return `${targetMarket} is where attention is moving right now.`;
    return "This is where attention is moving right now.";
  }

  return "Supporting market context.";
}

function normalizeCountyNameForMatch(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+parish$/i, "")
    .replace(/\s+county$/i, "")
    .replace(/\s+/g, " ");
}

async function enrichEntryWithMarketInventory(
  entry: LiveStreamSnapshotEntry
): Promise<LiveStreamSnapshotEntry> {
  if (!entry.county || !entry.state) return entry;

  const publicationRules = await getPublicationRules();
  const normalizedCounty = normalizeCountyNameForMatch(entry.county);
  const normalizedCategory = entry.category
    ? getTradeSeoMatch(entry.category)?.canonicalSlug || null
    : null;

  type CandidateRow = {
    id: string;
    slug: string | null;
    name: string;
    claim_status: string | null;
    owner_user_id: string | null;
    updated_at: string | Date | null;
    public_discovery_enabled: boolean | null;
    owner_verification_status: string | null;
    owner_address_verified: boolean | null;
    county_name: string | null;
    state_code: string | null;
    profile_data: Record<string, unknown> | null;
  };

  const candidateResult = await pool.query<CandidateRow>(
    `
      select
        b.id,
        b.slug,
        b.name,
        b.claim_status,
        b.owner_user_id,
        b.updated_at,
        b.public_discovery_enabled,
        u.verification_status as owner_verification_status,
        u.address_verified as owner_address_verified,
        c.name as county_name,
        c.state_code,
        b.profile_data
      from businesses b
      inner join business_counties bc on bc.business_id = b.id
      inner join counties c on c.id = bc.county_id
      left join users u on u.id = b.owner_user_id
      where b.status = 'active'
        and coalesce(b.public_discovery_enabled, false) = true
        and upper(c.state_code) = $1
        and lower(regexp_replace(c.name, '\\s+(County|Parish)$', '', 'i')) = $2
      order by b.updated_at desc nulls last, b.name asc
      limit 40
    `,
    [String(entry.state).toUpperCase(), normalizedCounty]
  );

  const viableBusinesses = candidateResult.rows.filter((row) => {
    const updatedAt = row.updated_at ? new Date(row.updated_at) : null;
    if (!(updatedAt instanceof Date) || Number.isNaN(updatedAt.getTime())) return false;
    const profileData =
      row.profile_data && typeof row.profile_data === "object" ? row.profile_data : {};
    const tradeSlug = deriveTradeSlugFromProfileData(profileData);
    if (normalizedCategory && tradeSlug !== normalizedCategory) return false;
    const tier = derivePublicationTier({
      ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
      claimStatus: row.claim_status ? String(row.claim_status) : null,
      ownerVerificationStatus: row.owner_verification_status
        ? String(row.owner_verification_status)
        : null,
      ownerAddressVerified:
        typeof row.owner_address_verified === "boolean" ? row.owner_address_verified : null,
    });

    return isPublicAndCrawlableBusiness(
      buildPublicBusinessSignals({
        id: String(row.id),
        name: String(row.name || ""),
        slug: String(row.slug || ""),
        updatedAt,
        publicDiscoveryEnabled: Boolean(row.public_discovery_enabled),
        stateCode: row.state_code ? String(row.state_code) : null,
        countyName: row.county_name ? String(row.county_name) : null,
        city: profileData && typeof profileData.city === "string" ? String(profileData.city) : null,
        tradeSlug,
        tier,
      }),
      publicationRules,
      new Date()
    ).ok;
  });

  const classifiedBusinesses = viableBusinesses.map((row) => {
    const tier = derivePublicationTier({
      ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
      claimStatus: row.claim_status ? String(row.claim_status) : null,
      ownerVerificationStatus: row.owner_verification_status
        ? String(row.owner_verification_status)
        : null,
      ownerAddressVerified:
        typeof row.owner_address_verified === "boolean" ? row.owner_address_verified : null,
    });
    const prospectClass =
      tier === "verified"
        ? "verified sponsor targets"
        : tier === "claimed_unverified"
          ? "warm claim targets"
          : "recruitable inventory";
    return {
      row,
      tier,
      prospectClass,
    };
  });

  let inventorySummary: string | undefined;
  let marketGapSummary: string | undefined;
  if (normalizedCategory) {
    const scopedCountResult = await pool.query<{ business_count: number }>(
      `
        select tcp.business_count
        from ts_seo_trade_county_pages tcp
        inner join counties c on c.id = tcp.county_id
        where tcp.trade_slug = $1
          and upper(tcp.state_code) = $2
          and lower(regexp_replace(c.name, '\\s+(County|Parish)$', '', 'i')) = $3
        limit 1
      `,
      [normalizedCategory, String(entry.state).toUpperCase(), normalizedCounty]
    );
    const publicCount = Number(
      scopedCountResult.rows[0]?.business_count || viableBusinesses.length || 0
    );
    const categoryLabel = entry.category || normalizedCategory;
    inventorySummary = publicCount
      ? `${publicCount} public ${categoryLabel} businesses are already visible in ${entry.county}, ${entry.state}.`
      : `No public ${categoryLabel} businesses are currently visible in ${entry.county}, ${entry.state}.`;
    if (publicCount === 0) {
      marketGapSummary = `${entry.county}, ${entry.state} is showing demand without visible ${categoryLabel} inventory.`;
    } else if (publicCount <= 3) {
      marketGapSummary = `${entry.county}, ${entry.state} has thin ${categoryLabel} inventory, so this is both a sell and recruit market.`;
    }
  } else if (viableBusinesses.length > 0) {
    inventorySummary = `${viableBusinesses.length} public businesses are currently visible in ${entry.county}, ${entry.state}.`;
    if (viableBusinesses.length <= 3) {
      marketGapSummary = `${entry.county}, ${entry.state} has thin visible inventory relative to live demand.`;
    }
  }

  if (!inventorySummary && viableBusinesses.length === 0) return entry;

  const classCounts = new Map<string, number>();
  for (const business of classifiedBusinesses) {
    classCounts.set(business.prospectClass, (classCounts.get(business.prospectClass) || 0) + 1);
  }
  const prospectClasses = Array.from(classCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const prospectSummary = prospectClasses.length
    ? prospectClasses.map((item) => `${item.label}: ${item.count}`).join(" | ")
    : undefined;

  return {
    ...entry,
    inventorySummary,
    exampleBusinesses: classifiedBusinesses.slice(0, 3).map(({ row }) => ({
      name: String(row.name || "Unknown business"),
      slug: row.slug ? String(row.slug) : null,
    })),
    prospectSummary,
    prospectClasses,
    marketGapSummary,
  };
}

function decorateCommercialSignal(entry: LiveStreamSnapshotEntry): LiveStreamSnapshotEntry {
  const signalClass = entry.signalClass || "";
  const targetMarket = buildTargetMarket(entry);

  if (
    entry.kind === "alert" ||
    signalClass === "repair_pressure" ||
    signalClass === "attention_finding_dead_ends" ||
    signalClass === "attention_action_gap" ||
    signalClass === "trust_friction"
  ) {
    const decoratedEntry: LiveStreamSnapshotEntry = {
      ...entry,
      commercialBucket: "monetization leaks",
      monetizationStage: "repair",
      recommendedPlay:
        entry.kind === "alert"
          ? buildLeakPlay(entry, targetMarket)
          : buildLeakPlay(entry, targetMarket),
      salesAngle: buildSalesAngle(entry, "monetization leaks", targetMarket),
      targetMarket,
      channelSuggestion: buildLeakChannel(entry),
      assetSuggestion: buildLeakAsset(entry),
      whyNow: buildWhyNow(entry),
    };
    return withRevenueScore(decoratedEntry);
  }

  if (
    entry.kind === "crawler_county_demand" ||
    signalClass === "county_opportunity_concentration" ||
    signalClass === "visibility_outpacing_coverage"
  ) {
    const decoratedEntry: LiveStreamSnapshotEntry = {
      ...entry,
      commercialBucket: "ad plays",
      monetizationStage: "spend",
      recommendedPlay: buildAdPlay(entry, targetMarket),
      salesAngle: buildSalesAngle(entry, "ad plays", targetMarket),
      targetMarket,
      channelSuggestion: buildAdChannel(entry),
      assetSuggestion: buildAdAsset(entry),
      whyNow: buildWhyNow(entry),
    };
    return withRevenueScore(decoratedEntry);
  }

  if (
    entry.kind === "bot_demand_cluster" ||
    signalClass === "category_signal_concentration" ||
    signalClass === "category_momentum" ||
    entry.source === "cumulus"
  ) {
    const decoratedEntry: LiveStreamSnapshotEntry = {
      ...entry,
      commercialBucket: "advertiser pitches",
      monetizationStage: "sell",
      recommendedPlay: buildAdvertiserPlay(entry, targetMarket),
      salesAngle: buildSalesAngle(entry, "advertiser pitches", targetMarket),
      targetMarket,
      channelSuggestion: buildAdvertiserChannel(entry),
      assetSuggestion: buildAdvertiserAsset(entry),
      whyNow: buildWhyNow(entry),
    };
    return withRevenueScore(decoratedEntry);
  }

  if (
    entry.kind === "crawler_route_demand" ||
    entry.kind === "crawler_volume" ||
    entry.kind === "crawler_top_bot" ||
    entry.source === "crawler"
  ) {
    const decoratedEntry: LiveStreamSnapshotEntry = {
      ...entry,
      commercialBucket: "market moves",
      monetizationStage: "expand",
      recommendedPlay: buildMarketMove(entry, targetMarket),
      salesAngle: buildSalesAngle(entry, "market moves", targetMarket),
      targetMarket,
      channelSuggestion: buildMarketChannel(entry),
      assetSuggestion: buildMarketAsset(entry),
      whyNow: buildWhyNow(entry),
    };
    return withRevenueScore(decoratedEntry);
  }

  const decoratedEntry: LiveStreamSnapshotEntry = {
    ...entry,
    commercialBucket: "watchlist",
    monetizationStage: "watch",
    recommendedPlay:
      "Keep this on watch until it sharpens into a spend, sell, expand, or repair move.",
    salesAngle: "Supporting market context.",
    targetMarket,
    channelSuggestion: "watchlist only",
    assetSuggestion: "monitoring note",
    whyNow: buildWhyNow(entry),
  };
  return withRevenueScore(decoratedEntry);
}

function shouldRefreshWeakSnapshot(args: {
  summary: LiveStreamSnapshot["summary"] | null;
  stream: LiveStreamSnapshotEntry[];
  computedAt: Date | null;
}): boolean {
  const { summary, stream, computedAt } = args;
  if (!computedAt || !Number.isFinite(computedAt.getTime())) return true;

  const ageMs = Date.now() - computedAt.getTime();
  const retryAgeMs = LIVE_STREAM_DEGRADED_RETRY_MINUTES * 60 * 1000;
  const degradedSources = Array.isArray(summary?.degradedSources) ? summary.degradedSources : [];

  if (degradedSources.length > 0 && ageMs >= retryAgeMs) return true;
  if (stream.length === 0 && ageMs >= retryAgeMs) return true;
  return false;
}

function toLiveStreamEntryFromLisaItem(
  item: LisaFeedItem,
  generatedAt: string
): LiveStreamSnapshotEntry {
  const county = getEvidenceValue(item.evidence, "county");
  const state =
    getEvidenceValue(item.evidence, "state") || getEvidenceValue(item.evidence, "state_code");
  const category =
    getEvidenceValue(item.evidence, "category") || getEvidenceValue(item.evidence, "trade");
  const lane = getEvidenceValue(item.evidence, "lane") || undefined;
  const signalClass = getEvidenceValue(item.evidence, "signal_class") || undefined;
  const baselineDeltaRaw = getEvidenceValue(item.evidence, "baseline_delta_pct");
  const baselineDeltaPct =
    baselineDeltaRaw && Number.isFinite(Number(baselineDeltaRaw))
      ? Number(baselineDeltaRaw)
      : undefined;

  return {
    id: item.id,
    timestamp:
      item.freshnessMinutes !== null
        ? new Date(Date.now() - item.freshnessMinutes * 60_000).toISOString()
        : generatedAt,
    kind: "finding",
    priority: item.priority,
    truthStatus: item.truthStatus === "current" ? "current" : "stale",
    title: item.headline,
    narrative: item.narrative,
    source: item.sourceKind,
    lane,
    signalClass,
    baselineDeltaPct,
    category: category || undefined,
    county: county || undefined,
    state: state || undefined,
    stateCode: state || null,
    countyName:
      county ||
      (item.scopeType === "county" && item.scopeRef
        ? String(item.scopeRef).replace(/[-_]/g, " ")
        : null),
  };
}

export async function buildLiveStreamSnapshot(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
}): Promise<LiveStreamSnapshot> {
  const filters = normalizeFilters(params || {});

  const [
    lisaFeedResult,
    crawlerTelemetryResult,
    botDemandSignalsResult,
    cumulusBriefResult,
    activeAlertsResult,
  ] = await Promise.allSettled([
    getLisaFeed(),
    getCrawlerTelemetrySummary(),
    getBotCrawlAggregateSignals(),
    getPartnerIntelligenceBriefSnapshot({
      partnerSlug: "cumulus-media",
      window: "24h",
      stateCode: filters.stateCode || undefined,
      limit: 100,
    }),
    Promise.resolve(getActiveAlerts()),
  ]);

  const lisaFeed =
    lisaFeedResult.status === "fulfilled"
      ? lisaFeedResult.value
      : {
          generatedAt: new Date().toISOString(),
          runtimeMode: "tradescout_local",
          source: "fallback",
          summary: {
            truthNow: "LISA feed unavailable; showing partial live stream.",
            dataProductionSummary: "LISA feed unavailable.",
            llmOptimizationSummary: "LISA feed unavailable.",
          },
          feed: [],
        };

  const crawlerTelemetry =
    crawlerTelemetryResult.status === "fulfilled"
      ? crawlerTelemetryResult.value
      : {
          generatedAt: new Date().toISOString(),
          totals24h: { total: 0, ok: 0, clientError: 0, serverError: 0 },
          topBots: [],
          topRoutes: [],
          topSurfaces: [],
          requestTypes: [],
          topCounties: [],
        };
  const botDemandSignals =
    botDemandSignalsResult.status === "fulfilled" ? botDemandSignalsResult.value : [];

  const cumulusBrief =
    cumulusBriefResult.status === "fulfilled"
      ? cumulusBriefResult.value
      : {
          partnerSlug: "cumulus-media",
          generatedAt: new Date().toISOString(),
          filters: {
            window: "24h",
            stateCode: filters.stateCode || null,
            surface: null,
            limit: 100,
          },
          executiveSummary: "Cumulus brief unavailable; showing partial live stream.",
          activationSummary: "Cumulus brief unavailable.",
          topCounties: [],
          topStates: [],
          summary: {
            deltaSummary: "No Cumulus delta available.",
            currentLeadCounty: null,
            currentLeadState: null,
            currentLeadSurface: null,
            stateLead: null,
          },
          lisa: {
            truthNow: "",
            dataProductionSummary: "",
            llmOptimizationSummary: "",
            topFindings: [],
          },
        };

  const activeAlerts =
    activeAlertsResult.status === "fulfilled" && Array.isArray(activeAlertsResult.value)
      ? activeAlertsResult.value
      : [];

  const degradedSources = [
    lisaFeedResult.status === "rejected" ? "lisa" : null,
    crawlerTelemetryResult.status === "rejected" ? "crawler" : null,
    botDemandSignalsResult.status === "rejected" ? "bot-demand" : null,
    cumulusBriefResult.status === "rejected" ? "cumulus" : null,
    activeAlertsResult.status === "rejected" ? "alerts" : null,
  ].filter((value): value is string => Boolean(value));
  const degradedSourceReasons: Record<string, string> = {};

  if (lisaFeedResult.status === "rejected") {
    degradedSourceReasons.lisa = summarizeRejectionReason(lisaFeedResult.reason);
    console.error("Live stream degraded: LISA feed unavailable", lisaFeedResult.reason);
  }
  if (crawlerTelemetryResult.status === "rejected") {
    degradedSourceReasons.crawler = summarizeRejectionReason(crawlerTelemetryResult.reason);
    console.error(
      "Live stream degraded: crawler telemetry unavailable",
      crawlerTelemetryResult.reason
    );
  }
  if (botDemandSignalsResult.status === "rejected") {
    degradedSourceReasons["bot-demand"] = summarizeRejectionReason(botDemandSignalsResult.reason);
    console.error(
      "Live stream degraded: bot demand signals unavailable",
      botDemandSignalsResult.reason
    );
  }
  if (cumulusBriefResult.status === "rejected") {
    degradedSourceReasons.cumulus = summarizeRejectionReason(cumulusBriefResult.reason);
    console.error("Live stream degraded: Cumulus brief unavailable", cumulusBriefResult.reason);
  }
  if (activeAlertsResult.status === "rejected") {
    degradedSourceReasons.alerts = summarizeRejectionReason(activeAlertsResult.reason);
    console.error("Live stream degraded: active alerts unavailable", activeAlertsResult.reason);
  }

  const botCrawlFindings = (lisaFeed.feed || []).filter(
    (item) => item.sourceKind === "bot_crawl_signals"
  );
  const topBotCrawlFinding = botCrawlFindings[0] || null;
  const topDemandSignal = botDemandSignals[0] || null;
  const topDemandRoutes = crawlerTelemetry.topRoutes?.slice(0, 5) || [];
  const topDemandCounties = crawlerTelemetry.topCounties?.slice(0, 5) || [];

  const rawStream = [
    {
      id: `lisa-truth-${lisaFeed.generatedAt}`,
      timestamp: lisaFeed.generatedAt,
      kind: "truth_now",
      priority: "medium",
      title: "Current operating truth",
      narrative: lisaFeed.summary.truthNow,
      source: "lisa",
      stateCode: null,
      countyName: null,
    },
    ...(cumulusBrief.topCounties?.[0]
      ? [
          {
            id: `cumulus-county-${cumulusBrief.generatedAt}-${cumulusBrief.topCounties[0].countyFips}`,
            timestamp: cumulusBrief.generatedAt,
            kind: "county_lead",
            priority: "high" as LiveStreamPriority,
            title: "County lead requiring attention",
            narrative: `${cumulusBrief.topCounties[0].countyName}, ${cumulusBrief.topCounties[0].stateCode} is leading with ${cumulusBrief.topCounties[0].requestCount} requests on ${cumulusBrief.topCounties[0].dominantSurface.replace(/_/g, " ")}. Treat this county as the first market to inspect, package, or repair.`,
            source: "cumulus",
            stateCode: cumulusBrief.topCounties[0].stateCode,
            countyName: cumulusBrief.topCounties[0].countyName,
          },
        ]
      : []),
    ...(cumulusBrief.topStates?.[0]
      ? [
          {
            id: `cumulus-state-${cumulusBrief.generatedAt}-${cumulusBrief.topStates[0].stateCode}`,
            timestamp: cumulusBrief.generatedAt,
            kind: "state_lead",
            priority: "medium" as LiveStreamPriority,
            title: "Leading State Cluster",
            narrative: `${cumulusBrief.topStates[0].stateCode} leads with ${cumulusBrief.topStates[0].requestCount} requests across ${cumulusBrief.topStates[0].countyCount} counties.`,
            source: "cumulus",
            stateCode: cumulusBrief.topStates[0].stateCode,
            countyName: null,
          },
        ]
      : []),
    {
      id: `crawler-total-${crawlerTelemetry.generatedAt}`,
      timestamp: crawlerTelemetry.generatedAt,
      kind: "crawler_volume",
      priority: "medium",
      title: "Crawler Volume",
      narrative: `${crawlerTelemetry.totals24h.total} crawler requests were observed in the last 24 hours with ${crawlerTelemetry.totals24h.ok} returning 2xx and ${crawlerTelemetry.totals24h.serverError} returning 5xx.`,
      source: "crawler",
      stateCode: null,
      countyName: null,
    },
    ...(crawlerTelemetry.topBots?.[0]
      ? [
          {
            id: `crawler-bot-${crawlerTelemetry.generatedAt}-${crawlerTelemetry.topBots[0].botName}`,
            timestamp: crawlerTelemetry.generatedAt,
            kind: "crawler_top_bot",
            priority: "low" as LiveStreamPriority,
            title: "Top Bot",
            narrative: `${crawlerTelemetry.topBots[0].botName} is the most active crawler right now with ${crawlerTelemetry.topBots[0].requestCount} requests.`,
            source: "crawler",
            stateCode: null,
            countyName: null,
          },
        ]
      : []),
    ...topDemandRoutes.slice(0, 3).map((route, idx) => ({
      id: `crawler-route-demand-${crawlerTelemetry.generatedAt}-${idx}-${route.path}`,
      timestamp: crawlerTelemetry.generatedAt,
      kind: "crawler_route_demand",
      priority: idx === 0 ? ("high" as LiveStreamPriority) : ("medium" as LiveStreamPriority),
      title: `Route demand hotspot ${idx + 1}`,
      narrative: `${route.path} drew ${route.requestCount} crawler hits in the last 24 hours. This is a specific route to inspect for health, canonicalization, and whether the page is actually usable.`,
      source: "crawler",
      stateCode: null,
      countyName: null,
    })),
    ...topDemandCounties.slice(0, 3).map((county, idx) => ({
      id: `crawler-county-demand-${crawlerTelemetry.generatedAt}-${idx}-${county.countyFips || county.countyName}`,
      timestamp: crawlerTelemetry.generatedAt,
      kind: "crawler_county_demand",
      priority: idx === 0 ? ("high" as LiveStreamPriority) : ("medium" as LiveStreamPriority),
      title: `County demand hotspot ${idx + 1}`,
      narrative: `${county.countyName}${county.stateCode ? `, ${county.stateCode}` : ""} is drawing ${county.requestCount} requests on ${county.sourceSurface.replace(/_/g, " ")}. This county should be checked for surface quality, category coverage, and whether the visible path can convert.`,
      source: "crawler",
      stateCode: county.stateCode || null,
      countyName: county.countyName || null,
      county: county.countyName || undefined,
      state: county.stateCode || undefined,
    })),
    ...(topDemandSignal
      ? [
          {
            id: `bot-demand-cluster-${topDemandSignal.date}-${topDemandSignal.routeFamily}`,
            timestamp: crawlerTelemetry.generatedAt,
            kind: "bot_demand_cluster",
            priority:
              topDemandSignal.status404Count >= 5 || topDemandSignal.hits >= 20
                ? ("critical" as LiveStreamPriority)
                : ("high" as LiveStreamPriority),
            title: "Bot demand cluster (route + trade)",
            narrative: `${topDemandSignal.routeFamily.replace(/_/g, " ")}${
              topDemandSignal.trade ? ` | trade: ${topDemandSignal.trade}` : ""
            }${
              topDemandSignal.county
                ? ` | county: ${topDemandSignal.county}${topDemandSignal.state ? `, ${topDemandSignal.state}` : ""}`
                : ""
            } | bot: ${topDemandSignal.botFamily} | hits: ${topDemandSignal.hits} | recrawls: ${topDemandSignal.recrawlUrls} | 404s: ${topDemandSignal.status404Count}${
              topDemandSignal.topPath ? ` | hottest URL: ${topDemandSignal.topPath}` : ""
            }`,
            source: "bot_crawl_signals",
            category: topDemandSignal.trade || undefined,
            county: topDemandSignal.county || undefined,
            state: topDemandSignal.state || undefined,
            stateCode: topDemandSignal.state || null,
            countyName: topDemandSignal.county || null,
          },
        ]
      : []),
    ...(activeAlerts || []).slice(0, 3).map((alert) => ({
      id: `alert-${alert.id}`,
      timestamp: new Date(alert.lastEvaluatedAt || alert.startedAt).toISOString(),
      kind: "alert",
      priority:
        alert.severity === "CRITICAL"
          ? ("critical" as LiveStreamPriority)
          : alert.severity === "WARN"
            ? ("high" as LiveStreamPriority)
            : ("medium" as LiveStreamPriority),
      title: alert.name,
      narrative: alert.description,
      source: "alerts",
      stateCode:
        String(alert.labels?.stateCode || "")
          .trim()
          .toUpperCase() || null,
      countyName: String(alert.labels?.countyName || "").trim() || null,
    })),
    ...lisaFeed.feed
      .filter(
        (item) =>
          !["entity_discovery", "county_category_discovery", "action_gating_summary"].includes(
            getEvidenceValue(item.evidence, "signal_class") || ""
          )
      )
      .slice(0, 10)
      .map((item) => toLiveStreamEntryFromLisaItem(item, lisaFeed.generatedAt)),
  ] as LiveStreamSnapshotEntry[];
  const decoratedStream: LiveStreamSnapshotEntry[] = rawStream
    .filter((entry) => {
      if (filters.source && entry.source !== filters.source) return false;
      if (filters.stateCode && entry.stateCode && entry.stateCode !== filters.stateCode)
        return false;
      if (filters.county && entry.countyName) {
        if (!String(entry.countyName).trim().toLowerCase().includes(filters.county)) return false;
      } else if (filters.county && !entry.countyName) {
        return false;
      }
      return true;
    })
    .map((entry) => {
      const truthStatus = resolveEntryTruthStatus(entry);
      return decorateCommercialSignal({
        ...entry,
        truthStatus,
      });
    })
    .sort((a, b) => {
      const scoreDelta = (b.revenueScore || 0) - (a.revenueScore || 0);
      if (scoreDelta !== 0) return scoreDelta;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const stream: LiveStreamSnapshotEntry[] = await Promise.all(
    decoratedStream.slice(0, filters.limit).map((entry) => enrichEntryWithMarketInventory(entry))
  );

  const sourceCounts = stream.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.source] = (acc[entry.source] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      source: filters.source || null,
      stateCode: filters.stateCode || null,
      county: filters.county || null,
      limit: filters.limit,
    },
    summary: {
      truthNow: lisaFeed.summary.truthNow,
      currentLeadCounty: cumulusBrief.summary.currentLeadCounty,
      currentLeadState: cumulusBrief.summary.currentLeadState,
      crawlerRequests24h: crawlerTelemetry.totals24h.total,
      activeAlerts: activeAlerts.length,
      botCrawlSignals: botCrawlFindings.length,
      topBotCrawlHeadline: topBotCrawlFinding?.headline || null,
      sourceCounts,
      degradedSources,
      degradedSourceReasons: Object.keys(degradedSourceReasons).length
        ? degradedSourceReasons
        : undefined,
    },
    stream,
  };
}

export async function refreshLiveStreamSnapshot(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
}): Promise<LiveStreamSnapshot> {
  await ensureLiveStreamSnapshotTables();
  void pruneLiveStreamSnapshotHistoryIfNeeded();
  const filters = normalizeFilters(params || {});
  const snapshot = await buildLiveStreamSnapshot(filters);

  await pool.query("BEGIN");
  try {
    await pool.query(
      `
      delete from admin_live_stream_snapshots
      where coalesce(source_filter, '') = $1
        and coalesce(state_code, '') = $2
        and coalesce(county_filter, '') = $3
        and limit_value = $4
      `,
      [filters.source, filters.stateCode, filters.county, filters.limit]
    );

    await pool.query(
      `
      insert into admin_live_stream_snapshots (
        source_filter,
        state_code,
        county_filter,
        limit_value,
        summary_json,
        stream_json,
        computed_at
      )
      values (nullif($1,''), nullif($2,''), nullif($3,''), $4, $5::jsonb, $6::jsonb, now())
      `,
      [
        filters.source,
        filters.stateCode,
        filters.county,
        filters.limit,
        JSON.stringify(snapshot.summary),
        JSON.stringify(snapshot.stream),
      ]
    );

    await pool.query(
      `
      insert into admin_live_stream_snapshot_history (
        source_filter,
        state_code,
        county_filter,
        limit_value,
        summary_json,
        stream_json,
        computed_at
      )
      values (nullif($1,''), nullif($2,''), nullif($3,''), $4, $5::jsonb, $6::jsonb, now())
      `,
      [
        filters.source,
        filters.stateCode,
        filters.county,
        filters.limit,
        JSON.stringify(snapshot.summary),
        JSON.stringify(snapshot.stream),
      ]
    );

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  return snapshot;
}

export async function getLiveStreamSnapshot(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
  maxSnapshotAgeMinutes?: number;
}): Promise<LiveStreamSnapshot> {
  await ensureLiveStreamSnapshotTables();
  void pruneLiveStreamSnapshotHistoryIfNeeded();
  const filters = normalizeFilters(params || {});
  const maxSnapshotAgeMinutes = Math.max(1, Number(params?.maxSnapshotAgeMinutes || 5));
  const result = await pool.query(
    `
    select summary_json, stream_json, computed_at
    from admin_live_stream_snapshots
    where coalesce(source_filter, '') = $1
      and coalesce(state_code, '') = $2
      and coalesce(county_filter, '') = $3
      and limit_value = $4
    limit 1
    `,
    [filters.source, filters.stateCode, filters.county, filters.limit]
  );
  const row = result.rows?.[0];
  const computedAt = row?.computed_at ? new Date(String(row.computed_at)) : null;
  const summary =
    row?.summary_json && typeof row.summary_json === "object"
      ? (row.summary_json as LiveStreamSnapshot["summary"])
      : null;
  const stream = Array.isArray(row?.stream_json)
    ? (row.stream_json as LiveStreamSnapshotEntry[])
    : [];
  const isStale =
    !computedAt ||
    !Number.isFinite(computedAt.getTime()) ||
    Date.now() - computedAt.getTime() > maxSnapshotAgeMinutes * 60 * 1000;

  if (!row || isStale || shouldRefreshWeakSnapshot({ summary, stream, computedAt })) {
    return refreshLiveStreamSnapshot(filters);
  }

  return {
    generatedAt: computedAt.toISOString(),
    filters: {
      source: filters.source || null,
      stateCode: filters.stateCode || null,
      county: filters.county || null,
      limit: filters.limit,
    },
    summary: summary || {
      truthNow: "",
      currentLeadCounty: null,
      currentLeadState: null,
      crawlerRequests24h: 0,
      activeAlerts: 0,
      botCrawlSignals: 0,
      topBotCrawlHeadline: null,
      sourceCounts: {},
      degradedSources: [],
    },
    stream,
  };
}

export async function getLiveStreamSnapshotHistory(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
  lookbackDays?: number;
}): Promise<LiveStreamSnapshot[]> {
  await ensureLiveStreamSnapshotTables();
  void pruneLiveStreamSnapshotHistoryIfNeeded();
  const filters = normalizeFilters(params || {});
  const historyLimit = Math.max(1, Math.min(20, Number(params?.limit || 10)));
  const lookbackDays = Math.max(
    1,
    Math.min(
      LIVE_STREAM_HISTORY_RETENTION_DAYS,
      Number(params?.lookbackDays || LIVE_STREAM_HISTORY_LOOKBACK_DAYS)
    )
  );
  const result = await pool.query(
    `
    select summary_json, stream_json, computed_at
    from admin_live_stream_snapshot_history
    where coalesce(source_filter, '') = $1
      and coalesce(state_code, '') = $2
      and coalesce(county_filter, '') = $3
      and limit_value = $4
      and computed_at >= now() - ($6::interval)
    order by computed_at desc
    limit $5
    `,
    [
      filters.source,
      filters.stateCode,
      filters.county,
      filters.limit,
      historyLimit,
      `${lookbackDays} days`,
    ]
  );

  return (result.rows || []).map((row) => ({
    generatedAt: new Date(String(row.computed_at || new Date().toISOString())).toISOString(),
    filters: {
      source: filters.source || null,
      stateCode: filters.stateCode || null,
      county: filters.county || null,
      limit: filters.limit,
    },
    summary:
      row.summary_json && typeof row.summary_json === "object"
        ? row.summary_json
        : {
            truthNow: "",
            currentLeadCounty: null,
            currentLeadState: null,
            crawlerRequests24h: 0,
            activeAlerts: 0,
            sourceCounts: {},
            degradedSources: [],
          },
    stream: Array.isArray(row.stream_json) ? row.stream_json : [],
  }));
}
