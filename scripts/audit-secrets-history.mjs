import { spawnSync } from "node:child_process";

const sensitiveFilePatterns = [
  "secrets/db_password.txt",
  "secrets/gemini_api_key.txt",
  "secrets/session_secret.txt",
  "ssl/fullchain.pem",
  "ssl/privkey.pem",
];

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.toString?.().trim() || "unknown git error";
    throw new Error(stderr);
  }
  return result.stdout.trim();
}

let logNames = "";
try {
  logNames = runGit(["log", "--all", "--name-only", "--pretty=format:"]);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[secrets-history] failed to inspect git history");
  console.error(message);
  process.exit(1);
}

const historyHits = [];
for (const pattern of sensitiveFilePatterns) {
  if (logNames.includes(pattern)) historyHits.push(pattern);
}

if (historyHits.length > 0) {
  console.error("[secrets-history] sensitive files detected in git history:");
  for (const hit of historyHits) console.error(`  - ${hit}`);
  console.error(
    "\nRequired remediation: rewrite history to remove secret-bearing files, rotate all exposed credentials, and force-push all refs."
  );
  process.exit(1);
}

console.log("[secrets-history] no known sensitive files found in git history");
