import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { pushSchema } from "drizzle-kit/api";
import * as schema from "../shared/schema";

async function main() {
  const connectionString = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL must be set");
  }

  const pool = new Pool({ connectionString });

  try {
    const db = drizzle(pool, { schema });
    const result = await pushSchema(schema, db);

    console.log(
      `[push-schema-programmatic] warnings=${result.warnings.length} statements=${result.statementsToExecute.length} hasDataLoss=${result.hasDataLoss}`
    );

    for (const warning of result.warnings) {
      console.warn(`[push-schema-programmatic] warning: ${warning}`);
    }

    await result.apply();
    console.log("[push-schema-programmatic] Schema push applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    "[push-schema-programmatic] Failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
