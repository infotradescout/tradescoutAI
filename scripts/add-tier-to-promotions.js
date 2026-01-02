import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const statements = [
  "alter table promotions add column if not exists tier varchar not null default 'free_directory' check (tier in ('free_directory', 'paid_campaign'));",
];

async function run() {
  const pool = new Pool({ connectionString });
  try {
    for (const sql of statements) {
      console.log("RUN", sql.slice(0, 80));
      await pool.query(sql);
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
