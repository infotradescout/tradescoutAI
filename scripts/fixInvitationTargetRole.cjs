/*
 * One-time helper to convert invitations.target_role from text/varchar
 * to the user_role enum used by Drizzle (userRoleEnum("target_role")).
 */

require('dotenv/config');
const { Client } = require('pg');

const url = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL or TEST_DATABASE_URL must be set to run this script.');
  process.exit(1);
}

// Must match shared/schema.ts userRoleEnum definition
const allowedRoles = new Set([
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
]);

(async () => {
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
    console.log('Connected to database');

    const distinctRes = await client.query('SELECT DISTINCT target_role FROM invitations');
    const values = distinctRes.rows.map((r) => r.target_role).filter((v) => v != null);
    console.log('Existing distinct invitations.target_role values:', values);

    const invalid = values.filter((v) => !allowedRoles.has(v));
    if (invalid.length > 0) {
      console.error('Refusing to alter invitations.target_role: found values not in user_role enum:', invalid);
      console.error('Decide on a mapping for these values, update this script, then rerun.');
      process.exit(1);
    }

    console.log('All invitations.target_role values are compatible; altering column type to user_role in a transaction...');

    await client.query('BEGIN');
    await client.query('ALTER TABLE invitations ALTER COLUMN target_role TYPE user_role USING target_role::user_role');
    await client.query('COMMIT');

    console.log('Successfully converted invitations.target_role to user_role enum.');
  } catch (err) {
    console.error('Error while fixing invitations.target_role column:', err);
    try { await client.query('ROLLBACK'); } catch (_) {}
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
