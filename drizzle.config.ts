import { defineConfig } from "drizzle-kit";
import { securePostgresConnectionString } from "./shared/database-url-security.mjs";

const rawDbUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const dbUrl = securePostgresConnectionString(rawDbUrl, {
  allowInsecureTestConnection:
    process.env.NODE_ENV === "test" && Boolean(process.env.TEST_DATABASE_URL),
});

if (!dbUrl) {
  throw new Error("DATABASE_URL or TEST_DATABASE_URL must be set before running Drizzle migrations.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
