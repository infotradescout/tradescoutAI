import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { spawnCommand } from "./lib/subprocess.mjs";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env.test") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const bootstrapLockName = "tradescout_test_db_bootstrap_v4";
const bootstrapLockOwner = `${process.env.GITHUB_RUN_ID || "local"}:${process.pid}:${randomUUID()}`;

if (!testDatabaseUrl) {
  console.error("Missing TEST_DATABASE_URL. Run `node scripts/ensure-test-db.mjs` first.");
  process.exit(2);
}

async function runWithInput(command, args, env = process.env, input = "") {
  const child = await spawnCommand(command, args, {
    cwd: repoRoot,
    stdio: ["pipe", "inherit", "inherit"],
    env,
  });

  child.stdin.on("error", () => {});
  let inputTimer;
  if (input) {
    const writeInput = () => {
      try {
        if (child.stdin.writable) child.stdin.write(input);
      } catch {
        // The process may exit while a prompt tick is in flight.
      }
    };
    writeInput();
    inputTimer = setInterval(writeInput, 1000);
  }

  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      if (inputTimer) clearInterval(inputTimer);
      if (!child.stdin.destroyed) child.stdin.end();
    };
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code) => {
      cleanup();
      resolve(code ?? 1);
    });
  });
}

async function tableExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1) AS table_name", [
    `public.${tableName}`,
  ]);
  return Boolean(result.rows[0]?.table_name);
}

async function queryIfTableExists(client, tableName, sql) {
  if (await tableExists(client, tableName)) {
    await client.query(sql);
  }
}

async function ensureLeaseTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS test_db_locks (
      name text PRIMARY KEY,
      owner text NOT NULL,
      expires_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function tryAcquireLease(client, lockName, owner) {
  const result = await client.query(
    `
      INSERT INTO test_db_locks (name, owner, expires_at, updated_at)
      VALUES ($1, $2, now() + interval '10 minutes', now())
      ON CONFLICT (name) DO UPDATE
      SET owner = EXCLUDED.owner,
          expires_at = EXCLUDED.expires_at,
          updated_at = now()
      WHERE test_db_locks.expires_at < now()
         OR test_db_locks.updated_at < now() - interval '2 minutes'
      RETURNING owner
    `,
    [lockName, owner]
  );
  return result.rows[0]?.owner === owner;
}

async function waitForLeaseLock(client, lockName, owner) {
  let attempts = 0;
  for (;;) {
    if (await tryAcquireLease(client, lockName, owner)) return;
    attempts += 1;
    if (attempts % 30 === 0) {
      console.log(`[bootstrap-test-db] Still waiting for test DB bootstrap lock (${attempts}s).`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function withBootstrapLock(task) {
  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  let lockAcquired = false;
  let heartbeat;
  try {
    console.log("[bootstrap-test-db] Waiting for test DB bootstrap lock...");
    await ensureLeaseTable(client);
    await waitForLeaseLock(client, bootstrapLockName, bootstrapLockOwner);
    lockAcquired = true;
    console.log("[bootstrap-test-db] Test DB bootstrap lock acquired.");
    heartbeat = setInterval(() => {
      client
        .query(
          `
            UPDATE test_db_locks
            SET expires_at = now() + interval '10 minutes',
                updated_at = now()
            WHERE name = $1 AND owner = $2
          `,
          [bootstrapLockName, bootstrapLockOwner]
        )
        .catch(() => {});
    }, 30_000);
    return await task();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (lockAcquired) {
      await client
        .query("DELETE FROM test_db_locks WHERE name = $1 AND owner = $2", [
          bootstrapLockName,
          bootstrapLockOwner,
        ])
        .catch(() => {});
    }
    await client.end();
  }
}

async function ensureCriticalSchema() {
  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  try {
    // HomeID base vault schema. This mirrors migration 0053 so browser/E2E
    // flows do not depend on optional full-sync pushes.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_home_record_type') THEN
          CREATE TYPE user_home_record_type AS ENUM (
            'inspection',
            'upgrade',
            'improvement',
            'maintenance',
            'appliance',
            'warranty',
            'note'
          );
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_home_document_type') THEN
          CREATE TYPE user_home_document_type AS ENUM (
            'inspection_report',
            'invoice',
            'receipt',
            'photo',
            'manual',
            'permit',
            'other'
          );
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_homes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nickname varchar,
        property_type varchar,
        year_built integer,
        address1 varchar,
        address2 varchar,
        city varchar,
        state_code varchar(2),
        county_fips varchar(5),
        zip_code varchar,
        home_scout_listing_id varchar REFERENCES home_scout_listings(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_homes_owner_updated
      ON user_homes(owner_user_id, updated_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_homes_listing
      ON user_homes(home_scout_listing_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_home_records (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        home_id varchar NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,
        created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        record_type user_home_record_type NOT NULL,
        occurred_at date,
        title varchar NOT NULL,
        details text,
        cost numeric(14,2),
        tags jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_home_records_home_occurred
      ON user_home_records(home_id, occurred_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_home_records_home_created
      ON user_home_records(home_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_home_records_type
      ON user_home_records(record_type)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_home_appliances (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        home_id varchar NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,
        created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        category varchar(64) NOT NULL,
        brand varchar(120),
        model varchar(160),
        serial varchar(160),
        installed_at date,
        notes text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_home_appliances_home
      ON user_home_appliances(home_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_home_appliances_category
      ON user_home_appliances(category)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_home_documents (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        home_id varchar NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,
        record_id varchar REFERENCES user_home_records(id) ON DELETE SET NULL,
        uploaded_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        document_type user_home_document_type NOT NULL DEFAULT 'other',
        object_key varchar NOT NULL,
        original_name varchar,
        content_type varchar,
        bytes bigint,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_home_documents_home_created
      ON user_home_documents(home_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_home_documents_record
      ON user_home_documents(record_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_maintenance_schedules (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_home_id varchar NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,
        title varchar(220) NOT NULL,
        description text,
        category varchar(64),
        cadence_days integer NOT NULL DEFAULT 30,
        next_due_at timestamp NOT NULL,
        last_completed_at timestamp,
        status varchar(24) NOT NULL DEFAULT 'active',
        assigned_business_id varchar REFERENCES businesses(id) ON DELETE SET NULL,
        share_with_assigned_provider boolean NOT NULL DEFAULT false,
        share_address boolean NOT NULL DEFAULT false,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_home_maint_sched_owner
      ON home_maintenance_schedules(owner_user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_home_maint_sched_home
      ON home_maintenance_schedules(user_home_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_home_maint_sched_next_due
      ON home_maintenance_schedules(next_due_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_home_maint_sched_assigned_biz
      ON home_maintenance_schedules(assigned_business_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_report_shares (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shared_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        thread_id varchar NOT NULL,
        thread_type varchar(24) NOT NULL DEFAULT 'marketplace',
        user_home_id varchar NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,
        include_address boolean NOT NULL DEFAULT false,
        include_documents boolean NOT NULL DEFAULT false,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        revoked_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_home_report_shares_thread
      ON home_report_shares(thread_id, created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_home_report_shares_home
      ON home_report_shares(user_home_id, created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_home_report_shares_owner
      ON home_report_shares(owner_user_id, updated_at)
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_intent AS ENUM ('person', 'business');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE profile_business_type AS ENUM ('service_provider', 'seller');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE profile_visibility AS ENUM ('private', 'discoverable');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE seller_type AS ENUM ('physical', 'online', 'hybrid');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_visibility profile_visibility DEFAULT 'private'
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS verified_badge boolean DEFAULT false
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 10
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_intent user_intent NOT NULL,
        profile_business_type profile_business_type,
        service_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
        seller_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
        seller_type seller_type,
        role user_role NOT NULL DEFAULT 'homeowner',
        roles text[] NOT NULL DEFAULT ARRAY[]::text[],
        profile_visibility profile_visibility DEFAULT 'private',
        verified_badge boolean DEFAULT false,
        trust_score integer DEFAULT 10,
        verification_requirements jsonb DEFAULT '{}'::jsonb,
        verification_status verification_status DEFAULT 'pending',
        email_verified boolean DEFAULT false,
        address_verified boolean DEFAULT false,
        license_verified boolean DEFAULT false,
        insurance_verified boolean DEFAULT false,
        tax_id_verified boolean DEFAULT false,
        business_registration_verified boolean DEFAULT false,
        is_primary boolean DEFAULT false,
        display_name varchar,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS user_profiles_user_idx
      ON user_profiles(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS user_profiles_visibility_idx
      ON user_profiles(profile_visibility)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS user_profiles_primary_idx
      ON user_profiles(is_primary)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS user_profiles_intent_idx
      ON user_profiles(user_intent)
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referred_by_affiliate_account_id varchar
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referred_at timestamp
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dc_provider_accepted';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dc_provider_declined';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dc_provider_interested';
          ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dc_request_completed';
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE observation_subject_type AS ENUM (
          'property',
          'business',
          'road',
          'area',
          'org',
          'person_unknown',
          'other'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE observation_source_type AS ENUM (
          'permit',
          'inspection',
          'enforcement',
          'agenda',
          'ordinance',
          'sensor',
          'listing',
          'other'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE observation_confidence AS ENUM ('official', 'inferred');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE observation_health_status AS ENUM (
          'healthy',
          'degraded',
          'failing',
          'idle'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS observations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        occurred_at timestamp NOT NULL,
        county_fips varchar(5) NOT NULL REFERENCES counties(fips),
        state_code varchar(2) NOT NULL REFERENCES states(code),
        city varchar(120),
        geo_json jsonb,
        subject_type observation_subject_type NOT NULL,
        subject_ref varchar(255),
        action_type varchar(64) NOT NULL,
        source_type observation_source_type NOT NULL,
        source_ref varchar(255) NOT NULL,
        attributes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        confidence observation_confidence NOT NULL DEFAULT 'official',
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_observations_county_occurred
      ON observations (county_fips, occurred_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_observations_source_occurred
      ON observations (source_type, occurred_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_observations_action_occurred
      ON observations (action_type, occurred_at)
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_observations_source_ref
      ON observations (source_type, source_ref)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS observation_sources (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type observation_source_type NOT NULL,
        county_fips varchar(5) NOT NULL REFERENCES counties(fips),
        state_code varchar(2) NOT NULL REFERENCES states(code),
        last_success_at timestamp,
        last_run_at timestamp,
        cursor_json jsonb,
        health_status observation_health_status NOT NULL DEFAULT 'idle',
        error_message text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_observation_sources_type_county
      ON observation_sources (source_type, county_fips)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_observation_sources_health
      ON observation_sources (health_status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_observation_sources_county
      ON observation_sources (county_fips)
    `);

    await client.query(`
      ALTER TABLE work_requests
      ADD COLUMN IF NOT EXISTS share_token varchar(64)
    `);

    await client.query(`
      ALTER TABLE work_requests
      ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryIfTableExists(
      client,
      "promotions",
      `
        ALTER TABLE promotions
          ADD COLUMN IF NOT EXISTS tier varchar DEFAULT 'free_directory',
          ADD COLUMN IF NOT EXISTS placement_community_snapshot boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS placement_community_feed boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS placement_scout boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS placement_marketplace boolean NOT NULL DEFAULT false
      `
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS trust_ledger_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        entity_type varchar(80) NOT NULL,
        entity_id varchar(120) NOT NULL,
        event_type varchar(120) NOT NULL,
        source_surface varchar(80) NOT NULL,
        verification_level varchar(40) NOT NULL DEFAULT 'none',
        confidence numeric(4, 3) NOT NULL DEFAULT 0.500,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trust_ledger_entity
      ON trust_ledger_events(entity_type, entity_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trust_ledger_event
      ON trust_ledger_events(event_type, created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trust_ledger_actor
      ON trust_ledger_events(actor_user_id, created_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS direct_connect_giveaway_entries (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        work_request_id varchar NOT NULL REFERENCES work_requests(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        promotion_key varchar NOT NULL DEFAULT 'direct_connect_giveaway_2026_06',
        entry_method varchar NOT NULL DEFAULT 'direct_connect',
        residency_state_code varchar(2),
        is_eligible boolean NOT NULL DEFAULT false,
        eligibility_reason varchar NOT NULL,
        eligibility_snapshot jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT direct_connect_giveaway_entries_entry_method_check
          CHECK (entry_method IN ('direct_connect', 'alternate_email'))
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS dc_giveaway_entries_work_request_unique
      ON direct_connect_giveaway_entries(work_request_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS dc_giveaway_entries_promotion_eligible_idx
      ON direct_connect_giveaway_entries(promotion_key, is_eligible)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS dc_giveaway_entries_user_idx
      ON direct_connect_giveaway_entries(user_id)
    `);

    await client.query(`
      ALTER TABLE work_request_assignments
      ADD COLUMN IF NOT EXISTS responder_user_id varchar REFERENCES users(id) ON DELETE SET NULL
    `);

    await client.query(`
      ALTER TABLE work_request_assignments
      ADD COLUMN IF NOT EXISTS worker_id varchar REFERENCES workers(id) ON DELETE SET NULL
    `);

    await client.query(`
      ALTER TABLE work_request_assignments
      ADD COLUMN IF NOT EXISTS score_snapshot jsonb
    `);

    await client.query(`
      ALTER TABLE work_request_assignments
      ADD COLUMN IF NOT EXISTS response_summary jsonb
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wra_responder_user_id
      ON work_request_assignments(responder_user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wra_worker_id
      ON work_request_assignments(worker_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_scout_listings (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        source_key varchar(64) NOT NULL DEFAULT 'manual',
        source_listing_id varchar(128),
        dedupe_key varchar(160),
        status varchar(32) NOT NULL DEFAULT 'pending_review',
        approved_at timestamp,
        approved_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        title varchar(200) NOT NULL,
        description text,
        price numeric(12, 2) NOT NULL,
        price_previous numeric(12, 2),
        price_changed_at timestamp,
        listed_at timestamp,
        off_market_at timestamp,
        external_url varchar(500),
        source_updated_at timestamp,
        observed_at timestamp,
        last_seen_at timestamp,
        dom_days integer,
        property_type varchar(32) NOT NULL DEFAULT 'house',
        beds integer,
        baths numeric(4, 1),
        sqft integer,
        lot_sqft integer,
        year_built integer,
        features jsonb,
        county_fips varchar(5) NOT NULL REFERENCES counties(fips),
        state_code varchar(2) NOT NULL REFERENCES states(code),
        city varchar(100),
        zip_code varchar(10),
        address_1 varchar(255),
        address_2 varchar(255),
        address_visibility varchar(16) NOT NULL DEFAULT 'exact',
        latitude numeric(9, 6),
        longitude numeric(9, 6),
        photos jsonb NOT NULL DEFAULT '[]'::jsonb,
        seller_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        agent_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        contact_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        listing_author_type varchar(16) NOT NULL DEFAULT 'owner',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      ALTER TABLE home_scout_listings
      ADD COLUMN IF NOT EXISTS source_key varchar(64) NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS source_listing_id varchar(128),
      ADD COLUMN IF NOT EXISTS dedupe_key varchar(160),
      ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'pending_review',
      ADD COLUMN IF NOT EXISTS approved_at timestamp,
      ADD COLUMN IF NOT EXISTS approved_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS title varchar(200),
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS price numeric(12, 2),
      ADD COLUMN IF NOT EXISTS price_previous numeric(12, 2),
      ADD COLUMN IF NOT EXISTS price_changed_at timestamp,
      ADD COLUMN IF NOT EXISTS listed_at timestamp,
      ADD COLUMN IF NOT EXISTS off_market_at timestamp,
      ADD COLUMN IF NOT EXISTS external_url varchar(500),
      ADD COLUMN IF NOT EXISTS source_updated_at timestamp,
      ADD COLUMN IF NOT EXISTS observed_at timestamp,
      ADD COLUMN IF NOT EXISTS last_seen_at timestamp,
      ADD COLUMN IF NOT EXISTS dom_days integer,
      ADD COLUMN IF NOT EXISTS property_type varchar(32) NOT NULL DEFAULT 'house',
      ADD COLUMN IF NOT EXISTS beds integer,
      ADD COLUMN IF NOT EXISTS baths numeric(4, 1),
      ADD COLUMN IF NOT EXISTS sqft integer,
      ADD COLUMN IF NOT EXISTS lot_sqft integer,
      ADD COLUMN IF NOT EXISTS year_built integer,
      ADD COLUMN IF NOT EXISTS features jsonb,
      ADD COLUMN IF NOT EXISTS county_fips varchar(5) REFERENCES counties(fips),
      ADD COLUMN IF NOT EXISTS state_code varchar(2) REFERENCES states(code),
      ADD COLUMN IF NOT EXISTS city varchar(100),
      ADD COLUMN IF NOT EXISTS zip_code varchar(10),
      ADD COLUMN IF NOT EXISTS address_1 varchar(255),
      ADD COLUMN IF NOT EXISTS address_2 varchar(255),
      ADD COLUMN IF NOT EXISTS address_visibility varchar(16) NOT NULL DEFAULT 'exact',
      ADD COLUMN IF NOT EXISTS latitude numeric(9, 6),
      ADD COLUMN IF NOT EXISTS longitude numeric(9, 6),
      ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS seller_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS agent_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS contact_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS listing_author_type varchar(16) NOT NULL DEFAULT 'owner',
      ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_county_status
      ON home_scout_listings(county_fips, status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_county_price
      ON home_scout_listings(county_fips, status, price)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_county_listed_at
      ON home_scout_listings(county_fips, status, listed_at)
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_homescout_source_listing
      ON home_scout_listings(source_key, source_listing_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_scout_sources (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        source_key varchar(64) NOT NULL,
        source_type varchar(32) NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        last_run_at timestamp,
        last_success_at timestamp,
        last_error text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_homescout_sources_source_key
      ON home_scout_sources(source_key)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_scout_ingest_runs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id varchar NOT NULL REFERENCES home_scout_sources(id) ON DELETE CASCADE,
        status varchar(16) NOT NULL DEFAULT 'running',
        stats jsonb NOT NULL DEFAULT '{}'::jsonb,
        started_at timestamp NOT NULL DEFAULT now(),
        finished_at timestamp,
        error text
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_ingest_runs_source_started
      ON home_scout_ingest_runs(source_id, started_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_scout_listing_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id varchar NOT NULL REFERENCES home_scout_listings(id) ON DELETE CASCADE,
        event_type varchar(32) NOT NULL,
        observed_at timestamp NOT NULL DEFAULT now(),
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_listing_events_listing_time
      ON home_scout_listing_events(listing_id, observed_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_listing_events_type_time
      ON home_scout_listing_events(event_type, observed_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_scout_market_buckets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        county_fips varchar(5) NOT NULL REFERENCES counties(fips),
        state_code varchar(2) NOT NULL REFERENCES states(code),
        property_type varchar(32) NOT NULL,
        beds_bucket integer,
        active_count integer NOT NULL DEFAULT 0,
        median_price numeric(12, 2),
        median_price_per_sqft numeric(12, 2),
        median_dom_days integer,
        price_drop_count_7d integer NOT NULL DEFAULT 0,
        computed_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_homescout_market_bucket
      ON home_scout_market_buckets(county_fips, state_code, property_type, beds_bucket)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_market_bucket_county_type
      ON home_scout_market_buckets(county_fips, state_code, property_type)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_scout_listing_reports (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id varchar NOT NULL REFERENCES home_scout_listings(id) ON DELETE CASCADE,
        reporter_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        reason varchar(64) NOT NULL,
        message text,
        status varchar(16) NOT NULL DEFAULT 'open',
        created_at timestamp NOT NULL DEFAULT now(),
        closed_at timestamp,
        closed_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_reports_listing
      ON home_scout_listing_reports(listing_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_reports_status_created
      ON home_scout_listing_reports(status, created_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_scout_inspection_requests (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id varchar NOT NULL REFERENCES home_scout_listings(id) ON DELETE CASCADE,
        requester_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status varchar(16) NOT NULL DEFAULT 'open',
        request_message text NOT NULL,
        preferred_window varchar(120),
        fulfilled_at timestamp,
        cancelled_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_inspection_requests_listing_status
      ON home_scout_inspection_requests(listing_id, status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_inspection_requests_requester
      ON home_scout_inspection_requests(requester_user_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_scout_inspection_reports (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id varchar NOT NULL REFERENCES home_scout_listings(id) ON DELETE CASCADE,
        submitted_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        report_type varchar(32) NOT NULL DEFAULT 'other',
        inspection_date date,
        inspector_name varchar(140),
        inspector_company varchar(140),
        inspector_license varchar(80),
        summary text,
        highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
        report_url varchar(500) NOT NULL,
        source_request_id varchar REFERENCES home_scout_inspection_requests(id) ON DELETE SET NULL,
        visibility varchar(16) NOT NULL DEFAULT 'public',
        status varchar(16) NOT NULL DEFAULT 'published',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_inspection_reports_listing_visibility
      ON home_scout_inspection_reports(listing_id, visibility, status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_inspection_reports_submitter
      ON home_scout_inspection_reports(submitted_by_user_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS home_scout_inspection_service_requests (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id varchar NOT NULL REFERENCES home_scout_inspection_reports(id) ON DELETE CASCADE,
        listing_id varchar NOT NULL REFERENCES home_scout_listings(id) ON DELETE CASCADE,
        requester_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        county_fips varchar(5) NOT NULL REFERENCES counties(fips),
        state_code varchar(2) NOT NULL REFERENCES states(code),
        service_category varchar(64) NOT NULL,
        service_description text NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'open',
        work_request_id varchar REFERENCES work_requests(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_inspection_service_requests_report
      ON home_scout_inspection_service_requests(report_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_inspection_service_requests_requester
      ON home_scout_inspection_service_requests(requester_user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_inspection_service_requests_status
      ON home_scout_inspection_service_requests(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_homescout_inspection_service_requests_county
      ON home_scout_inspection_service_requests(county_fips, state_code)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS commercial_projects (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        created_by_user_id varchar NOT NULL REFERENCES users(id),
        county_fips varchar(5) NOT NULL REFERENCES counties(fips),
        state_code varchar(2) NOT NULL REFERENCES states(code),
        title varchar(220) NOT NULL,
        slug varchar(260) NOT NULL UNIQUE,
        summary text NOT NULL,
        scope_of_work text NOT NULL,
        requirements text NOT NULL,
        budget_min numeric(14, 2),
        budget_max numeric(14, 2),
        bid_due_at timestamp,
        project_start_at timestamp,
        status varchar(24) NOT NULL DEFAULT 'open',
        winning_bid_id varchar,
        campaign_enabled boolean NOT NULL DEFAULT false,
        campaign_headline varchar(220),
        campaign_body text,
        hero_image_url varchar(500),
        published_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commercial_projects_county_status
      ON commercial_projects(county_fips, status, created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commercial_projects_slug
      ON commercial_projects(slug)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS commercial_project_documents (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL REFERENCES commercial_projects(id) ON DELETE CASCADE,
        uploaded_by_user_id varchar NOT NULL REFERENCES users(id),
        file_name varchar(255) NOT NULL,
        file_url varchar(600) NOT NULL,
        mime_type varchar(120),
        file_size_bytes integer,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commercial_project_documents_project
      ON commercial_project_documents(project_id, created_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS commercial_project_bids (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id varchar NOT NULL REFERENCES commercial_projects(id) ON DELETE CASCADE,
        contractor_id varchar NOT NULL REFERENCES contractors(id),
        bidder_user_id varchar NOT NULL REFERENCES users(id),
        amount numeric(14, 2) NOT NULL,
        timeline_days integer,
        proposal text NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'submitted',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_commercial_project_bid_per_contractor
      ON commercial_project_bids(project_id, contractor_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commercial_project_bids_project_status
      ON commercial_project_bids(project_id, status, created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commercial_project_bids_bidder
      ON commercial_project_bids(bidder_user_id, created_at)
    `);

    await client.query(`
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS claim_status varchar(32) DEFAULT 'unclaimed'
    `);

    await client.query(`
      ALTER TABLE businesses
      ALTER COLUMN owner_user_id DROP NOT NULL
    `);

    await client.query(`
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trust_snapshots (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
        county_fips varchar(5) NOT NULL,
        cvs_score numeric(5,2) NOT NULL,
        verification_status varchar,
        license_status varchar,
        insurance_status varchar,
        risk_flags text[],
        computed_at timestamp DEFAULT now(),
        version integer DEFAULT 1
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trust_snapshots_user_county
      ON trust_snapshots (user_id, county_fips)
    `);

    if (await tableExists(client, "employment_posts")) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS employment_post_applications (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          post_id varchar NOT NULL REFERENCES employment_posts(id) ON DELETE CASCADE,
          applicant_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          message text,
          status varchar(32) NOT NULL DEFAULT 'pending',
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now(),
          UNIQUE (post_id, applicant_user_id)
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_epa_post_id
        ON employment_post_applications(post_id, created_at DESC)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_epa_applicant
        ON employment_post_applications(applicant_user_id, created_at DESC)
      `);
    }

    // SEO discovery "new & true only" scaffolding (publication rules + prune log + safe public activity).
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE ts_public_activity_type AS ENUM (
          'listing_added',
          'listing_updated',
          'claimed',
          'verified',
          'proof_added',
          'request_created_public_summary',
          'connection_made_public_summary'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE ts_seo_prune_action AS ENUM (
          'noindex',
          'removed_from_sitemap',
          'deactivated',
          'deleted'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_publication_rules (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        listing_stale_days_unclaimed integer NOT NULL,
        listing_stale_days_claimed_unverified integer NOT NULL,
        listing_stale_days_verified integer NOT NULL,
        request_public_summary_ttl_hours integer NOT NULL,
        category_page_recency_window_days integer NOT NULL,
        proof_media_ttl_days integer,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      INSERT INTO ts_publication_rules (
        id,
        listing_stale_days_unclaimed,
        listing_stale_days_claimed_unverified,
        listing_stale_days_verified,
        request_public_summary_ttl_hours,
        category_page_recency_window_days,
        proof_media_ttl_days
      )
      SELECT
        'default',
        365,
        180,
        730,
        72,
        90,
        NULL
      WHERE NOT EXISTS (SELECT 1 FROM ts_publication_rules WHERE id = 'default')
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_seo_prune_log (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        entity_type varchar(64) NOT NULL,
        entity_id varchar(255) NOT NULL,
        action ts_seo_prune_action NOT NULL,
        reason text NOT NULL,
        happened_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS ts_seo_prune_log_entity_idx
        ON ts_seo_prune_log(entity_type, entity_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_public_activity (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        county_id varchar REFERENCES counties(id) ON DELETE SET NULL,
        city_slug varchar(128),
        state_code varchar(2),
        trade_slug varchar(128),
        business_id varchar REFERENCES businesses(id) ON DELETE SET NULL,
        activity_type ts_public_activity_type NOT NULL,
        occurred_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        public_text text,
        created_at timestamptz NOT NULL DEFAULT now(),
        active_status boolean NOT NULL DEFAULT true
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS ts_public_activity_expires_idx
        ON ts_public_activity(expires_at)
    `);

    await client.query(`
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS public_discovery_enabled boolean NOT NULL DEFAULT true
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_seo_trade_county_pages (
        trade_slug varchar(128) NOT NULL,
        county_id varchar REFERENCES counties(id) ON DELETE CASCADE,
        state_code varchar(2) NOT NULL,
        county_slug varchar(128) NOT NULL,
        lastmod timestamptz NOT NULL,
        business_count integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (trade_slug, county_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_seo_trade_city_pages (
        trade_slug varchar(128) NOT NULL,
        state_code varchar(2) NOT NULL,
        city_slug varchar(128) NOT NULL,
        lastmod timestamptz NOT NULL,
        business_count integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (trade_slug, state_code, city_slug)
      )
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE contact_permission_status AS ENUM (
          'pending',
          'accepted',
          'declined',
          'blocked'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_permissions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status contact_permission_status DEFAULT 'pending',
        last_request_type varchar,
        last_request_preview text,
        last_request_notification_id varchar,
        authority_gate varchar(30),
        source_decision_card_id varchar,
        source_scout_recommendation_id varchar,
        intent varchar,
        decision_scope text,
        confidence_score numeric(4,3),
        risk_flags text[],
        county_fips varchar(5),
        requester_trust_snapshot_id varchar,
        target_trust_snapshot_id varchar,
        responded_at timestamp,
        responded_by varchar REFERENCES users(id),
        response_reason text,
        cooldown_until timestamp,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      ALTER TABLE contact_permissions
      ADD COLUMN IF NOT EXISTS last_request_type varchar,
      ADD COLUMN IF NOT EXISTS last_request_preview text,
      ADD COLUMN IF NOT EXISTS last_request_notification_id varchar,
      ADD COLUMN IF NOT EXISTS authority_gate varchar(30),
      ADD COLUMN IF NOT EXISTS source_decision_card_id varchar,
      ADD COLUMN IF NOT EXISTS source_scout_recommendation_id varchar,
      ADD COLUMN IF NOT EXISTS intent varchar,
      ADD COLUMN IF NOT EXISTS decision_scope text,
      ADD COLUMN IF NOT EXISTS confidence_score numeric(4,3),
      ADD COLUMN IF NOT EXISTS risk_flags text[],
      ADD COLUMN IF NOT EXISTS county_fips varchar(5),
      ADD COLUMN IF NOT EXISTS requester_trust_snapshot_id varchar,
      ADD COLUMN IF NOT EXISTS target_trust_snapshot_id varchar,
      ADD COLUMN IF NOT EXISTS responded_at timestamp,
      ADD COLUMN IF NOT EXISTS responded_by varchar REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS response_reason text,
      ADD COLUMN IF NOT EXISTS cooldown_until timestamp,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uidx_contact_permissions_pair
      ON contact_permissions (requester_id, target_user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_permissions_target
      ON contact_permissions (target_user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_permissions_requester
      ON contact_permissions (requester_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_permissions_status
      ON contact_permissions (status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_permissions_county
      ON contact_permissions (county_fips)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_permission_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_permission_id varchar REFERENCES contact_permissions(id) ON DELETE cascade,
        requester_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
        target_user_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
        actor_id varchar REFERENCES users(id),
        event_type varchar NOT NULL,
        from_status contact_permission_status,
        to_status contact_permission_status,
        reason_code varchar,
        metadata jsonb,
        authority_gate varchar(30),
        source_decision_card_id varchar,
        source_scout_recommendation_id varchar,
        intent varchar,
        decision_scope text,
        confidence_score numeric(4,3),
        risk_flags text[],
        county_fips varchar(5),
        created_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      ALTER TABLE contact_permission_events
      ADD COLUMN IF NOT EXISTS contact_permission_id varchar REFERENCES contact_permissions(id) ON DELETE cascade,
      ADD COLUMN IF NOT EXISTS requester_id varchar REFERENCES users(id) ON DELETE cascade,
      ADD COLUMN IF NOT EXISTS target_user_id varchar REFERENCES users(id) ON DELETE cascade,
      ADD COLUMN IF NOT EXISTS actor_id varchar REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS event_type varchar,
      ADD COLUMN IF NOT EXISTS from_status contact_permission_status,
      ADD COLUMN IF NOT EXISTS to_status contact_permission_status,
      ADD COLUMN IF NOT EXISTS reason_code varchar,
      ADD COLUMN IF NOT EXISTS metadata jsonb,
      ADD COLUMN IF NOT EXISTS authority_gate varchar(30),
      ADD COLUMN IF NOT EXISTS source_decision_card_id varchar,
      ADD COLUMN IF NOT EXISTS source_scout_recommendation_id varchar,
      ADD COLUMN IF NOT EXISTS intent varchar,
      ADD COLUMN IF NOT EXISTS decision_scope text,
      ADD COLUMN IF NOT EXISTS confidence_score numeric(4,3),
      ADD COLUMN IF NOT EXISTS risk_flags text[],
      ADD COLUMN IF NOT EXISTS county_fips varchar(5),
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now()
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_permission_events_pair
      ON contact_permission_events (requester_id, target_user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_permission_events_contact
      ON contact_permission_events (contact_permission_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS decision_cards (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status varchar NOT NULL DEFAULT 'active',
        intent varchar NOT NULL,
        decision_scope text,
        title varchar,
        description text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        decided_at timestamp
      )
    `);

    await client.query(`
      ALTER TABLE decision_cards
      ADD COLUMN IF NOT EXISTS user_id varchar,
      ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS intent varchar NOT NULL DEFAULT 'hire',
      ADD COLUMN IF NOT EXISTS decision_scope text,
      ADD COLUMN IF NOT EXISTS title varchar,
      ADD COLUMN IF NOT EXISTS description text,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS decided_at timestamp
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_decision_cards_user
      ON decision_cards(user_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_conversations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id varchar NOT NULL,
        buyer_id varchar NOT NULL REFERENCES users(id),
        seller_id varchar NOT NULL REFERENCES users(id),
        status varchar DEFAULT 'active',
        last_message_at timestamp DEFAULT now(),
        buyer_rating integer,
        seller_rating integer,
        buyer_feedback text,
        seller_feedback text,
        is_read_by_buyer boolean DEFAULT false,
        is_read_by_seller boolean DEFAULT false,
        intent varchar,
        authority_gate varchar,
        source_decision_card_id varchar,
        source_scout_recommendation_id varchar,
        confidence_score numeric(3,2),
        decision_scope text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      ALTER TABLE marketplace_conversations
      ALTER COLUMN listing_id DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS intent varchar,
      ADD COLUMN IF NOT EXISTS authority_gate varchar,
      ADD COLUMN IF NOT EXISTS source_decision_card_id varchar,
      ADD COLUMN IF NOT EXISTS source_scout_recommendation_id varchar,
      ADD COLUMN IF NOT EXISTS confidence_score numeric(3,2),
      ADD COLUMN IF NOT EXISTS decision_scope text,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now()
    `);

    await client.query(`
      ALTER TABLE marketplace_conversations
      DROP CONSTRAINT IF EXISTS marketplace_conversations_listing_id_marketplace_listings_id_fk
    `);

    await client.query(`
      ALTER TABLE marketplace_listings
        ADD COLUMN IF NOT EXISTS shipping_quote jsonb,
        ADD COLUMN IF NOT EXISTS package_details jsonb,
        ADD COLUMN IF NOT EXISTS listing_type varchar DEFAULT 'single',
        ADD COLUMN IF NOT EXISTS bundle_purchase_mode varchar DEFAULT 'must_buy_all',
        ADD COLUMN IF NOT EXISTS bundle_items jsonb,
        ADD COLUMN IF NOT EXISTS value_guidance jsonb,
        ADD COLUMN IF NOT EXISTS rarity_tags jsonb DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS rarity_confidence varchar,
        ADD COLUMN IF NOT EXISTS rarity_sample_size integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS rarity_explanation text
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_buyer
      ON marketplace_conversations(buyer_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_seller
      ON marketplace_conversations(seller_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_intent
      ON marketplace_conversations(intent)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_authority_gate
      ON marketplace_conversations(authority_gate)
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE objective_intent_class AS ENUM (
          'unknown',
          'knowledge',
          'local_advice',
          'work_request',
          'marketplace_buy',
          'marketplace_sell',
          'community_post',
          'event',
          'safety_report',
          'account',
          'admin',
          'other'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'unknown';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'knowledge';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'local_advice';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'work_request';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'marketplace_buy';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'marketplace_sell';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'community_post';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'event';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'safety_report';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'account';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'admin';
      ALTER TYPE objective_intent_class ADD VALUE IF NOT EXISTS 'other';
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE objective_status AS ENUM ('active', 'paused', 'completed', 'abandoned');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      ALTER TYPE objective_status ADD VALUE IF NOT EXISTS 'active';
      ALTER TYPE objective_status ADD VALUE IF NOT EXISTS 'paused';
      ALTER TYPE objective_status ADD VALUE IF NOT EXISTS 'completed';
      ALTER TYPE objective_status ADD VALUE IF NOT EXISTS 'abandoned';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS objectives (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        intent_class objective_intent_class DEFAULT 'unknown',
        title varchar NOT NULL,
        summary text,
        confidence numeric(3,2) DEFAULT '0.5',
        context_json jsonb,
        source varchar DEFAULT 'scout',
        linked_object_type varchar DEFAULT 'none',
        linked_object_id varchar,
        status objective_status DEFAULT 'active',
        last_scout_message_id varchar,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objectives_user_id
      ON objectives(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objectives_user_status
      ON objectives(user_id, status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objectives_intent_class
      ON objectives(intent_class)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objectives_created_at
      ON objectives(created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objectives_linked_object
      ON objectives(linked_object_type, linked_object_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS objective_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        objective_id varchar NOT NULL,
        event_type varchar NOT NULL,
        actor_user_id varchar,
        actor_type varchar,
        metadata jsonb,
        created_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objective_events_objective_id
      ON objective_events(objective_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objective_events_event_type
      ON objective_events(event_type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_objective_events_created_at
      ON objective_events(created_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS scout_onboarding_sessions (
        session_id varchar(255) PRIMARY KEY,
        user_id varchar(255) REFERENCES users(id) ON DELETE CASCADE,
        snapshot text NOT NULL DEFAULT '{}',
        answered_questions text NOT NULL DEFAULT '[]',
        skipped_questions text NOT NULL DEFAULT '[]',
        expiration_reason varchar(64),
        started_at timestamp NOT NULL DEFAULT now(),
        expires_at timestamp NOT NULL,
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scout_onboarding_user_id
      ON scout_onboarding_sessions(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scout_onboarding_expires_at
      ON scout_onboarding_sessions(expires_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_log (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        type varchar(80) NOT NULL,
        admin_id varchar REFERENCES users(id) ON DELETE SET NULL,
        target_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin
      ON admin_audit_log(admin_id, created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
      ON admin_audit_log(target_user_id, created_at)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_log_type
      ON admin_audit_log(type, created_at)
    `);

    // Directory ingestion + safety queues (used by seeded "unclaimed" business listings).
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE business_suggestion_kind AS ENUM ('edit', 'removal');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE business_suggestion_status AS ENUM ('open', 'resolved', 'rejected');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE business_seed_run_status AS ENUM ('running', 'succeeded', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS business_external_refs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        source varchar(64) NOT NULL,
        external_id varchar(255) NOT NULL,
        created_at timestamp DEFAULT now(),
        CONSTRAINT business_external_refs_source_external_unique UNIQUE (source, external_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS business_external_refs_business_idx
      ON business_external_refs(business_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS business_suggestions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        kind business_suggestion_kind NOT NULL,
        status business_suggestion_status NOT NULL DEFAULT 'open',
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS business_suggestions_business_idx
      ON business_suggestions(business_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS business_suggestions_status_idx
      ON business_suggestions(status)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS business_seed_runs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        source varchar(64) NOT NULL,
        location_text text,
        county_fips varchar(5),
        state_code varchar(2),
        terms jsonb NOT NULL DEFAULT '[]'::jsonb,
        requested_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        status business_seed_run_status NOT NULL DEFAULT 'running',
        inserted_count integer NOT NULL DEFAULT 0,
        duplicate_count integer NOT NULL DEFAULT 0,
        error_count integer NOT NULL DEFAULT 0,
        error_message text,
        started_at timestamp NOT NULL DEFAULT now(),
        finished_at timestamp,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS business_seed_runs_status_idx
      ON business_seed_runs(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS business_seed_runs_county_idx
      ON business_seed_runs(county_fips, state_code)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS business_seed_run_logs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        seed_run_id varchar NOT NULL REFERENCES business_seed_runs(id) ON DELETE CASCADE,
        level varchar(16) NOT NULL DEFAULT 'info',
        message text NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS business_seed_run_logs_run_idx
      ON business_seed_run_logs(seed_run_id)
    `);

    await client.query(`
      INSERT INTO users (id, email, role, provider)
      VALUES ('test-messaging-seed-user', 'messaging-seed@tradescout.test', 'admin', 'local')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO marketplace_categories (id, name, description, is_active)
      VALUES ('test-messaging-seed-category', 'Messaging Seed', 'Seed category for conversation tests', true)
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO marketplace_listings (
        id,
        seller_id,
        category_id,
        title,
        description,
        price,
        county,
        state,
        condition,
        status
      )
      VALUES
        ('messaging:hire', 'test-messaging-seed-user', 'test-messaging-seed-category', 'Messaging Hire Seed', 'Seed listing for messaging hire', 1.00, 'Test', 'TS', 'good', 'active'),
        ('messaging:advise', 'test-messaging-seed-user', 'test-messaging-seed-category', 'Messaging Advise Seed', 'Seed listing for messaging advise', 1.00, 'Test', 'TS', 'good', 'active'),
        ('messaging:collaborate', 'test-messaging-seed-user', 'test-messaging-seed-category', 'Messaging Collaborate Seed', 'Seed listing for messaging collaborate', 1.00, 'Test', 'TS', 'good', 'active'),
        ('messaging:reconnect', 'test-messaging-seed-user', 'test-messaging-seed-category', 'Messaging Reconnect Seed', 'Seed listing for messaging reconnect', 1.00, 'Test', 'TS', 'good', 'active')
      ON CONFLICT (id) DO NOTHING
    `);

    // Minimal Direct Connect routing seeds for E2E release gates.
    // Release-gate suites assume at least one resolvable county + trade + matching contractor exists.
    const withSeedContext = async (label, fn) => {
      try {
        return await fn();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[bootstrap-test-db] direct-connect seed failed (${label}): ${message}`);
      }
    };

    const seedStateId = "test-state-az";
    const seedCountyFips = "04013"; // Maricopa, AZ
    const seedCountyId = "test-county-04013";
    const seedTradeSlug = "moving-help";
    const seedTradeId = "test-trade-moving-help";
    const seedContractorSlug = "test-moving-pro";
    const seedContractorId = "test-contractor-moving-pro";

    await withSeedContext("state", async () => {
      await client.query(
        `
          INSERT INTO states (id, name, code)
          VALUES ($1, $2, $3)
          ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        `,
        [seedStateId, "Arizona", "AZ"]
      );
    });

    const countyUpsert = await withSeedContext("county", async () => {
      return await client.query(
        `
          INSERT INTO counties (id, name, fips, state_code, population)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (fips) DO UPDATE
          SET name = EXCLUDED.name, state_code = EXCLUDED.state_code
          RETURNING id
        `,
        [seedCountyId, "Maricopa County", seedCountyFips, "AZ", 0]
      );
    });
    const resolvedCountyId = String(countyUpsert.rows?.[0]?.id || seedCountyId);

    const tradeUpsert = await withSeedContext("trade", async () => {
      return await client.query(
        `
          INSERT INTO trades (id, name, slug)
          VALUES ($1, $2, $3)
          ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `,
        [seedTradeId, "Moving help", seedTradeSlug]
      );
    });
    const resolvedTradeId = String(tradeUpsert.rows?.[0]?.id || seedTradeId);

    const contractorUpsert = await withSeedContext("contractor", async () => {
      return await client.query(
        `
          INSERT INTO contractors (id, company_name, slug, is_active)
          VALUES ($1, $2, $3, true)
          ON CONFLICT (slug) DO UPDATE
          SET company_name = EXCLUDED.company_name, is_active = true
          RETURNING id
        `,
        [seedContractorId, "Test Moving Pro", seedContractorSlug]
      );
    });
    const resolvedContractorId = String(contractorUpsert.rows?.[0]?.id || seedContractorId);

    await withSeedContext("contractor_trades", async () => {
      await client.query(
        `
          INSERT INTO contractor_trades (id, contractor_id, trade_id)
          SELECT $1::varchar, $2::varchar, $3::varchar
          WHERE NOT EXISTS (
            SELECT 1
            FROM contractor_trades
            WHERE contractor_id = $2::varchar AND trade_id = $3::varchar
          )
        `,
        ["test-ct-moving-pro", resolvedContractorId, resolvedTradeId]
      );
    });

    await withSeedContext("contractor_counties", async () => {
      await client.query(
        `
          INSERT INTO contractor_counties (id, contractor_id, county_id)
          SELECT $1::varchar, $2::varchar, $3::varchar
          WHERE NOT EXISTS (
            SELECT 1
            FROM contractor_counties
            WHERE contractor_id = $2::varchar AND county_id = $3::varchar
          )
        `,
        ["test-cc-moving-pro", resolvedContractorId, resolvedCountyId]
      );
    });


    await client.query(`
      CREATE TABLE IF NOT EXISTS xp_daily_counters (
        user_id varchar NOT NULL,
        day_key_utc varchar(16) NOT NULL,
        cap_key varchar(64) NOT NULL,
        count integer NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day_key_utc, cap_key)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS xp_daily_uniques (
        user_id varchar NOT NULL,
        day_key_utc varchar(16) NOT NULL,
        event_type varchar(120) NOT NULL,
        unique_key varchar(255) NOT NULL,
        PRIMARY KEY (user_id, day_key_utc, event_type, unique_key)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        user_id varchar NOT NULL,
        badge_id text NOT NULL,
        awarded_at timestamp NOT NULL DEFAULT now(),
        source text NOT NULL DEFAULT 'engine',
        PRIMARY KEY (user_id, badge_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS user_badges_user_idx
      ON user_badges(user_id)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS badge_eval_state (
        user_id varchar NOT NULL,
        badge_id text NOT NULL,
        last_evaluated_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, badge_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_xp (
        user_id varchar PRIMARY KEY,
        xp_total integer NOT NULL DEFAULT 0,
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS hoa_governance (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        hoa_id varchar NOT NULL UNIQUE REFERENCES homeowner_associations(id) ON DELETE CASCADE,
        governance_model varchar NOT NULL DEFAULT 'elected_board',
        voting_enabled boolean DEFAULT true,
        financials_enabled boolean DEFAULT true,
        vendor_management_enabled boolean DEFAULT true,
        document_library_enabled boolean DEFAULT true,
        residents_directory_enabled boolean DEFAULT true,
        maintenance_requests_enabled boolean DEFAULT true,
        custom_roles jsonb,
        quorum_percentage integer DEFAULT 50,
        vote_pass_threshold integer DEFAULT 51,
        allow_proxy_voting boolean DEFAULT false,
        governance_notes text,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS xp_ledger (
        id bigserial PRIMARY KEY,
        user_id varchar NOT NULL,
        delta integer NOT NULL,
        reason varchar(120) NOT NULL,
        source_event_id varchar(128),
        day_key_utc varchar(16) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
  } finally {
    await client.end();
  }
}

async function main() {
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl, TEST_DATABASE_URL: testDatabaseUrl };
  const fullSync = process.argv.includes("--full-sync");

  await withBootstrapLock(async () => {
    if (fullSync) {
      const pushCode = await runWithInput(
        "npx",
        ["drizzle-kit", "push", "--force"],
        env,
        "\r"
      );
      if (pushCode !== 0) {
        console.error("[bootstrap-test-db] drizzle-kit push failed.");
        process.exit(pushCode);
      }
    }

    await ensureCriticalSchema();
  });
  console.log("[bootstrap-test-db] Test DB schema is ready.");
}

main().catch((error) => {
  console.error(
    "[bootstrap-test-db] Unexpected failure:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
