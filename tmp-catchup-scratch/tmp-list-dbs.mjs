import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const dbs = await client.query(
  "select datname from pg_database where datistemplate = false order by 1"
);
console.log(
  JSON.stringify(
    {
      databases: dbs.rows.map((r) => r.datname),
      size: (
        await client.query(
          "select pg_size_pretty(pg_database_size(current_database())) as size, current_database() as db"
        )
      ).rows[0],
    },
    null,
    2
  )
);

await client.end();
