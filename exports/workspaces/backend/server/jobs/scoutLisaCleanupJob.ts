import { scoutLisaPersistence } from "../services/scoutLisaPersistence";

/**
 * Scout LISA Cleanup Job
 * 
 * Runs periodically to clean up expired Scout findings from the LISA table.
 * Prevents stale intelligence from cluttering the decision engine.
 */

export async function runScoutLisaCleanup(): Promise<void> {
  try {
    const deletedCount = await scoutLisaPersistence.cleanupExpiredScoutFindings();
    console.log(`[Scout LISA Cleanup] Removed ${deletedCount} expired findings`);
    
    const stats = await scoutLisaPersistence.getScoutLisaStats();
    console.log(`[Scout LISA Stats]`, stats);
  } catch (error) {
    console.error("[Scout LISA Cleanup] Error:", error);
  }
}

/**
 * Schedule cleanup job to run every hour
 */
export function scheduleScoutLisaCleanup(): NodeJS.Timeout {
  return setInterval(() => {
    runScoutLisaCleanup().catch((error) => {
      console.error("[Scout LISA Cleanup] Scheduled job failed:", error);
    });
  }, 60 * 60 * 1000); // Run every hour
}
