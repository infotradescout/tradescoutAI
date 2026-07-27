import { pool } from "../db";
import { BoundedConcurrencyGate } from "./boundedConcurrency";

const u32 = (n: number) => n >>> 0;

// Simple deterministic string hash -> two 32-bit ints for pg_advisory_lock(int,int).
function hashToTwoInts(key: string): [number, number] {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = u32(Math.imul(h1 ^ c, 0x01000193));
    h2 = u32(Math.imul(h2 + c, 0x27d4eb2d));
  }

  // Fit into signed 32-bit integers for postgres int.
  const a = (h1 | 0) as number;
  const b = (h2 | 0) as number;
  return [a, b];
}

type AdvisoryLockClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows?: Array<Record<string, unknown>> }>;
  release: (error?: Error) => void;
};

type AdvisoryLockPool = {
  connect: () => Promise<AdvisoryLockClient>;
};

function readBoundedIntegerEnv(
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(String(process.env[name] || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const schedulerDbGate = new BoundedConcurrencyGate({
  maxConcurrent: readBoundedIntegerEnv("SCHEDULER_DB_MAX_CONCURRENCY", 2, 1, 4),
  maxQueued: readBoundedIntegerEnv("SCHEDULER_DB_MAX_QUEUE", 32, 4, 64),
});
const scheduledJobKeys = new Set<string>();

export async function withAdvisoryLockOnPool<T>(
  dbPool: AdvisoryLockPool,
  lockKey: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const [a, b] = hashToTwoInts(lockKey);
  const client = await dbPool.connect();
  let locked = false;
  let releaseError: Error | undefined;

  try {
    let lockRes: { rows?: Array<Record<string, unknown>> };
    try {
      lockRes = await client.query(
        "select pg_try_advisory_lock($1::int, $2::int) as locked",
        [a, b]
      );
    } catch (error) {
      releaseError = error instanceof Error ? error : new Error(String(error));
      throw error;
    }

    locked = Boolean(lockRes?.rows?.[0]?.locked);
    if (!locked) return null;
    return await fn();
  } finally {
    if (locked) {
      try {
        await client.query("select pg_advisory_unlock($1::int, $2::int)", [a, b]);
      } catch (error) {
        // Never return a session with a possibly-held lock to the pool.
        releaseError = error instanceof Error ? error : new Error(String(error));
      }
    }
    client.release(releaseError);
  }
}

export async function withAdvisoryLock<T>(
  lockKey: string,
  fn: () => Promise<T>
): Promise<T | null> {
  if (!lockKey.startsWith("job:")) {
    return withAdvisoryLockOnPool(pool as unknown as AdvisoryLockPool, lockKey, fn);
  }

  if (scheduledJobKeys.has(lockKey)) {
    console.warn(`[scheduler] Skipping ${lockKey}: already active or queued in this process`);
    return null;
  }

  scheduledJobKeys.add(lockKey);
  try {
    const gated = await schedulerDbGate.run(() =>
      withAdvisoryLockOnPool(pool as unknown as AdvisoryLockPool, lockKey, fn)
    );
    if (!gated.accepted) {
      console.warn(`[scheduler] Skipping ${lockKey}: local scheduler queue is full`);
      return null;
    }
    return gated.value;
  } finally {
    scheduledJobKeys.delete(lockKey);
  }
}

export function getSchedulerDbConcurrencySnapshot() {
  return {
    ...schedulerDbGate.snapshot(),
    distinctJobsActiveOrQueued: scheduledJobKeys.size,
  };
}
