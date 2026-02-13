/**
 * HomeScout Alerts Job (P1)
 *
 * Uses saved_searches (search_type='homescout') and emits real_time_notifications
 * for new listings and price drops since lastNotified.
 *
 * Notes:
 * - This job is deliberately conservative to avoid spam.
 * - It only uses DB facts (no UI compute).
 */

import { pool } from "../db";
import { storage } from "../storage";

type AlertCounts = { newListings: number; priceDrops: number };

function safeInt(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function parseFilters(filters: any): {
  countyFips?: string;
  stateCode?: string;
  propertyType?: string;
  bedsMin?: number;
  bathsMin?: number;
  priceMin?: number;
  priceMax?: number;
  maxDomDays?: number;
  sqftMin?: number;
  query?: string;
} {
  const f = filters && typeof filters === "object" ? filters : {};
  const out: any = {};
  if (typeof f.countyFips === "string" && /^\d{5}$/.test(f.countyFips))
    out.countyFips = f.countyFips;
  if (typeof f.stateCode === "string" && /^[A-Za-z]{2}$/.test(f.stateCode))
    out.stateCode = String(f.stateCode).toUpperCase();
  if (typeof f.propertyType === "string" && f.propertyType.trim())
    out.propertyType = f.propertyType.trim();
  if (f.bedsMin != null && Number.isFinite(Number(f.bedsMin))) out.bedsMin = Number(f.bedsMin);
  if (f.bathsMin != null && Number.isFinite(Number(f.bathsMin))) out.bathsMin = Number(f.bathsMin);
  if (f.priceMin != null && Number.isFinite(Number(f.priceMin))) out.priceMin = Number(f.priceMin);
  if (f.priceMax != null && Number.isFinite(Number(f.priceMax))) out.priceMax = Number(f.priceMax);
  if (f.maxDomDays != null && Number.isFinite(Number(f.maxDomDays)))
    out.maxDomDays = Number(f.maxDomDays);
  if (f.sqftMin != null && Number.isFinite(Number(f.sqftMin))) out.sqftMin = Number(f.sqftMin);
  if (typeof f.query === "string" && f.query.trim()) out.query = f.query.trim();
  return out;
}

async function computeCountsSince(params: {
  since: Date;
  filters: ReturnType<typeof parseFilters>;
}): Promise<AlertCounts> {
  const { since, filters } = params;
  const predicates: string[] = ["status = 'active'"];
  const values: any[] = [since];

  // $1 is always "since"
  const push = (sqlFrag: string, value?: any) => {
    if (value === undefined) return;
    values.push(value);
    predicates.push(sqlFrag.replace("?", `$${values.length}`));
  };

  if (filters.countyFips) push(`county_fips = ?`, filters.countyFips);
  if (filters.stateCode) push(`state_code = ?`, filters.stateCode);
  if (filters.propertyType) push(`property_type = ?`, filters.propertyType);
  if (Number.isFinite(filters.bedsMin as any)) push(`beds >= ?`, filters.bedsMin);
  if (Number.isFinite(filters.bathsMin as any)) push(`baths >= ?`, filters.bathsMin);
  if (Number.isFinite(filters.sqftMin as any)) push(`sqft >= ?`, filters.sqftMin);
  if (Number.isFinite(filters.priceMin as any)) push(`price::numeric >= ?`, filters.priceMin);
  if (Number.isFinite(filters.priceMax as any)) push(`price::numeric <= ?`, filters.priceMax);

  if (Number.isFinite(filters.maxDomDays as any) && Number(filters.maxDomDays) > 0) {
    const days = Math.min(3650, Math.max(1, Number(filters.maxDomDays)));
    predicates.push(`listed_at >= (now() - (${days}::int || ' days')::interval)`);
  }

  if (filters.query) {
    values.push(`%${filters.query.replace(/[\\%_]/g, "\\\\$&")}%`);
    predicates.push(`(title ILIKE $${values.length} OR city ILIKE $${values.length})`);
  }

  const where = predicates.length ? `WHERE ${predicates.join(" AND ")}` : "";

  const newRes = await pool.query(
    `
    SELECT COUNT(*)::int AS c
    FROM home_scout_listings
    ${where}
      AND listed_at IS NOT NULL
      AND listed_at >= $1
  `,
    values
  );

  const dropsRes = await pool.query(
    `
    SELECT COUNT(*)::int AS c
    FROM home_scout_listings
    ${where}
      AND price_changed_at IS NOT NULL
      AND price_changed_at >= $1
      AND price_previous IS NOT NULL
      AND price_previous::numeric > price::numeric
  `,
    values
  );

  return {
    newListings: safeInt(newRes.rows?.[0]?.c),
    priceDrops: safeInt(dropsRes.rows?.[0]?.c),
  };
}

export async function runHomeScoutAlertsJob(): Promise<{
  timestamp: Date;
  searchesProcessed: number;
  notificationsSent: number;
  errors: Array<{ searchId: string; error: string }>;
}> {
  const ts = new Date();
  const errors: Array<{ searchId: string; error: string }> = [];
  let processed = 0;
  let sent = 0;

  const searches = await storage.listSavedSearchesForAlerts({
    searchType: "homescout",
    limit: 500,
  });

  for (const s of searches) {
    processed++;
    try {
      const since = (s as any).lastNotified
        ? new Date((s as any).lastNotified)
        : new Date((s as any).createdAt || ts);
      const filters = parseFilters((s as any).filters);
      const counts = await computeCountsSince({ since, filters });

      const total = counts.newListings + counts.priceDrops;
      if (total <= 0) {
        continue;
      }

      const parts: string[] = [];
      if (counts.newListings) parts.push(`${counts.newListings} new`);
      if (counts.priceDrops)
        parts.push(`${counts.priceDrops} price drop${counts.priceDrops === 1 ? "" : "s"}`);

      const title = "HomeScout alert";
      const message = `Updates since your last check: ${parts.join(", ")}.`;
      const actionUrl =
        filters.stateCode && filters.countyFips
          ? `/homescout/${encodeURIComponent(filters.stateCode)}/${encodeURIComponent(filters.countyFips)}`
          : "/real-estate-marketplace";

      await storage.createRealTimeNotification({
        userId: (s as any).userId,
        type: "listing",
        title,
        message,
        actionUrl,
        isRead: false,
        sentViaEmail: false,
        createdAt: new Date(),
      } as any);

      await storage.touchSavedSearchLastNotified({ id: s.id, at: ts });
      sent++;
    } catch (err) {
      errors.push({ searchId: s.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { timestamp: ts, searchesProcessed: processed, notificationsSent: sent, errors };
}
