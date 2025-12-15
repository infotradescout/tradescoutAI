/* Inspect distinct role_context values that use the user_role enum (businesses.role_context and profiles.role_context). */

require('dotenv/config');
const { Client } = require('pg');

const url = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL or TEST_DATABASE_URL must be set to run this script.');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const bizRes = await client.query('SELECT DISTINCT role_context FROM businesses');
    const profRes = await client.query('SELECT DISTINCT role_context FROM profiles');
    console.log('Distinct businesses.role_context values:', bizRes.rows.map(r => r.role_context));
    console.log('Distinct profiles.role_context values:', profRes.rows.map(r => r.role_context));
  } catch (err) {
    console.error('Error inspecting role_context values:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
