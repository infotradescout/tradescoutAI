import { desc } from "drizzle-orm";
import { db } from "../db";
import { metalsPriceSnapshots } from "../../shared/schema";

const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000;
const DEFAULT_FETCH_TIMEOUT_MS = 7_000;

type LatestMetalsApiResponse = {
  success?: boolean;
  base?: string;
  timestamp?: number;
  rates?: Record<string, number>;
  error?: { code?: number | string; type?: string; info?: string };
};

type SnapshotRow = typeof metalsPriceSnapshots.$inferSelect;

let inFlightRefresh: Promise<SnapshotRow | null> | null = null;
let lastRefreshAttemptAtMs = 0;

function nowMs() {
  return Date.now();
}

function parseDecimal(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(num) ? num : null;
}

function formatDecimal(value: number | null, digits: number) {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return value.toFixed(digits);
}

function getMetalsApiKey(): string | null {
  const key = String(process.env.METALS_API_KEY || "").trim();
  return key ? key : null;
}

function getMetalsApiUrl(): string {
  return String(process.env.METALS_API_URL || "https://metals-api.com/api/latest").trim();
}

export async function getLatestMetalsPriceSnapshot(): Promise<SnapshotRow | null> {
  const rows = await db
    .select()
    .from(metalsPriceSnapshots)
    .orderBy(desc(metalsPriceSnapshots.asOf))
    .limit(1);
  return rows[0] ?? null;
}

export function isSnapshotStale(snapshot: SnapshotRow, maxAgeMs = DEFAULT_MAX_AGE_MS): boolean {
  const asOf =
    snapshot.asOf instanceof Date
      ? snapshot.asOf.getTime()
      : new Date(snapshot.asOf as any).getTime();
  if (!Number.isFinite(asOf)) return true;
  return nowMs() - asOf > maxAgeMs;
}

async function fetchMetalsApiLatest(timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const apiKey = getMetalsApiKey();
  if (!apiKey) return null;

  const url = new URL(getMetalsApiUrl());
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("base", "USD");
  url.searchParams.set("symbols", "XAU,XAG,XPT,XPD");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url.toString(), { signal: controller.signal });
    const json = (await resp.json()) as LatestMetalsApiResponse;

    if (!json || json.success !== true) {
      const info = json?.error?.info || json?.error?.type || "Unknown provider error";
      throw new Error(`Metals API error: ${info}`);
    }

    const base = String(json.base || "").toUpperCase();
    if (base !== "USD") {
      throw new Error(`Metals API base currency mismatch: expected USD, got ${base || "unknown"}`);
    }

    const rates = json.rates || {};
    const xau = parseDecimal(rates.XAU);
    const xag = parseDecimal(rates.XAG);
    const xpt = parseDecimal(rates.XPT);
    const xpd = parseDecimal(rates.XPD);

    // metals-api returns metal-per-USD when base=USD; invert to get USD-per-oz.
    const xauUsdPerOz = xau && xau > 0 ? 1 / xau : null;
    const xagUsdPerOz = xag && xag > 0 ? 1 / xag : null;
    const xptUsdPerOz = xpt && xpt > 0 ? 1 / xpt : null;
    const xpdUsdPerOz = xpd && xpd > 0 ? 1 / xpd : null;

    const asOf =
      typeof json.timestamp === "number" && Number.isFinite(json.timestamp)
        ? new Date(json.timestamp * 1000)
        : new Date();

    return {
      asOf,
      xauUsdPerOz,
      xagUsdPerOz,
      xptUsdPerOz,
      xpdUsdPerOz,
      raw: json as any,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function refreshMetalsPriceSnapshot(): Promise<SnapshotRow | null> {
  const fetched = await fetchMetalsApiLatest();
  if (!fetched) return null;

  const [created] = await db
    .insert(metalsPriceSnapshots)
    .values({
      asOf: fetched.asOf,
      source: "metals_api",
      baseCurrency: "USD",
      xauUsdPerOz: formatDecimal(fetched.xauUsdPerOz, 4),
      xagUsdPerOz: formatDecimal(fetched.xagUsdPerOz, 4),
      xptUsdPerOz: formatDecimal(fetched.xptUsdPerOz, 4),
      xpdUsdPerOz: formatDecimal(fetched.xpdUsdPerOz, 4),
      raw: fetched.raw,
    } as any)
    .returning();

  return created ?? null;
}

export async function ensureFreshMetalsPriceSnapshot(options?: {
  maxAgeMs?: number;
  waitForFresh?: boolean;
}): Promise<{ snapshot: SnapshotRow | null; refreshed: boolean; refreshInFlight: boolean }> {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const waitForFresh = options?.waitForFresh ?? false;

  const latest = await getLatestMetalsPriceSnapshot();
  if (latest && !isSnapshotStale(latest, maxAgeMs)) {
    return { snapshot: latest, refreshed: false, refreshInFlight: false };
  }

  const apiKey = getMetalsApiKey();
  if (!apiKey) {
    return { snapshot: latest, refreshed: false, refreshInFlight: false };
  }

  // Avoid hammering the provider on hot paths.
  const minAttemptIntervalMs = 10_000;
  if (nowMs() - lastRefreshAttemptAtMs < minAttemptIntervalMs) {
    return { snapshot: latest, refreshed: false, refreshInFlight: Boolean(inFlightRefresh) };
  }

  if (!inFlightRefresh) {
    lastRefreshAttemptAtMs = nowMs();
    inFlightRefresh = refreshMetalsPriceSnapshot()
      .catch((err) => {
        console.error("[MetalsPricing] Refresh failed", err);
        return null;
      })
      .finally(() => {
        inFlightRefresh = null;
      });
  }

  if (!waitForFresh) {
    return { snapshot: latest, refreshed: false, refreshInFlight: true };
  }

  const refreshed = await inFlightRefresh;
  return { snapshot: refreshed ?? latest, refreshed: Boolean(refreshed), refreshInFlight: false };
}
