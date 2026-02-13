// @ts-expect-error - runtime module without TypeScript types in this build
import cron from "node-cron";
import { runCrawler } from "../crawler/crawl";
import { runUsersAggregationJob } from "./usersAggregationJob";
import { runAffiliatesAggregationJob } from "./affiliatesAggregationJob";
import { runTradeDealsAggregationJob } from "./tradeDealsAggregationJob";
import { runTrustSnapshotsJob } from "./trustSnapshotsJob";
import { runHomeScoutAggregationJob } from "./homeScoutAggregationJob";
import { runHomeScoutMarketMetricsJob } from "./homeScoutMarketMetricsJob";
import { runHomeScoutIngestionJob } from "./homeScoutIngestionJob";
import { runHomeScoutBucketMetricsJob } from "./homeScoutBucketMetricsJob";
import { runHomeScoutAlertsJob } from "./homeScoutAlertsJob";
import { emitJobStart, emitJobEnd, emitJobError } from "../observability/metrics";
import { withAdvisoryLock } from "../utils/advisoryLocks";

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
let homeScoutAggregationTask: any = null;
let homeScoutMarketMetricsTask: any = null;
let homeScoutIngestionTask: any = null;
let homeScoutBucketMetricsTask: any = null;
let homeScoutAlertsTask: any = null;

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
  startHomeScoutAggregationScheduler();
  startHomeScoutMarketMetricsScheduler();
  startHomeScoutIngestionScheduler();
  startHomeScoutBucketMetricsScheduler();
  startHomeScoutAlertsScheduler();
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
      const ran = await withAdvisoryLock("job:crawler", async () => {
        await runCrawler();
        return true;
      });
      if (ran === null) {
        console.log("Skipping crawler run (advisory lock not acquired)");
      }
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
      const result = await withAdvisoryLock(`job:${jobName}`, async () => runUsersAggregationJob());
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ Users aggregation job completed", result);
      emitJobEnd(jobName, (result as any).metricsWritten || 0, false);
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
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runAffiliatesAggregationJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ Affiliates aggregation job completed", result);
      emitJobEnd(jobName, (result as any).metricsWritten || 0, false);
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
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runTradeDealsAggregationJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ TradeDeals aggregation job completed", result);
      emitJobEnd(jobName, (result as any).metricsWritten || 0, false);
    } catch (error) {
      console.error("❌ TradeDeals aggregation job failed:", error);
      emitJobError(jobName, error);
      // Fire-and-forget: don't crash server on job failure
    }
  });

  console.log("✅ TradeDeals aggregation scheduler started\n");
}

/**
 * Start nightly HomeScout aggregation job
 * Runs daily at 2 AM UTC by default (same window as other jobs)
 */
function startHomeScoutAggregationScheduler() {
  if (process.env.DISABLE_HOMESCOUT_AGGREGATION === "true") {
    console.log("HomeScout aggregation job disabled via DISABLE_HOMESCOUT_AGGREGATION env flag");
    return;
  }

  const schedule = process.env.HOMESCOUT_AGGREGATION_SCHEDULE || "0 2 * * *";
  console.log(`\n📊 Starting HomeScout aggregation scheduler with schedule: "${schedule}"`);

  homeScoutAggregationTask = cron.schedule(schedule, async () => {
    const jobName = "homescout_aggregation";
    console.log(`\n📊 [${new Date().toISOString()}] Running nightly HomeScout aggregation job...`);
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runHomeScoutAggregationJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ HomeScout aggregation job completed", result);
      emitJobEnd(jobName, (result as any).metricsWritten || 0, false);
    } catch (error) {
      console.error("❌ HomeScout aggregation job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("✅ HomeScout aggregation scheduler started\n");
}

/**
 * Start nightly HomeScout market metrics job
 * Runs daily at 2 AM UTC by default (same window as other jobs)
 */
function startHomeScoutMarketMetricsScheduler() {
  if (process.env.DISABLE_HOMESCOUT_MARKET_METRICS === "true") {
    console.log(
      "HomeScout market metrics job disabled via DISABLE_HOMESCOUT_MARKET_METRICS env flag"
    );
    return;
  }

  const schedule = process.env.HOMESCOUT_MARKET_METRICS_SCHEDULE || "0 2 * * *";
  console.log(`\n📈 Starting HomeScout market metrics scheduler with schedule: "${schedule}"`);

  homeScoutMarketMetricsTask = cron.schedule(schedule, async () => {
    const jobName = "homescout_market_metrics";
    console.log(
      `\n📈 [${new Date().toISOString()}] Running nightly HomeScout market metrics job...`
    );
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runHomeScoutMarketMetricsJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ HomeScout market metrics job completed", result);
      emitJobEnd(jobName, (result as any).metricsWritten || 0, false);
    } catch (error) {
      console.error("❌ HomeScout market metrics job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("✅ HomeScout market metrics scheduler started\n");
}

/**
 * Start periodic HomeScout ingestion job
 * Runs hourly by default (inventory freshness)
 */
function startHomeScoutIngestionScheduler() {
  if (process.env.DISABLE_HOMESCOUT_INGESTION === "true") {
    console.log("HomeScout ingestion job disabled via DISABLE_HOMESCOUT_INGESTION env flag");
    return;
  }

  const schedule = process.env.HOMESCOUT_INGESTION_SCHEDULE || "0 * * * *"; // hourly
  console.log(`\n🔄 Starting HomeScout ingestion scheduler with schedule: "${schedule}"`);

  homeScoutIngestionTask = cron.schedule(schedule, async () => {
    const jobName = "homescout_ingestion";
    console.log(`\n🔄 [${new Date().toISOString()}] Running HomeScout ingestion job...`);
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runHomeScoutIngestionJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ HomeScout ingestion job completed", result);
      emitJobEnd(jobName, (result as any).listingsSeen || 0, false);
    } catch (error) {
      console.error("❌ HomeScout ingestion job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("✅ HomeScout ingestion scheduler started\n");
}

/**
 * Start nightly HomeScout market bucket job
 * Runs daily at 2 AM UTC by default (same window as other jobs)
 */
function startHomeScoutBucketMetricsScheduler() {
  if (process.env.DISABLE_HOMESCOUT_BUCKET_METRICS === "true") {
    console.log(
      "HomeScout bucket metrics job disabled via DISABLE_HOMESCOUT_BUCKET_METRICS env flag"
    );
    return;
  }

  const schedule = process.env.HOMESCOUT_BUCKET_METRICS_SCHEDULE || "0 2 * * *";
  console.log(`\n📈 Starting HomeScout bucket metrics scheduler with schedule: "${schedule}"`);

  homeScoutBucketMetricsTask = cron.schedule(schedule, async () => {
    const jobName = "homescout_bucket_metrics";
    console.log(
      `\n📈 [${new Date().toISOString()}] Running nightly HomeScout bucket metrics job...`
    );
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runHomeScoutBucketMetricsJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ HomeScout bucket metrics job completed", result);
      emitJobEnd(jobName, (result as any).bucketsWritten || 0, false);
    } catch (error) {
      console.error("❌ HomeScout bucket metrics job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("✅ HomeScout bucket metrics scheduler started\n");
}

/**
 * Start periodic HomeScout alerts job (saved searches)
 * Runs every 15 minutes by default
 */
function startHomeScoutAlertsScheduler() {
  if (process.env.DISABLE_HOMESCOUT_ALERTS === "true") {
    console.log("HomeScout alerts job disabled via DISABLE_HOMESCOUT_ALERTS env flag");
    return;
  }

  const schedule = process.env.HOMESCOUT_ALERTS_SCHEDULE || "*/15 * * * *";
  console.log(`\n🔔 Starting HomeScout alerts scheduler with schedule: "${schedule}"`);

  homeScoutAlertsTask = cron.schedule(schedule, async () => {
    const jobName = "homescout_alerts";
    console.log(`\n🔔 [${new Date().toISOString()}] Running HomeScout alerts job...`);
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () => runHomeScoutAlertsJob());
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ HomeScout alerts job completed", result);
      emitJobEnd(jobName, (result as any).notificationsSent || 0, false);
    } catch (error) {
      console.error("❌ HomeScout alerts job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("✅ HomeScout alerts scheduler started\n");
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
      const result = await withAdvisoryLock(`job:${jobName}`, async () => runTrustSnapshotsJob());
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ Trust snapshots job completed", result);
      emitJobEnd(jobName, (result as any).inserted || 0, false);
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

  if (homeScoutAggregationTask) {
    homeScoutAggregationTask.stop();
    homeScoutAggregationTask.destroy();
    homeScoutAggregationTask = null;
    console.log("🛑 HomeScout aggregation scheduler stopped");
  }

  if (homeScoutMarketMetricsTask) {
    homeScoutMarketMetricsTask.stop();
    homeScoutMarketMetricsTask.destroy();
    homeScoutMarketMetricsTask = null;
    console.log("🛑 HomeScout market metrics scheduler stopped");
  }

  if (homeScoutIngestionTask) {
    homeScoutIngestionTask.stop();
    homeScoutIngestionTask.destroy();
    homeScoutIngestionTask = null;
    console.log("🛑 HomeScout ingestion scheduler stopped");
  }

  if (homeScoutBucketMetricsTask) {
    homeScoutBucketMetricsTask.stop();
    homeScoutBucketMetricsTask.destroy();
    homeScoutBucketMetricsTask = null;
    console.log("🛑 HomeScout bucket metrics scheduler stopped");
  }

  if (homeScoutAlertsTask) {
    homeScoutAlertsTask.stop();
    homeScoutAlertsTask.destroy();
    homeScoutAlertsTask = null;
    console.log("🛑 HomeScout alerts scheduler stopped");
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
    homeScoutAggregation: {
      active: homeScoutAggregationTask !== null,
      schedule: process.env.HOMESCOUT_AGGREGATION_SCHEDULE || "0 2 * * *",
    },
    homeScoutMarketMetrics: {
      active: homeScoutMarketMetricsTask !== null,
      schedule: process.env.HOMESCOUT_MARKET_METRICS_SCHEDULE || "0 2 * * *",
    },
    homeScoutIngestion: {
      active: homeScoutIngestionTask !== null,
      schedule: process.env.HOMESCOUT_INGESTION_SCHEDULE || "0 * * * *",
    },
    homeScoutBucketMetrics: {
      active: homeScoutBucketMetricsTask !== null,
      schedule: process.env.HOMESCOUT_BUCKET_METRICS_SCHEDULE || "0 2 * * *",
    },
    homeScoutAlerts: {
      active: homeScoutAlertsTask !== null,
      schedule: process.env.HOMESCOUT_ALERTS_SCHEDULE || "*/15 * * * *",
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
