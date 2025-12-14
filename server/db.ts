import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  Boolean(process.env.VITEST_WORKER_ID);

const connectionString = isTestEnv
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool;
let db: DbType;

if (!connectionString) {
  // In test mode, we intentionally do NOT fall back to DATABASE_URL.
  // This avoids mutating a dev/prod database when running vitest locally.
  const error = new Error(
    isTestEnv
      ? "Missing TEST_DATABASE_URL for test database connection."
      : "Missing DATABASE_URL for database connection."
  );

  const disabled = new Proxy(
    {},
    {
      get() {
        throw error;
      },
    }
  );

  pool = disabled as unknown as Pool;
  db = disabled as unknown as DbType;
} else {
  pool = new Pool({ connectionString });
  db = drizzle({ client: pool, schema });
}

export { db, pool };