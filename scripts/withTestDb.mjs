import { spawn } from "node:child_process";

const command = process.argv.slice(2);

if (command.length === 0) {
  console.error("Usage: node scripts/withTestDb.mjs <command...>");
  process.exit(2);
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  console.error("Missing TEST_DATABASE_URL.");
  process.exit(2);
}

const env = { ...process.env, DATABASE_URL: testDatabaseUrl };

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
  shell: true,
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
