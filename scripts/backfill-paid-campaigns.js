import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

// Backfill: any promo with at least one placement enabled → paid_campaign
const statements = [
  `update promotions
   set tier = 'paid_campaign'
   where (
     placement_community_snapshot = true
     or placement_community_feed = true
     or placement_scout = true
     or placement_marketplace = true
   )
   and tier = 'free_directory';`,
];

async function run() {
  const pool = new Pool({ connectionString });
  try {
    for (const sql of statements) {
      console.log("RUN", sql.slice(0, 80));
      const result = await pool.query(sql);
      console.log(`Updated ${result.rowCount} rows`);
    }
    console.log("DONE");
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
