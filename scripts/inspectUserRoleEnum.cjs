/* Inspect current Postgres enum definition for user_role */

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
    const res = await client.query(`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role'
      ORDER BY enumsortorder;
    `);
    console.log('user_role enum labels in DB:', res.rows.map(r => r.enumlabel));
  } catch (err) {
    console.error('Error inspecting user_role enum:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
