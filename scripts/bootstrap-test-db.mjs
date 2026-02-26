import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import pg from "pg";

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

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: true,
      env,
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
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
      CREATE UNIQUE INDEX IF NOT EXISTS uq_observations_source_ref
      ON observations (source_type, source_ref)
    `);

    await client.query(`
      ALTER TABLE work_requests
      ADD COLUMN IF NOT EXISTS share_token varchar(64)
    `);

    await client.query(`
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS claim_status varchar(32) DEFAULT 'unclaimed'
    `);

    await client.query(`
      ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uidx_contact_permissions_pair
      ON contact_permissions (requester_id, target_user_id)
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

  if (fullSync) {
    const pushCode = await run("npx", ["drizzle-kit", "push"], env);
    if (pushCode !== 0) {
      console.error("[bootstrap-test-db] drizzle-kit push failed.");
      process.exit(pushCode);
    }
  }

  await ensureCriticalSchema();
  console.log("[bootstrap-test-db] Test DB schema is ready.");
}

main().catch((error) => {
  console.error(
    "[bootstrap-test-db] Unexpected failure:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
