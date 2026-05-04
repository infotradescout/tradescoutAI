import type { Pool } from "pg";

type StoreOptions = {
  windowMs: number;
};

type IncrementResponse = {
  totalHits: number;
  resetTime: Date;
};

// Minimal Postgres-backed store for express-rate-limit.
// This provides stable enforcement across multiple server instances without Redis.
export function createPostgresRateLimitStore(params: {
  pool: Pool;
  prefix: string;
  cleanupIntervalMs?: number;
}): {
  init: (options: StoreOptions) => void;
  increment: (key: string) => Promise<IncrementResponse>;
  decrement: (key: string) => Promise<void>;
  resetKey: (key: string) => Promise<void>;
} {
  const { pool, prefix } = params;
  let windowMs = 60_000;
  let disabledBecauseMissingTable = false;
  let didWarnMissingTable = false;
  let didAttemptCreateTable = false;
  let createTablePromise: Promise<void> | null = null;

  const cleanupIntervalMs = Math.max(0, Number(params.cleanupIntervalMs ?? 0) || 0);
  let cleanupTimer: NodeJS.Timeout | undefined;

  const bucketKey = (key: string) => `${prefix}:${key}`;

  const isMissingRateLimitTableError = (err: unknown): boolean => {
    const anyErr = err as any;
    const code = typeof anyErr?.code === "string" ? anyErr.code : "";
    const message = typeof anyErr?.message === "string" ? anyErr.message : "";
    // Postgres: 42P01 = undefined_table
    return (
      code === "42P01" ||
      message.includes('relation "rate_limit_buckets" does not exist') ||
      (message.includes("rate_limit_buckets") && message.includes("does not exist"))
    );
  };

  const ensureRateLimitTable = async () => {
    // Best-effort self-heal for environments where migrations haven't run yet.
    if (createTablePromise) return createTablePromise;
    if (didAttemptCreateTable) return;
    didAttemptCreateTable = true;
    createTablePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
          "bucket_key" text PRIMARY KEY,
          "hits" integer NOT NULL DEFAULT 0,
          "reset_at" timestamptz NOT NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_rate_limit_buckets_reset_at"
          ON "rate_limit_buckets" ("reset_at");
      `);
    })()
      .catch((err) => {
        console.warn("[rate-limit] failed to auto-create rate_limit_buckets table.", err);
      })
      .finally(() => {
        createTablePromise = null;
      });
    return createTablePromise;
  };

  const maybeStartCleanup = () => {
    if (!cleanupIntervalMs || cleanupTimer) return;
    cleanupTimer = setInterval(async () => {
      try {
        // Keep the table bounded without strict guarantees.
        await pool.query(
          "delete from rate_limit_buckets where reset_at < now() - interval '1 hour'"
        );
      } catch {
        // Never crash on cleanup.
      }
    }, cleanupIntervalMs);
    cleanupTimer.unref?.();
  };

  return {
    init(options: StoreOptions) {
      windowMs = Math.max(1, Number(options?.windowMs ?? 60_000) || 60_000);
      maybeStartCleanup();
    },

    async increment(key: string): Promise<IncrementResponse> {
      if (disabledBecauseMissingTable) {
        const ms = windowMs;
        return { totalHits: 1, resetTime: new Date(Date.now() + ms) };
      }

      const k = bucketKey(key);
      const ms = windowMs;

      const sql = `
        insert into rate_limit_buckets (bucket_key, hits, reset_at, created_at, updated_at)
        values ($1, 1, now() + ($2::int * interval '1 millisecond'), now(), now())
        on conflict (bucket_key) do update
        set
          hits = case
            when rate_limit_buckets.reset_at > now() then rate_limit_buckets.hits + 1
            else 1
          end,
          reset_at = case
            when rate_limit_buckets.reset_at > now() then rate_limit_buckets.reset_at
            else now() + ($2::int * interval '1 millisecond')
          end,
          updated_at = now()
        returning hits, reset_at
      `;

      try {
        const res = await pool.query(sql, [k, ms]);
        const row = res?.rows?.[0] as { hits?: number; reset_at?: string | Date } | undefined;
        const totalHits = Number(row?.hits ?? 1) || 1;
        const resetTime = row?.reset_at ? new Date(row.reset_at as any) : new Date(Date.now() + ms);
        return { totalHits, resetTime };
      } catch (err) {
        if (isMissingRateLimitTableError(err)) {
          // Try to self-heal once (idempotent DDL), then retry the increment query.
          await ensureRateLimitTable();
          try {
            const res = await pool.query(sql, [k, ms]);
            const row = res?.rows?.[0] as { hits?: number; reset_at?: string | Date } | undefined;
            const totalHits = Number(row?.hits ?? 1) || 1;
            const resetTime = row?.reset_at
              ? new Date(row.reset_at as any)
              : new Date(Date.now() + ms);
            return { totalHits, resetTime };
          } catch (retryErr) {
            if (isMissingRateLimitTableError(retryErr)) {
              disabledBecauseMissingTable = true;
              if (!didWarnMissingTable) {
                didWarnMissingTable = true;
                console.warn(
                  "[rate-limit] rate_limit_buckets table missing; rate limiting is disabled until migrations run."
                );
              }
              return { totalHits: 1, resetTime: new Date(Date.now() + ms) };
            }
            console.warn(
              "[rate-limit] store error after self-heal attempt; failing open.",
              retryErr
            );
            return { totalHits: 1, resetTime: new Date(Date.now() + ms) };
          }
        }
        // Fail open: never block auth/register because the limiter storage is unhealthy.
        console.warn("[rate-limit] store error; failing open for this request.", err);
        return { totalHits: 1, resetTime: new Date(Date.now() + ms) };
      }
    },

    async decrement(key: string): Promise<void> {
      const k = bucketKey(key);
      try {
        await pool.query(
          `
          update rate_limit_buckets
          set hits = greatest(hits - 1, 0), updated_at = now()
          where bucket_key = $1
        `,
          [k]
        );
      } catch {
        // Best-effort; never crash request path on decrement.
      }
    },

    async resetKey(key: string): Promise<void> {
      const k = bucketKey(key);
      try {
        await pool.query("delete from rate_limit_buckets where bucket_key = $1", [k]);
      } catch {
        // Best-effort.
      }
    },
  };
}
