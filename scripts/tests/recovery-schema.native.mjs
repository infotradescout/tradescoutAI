import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { assertDisposableTestDatabaseUrl } from "../lib/test-db-safety.mjs";
import { DATABASE_RECOVERY_GUIDANCE } from "../lib/verified-migration-runner.mjs";
import {
  buildLineEndingCompatibleMigrationHashes,
  verifyRequiredProductionSchema,
} from "../check-required-production-schema.mjs";

// This is the released main that the recovery branch must extend, not replace.
const RELEASED_BASE = "64e99ca14db7553494265f7f1d8d3257ae0e3b86";
const RECOVERY_TAGS = [
  "0132_profile_booking_request_profile_lineage",
  "0133_professional_application_integrity",
  "0134_document_standalone_lineage_backfill",
  "0135_restore_contact_runtime_schema",
  "0136_restore_notification_outbox_schema",
];
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const root = path.resolve(import.meta.dirname, "../..");

function verifyJournal() {
  const baseline = JSON.parse(
    execFileSync("git", ["show", `${RELEASED_BASE}:migrations/meta/_journal.json`], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    })
  );
  const current = JSON.parse(
    fs.readFileSync(path.join(root, "migrations/meta/_journal.json"), "utf8")
  );
  assert.equal(current.version, baseline.version);
  assert.equal(current.dialect, baseline.dialect);
  assert.deepEqual(
    current.entries.slice(0, baseline.entries.length),
    baseline.entries,
    "Recovery must preserve every released journal entry exactly"
  );
  const additions = current.entries.slice(baseline.entries.length);
  assert.deepEqual(
    additions.map((entry) => entry.tag),
    RECOVERY_TAGS,
    "This recovery proof covers exactly the appended recovery migrations"
  );
  let watermark = Math.max(...baseline.entries.map((entry) => entry.when));
  additions.forEach((entry, index) => {
    assert.equal(entry.idx, baseline.entries.length + index);
    assert.ok(entry.when > watermark, `${entry.tag} must execute after the released watermark`);
    watermark = entry.when;
  });
  return {
    baselineCommit: RELEASED_BASE,
    preservedEntryCount: baseline.entries.length,
    preservedPrefixSha256: sha256(JSON.stringify(baseline.entries)),
    additions,
  };
}

const booking = "profile_booking_requests[explicit lineage columns/constraints/index]";
const release = "profiles[publicly_released canonical authority column]";
const documents = "documents[no synthetic accounting job_id invariant]";
const cases = [
  {
    name: "booking lineage default changed",
    sql: "ALTER TABLE profile_booking_requests ALTER COLUMN lineage_kind SET DEFAULT 'exact_profile'",
    missing: booking,
  },
  {
    name: "profile release default widened",
    sql: "ALTER TABLE profiles ALTER COLUMN publicly_released SET DEFAULT true",
    missing: release,
  },
  {
    name: "profile release nullability weakened",
    sql: "ALTER TABLE profiles ALTER COLUMN publicly_released DROP NOT NULL",
    missing: release,
  },
  {
    name: "booking profile foreign key removed",
    sql: "ALTER TABLE profile_booking_requests DROP CONSTRAINT profile_booking_requests_profile_id_fk",
    missing: booking,
  },
  {
    name: "booking profile deletion protection weakened",
    sql: `ALTER TABLE profile_booking_requests DROP CONSTRAINT profile_booking_requests_profile_id_fk;
      ALTER TABLE profile_booking_requests ADD CONSTRAINT profile_booking_requests_profile_id_fk
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
      COMMENT ON CONSTRAINT profile_booking_requests_profile_id_fk ON profile_booking_requests
        IS 'tradescout-schema:0128:v4'`,
    missing: booking,
  },
  {
    name: "booking lineage consistency constraint removed",
    sql: "ALTER TABLE profile_booking_requests DROP CONSTRAINT profile_booking_requests_lineage_consistency_check",
    missing: booking,
  },
  {
    name: "booking constraint provenance removed",
    sql: "COMMENT ON CONSTRAINT profile_booking_requests_lineage_consistency_check ON profile_booking_requests IS NULL",
    missing: booking,
  },
  {
    name: "booking profile index removed",
    sql: "DROP INDEX idx_profile_booking_requests_profile",
    missing: booking,
  },
  {
    name: "booking profile index predicate removed",
    sql: `DROP INDEX idx_profile_booking_requests_profile;
      CREATE INDEX idx_profile_booking_requests_profile ON profile_booking_requests(profile_id);
      COMMENT ON INDEX idx_profile_booking_requests_profile IS 'tradescout-schema:0128:v4'`,
    missing: booking,
  },
  {
    name: "booking immutability trigger disabled",
    sql: "ALTER TABLE profile_booking_requests DISABLE TRIGGER profile_booking_requests_lineage_immutability_trigger",
    missing: "profile_booking_requests_lineage_immutability_trigger",
  },
  {
    name: "booking immutability function replaced",
    sql: `CREATE OR REPLACE FUNCTION enforce_profile_booking_request_lineage_immutability()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`,
    missing: "profile_booking_requests_lineage_immutability_trigger",
  },
  {
    name: "document synthetic job constraint removed",
    sql: "ALTER TABLE documents DROP CONSTRAINT documents_job_id_no_synthetic_accounting_check",
    missing: documents,
  },
  {
    name: "document exact prefix guard replaced by wildcard",
    sql: `ALTER TABLE documents DROP CONSTRAINT documents_job_id_no_synthetic_accounting_check;
      ALTER TABLE documents ADD CONSTRAINT documents_job_id_no_synthetic_accounting_check
        CHECK (job_id IS NULL OR job_id NOT LIKE 'acct_%');
      COMMENT ON CONSTRAINT documents_job_id_no_synthetic_accounting_check ON documents
        IS 'tradescout-schema:0130:v1'`,
    missing: documents,
  },
  {
    name: "document exact prefix guard uses wrong length",
    sql: `ALTER TABLE documents DROP CONSTRAINT documents_job_id_no_synthetic_accounting_check;
      ALTER TABLE documents ADD CONSTRAINT documents_job_id_no_synthetic_accounting_check
        CHECK (job_id IS NULL OR left(job_id, 6) <> 'acct_');
      COMMENT ON CONSTRAINT documents_job_id_no_synthetic_accounting_check ON documents
        IS 'tradescout-schema:0130:v1'`,
    missing: documents,
  },
];

for (const [table, label] of [
  ["realtor_profiles", "realtor"],
  ["car_salesman_profiles", "car salesman"],
]) {
  const missing = `${table}[professional application integrity contract]`;
  cases.push(
    {
      name: `${label} active default widened`,
      sql: `ALTER TABLE ${table} ALTER COLUMN is_active SET DEFAULT true`,
      missing,
    },
    {
      name: `${label} verification default widened`,
      sql: `ALTER TABLE ${table} ALTER COLUMN verification_status SET DEFAULT 'approved'`,
      missing,
    },
    {
      name: `${label} reviewer foreign key removed`,
      sql: `ALTER TABLE ${table} DROP CONSTRAINT ${table}_reviewed_by_fk`,
      missing,
    },
    {
      name: `${label} review notes constraint removed`,
      sql: `ALTER TABLE ${table} DROP CONSTRAINT ${table}_review_notes_length_check`,
      missing,
    },
    {
      name: `${label} unique index descriptive provenance truncated`,
      sql: `COMMENT ON INDEX uq_${table}_user_id IS 'tradescout-schema:0129:v2'`,
      missing,
    },
    {
      name: `${label} one-application uniqueness removed`,
      sql: `DROP INDEX uq_${table}_user_id;
        CREATE INDEX uq_${table}_user_id ON ${table}(user_id);
        COMMENT ON INDEX uq_${table}_user_id
          IS 'One ${label} application record per user; tradescout-schema:0129:v2'`,
      missing,
    }
  );
}

async function main() {
  assert.equal(process.cwd(), root, "Run this native proof from the repository root");
  const rawUrl = String(process.env.TEST_DATABASE_URL || "").trim();
  assert.ok(rawUrl, "TEST_DATABASE_URL is required; DATABASE_URL is never a fallback");
  const target = assertDisposableTestDatabaseUrl(rawUrl);
  assert.equal(target.loopback, true, "Native recovery mutation proof requires loopback");
  const parsedUrl = new URL(rawUrl);
  const journal = verifyJournal();
  const client = new pg.Client({ connectionString: rawUrl, connectionTimeoutMillis: 5000 });
  const results = [];
  let transactionOpen = false;
  try {
    await client.connect();
    const {
      rows: [identity],
    } = await client.query(`SELECT current_database() AS database,
      host(inet_server_addr()) AS address, inet_server_port() AS port`);
    assert.equal(
      identity.database,
      target.database,
      "Connected database must match the guarded URL"
    );
    assert.ok(["127.0.0.1", "::1"].includes(identity.address), "Connected server must be loopback");
    assert.equal(identity.port, Number(parsedUrl.port || 5432));
    await client.query("SET statement_timeout = '15s'; SET lock_timeout = '3s'");
    await verifyRequiredProductionSchema(client);
    const ledgerBefore = (
      await client.query(
        "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id"
      )
    ).rows;
    for (const entry of journal.additions) {
      const hashes = buildLineEndingCompatibleMigrationHashes(
        fs.readFileSync(path.join(root, "migrations", `${entry.tag}.sql`), "utf8")
      );
      assert.ok(
        ledgerBefore.some(
          (row) => hashes.includes(row.hash) && Number(row.created_at) === entry.when
        ),
        `${entry.tag} must be recorded after its real execution`
      );
    }

    // Execute the real professional migration against claims-first and legacy
    // accounts. The transaction restores every fixture and DDL change afterward.
    const roleFixtures = [
      {
        name: "unfinished claims-first account",
        role: null,
        active: null,
        roles: [],
        nextRole: null,
        nextActive: null,
        nextRoles: [],
      },
      {
        name: "unrelated authority retained",
        role: null,
        active: "contractor",
        roles: ["contractor"],
        nextRole: null,
        nextActive: "contractor",
        nextRoles: ["contractor"],
      },
      {
        name: "pending realtor grants no role",
        role: null,
        active: "realtor",
        roles: ["realtor", "contractor"],
        profile: "realtor",
        status: "pending",
        enabled: false,
        nextRole: null,
        nextActive: null,
        nextRoles: ["contractor"],
      },
      {
        name: "rejected dealer grants no role",
        role: null,
        active: "vehicle-dealer",
        roles: ["car_salesman"],
        profile: "dealer",
        status: "rejected",
        enabled: false,
        nextRole: null,
        nextActive: null,
        nextRoles: [],
      },
      {
        name: "inactive approval grants no role",
        role: null,
        active: null,
        roles: [],
        profile: "realtor",
        status: "approved",
        enabled: false,
        nextRole: null,
        nextActive: null,
        nextRoles: [],
      },
      {
        name: "approved realtor retains authority",
        role: null,
        active: "Realtor",
        roles: [],
        profile: "realtor",
        status: "approved",
        enabled: true,
        nextRole: "realtor",
        nextActive: "realtor",
        nextRoles: ["realtor"],
      },
      {
        name: "approved dealer retains authority",
        role: null,
        active: "vehicle-dealer",
        roles: [],
        profile: "dealer",
        status: "approved",
        enabled: true,
        nextRole: "car_dealer",
        nextActive: "car_dealer",
        nextRoles: ["car_dealer"],
      },
      {
        name: "unapproved persisted realtor revoked",
        role: "realtor",
        active: "realtor",
        roles: ["realtor"],
        nextRole: "homeowner",
        nextActive: "homeowner",
        nextRoles: [],
      },
      {
        name: "unapproved persisted dealer revoked",
        role: "car_dealer",
        active: "car_dealer",
        roles: ["car_dealer"],
        nextRole: "homeowner",
        nextActive: "homeowner",
        nextRoles: [],
      },
    ];
    await client.query("BEGIN");
    transactionOpen = true;
    try {
      for (const fixture of roleFixtures) {
        fixture.id = `migration-role-${crypto.randomUUID()}`;
        await client.query(
          `INSERT INTO users (id, email, role, active_role, roles, onboarding_completed)
          VALUES ($1, $2, $3, $4, $5, false)`,
          [fixture.id, `${fixture.id}@example.invalid`, fixture.role, fixture.active, fixture.roles]
        );
        if (fixture.profile === "realtor") {
          await client.query(
            `INSERT INTO realtor_profiles
            (user_id, license_number, brokerage_name, license_state, verification_status, is_active)
            VALUES ($1, 'SYNTHETIC', 'Native migration fixture', 'LA', $2, $3)`,
            [fixture.id, fixture.status, fixture.enabled]
          );
        } else if (fixture.profile === "dealer") {
          await client.query(
            `INSERT INTO car_salesman_profiles
            (user_id, dealership_name, dealer_license, license_state, verification_status, is_active)
            VALUES ($1, 'Native migration fixture', 'SYNTHETIC', 'LA', $2, $3)`,
            [fixture.id, fixture.status, fixture.enabled]
          );
        }
      }
      await client.query(
        fs.readFileSync(
          path.join(root, "migrations/0133_professional_application_integrity.sql"),
          "utf8"
        )
      );
      for (const fixture of roleFixtures) {
        const {
          rows: [actual],
        } = await client.query(
          `SELECT role, active_role, roles, onboarding_completed
          FROM users WHERE id = $1`,
          [fixture.id]
        );
        assert.deepEqual(
          actual,
          {
            role: fixture.nextRole,
            active_role: fixture.nextActive,
            roles: fixture.nextRoles,
            onboarding_completed: false,
          },
          fixture.name
        );
        results.push({ name: fixture.name, migrationAuthorityPreserved: true });
      }
    } finally {
      await client.query("ROLLBACK");
      transactionOpen = false;
    }
    await verifyRequiredProductionSchema(client);

    for (const scenario of cases) {
      await client.query("BEGIN");
      transactionOpen = true;
      try {
        // PostgreSQL DDL and ledger mutations are visible to this same client
        // but are never committed. Unexpected SQL errors do not count as proof.
        await client.query(scenario.sql);
        await assert.rejects(
          () => verifyRequiredProductionSchema(client),
          (error) => {
            assert.ok(error instanceof Error);
            const expected = `Required production schema is missing: ${scenario.missing} ${DATABASE_RECOVERY_GUIDANCE}`;
            assert.equal(
              error.message,
              expected,
              `${scenario.name} must fail its specific contract, not an unrelated query error`
            );
            return true;
          }
        );
      } finally {
        await client.query("ROLLBACK");
        transactionOpen = false;
      }
      await verifyRequiredProductionSchema(client);
      results.push({ name: scenario.name, rejected: true, restoredAfterRollback: true });
    }
    assert.deepEqual(
      (
        await client.query(
          "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id"
        )
      ).rows,
      ledgerBefore,
      "Native damage proof must not alter migration history"
    );
    console.log(
      JSON.stringify(
        {
          passed: true,
          database: identity.database,
          nativeCases: results.length,
          canonicalBeforeAndAfterEveryCase: true,
          transactionsRolledBack: true,
          migrationHistoryUnchanged: true,
          journal,
          sourceFingerprints: Object.fromEntries(
            [
              "scripts/check-required-production-schema.mjs",
              "scripts/tests/recovery-schema.native.mjs",
              "migrations/meta/_journal.json",
              ...RECOVERY_TAGS.map((tag) => `migrations/${tag}.sql`),
            ].map((filename) => [filename, sha256(fs.readFileSync(path.join(root, filename)))])
          ),
          results,
        },
        null,
        2
      )
    );
  } finally {
    if (transactionOpen) await client.query("ROLLBACK");
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    "[recovery-schema.native] Failed:",
    error instanceof Error ? error.message : "Native verification failed"
  );
  process.exitCode = 1;
});
