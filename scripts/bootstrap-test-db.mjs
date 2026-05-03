import path from "node:path";
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

async function withBootstrapLock(task) {
  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  try {
    console.log("[bootstrap-test-db] Waiting for test DB bootstrap lock...");
    await client.query("SELECT pg_advisory_lock(hashtext('tradescout_test_db_bootstrap'))");
    console.log("[bootstrap-test-db] Test DB bootstrap lock acquired.");
    return await task();
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('tradescout_test_db_bootstrap'))")
      .catch(() => {});
    await client.end();
  }
}

async function ensureCriticalSchema() {
  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  try {
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
      ALTER TABLE work_requests
      ADD COLUMN IF NOT EXISTS share_token varchar(64)
    `);

    await client.query(`
      ALTER TABLE work_requests
      ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await client.query(`
      ALTER TABLE work_request_assignments
      ADD COLUMN IF NOT EXISTS responder_user_id varchar REFERENCES users(id) ON DELETE SET NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wra_responder_user_id
      ON work_request_assignments(responder_user_id)
    `);

    await queryIfTableExists(
      client,
      "home_scout_listings",
      `
      ALTER TABLE home_scout_listings
      ADD COLUMN IF NOT EXISTS listing_author_type varchar(16) NOT NULL DEFAULT 'owner'
    `
    );

    await client.query(`
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS claim_status varchar(32) DEFAULT 'unclaimed'
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
