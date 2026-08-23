import { pool } from "../db";
import { withPoolTransaction } from "../utils/poolTransaction";
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
import {
  buildPublicDirectoryProfile,
  hasPublicDirectoryOfferingFacts,
  sanitizePublicDirectoryDisplayName,
} from "./publicDirectoryBusinessPresentation";
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
type ScoutCountyDemandRow = {
  county_fips?: string | null;
  county_name: string | null;
  state_code: string | null;
  intent: string | null;
  interaction_count: number;
  last_seen_at: string | Date | null;
};
type CountyMetricLeadRow = {
  county_name: string | null;
  state_code: string | null;
  metric_value: number;
  updated_at: string | Date | null;
};
type DirectoryInventoryLeadRow = {
  trade_slug: string;
  county_name: string | null;
  state_code: string | null;
  business_count: number;
  updated_at: string | Date | null;
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
  evidence?: string[];
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
    usabilityAccepted?: number;
    usabilityRejected?: number;
    usabilityAcceptedBySource?: Record<string, number>;
    usabilityRejectedBySource?: Record<string, number>;
    usabilityRejectionReasons?: Record<string, number>;
    usabilityRejectionReasonsBySource?: Record<string, Record<string, number>>;
  };
  stream: LiveStreamSnapshotEntry[];
};

type UsabilityDecision = {
  accepted: boolean;
  reasonCodes: string[];
};

export type LiveLaneEvent = {
  id: string;
  occurredAt: string;
  lane: string;
  source: string;
  eventType: string;
  stateCode: string | null;
  countyName: string | null;
  countyFips: string | null;
  payload: Record<string, unknown>;
};

export type LiveLaneEventStream = {
  generatedAt: string;
  filters: {
    lane: string | null;
    source: string | null;
    stateCode: string | null;
    county: string | null;
    since: string | null;
    cursor: string | null;
    limit: number;
  };
  events: LiveLaneEvent[];
  nextCursor: string | null;
};

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

async function pruneLiveStreamSnapshotHistoryIfNeeded(): Promise<void> {
  const now = Date.now();
  if (now - lastPruneAt < 6 * 60 * 60 * 1000) return;
  if (prunePromise) return prunePromise;

  prunePromise = (async () => {
    try {
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

function normalizeFilters(
  params: {
    source?: string;
    stateCode?: string;
    county?: string;
    limit?: number;
  },
  options?: { minLimit?: number; maxLimit?: number }
) {
  const minLimit = Math.max(1, Number(options?.minLimit || 5));
  const maxLimit = Math.max(minLimit, Number(options?.maxLimit || 100));

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
    limit: Math.max(minLimit, Math.min(maxLimit, Number(params.limit || 20))),
  };
}

function normalizeEventFilters(params: {
  lane?: string;
  source?: string;
  stateCode?: string;
  county?: string;
  since?: string;
  cursor?: string;
  limit?: number;
}) {
  return {
    lane:
      String(params.lane || "")
        .trim()
        .toLowerCase() || "",
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
    since: String(params.since || "").trim() || "",
    cursor: String(params.cursor || "").trim() || "",
    limit: Math.max(1, Math.min(2000, Number(params.limit || 250))),
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

function parseTimestamp(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function isFreshTimestamp(value: string | Date | null | undefined, maxAgeHours: number): boolean {
  const parsed = parseTimestamp(value);
  if (!parsed) return false;
  return Date.now() - parsed.getTime() <= maxAgeHours * 60 * 60 * 1000;
}

function buildStaleReason(label: string, value: string | Date | null | undefined): string {
  const parsed = parseTimestamp(value);
  if (!parsed) return `${label} did not include a valid timestamp`;
  return `${label} is stale (last update ${parsed.toISOString()})`;
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

function stripCountySuffix(value?: string | null): string {
  return String(value || "")
    .replace(/\s+(County|Parish)$/i, "")
    .trim();
}

function extractRouteTarget(text: string): string | null {
  const matches = Array.from(text.matchAll(/(\/[A-Za-z0-9._\-/%]+)/g));
  if (!matches.length) return null;

  const cleaned = matches
    .map((match) => String(match[1] || "").replace(/[.,;:!?]+$/, ""))
    .filter((candidate) => candidate.length > 1);

  const meaningful = cleaned.filter((candidate) => {
    if (isNonCommercialRouteTarget(candidate)) return false;
    if (isGenericRouteTarget(candidate)) return false;
    return true;
  });

  if (meaningful.length > 0) {
    return meaningful.sort((a, b) => {
      const depthA = a.split("/").filter(Boolean).length;
      const depthB = b.split("/").filter(Boolean).length;
      if (depthB !== depthA) return depthB - depthA;
      return b.length - a.length;
    })[0];
  }

  return null;
}

function isGenericRouteTarget(routeTarget: string | null): boolean {
  if (!routeTarget) return false;
  const normalized = routeTarget.toLowerCase().replace(/\/+$/, "");
  const generic = new Set([
    "/",
    "/category",
    "/categories",
    "/trade",
    "/trades",
    "/business",
    "/businesses",
    "/county",
    "/state",
    "/location",
  ]);
  return generic.has(normalized);
}

function normalizeCategoryLabel(category?: string | null): string | undefined {
  const value = String(category || "").trim();
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized === "category" || normalized === "trade" || normalized === "unknown") {
    return undefined;
  }
  return value;
}

function evaluateUsabilityContract(entry: LiveStreamSnapshotEntry): UsabilityDecision {
  const reasonCodes: string[] = [];
  const source = String(entry.source || "").trim();
  if (!source) reasonCodes.push("missing_provenance_source");

  const ts = new Date(String(entry.timestamp || ""));
  if (!Number.isFinite(ts.getTime())) reasonCodes.push("invalid_timestamp");

  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  const category = normalizeCategoryLabel(entry.category);
  const whereAnchor = Boolean(entry.countyName || entry.stateCode || entry.county || entry.state);
  const whatAnchor = Boolean(category || routeTarget || String(entry.kind || "").trim());
  const demandMagnitude = resolveDemandMagnitude(entry);
  const hasWhyEvidence =
    demandMagnitude > 0 ||
    (typeof entry.baselineDeltaPct === "number" && Number.isFinite(entry.baselineDeltaPct)) ||
    (Array.isArray(entry.evidence) && entry.evidence.length > 0) ||
    entry.truthStatus === "current";

  if (!whereAnchor) reasonCodes.push("missing_where");
  if (!whatAnchor) reasonCodes.push("missing_what");
  if (!hasWhyEvidence) reasonCodes.push("missing_why");

  return {
    accepted: reasonCodes.length === 0,
    reasonCodes,
  };
}

function extractNarrativeTag(entry: LiveStreamSnapshotEntry, key: string): string | undefined {
  const pattern = new RegExp(`\\b${key}:\\s*([^|]+)`, "i");
  const match = String(entry.narrative || "").match(pattern);
  if (!match?.[1]) return undefined;
  const value = match[1].trim();
  return value || undefined;
}

function buildContextAnchor(entry: LiveStreamSnapshotEntry): string {
  const countyState = formatCountyState(entry);
  const category = normalizeCategoryLabel(entry.category) || extractNarrativeTag(entry, "trade");
  const bot = extractNarrativeTag(entry, "bot");
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  const pieces: string[] = [];

  if (bot) pieces.push(`bot ${bot}`);
  if (category && countyState) pieces.push(`${category} demand in ${countyState}`);
  else if (category) pieces.push(`${category} demand`);
  else if (countyState) pieces.push(`demand in ${countyState}`);
  if (routeTarget) pieces.push(`route ${routeTarget}`);

  if (pieces.length > 0) return pieces.join(" | ");
  return "active demand context";
}

function isNonCommercialRouteTarget(routeTarget: string | null): boolean {
  if (!routeTarget) return false;
  const normalized = routeTarget.toLowerCase();
  return (
    normalized === "/" ||
    normalized.startsWith("/assets/") ||
    normalized.startsWith("/api/") ||
    normalized === "/sw.js" ||
    normalized === "/robots.txt" ||
    normalized === "/sitemap.xml" ||
    normalized === "/sitemap-index.xml"
  );
}

function extractNotFoundCount(entry: LiveStreamSnapshotEntry): number {
  const text = `${entry.title} ${entry.narrative}`;
  const match = text.match(/404s?:\s*(\d+)/i);
  if (!match) return 0;
  const count = Number.parseInt(match[1], 10);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function dedupeStreamEntries(entries: LiveStreamSnapshotEntry[]): LiveStreamSnapshotEntry[] {
  const byId = new Map<string, LiveStreamSnapshotEntry>();

  const makeSemanticKey = (entry: LiveStreamSnapshotEntry) => {
    const keyParts = [
      entry.source,
      entry.kind,
      String(entry.title || "")
        .trim()
        .toLowerCase(),
      String(entry.countyName || "")
        .trim()
        .toLowerCase(),
      String(entry.stateCode || "")
        .trim()
        .toUpperCase(),
      String(entry.category || "")
        .trim()
        .toLowerCase(),
    ];
    return keyParts.join("|");
  };

  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      continue;
    }

    const existingTs = new Date(existing.timestamp).getTime();
    const nextTs = new Date(entry.timestamp).getTime();
    if (nextTs > existingTs) {
      byId.set(entry.id, entry);
      continue;
    }
    if (nextTs === existingTs && (entry.revenueScore || 0) > (existing.revenueScore || 0)) {
      byId.set(entry.id, entry);
    }
  }

  const bySemanticKey = new Map<string, LiveStreamSnapshotEntry>();
  for (const entry of byId.values()) {
    const semanticKey = makeSemanticKey(entry);
    const existing = bySemanticKey.get(semanticKey);
    if (!existing) {
      bySemanticKey.set(semanticKey, entry);
      continue;
    }

    const existingTs = new Date(existing.timestamp).getTime();
    const nextTs = new Date(entry.timestamp).getTime();
    if (nextTs > existingTs) {
      bySemanticKey.set(semanticKey, entry);
      continue;
    }
    if (nextTs === existingTs && (entry.revenueScore || 0) > (existing.revenueScore || 0)) {
      bySemanticKey.set(semanticKey, entry);
    }
  }

  return Array.from(bySemanticKey.values());
}

function buildTargetMarket(entry: LiveStreamSnapshotEntry): string | undefined {
  const placeLabel = stripCountySuffix(entry.county) || entry.county;
  const countyLabel =
    placeLabel && entry.state ? `${placeLabel}, ${entry.state}` : placeLabel || entry.state;
  const category = normalizeCategoryLabel(entry.category);
  if (countyLabel && category) return `${category} in ${countyLabel}`;
  if (countyLabel) return countyLabel;
  if (category) return category;
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

function parseEvidenceNumber(entry: LiveStreamSnapshotEntry, key: string): number | null {
  const value = getEvidenceValue(entry.evidence, key);
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function resolveDemandMagnitude(entry: LiveStreamSnapshotEntry): number {
  const evidenceCandidates = [
    parseEvidenceNumber(entry, "hits"),
    parseEvidenceNumber(entry, "request_count"),
    parseEvidenceNumber(entry, "crawler_requests_24h"),
    parseEvidenceNumber(entry, "machine_attention_hits"),
    parseEvidenceNumber(entry, "county_surface_requests"),
    parseEvidenceNumber(entry, "metric_value"),
    parseEvidenceNumber(entry, "business_count"),
    parseEvidenceNumber(entry, "interaction_count"),
  ].filter((value): value is number => typeof value === "number" && value > 0);

  if (evidenceCandidates.length) {
    return Math.max(...evidenceCandidates);
  }

  const routeHitsMatch = `${entry.narrative}`.match(/drew\s+(\d+)\s+crawler\s+hits/i);
  if (routeHitsMatch) {
    const parsed = Number.parseInt(routeHitsMatch[1], 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }

  return extractLargestNumber(`${entry.narrative}`);
}

function formatCountyState(entry: LiveStreamSnapshotEntry): string | undefined {
  const placeLabel = stripCountySuffix(entry.county) || entry.county;
  if (placeLabel && entry.state) return `${placeLabel}, ${entry.state}`;
  return placeLabel || entry.state || undefined;
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
  const sourceWeight = {
    scout_interactions: 18,
    tradedeals: 16,
    directory: 15,
    homescout: 14,
    observations: 12,
    lisa: 9,
    cumulus: 9,
    alerts: 8,
    crawler: 4,
    bot_crawl_signals: 5,
    bot_visibility: 5,
  } as const;
  const freshnessWeight = entry.truthStatus === "current" ? 8 : 2;
  const targetWeight = entry.targetMarket ? 8 : 0;
  const categoryWeight = entry.category ? 5 : 0;
  const countyWeight = entry.county ? 5 : 0;
  const baselineWeight = Math.min(12, Math.round(Math.abs(entry.baselineDeltaPct || 0) / 10));
  const numericDemandWeight = Math.min(18, Math.round(resolveDemandMagnitude(entry) / 20));
  return (
    priorityWeight[entry.priority] +
    bucketWeight[entry.commercialBucket || "watchlist"] +
    (sourceWeight[entry.source as keyof typeof sourceWeight] || 6) +
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
  const score = resolveDemandMagnitude(entry);
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
  const category = normalizeCategoryLabel(entry.category);
  if (category && countyState) {
    return `Launch a ${category} county ad push in ${countyState} while attention is active.`;
  }
  if (countyState) return `Launch a county ad push in ${countyState} while attention is active.`;
  if (targetMarket) return `Open a county ad push around ${targetMarket}.`;
  return `Open a county-level ad push around ${buildContextAnchor(entry)}.`;
}

function buildAdChannel(entry: LiveStreamSnapshotEntry): string {
  const countyState = formatCountyState(entry);
  const category = normalizeCategoryLabel(entry.category);
  if (category && countyState) {
    return `${category} county-page ads, local search ads, and paid social in ${countyState}`;
  }
  if (countyState) return `county landing ads, local search ads, and paid social in ${countyState}`;
  const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
  if (routeTarget) return `search and retargeting traffic into ${routeTarget}`;
  return `county landing ads, paid social, and local search coverage for ${buildContextAnchor(entry)}`;
}

function buildAdAsset(entry: LiveStreamSnapshotEntry): string {
  const countyState = formatCountyState(entry);
  const category = normalizeCategoryLabel(entry.category);
  if (category && countyState) {
    return `${category} ad package for ${countyState} and a county market one-sheet`;
  }
  if (countyState) return `${countyState} county ad package and local market one-sheet`;
  return `county ad package and local market one-sheet for ${buildContextAnchor(entry)}`;
}

function buildAdvertiserPlay(entry: LiveStreamSnapshotEntry, targetMarket?: string): string {
  const countyState = formatCountyState(entry);
  const category = normalizeCategoryLabel(entry.category);
  if (category && countyState) {
    return `Pitch ${category} advertisers serving ${countyState} while demand is visible.`;
  }
  if (category) return `Pitch ${category} advertisers around this active demand pocket.`;
  if (targetMarket) return `Pitch advertisers around ${targetMarket}.`;
  return `Pitch advertisers around ${buildContextAnchor(entry)}.`;
}

function buildAdvertiserChannel(entry: LiveStreamSnapshotEntry): string {
  const countyState = formatCountyState(entry);
  const category = normalizeCategoryLabel(entry.category);
  if (category && countyState) {
    return `${category} sponsor outreach in ${countyState}, outbound sales, and local package follow-up`;
  }
  if (category) return `${category} sponsor outreach, outbound sales, and category package pitch`;
  return `sponsor outreach and outbound sales tied to ${buildContextAnchor(entry)}`;
}

function buildAdvertiserAsset(entry: LiveStreamSnapshotEntry): string {
  const countyState = formatCountyState(entry);
  const category = normalizeCategoryLabel(entry.category);
  if (category && countyState) {
    return `${category} advertiser deck for ${countyState} and sponsor package`;
  }
  if (category) return `${category} advertiser deck and sponsor package`;
  return `advertiser deck and sponsor package for ${buildContextAnchor(entry)}`;
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
    const category = normalizeCategoryLabel(entry.category);
    if (category && countyState && surface) {
      return `${category} attention is concentrating on the ${surface} in ${countyState}, which is usable for immediate paid reach.`;
    }
    if (category && countyState) {
      return `${category} attention is concentrating in ${countyState}, which is usable for immediate paid reach.`;
    }
    if (targetMarket)
      return `${targetMarket} is showing live demand you can package into paid reach.`;
    return `This is a live demand pocket you can package into paid reach: ${buildContextAnchor(entry)}.`;
  }

  if (bucket === "advertiser pitches") {
    const category = normalizeCategoryLabel(entry.category);
    if (category && countyState) {
      return `${category} demand is visible in ${countyState}, which makes a direct advertiser or sponsor pitch credible right now.`;
    }
    if (category) {
      return `${category} has active attention you can turn into a sponsor or advertiser story.`;
    }
    return `This demand pocket can support a sponsor or advertiser pitch: ${buildContextAnchor(entry)}.`;
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
    const publicProfile = buildPublicDirectoryProfile(profileData as any);
    const tradeSlug = deriveTradeSlugFromProfileData(publicProfile);
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
        name: sanitizePublicDirectoryDisplayName(row.name),
        slug: String(row.slug || ""),
        updatedAt,
        publicDiscoveryEnabled: Boolean(row.public_discovery_enabled),
        stateCode: row.state_code ? String(row.state_code) : null,
        countyName: row.county_name ? String(row.county_name) : null,
        city: publicProfile.city || null,
        tradeSlug,
        hasPublicOfferingFacts: hasPublicDirectoryOfferingFacts(publicProfile),
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
  const marketLabel = `${stripCountySuffix(entry.county) || entry.county}, ${entry.state}`;
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
      ? `${publicCount} public ${categoryLabel} businesses are already visible in ${marketLabel}.`
      : `No public ${categoryLabel} businesses are currently visible in ${marketLabel}.`;
    if (publicCount === 0) {
      marketGapSummary = `${marketLabel} is showing demand without visible ${categoryLabel} inventory.`;
    } else if (publicCount <= 3) {
      marketGapSummary = `${marketLabel} has thin ${categoryLabel} inventory, so this is both a sell and recruit market.`;
    }
  } else if (viableBusinesses.length > 0) {
    inventorySummary = `${viableBusinesses.length} public businesses are currently visible in ${marketLabel}.`;
    if (viableBusinesses.length <= 3) {
      marketGapSummary = `${marketLabel} has thin visible inventory relative to live demand.`;
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
    entry.kind === "scout_county_demand" ||
    entry.kind === "tradedeals_county_lead" ||
    entry.kind === "directory_inventory_lead" ||
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

  if (entry.kind === "bot_demand_cluster") {
    const routeTarget = extractRouteTarget(`${entry.title} ${entry.narrative}`);
    const has404Pressure = extractNotFoundCount(entry) > 0;

    if (isNonCommercialRouteTarget(routeTarget)) {
      const bucket: CommercialBucket = has404Pressure ? "monetization leaks" : "market moves";
      const stage: MonetizationStage = has404Pressure ? "repair" : "expand";

      const decoratedEntry: LiveStreamSnapshotEntry = {
        ...entry,
        commercialBucket: bucket,
        monetizationStage: stage,
        recommendedPlay: has404Pressure
          ? buildLeakPlay(entry, targetMarket)
          : buildMarketMove(entry, targetMarket),
        salesAngle: buildSalesAngle(entry, bucket, targetMarket),
        targetMarket,
        channelSuggestion: has404Pressure ? buildLeakChannel(entry) : buildMarketChannel(entry),
        assetSuggestion: has404Pressure ? buildLeakAsset(entry) : buildMarketAsset(entry),
        whyNow: buildWhyNow(entry),
      };
      return withRevenueScore(decoratedEntry);
    }

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
    entry.kind === "homescout_county_supply" ||
    entry.kind === "observations_county_lead" ||
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
    evidence: Array.isArray(item.evidence) ? item.evidence : [],
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
  fullSignalCoverage?: boolean;
}): Promise<LiveStreamSnapshot> {
  const fullSignalCoverage = params?.fullSignalCoverage === true;
  const filters = normalizeFilters(params || {}, {
    maxLimit: fullSignalCoverage ? 5000 : 100,
  });
  const leadLimit = fullSignalCoverage ? 25 : 3;
  const crawlerHotspotLimit = fullSignalCoverage ? 20 : 3;
  const lisaFindingLimit = fullSignalCoverage ? 250 : 10;
  const cumulusCountyLimit = fullSignalCoverage ? 10 : 1;
  const cumulusStateLimit = fullSignalCoverage ? 10 : 1;
  const alertLimit = fullSignalCoverage ? 20 : 3;

  const [
    lisaFeedResult,
    crawlerTelemetryResult,
    botDemandSignalsResult,
    cumulusBriefResult,
    activeAlertsResult,
    scoutCountyDemandResult,
    tradeDealsLeadResult,
    homeScoutLeadResult,
    observationsLeadResult,
    directoryInventoryLeadResult,
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
    pool.query<ScoutCountyDemandRow>(
      `
      with scoped as (
        select
          si.county_fips,
          coalesce(c.name, si.county_fips) as county_name,
          coalesce(c.state_code, substring(si.county_fips from 1 for 2)) as state_code,
          nullif(trim(si.intent::text), '') as intent,
          si.created_at
        from scout_interactions si
        left join counties c on c.fips = si.county_fips
        where si.created_at >= now() - interval '24 hours'
          and si.county_fips is not null
          and ($1::text is null or upper(coalesce(c.state_code, substring(si.county_fips from 1 for 2))) = $1)
          and ($2::text is null or lower(coalesce(c.name, si.county_fips)) like '%' || $2 || '%')
      ),
      county_totals as (
        select
          county_fips,
          county_name,
          state_code,
          count(*)::int as interaction_count,
          max(created_at) as last_seen_at
        from scoped
        group by county_fips, county_name, state_code
      ),
      top_intents as (
        select
          county_fips,
          intent,
          row_number() over (
            partition by county_fips
            order by count(*) desc, intent asc nulls last
          ) as rn
        from scoped
        group by county_fips, intent
      )
      select
        ct.county_fips,
        ct.county_name,
        ct.state_code,
        ti.intent,
        ct.interaction_count,
        ct.last_seen_at
      from county_totals ct
      left join top_intents ti
        on ti.county_fips = ct.county_fips
       and ti.rn = 1
      where ct.interaction_count > 0
      order by ct.interaction_count desc, ct.last_seen_at desc, ct.county_name asc
      limit $3
    `,
      [filters.stateCode || null, filters.county || null, leadLimit]
    ),
    pool.query<CountyMetricLeadRow>(
      `
      select
        c.name as county_name,
        c.state_code,
        cm.metric_value::numeric::float8 as metric_value,
        cm.updated_at
      from county_metrics cm
      inner join counties c on c.fips = cm.county_fips
      where cm.metric_key = 'tradedeals_active'
        and cm.metric_value::numeric > 0
        and ($1::text is null or upper(c.state_code) = $1)
        and ($2::text is null or lower(c.name) like '%' || $2 || '%')
      order by cm.metric_value::numeric desc, cm.updated_at desc
      limit $3
    `,
      [filters.stateCode || null, filters.county || null, leadLimit]
    ),
    pool.query<CountyMetricLeadRow>(
      `
      select
        c.name as county_name,
        c.state_code,
        cm.metric_value::numeric::float8 as metric_value,
        cm.updated_at
      from county_metrics cm
      inner join counties c on c.fips = cm.county_fips
      where cm.metric_key = 'homescout_active_listings'
        and cm.metric_value::numeric > 0
        and ($1::text is null or upper(c.state_code) = $1)
        and ($2::text is null or lower(c.name) like '%' || $2 || '%')
      order by cm.metric_value::numeric desc, cm.updated_at desc
      limit $3
    `,
      [filters.stateCode || null, filters.county || null, leadLimit]
    ),
    pool.query<CountyMetricLeadRow>(
      `
      select
        c.name as county_name,
        c.state_code,
        cm.metric_value::numeric::float8 as metric_value,
        cm.updated_at
      from county_metrics cm
      inner join counties c on c.fips = cm.county_fips
      where cm.metric_key = 'observations_30d'
        and cm.metric_value::numeric > 0
        and ($1::text is null or upper(c.state_code) = $1)
        and ($2::text is null or lower(c.name) like '%' || $2 || '%')
      order by cm.metric_value::numeric desc, cm.updated_at desc
      limit $3
    `,
      [filters.stateCode || null, filters.county || null, leadLimit]
    ),
    pool.query<DirectoryInventoryLeadRow>(
      `
      select
        tcp.trade_slug,
        c.name as county_name,
        tcp.state_code,
        tcp.business_count,
        tcp.updated_at
      from ts_seo_trade_county_pages tcp
      inner join counties c on c.id = tcp.county_id
      where tcp.business_count > 0
        and ($1::text is null or upper(tcp.state_code) = $1)
        and ($2::text is null or lower(c.name) like '%' || $2 || '%')
      order by tcp.business_count desc, tcp.updated_at desc
      limit $3
    `,
      [filters.stateCode || null, filters.county || null, leadLimit]
    ),
  ]);

  let lisaFeed = lisaFeedResult.status === "fulfilled" ? lisaFeedResult.value : null;
  let crawlerTelemetry =
    crawlerTelemetryResult.status === "fulfilled" ? crawlerTelemetryResult.value : null;
  const botDemandSignals =
    botDemandSignalsResult.status === "fulfilled" ? botDemandSignalsResult.value : [];
  let cumulusBrief = cumulusBriefResult.status === "fulfilled" ? cumulusBriefResult.value : null;

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
    scoutCountyDemandResult.status === "rejected" ? "scout-interactions" : null,
    tradeDealsLeadResult.status === "rejected" ? "trade-deals" : null,
    homeScoutLeadResult.status === "rejected" ? "homescout" : null,
    observationsLeadResult.status === "rejected" ? "observations" : null,
    directoryInventoryLeadResult.status === "rejected" ? "directory" : null,
  ].filter((value): value is string => Boolean(value));
  const degradedSourceReasons: Record<string, string> = {};
  const degradedSourceSet = new Set(degradedSources);

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
  if (scoutCountyDemandResult.status === "rejected") {
    degradedSourceReasons["scout-interactions"] = summarizeRejectionReason(
      scoutCountyDemandResult.reason
    );
  }
  if (tradeDealsLeadResult.status === "rejected") {
    degradedSourceReasons["trade-deals"] = summarizeRejectionReason(tradeDealsLeadResult.reason);
  }
  if (homeScoutLeadResult.status === "rejected") {
    degradedSourceReasons.homescout = summarizeRejectionReason(homeScoutLeadResult.reason);
  }
  if (observationsLeadResult.status === "rejected") {
    degradedSourceReasons.observations = summarizeRejectionReason(observationsLeadResult.reason);
  }
  if (directoryInventoryLeadResult.status === "rejected") {
    degradedSourceReasons.directory = summarizeRejectionReason(directoryInventoryLeadResult.reason);
  }

  if (lisaFeed && !isFreshTimestamp(lisaFeed.generatedAt, 6)) {
    degradedSourceSet.add("lisa");
    degradedSourceReasons.lisa =
      degradedSourceReasons.lisa || buildStaleReason("LISA feed", lisaFeed.generatedAt);
    lisaFeed = null;
  }
  if (crawlerTelemetry && !isFreshTimestamp(crawlerTelemetry.generatedAt, 6)) {
    degradedSourceSet.add("crawler");
    degradedSourceReasons.crawler =
      degradedSourceReasons.crawler ||
      buildStaleReason("crawler telemetry", crawlerTelemetry.generatedAt);
    crawlerTelemetry = null;
  }
  if (cumulusBrief && !isFreshTimestamp(cumulusBrief.generatedAt, 12)) {
    degradedSourceSet.add("cumulus");
    degradedSourceReasons.cumulus =
      degradedSourceReasons.cumulus || buildStaleReason("Cumulus brief", cumulusBrief.generatedAt);
    cumulusBrief = null;
  }

  const botCrawlFindings = (lisaFeed?.feed || []).filter(
    (item) => item.sourceKind === "bot_crawl_signals"
  );
  let scoutCountyDemandRows =
    scoutCountyDemandResult.status === "fulfilled" ? scoutCountyDemandResult.value.rows : [];
  let tradeDealsLeadRows =
    tradeDealsLeadResult.status === "fulfilled" ? tradeDealsLeadResult.value.rows : [];
  let homeScoutLeadRows =
    homeScoutLeadResult.status === "fulfilled" ? homeScoutLeadResult.value.rows : [];
  let observationsLeadRows =
    observationsLeadResult.status === "fulfilled" ? observationsLeadResult.value.rows : [];
  let directoryInventoryLeadRows =
    directoryInventoryLeadResult.status === "fulfilled"
      ? directoryInventoryLeadResult.value.rows
      : [];

  if (
    scoutCountyDemandRows.length &&
    !scoutCountyDemandRows.some((row) => isFreshTimestamp(row.last_seen_at, 36))
  ) {
    degradedSourceSet.add("scout-interactions");
    degradedSourceReasons["scout-interactions"] =
      degradedSourceReasons["scout-interactions"] ||
      buildStaleReason("Scout interactions", scoutCountyDemandRows[0]?.last_seen_at);
  }
  if (
    tradeDealsLeadRows.length &&
    !tradeDealsLeadRows.some((row) => isFreshTimestamp(row.updated_at, 72))
  ) {
    degradedSourceSet.add("trade-deals");
    degradedSourceReasons["trade-deals"] =
      degradedSourceReasons["trade-deals"] ||
      buildStaleReason("TradeDeals lead", tradeDealsLeadRows[0]?.updated_at);
  }
  if (
    homeScoutLeadRows.length &&
    !homeScoutLeadRows.some((row) => isFreshTimestamp(row.updated_at, 72))
  ) {
    degradedSourceSet.add("homescout");
    degradedSourceReasons.homescout =
      degradedSourceReasons.homescout ||
      buildStaleReason("HomeScout lead", homeScoutLeadRows[0]?.updated_at);
  }
  if (
    observationsLeadRows.length &&
    !observationsLeadRows.some((row) => isFreshTimestamp(row.updated_at, 168))
  ) {
    degradedSourceSet.add("observations");
    degradedSourceReasons.observations =
      degradedSourceReasons.observations ||
      buildStaleReason("observations lead", observationsLeadRows[0]?.updated_at);
  }
  if (
    directoryInventoryLeadRows.length &&
    !directoryInventoryLeadRows.some((row) => isFreshTimestamp(row.updated_at, 168))
  ) {
    degradedSourceSet.add("directory");
    degradedSourceReasons.directory =
      degradedSourceReasons.directory ||
      buildStaleReason("directory inventory", directoryInventoryLeadRows[0]?.updated_at);
  }
  scoutCountyDemandRows = scoutCountyDemandRows.filter((row) =>
    isFreshTimestamp(row.last_seen_at, 36)
  );
  tradeDealsLeadRows = tradeDealsLeadRows.filter((row) => isFreshTimestamp(row.updated_at, 72));
  homeScoutLeadRows = homeScoutLeadRows.filter((row) => isFreshTimestamp(row.updated_at, 72));
  observationsLeadRows = observationsLeadRows.filter((row) =>
    isFreshTimestamp(row.updated_at, 168)
  );
  directoryInventoryLeadRows = directoryInventoryLeadRows.filter((row) =>
    isFreshTimestamp(row.updated_at, 168)
  );

  const topBotCrawlFinding = botCrawlFindings[0] || null;
  const topDemandSignals = botDemandSignals.slice(0, fullSignalCoverage ? 20 : 1);
  const topDemandRoutes = crawlerTelemetry?.topRoutes?.slice(0, fullSignalCoverage ? 30 : 5) || [];
  const topDemandCounties =
    crawlerTelemetry?.topCounties?.slice(0, fullSignalCoverage ? 30 : 5) || [];

  const rawStream = [
    ...(lisaFeed?.summary.truthNow?.trim()
      ? [
          {
            id: `lisa-truth-${lisaFeed.generatedAt}`,
            timestamp: lisaFeed.generatedAt,
            kind: "truth_now",
            priority: "medium" as LiveStreamPriority,
            title: "Current operating truth",
            narrative: lisaFeed.summary.truthNow,
            source: "lisa",
            stateCode: null,
            countyName: null,
          },
        ]
      : []),
    ...scoutCountyDemandRows.slice(0, leadLimit).map((scoutCountyDemand, idx) => ({
      id: `scout-county-demand-${idx}-${String(scoutCountyDemand.state_code || "na")}-${String(
        scoutCountyDemand.county_name || scoutCountyDemand.county_fips || "unknown"
      )
        .toLowerCase()
        .replace(/\s+/g, "-")}`,
      timestamp: scoutCountyDemand.last_seen_at
        ? new Date(scoutCountyDemand.last_seen_at).toISOString()
        : new Date().toISOString(),
      kind: "scout_county_demand",
      priority:
        Number(scoutCountyDemand.interaction_count || 0) >= 20
          ? ("high" as LiveStreamPriority)
          : ("medium" as LiveStreamPriority),
      title: idx === 0 ? "Scout demand pocket" : `Scout demand pocket ${idx + 1}`,
      narrative: `${scoutCountyDemand.county_name}, ${String(
        scoutCountyDemand.state_code || ""
      ).toUpperCase()} produced ${Number(
        scoutCountyDemand.interaction_count || 0
      )} first-party Scout interactions in the last 24 hours${
        scoutCountyDemand.intent
          ? `, led by ${String(scoutCountyDemand.intent).replace(/_/g, " ")} intent`
          : ""
      }. This is direct on-site user demand, not crawler traffic.`,
      source: "scout_interactions",
      county: String(scoutCountyDemand.county_name),
      state: String(scoutCountyDemand.state_code || "").toUpperCase(),
      stateCode: String(scoutCountyDemand.state_code || "").toUpperCase() || null,
      countyName: String(scoutCountyDemand.county_name),
    })),
    ...tradeDealsLeadRows.slice(0, leadLimit).map((tradeDealsLead, idx) => ({
      id: `tradedeals-county-${idx}-${String(tradeDealsLead.state_code || "na")}-${String(
        tradeDealsLead.county_name || "unknown"
      )
        .toLowerCase()
        .replace(/\s+/g, "-")}`,
      timestamp: tradeDealsLead.updated_at
        ? new Date(tradeDealsLead.updated_at).toISOString()
        : new Date().toISOString(),
      kind: "tradedeals_county_lead",
      priority:
        Number(tradeDealsLead.metric_value || 0) >= 10
          ? ("high" as LiveStreamPriority)
          : ("medium" as LiveStreamPriority),
      title: idx === 0 ? "TradeDeals active county" : `TradeDeals active county ${idx + 1}`,
      narrative: `${tradeDealsLead.county_name}, ${String(
        tradeDealsLead.state_code || ""
      ).toUpperCase()} currently has ${Math.round(
        Number(tradeDealsLead.metric_value || 0)
      )} active TradeDeals. This is active promotional inventory already operating on-site.`,
      source: "tradedeals",
      county: String(tradeDealsLead.county_name),
      state: String(tradeDealsLead.state_code || "").toUpperCase(),
      stateCode: String(tradeDealsLead.state_code || "").toUpperCase() || null,
      countyName: String(tradeDealsLead.county_name),
    })),
    ...homeScoutLeadRows.slice(0, leadLimit).map((homeScoutLead, idx) => ({
      id: `homescout-county-${idx}-${String(homeScoutLead.state_code || "na")}-${String(
        homeScoutLead.county_name || "unknown"
      )
        .toLowerCase()
        .replace(/\s+/g, "-")}`,
      timestamp: homeScoutLead.updated_at
        ? new Date(homeScoutLead.updated_at).toISOString()
        : new Date().toISOString(),
      kind: "homescout_county_supply",
      priority:
        Number(homeScoutLead.metric_value || 0) >= 25
          ? ("high" as LiveStreamPriority)
          : ("medium" as LiveStreamPriority),
      title: idx === 0 ? "HomeScout supply pocket" : `HomeScout supply pocket ${idx + 1}`,
      narrative: `${homeScoutLead.county_name}, ${String(
        homeScoutLead.state_code || ""
      ).toUpperCase()} currently has ${Math.round(
        Number(homeScoutLead.metric_value || 0)
      )} active HomeScout listings. This is first-party marketplace supply already live on-site.`,
      source: "homescout",
      county: String(homeScoutLead.county_name),
      state: String(homeScoutLead.state_code || "").toUpperCase(),
      stateCode: String(homeScoutLead.state_code || "").toUpperCase() || null,
      countyName: String(homeScoutLead.county_name),
    })),
    ...observationsLeadRows.slice(0, leadLimit).map((observationsLead, idx) => ({
      id: `observations-county-${idx}-${String(observationsLead.state_code || "na")}-${String(
        observationsLead.county_name || "unknown"
      )
        .toLowerCase()
        .replace(/\s+/g, "-")}`,
      timestamp: observationsLead.updated_at
        ? new Date(observationsLead.updated_at).toISOString()
        : new Date().toISOString(),
      kind: "observations_county_lead",
      priority:
        Number(observationsLead.metric_value || 0) >= 50
          ? ("high" as LiveStreamPriority)
          : ("medium" as LiveStreamPriority),
      title: idx === 0 ? "Observation-rich county" : `Observation-rich county ${idx + 1}`,
      narrative: `${observationsLead.county_name}, ${String(
        observationsLead.state_code || ""
      ).toUpperCase()} has ${Math.round(
        Number(observationsLead.metric_value || 0)
      )} canonical observations on record. This is first-party county reality data, not just traffic telemetry.`,
      source: "observations",
      county: String(observationsLead.county_name),
      state: String(observationsLead.state_code || "").toUpperCase(),
      stateCode: String(observationsLead.state_code || "").toUpperCase() || null,
      countyName: String(observationsLead.county_name),
    })),
    ...directoryInventoryLeadRows.slice(0, leadLimit).map((directoryInventoryLead, idx) => ({
      id: `directory-inventory-${idx}-${directoryInventoryLead.trade_slug}-${String(
        directoryInventoryLead.state_code || "na"
      )}-${String(directoryInventoryLead.county_name || "unknown")
        .toLowerCase()
        .replace(/\s+/g, "-")}`,
      timestamp: directoryInventoryLead.updated_at
        ? new Date(directoryInventoryLead.updated_at).toISOString()
        : new Date().toISOString(),
      kind: "directory_inventory_lead",
      priority:
        Number(directoryInventoryLead.business_count || 0) >= 8
          ? ("high" as LiveStreamPriority)
          : ("medium" as LiveStreamPriority),
      title:
        idx === 0
          ? "Public business inventory pocket"
          : `Public business inventory pocket ${idx + 1}`,
      narrative: `${directoryInventoryLead.county_name}, ${String(
        directoryInventoryLead.state_code || ""
      ).toUpperCase()} currently exposes ${Math.round(
        Number(directoryInventoryLead.business_count || 0)
      )} public ${String(directoryInventoryLead.trade_slug).replace(
        /-/g,
        " "
      )} businesses on-platform. This is direct directory inventory you can sell around or recruit into.`,
      source: "directory",
      category: String(directoryInventoryLead.trade_slug).replace(/-/g, " "),
      county: String(directoryInventoryLead.county_name),
      state: String(directoryInventoryLead.state_code || "").toUpperCase(),
      stateCode: String(directoryInventoryLead.state_code || "").toUpperCase() || null,
      countyName: String(directoryInventoryLead.county_name),
    })),
    ...(cumulusBrief?.topCounties || []).slice(0, cumulusCountyLimit).map((countyLead, idx) => ({
      id: `cumulus-county-${cumulusBrief?.generatedAt || "na"}-${countyLead.countyFips}-${idx}`,
      timestamp: cumulusBrief?.generatedAt || new Date().toISOString(),
      kind: "county_lead",
      priority: idx === 0 ? ("high" as LiveStreamPriority) : ("medium" as LiveStreamPriority),
      title: idx === 0 ? "County lead requiring attention" : `County lead ${idx + 1}`,
      narrative: `${countyLead.countyName}, ${countyLead.stateCode} is showing ${countyLead.requestCount} requests on ${countyLead.dominantSurface.replace(/_/g, " ")}.`,
      source: "cumulus",
      stateCode: countyLead.stateCode,
      countyName: countyLead.countyName,
    })),
    ...(cumulusBrief?.topStates || []).slice(0, cumulusStateLimit).map((stateLead, idx) => ({
      id: `cumulus-state-${cumulusBrief?.generatedAt || "na"}-${stateLead.stateCode}-${idx}`,
      timestamp: cumulusBrief?.generatedAt || new Date().toISOString(),
      kind: "state_lead",
      priority: idx === 0 ? ("medium" as LiveStreamPriority) : ("low" as LiveStreamPriority),
      title: idx === 0 ? "Leading State Cluster" : `State cluster ${idx + 1}`,
      narrative: `${stateLead.stateCode} has ${stateLead.requestCount} requests across ${stateLead.countyCount} counties.`,
      source: "cumulus",
      stateCode: stateLead.stateCode,
      countyName: null,
    })),
    ...(crawlerTelemetry
      ? [
          {
            id: `crawler-total-${crawlerTelemetry.generatedAt}`,
            timestamp: crawlerTelemetry.generatedAt,
            kind: "crawler_volume",
            priority: "medium" as LiveStreamPriority,
            title: "Crawler Volume",
            narrative: `${crawlerTelemetry.totals24h.total} crawler requests were observed in the last 24 hours with ${crawlerTelemetry.totals24h.ok} returning 2xx and ${crawlerTelemetry.totals24h.serverError} returning 5xx.`,
            source: "crawler",
            stateCode: null,
            countyName: null,
          },
        ]
      : []),
    ...(crawlerTelemetry?.topBots?.[0]
      ? [
          {
            id: `crawler-bot-${crawlerTelemetry.generatedAt}-${crawlerTelemetry.topBots[0].botName}`,
            timestamp: crawlerTelemetry?.generatedAt || new Date().toISOString(),
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
    ...topDemandRoutes.slice(0, crawlerHotspotLimit).map((route, idx) => ({
      id: `crawler-route-demand-${crawlerTelemetry?.generatedAt || "na"}-${idx}-${route.path}`,
      timestamp: crawlerTelemetry?.generatedAt || new Date().toISOString(),
      kind: "crawler_route_demand",
      priority: idx === 0 ? ("high" as LiveStreamPriority) : ("medium" as LiveStreamPriority),
      title: `Route demand hotspot ${idx + 1}`,
      narrative: `${route.path} drew ${route.requestCount} crawler hits in the last 24 hours. This is a specific route to inspect for health, canonicalization, and whether the page is actually usable.`,
      source: "crawler",
      stateCode: null,
      countyName: null,
    })),
    ...topDemandCounties.slice(0, crawlerHotspotLimit).map((county, idx) => ({
      id: `crawler-county-demand-${crawlerTelemetry?.generatedAt || "na"}-${idx}-${county.countyFips || county.countyName}`,
      timestamp: crawlerTelemetry?.generatedAt || new Date().toISOString(),
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
    ...topDemandSignals.map((topDemandSignal, idx) => ({
      id: `bot-demand-cluster-${topDemandSignal.date}-${topDemandSignal.routeFamily}-${idx}`,
      timestamp: crawlerTelemetry?.generatedAt || new Date().toISOString(),
      kind: "bot_demand_cluster",
      priority:
        topDemandSignal.status404Count >= 5 || topDemandSignal.hits >= 20
          ? ("critical" as LiveStreamPriority)
          : ("high" as LiveStreamPriority),
      title: idx === 0 ? "Bot demand cluster (route + trade)" : `Bot demand cluster ${idx + 1}`,
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
    })),
    ...(activeAlerts || []).slice(0, alertLimit).map((alert) => ({
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
    ...(lisaFeed?.feed || [])
      .filter(
        (item) =>
          !["entity_discovery", "county_category_discovery", "action_gating_summary"].includes(
            getEvidenceValue(item.evidence, "signal_class") || ""
          )
      )
      .slice(0, lisaFindingLimit)
      .map((item) =>
        toLiveStreamEntryFromLisaItem(item, lisaFeed?.generatedAt || new Date().toISOString())
      ),
  ] as LiveStreamSnapshotEntry[];
  const filteredRawStream = rawStream.filter((entry) => {
    if (filters.source && entry.source !== filters.source) return false;
    if (filters.stateCode && entry.stateCode && entry.stateCode !== filters.stateCode) return false;
    if (filters.county && entry.countyName) {
      if (!String(entry.countyName).trim().toLowerCase().includes(filters.county)) return false;
    } else if (filters.county && !entry.countyName) {
      return false;
    }
    return true;
  });

  const acceptanceBySource: Record<string, number> = {};
  const rejectionBySource: Record<string, number> = {};
  const rejectionReasons: Record<string, number> = {};
  const rejectionReasonsBySource: Record<string, Record<string, number>> = {};
  const contractAccepted: LiveStreamSnapshotEntry[] = [];

  for (const entry of filteredRawStream) {
    const sourceKey = String(entry.source || "unknown");
    const truthStatus = resolveEntryTruthStatus(entry);
    const normalized = { ...entry, truthStatus };
    const decision = evaluateUsabilityContract(normalized);
    if (decision.accepted) {
      acceptanceBySource[sourceKey] = (acceptanceBySource[sourceKey] || 0) + 1;
      contractAccepted.push(normalized);
      continue;
    }

    rejectionBySource[sourceKey] = (rejectionBySource[sourceKey] || 0) + 1;
    if (!rejectionReasonsBySource[sourceKey]) rejectionReasonsBySource[sourceKey] = {};
    for (const code of decision.reasonCodes) {
      rejectionReasons[code] = (rejectionReasons[code] || 0) + 1;
      rejectionReasonsBySource[sourceKey][code] =
        (rejectionReasonsBySource[sourceKey][code] || 0) + 1;
    }
  }

  const decoratedStream: LiveStreamSnapshotEntry[] = dedupeStreamEntries(
    contractAccepted.map((entry) => decorateCommercialSignal(entry))
  ).sort((a, b) => {
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
      truthNow: lisaFeed?.summary.truthNow?.trim() || "",
      currentLeadCounty: cumulusBrief?.summary.currentLeadCounty || null,
      currentLeadState: cumulusBrief?.summary.currentLeadState || null,
      crawlerRequests24h: crawlerTelemetry?.totals24h.total || 0,
      activeAlerts: activeAlerts.length,
      botCrawlSignals: botCrawlFindings.length,
      topBotCrawlHeadline: topBotCrawlFinding?.headline || null,
      sourceCounts,
      degradedSources: Array.from(degradedSourceSet),
      degradedSourceReasons: Object.keys(degradedSourceReasons).length
        ? degradedSourceReasons
        : undefined,
      usabilityAccepted: contractAccepted.length,
      usabilityRejected: Math.max(0, filteredRawStream.length - contractAccepted.length),
      usabilityAcceptedBySource: acceptanceBySource,
      usabilityRejectedBySource: rejectionBySource,
      usabilityRejectionReasons: rejectionReasons,
      usabilityRejectionReasonsBySource: rejectionReasonsBySource,
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
  await pruneLiveStreamSnapshotHistoryIfNeeded();
  const filters = normalizeFilters(params || {});
  const snapshot = await buildLiveStreamSnapshot(filters);

  await withPoolTransaction(pool, async (client) => {
    await client.query(
      `
      delete from admin_live_stream_snapshots
      where coalesce(source_filter, '') = $1
        and coalesce(state_code, '') = $2
        and coalesce(county_filter, '') = $3
        and limit_value = $4
      `,
      [filters.source, filters.stateCode, filters.county, filters.limit]
    );

    await client.query(
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

    await client.query(
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
  });

  return snapshot;
}

export async function getLiveStreamSnapshot(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
  maxSnapshotAgeMinutes?: number;
}): Promise<LiveStreamSnapshot> {
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
  if (!row || !computedAt || !Number.isFinite(computedAt.getTime())) {
    throw new Error(
      "No persisted live-stream snapshot is available; run the explicit refresh action."
    );
  }

  const isStale = Date.now() - computedAt.getTime() > maxSnapshotAgeMinutes * 60 * 1000;
  const isWeak = shouldRefreshWeakSnapshot({ summary, stream, computedAt });
  const degradedSources = new Set(summary?.degradedSources || []);
  const degradedSourceReasons = { ...(summary?.degradedSourceReasons || {}) };
  if (isStale || isWeak) {
    degradedSources.add("live_stream_snapshot");
    degradedSourceReasons.live_stream_snapshot = isStale
      ? `Persisted snapshot is older than ${maxSnapshotAgeMinutes} minutes; use Refresh snapshots to recompute it.`
      : "Persisted snapshot failed the usability threshold; use Refresh snapshots to recompute it.";
  }

  return {
    generatedAt: computedAt.toISOString(),
    filters: {
      source: filters.source || null,
      stateCode: filters.stateCode || null,
      county: filters.county || null,
      limit: filters.limit,
    },
    summary: summary
      ? {
          ...summary,
          degradedSources: Array.from(degradedSources),
          degradedSourceReasons,
        }
      : {
          truthNow: "",
          currentLeadCounty: null,
          currentLeadState: null,
          crawlerRequests24h: 0,
          activeAlerts: 0,
          botCrawlSignals: 0,
          topBotCrawlHeadline: null,
          sourceCounts: {},
          degradedSources: [],
          usabilityAccepted: 0,
          usabilityRejected: 0,
          usabilityAcceptedBySource: {},
          usabilityRejectedBySource: {},
          usabilityRejectionReasons: {},
          usabilityRejectionReasonsBySource: {},
        },
    stream:
      isStale || isWeak
        ? stream.map((entry) => ({ ...entry, truthStatus: "stale" as const }))
        : stream,
  };
}

export async function getLiveStreamSnapshotHistory(params?: {
  source?: string;
  stateCode?: string;
  county?: string;
  limit?: number;
  lookbackDays?: number;
}): Promise<LiveStreamSnapshot[]> {
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
            usabilityAccepted: 0,
            usabilityRejected: 0,
            usabilityAcceptedBySource: {},
            usabilityRejectedBySource: {},
            usabilityRejectionReasons: {},
            usabilityRejectionReasonsBySource: {},
          },
    stream: Array.isArray(row.stream_json) ? row.stream_json : [],
  }));
}

export async function getLiveLaneEvents(params?: {
  lane?: string;
  source?: string;
  stateCode?: string;
  county?: string;
  since?: string;
  cursor?: string;
  limit?: number;
}): Promise<LiveLaneEventStream> {
  const filters = normalizeEventFilters(params || {});
  const cursorTs = filters.cursor ? new Date(filters.cursor) : null;
  const sinceTs = filters.since ? new Date(filters.since) : null;
  const cursorIso = cursorTs && Number.isFinite(cursorTs.getTime()) ? cursorTs.toISOString() : "";
  const sinceIso = sinceTs && Number.isFinite(sinceTs.getTime()) ? sinceTs.toISOString() : "";

  const result = await pool.query<{
    id: string;
    occurred_at: string | Date;
    lane: string;
    source: string;
    event_type: string;
    state_code: string | null;
    county_name: string | null;
    county_fips: string | null;
    payload_json: Record<string, unknown> | null;
  }>(
    `
    with lane_events as (
      select
        si.id::text as id,
        si.created_at as occurred_at,
        'action'::text as lane,
        'scout_interactions'::text as source,
        coalesce(si.intent::text, 'unknown') as event_type,
        upper(coalesce(c.state_code, substring(si.county_fips from 1 for 2))) as state_code,
        c.name as county_name,
        si.county_fips as county_fips,
        jsonb_build_object(
          'intent', si.intent::text,
          'outcome', si.outcome::text,
          'failureReason', si.failure_reason::text,
          'confidence', si.scout_confidence,
          'userRole', si.user_role::text
        ) as payload_json
      from scout_interactions si
      left join counties c on c.fips = si.county_fips

      union all

      select
        cre.id::text as id,
        cre.observed_at as occurred_at,
        'crawl_visibility'::text as lane,
        'crawler_request_events'::text as source,
        coalesce(nullif(trim(cre.request_type), ''), 'request') as event_type,
        upper(cre.state_code) as state_code,
        c2.name as county_name,
        cre.county_fips as county_fips,
        jsonb_build_object(
          'botName', cre.bot_name,
          'path', cre.path,
          'statusCode', cre.status_code,
          'statusClass', cre.status_class,
          'sourceSurface', cre.source_surface,
          'requestType', cre.request_type
        ) as payload_json
      from crawler_request_events cre
      left join counties c2 on c2.fips = cre.county_fips

      union all

      select
        buf.id::text as id,
        buf.created_at as occurred_at,
        'trust'::text as lane,
        'bot_ui_findings'::text as source,
        coalesce(nullif(trim(buf.failure_type::text), ''), 'ui_finding') as event_type,
        null::text as state_code,
        null::text as county_name,
        null::text as county_fips,
        jsonb_build_object(
          'botName', buf.bot_name,
          'route', buf.route,
          'severity', buf.severity,
          'failureType', buf.failure_type::text,
          'actionAttempted', buf.action_attempted,
          'expectedOutcome', buf.expected_outcome,
          'actualOutcome', buf.actual_outcome
        ) as payload_json
      from bot_ui_findings buf
    )
    select
      id,
      occurred_at,
      lane,
      source,
      event_type,
      state_code,
      county_name,
      county_fips,
      payload_json
    from lane_events
    where ($1::text = '' or lane = $1)
      and ($2::text = '' or source = $2)
      and ($3::text = '' or upper(coalesce(state_code, '')) = $3)
      and ($4::text = '' or lower(coalesce(county_name, county_fips, '')) like '%' || $4 || '%')
      and ($5::timestamptz is null or occurred_at >= $5::timestamptz)
      and ($6::timestamptz is null or occurred_at < $6::timestamptz)
    order by occurred_at desc, id desc
    limit $7
    `,
    [
      filters.lane,
      filters.source,
      filters.stateCode,
      filters.county,
      sinceIso || null,
      cursorIso || null,
      filters.limit,
    ]
  );

  const events: LiveLaneEvent[] = (result.rows || []).map((row) => ({
    id: String(row.id),
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
    lane: String(row.lane || "unknown"),
    source: String(row.source || "unknown"),
    eventType: String(row.event_type || "unknown"),
    stateCode: row.state_code ? String(row.state_code).toUpperCase() : null,
    countyName: row.county_name ? String(row.county_name) : null,
    countyFips: row.county_fips ? String(row.county_fips) : null,
    payload: row.payload_json && typeof row.payload_json === "object" ? row.payload_json : {},
  }));

  const nextCursor = events.length === filters.limit ? events[events.length - 1].occurredAt : null;

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      lane: filters.lane || null,
      source: filters.source || null,
      stateCode: filters.stateCode || null,
      county: filters.county || null,
      since: sinceIso || null,
      cursor: cursorIso || null,
      limit: filters.limit,
    },
    events,
    nextCursor,
  };
}
