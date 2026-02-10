import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const isDryRun = process.argv.includes("--dry-run");

const sql = `
  WITH missing AS (
    SELECT DISTINCT ON (mc.source_decision_card_id)
      mc.source_decision_card_id AS id,
      mc.buyer_id AS user_id,
      mc.intent AS intent,
      mc.decision_scope AS decision_scope,
      mc.created_at AS created_at
    FROM marketplace_conversations mc
    LEFT JOIN decision_cards dc ON dc.id = mc.source_decision_card_id
    WHERE mc.authority_gate = 'decision_card'
      AND mc.source_decision_card_id IS NOT NULL
      AND dc.id IS NULL
    ORDER BY mc.source_decision_card_id, mc.created_at ASC
  )
  INSERT INTO decision_cards (
    id,
    user_id,
    status,
    intent,
    decision_scope,
    title,
    description,
    created_at,
    updated_at,
    decided_at
  )
  SELECT
    m.id,
    m.user_id,
    'completed',
    COALESCE(m.intent, 'hire'),
    m.decision_scope,
    'Backfilled decision card',
    'Backfilled from marketplace conversation authority metadata',
    m.created_at,
    m.created_at,
    m.created_at
  FROM missing m
  WHERE NOT EXISTS (
    SELECT 1 FROM decision_cards dc WHERE dc.id = m.id
  );
`;

async function run() {
  const pool = new Pool({ connectionString });
  try {
    if (isDryRun) {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS missing_count
        FROM marketplace_conversations mc
        LEFT JOIN decision_cards dc ON dc.id = mc.source_decision_card_id
        WHERE mc.authority_gate = 'decision_card'
          AND mc.source_decision_card_id IS NOT NULL
          AND dc.id IS NULL
      `);
      console.log(`[backfill-decision-cards] dry run: missing=${rows[0]?.missing_count ?? 0}`);
      return;
    }

    const result = await pool.query(sql);
    console.log(`[backfill-decision-cards] inserted=${result.rowCount ?? 0}`);
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
