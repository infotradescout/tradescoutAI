import type { PoolClient } from "pg";
import { pool } from "../db";
import { storage } from "../storage";
import { readPositiveIntegerEnv } from "../utils/rateLimitConfig";
import {
  computeDirectConnectFunnelStalls,
  DIRECT_CONNECT_FUNNEL_ORDER,
  type DirectConnectFunnelEventRow,
  type DirectConnectFunnelStage,
  type ExistingDirectConnectFunnelStall,
} from "./directConnectFunnelIntegrityCore";

export { computeDirectConnectFunnelStalls, DIRECT_CONNECT_FUNNEL_ORDER };

export const DIRECT_CONNECT_FUNNEL_EVENT_TYPES = [
  "direct_connect_request_started",
  "direct_connect_request_review_opened",
  "direct_connect_request_submitted",
  "direct_connect_visible_to_contractors",
  "direct_connect_request_visible_to_contractors",
  "direct_connect_contractor_action_started",
  "direct_connect_requester_reply_viewed",
] as const;

const ADVISORY_LOCK_KEY = "tradescout:direct-connect-funnel-stall-detector:v1";
const SCHEMA_VERSION = 2;
const DEFAULT_WINDOW_MS = 30 * 60 * 1000;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_START_DELAY_MS = 90 * 1000;
const DEFAULT_MAX_ROWS = 10_000;

let detectorTimer: ReturnType<typeof setInterval> | null = null;
let startupTimer: ReturnType<typeof setTimeout> | null = null;
let detectorRunInFlight: Promise<unknown> | null = null;

function resolveReleaseSha(): string {
  return (
    process.env.RENDER_GIT_COMMIT ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_REF ||
    "unknown"
  );
}

function severityForStage(stage: DirectConnectFunnelStage): "medium" | "high" {
  return stage === "direct_connect_request_submitted" ? "high" : "medium";
}

function inspectionHintForStage(stage: DirectConnectFunnelStage): string {
  switch (stage) {
    case "direct_connect_request_started":
      return "inspect_request_composer_and_review_entry";
    case "direct_connect_request_review_opened":
      return "inspect_review_validation_and_auth_handoff";
    case "direct_connect_request_submitted":
      return "inspect_dispatch_and_provider_visibility";
    case "direct_connect_visible_to_contractors":
      return "inspect_provider_inbox_and_action_authority";
    case "direct_connect_contractor_action_started":
      return "inspect_requester_reply_delivery_and_open_state";
    case "direct_connect_requester_reply_viewed":
      return "complete";
  }
}

async function acquireDetectorLock(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS acquired",
    [ADVISORY_LOCK_KEY]
  );
  return result.rows[0]?.acquired === true;
}

async function releaseDetectorLock(client: PoolClient): Promise<void> {
  try {
    await client.query("SELECT pg_advisory_unlock(hashtext($1)::bigint)", [ADVISORY_LOCK_KEY]);
  } catch (error) {
    console.error("[direct-connect-friction] failed to release detector lock", error);
  }
}

/**
 * Reads only bounded first-party funnel metadata already persisted by
 * TradeScout. It creates one durable issue signal per attempt and highest
 * stalled stage. No request text, message content, contact data, IP address,
 * or browser fingerprint is queried or written.
 */
export async function detectDirectConnectFunnelStalls(options?: {
  windowMs?: number;
  lookbackMs?: number;
  maxRows?: number;
  now?: Date;
}): Promise<{ scanned: number; stalled: number; lockAcquired: boolean }> {
  const windowMs =
    options?.windowMs ??
    readPositiveIntegerEnv("DIRECT_CONNECT_FUNNEL_STALL_WINDOW_MS", DEFAULT_WINDOW_MS);
  const lookbackMs =
    options?.lookbackMs ??
    readPositiveIntegerEnv("DIRECT_CONNECT_FUNNEL_STALL_LOOKBACK_MS", DEFAULT_LOOKBACK_MS);
  const maxRows = Math.min(
    50_000,
    Math.max(
      1,
      options?.maxRows ??
        readPositiveIntegerEnv("DIRECT_CONNECT_FUNNEL_STALL_MAX_ROWS", DEFAULT_MAX_ROWS)
    )
  );
  const now = options?.now ?? new Date();
  const lookbackStart = new Date(now.getTime() - lookbackMs);
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    lockAcquired = await acquireDetectorLock(client);
    if (!lockAcquired) return { scanned: 0, stalled: 0, lockAcquired: false };

    // Select the newest bounded window first, then restore chronological order
    // for the pure state-machine computation. Taking the oldest rows under a
    // LIMIT can drop a recent completion event and falsely label a request as
    // stalled during a traffic spike.
    const eventsResult = await client.query(
      `
      SELECT identity_key, event_type, created_at
      FROM (
        SELECT
          CASE
            WHEN user_id IS NOT NULL THEN 'u:' || user_id
            WHEN data->>'anonymousSessionId' IS NOT NULL
              THEN 'anon:' || (data->>'anonymousSessionId')
            ELSE NULL
          END AS identity_key,
          event_type,
          created_at
        FROM events
        WHERE event_type = ANY($1::text[])
          AND created_at >= $2
          AND created_at <= $3
          AND (user_id IS NOT NULL OR data->>'anonymousSessionId' IS NOT NULL)
        ORDER BY created_at DESC
        LIMIT $4
      ) AS recent_funnel_events
      ORDER BY created_at ASC
      `,
      [DIRECT_CONNECT_FUNNEL_EVENT_TYPES, lookbackStart, now, maxRows]
    );

    const stalledResult = await client.query(
      `
      SELECT identity_key, started_at, funnel_step
      FROM (
        SELECT
          CASE
            WHEN user_id IS NOT NULL THEN 'u:' || user_id
            WHEN data->>'anonymousSessionId' IS NOT NULL
              THEN 'anon:' || (data->>'anonymousSessionId')
            ELSE NULL
          END AS identity_key,
          data->>'funnelStartedAt' AS started_at,
          data->>'funnelStep' AS funnel_step,
          created_at
        FROM events
        WHERE event_type = 'direct_connect_funnel_step_stalled'
          AND created_at >= $1
        ORDER BY created_at DESC
        LIMIT $2
      ) AS recent_funnel_stalls
      ORDER BY created_at ASC
      `,
      [lookbackStart, maxRows]
    );

    const events: DirectConnectFunnelEventRow[] = eventsResult.rows
      .filter((row: any) => row.identity_key)
      .map((row: any) => ({
        identityKey: String(row.identity_key),
        eventType: String(row.event_type),
        createdAt: new Date(row.created_at),
      }));

    const alreadyStalled: ExistingDirectConnectFunnelStall[] = stalledResult.rows
      .filter((row: any) => row.identity_key && row.started_at)
      .map((row: any) => ({
        identityKey: String(row.identity_key),
        startedAt: new Date(row.started_at),
        funnelStep: row.funnel_step ? String(row.funnel_step) : null,
      }));

    const stalls = computeDirectConnectFunnelStalls({
      events,
      alreadyStalled,
      windowMs,
      now,
    });

    for (const stall of stalls) {
      const identityFields = stall.identityKey.startsWith("u:")
        ? { userId: stall.identityKey.slice(2) }
        : { anonymousSessionId: stall.identityKey.slice(5) };

      await storage.logEvent("direct_connect_funnel_step_stalled", {
        surface: "direct_connect",
        source: "server_funnel_detector",
        severity: severityForStage(stall.funnelStep),
        schemaVersion: SCHEMA_VERSION,
        releaseSha: resolveReleaseSha(),
        funnelStep: stall.funnelStep,
        funnelStartedAt: stall.startedAt.toISOString(),
        funnelStepReachedAt: stall.stepReachedAt.toISOString(),
        elapsedMs: Math.max(0, now.getTime() - stall.stepReachedAt.getTime()),
        blocked: false,
        inspectNext: inspectionHintForStage(stall.funnelStep),
        ...identityFields,
      });
    }

    return { scanned: events.length, stalled: stalls.length, lockAcquired: true };
  } finally {
    if (lockAcquired) await releaseDetectorLock(client);
    client.release();
  }
}

async function runDetectorSafely(): Promise<void> {
  if (detectorRunInFlight) return;
  detectorRunInFlight = detectDirectConnectFunnelStalls().catch((error) => {
    console.error("[direct-connect-friction] funnel detector failed", error);
  });
  try {
    await detectorRunInFlight;
  } finally {
    detectorRunInFlight = null;
  }
}

export function startDirectConnectFunnelStallDetector(): void {
  if (process.env.NODE_ENV !== "production" || detectorTimer || startupTimer) return;

  const intervalMs = readPositiveIntegerEnv(
    "DIRECT_CONNECT_FUNNEL_STALL_SCAN_INTERVAL_MS",
    DEFAULT_INTERVAL_MS
  );
  const startDelayMs = readPositiveIntegerEnv(
    "DIRECT_CONNECT_FUNNEL_STALL_START_DELAY_MS",
    DEFAULT_START_DELAY_MS
  );

  startupTimer = setTimeout(() => {
    startupTimer = null;
    void runDetectorSafely();
    detectorTimer = setInterval(() => void runDetectorSafely(), intervalMs);
    detectorTimer.unref?.();
  }, startDelayMs);
  startupTimer.unref?.();
}

export function stopDirectConnectFunnelStallDetectorForTests(): void {
  if (startupTimer) clearTimeout(startupTimer);
  if (detectorTimer) clearInterval(detectorTimer);
  startupTimer = null;
  detectorTimer = null;
  detectorRunInFlight = null;
}
