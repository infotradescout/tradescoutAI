import { DATABASE_RECOVERY_GUIDANCE } from "./lib/verified-migration-runner.mjs";

// Historical versions inserted the newest journal hash without executing SQL.
// That hid all earlier migrations from Drizzle's timestamp-based runner.
// Do not connect, create a ledger, or replace that shortcut with another stamp.
console.error("[db:baseline] Refused: recording the latest migration without executing it is not a database baseline.");
console.error(DATABASE_RECOVERY_GUIDANCE);
process.exitCode = 1;
