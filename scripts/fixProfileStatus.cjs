/*
 * One-time helper to safely convert profiles.status
 * from text/varchar to the profile_status enum used by Drizzle.
 */

require('dotenv/config');
const { Client } = require('pg');

const url = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL or TEST_DATABASE_URL must be set to run this script.');
  process.exit(1);
}

const allowedStatuses = new Set([
  'draft',
  'published',
]);

(async () => {
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
    console.log('Connected to database');

    const distinctRes = await client.query('SELECT DISTINCT status FROM profiles');
    const statuses = distinctRes.rows.map((r) => r.status).filter((v) => v != null);
    console.log('Existing distinct profile.status values:', statuses);

    const invalid = statuses.filter((v) => !allowedStatuses.has(v));
    if (invalid.length > 0) {
      console.error('Refusing to alter column: found invalid status values that are not in profile_status enum:', invalid);
      console.error('Please normalize or delete these rows before rerunning this script.');
      process.exit(1);
    }

    console.log('All existing profile.status values are valid enum labels; running ALTER TABLE in a transaction...');

    await client.query('BEGIN');
    // Drop existing default (likely text) so type change can succeed
    await client.query('ALTER TABLE profiles ALTER COLUMN status DROP DEFAULT');
    await client.query('ALTER TABLE profiles ALTER COLUMN status TYPE profile_status USING status::profile_status');
    // Restore enum-typed default
    await client.query("ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'draft'");
    await client.query('COMMIT');

    console.log('Successfully converted profiles.status to profile_status enum and reset default.');
  } catch (err) {
    console.error('Error while fixing profiles.status column:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
