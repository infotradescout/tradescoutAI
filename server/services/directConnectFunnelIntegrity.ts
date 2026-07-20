import { pool } from "../db";
import { storage } from "../storage";
import { readPositiveIntegerEnv } from "../utils/rateLimitConfig";

// Canonical, contract-locked Direct Connect funnel order (see
// server/tests/direct-connect-kpi-funnel.contract.test.ts). Stall detection
// only ever reasons about these exact event-type strings -- never invents
// its own stage vocabulary.
export const DIRECT_CONNECT_FUNNEL_ORDER = [
  "direct_connect_request_started",
  "direct_connect_request_review_opened",
  "direct_connect_request_submitted",
  "direct_connect_visible_to_contractors",
  "direct_connect_request_visible_to_contractors",
  "direct_connect_contractor_action_started",
  "direct_connect_requester_reply_viewed",
] as const;

const SCHEMA_VERSION = 1;

function resolveReleaseSha(): string {
  return (
    process.env.RENDER_GIT_COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_REF ||
    "unknown"
  );
}

export type DirectConnectFunnelEventRow = {
  identityKey: string; // "u:<userId>" or "anon:<anonymousSessionId>"
  eventType: string;
  createdAt: Date;
};

export type DirectConnectFunnelStall = {
  identityKey: string;
  funnelStep: string;
  startedAt: Date;
};

/**
 * Pure computation over already-fetched rows: segments each identity's
 * timeline into attempts bounded by consecutive "request_started" events,
 * and flags an attempt as stalled when no further funnel-stage event
 * followed it within `windowMs` and it hasn't already been logged. Kept
 * free of any I/O so the stall math itself is directly unit-testable.
 */
export function computeDirectConnectFunnelStalls(params: {
  events: DirectConnectFunnelEventRow[];
  alreadyStalled: Array<{ identityKey: string; startedAt: Date }>;
  windowMs: number;
  now: Date;
}): DirectConnectFunnelStall[] {
  const { events, alreadyStalled, windowMs, now } = params;

  const byIdentity = new Map<string, DirectConnectFunnelEventRow[]>();
  for (const row of events) {
    const list = byIdentity.get(row.identityKey) || [];
    list.push(row);
    byIdentity.set(row.identityKey, list);
  }

  const alreadyStalledKeys = new Set(
    alreadyStalled.map((entry) => `${entry.identityKey}::${entry.startedAt.getTime()}`)
  );

  const stalls: DirectConnectFunnelStall[] = [];

  for (const [identityKey, rows] of byIdentity) {
    const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const startedEvents = sorted.filter(
      (row) => row.eventType === "direct_connect_request_started"
    );

    for (let index = 0; index < startedEvents.length; index += 1) {
      const started = startedEvents[index];
      const nextStarted = startedEvents[index + 1];
      const attemptEndMs = nextStarted ? nextStarted.createdAt.getTime() : Number.POSITIVE_INFINITY;

      const hasFurtherStep = sorted.some(
        (row) =>
          row.eventType !== "direct_connect_request_started" &&
          row.createdAt.getTime() > started.createdAt.getTime() &&
          row.createdAt.getTime() < attemptEndMs
      );
      if (hasFurtherStep) continue;

      const elapsedMs = now.getTime() - started.createdAt.getTime();
      if (elapsedMs < windowMs) continue;

      const dedupeKey = `${identityKey}::${started.createdAt.getTime()}`;
      if (alreadyStalledKeys.has(dedupeKey)) continue;

      stalls.push({
        identityKey,
        funnelStep: "direct_connect_request_started",
        startedAt: started.createdAt,
      });
    }
  }

  return stalls;
}

/**
 * Server-derived only. Queries the persisted event stream (never a
 * client-side timer), computes stalls with a configurable time window, and
 * logs one high-severity direct_connect_funnel_step_stalled event per newly
 * detected stall through the existing events table. Idempotent across runs.
 */
export async function detectDirectConnectFunnelStalls(options?: {
  windowMs?: number;
  lookbackMs?: number;
  now?: Date;
}): Promise<{ scanned: number; stalled: number }> {
  const windowMs =
    options?.windowMs ??
    readPositiveIntegerEnv("DIRECT_CONNECT_FUNNEL_STALL_WINDOW_MS", 30 * 60 * 1000);
  const lookbackMs =
    options?.lookbackMs ??
    readPositiveIntegerEnv("DIRECT_CONNECT_FUNNEL_STALL_LOOKBACK_MS", 24 * 60 * 60 * 1000);
  const now = options?.now ?? new Date();
  const lookbackStart = new Date(now.getTime() - lookbackMs);

  const eventsResult = await pool.query(
    `
    SELECT
      CASE
        WHEN user_id IS NOT NULL THEN 'u:' || user_id
        WHEN data->>'anonymousSessionId' IS NOT NULL THEN 'anon:' || (data->>'anonymousSessionId')
        ELSE NULL
      END AS identity_key,
      event_type,
      created_at
    FROM events
    WHERE event_type = ANY($1::text[])
      AND created_at >= $2
      AND created_at <= $3
      AND (user_id IS NOT NULL OR data->>'anonymousSessionId' IS NOT NULL)
    `,
    [DIRECT_CONNECT_FUNNEL_ORDER, lookbackStart, now]
  );

  const stalledResult = await pool.query(
    `
    SELECT
      CASE
        WHEN user_id IS NOT NULL THEN 'u:' || user_id
        WHEN data->>'anonymousSessionId' IS NOT NULL THEN 'anon:' || (data->>'anonymousSessionId')
        ELSE NULL
      END AS identity_key,
      (data->>'funnelStartedAt') AS started_at
    FROM events
    WHERE event_type = 'direct_connect_funnel_step_stalled'
      AND created_at >= $1
    `,
    [lookbackStart]
  );

  const events: DirectConnectFunnelEventRow[] = eventsResult.rows
    .filter((row: any) => row.identity_key)
    .map((row: any) => ({
      identityKey: String(row.identity_key),
      eventType: String(row.event_type),
      createdAt: new Date(row.created_at),
    }));

  const alreadyStalled = stalledResult.rows
    .filter((row: any) => row.identity_key && row.started_at)
    .map((row: any) => ({
      identityKey: String(row.identity_key),
      startedAt: new Date(row.started_at),
    }));

  const stalls = computeDirectConnectFunnelStalls({ events, alreadyStalled, windowMs, now });

  for (const stall of stalls) {
    const identityFields = stall.identityKey.startsWith("u:")
      ? { userId: stall.identityKey.slice(2) }
      : { anonymousSessionId: stall.identityKey.slice(5) };

    await storage.logEvent("direct_connect_funnel_step_stalled", {
      eventName: "direct_connect_funnel_step_stalled",
      lane: "direct_connect_conversion_integrity",
      severity: "high",
      schema_version: SCHEMA_VERSION,
      release_sha: resolveReleaseSha(),
      client_build: "server",
      funnelStep: stall.funnelStep,
      funnelStartedAt: stall.startedAt.toISOString(),
      ...identityFields,
      ts: now.toISOString(),
    });
  }

  return { scanned: events.length, stalled: stalls.length };
}
