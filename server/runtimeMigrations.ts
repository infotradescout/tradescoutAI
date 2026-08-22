import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pool } from "./db";
import { classifyMigrationHashDisposition } from "./runtimeMigrationPolicy";

const RUNTIME_MIGRATION_FILENAME_PATTERN = /^\d{4}.*\.sql$/i;

type MigrationFile = {
  filename: string;
  fullPath: string;
  sql: string;
  hash: string;
  predecessorHashes: string[];
};

type MigrationHashAliases = Record<string, string[]>;

const RELEASE_399_RECOVERY_REMOVE_FILENAMES = [
  "0072_seo_publication_rules_and_freshness.sql",
  "0074_provider_eligibilities.sql",
  "0083_scout_onboarding_sessions.sql",
  "0084_dc_universal_provider.sql",
  "0085_dc_worker_assignments.sql",
  "0086_dc_pending_outcome_status.sql",
  "0087_conversations_universal_provider_fk.sql",
  "0088_admin_audit_log.sql",
  "0092_procurement_engine_workspaces.sql",
  "0094_accounting_books_foundation.sql",
  "0095_profile_offers_finance_bridge.sql",
  "0096_marketplace_value_bundle_shipping.sql",
  "0097_direct_connect_giveaway_entries.sql",
  "0098_affiliate_attribution_conversion_ledger.sql",
  "0099_trust_ledger_events.sql",
] as const;

const RELEASE_399_RECOVERY_APPLY_FILENAMES = [
  "0114_la_plumbing_public_copy_invariant.sql",
  "0115_profile_accounts.sql",
  "0116_admin_live_stream_snapshots.sql",
  "0117_managed_partner_intakes.sql",
] as const;

type RecordedMigration = {
  hash: string;
  createdAt: number | null;
};

export class HistoricalMigrationReplayRefusedError extends Error {
  constructor(filename: string) {
    super(
      `[RuntimeMigrations] Refusing to replay repaired historical migration ${filename}: no current or recorded predecessor hash was found.`
    );
    this.name = "HistoricalMigrationReplayRefusedError";
  }
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function lineEndingCompatibleHashes(sql: string): string[] {
  const lf = String(sql).replace(/\r\n?/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  return [...new Set([sha256(lf), sha256(crlf)])];
}

async function functionExists(name: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `select exists(select 1 from pg_proc where proname = $1) as exists`,
    [name]
  );
  return Boolean(result.rows?.[0]?.exists);
}

async function ensureGenRandomUuid(): Promise<void> {
  // Several migrations use gen_random_uuid(). In some hosted Postgres environments, pgcrypto may not
  // be installed yet. Best-effort: enable pgcrypto, fall back to uuid-ossp, or create a shim.
  try {
    if (await functionExists("gen_random_uuid")) return;

    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    } catch {
      // ignore
    }
    if (await functionExists("gen_random_uuid")) return;

    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    } catch {
      // ignore
    }

    const hasUuidOssp = await functionExists("uuid_generate_v4");
    if (!hasUuidOssp) return;

    // Shim: provide gen_random_uuid() using uuid-ossp so id defaults in migrations work.
    await pool.query(`
      CREATE OR REPLACE FUNCTION gen_random_uuid()
      RETURNS uuid
      LANGUAGE sql
      AS $$ SELECT uuid_generate_v4(); $$;
    `);
  } catch (err) {
    console.error("[RuntimeMigrations] Failed ensuring gen_random_uuid (non-fatal):", err);
  }
}

function getRepoRoot(): string {
  // Runtime containers run with WORKDIR=/app (see Dockerfile). In dev, process.cwd() is repo root.
  return process.cwd();
}

function loadMigrationHashAliases(migrationsDir: string): MigrationHashAliases {
  const aliasesPath = path.join(migrationsDir, "meta", "_hash_aliases.json");
  if (!fs.existsSync(aliasesPath)) return {};

  const parsed = JSON.parse(fs.readFileSync(aliasesPath, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid migration hash aliases file: ${aliasesPath}`);
  }

  const aliases: MigrationHashAliases = {};
  for (const [filename, values] of Object.entries(parsed)) {
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
      throw new Error(`Invalid predecessor hashes for migration ${filename}`);
    }
    aliases[filename] = [...new Set(values)];
  }
  return aliases;
}

function loadSqlMigrations(migrationsDir: string): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) return [];

  const hashAliases = loadMigrationHashAliases(migrationsDir);

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const sqlFiles = entries
    // Only treat numeric-prefixed files as runtime migrations (e.g. 0000_foo.sql).
    // Helper scripts like "_all_neon_setup.sql" are intentionally excluded.
    .filter((e) => e.isFile() && RUNTIME_MIGRATION_FILENAME_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  const migrations: MigrationFile[] = [];
  for (const filename of sqlFiles) {
    const fullPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(fullPath, "utf8");
    const hash = sha256(sql);
    const predecessorHashes = hashAliases[filename] ?? [];
    migrations.push({ filename, fullPath, sql, hash, predecessorHashes });
  }
  return migrations;
}

function loadJournalMigrationTimes(migrationsDir: string): Map<string, number> {
  const journalPath = path.join(migrationsDir, "meta", "_journal.json");
  const parsed = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries?: Array<{ tag?: unknown; when?: unknown }>;
  };
  const times = new Map<string, number>();
  for (const entry of parsed.entries ?? []) {
    if (typeof entry.tag !== "string" || typeof entry.when !== "number") continue;
    times.set(`${entry.tag}.sql`, entry.when);
  }
  return times;
}

async function ensureDrizzleMigrationsTable() {
  await pool.query("create schema if not exists drizzle");
  await pool.query(`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `);
}

async function migrationLedgerCount(): Promise<number> {
  const result = await pool.query<{ count: number }>(
    "select count(*)::int as count from drizzle.__drizzle_migrations"
  );
  return Number(result.rows?.[0]?.count ?? 0);
}

async function findRecordedMigration(hashes: string[]): Promise<RecordedMigration | null> {
  const result = await pool.query<{ hash: string; created_at: string | number | null }>(
    `select hash, created_at
     from drizzle.__drizzle_migrations
     where hash = any($1::text[])
     order by case when hash = $2 then 0 else 1 end
     limit 1`,
    [hashes, hashes[0]]
  );
  const row = result.rows?.[0];
  if (!row) return null;
  const createdAt = row.created_at == null ? null : Number(row.created_at);
  return {
    hash: row.hash,
    createdAt: Number.isFinite(createdAt) ? createdAt : null,
  };
}

async function recordMigration(hash: string, createdAt = Date.now()) {
  await pool.query(
    `
      insert into drizzle.__drizzle_migrations (hash, created_at)
      select $1, $2
      where not exists (
        select 1 from drizzle.__drizzle_migrations where hash = $1
      )
    `,
    [hash, createdAt]
  );
}

const DUPLICATE_SCHEMA_ERROR_CODES = new Set([
  // type/schema/constraint already exists
  "42710", // duplicate_object
  "42P06", // duplicate_schema
  "42723", // duplicate_function
  // table/index already exists ("relation already exists")
  "42P07", // duplicate_table
  // column already exists
  "42701", // duplicate_column
]);

function migrationContainsDml(sql: string): boolean {
  // Only treat statement-leading DML as mutating data.
  // This avoids false positives from FK clauses like "ON DELETE/ON UPDATE".
  return /(^|;\s*)(insert|update|delete|truncate)\s+/im.test(sql);
}

function requiresNonTransactionalExecution(sql: string): boolean {
  return /\b(create|drop)\s+(unique\s+)?index\s+concurrently\b/i.test(sql);
}

async function schemaLooksInitialized(): Promise<boolean> {
  const result = await pool.query<{
    users_reg: string | null;
    conversations_reg: string | null;
    marketplace_conversations_reg: string | null;
    address_verifications_reg: string | null;
    work_requests_reg: string | null;
    address_verification_status_type: string | null;
  }>(
    `select
      to_regclass('public.users') as users_reg,
      to_regclass('public.conversations') as conversations_reg,
      to_regclass('public.marketplace_conversations') as marketplace_conversations_reg,
      to_regclass('public.address_verifications') as address_verifications_reg,
      to_regclass('public.work_requests') as work_requests_reg,
      to_regtype('public.address_verification_status')::text as address_verification_status_type`
  );
  const row = result.rows?.[0];
  const hasLegacyBaseSchema =
    Boolean(row?.users_reg) &&
    (Boolean(row?.address_verifications_reg) ||
      Boolean(row?.work_requests_reg) ||
      Boolean(row?.address_verification_status_type));
  return (
    hasLegacyBaseSchema ||
    (Boolean(row?.users_reg) &&
      (Boolean(row?.marketplace_conversations_reg) || Boolean(row?.conversations_reg)))
  );
}

/**
 * One-shot, explicitly gated recovery for the interrupted PR #399 migration catch-up.
 *
 * A production boot with the broad runtime migrator recorded the current hashes for
 * exactly 15 repaired historical files, then correctly refused to replay 0100. This
 * recovery removes only those newly inserted hashes and applies only the four release
 * migrations that were pending before that boot. Everything is committed atomically,
 * and an already-completed recovery is a no-op so an instance restart is safe.
 */
export async function runRelease399MigrationLedgerRecovery(options?: {
  log?: (msg: string) => void;
}) {
  const log = options?.log ?? ((msg: string) => console.log(msg));
  const migrationsDir = path.join(getRepoRoot(), "migrations");
  const migrations = loadSqlMigrations(migrationsDir);
  const byFilename = new Map(migrations.map((migration) => [migration.filename, migration]));
  const journalTimes = loadJournalMigrationTimes(migrationsDir);
  const expectedCount = journalTimes.size;

  const requiredFiles = [
    ...RELEASE_399_RECOVERY_REMOVE_FILENAMES,
    ...RELEASE_399_RECOVERY_APPLY_FILENAMES,
  ];
  for (const filename of requiredFiles) {
    if (!byFilename.has(filename) || !journalTimes.has(filename)) {
      throw new Error(`[RuntimeMigrations] Recovery file is missing from the journal: ${filename}`);
    }
  }

  const removeMigrations = RELEASE_399_RECOVERY_REMOVE_FILENAMES.map(
    (filename) => byFilename.get(filename)!
  );
  const applyMigrations = RELEASE_399_RECOVERY_APPLY_FILENAMES.map(
    (filename) => byFilename.get(filename)!
  );
  const requiredHealthMigration = byFilename.get("0072_seo_publication_rules_and_freshness.sql")!;
  const requiredHealthHashes = lineEndingCompatibleHashes(requiredHealthMigration.sql);
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("set local lock_timeout = '15s'");
    await client.query("set local statement_timeout = '120s'");
    await client.query("select pg_advisory_xact_lock($1::bigint)", [39920260820]);
    const countResult = await client.query<{ count: number }>(
      "select count(*)::int as count from drizzle.__drizzle_migrations"
    );
    const beforeCount = Number(countResult.rows?.[0]?.count ?? 0);
    const removeHashes = removeMigrations.map((migration) => migration.hash);
    const applyHashes = applyMigrations.map((migration) => migration.hash);
    const presence = await client.query<{ hash: string }>(
      `select hash
         from drizzle.__drizzle_migrations
        where hash = any($1::text[])`,
      [[...removeHashes, ...applyHashes]]
    );
    const presentHashes = new Set(presence.rows.map((row) => row.hash));
    const requiredHealthPresence = await client.query<{ present: boolean }>(
      `select exists (
         select 1
           from drizzle.__drizzle_migrations
          where hash = any($1::text[])
       ) as present`,
      [requiredHealthHashes]
    );
    const alreadyComplete =
      beforeCount === expectedCount &&
      removeHashes.every((hash) => !presentHashes.has(hash)) &&
      applyHashes.every((hash) => presentHashes.has(hash)) &&
      Boolean(requiredHealthPresence.rows?.[0]?.present);

    if (alreadyComplete) {
      await client.query("commit");
      log("[RuntimeMigrations] PR #399 ledger recovery is already complete.");
      return;
    }

    const expectedInterruptedCount =
      expectedCount - applyMigrations.length + removeMigrations.length;
    if (
      beforeCount !== expectedInterruptedCount ||
      removeHashes.some((hash) => !presentHashes.has(hash)) ||
      applyHashes.some((hash) => presentHashes.has(hash))
    ) {
      throw new Error(
        `[RuntimeMigrations] Refusing PR #399 ledger recovery from unexpected state (${beforeCount}/${expectedCount}).`
      );
    }

    for (const migration of removeMigrations) {
      const originalLedgerRow = await client.query<{ count: number }>(
        `select count(*)::int as count
           from drizzle.__drizzle_migrations
          where created_at = $1
            and hash <> $2`,
        [journalTimes.get(migration.filename), migration.hash]
      );
      if (Number(originalLedgerRow.rows?.[0]?.count ?? 0) !== 1) {
        throw new Error(
          `[RuntimeMigrations] Refusing to remove ${migration.filename}: expected exactly one surviving original ledger row.`
        );
      }
    }

    const removed = await client.query(
      "delete from drizzle.__drizzle_migrations where hash = any($1::text[])",
      [removeHashes]
    );
    if (removed.rowCount !== removeMigrations.length) {
      throw new Error(
        `[RuntimeMigrations] Expected to remove ${removeMigrations.length} interrupted ledger rows; removed ${removed.rowCount ?? 0}.`
      );
    }

    const survivingHealthHash = await client.query<{ present: boolean }>(
      `select exists (
         select 1
           from drizzle.__drizzle_migrations
          where hash = any($1::text[])
       ) as present`,
      [requiredHealthHashes]
    );
    if (!Boolean(survivingHealthHash.rows?.[0]?.present)) {
      throw new Error(
        "[RuntimeMigrations] Refusing PR #399 recovery because the accepted 0072 health hash would be removed."
      );
    }

    for (const migration of applyMigrations) {
      if (requiresNonTransactionalExecution(migration.sql)) {
        throw new Error(
          `[RuntimeMigrations] Recovery migration requires non-transactional execution: ${migration.filename}`
        );
      }
      log(`[RuntimeMigrations] Recovery applying ${migration.filename}...`);
      await client.query(migration.sql);
      await client.query(
        "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
        [migration.hash, journalTimes.get(migration.filename)]
      );
    }

    const finalCountResult = await client.query<{ count: number }>(
      "select count(*)::int as count from drizzle.__drizzle_migrations"
    );
    const finalCount = Number(finalCountResult.rows?.[0]?.count ?? 0);
    if (finalCount !== expectedCount) {
      throw new Error(
        `[RuntimeMigrations] PR #399 ledger recovery ended at ${finalCount}/${expectedCount}; rolling back.`
      );
    }

    const finalPresence = await client.query<{ count: number }>(
      `select count(*)::int as count
         from drizzle.__drizzle_migrations
        where hash = any($1::text[])`,
      [applyHashes]
    );
    if (Number(finalPresence.rows?.[0]?.count ?? 0) !== applyMigrations.length) {
      throw new Error(
        "[RuntimeMigrations] PR #399 tail hashes were not fully recorded; rolling back."
      );
    }

    const schemaProof = await client.query<{
      profile_accounts: boolean;
      profile_account_entitlements: boolean;
      admin_live_stream_snapshots: boolean;
      admin_live_stream_snapshot_history: boolean;
      managed_partner_intakes: boolean;
      profile_identity_function: boolean;
      profile_identity_trigger: boolean;
      la_copy_function: boolean;
      la_copy_trigger: boolean;
    }>(`
      select
        to_regclass('public.profile_accounts') is not null as profile_accounts,
        to_regclass('public.profile_account_entitlements') is not null
          as profile_account_entitlements,
        to_regclass('public.admin_live_stream_snapshots') is not null
          as admin_live_stream_snapshots,
        to_regclass('public.admin_live_stream_snapshot_history') is not null
          as admin_live_stream_snapshot_history,
        to_regclass('public.managed_partner_intakes') is not null
          as managed_partner_intakes,
        to_regprocedure('public.enforce_profile_account_identity()') is not null
          as profile_identity_function,
        exists (
          select 1
            from pg_trigger trigger_row
            join pg_class table_row on table_row.oid = trigger_row.tgrelid
            join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
           where schema_row.nspname = 'public'
             and table_row.relname = 'profile_accounts'
             and trigger_row.tgname = 'profile_accounts_identity_trigger'
             and not trigger_row.tgisinternal
        ) as profile_identity_trigger,
        to_regprocedure('public.enforce_la_plumbing_public_copy()') is not null
          as la_copy_function,
        exists (
          select 1
            from pg_trigger trigger_row
            join pg_class table_row on table_row.oid = trigger_row.tgrelid
            join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
           where schema_row.nspname = 'public'
             and table_row.relname = 'profiles'
             and trigger_row.tgname = 'profiles_la_plumbing_public_copy'
             and not trigger_row.tgisinternal
        ) as la_copy_trigger
    `);
    const schema = schemaProof.rows?.[0];
    if (!schema || Object.values(schema).some((value) => value !== true)) {
      throw new Error("[RuntimeMigrations] PR #399 required schema proof failed; rolling back.");
    }

    await client.query("commit");
    log(`[RuntimeMigrations] PR #399 ledger recovery complete (${finalCount}/${expectedCount}).`);
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // ignore rollback failures and preserve the original error
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function runRuntimeMigrations(options?: { log?: (msg: string) => void }) {
  const log = options?.log ?? ((msg: string) => console.log(msg));
  const root = getRepoRoot();
  const migrationsDir = path.join(root, "migrations");
  const migrations = loadSqlMigrations(migrationsDir);

  if (migrations.length === 0) {
    log(`[RuntimeMigrations] No migrations found at ${migrationsDir}; skipping.`);
    return;
  }

  await ensureGenRandomUuid();
  await ensureDrizzleMigrationsTable();
  const preexistingDatabase =
    (await migrationLedgerCount()) > 0 || (await schemaLooksInitialized());

  let applied = 0;
  let adopted = 0;
  for (const migration of migrations) {
    const recordedMigration = await findRecordedMigration([
      migration.hash,
      ...migration.predecessorHashes,
    ]);
    const disposition = classifyMigrationHashDisposition({
      currentHash: migration.hash,
      predecessorHashes: migration.predecessorHashes,
      recordedHash: recordedMigration?.hash ?? null,
      preexistingDatabase,
    });
    if (disposition === "current") continue;
    if (disposition === "adopt") {
      log(
        `[RuntimeMigrations] ${migration.filename} has a recorded predecessor hash; adopting the repaired hash without replaying historical SQL.`
      );
      await recordMigration(migration.hash, recordedMigration?.createdAt ?? Date.now());
      adopted += 1;
      continue;
    }

    if (disposition === "refuse") {
      throw new HistoricalMigrationReplayRefusedError(migration.filename);
    }

    log(`[RuntimeMigrations] Applying ${migration.filename}...`);
    const client = await pool.connect();
    try {
      if (requiresNonTransactionalExecution(migration.sql)) {
        log(
          `[RuntimeMigrations] ${migration.filename} requires non-transactional execution; applying outside BEGIN/COMMIT.`
        );
        await client.query(migration.sql);
      } else {
        await client.query("begin");
        // Execute the full migration file as-is so dollar-quoted blocks (DO $$ ... $$) work reliably.
        await client.query(migration.sql);
        await client.query("commit");
      }
      await recordMigration(migration.hash);
      applied += 1;
    } catch (err) {
      try {
        await client.query("rollback");
      } catch {
        // ignore rollback failures
      }

      const code = (err as any)?.code;
      const canAdopt =
        typeof code === "string" &&
        DUPLICATE_SCHEMA_ERROR_CODES.has(code) &&
        !migrationContainsDml(migration.sql);

      if (canAdopt) {
        try {
          if (await schemaLooksInitialized()) {
            log(
              `[RuntimeMigrations] ${migration.filename} appears already applied (code ${code}); recording and continuing.`
            );
            await recordMigration(migration.hash);
            adopted += 1;
            continue;
          }
        } catch {
          // If we can't confirm initialization, fall through to throw.
        }
      }

      throw err;
    } finally {
      client.release();
    }
  }

  log(
    `[RuntimeMigrations] Done. Applied ${applied} migration(s), adopted ${adopted} migration(s).`
  );
}
