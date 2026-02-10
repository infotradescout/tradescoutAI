// @ts-expect-error - runtime module without TypeScript types in this build
import cron from "node-cron";
import { runCrawler } from "../crawler/crawl";
import { runUsersAggregationJob } from "./usersAggregationJob";
import { runAffiliatesAggregationJob } from "./affiliatesAggregationJob";
import { runTradeDealsAggregationJob } from "./tradeDealsAggregationJob";
import { runTrustSnapshotsJob } from "./trustSnapshotsJob";
import { emitJobStart, emitJobEnd, emitJobError } from "../observability/metrics";

/**
 * Crawler Scheduler - Auto-crawling for cache updates + aggregation jobs
 *
 * This sets up automated crawling on a schedule.
 * Also manages background job scheduling (e.g., nightly aggregation jobs).
 */

let crawlerTask: any = null;
let usersAggregationTask: any = null;
let affiliatesAggregationTask: any = null;
let tradeDealsAggregationTask: any = null;
let trustSnapshotsTask: any = null;

/**
 * Start the cron scheduler
 * Runs every 5 minutes by default (configurable via env)
 */
export function startCrawlerScheduler() {
  // Tier 3 (Crawler) — hard guard
  if (process.env.DISABLE_CRAWLER === "true") {
    console.log("Crawler scheduler disabled via DISABLE_CRAWLER env flag");
  } else {
    startCrawlerJobs();
  }

  // Tier 2 (Aggregations) — always attempt; each job has its own guard
  startUsersAggregationScheduler();
  startAffiliatesAggregationScheduler();
  startTradeDealsAggregationScheduler();
  startTrustSnapshotsScheduler();
}

function startCrawlerJobs() {
  // Get schedule from env, default to every 5 minutes: "*/5 * * * *"
  const schedule = process.env.CRAWLER_SCHEDULE || "*/5 * * * *";

  console.log(`\n🔄 Starting crawler scheduler with schedule: "${schedule}"`);

  // Schedule the crawler
  crawlerTask = cron.schedule(schedule, async () => {
    console.log(`\n🚀 [${new Date().toISOString()}] Running scheduled crawler...`);
    try {
      await runCrawler();
    } catch (error) {
      console.error("❌ Scheduled crawler failed:", error);
    }
  });

  console.log("✅ Crawler scheduler started\n");
}

/**
 * Start nightly users aggregation job
 * Runs daily at 2 AM UTC by default (configurable via env)
 */
function startUsersAggregationScheduler() {
  if (process.env.DISABLE_USERS_AGGREGATION === "true") {
    console.log("Users aggregation job disabled via DISABLE_USERS_AGGREGATION env flag");
    return;
  }

  const schedule = process.env.USERS_AGGREGATION_SCHEDULE || "0 2 * * *"; // 2 AM daily

  console.log(`\n📊 Starting users aggregation scheduler with schedule: "${schedule}"`);

  usersAggregationTask = cron.schedule(schedule, async () => {
    const jobName = "users_aggregation";
    console.log(`\n📊 [${new Date().toISOString()}] Running nightly users aggregation job...`);
    emitJobStart(jobName);
    try {
      const result = await runUsersAggregationJob();
      console.log("✅ Users aggregation job completed", result);
      emitJobEnd(jobName, result.metricsWritten || 0, false);
    } catch (error) {
      console.error("❌ Users aggregation job failed:", error);
      emitJobError(jobName, error);
      // Fire-and-forget: don't crash server on job failure
    }
  });

  console.log("✅ Users aggregation scheduler started\n");
}

/**
 * Start nightly affiliates aggregation job
 * Runs daily at 2 AM UTC by default (same window as users job)
 */
function startAffiliatesAggregationScheduler() {
  if (process.env.DISABLE_AFFILIATES_AGGREGATION === "true") {
    console.log("Affiliates aggregation job disabled via DISABLE_AFFILIATES_AGGREGATION env flag");
    return;
  }

  const schedule = process.env.AFFILIATES_AGGREGATION_SCHEDULE || "0 2 * * *"; // 2 AM daily

  console.log(`\n📊 Starting affiliates aggregation scheduler with schedule: "${schedule}"`);

  affiliatesAggregationTask = cron.schedule(schedule, async () => {
    const jobName = "affiliates_aggregation";
    console.log(`\n📊 [${new Date().toISOString()}] Running nightly affiliates aggregation job...`);
    emitJobStart(jobName);
    try {
      const result = await runAffiliatesAggregationJob();
      console.log("✅ Affiliates aggregation job completed", result);
      emitJobEnd(jobName, result.metricsWritten || 0, false);
    } catch (error) {
      console.error("❌ Affiliates aggregation job failed:", error);
      emitJobError(jobName, error);
      // Fire-and-forget: don't crash server on job failure
    }
  });

  console.log("✅ Affiliates aggregation scheduler started\n");
}

/**
 * Start nightly trade deals aggregation job
 * Runs daily at 2 AM UTC by default (same window as other jobs)
 */
function startTradeDealsAggregationScheduler() {
  if (process.env.DISABLE_TRADEDEALS_AGGREGATION === "true") {
    console.log("TradeDeals aggregation job disabled via DISABLE_TRADEDEALS_AGGREGATION env flag");
    return;
  }

  const schedule = process.env.TRADEDEALS_AGGREGATION_SCHEDULE || "0 2 * * *"; // 2 AM daily

  console.log(`\n📊 Starting trade deals aggregation scheduler with schedule: "${schedule}"`);

  tradeDealsAggregationTask = cron.schedule(schedule, async () => {
    const jobName = "trade_deals_aggregation";
    console.log(
      `\n📊 [${new Date().toISOString()}] Running nightly trade deals aggregation job...`
    );
    emitJobStart(jobName);
    try {
      const result = await runTradeDealsAggregationJob();
      console.log("✅ TradeDeals aggregation job completed", result);
      emitJobEnd(jobName, result.metricsWritten || 0, false);
    } catch (error) {
      console.error("❌ TradeDeals aggregation job failed:", error);
      emitJobError(jobName, error);
      // Fire-and-forget: don't crash server on job failure
    }
  });

  console.log("✅ TradeDeals aggregation scheduler started\n");
}

/**
 * Start nightly trust snapshot job
 * Runs daily at 2 AM UTC by default (same window as other jobs)
 */
function startTrustSnapshotsScheduler() {
  if (process.env.DISABLE_TRUST_SNAPSHOTS === "true") {
    console.log("Trust snapshot job disabled via DISABLE_TRUST_SNAPSHOTS env flag");
    return;
  }

  const schedule = process.env.TRUST_SNAPSHOTS_SCHEDULE || "0 2 * * *"; // 2 AM daily

  console.log(`\n📊 Starting trust snapshots scheduler with schedule: "${schedule}"`);

  trustSnapshotsTask = cron.schedule(schedule, async () => {
    const jobName = "trust_snapshots";
    console.log(`\n📊 [${new Date().toISOString()}] Running nightly trust snapshots job...`);
    emitJobStart(jobName);
    try {
      const result = await runTrustSnapshotsJob();
      console.log("✅ Trust snapshots job completed", result);
      emitJobEnd(jobName, result.inserted || 0, false);
    } catch (error) {
      console.error("❌ Trust snapshots job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("✅ Trust snapshots scheduler started\n");
}

/**
 * Stop the cron scheduler
 */
export function stopCrawlerScheduler() {
  if (crawlerTask) {
    crawlerTask.stop();
    crawlerTask.destroy();
    crawlerTask = null;
    console.log("🛑 Crawler scheduler stopped");
  }

  if (usersAggregationTask) {
    usersAggregationTask.stop();
    usersAggregationTask.destroy();
    usersAggregationTask = null;
    console.log("🛑 Users aggregation scheduler stopped");
  }

  if (affiliatesAggregationTask) {
    affiliatesAggregationTask.stop();
    affiliatesAggregationTask.destroy();
    affiliatesAggregationTask = null;
    console.log("🛑 Affiliates aggregation scheduler stopped");
  }

  if (tradeDealsAggregationTask) {
    tradeDealsAggregationTask.stop();
    tradeDealsAggregationTask.destroy();
    tradeDealsAggregationTask = null;
    console.log("🛑 TradeDeals aggregation scheduler stopped");
  }

  if (trustSnapshotsTask) {
    trustSnapshotsTask.stop();
    trustSnapshotsTask.destroy();
    trustSnapshotsTask = null;
    console.log("🛑 Trust snapshots scheduler stopped");
  }
}

/**
 * Get scheduler status
 */
export function getCrawlerSchedulerStatus() {
  return {
    crawler: {
      active: crawlerTask !== null,
      schedule: process.env.CRAWLER_SCHEDULE || "*/5 * * * *",
    },
    usersAggregation: {
      active: usersAggregationTask !== null,
      schedule: process.env.USERS_AGGREGATION_SCHEDULE || "0 2 * * *",
    },
    affiliatesAggregation: {
      active: affiliatesAggregationTask !== null,
      schedule: process.env.AFFILIATES_AGGREGATION_SCHEDULE || "0 2 * * *",
    },
    tradeDealsAggregation: {
      active: tradeDealsAggregationTask !== null,
      schedule: process.env.TRADEDEALS_AGGREGATION_SCHEDULE || "0 2 * * *",
    },
    trustSnapshots: {
      active: trustSnapshotsTask !== null,
      schedule: process.env.TRUST_SNAPSHOTS_SCHEDULE || "0 2 * * *",
    },
  };
}

/**
 * Trigger immediate crawl (manual trigger via API)
 */
export async function triggerImmediateCrawl() {
  console.log("\n🚀 Manual crawler trigger...");
  try {
    const result = await runCrawler();
    return result;
  } catch (error) {
    console.error("❌ Manual crawler failed:", error);
    throw error;
  }
}
