import type { PoolClient } from "pg";
import { pool } from "../db";

let schedulerLeaderClient: PoolClient | null = null;

const DEFAULT_SCHEDULER_LEADER_RETRY_MS = 15_000;
const MIN_SCHEDULER_LEADER_RETRY_MS = 1_000;
const MAX_SCHEDULER_LEADER_RETRY_MS = 300_000;

function schedulerLockId(): number {
  const parsed = Number.parseInt(process.env.SCHEDULER_LEADER_LOCK_ID || "72418031", 10);
  return Number.isFinite(parsed) ? parsed : 72418031;
}

export function schedulerLeaderRetryIntervalMs(
  value: string | undefined = process.env.SCHEDULER_LEADER_RETRY_MS
): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SCHEDULER_LEADER_RETRY_MS;
  return Math.min(MAX_SCHEDULER_LEADER_RETRY_MS, Math.max(MIN_SCHEDULER_LEADER_RETRY_MS, parsed));
}

export function startSchedulerLeadershipRetryLoop(args: {
  acquire?: () => Promise<boolean>;
  onAcquired: () => void | Promise<void>;
  onUnavailable?: () => void;
  onError?: (error: unknown) => void;
  retryIntervalMs?: number;
}): {
  initialAttempt: Promise<boolean>;
  stop: () => void;
  hasLeadership: () => boolean;
} {
  const acquire = args.acquire || acquireSchedulerLeadership;
  const retryIntervalMs = schedulerLeaderRetryIntervalMs(
    String(args.retryIntervalMs ?? process.env.SCHEDULER_LEADER_RETRY_MS ?? "")
  );
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let acquired = false;
  let inFlight = false;

  const clearRetry = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  };

  const scheduleRetry = () => {
    if (stopped || acquired || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void attempt();
    }, retryIntervalMs);
    timer.unref?.();
  };

  const attempt = async (): Promise<boolean> => {
    if (stopped || acquired || inFlight) return acquired;
    inFlight = true;
    try {
      const hasLeadership = await acquire();
      if (!hasLeadership) {
        args.onUnavailable?.();
        return false;
      }
      await args.onAcquired();
      acquired = true;
      clearRetry();
      return true;
    } catch (error) {
      args.onError?.(error);
      return false;
    } finally {
      inFlight = false;
      if (!acquired) scheduleRetry();
    }
  };

  const initialAttempt = attempt();
  return {
    initialAttempt,
    stop: () => {
      stopped = true;
      clearRetry();
    },
    hasLeadership: () => acquired,
  };
}

export async function acquireSchedulerLeadership(): Promise<boolean> {
  if (schedulerLeaderClient) return true;

  const client = await pool.connect();
  try {
    const lockId = schedulerLockId();
    const result = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1) as locked",
      [lockId]
    );
    const locked = result.rows?.[0]?.locked === true;

    if (!locked) {
      client.release();
      return false;
    }

    schedulerLeaderClient = client;
    return true;
  } catch (error) {
    client.release();
    throw error;
  }
}

export async function releaseSchedulerLeadership(): Promise<void> {
  if (!schedulerLeaderClient) return;

  const client = schedulerLeaderClient;
  schedulerLeaderClient = null;

  try {
    const lockId = schedulerLockId();
    await client.query("select pg_advisory_unlock($1)", [lockId]);
  } catch {
    // Best-effort unlock; connection close also releases advisory lock.
  } finally {
    client.release();
  }
}
