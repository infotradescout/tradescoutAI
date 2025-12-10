import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const isTestEnv =
  process.env.NODE_ENV === "test" ||
  Boolean(process.env.VITEST_WORKER_ID);

const connectionString =
  (isTestEnv ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL) ??
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Missing DATABASE_URL/TEST_DATABASE_URL for database connection."
  );
}

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool, schema });

export { db, pool };