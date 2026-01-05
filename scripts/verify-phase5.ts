/**
 * Phase 5 Verification Controller
 * Synthetic paging tests for CRITICAL alert validation
 */

import { evaluateAlerts, getActiveAlerts, resetAlerts } from "../server/observability/alerts";
import { emitJobStart, emitJobEnd, emitJobError, emitPoolMetrics, emitHttpStatus, resetMetrics } from "../server/observability/metrics";

console.log("🔬 Phase 5 Verification Starting\n");

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TEST 1: True 5xx Paging (CRITICAL)
// ============================================================================

async function test1_5xxPaging(): Promise<void> {
  console.log("📍 TEST 1: True 5xx Server Faults (CRITICAL)\n");
  
  resetAlerts();
  resetMetrics();
  
  console.log("  🔴 Simulating 3 consecutive 5xx windows (45s sustained)...");
  
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 5; j++) emitHttpStatus(500);
    for (let j = 0; j < 95; j++) emitHttpStatus(200);
    evaluateAlerts();
    
    const alerts = getActiveAlerts();
    const fivexxAlert = alerts.find(a => a.id === "http.5xx_server_faults");
    if (fivexxAlert) {
      console.log(`  ⚠️  Window ${i + 1}: Alert ${fivexxAlert.status}, Severity: ${fivexxAlert.severity}, Hits: ${fivexxAlert.consecutiveHits}`);
    }
  }
  
  const finalAlerts = getActiveAlerts();
  const criticalAlert = finalAlerts.find(a => a.id === "http.5xx_server_faults" && a.severity === "CRITICAL");
  
  if (criticalAlert) {
    console.log("  ✅ PASS: CRITICAL alert fired for sustained 5xx");
    console.log(`     Alert: ${criticalAlert.name}`);
    console.log(`     Description: ${criticalAlert.description}`);
  } else {
    console.log("  ❌ FAIL: CRITICAL alert did not fire");
  }
  
  console.log("\n  🟢 Clearing 5xx fault...");
  resetMetrics();
  for (let j = 0; j < 100; j++) emitHttpStatus(200);
  evaluateAlerts();
  
  const clearedAlerts = getActiveAlerts();
  const stillActive = clearedAlerts.find(a => a.id === "http.5xx_server_faults");
  
  if (!stillActive) {
    console.log("  ✅ PASS: Alert auto-resolved\n");
  } else {
    console.log("  ❌ FAIL: Alert did not auto-resolve\n");
  }
}

// ============================================================================
// TEST 2: Scheduler Overlap Paging (CRITICAL)
// ============================================================================

async function test2_SchedulerOverlap(): Promise<void> {
  console.log("📍 TEST 2: Scheduler Job Overlap (CRITICAL)\n");
  
  resetAlerts();
  resetMetrics();
  
  console.log("  🔴 Simulating 3 overlapping job runs...");
  
  for (let i = 0; i < 3; i++) {
    emitJobStart("users_aggregation");
    emitJobEnd("users_aggregation", 100, true);
  }
  
  evaluateAlerts();
  
  const alerts = getActiveAlerts();
  const overlapAlert = alerts.find(a => a.id === "scheduler.overlap.users_aggregation" && a.severity === "CRITICAL");
  
  if (overlapAlert) {
    console.log("  ✅ PASS: CRITICAL alert fired for persistent overlap");
    console.log(`     Alert: ${overlapAlert.name}`);
    console.log(`     Description: ${overlapAlert.description}`);
  } else {
    console.log("  ❌ FAIL: CRITICAL alert did not fire");
  }
  
  console.log("\n  🟢 Clearing overlaps...");
  resetMetrics();
  for (let i = 0; i < 10; i++) {
    emitJobStart("users_aggregation");
    emitJobEnd("users_aggregation", 100, false);
  }
  
  evaluateAlerts();
  
  const clearedAlerts = getActiveAlerts();
  const stillActive = clearedAlerts.find(a => a.id === "scheduler.overlap.users_aggregation");
  
  if (!stillActive) {
    console.log("  ✅ PASS: Alert auto-resolved\n");
  } else {
    console.log("  ❌ FAIL: Alert did not auto-resolve\n");
  }
}

// ============================================================================
// TEST 3: Scheduler Error Paging (CRITICAL)
// ============================================================================

async function test3_SchedulerError(): Promise<void> {
  console.log("📍 TEST 3: Scheduler Job Error (CRITICAL)\n");
  
  resetAlerts();
  resetMetrics();
  
  console.log("  🔴 Simulating single error (should be WARN only)...");
  emitJobStart("affiliates_aggregation");
  emitJobError("affiliates_aggregation", new Error("Test error"));
  evaluateAlerts();
  
  let alerts = getActiveAlerts();
  let errorAlert = alerts.find(a => a.id === "scheduler.error.affiliates_aggregation");
  
  if (errorAlert && errorAlert.severity === "WARN") {
    console.log("  ✅ PASS: Single error triggered WARN (not CRITICAL)");
  } else if (errorAlert && errorAlert.severity === "CRITICAL") {
    console.log("  ❌ FAIL: Single error incorrectly triggered CRITICAL");
  }
  
  console.log("\n  🔴 Simulating 2nd consecutive error (should escalate to CRITICAL)...");
  emitJobStart("affiliates_aggregation");
  emitJobError("affiliates_aggregation", new Error("Test error 2"));
  evaluateAlerts();
  
  alerts = getActiveAlerts();
  errorAlert = alerts.find(a => a.id === "scheduler.error.affiliates_aggregation");
  
  if (errorAlert && errorAlert.severity === "CRITICAL") {
    console.log("  ✅ PASS: 2 consecutive errors triggered CRITICAL");
    console.log(`     Alert: ${errorAlert.name}`);
    console.log(`     Description: ${errorAlert.description}`);
  } else {
    console.log("  ❌ FAIL: 2 consecutive errors did not trigger CRITICAL");
  }
  
  console.log("\n  🟢 Clearing error condition...");
  emitJobStart("affiliates_aggregation");
  emitJobEnd("affiliates_aggregation", 50, false);
  evaluateAlerts();
  
  const clearedAlerts = getActiveAlerts();
  const stillActive = clearedAlerts.find(a => a.id === "scheduler.error.affiliates_aggregation");
  
  if (!stillActive) {
    console.log("  ✅ PASS: Alert auto-resolved\n");
  } else {
    console.log("  ❌ FAIL: Alert did not auto-resolve\n");
  }
}

// ============================================================================
// TEST 4: DB Pool Exhaustion Paging (CRITICAL)
// ============================================================================

async function test4_PoolExhaustion(): Promise<void> {
  console.log("📍 TEST 4: DB Pool Exhaustion (CRITICAL)\n");
  
  resetAlerts();
  resetMetrics();
  
  console.log("  🟡 Simulating pool pressure <120s (should be WARN only)...");
  
  for (let i = 0; i < 4; i++) {
    emitPoolMetrics({ active: 10, idle: 0, waiting: 5, acquireLatencyMs: 50 });
  }
  
  evaluateAlerts();
  
  let alerts = getActiveAlerts();
  let poolAlert = alerts.find(a => a.id === "dbpool.pressure");
  
  if (poolAlert && poolAlert.severity === "WARN") {
    console.log("  ✅ PASS: Pool pressure <120s triggered WARN (not CRITICAL)");
    console.log(`     Description: ${poolAlert.description}`);
  } else if (poolAlert && poolAlert.severity === "CRITICAL") {
    console.log("  ❌ FAIL: Pool pressure <120s incorrectly triggered CRITICAL");
  }
  
  console.log("\n  🔴 Extending pool exhaustion to >120s (should escalate to CRITICAL)...");
  
  for (let i = 0; i < 4; i++) {
    emitPoolMetrics({ active: 10, idle: 0, waiting: 5, acquireLatencyMs: 200 });
  }
  
  evaluateAlerts();
  
  alerts = getActiveAlerts();
  poolAlert = alerts.find(a => a.id === "dbpool.pressure");
  
  if (poolAlert && poolAlert.severity === "CRITICAL") {
    console.log("  ✅ PASS: Pool exhaustion >120s triggered CRITICAL");
    console.log(`     Alert: ${poolAlert.name}`);
    console.log(`     Description: ${poolAlert.description}`);
  } else {
    console.log("  ❌ FAIL: Pool exhaustion >120s did not trigger CRITICAL");
  }
  
  console.log("\n  🟢 Clearing pool exhaustion...");
  resetMetrics();
  emitPoolMetrics({ active: 5, idle: 5, waiting: 0, acquireLatencyMs: 20 });
  evaluateAlerts();
  
  const clearedAlerts = getActiveAlerts();
  const stillActive = clearedAlerts.find(a => a.id === "dbpool.pressure");
  
  if (!stillActive) {
    console.log("  ✅ PASS: Alert auto-resolved\n");
  } else {
    console.log("  ❌ FAIL: Alert did not auto-resolve\n");
  }
}

// ============================================================================
// TEST 5: Non-Paging Conditions (Control)
// ============================================================================

async function test5_NonPagingControl(): Promise<void> {
  console.log("📍 TEST 5: Non-Paging Conditions (Control Test)\n");
  
  resetAlerts();
  resetMetrics();
  
  console.log("  🟡 Triggering 4xx surge (should be INFO only)...");
  for (let j = 0; j < 40; j++) emitHttpStatus(400);
  for (let j = 0; j < 60; j++) emitHttpStatus(200);
  evaluateAlerts();
  
  let alerts = getActiveAlerts();
  let fourxxAlert = alerts.find(a => a.id === "http.4xx_surge");
  
  if (fourxxAlert && fourxxAlert.severity === "INFO") {
    console.log("  ✅ PASS: 4xx surge triggered INFO (not CRITICAL)");
  } else if (fourxxAlert && fourxxAlert.severity === "CRITICAL") {
    console.log("  ❌ FAIL: 4xx surge incorrectly triggered CRITICAL");
  }
  
  console.log("\n  🟡 Triggering duration spike (should be WARN only)...");
  
  for (let i = 0; i < 3; i++) {
    emitJobStart("trade_deals_aggregation");
    await sleep(7000);
    emitJobEnd("trade_deals_aggregation", 50, false);
  }
  
  evaluateAlerts();
  
  alerts = getActiveAlerts();
  const durationAlert = alerts.find(a => a.id === "scheduler.duration_spike.trade_deals_aggregation");
  
  if (durationAlert && durationAlert.severity === "WARN") {
    console.log("  ✅ PASS: Duration spike triggered WARN (not CRITICAL)");
  } else if (durationAlert && durationAlert.severity === "CRITICAL") {
    console.log("  ❌ FAIL: Duration spike incorrectly triggered CRITICAL");
  }
  
  console.log("\n  🟡 Triggering rows spike (should be WARN only)...");
  emitJobStart("trade_deals_aggregation");
  emitJobEnd("trade_deals_aggregation", 150, false);
  evaluateAlerts();
  
  alerts = getActiveAlerts();
  const rowsAlert = alerts.find(a => a.id === "scheduler.rows_spike.trade_deals_aggregation");
  
  if (rowsAlert && rowsAlert.severity === "WARN") {
    console.log("  ✅ PASS: Rows spike triggered WARN (not CRITICAL)");
  } else if (rowsAlert && rowsAlert.severity === "CRITICAL") {
    console.log("  ❌ FAIL: Rows spike incorrectly triggered CRITICAL");
  }
  
  console.log("\n  🟡 Triggering single transient overlap (should be WARN only)...");
  emitJobStart("users_aggregation");
  emitJobEnd("users_aggregation", 100, true);
  evaluateAlerts();
  
  alerts = getActiveAlerts();
  const singleOverlapAlert = alerts.find(a => a.id === "scheduler.overlap.users_aggregation");
  
  if (singleOverlapAlert && singleOverlapAlert.severity === "WARN") {
    console.log("  ✅ PASS: Single overlap triggered WARN (not CRITICAL)");
  } else if (singleOverlapAlert && singleOverlapAlert.severity === "CRITICAL") {
    console.log("  ❌ FAIL: Single overlap incorrectly triggered CRITICAL");
  }
  
  const criticalAlerts = alerts.filter(a => a.severity === "CRITICAL");
  
  if (criticalAlerts.length === 0) {
    console.log("\n  ✅ PASS: No CRITICAL alerts fired for WARN/INFO conditions\n");
  } else {
    console.log("\n  ❌ FAIL: CRITICAL alerts incorrectly fired:");
    criticalAlerts.forEach(a => console.log(`     - ${a.id}: ${a.name}`));
    console.log();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  try {
    await test1_5xxPaging();
    await test2_SchedulerOverlap();
    await test3_SchedulerError();
    await test4_PoolExhaustion();
    await test5_NonPagingControl();
    
    console.log("═".repeat(80));
    console.log("🎯 Phase 5 Verification Complete");
    console.log("═".repeat(80));
    console.log("\n✅ All tests executed. Review output above for PASS/FAIL results.");
    console.log("\n📝 Next: Document results in PHASE_5_COMPLETE.md\n");
    
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

main();
