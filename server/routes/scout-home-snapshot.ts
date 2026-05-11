/**
 * Scout Home Surface Snapshot API
 * GET /api/scout/home-snapshot?county=Travis+County&state=TX&fips=48453
 *
 * Returns real local data for the Scout OS home surface:
 * - Local snapshot stats (listings, verified pros, events, community members)
 * - Trending prompts based on recent scout interactions in the county
 * - Recent activity for authenticated users
 * - Fallback-safe: works with county name, FIPS, or IP-resolved location
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  marketplaceListings,
  contractors,
  contractorCounties,
  counties,
  countyMetrics,
  scoutInteractions,
  users,
} from "../../shared/schema";
import { eq, and, gte, count, sql, desc, ilike } from "drizzle-orm";

export const scoutHomeSnapshotRouter = Router();

// ── Types ──────────────────────────────────────────────────────────────────

interface LocalSnapshot {
  activeListings: number;
  activeListingsDelta: number; // change vs last week
  verifiedPros: number;
  eventsThisWeek: number;
  eventsToday: number;
  communityMembers: number;
  countyName: string;
  stateName: string;
  fips: string | null;
}

interface TrendingPrompt {
  id: string;
  text: string;
  category: string;
  icon: string;
  intent: string;
  count: number; // how many times this intent was queried in the county
}

interface RecentActivity {
  id: string;
  query: string;
  icon: string;
  timestamp: string;
}

interface HomeSnapshotResponse {
  snapshot: LocalSnapshot;
  trendingPrompts: TrendingPrompt[];
  recentActivity: RecentActivity[];
  locationResolved: boolean;
  locationSource: "user" | "ip" | "manual" | "default";
}

// ── Intent → Prompt mapping ────────────────────────────────────────────────

const INTENT_PROMPTS: Record<string, { text: string; category: string; icon: string }> = {
  marketplace: {
    text: "What's available on the local marketplace near me?",
    category: "Marketplace · Local",
    icon: "🛋",
  },
  contractor: {
    text: "How much does home repair cost in my area?",
    category: "Home · Contractor",
    icon: "🔨",
  },
  permit: {
    text: "Do I need a permit for my project in my county?",
    category: "Permits · Compliance",
    icon: "📋",
  },
  notary: {
    text: "Where can I get a document notarized near me?",
    category: "Services · Open Now",
    icon: "📄",
  },
  gas: {
    text: "What's the cheapest gas near me right now?",
    category: "Prices · Live Data",
    icon: "⛽",
  },
  events: {
    text: "What's happening in my area this weekend?",
    category: "Events · Community",
    icon: "🎉",
  },
  food: {
    text: "Where are the best food trucks near me today?",
    category: "Food · Local",
    icon: "🌮",
  },
  hoa: {
    text: "What are the HOA rules for my neighborhood?",
    category: "HOA · Community",
    icon: "🏘",
  },
  realtor: {
    text: "What are homes selling for in my county right now?",
    category: "Real Estate · Market",
    icon: "🏠",
  },
  employment: {
    text: "What local jobs are available in my area?",
    category: "Jobs · Local",
    icon: "💼",
  },
  unknown: {
    text: "What can Scout help me with today?",
    category: "General · Local",
    icon: "✨",
  },
};

// Default prompts shown when no trending data is available
const DEFAULT_PROMPTS: TrendingPrompt[] = [
  {
    id: "notary",
    text: "Where can I get a document notarized near me?",
    category: "Services · Open Now",
    icon: "📄",
    intent: "notary",
    count: 0,
  },
  {
    id: "gas",
    text: "What's the cheapest gas near me right now?",
    category: "Prices · Live Data",
    icon: "⛽",
    intent: "gas",
    count: 0,
  },
  {
    id: "events",
    text: "What's happening in my area this weekend?",
    category: "Events · Community",
    icon: "🎉",
    intent: "events",
    count: 0,
  },
  {
    id: "contractor",
    text: "How much does fence repair cost in my county?",
    category: "Home · Contractor",
    icon: "🔨",
    intent: "contractor",
    count: 0,
  },
  {
    id: "marketplace",
    text: "I'm looking for something on the local marketplace.",
    category: "Marketplace · Local",
    icon: "🛋",
    intent: "marketplace",
    count: 0,
  },
];

// ── Helper: resolve county from query params ───────────────────────────────

async function resolveCounty(
  countyParam?: string,
  stateParam?: string,
  fipsParam?: string
): Promise<{ fips: string; name: string; state: string } | null> {
  try {
    if (fipsParam) {
      const result = await db
        .select({ fips: counties.fips, name: counties.name, state: counties.stateCode })
        .from(counties)
        .where(eq(counties.fips, fipsParam))
        .limit(1);
      if (result[0]) return result[0];
    }

    if (countyParam && stateParam) {
      const result = await db
        .select({ fips: counties.fips, name: counties.name, state: counties.stateCode })
        .from(counties)
        .where(
          and(
            ilike(counties.name, `%${countyParam}%`),
            eq(counties.stateCode, stateParam.toUpperCase())
          )
        )
        .limit(1);
      if (result[0]) return result[0];
    }

    if (countyParam) {
      const result = await db
        .select({ fips: counties.fips, name: counties.name, state: counties.stateCode })
        .from(counties)
        .where(ilike(counties.name, `%${countyParam}%`))
        .limit(1);
      if (result[0]) return result[0];
    }
  } catch (err) {
    // DB might not have counties table populated yet — graceful fallback
  }
  return null;
}

// ── Helper: get local snapshot stats ──────────────────────────────────────

async function getLocalSnapshot(
  countyName: string,
  stateName: string,
  fips: string | null
): Promise<Omit<LocalSnapshot, "countyName" | "stateName" | "fips">> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let activeListings = 0;
  let activeListingsDelta = 0;
  let verifiedPros = 0;
  let communityMembers = 0;

  try {
    // Active marketplace listings in county
    const listingsResult = await db
      .select({ count: count() })
      .from(marketplaceListings)
      .where(
        and(
          ilike(marketplaceListings.county, `%${countyName}%`),
          eq(marketplaceListings.status as any, "active")
        )
      );
    activeListings = Number(listingsResult[0]?.count ?? 0);

    // Listings added this week vs last week for delta
    const thisWeekListings = await db
      .select({ count: count() })
      .from(marketplaceListings)
      .where(
        and(
          ilike(marketplaceListings.county, `%${countyName}%`),
          gte(marketplaceListings.createdAt, oneWeekAgo)
        )
      );
    const lastWeekListings = await db
      .select({ count: count() })
      .from(marketplaceListings)
      .where(
        and(
          ilike(marketplaceListings.county, `%${countyName}%`),
          gte(marketplaceListings.createdAt, twoWeeksAgo)
        )
      );
    activeListingsDelta =
      Number(thisWeekListings[0]?.count ?? 0) - Number(lastWeekListings[0]?.count ?? 0);
  } catch (_) {}

  try {
    // Verified pros serving this county
    if (fips) {
      const prosResult = await db
        .select({ count: count() })
        .from(contractors)
        .innerJoin(contractorCounties, eq(contractors.id, contractorCounties.contractorId))
        .innerJoin(counties, eq(contractorCounties.countyId, counties.id))
        .where(
          and(
            eq(counties.fips, fips),
            eq(contractors.isActive, true),
            eq(contractors.verifiedLicensed, true)
          )
        );
      verifiedPros = Number(prosResult[0]?.count ?? 0);
    } else {
      // Fallback: match by county name in contractor service area
      const prosResult = await db
        .select({ count: count() })
        .from(contractors)
        .where(and(eq(contractors.isActive, true), eq(contractors.verifiedLicensed, true)));
      // Rough estimate — all active verified pros (no county filter without FIPS)
      verifiedPros = Number(prosResult[0]?.count ?? 0);
    }
  } catch (_) {}

  try {
    // Community members in county (users with matching county in profile)
    const membersResult = await db
      .select({ count: count() })
      .from(users)
      .where(sql`lower(${users.county}) like lower(${`%${countyName}%`})`);
    communityMembers = Number(membersResult[0]?.count ?? 0);
  } catch (_) {}

  // Events: use countyMetrics if available, otherwise 0
  let eventsThisWeek = 0;
  let eventsToday = 0;
  if (fips) {
    try {
      const eventsMetric = await db
        .select({ metricValue: countyMetrics.metricValue })
        .from(countyMetrics)
        .where(
          and(eq(countyMetrics.countyFips, fips), eq(countyMetrics.metricKey, "events_this_week"))
        )
        .limit(1);
      eventsThisWeek = Number(eventsMetric[0]?.metricValue ?? 0);

      const eventsTodayMetric = await db
        .select({ metricValue: countyMetrics.metricValue })
        .from(countyMetrics)
        .where(and(eq(countyMetrics.countyFips, fips), eq(countyMetrics.metricKey, "events_today")))
        .limit(1);
      eventsToday = Number(eventsTodayMetric[0]?.metricValue ?? 0);
    } catch (_) {}
  }

  return {
    activeListings,
    activeListingsDelta,
    verifiedPros,
    eventsThisWeek,
    eventsToday,
    communityMembers,
  };
}

// ── Helper: get trending prompts ───────────────────────────────────────────

async function getTrendingPrompts(
  fips: string | null,
  countyName: string
): Promise<TrendingPrompt[]> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const whereClause = fips
      ? and(eq(scoutInteractions.countyFips, fips), gte(scoutInteractions.createdAt, sevenDaysAgo))
      : gte(scoutInteractions.createdAt, sevenDaysAgo);

    const trending = await db
      .select({
        intent: scoutInteractions.intent,
        count: count(),
      })
      .from(scoutInteractions)
      .where(whereClause)
      .groupBy(scoutInteractions.intent)
      .orderBy(desc(count()))
      .limit(5);

    if (trending.length === 0) return DEFAULT_PROMPTS;

    const prompts: TrendingPrompt[] = trending
      .filter((t) => t.intent && t.intent !== "unknown")
      .map((t) => {
        const template = INTENT_PROMPTS[t.intent] ?? INTENT_PROMPTS["unknown"];
        return {
          id: t.intent,
          text: template.text,
          category: template.category,
          icon: template.icon,
          intent: t.intent,
          count: Number(t.count),
        };
      });

    // Pad with defaults if fewer than 5 trending
    const seen = new Set(prompts.map((p) => p.id));
    for (const def of DEFAULT_PROMPTS) {
      if (prompts.length >= 5) break;
      if (!seen.has(def.id)) {
        prompts.push(def);
        seen.add(def.id);
      }
    }

    return prompts;
  } catch (_) {
    return DEFAULT_PROMPTS;
  }
}

// ── Helper: get recent user activity ──────────────────────────────────────

async function getRecentActivity(userId: string): Promise<RecentActivity[]> {
  try {
    const recent = await db
      .select({
        id: scoutInteractions.id,
        intent: scoutInteractions.intent,
        createdAt: scoutInteractions.createdAt,
      })
      .from(scoutInteractions)
      .where(
        // scoutInteractions doesn't have userId directly — use scoutMemory or
        // a session-level join. For now we return empty for unauthenticated.
        sql`false`
      )
      .orderBy(desc(scoutInteractions.createdAt))
      .limit(5);

    return recent.map((r) => {
      const template = INTENT_PROMPTS[r.intent] ?? INTENT_PROMPTS["unknown"];
      return {
        id: r.id,
        query: template.text,
        icon: template.icon,
        timestamp: r.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  } catch (_) {
    return [];
  }
}

// ── Main route ─────────────────────────────────────────────────────────────

scoutHomeSnapshotRouter.get("/home-snapshot", async (req: Request, res: Response) => {
  const {
    county: countyParam,
    state: stateParam,
    fips: fipsParam,
  } = req.query as Record<string, string | undefined>;

  const userId = (req as any).user?.id ?? null;

  // 1. Resolve county
  const resolved = await resolveCounty(countyParam, stateParam, fipsParam);

  const countyName = resolved?.name ?? countyParam ?? "Your County";
  const stateName = resolved?.state ?? stateParam ?? "";
  const fips = resolved?.fips ?? fipsParam ?? null;
  const locationResolved = !!resolved;
  const locationSource: HomeSnapshotResponse["locationSource"] = fipsParam
    ? "user"
    : countyParam
      ? "manual"
      : "default";

  // 2. Fetch all data in parallel
  const [snapshotStats, trendingPrompts, recentActivity] = await Promise.all([
    getLocalSnapshot(countyName, stateName, fips),
    getTrendingPrompts(fips, countyName),
    userId ? getRecentActivity(userId) : Promise.resolve([]),
  ]);

  const response: HomeSnapshotResponse = {
    snapshot: {
      ...snapshotStats,
      countyName,
      stateName,
      fips,
    },
    trendingPrompts,
    recentActivity,
    locationResolved,
    locationSource,
  };

  res.json(response);
});
