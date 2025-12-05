#!/usr/bin/env node

/**
 * Cache Initialization Script
 * 
 * Run this to manually refresh all caches
 * Usage: node scripts/init-cache.mjs
 */

import { runCrawler } from "../server/crawler/crawl.ts";

console.log("\n🔄 Initializing cache system...\n");

async function initCache() {
  try {
    console.log("Starting manual cache initialization...\n");
    const result = await runCrawler();
    
    if (result.success) {
      console.log("\n✅ Cache initialization successful!");
      console.log(`Duration: ${result.duration}ms`);
      console.log(`Successful extractions: ${result.successCount}`);
      if (result.errorCount > 0) {
        console.log(`⚠️  Errors: ${result.errorCount}`);
      }
      process.exit(0);
    } else {
      console.error("\n❌ Cache initialization failed!");
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Fatal error during initialization:");
    console.error(error);
    process.exit(1);
  }
}

initCache();
