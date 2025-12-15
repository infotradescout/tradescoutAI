/*
 * One-time helper to rebuild the user_role enum to match the Drizzle schema
 * and safely convert all dependent columns.
 */

require('dotenv/config');
const { Client } = require('pg');

const url = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL or TEST_DATABASE_URL must be set to run this script.');
  process.exit(1);
}

// Must match shared/schema.ts userRoleEnum definition
const allowedRoles = [
  'homeowner',
  'renter',
  'landlord',
  'property_manager',
  'hoa_member',
  'business_owner',
  'commercial_property',
  'franchise_owner',
  'startup_founder',
  'contractor',
  'handyman',
  'service_provider',
  'specialty_tradesperson',
  'designer',
  'inspector',
  'realtor',
  'mortgage_broker',
  'insurance_agent',
  'title_company',
  'car_dealer',
  'auto_service',
  'hoa_board',
  'community_builder',
  'nonprofit_org',
  'affiliate',
  'content_creator',
  'admin',
  'content_seo',
  'analytics_specialist',
  'marketing_specialist',
  'moderator',
  'ops_admin',
  'super_admin',
  'head_admin',
];

(async () => {
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
    console.log('Connected to database');

    // Inspect current usages
    const usersRes = await client.query('SELECT DISTINCT role FROM users');
    const bizRes = await client.query('SELECT DISTINCT role_context FROM businesses');
    const profRes = await client.query('SELECT DISTINCT role_context FROM profiles');

    const inUse = [
      ...usersRes.rows.map((r) => r.role),
      ...bizRes.rows.map((r) => r.role_context),
      ...profRes.rows.map((r) => r.role_context),
    ].filter((v) => v != null);

    console.log('All in-use user_role values across users/businesses/profiles:', inUse);

    const allowedSet = new Set(allowedRoles);
    const invalid = [...new Set(inUse)].filter((v) => !allowedSet.has(v));
    if (invalid.length > 0) {
      console.error('Refusing to rebuild user_role enum: found values not in the new enum set:', invalid);
      console.error('Decide on a mapping for these values, update this script, then rerun.');
      process.exit(1);
    }

    console.log('All in-use values are compatible; rebuilding user_role enum and dependent columns in a transaction...');

    await client.query('BEGIN');

    // Detach columns from the enum so we can drop/recreate it
    await client.query('ALTER TABLE users ALTER COLUMN role DROP DEFAULT');
    await client.query('ALTER TABLE users ALTER COLUMN role TYPE text USING role::text');
    await client.query('ALTER TABLE businesses ALTER COLUMN role_context TYPE text USING role_context::text');
    await client.query('ALTER TABLE profiles ALTER COLUMN role_context TYPE text USING role_context::text');

    // Drop and recreate enum
    await client.query('DROP TYPE IF EXISTS user_role');
    const createEnumSql = `CREATE TYPE user_role AS ENUM (${allowedRoles.map((r) => "'" + r + "'").join(',')})`;
    await client.query(createEnumSql);

    // Convert columns back and restore default on users.role
    await client.query('ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role');
    await client.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'homeowner'");
    await client.query('ALTER TABLE businesses ALTER COLUMN role_context TYPE user_role USING role_context::user_role');
    await client.query('ALTER TABLE profiles ALTER COLUMN role_context TYPE user_role USING role_context::user_role');

    await client.query('COMMIT');

    console.log('Successfully rebuilt user_role enum and updated dependent columns.');
  } catch (err) {
    console.error('Error while rebuilding user_role enum:', err);
    try { await client.query('ROLLBACK'); } catch (_) {}
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
