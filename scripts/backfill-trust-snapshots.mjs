import { Pool } from "@neondatabase/serverless";
import { buildTrustSnapshotsInsertSql } from "../server/services/trustSnapshotsScoringSql.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const isDryRun = process.argv.includes("--dry-run");
const isForce = process.argv.includes("--force");

const insertSql = buildTrustSnapshotsInsertSql({ forceOverwrite: isForce });

async function run() {
  const pool = new Pool({ connectionString });
  try {
    if (isDryRun) {
      const { rows } = await pool.query(`
        SELECT COUNT(*)::int AS source_count
        FROM users u
        WHERE u.county_fips IS NOT NULL
      `);
      console.log(`[backfill-trust-snapshots] dry run: source=${rows[0]?.source_count ?? 0}`);
      return;
    }

    const result = await pool.query(insertSql);
    const inserted = Number(result.rows?.[0]?.inserted_count ?? 0);
    const sourceCount = Number(result.rows?.[0]?.source_count ?? 0);
    const skipped = Math.max(0, sourceCount - inserted);
    console.log(
      `[backfill-trust-snapshots] inserted=${inserted} skipped=${skipped} source=${sourceCount}`
    );
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
