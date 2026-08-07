import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const name = process.argv[2] || "catchup_rehearsal_20260807";
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
  console.error("invalid db name");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";

const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();

const exists = await admin.query("select 1 from pg_database where datname = $1", [
  name,
]);
if (exists.rowCount) {
  console.log(JSON.stringify({ action: "exists", name }));
} else {
  await admin.query(`CREATE DATABASE "${name}"`);
  console.log(JSON.stringify({ action: "created", name }));
}

await admin.end();
