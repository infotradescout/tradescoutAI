import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL must be set. No mock data allowed - all operations require a real database connection."
  );
}

const pool = new Pool({ connectionString: dbUrl });
const db = drizzle({ client: pool, schema });

export { db, pool };