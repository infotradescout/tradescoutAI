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
import { runCompletedJobPriceSnapshotJob } from "./completedJobPriceSnapshotJob";
import { runPartnerCountyObservationSnapshotJob } from "./partnerCountyObservationSnapshotService";
import { runPartnerIntelligenceBriefSnapshotJob } from "./partnerIntelligenceBriefSnapshotService";
import { emitJobStart, emitJobEnd, emitJobError } from "../observability/metrics";
import { getSchedulerDbConcurrencySnapshot, withAdvisoryLock } from "../utils/advisoryLocks";
import { runSeoPublicationPruneJob } from "./seoPublicationPruneJob";
import { runSeoDirectoryScopeSnapshotJob } from "./seoDirectoryScopeSnapshotJob";
import { runCrawlerTelemetryMaintenance } from "./crawlerTelemetryService";
import { runBotArmyAutoPromotion } from "./missionControl";
import { runIntentAutomationTick } from "../routes/observability";
import { runMarketSignalsSnapshotJob } from "./marketSignalsSnapshotJob";
import { runScoutLisaCleanupJob } from "./scoutLisaCleanupJob";
import { detectDirectConnectFunnelStalls } from "./directConnectFunnelIntegrity";

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
let completedJobPriceSnapshotTask: any = null;
let seoPublicationPruneTask: any = null;
let seoDirectoryScopeSnapshotTask: any = null;
let partnerCountyObservationSnapshotsTask: any = null;
let partnerIntelligenceBriefSnapshotsTask: any = null;
let botArmyAutoPromoteTask: any = null;
let intentAutomationTask: any = null;
let marketSignalsSnapshotTask: any = null;
let scoutLisaCleanupTask: any = null;
let directConnectFunnelStallTask: any = null;
let crawlerTelemetryMaintenanceTask: any = null;

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
  startCompletedJobPriceSnapshotScheduler();
  startTrustSnapshotsScheduler();
  startSeoPublicationPruneScheduler();
  startSeoDirectoryScopeSnapshotScheduler();
  startMarketSignalsSnapshotScheduler();
  startPartnerCountyObservationSnapshotsScheduler();
  startPartnerIntelligenceBriefSnapshotsScheduler();
  startBotArmyAutoPromoteScheduler();
  startIntentAutomationScheduler();
  startScoutLisaCleanupScheduler();
  startDirectConnectFunnelStallScheduler();
  startCrawlerTelemetryMaintenanceScheduler();
}

function startScoutLisaCleanupScheduler() {
  if (process.env.DISABLE_SCOUT_LISA_CLEANUP === "true") {
    console.log("Scout LISA cleanup job disabled via DISABLE_SCOUT_LISA_CLEANUP env flag");
    return;
  }

  const schedule = process.env.SCOUT_LISA_CLEANUP_SCHEDULE || "17 * * * *";
  const jobName = "scout_lisa_cleanup";

  console.log(`\n🧽 Starting Scout LISA cleanup scheduler with schedule: "${schedule}"`);

  const runTick = async () => {
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () => runScoutLisaCleanupJob());
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }

      console.log("✅ Scout LISA cleanup job completed", result);
      emitJobEnd(jobName, Number((result as any).deletedCount || 0), false);
    } catch (error) {
      console.error("❌ Scout LISA cleanup job failed:", error);
      emitJobError(jobName, error);
    }
  };

  scoutLisaCleanupTask = cron.schedule(schedule, async () => {
    console.log(`\n🧽 [${new Date().toISOString()}] Running Scout LISA cleanup job...`);
    await runTick();
  });

  void runTick();
  console.log("✅ Scout LISA cleanup scheduler started\n");
}

/**
 * Direct Connect conversion-integrity: derives funnel stalls server-side
 * from the persisted event stream (never a client-side timer) and logs one
 * high-severity direct_connect_funnel_step_stalled event per newly detected
 * stall. Idempotent across runs.
 */
function startDirectConnectFunnelStallScheduler() {
  if (process.env.DISABLE_DIRECT_CONNECT_FUNNEL_STALL_JOB === "true") {
    console.log(
      "Direct Connect funnel stall job disabled via DISABLE_DIRECT_CONNECT_FUNNEL_STALL_JOB env flag"
    );
    return;
  }

  const schedule = process.env.DIRECT_CONNECT_FUNNEL_STALL_SCHEDULE || "2-59/15 * * * *";
  const jobName = "direct_connect_funnel_stall";

  console.log(`\n🔌 Starting Direct Connect funnel stall scheduler with schedule: "${schedule}"`);

  const runTick = async () => {
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        detectDirectConnectFunnelStalls()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }

      console.log("✅ Direct Connect funnel stall job completed", result);
      emitJobEnd(jobName, result.stalled, false);
    } catch (error) {
      console.error("❌ Direct Connect funnel stall job failed:", error);
      emitJobError(jobName, error);
    }
  };

  directConnectFunnelStallTask = cron.schedule(schedule, async () => {
    console.log(`\n🔌 [${new Date().toISOString()}] Running Direct Connect funnel stall job...`);
    await runTick();
  });

  void runTick();
  console.log("✅ Direct Connect funnel stall scheduler started\n");
}

function startMarketSignalsSnapshotScheduler() {
  if (process.env.DISABLE_MARKET_SIGNALS_SNAPSHOTS === "true") {
    console.log(
      "Market signals snapshot job disabled via DISABLE_MARKET_SIGNALS_SNAPSHOTS env flag"
    );
    return;
  }

  const schedule = process.env.MARKET_SIGNALS_SNAPSHOTS_SCHEDULE || "10 * * * *"; // hourly
  const jobName = "market_signals_snapshots";

  console.log(`\n📈 Starting market signals snapshot scheduler with schedule: "${schedule}"`);

  const runTick = async (trigger: "scheduler" | "scheduler_boot") => {
    if (trigger === "scheduler") {
      console.log(`\n📈 [${new Date().toISOString()}] Running market signals snapshot job...`);
    } else {
      console.log(
        `\n📈 [${new Date().toISOString()}] Running market signals snapshot boot refresh...`
      );
    }
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runMarketSignalsSnapshotJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      const rowCount = Array.isArray(result)
        ? result.reduce(
            (sum, row) =>
              sum +
              Number((row as any)?.countyDemandRows || 0) +
              Number((row as any)?.activationRows || 0),
            0
          )
        : 0;
      console.log("✅ Market signals snapshot job completed", result);
      emitJobEnd(jobName, rowCount, false);
    } catch (error) {
      console.error("❌ Market signals snapshot job failed:", error);
      emitJobError(jobName, error);
    }
  };

  marketSignalsSnapshotTask = cron.schedule(schedule, async () => {
    await runTick("scheduler");
  });

  void runTick("scheduler_boot");

  console.log("✅ Market signals snapshot scheduler started\n");
}

function startIntentAutomationScheduler() {
  const enabled =
    process.env.INTENT_AUTOMATION_ENABLED === undefined
      ? true
      : String(process.env.INTENT_AUTOMATION_ENABLED).toLowerCase() === "true";
  if (!enabled) {
    console.log("Intent automation scheduler disabled via INTENT_AUTOMATION_ENABLED env flag");
    return;
  }

  const schedule = process.env.INTENT_AUTOMATION_SCHEDULE || "*/2 * * * *";
  const jobName = "intent_automation";

  console.log(`\n🧠 Starting intent automation scheduler with schedule: "${schedule}"`);

  const runTick = async (trigger: string) => {
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runIntentAutomationTick(trigger)
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      const rows = Number((result as any)?.records_count || 0);
      console.log("✅ Intent automation tick completed", result);
      emitJobEnd(jobName, rows, false);
    } catch (error) {
      console.error("❌ Intent automation tick failed:", error);
      emitJobError(jobName, error);
    }
  };

  intentAutomationTask = cron.schedule(schedule, async () => {
    console.log(`\n🧠 [${new Date().toISOString()}] Running intent automation tick...`);
    await runTick("scheduler");
  });

  void runTick("scheduler_boot");
  console.log("✅ Intent automation scheduler started\n");
}

function startBotArmyAutoPromoteScheduler() {
  if (process.env.BOT_ARMY_AUTO_PROMOTE_ENABLED !== "true") {
    return;
  }

  const schedule = process.env.BOT_ARMY_AUTO_PROMOTE_SCHEDULE || "*/10 * * * *";
  const lookbackHours = Math.min(
    24,
    Math.max(1, Number.parseInt(process.env.BOT_ARMY_AUTO_PROMOTE_LOOKBACK_HOURS || "6", 10))
  );
  const limit = Math.min(
    25,
    Math.max(1, Number.parseInt(process.env.BOT_ARMY_AUTO_PROMOTE_LIMIT || "5", 10))
  );
  const minScore = Math.min(
    200,
    Math.max(1, Number.parseInt(process.env.BOT_ARMY_AUTO_PROMOTE_MIN_SCORE || "70", 10))
  );
  const jobName = "bot_army_auto_promote";

  console.log(`\n🤖 Starting bot-army auto-promotion scheduler with schedule: "${schedule}"`);

  botArmyAutoPromoteTask = cron.schedule(schedule, async () => {
    console.log(`\n🤖 [${new Date().toISOString()}] Running bot-army auto-promotion job...`);
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runBotArmyAutoPromotion({ lookbackHours, limit, minScore })
      );

      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }

      console.log("✅ Bot-army auto-promotion job completed", result);
      emitJobEnd(jobName, (result as any).promotedCount || 0, false);
    } catch (error) {
      console.error("❌ Bot-army auto-promotion job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("✅ Bot-army auto-promotion scheduler started\n");
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

function startCrawlerTelemetryMaintenanceScheduler() {
  if (process.env.DISABLE_CRAWLER_TELEMETRY_MAINTENANCE === "true") {
    console.log(
      "Crawler telemetry maintenance disabled via DISABLE_CRAWLER_TELEMETRY_MAINTENANCE env flag"
    );
    return;
  }

  const schedule = process.env.CRAWLER_TELEMETRY_MAINTENANCE_SCHEDULE || "7 * * * *";
  const jobName = "crawler_telemetry_maintenance";
  console.log(`\nStarting crawler telemetry maintenance with schedule: "${schedule}"`);

  crawlerTelemetryMaintenanceTask = cron.schedule(schedule, async () => {
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () => {
        await runCrawlerTelemetryMaintenance();
        return true;
      });
      if (result === null) {
        console.log(`Skipping ${jobName} (already active or lock/capacity unavailable)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      emitJobEnd(jobName, 0, false);
    } catch (error) {
      console.error("Crawler telemetry maintenance failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("Crawler telemetry maintenance scheduler started\n");
}

/**
 * Start SEO publication prune job (New & True enforcement)
 * Runs hourly by default (configurable via env)
 */
function startSeoPublicationPruneScheduler() {
  if (process.env.DISABLE_SEO_PUBLICATION_PRUNE === "true") {
    console.log("SEO publication prune job disabled via DISABLE_SEO_PUBLICATION_PRUNE env flag");
    return;
  }

  const schedule = process.env.SEO_PUBLICATION_PRUNE_SCHEDULE || "12 * * * *"; // hourly
  const jobName = "seo_publication_prune";

  console.log(`\n🧹 Starting SEO publication prune scheduler with schedule: "${schedule}"`);

  seoPublicationPruneTask = cron.schedule(schedule, async () => {
    console.log(`\n🧹 [${new Date().toISOString()}] Running SEO publication prune job...`);
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runSeoPublicationPruneJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      const count = (result as any).businessesDeactivated || 0;
      console.log("✅ SEO publication prune job completed", result);
      emitJobEnd(jobName, count, false);
    } catch (error) {
      console.error("❌ SEO publication prune job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("✅ SEO publication prune scheduler started\n");
}

/**
 * Snapshot SEO scope pages (trade+county, trade+city) for sitemaps.
 * Runs every 6 hours by default (configurable via env).
 */
function startSeoDirectoryScopeSnapshotScheduler() {
  if (process.env.DISABLE_SEO_DIRECTORY_SCOPE_SNAPSHOT === "true") {
    console.log(
      "SEO directory scope snapshot job disabled via DISABLE_SEO_DIRECTORY_SCOPE_SNAPSHOT env flag"
    );
    return;
  }

  const schedule = process.env.SEO_DIRECTORY_SCOPE_SNAPSHOT_SCHEDULE || "30 */6 * * *";
  const jobName = "seo_directory_scope_snapshot";

  console.log(`\n🗺️ Starting SEO directory scope snapshot scheduler with schedule: "${schedule}"`);

  const runTick = async (): Promise<boolean> => {
    console.log(`\n🗺️ [${new Date().toISOString()}] Running SEO directory scope snapshot job...`);
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runSeoDirectoryScopeSnapshotJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return false;
      }
      const count =
        ((result as any).directoryBusinesses || 0) +
        ((result as any).tradeCountyPages || 0) +
        ((result as any).tradeCityPages || 0);
      console.log("✅ SEO directory scope snapshot job completed", result);
      emitJobEnd(jobName, count, false);
      return true;
    } catch (error) {
      console.error("❌ SEO directory scope snapshot job failed:", error);
      emitJobError(jobName, error);
      return false;
    }
  };

  // Backfill on startup under the same singleton lock. Readers remain 503 until
  // a fresh completed marker exists; bounded retries avoid a single transient
  // cold-start failure waiting for the next six-hour cron window.
  const startupRetryDelaysMs = [60_000, 5 * 60_000, 15 * 60_000];
  const runStartupBackfill = async (attempt = 0): Promise<void> => {
    const completed = await runTick();
    if (completed || attempt >= startupRetryDelaysMs.length) return;
    const timer = setTimeout(
      () => void runStartupBackfill(attempt + 1),
      startupRetryDelaysMs[attempt]
    );
    timer.unref?.();
  };
  void runStartupBackfill();
  seoDirectoryScopeSnapshotTask = cron.schedule(schedule, runTick);

  console.log("✅ SEO directory scope snapshot scheduler started\n");
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

  const schedule = process.env.USERS_AGGREGATION_SCHEDULE || "1 2 * * *";

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

function startPartnerIntelligenceBriefSnapshotsScheduler() {
  if (process.env.DISABLE_PARTNER_INTELLIGENCE_BRIEF_SNAPSHOTS === "true") {
    console.log(
      "Partner intelligence brief snapshot job disabled via DISABLE_PARTNER_INTELLIGENCE_BRIEF_SNAPSHOTS env flag"
    );
    return;
  }

  const schedule = process.env.PARTNER_INTELLIGENCE_BRIEF_SNAPSHOTS_SCHEDULE || "8-59/15 * * * *";
  const jobName = "partner_intelligence_brief_snapshots";

  console.log(
    `\nStarting partner intelligence brief snapshot scheduler with schedule: "${schedule}"`
  );

  partnerIntelligenceBriefSnapshotsTask = cron.schedule(schedule, async () => {
    console.log(
      `\n[${new Date().toISOString()}] Running partner intelligence brief snapshot job...`
    );
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () => {
        await runPartnerIntelligenceBriefSnapshotJob();
        return true;
      });
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("Partner intelligence brief snapshot job completed");
      emitJobEnd(jobName, 1, false);
    } catch (error) {
      console.error("Partner intelligence brief snapshot job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("Partner intelligence brief snapshot scheduler started\n");
}

/**
 * Start nightly affiliates aggregation job
 * Runs daily in the staggered 2 AM UTC maintenance window.
 */
function startAffiliatesAggregationScheduler() {
  if (process.env.DISABLE_AFFILIATES_AGGREGATION === "true") {
    console.log("Affiliates aggregation job disabled via DISABLE_AFFILIATES_AGGREGATION env flag");
    return;
  }

  const schedule = process.env.AFFILIATES_AGGREGATION_SCHEDULE || "9 2 * * *";

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
 * Runs daily in the staggered 2 AM UTC maintenance window.
 */
function startTradeDealsAggregationScheduler() {
  if (process.env.DISABLE_TRADEDEALS_AGGREGATION === "true") {
    console.log("TradeDeals aggregation job disabled via DISABLE_TRADEDEALS_AGGREGATION env flag");
    return;
  }

  const schedule = process.env.TRADEDEALS_AGGREGATION_SCHEDULE || "13 2 * * *";

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
 * Runs daily in the staggered 2 AM UTC maintenance window.
 */
function startHomeScoutAggregationScheduler() {
  if (process.env.DISABLE_HOMESCOUT_AGGREGATION === "true") {
    console.log("HomeScout aggregation job disabled via DISABLE_HOMESCOUT_AGGREGATION env flag");
    return;
  }

  const schedule = process.env.HOMESCOUT_AGGREGATION_SCHEDULE || "17 2 * * *";
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
 * Start nightly completed-job price snapshot job.
 * Writes precomputed first-party completed-job facts to county_metrics.
 */
function startCompletedJobPriceSnapshotScheduler() {
  if (process.env.DISABLE_COMPLETED_JOB_PRICE_SNAPSHOTS === "true") {
    console.log(
      "Completed job price snapshot job disabled via DISABLE_COMPLETED_JOB_PRICE_SNAPSHOTS env flag"
    );
    return;
  }

  const schedule = process.env.COMPLETED_JOB_PRICE_SNAPSHOT_SCHEDULE || "21 2 * * *";
  console.log(`\n📊 Starting completed-job price snapshot scheduler with schedule: "${schedule}"`);

  completedJobPriceSnapshotTask = cron.schedule(schedule, async () => {
    const jobName = "completed_job_price_snapshots";
    console.log(`\n📊 [${new Date().toISOString()}] Running completed-job price snapshot job...`);
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runCompletedJobPriceSnapshotJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("✅ Completed-job price snapshot job completed", result);
      emitJobEnd(jobName, (result as any).metricsWritten || 0, false);
    } catch (error) {
      console.error("❌ Completed-job price snapshot job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("✅ Completed-job price snapshot scheduler started\n");
}

/**
 * Start nightly HomeScout market metrics job
 * Runs daily in the staggered 2 AM UTC maintenance window.
 */
function startHomeScoutMarketMetricsScheduler() {
  if (process.env.DISABLE_HOMESCOUT_MARKET_METRICS === "true") {
    console.log(
      "HomeScout market metrics job disabled via DISABLE_HOMESCOUT_MARKET_METRICS env flag"
    );
    return;
  }

  const schedule = process.env.HOMESCOUT_MARKET_METRICS_SCHEDULE || "23 2 * * *";
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
      if ((result as any).errors?.length > 0) {
        const sourceErrors = (result as any).errors
          .map((entry: { sourceKey?: string; error?: string }) => {
            const sourceKey = entry.sourceKey || "unknown";
            const message = String(entry.error || "unknown source error").slice(0, 300);
            return `${sourceKey}: ${message}`;
          })
          .join("; ");
        throw new Error(`HomeScout ingestion failed for configured source(s): ${sourceErrors}`);
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
 * Runs daily in the staggered 2 AM UTC maintenance window.
 */
function startHomeScoutBucketMetricsScheduler() {
  if (process.env.DISABLE_HOMESCOUT_BUCKET_METRICS === "true") {
    console.log(
      "HomeScout bucket metrics job disabled via DISABLE_HOMESCOUT_BUCKET_METRICS env flag"
    );
    return;
  }

  const schedule = process.env.HOMESCOUT_BUCKET_METRICS_SCHEDULE || "27 2 * * *";
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

  const schedule = process.env.HOMESCOUT_ALERTS_SCHEDULE || "4-59/15 * * * *";
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
 * Runs daily in the staggered 2 AM UTC maintenance window.
 */
function startTrustSnapshotsScheduler() {
  if (process.env.DISABLE_TRUST_SNAPSHOTS === "true") {
    console.log("Trust snapshot job disabled via DISABLE_TRUST_SNAPSHOTS env flag");
    return;
  }

  const schedule = process.env.TRUST_SNAPSHOTS_SCHEDULE || "31 2 * * *";

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

function startPartnerCountyObservationSnapshotsScheduler() {
  if (process.env.DISABLE_PARTNER_COUNTY_OBSERVATION_SNAPSHOTS === "true") {
    console.log(
      "Partner county observation snapshot job disabled via DISABLE_PARTNER_COUNTY_OBSERVATION_SNAPSHOTS env flag"
    );
    return;
  }

  const schedule = process.env.PARTNER_COUNTY_OBSERVATION_SNAPSHOTS_SCHEDULE || "6-59/15 * * * *";
  const jobName = "partner_county_observation_snapshots";

  console.log(
    `\nStarting partner county observation snapshot scheduler with schedule: "${schedule}"`
  );

  partnerCountyObservationSnapshotsTask = cron.schedule(schedule, async () => {
    console.log(
      `\n[${new Date().toISOString()}] Running partner county observation snapshot job...`
    );
    emitJobStart(jobName);
    try {
      const result = await withAdvisoryLock(`job:${jobName}`, async () =>
        runPartnerCountyObservationSnapshotJob()
      );
      if (result === null) {
        console.log(`Skipping ${jobName} (advisory lock not acquired)`);
        emitJobEnd(jobName, 0, false);
        return;
      }
      console.log("Partner county observation snapshot job completed", result);
      emitJobEnd(jobName, Number((result as any).rowsWritten || 0), false);
    } catch (error) {
      console.error("Partner county observation snapshot job failed:", error);
      emitJobError(jobName, error);
    }
  });

  console.log("Partner county observation snapshot scheduler started\n");
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

  if (completedJobPriceSnapshotTask) {
    completedJobPriceSnapshotTask.stop();
    completedJobPriceSnapshotTask.destroy();
    completedJobPriceSnapshotTask = null;
    console.log("🛑 Completed-job price snapshot scheduler stopped");
  }

  if (seoPublicationPruneTask) {
    seoPublicationPruneTask.stop();
    seoPublicationPruneTask.destroy();
    seoPublicationPruneTask = null;
    console.log("🛑 SEO publication prune scheduler stopped");
  }

  if (seoDirectoryScopeSnapshotTask) {
    seoDirectoryScopeSnapshotTask.stop();
    seoDirectoryScopeSnapshotTask.destroy();
    seoDirectoryScopeSnapshotTask = null;
    console.log("🛑 SEO directory scope snapshot scheduler stopped");
  }

  if (partnerCountyObservationSnapshotsTask) {
    partnerCountyObservationSnapshotsTask.stop();
    partnerCountyObservationSnapshotsTask.destroy();
    partnerCountyObservationSnapshotsTask = null;
    console.log("Partner county observation snapshot scheduler stopped");
  }

  if (partnerIntelligenceBriefSnapshotsTask) {
    partnerIntelligenceBriefSnapshotsTask.stop();
    partnerIntelligenceBriefSnapshotsTask.destroy();
    partnerIntelligenceBriefSnapshotsTask = null;
    console.log("Partner intelligence brief snapshot scheduler stopped");
  }

  if (botArmyAutoPromoteTask) {
    botArmyAutoPromoteTask.stop();
    botArmyAutoPromoteTask.destroy();
    botArmyAutoPromoteTask = null;
    console.log("🛑 Bot-army auto-promotion scheduler stopped");
  }

  if (intentAutomationTask) {
    intentAutomationTask.stop();
    intentAutomationTask.destroy();
    intentAutomationTask = null;
    console.log("🛑 Intent automation scheduler stopped");
  }

  if (marketSignalsSnapshotTask) {
    marketSignalsSnapshotTask.stop();
    marketSignalsSnapshotTask.destroy();
    marketSignalsSnapshotTask = null;
    console.log("🛑 Market signals snapshot scheduler stopped");
  }

  if (scoutLisaCleanupTask) {
    scoutLisaCleanupTask.stop();
    scoutLisaCleanupTask.destroy();
    scoutLisaCleanupTask = null;
    console.log("🛑 Scout LISA cleanup scheduler stopped");
  }

  if (directConnectFunnelStallTask) {
    directConnectFunnelStallTask.stop();
    directConnectFunnelStallTask.destroy();
    directConnectFunnelStallTask = null;
    console.log("🛑 Direct Connect funnel-stall scheduler stopped");
  }

  if (crawlerTelemetryMaintenanceTask) {
    crawlerTelemetryMaintenanceTask.stop();
    crawlerTelemetryMaintenanceTask.destroy();
    crawlerTelemetryMaintenanceTask = null;
    console.log("🛑 Crawler telemetry maintenance scheduler stopped");
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
      schedule: process.env.USERS_AGGREGATION_SCHEDULE || "1 2 * * *",
    },
    affiliatesAggregation: {
      active: affiliatesAggregationTask !== null,
      schedule: process.env.AFFILIATES_AGGREGATION_SCHEDULE || "9 2 * * *",
    },
    tradeDealsAggregation: {
      active: tradeDealsAggregationTask !== null,
      schedule: process.env.TRADEDEALS_AGGREGATION_SCHEDULE || "13 2 * * *",
    },
    homeScoutAggregation: {
      active: homeScoutAggregationTask !== null,
      schedule: process.env.HOMESCOUT_AGGREGATION_SCHEDULE || "17 2 * * *",
    },
    homeScoutMarketMetrics: {
      active: homeScoutMarketMetricsTask !== null,
      schedule: process.env.HOMESCOUT_MARKET_METRICS_SCHEDULE || "23 2 * * *",
    },
    homeScoutIngestion: {
      active: homeScoutIngestionTask !== null,
      schedule: process.env.HOMESCOUT_INGESTION_SCHEDULE || "0 * * * *",
    },
    homeScoutBucketMetrics: {
      active: homeScoutBucketMetricsTask !== null,
      schedule: process.env.HOMESCOUT_BUCKET_METRICS_SCHEDULE || "27 2 * * *",
    },
    homeScoutAlerts: {
      active: homeScoutAlertsTask !== null,
      schedule: process.env.HOMESCOUT_ALERTS_SCHEDULE || "4-59/15 * * * *",
    },
    completedJobPriceSnapshots: {
      active: completedJobPriceSnapshotTask !== null,
      schedule: process.env.COMPLETED_JOB_PRICE_SNAPSHOT_SCHEDULE || "21 2 * * *",
    },
    trustSnapshots: {
      active: trustSnapshotsTask !== null,
      schedule: process.env.TRUST_SNAPSHOTS_SCHEDULE || "31 2 * * *",
    },
    seoPublicationPrune: {
      active: seoPublicationPruneTask !== null,
      schedule: process.env.SEO_PUBLICATION_PRUNE_SCHEDULE || "12 * * * *",
    },
    seoDirectoryScopeSnapshot: {
      active: seoDirectoryScopeSnapshotTask !== null,
      schedule: process.env.SEO_DIRECTORY_SCOPE_SNAPSHOT_SCHEDULE || "30 */6 * * *",
    },
    marketSignalsSnapshots: {
      active: marketSignalsSnapshotTask !== null,
      schedule: process.env.MARKET_SIGNALS_SNAPSHOTS_SCHEDULE || "10 * * * *",
    },
    scoutLisaCleanup: {
      active: scoutLisaCleanupTask !== null,
      schedule: process.env.SCOUT_LISA_CLEANUP_SCHEDULE || "17 * * * *",
    },
    partnerCountyObservationSnapshots: {
      active: partnerCountyObservationSnapshotsTask !== null,
      schedule: process.env.PARTNER_COUNTY_OBSERVATION_SNAPSHOTS_SCHEDULE || "6-59/15 * * * *",
    },
    partnerIntelligenceBriefSnapshots: {
      active: partnerIntelligenceBriefSnapshotsTask !== null,
      schedule: process.env.PARTNER_INTELLIGENCE_BRIEF_SNAPSHOTS_SCHEDULE || "8-59/15 * * * *",
    },
    botArmyAutoPromote: {
      active: botArmyAutoPromoteTask !== null,
      schedule: process.env.BOT_ARMY_AUTO_PROMOTE_SCHEDULE || "*/10 * * * *",
    },
    intentAutomation: {
      active: intentAutomationTask !== null,
      schedule: process.env.INTENT_AUTOMATION_SCHEDULE || "*/2 * * * *",
    },
    directConnectFunnelStall: {
      active: directConnectFunnelStallTask !== null,
      schedule: process.env.DIRECT_CONNECT_FUNNEL_STALL_SCHEDULE || "2-59/15 * * * *",
    },
    crawlerTelemetryMaintenance: {
      active: crawlerTelemetryMaintenanceTask !== null,
      schedule: process.env.CRAWLER_TELEMETRY_MAINTENANCE_SCHEDULE || "7 * * * *",
    },
    dbConcurrency: getSchedulerDbConcurrencySnapshot(),
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
