/*
 * One-time helper to safely convert crm_deals.stage
 * from text/varchar to the crm_deal_stage enum used by Drizzle.
 *
 * - Verifies all existing values are valid enum labels
 * - If valid, runs ALTER TABLE with USING stage::crm_deal_stage
 */

const { Client } = require('pg');

const url = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL or TEST_DATABASE_URL must be set to run this script.');
  process.exit(1);
}

const allowedStages = new Set([
  'prospecting',
  'negotiation',
  'closed_won',
  'closed_lost',
]);

(async () => {
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
    console.log('Connected to database');

    // Inspect existing values first
    const distinctRes = await client.query('SELECT DISTINCT stage FROM crm_deals');
    const stages = distinctRes.rows.map((r) => r.stage).filter((v) => v != null);
    console.log('Existing distinct stage values:', stages);

    const invalid = stages.filter((v) => !allowedStages.has(v));
    if (invalid.length > 0) {
      console.error('Refusing to alter column: found invalid stage values that are not in crm_deal_stage enum:', invalid);
      console.error('Please normalize or delete these rows before rerunning this script.');
      process.exit(1);
    }

    console.log('All existing stage values are valid enum labels; running ALTER TABLE...');

    await client.query(
      'ALTER TABLE crm_deals ALTER COLUMN stage TYPE crm_deal_stage USING stage::crm_deal_stage;'
    );

    console.log('Successfully converted crm_deals.stage to crm_deal_stage enum.');
  } catch (err) {
    console.error('Error while fixing crm_deals.stage column:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
