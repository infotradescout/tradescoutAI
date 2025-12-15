/* Inspect distinct invite target_role values that use the user_role enum. */

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
    const res = await client.query('SELECT DISTINCT target_role FROM invitations');
    console.log('Distinct invitations.target_role values:', res.rows.map(r => r.target_role));
  } catch (err) {
    console.error('Error inspecting invitations.target_role values:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
