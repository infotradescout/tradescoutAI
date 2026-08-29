import { defineConfig } from "drizzle-kit";
import {
  allowExplicitInsecureTestDatabase,
  securePostgresConnectionString,
} from "./database-url-security.mjs";

const rawUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const url = securePostgresConnectionString(rawUrl, {
  allowInsecureTestConnection: allowExplicitInsecureTestDatabase(process.env),
});
if (!url) {
  throw new Error("DATABASE_URL or TEST_DATABASE_URL must be set before running migrations.");
}

export default defineConfig({
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
