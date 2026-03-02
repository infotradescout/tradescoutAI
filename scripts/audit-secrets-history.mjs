import { spawn } from "node:child_process";

const sensitiveFilePatterns = [
  "secrets/db_password.txt",
  "secrets/gemini_api_key.txt",
  "secrets/session_secret.txt",
  "ssl/fullchain.pem",
  "ssl/privkey.pem",
];

function main() {
  const maxNeedleLength = sensitiveFilePatterns.reduce((max, pattern) => Math.max(max, pattern.length), 0);

  const hits = new Set();
  let carry = "";

  const proc = spawn("git", ["rev-list", "--objects", "--all"], {
    stdio: ["ignore", "pipe", "ignore"],
  });

  proc.on("error", (error) => {
    console.error("[secrets-history] failed to inspect git history");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });

  proc.stdout.on("data", (chunk) => {
    const text = carry + String(chunk);

    for (const pattern of sensitiveFilePatterns) {
      if (hits.has(pattern)) continue;
      if (text.includes(pattern)) hits.add(pattern);
    }

    carry = text.slice(-maxNeedleLength);
  });

  proc.on("close", (code) => {
    if (code !== 0) {
      console.error("[secrets-history] failed to inspect git history");
      console.error(`git exited with code ${code}`);
      process.exit(1);
    }

    const found = [...hits];
    if (found.length) {
      console.error("[secrets-history] sensitive files detected in git history:");
      found.forEach((hit) => console.error(`  - ${hit}`));
      console.error("");
      console.error(
        "Required remediation: rewrite history to remove secret-bearing files, rotate all exposed credentials, and force-push all refs."
      );
      process.exit(1);
    }

    console.log("[secrets-history] no known sensitive files found in git history");
  });
}

main();
