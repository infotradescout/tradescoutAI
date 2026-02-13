import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";
import { emitPoolMetrics } from "./observability/metrics";
import { recomputeBaselinesFromObservedData } from "./observability/alerts";

neonConfig.webSocketConstructor = ws;

const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST_WORKER_ID);

const connectionString = isTestEnv ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool;
let db: DbType;

if (!connectionString) {
  // In test mode, we intentionally do NOT fall back to DATABASE_URL.
  // This avoids mutating a dev/prod database when running vitest locally.
  const error = new Error(
    isTestEnv
      ? "Missing TEST_DATABASE_URL for test database connection."
      : "Missing DATABASE_URL for database connection."
  );

  const disabled = new Proxy(
    {},
    {
      get() {
        throw error;
      },
    }
  );

  pool = disabled as unknown as Pool;
  db = disabled as unknown as DbType;
} else {
  pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 10_000),
  });
  db = drizzle({ client: pool, schema });

  // Emit DB pool metrics every 60 seconds
  setInterval(() => {
    try {
      const totalCount = pool.totalCount || 0;
      const idleCount = pool.idleCount || 0;
      const waitingCount = pool.waitingCount || 0;

      emitPoolMetrics({
        active: totalCount - idleCount,
        idle: idleCount,
        waiting: waitingCount,
      });
    } catch (error) {
      // Silent failure: never crash on metrics emission
      console.error("Failed to emit pool metrics:", error);
    }
  }, 60_000); // Every 60 seconds

  const OBS_BASELINE_RECOMPUTE_MS = Number(process.env.OBS_BASELINE_RECOMPUTE_MS || 15 * 60 * 1000);
  // Recompute observability baselines on a fixed cadence from real observed metrics.
  setInterval(() => {
    try {
      recomputeBaselinesFromObservedData();
    } catch (error) {
      // Silent failure: never crash on baseline recompute
      console.error("Failed to recompute observability baselines:", error);
    }
  }, OBS_BASELINE_RECOMPUTE_MS);

  // Evaluate alerts every 15 seconds (Phase 3)
  const { evaluateAlerts } = await import("./observability/alerts");
  setInterval(() => {
    try {
      evaluateAlerts();
    } catch (error) {
      // Silent failure: never crash on alert evaluation
      console.error("Failed to evaluate alerts:", error);
    }
  }, 15_000); // Every 15 seconds
}

export { db, pool };
