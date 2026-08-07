import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Pool } from "pg";

export type MigrationCompatibility = "compatible" | "behind" | "ahead" | "incompatible" | "unknown";

export type MigrationCompatibilityStatus = {
  compatibility: MigrationCompatibility;
  appliedCount: number | null;
  expectedCount: number | null;
  requiredSchemaOk: boolean | null;
};

const REQUIRED_MIGRATION_RELATIVE = "migrations/0072_seo_publication_rules_and_freshness.sql";
const JOURNAL_RELATIVE = "migrations/meta/_journal.json";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function buildLineEndingCompatibleMigrationHashes(sql: string): string[] {
  const lf = String(sql).replace(/\r\n?/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  return [...new Set([sha256(lf), sha256(crlf)])];
}

export function readExpectedMigrationCount(cwd = process.cwd()): number | null {
  const journalPath = path.resolve(cwd, JOURNAL_RELATIVE);
  if (!fs.existsSync(journalPath)) return null;
  try {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries?: unknown[];
    };
    const count = Array.isArray(journal.entries) ? journal.entries.length : null;
    return typeof count === "number" && Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

export function readRequiredMigrationHashes(cwd = process.cwd()): string[] | null {
  const migrationPath = path.resolve(cwd, REQUIRED_MIGRATION_RELATIVE);
  if (!fs.existsSync(migrationPath)) return null;
  try {
    return buildLineEndingCompatibleMigrationHashes(fs.readFileSync(migrationPath, "utf8"));
  } catch {
    return null;
  }
}

function evaluateCompatibility(input: {
  appliedCount: number | null;
  expectedCount: number | null;
  requiredSchemaOk: boolean | null;
}): MigrationCompatibility {
  if (input.requiredSchemaOk === false) return "incompatible";
  if (input.appliedCount == null) return "unknown";
  if (input.expectedCount == null) {
    return input.requiredSchemaOk === true ? "compatible" : "unknown";
  }
  if (input.appliedCount < input.expectedCount) return "behind";
  if (input.appliedCount > input.expectedCount) return "ahead";
  return input.requiredSchemaOk === false ? "incompatible" : "compatible";
}

/**
 * Public, non-secret migration compatibility snapshot for /api/health.
 * Never returns connection strings, SQL, or hash secrets beyond boolean OK.
 */
export async function getMigrationCompatibilityStatus(
  pool: Pool,
  cwd = process.cwd()
): Promise<MigrationCompatibilityStatus> {
  const expectedCount = readExpectedMigrationCount(cwd);
  const requiredHashes = readRequiredMigrationHashes(cwd);

  let appliedCount: number | null = null;
  let requiredSchemaOk: boolean | null = requiredHashes ? false : null;

  try {
    const ledger = await pool.query<{ count: number }>(
      `select count(*)::int as count
       from information_schema.tables
       where table_schema = 'drizzle'
         and table_name = '__drizzle_migrations'`
    );
    const ledgerExists = Number(ledger.rows?.[0]?.count ?? 0) > 0;
    if (!ledgerExists) {
      return {
        compatibility: "incompatible",
        appliedCount: 0,
        expectedCount,
        requiredSchemaOk: false,
      };
    }

    const countResult = await pool.query<{ count: number }>(
      "select count(*)::int as count from drizzle.__drizzle_migrations"
    );
    appliedCount = Number(countResult.rows?.[0]?.count ?? 0);

    if (requiredHashes && requiredHashes.length > 0) {
      const hashResult = await pool.query<{ present: boolean }>(
        "select exists (select 1 from drizzle.__drizzle_migrations where hash = any($1::text[])) as present",
        [requiredHashes]
      );
      requiredSchemaOk = Boolean(hashResult.rows?.[0]?.present);
    }
  } catch {
    return {
      compatibility: "unknown",
      appliedCount: null,
      expectedCount,
      requiredSchemaOk: null,
    };
  }

  return {
    compatibility: evaluateCompatibility({
      appliedCount,
      expectedCount,
      requiredSchemaOk,
    }),
    appliedCount,
    expectedCount,
    requiredSchemaOk,
  };
}
