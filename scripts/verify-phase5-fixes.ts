/**
 * Phase 5 Fix Verification (Tests 3 & 4 Only)
 * 
 * Test 3: Scheduler Consecutive Error (per-job counter fix)
 * Test 4: DB Pool Exhaustion (time-based accumulation fix)
 */

import { 
  emitJobStart, 
  emitJobEnd, 
  emitJobError, 
  emitPoolMetrics 
} from "../server/observability/metrics";
import { evaluateAlerts, getActiveAlerts } from "../server/observability/alerts";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test3_scheduler_consecutive_error(): Promise<void> {
  console.log("\n🧪 TEST 3: Scheduler Consecutive Error (CRITICAL after 2 consecutive failures)");
  
  // Emit first error
  emitJobStart("affiliates_aggregation");
  await sleep(100);
  emitJobError("affiliates_aggregation", "Test error 1");
  evaluateAlerts();
  
  const alertsAfterFirst = getActiveAlerts();
  const firstErrorAlert = alertsAfterFirst.find(a => a.id.includes("scheduler.error"));
  
  console.log(`After 1st error: ${firstErrorAlert ? `FIRING (severity=${firstErrorAlert.severity})` : "NO ALERT"}`);
  
  // Emit second consecutive error
  await sleep(100);
  emitJobStart("affiliates_aggregation");
  await sleep(100);
  emitJobError("affiliates_aggregation", "Test error 2");
  evaluateAlerts();
  
  const alertsAfterSecond = getActiveAlerts();
  const secondErrorAlert = alertsAfterSecond.find(a => a.id.includes("scheduler.error"));
  
  console.log(`After 2nd error: ${secondErrorAlert ? `FIRING (severity=${secondErrorAlert.severity})` : "NO ALERT"}`);
  
  // Verify CRITICAL escalation
  if (secondErrorAlert?.severity === "CRITICAL") {
    console.log(`✅ TEST 3 PASS: CRITICAL fired after 2 consecutive errors`);
    console.log(`   Alert: ${JSON.stringify(secondErrorAlert)}`);
  } else {
    console.log(`❌ TEST 3 FAIL: Expected CRITICAL, got ${secondErrorAlert?.severity || "NO ALERT"}`);
  }
  
  // Emit success to reset
  await sleep(100);
  emitJobStart("affiliates_aggregation");
  await sleep(100);
  emitJobEnd("affiliates_aggregation", 5000, 50);
  evaluateAlerts();
  
  const alertsAfterSuccess = getActiveAlerts();
  const resolvedAlert = alertsAfterSuccess.find(a => a.id.includes("scheduler.error"));
  
  console.log(`After success: ${resolvedAlert ? "STILL FIRING" : "RESOLVED"}`);
  
  if (!resolvedAlert) {
    console.log(`✅ Auto-resolution confirmed`);
  }
}

async function test4_pool_exhaustion_escalation(): Promise<void> {
  console.log("\n🧪 TEST 4: DB Pool Exhaustion (WARN at 60s, CRITICAL at 120s)");
  
  // Emit 4 snapshots (60s) with waiting > 0
  for (let i = 0; i < 4; i++) {
    emitPoolMetrics({
      total: 10,
      idle: 0,
      waiting: 5,
      acquireLatencyMs: 50,
    });
    evaluateAlerts();
    await sleep(100);
  }
  
  const alertsAt60s = getActiveAlerts();
  const warnAlert = alertsAt60s.find(a => a.id === "dbpool.pressure");
  
  console.log(`After 60s (4 snapshots): ${warnAlert ? `FIRING (severity=${warnAlert.severity})` : "NO ALERT"}`);
  
  if (warnAlert?.severity === "WARN") {
    console.log(`✅ WARN correctly fired at 60s threshold`);
  } else {
    console.log(`❌ Expected WARN at 60s, got ${warnAlert?.severity || "NO ALERT"}`);
  }
  
  // Emit 4 more snapshots (total 120s) with waiting > 0
  for (let i = 0; i < 4; i++) {
    emitPoolMetrics({
      total: 10,
      idle: 0,
      waiting: 5,
      acquireLatencyMs: 50,
    });
    evaluateAlerts();
    await sleep(100);
  }
  
  const alertsAt120s = getActiveAlerts();
  const criticalAlert = alertsAt120s.find(a => a.id === "dbpool.pressure");
  
  console.log(`After 120s (8 snapshots): ${criticalAlert ? `FIRING (severity=${criticalAlert.severity})` : "NO ALERT"}`);
  
  if (criticalAlert?.severity === "CRITICAL") {
    console.log(`✅ TEST 4 PASS: CRITICAL fired after 120s sustained exhaustion`);
    console.log(`   Alert: ${JSON.stringify(criticalAlert)}`);
  } else {
    console.log(`❌ TEST 4 FAIL: Expected CRITICAL at 120s, got ${criticalAlert?.severity || "NO ALERT"}`);
  }
  
  // Clear waiting connections
  emitPoolMetrics({
    total: 10,
    idle: 10,
    waiting: 0,
    acquireLatencyMs: 20,
  });
  evaluateAlerts();
  
  const alertsAfterClear = getActiveAlerts();
  const resolvedAlert = alertsAfterClear.find(a => a.id === "dbpool.pressure");
  
  console.log(`After clear (waiting=0): ${resolvedAlert ? "STILL FIRING" : "RESOLVED"}`);
  
  if (!resolvedAlert) {
    console.log(`✅ Auto-resolution confirmed`);
  }
}

async function main() {
  console.log("🔬 Phase 5 Fix Verification Starting (Tests 3 & 4 Only)\n");
  
  try {
    await test3_scheduler_consecutive_error();
    await test4_pool_exhaustion_escalation();
    
    console.log("\n✅ Fix verification complete");
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

main();
