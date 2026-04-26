import { spawnSync } from "node:child_process";

function runStep(label, command, args, env = {}) {
  console.log(`\n[surge-gate] ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ...env,
    },
  });

  if (result.status !== 0) {
    throw new Error(`[surge-gate] step failed: ${label}`);
  }
}

function main() {
  const durationSec = process.env.SURGE_DURATION_SEC || "30";
  const connections = process.env.SURGE_CONNECTIONS || "60";
  const maxErrorPct = process.env.SURGE_MAX_ERROR_PCT || "2";

  runStep("Scale readiness baseline", "npm", ["run", "check:scale-readiness"]);

  runStep("Public API load", "npm", ["run", "load:public"], {
    DURATION_SEC: durationSec,
    CONNECTIONS: connections,
    MAX_ERROR_PCT: maxErrorPct,
  });

  runStep("Search API load", "npm", ["run", "load:search"], {
    DURATION_SEC: durationSec,
    CONNECTIONS: connections,
    MAX_ERROR_PCT: maxErrorPct,
  });

  runStep("Maps API load", "npm", ["run", "load:maps"], {
    DURATION_SEC: durationSec,
    CONNECTIONS: connections,
    MAX_ERROR_PCT: maxErrorPct,
  });

  console.log("\n[surge-gate] All surge gates passed");
}

main();
