import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool as NodePgPool } from "pg";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "@shared/schema";
import {
  allowExplicitInsecureTestDatabase,
  securePostgresConnectionString,
} from "@shared/database-url-security.mjs";
import { emitPoolMetrics } from "./observability/metrics";
import { recomputeBaselinesFromObservedData } from "./observability/alerts";

neonConfig.webSocketConstructor = ws;

const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST_WORKER_ID);
const allowInsecureTestConnection =
  isTestEnv && allowExplicitInsecureTestDatabase(process.env);

const rawConnectionString = isTestEnv ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
const connectionString = securePostgresConnectionString(rawConnectionString, {
  allowInsecureTestConnection,
});
const localDatabaseHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const databaseHostname = connectionString
  ? new URL(connectionString).hostname.toLowerCase()
  : "";
const useLocalNodePg = Boolean(connectionString) && localDatabaseHosts.has(databaseHostname);

// The app uses the pg-compatible Pool surface everywhere. Neon implements that
// runtime contract, but its published type is not assignment-compatible with
// node-postgres, so we normalize the exported boundary to the node-postgres type.
let pool: NodePgPool;
let db: any;

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

  pool = disabled as unknown as NodePgPool;
  db = disabled;
} else {
  const resolvedConnectionString = connectionString;

  if (useLocalNodePg) {
    const localPool = new NodePgPool({
      connectionString: resolvedConnectionString,
      // The database itself allows far more than this (checked live: 901 max,
      // typically under 25 in use) -- this cap was the actual bottleneck
      // behind crawler-telemetry writes timing out under bot traffic spikes,
      // not the database. PG_POOL_MAX still overrides this if ever needed.
      max: Number(process.env.PG_POOL_MAX || 50),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),
      connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 10_000),
    });
    pool = localPool;
    db = drizzleNodePg({ client: localPool, schema });
  } else {
    const neonPool = new Pool({
      connectionString: resolvedConnectionString,
      // The database itself allows far more than this (checked live: 901 max,
      // typically under 25 in use) -- this cap was the actual bottleneck
      // behind crawler-telemetry writes timing out under bot traffic spikes,
      // not the database. PG_POOL_MAX still overrides this if ever needed.
      max: Number(process.env.PG_POOL_MAX || 50),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),
      connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 10_000),
    });
    pool = neonPool as unknown as NodePgPool;
    db = drizzle({ client: neonPool, schema });
  }

  // Emit DB pool metrics every 60 seconds
  const poolMetricsTimer = setInterval(() => {
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
  // Don't keep the process alive for background observability timers (scripts/tests/CLI).
  poolMetricsTimer.unref?.();

  const OBS_BASELINE_RECOMPUTE_MS = Number(process.env.OBS_BASELINE_RECOMPUTE_MS || 15 * 60 * 1000);
  // Recompute observability baselines on a fixed cadence from real observed metrics.
  const baselineTimer = setInterval(() => {
    try {
      recomputeBaselinesFromObservedData();
    } catch (error) {
      // Silent failure: never crash on baseline recompute
      console.error("Failed to recompute observability baselines:", error);
    }
  }, OBS_BASELINE_RECOMPUTE_MS);
  baselineTimer.unref?.();

  // Evaluate alerts every 15 seconds (Phase 3)
  const { evaluateAlerts } = await import("./observability/alerts");
  const alertTimer = setInterval(() => {
    try {
      evaluateAlerts();
    } catch (error) {
      // Silent failure: never crash on alert evaluation
      console.error("Failed to evaluate alerts:", error);
    }
  }, 15_000); // Every 15 seconds
  alertTimer.unref?.();
}

export { db, pool };
