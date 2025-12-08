// @ts-expect-error - runtime module without TypeScript types in this build
import cron from "node-cron";
import { runCrawler } from "../crawler/crawl";

/**
 * Crawler Scheduler - Auto-crawling for cache updates
 *
 * This sets up automated crawling on a schedule
 */

let crawlerTask: any = null;

/**
 * Start the cron scheduler
 * Runs every 5 minutes by default (configurable via env)
 */
export function startCrawlerScheduler() {
  if (process.env.DISABLE_CRAWLER === "true") {
    console.log("Crawler scheduler disabled via DISABLE_CRAWLER env flag");
    return;
  }
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
 * Stop the cron scheduler
 */
export function stopCrawlerScheduler() {
  if (crawlerTask) {
    crawlerTask.stop();
    crawlerTask.destroy();
    crawlerTask = null;
    console.log("🛑 Crawler scheduler stopped");
  }
}

/**
 * Get scheduler status
 */
export function getCrawlerSchedulerStatus() {
  return {
    active: crawlerTask !== null,
    schedule: process.env.CRAWLER_SCHEDULE || "*/5 * * * *",
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
