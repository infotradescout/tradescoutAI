/**
 * Run completed-job price snapshots once.
 *
 * Usage:
 *   npm run snapshot:completed-job-prices
 *   tsx -r dotenv/config scripts/run-completed-job-price-snapshot.ts
 */

import { pool } from "../server/db";
import { runCompletedJobPriceSnapshotJob } from "../server/services/completedJobPriceSnapshotJob";

async function main() {
  const result = await runCompletedJobPriceSnapshotJob();
  console.log("[completed-job-price-snapshot]", JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error("[completed-job-price-snapshot] failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
