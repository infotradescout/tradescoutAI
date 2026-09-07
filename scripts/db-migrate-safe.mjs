import dotenv from "dotenv";
import { runCommand } from "./lib/subprocess.mjs";
import { runVerifiedMigration } from "./lib/verified-migration-runner.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  allowExplicitInsecureTestDatabase,
  securePostgresConnectionString,
} from "../shared/database-url-security.mjs";

dotenv.config();

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

function requiredSchemaEntrypoint() {
  const bundled = path.join(scriptDirectory, "check-required-production-schema.mjs");
  return fs.existsSync(bundled)
    ? bundled
    : path.resolve(process.cwd(), "scripts/check-required-production-schema.mjs");
}

async function main() {
  const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--no-repair");
  if (unknownArgs.length) {
    throw new Error(`Unsupported migration argument: ${unknownArgs.join(", ")}`);
  }
  // --no-repair remains compatible. Automatic history repair is never allowed.
  const dbUrl = securePostgresConnectionString(
    process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL,
    { allowInsecureTestConnection: allowExplicitInsecureTestDatabase(process.env) }
  );
  if (!dbUrl) throw new Error("DATABASE_URL or TEST_DATABASE_URL must be set");
  // Both child processes must inspect the same normalized target.
  const env = { ...process.env, DATABASE_URL: dbUrl };
  const productionConfig = path.resolve(process.cwd(), "runtime/drizzle.config.mjs");
  const config = process.env.NODE_ENV === "production" && fs.existsSync(productionConfig)
    ? "runtime/drizzle.config.mjs"
    : "drizzle.config.ts";

  const status = await runVerifiedMigration({
    migrate: () => runCommand("npx", ["drizzle-kit", "migrate", `--config=${config}`], { stdio: "inherit", env }),
    verify: () => runCommand(process.execPath, [requiredSchemaEntrypoint()], { stdio: "inherit", env }),
  });
  if (status === 0) {
    console.log("[db:migrate] Migration command and independent required-schema verification passed.");
  }
  process.exitCode = status;
}

main().catch((err) => {
  console.error("[db:migrate] Failed:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
