import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const alertsPath = path.join(root, "server", "observability", "alerts.ts");
const routesPath = path.join(root, "server", "routes", "observability.ts");
const dbPath = path.join(root, "server", "db.ts");

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function assertContains(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

function main() {
  const alerts = read(alertsPath);
  const routes = read(routesPath);
  const db = read(dbPath);

  assertContains(
    alerts,
    /export const BASELINES\s*=\s*\{/m,
    "BASELINES constant missing in alerts.ts"
  );
  assertContains(
    alerts,
    /export function getBaselinesSnapshot\(/m,
    "getBaselinesSnapshot() missing in alerts.ts"
  );
  assertContains(
    alerts,
    /export function recomputeBaselinesFromObservedData\(/m,
    "recomputeBaselinesFromObservedData() missing in alerts.ts"
  );
  assertContains(
    routes,
    /observabilityRouter\.use\(isAuthenticated,\s*isAdmin\)/m,
    "Observability routes must enforce isAuthenticated + isAdmin middleware"
  );
  assertContains(
    routes,
    /observabilityRouter\.post\("\/baselines\/recompute"/m,
    "POST /baselines/recompute endpoint missing in observability routes"
  );
  assertContains(
    db,
    /recomputeBaselinesFromObservedData/m,
    "db.ts does not import recomputeBaselinesFromObservedData"
  );
  assertContains(
    db,
    /OBS_BASELINE_RECOMPUTE_MS/m,
    "db.ts missing OBS_BASELINE_RECOMPUTE_MS cadence config"
  );

  console.log("[observability-baselines] governance wiring looks valid");
}

main();
