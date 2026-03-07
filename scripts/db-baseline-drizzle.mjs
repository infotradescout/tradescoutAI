import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Client } = pg;

function getLatestMigration(migrationsFolder) {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Missing journal file: ${journalPath}`);
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const entries = Array.isArray(journal?.entries) ? journal.entries : [];
  if (entries.length === 0) {
    throw new Error("No migration entries found in journal");
  }

  const latest = entries[entries.length - 1];
  const sqlPath = path.join(migrationsFolder, `${latest.tag}.sql`);
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Missing migration file for latest tag: ${sqlPath}`);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const hash = crypto.createHash("sha256").update(sql).digest("hex");
  return { tag: latest.tag, when: Number(latest.when), hash };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL must be set");
  }

  const migrationsFolder = path.resolve(process.cwd(), "migrations");
  const latest = getLatestMigration(migrationsFolder);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await client.query("create schema if not exists drizzle");
    await client.query(`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `);

    const current = await client.query(
      "select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1"
    );

    if (current.rowCount && current.rows[0].hash === latest.hash) {
      console.log(
        `[db:baseline] No changes. Existing latest hash already matches ${latest.tag}`
      );
      return;
    }

    const latestCreatedAt = current.rowCount ? Number(current.rows[0].created_at) : 0;
    const markerCreatedAt = Math.max(latest.when, latestCreatedAt + 1);

    await client.query("insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)", [
      latest.hash,
      markerCreatedAt,
    ]);
    console.log(
      `[db:baseline] Inserted baseline migration marker for ${latest.tag} (created_at=${markerCreatedAt})`
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[db:baseline] Failed:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
