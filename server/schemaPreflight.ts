import { pool } from "./db";

type DriftSeverity = "info" | "warn" | "error";

interface DriftIssue {
  scope: string;
  code: string;
  message: string;
  severity: DriftSeverity;
}

const EXPECTED_USER_COLUMNS = [
  "state_code",
  "county_fips",
  "county_id",
  "county_name",
  "latitude",
  "longitude",
];

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) as exists`,
      [table, column],
    );
    return Boolean(result.rows[0]?.exists);
  } catch (err) {
    console.error("[SchemaPreflight] Failed checking column", { table, column, error: err });
    return false;
  }
}

export async function runSchemaPreflight(): Promise<void> {
  const issues: DriftIssue[] = [];

  for (const column of EXPECTED_USER_COLUMNS) {
    const exists = await tableHasColumn("users", column);
    if (!exists) {
      issues.push({
        scope: "users",
        code: `missing_column:${column}`,
        message: `Expected column users.${column} is missing. Run migrations (e.g. drizzle-kit push) against this database.`,
        severity: "error",
      });
    }
  }

  if (issues.length === 0) {
    console.log("[SchemaPreflight] OK - no drift detected for critical tables.");
    return;
  }

  console.warn("[SchemaPreflight] Detected potential schema drift:");
  for (const issue of issues) {
    console.warn(
      " -",
      JSON.stringify({
        scope: issue.scope,
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
      }),
    );
  }
}
