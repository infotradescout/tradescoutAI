import { sql } from "drizzle-orm";
import { db } from "../db";

export type ActiveTradeScope = {
  tradeSlug: string;
  businessCount: number;
};

export type ActiveStateScope = {
  stateCode: string;
  businessCount: number;
};

export type ActiveCountyScope = {
  countySlug: string;
  businessCount: number;
};

type ActiveCountySnapshotRow = {
  tradeSlug: string;
  stateCode: string;
  countySlug: string;
  businessCount: number;
};

type DirectoryScopeSnapshot = {
  rows: ActiveCountySnapshotRow[];
  loadedAt: number;
};

const SNAPSHOT_TTL_MS = 5 * 60 * 1000;
let cachedSnapshot: DirectoryScopeSnapshot | null = null;
let refreshPromise: Promise<DirectoryScopeSnapshot> | null = null;

function resultRows(result: unknown): Array<Record<string, unknown>> {
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows)
    ? rows.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    : [];
}

function positiveCount(value: unknown): number {
  const count = Number(value || 0);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function normalizedSnapshotRows(result: unknown): ActiveCountySnapshotRow[] {
  return resultRows(result)
    .map((row) => ({
      tradeSlug: String(row.trade_slug || "")
        .trim()
        .toLowerCase(),
      stateCode: String(row.state_code || "")
        .trim()
        .toUpperCase(),
      countySlug: String(row.county_slug || "")
        .trim()
        .toLowerCase(),
      businessCount: positiveCount(row.business_count),
    }))
    .filter(
      (row) =>
        /^[a-z0-9-]+$/.test(row.tradeSlug) &&
        /^[A-Z]{2}$/.test(row.stateCode) &&
        /^[a-z0-9-]+$/.test(row.countySlug) &&
        row.businessCount > 0
    );
}

async function loadDirectoryScopeSnapshot(): Promise<DirectoryScopeSnapshot> {
  const result = await db.execute(sql`
    select
      trade_slug,
      state_code,
      county_slug,
      sum(business_count)::int as business_count
    from ts_seo_trade_county_pages
    where coalesce(trade_slug, '') <> ''
      and coalesce(state_code, '') <> ''
      and coalesce(county_slug, '') <> ''
      and business_count > 0
    group by trade_slug, state_code, county_slug
    order by trade_slug asc, state_code asc, county_slug asc;
  `);

  return {
    rows: normalizedSnapshotRows(result),
    loadedAt: Date.now(),
  };
}

async function readDirectoryScopeSnapshot(): Promise<DirectoryScopeSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now - cachedSnapshot.loadedAt < SNAPSHOT_TTL_MS) {
    return cachedSnapshot;
  }
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const snapshot = await loadDirectoryScopeSnapshot();
      cachedSnapshot = snapshot;
      return snapshot;
    } catch (error) {
      if (cachedSnapshot) {
        console.warn(
          "[SEO] Active directory snapshot refresh failed; using the last known public scope set",
          error
        );
        cachedSnapshot = { ...cachedSnapshot, loadedAt: now };
        return cachedSnapshot;
      }
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function aggregateScopes<T extends string>(
  rows: ActiveCountySnapshotRow[],
  readKey: (row: ActiveCountySnapshotRow) => T
): Array<{ key: T; businessCount: number }> {
  const totals = new Map<T, number>();
  for (const row of rows) {
    const key = readKey(row);
    totals.set(key, (totals.get(key) || 0) + row.businessCount);
  }
  return [...totals.entries()]
    .map(([key, businessCount]) => ({ key, businessCount }))
    .filter((row) => row.businessCount > 0)
    .sort((left, right) => right.businessCount - left.businessCount || left.key.localeCompare(right.key));
}

export async function listActiveTradeScopes(): Promise<ActiveTradeScope[]> {
  const snapshot = await readDirectoryScopeSnapshot();
  return aggregateScopes(snapshot.rows, (row) => row.tradeSlug).map((row) => ({
    tradeSlug: row.key,
    businessCount: row.businessCount,
  }));
}

export async function listActiveTradeStateScopes(tradeSlug: string): Promise<ActiveStateScope[]> {
  const normalizedTradeSlug = String(tradeSlug || "")
    .trim()
    .toLowerCase();
  const snapshot = await readDirectoryScopeSnapshot();
  return aggregateScopes(
    snapshot.rows.filter((row) => row.tradeSlug === normalizedTradeSlug),
    (row) => row.stateCode
  ).map((row) => ({
    stateCode: row.key,
    businessCount: row.businessCount,
  }));
}

export async function listActiveTradeCountyScopes(
  tradeSlug: string,
  stateCode: string
): Promise<ActiveCountyScope[]> {
  const normalizedTradeSlug = String(tradeSlug || "")
    .trim()
    .toLowerCase();
  const normalizedStateCode = String(stateCode || "")
    .trim()
    .toUpperCase();
  const snapshot = await readDirectoryScopeSnapshot();
  return aggregateScopes(
    snapshot.rows.filter(
      (row) => row.tradeSlug === normalizedTradeSlug && row.stateCode === normalizedStateCode
    ),
    (row) => row.countySlug
  ).map((row) => ({
    countySlug: row.key,
    businessCount: row.businessCount,
  }));
}

export async function listActiveCountyTradeScopes(
  stateCode: string,
  countySlug: string
): Promise<ActiveTradeScope[]> {
  const normalizedStateCode = String(stateCode || "")
    .trim()
    .toUpperCase();
  const normalizedCountySlug = String(countySlug || "")
    .trim()
    .toLowerCase();
  const snapshot = await readDirectoryScopeSnapshot();
  return aggregateScopes(
    snapshot.rows.filter(
      (row) => row.stateCode === normalizedStateCode && row.countySlug === normalizedCountySlug
    ),
    (row) => row.tradeSlug
  ).map((row) => ({
    tradeSlug: row.key,
    businessCount: row.businessCount,
  }));
}

export async function hasActiveTradeScope(tradeSlug: string): Promise<boolean> {
  const normalizedTradeSlug = String(tradeSlug || "")
    .trim()
    .toLowerCase();
  const snapshot = await readDirectoryScopeSnapshot();
  return snapshot.rows.some((row) => row.tradeSlug === normalizedTradeSlug);
}

export async function hasActiveTradeStateScope(
  tradeSlug: string,
  stateCode: string
): Promise<boolean> {
  const normalizedTradeSlug = String(tradeSlug || "")
    .trim()
    .toLowerCase();
  const normalizedStateCode = String(stateCode || "")
    .trim()
    .toUpperCase();
  const snapshot = await readDirectoryScopeSnapshot();
  return snapshot.rows.some(
    (row) => row.tradeSlug === normalizedTradeSlug && row.stateCode === normalizedStateCode
  );
}

export async function hasActiveTradeCountyScope(
  tradeSlug: string,
  stateCode: string,
  countySlug: string
): Promise<boolean> {
  const normalizedTradeSlug = String(tradeSlug || "")
    .trim()
    .toLowerCase();
  const normalizedStateCode = String(stateCode || "")
    .trim()
    .toUpperCase();
  const normalizedCountySlug = String(countySlug || "")
    .trim()
    .toLowerCase();
  const snapshot = await readDirectoryScopeSnapshot();
  return snapshot.rows.some(
    (row) =>
      row.tradeSlug === normalizedTradeSlug &&
      row.stateCode === normalizedStateCode &&
      row.countySlug === normalizedCountySlug
  );
}

export function resetSeoDirectoryNavigationCacheForTests(): void {
  cachedSnapshot = null;
  refreshPromise = null;
}
