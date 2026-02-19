import { pool } from "./db";

const DISABLED_ROUTES_MODES = new Set(["simple", "routes-simple"]);

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST_WORKER_ID);
}

export async function assertStartupInvariants(): Promise<void> {
  if (isTestRuntime()) return;

  const routesMode = String(process.env.ROUTES_MODE || "full")
    .trim()
    .toLowerCase();
  if (DISABLED_ROUTES_MODES.has(routesMode)) {
    throw new Error(
      `ROUTES_MODE=${routesMode} is disabled for this server. Full routes are required.`
    );
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required at startup.");
  }

  await pool.query("select 1");
}
