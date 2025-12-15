/* Find which table currently has a column named target_role and report its data type. */

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
      SELECT table_schema, table_name, column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE column_name = 'target_role';
    `);
    console.log('Columns named target_role:', res.rows);
  } catch (err) {
    console.error('Error inspecting target_role columns:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
