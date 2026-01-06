# Phase 5 Hold Lift — Controlled Reactivation Plan

**Status:** READY TO EXECUTE  
**Date:** January 6, 2026  
**Owner:** Thomas  
**Estimated Duration:** 24 hours (with checkpoints)

---

## Executive Summary

Phase 5 observability is complete. The hold has served its purpose:
- ✅ CRITICAL paths verified
- ✅ Alerts trusted and quiet
- ✅ Server stable, serving traffic
- ✅ No false signal risk

**Current State:**
- Scheduler: DISABLED (`SCHEDULER_ENABLED != true`)
- Crawlers: DISABLED (by scheduler being off)
- Bot Army: SILENT (no jobs running)
- Aggregations: NOT RUNNING

**Why Nothing is Happening:**
Nothing is broken. The bots are explicitly disabled by design. The hold prevented cascading failures during observability stabilization — it did its job.

**Decision:** Lift the hold surgically with controlled reactivation.

---

## Reactivation Strategy: Tier-by-Tier

### Tier 2 First: Aggregation Jobs (Safest Signal)

**Why Start Here:**
- Internal-only (no external crawling)
- Generates real metrics
- Proves system is alive
- Zero SEO/public risk
- Observable output immediately

**What Gets Activated:**
- `usersAggregationJob` (nightly)
- `affiliatesAggregationJob` (nightly)
- `tradeDealsAggregationJob` (nightly)

**What Stays OFF:**
- Crawler (Tier 3) — no external requests yet
- No public-facing automation

---

## Phase 1: Enable Aggregation Only (Hours 0-12)

### Step 1.1: Environment Configuration

**Production Env Changes:**
```bash
# Enable scheduler
SCHEDULER_ENABLED=true

# Keep crawler disabled (Tier 3)
DISABLE_CRAWLER=true

# Optional: Disable individual aggregations if needed
# DISABLE_USERS_AGGREGATION=true
# DISABLE_AFFILIATES_AGGREGATION=true
# DISABLE_TRADEDEALS_AGGREGATION=true
```

**Deploy Method:**
1. Update Render environment variables
2. Trigger manual deploy OR wait for auto-deploy on next push
3. Monitor deploy logs for startup sequence

### Step 1.2: Verification Checklist (First 30 Minutes)

**Expected Logs:**
```
[Scheduler] Background jobs enabled...
Starting users aggregation scheduler with schedule: "0 2 * * *"
Starting affiliates aggregation scheduler with schedule: "0 2 * * *"
Starting trade deals aggregation scheduler with schedule: "0 2 * * *"
Users aggregation scheduler started
Affiliates aggregation scheduler started
TradeDeals aggregation scheduler started
```

**What Should NOT Appear:**
```
Starting crawler scheduler
Crawler scheduler started
```

**Verification:**
- [ ] Server starts without errors
- [ ] Scheduler logs confirm jobs are registered
- [ ] No crawler startup messages
- [ ] No process.exit() calls
- [ ] Server remains running after startup

### Step 1.3: Trigger First Test Run (Manual)

**Option A: Wait for Scheduled Time (2 AM UTC)**
- Natural execution
- No manual intervention
- Verifies cron schedule works

**Option B: Force Immediate Run (for faster feedback)**

Create a temporary test endpoint (if not already exists):
```typescript
// server/routes.ts or dedicated test route
app.post("/api/admin/test/run-aggregation", requireAdmin, async (req, res) => {
  const { job } = req.body; // 'users' | 'affiliates' | 'tradedeals'
  
  try {
    let result;
    if (job === 'users') {
      result = await runUsersAggregationJob();
    } else if (job === 'affiliates') {
      result = await runAffiliatesAggregationJob();
    } else if (job === 'tradedeals') {
      result = await runTradeDealsAggregationJob();
    }
    
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Manual Trigger (via API):**
```bash
curl -X POST https://your-domain.com/api/admin/test/run-aggregation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"job": "users"}'
```

### Step 1.4: Monitor Aggregation Output

**Database Verification:**
```sql
-- Check county_metrics for new rows
SELECT 
  metric_type,
  county_fips,
  COUNT(*) as record_count,
  MAX(timestamp) as latest_update
FROM county_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY metric_type, county_fips
ORDER BY latest_update DESC;

-- Check for errors
SELECT * FROM error_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
AND component LIKE '%aggregation%'
ORDER BY timestamp DESC;
```

**Expected Observability Metrics:**
```
[DEBUG evaluateSchedulerAlerts] users_aggregation: N metrics (N > 0)
[DEBUG evaluateSchedulerAlerts] affiliates_aggregation: N metrics (N > 0)
[DEBUG evaluateSchedulerAlerts] trade_deals_aggregation: N metrics (N > 0)
```

**Success Criteria (First 12 Hours):**
- [ ] At least one aggregation job completes successfully
- [ ] `county_metrics` table receives new rows
- [ ] Observability metrics show non-zero counts
- [ ] No CRITICAL alerts fired
- [ ] Server remains stable (no restarts, no OOM)

---

## Phase 2: Enable Crawler (Hours 12-24)

**⚠️ ONLY PROCEED IF Phase 1 Success Criteria Met**

### Step 2.1: Remove Crawler Disable Flag

**Production Env Changes:**
```bash
# Scheduler still enabled
SCHEDULER_ENABLED=true

# Remove crawler disable (or set to false)
# DISABLE_CRAWLER=true  ← DELETE THIS LINE
# OR
DISABLE_CRAWLER=false
```

**Deploy and Monitor Startup:**

**Expected Logs:**
```
[Scheduler] Background jobs enabled...
Starting crawler scheduler with schedule: "*/5 * * * *"
Crawler scheduler started
```

### Step 2.2: First Crawler Run Verification

**Expected Crawler Output:**
```
🚀 Starting crawler...
Cache directory: /app/cache/autogenerated
📦 Extracting marketplace listings...
✓ Cache written: marketplace.json (X items)
🔨 Extracting contractors...
✓ Cache written: contractors.json (X items)
🏘️  Extracting HOA...
✓ Cache written: hoa.json (X items)
👥 Extracting community groups...
✓ Cache written: groups.json (X items)
🗺️  Extracting counties...
✓ Cache written: counties.json (X items)
👤 Extracting public profiles...
✓ Cache written: profiles_public.json (X items)
❓ Extracting FAQ...
✓ Cache written: faq.json (X items)
✓ Cache written: _metadata.json (X items)
✅ Crawler complete in XXXms
Success: 7, Errors: 0
```

**What Should NOT Appear:**
```
[Diagnostic] process.exit(0) was called explicitly.
Process exiting with code: 0
```

**Verification:**
- [ ] Crawler runs to completion
- [ ] All 7+ cache files are written
- [ ] No process.exit() in logs
- [ ] Server remains running after crawler completes
- [ ] Next scheduled crawler runs automatically

### Step 2.3: Cache Validation

**Check Generated Files:**
```bash
# SSH into production or check via admin endpoint
ls -lah /app/cache/autogenerated/

# Verify file timestamps are recent
cat /app/cache/autogenerated/_metadata.json
```

**Expected Metadata:**
```json
{
  "lastCrawled": "2026-01-06T...",
  "duration": 500-2000,
  "successCount": 7,
  "errorCount": 0,
  "timestamp": 1234567890
}
```

**Success Criteria (Hours 12-24):**
- [ ] Crawler completes without errors
- [ ] Cache files are generated and updated
- [ ] No process exits after crawler runs
- [ ] Scheduled crawls continue running (every 5 min by default)
- [ ] Server memory/CPU remain stable

---

## Phase 3: Bot Army Validation (Hours 24+)

**Once Both Phases 1 & 2 Are Stable:**

### Step 3.1: Enable Full Bot Army

**Check Bot Army Status:**
```bash
# Review bot configurations
npm run test:e2e -- tests/bot-army --reporter=list

# Or run specific bot scenarios
npm run test:e2e -- tests/bot-army/discovery-bot.spec.ts
```

**Enable Bot Schedules (if using cron-based bots):**
- Review `BOT_ARMY_COMPLETE.md` for activation instructions
- Enable one bot type at a time
- Monitor output and metrics

### Step 3.2: Bot Output Monitoring

**Expected Bot Metrics:**
- Discovery actions logged
- User interactions recorded
- Telemetry events flowing
- No auth failures
- No rate limit errors

**Verification:**
- [ ] Bots complete their scenarios
- [ ] No critical failures
- [ ] Telemetry pipeline receives data
- [ ] Bot reports generated successfully

---

## 🔧 ADDENDUM — BOT ARMY REALITY & EXECUTION MODEL

### Why This Addendum Exists

The term "Bot Army" previously referred to GitHub Actions workflows and scheduled scripts.  
This created a false expectation of autonomous behavior.

**Clarification:**  
GitHub Actions are **triggers**, not **agents**. They cannot act as persistent teammates.

This addendum defines the correct execution model so Phase 3 produces real output.

---

### Core Correction: Bots vs Agents

#### ❌ What Bot Army is NOT

- Not cron jobs
- Not GitHub Actions alone
- Not YAML-defined scripts
- Not stateless workflows

These can **run tasks**, but cannot:
- reason
- remember
- retry intelligently
- coordinate work
- simulate humans

#### ✅ What Bot Army IS (Phase 3 Definition)

**Bot Army = Persistent AI Agents with Roles**

Each agent:
- has a **role**
- has **memory**
- has **scope-limited authority**
- **executes tasks**, not scripts
- **produces artifacts** (code, data, reports)

GitHub Actions are only used to **trigger or supervise** these agents.

---

### Phase 3 (24h+): Bot Army — REFINED

#### Phase 3 Goal (Updated)

Replace missing early users and contributors with **AI labor** that:
- **builds**
- **fixes**
- **validates**
- **populates**

the system continuously.

#### Agent Roster (Minimum Viable Virtual Team)

##### 1. Builder Agent (AI Engineer)

**Purpose:** Generate product surface area

**Capabilities:**
- Reads repo
- Implements components/pages/features
- Follows ESLint + theme guardrails
- Opens PRs or commits to feature branches

**Outputs:**
- New UI components
- Feature scaffolding
- Refactors per ticket

##### 2. Fixer Agent (AI Maintenance Engineer)

**Purpose:** Keep the system green

**Capabilities:**
- Watches CI / build failures
- Fixes lint, type, build, and test errors
- Refactors legacy code safely

**Outputs:**
- Build fixes
- Cleanup commits
- Reduced tech debt

##### 3. Verifier Agent (AI QA / User Simulator)

**Purpose:** Replace real user testing

**Capabilities:**
- Executes Playwright / API flows
- Simulates user journeys
- Identifies broken assumptions

**Outputs:**
- Test reports
- Repro steps
- Suggested fixes

##### 4. Synthesizer Agent (AI Growth Simulator)

**Purpose:** Replace missing users & activity

**Capabilities:**
- Generates fake but realistic users
- Seeds profiles, leads, events, interactions
- Drives aggregation & dashboard features

**Outputs:**
- Seeded data
- Activity logs
- Aggregation validation

---

### Execution Architecture (Phase 3)

#### Runtime Model

- Agents run as **long-lived Node processes**
- Hosted locally or on a cheap worker (Render/Fly/etc.)
- **NOT serverless**
- **NOT cron-only**

Each agent loop:
```
Fetch task → Think → Act → Verify → Persist memory → Report
```

#### Control Plane

| Component | Role |
|-----------|------|
| GitHub Actions | Trigger, schedule, supervise |
| Agent Runtime | Thinking + execution |
| Repo | Source of truth |
| Database | Memory + seeded data |
| Observability | Output validation |

---

### Phase 3 Safety & Kill Switches

**All Phase-5 guardrails remain in force.**

#### Hard Stops

- Any CRITICAL alert → agents stop
- Scheduler kill switch remains active
- No agents can deploy directly to production

#### Allowed Actions

- Branch commits
- PRs
- Seed data
- Non-prod simulations

---

### Phase 3 Success Criteria (Updated)

Phase 3 is **PASS** if:

- [ ] Agents produce commits/PRs **daily**
- [ ] Fake data exercises dashboards **meaningfully**
- [ ] Aggregations show **non-zero, consistent output**
- [ ] No CRITICAL alerts triggered
- [ ] System remains deployable

---

### Why This Matters (Explicit)

**Without this correction:**
- "Bot Army" produces no visible results
- You mistake silence for failure
- Momentum stalls

**With this correction:**
- You gain **labor**
- Progress continues **without users**
- Features become **testable before launch**

---

### Status Relative to Hold

- ✅ Phase 5 observability integrity **preserved**
- ✅ No runtime changes required yet
- ✅ Documentation-only until execution authorized
- ✅ Fully compatible with PHASE_5_HOLD_LIFT_PLAN.md

---

### Next Explicit Decision (When Hold Lifts)

**Choose one to execute first:**

A. Spin up Agent Runtime **locally** (fastest)  
B. Deploy a single Builder Agent worker  
C. Retrofit existing `bot-army.yml` to trigger agents

**If you want, next I can:**
- write the Agent Runtime skeleton
- define task schemas
- or convert `bot-army.yml` into a real supervisor

Just tell me which one you want first.

---

**You're not stuck.**  
**You just needed workers, not hope.**

---

## Monitoring Dashboard

### Key Metrics to Watch

**Server Health:**
- Uptime (should not reset unexpectedly)
- Memory usage (should remain stable)
- CPU usage (spikes are OK during jobs)
- Error rate (should stay near zero)

**Job Execution:**
- Aggregation job start/end events
- Crawler start/end events
- Job duration (should be consistent)
- Success/failure ratio

**Data Flow:**
- `county_metrics` row count growth
- Cache file update frequency
- Metadata timestamps

**Alerts:**
- CRITICAL alert count (should be zero)
- WARNING alert patterns
- Error logs by component

### Observability Queries

**Check Recent Job Runs:**
```sql
-- Observability metrics for jobs
SELECT 
  metric_name,
  metric_value,
  timestamp,
  metadata
FROM observability_metrics
WHERE metric_name LIKE '%job%'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

**Check Scheduler Events:**
```sql
-- Job start/end events
SELECT * FROM observability_events
WHERE event_type IN ('job_start', 'job_end', 'job_error')
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

---

## Rollback Procedures

### If Phase 1 Fails (Aggregation Issues)

**Immediate Action:**
```bash
# Disable scheduler again
SCHEDULER_ENABLED=false
```

**Redeploy and Monitor:**
- Verify server returns to stable state
- Review error logs for root cause
- Fix issue before re-attempting

### If Phase 2 Fails (Crawler Issues)

**Immediate Action:**
```bash
# Keep aggregation but disable crawler
SCHEDULER_ENABLED=true
DISABLE_CRAWLER=true
```

**Investigate:**
- Check crawler error logs
- Verify database connectivity
- Check for process.exit() calls (should be gone)
- Review memory usage during crawl

### If Server Becomes Unstable

**Emergency Stop:**
```bash
# Full shutdown of all background jobs
SCHEDULER_ENABLED=false
DISABLE_CRAWLER=true
DISABLE_USERS_AGGREGATION=true
DISABLE_AFFILIATES_AGGREGATION=true
DISABLE_TRADEDEALS_AGGREGATION=true
```

**Escalation:**
- Alert CRITICAL if auto-recovery fails
- Review Phase 5 observability data
- Re-verify CRITICAL paths

---

## Success Criteria Summary

### Phase 1 (Aggregation Only) ✅
- [ ] Jobs register on startup
- [ ] At least one successful run within 12 hours
- [ ] Database receives new metrics
- [ ] No CRITICAL alerts
- [ ] Server remains stable

### Phase 2 (+ Crawler) ✅
- [ ] Crawler runs to completion
- [ ] Cache files generated
- [ ] No process exits
- [ ] Scheduled runs continue
- [ ] Server remains stable

### Phase 3 (+ Bot Army) ✅
- [ ] Bots execute scenarios
- [ ] Telemetry flows
- [ ] Reports generated
- [ ] No critical failures

### Overall System Health ✅
- [ ] Uptime > 99.9%
- [ ] Error rate < 0.1%
- [ ] CRITICAL alerts = 0
- [ ] Memory/CPU within normal range
- [ ] All CRITICAL paths functional

---

## Timeline

| Time | Phase | Action | Duration |
|------|-------|--------|----------|
| T+0h | 1.1 | Deploy with aggregation enabled | 15 min |
| T+0.5h | 1.2 | Verify startup logs | 30 min |
| T+1h | 1.3 | Trigger test aggregation (optional) | 15 min |
| T+2h | 1.4 | Monitor first run output | 1-2 hours |
| T+4h | - | **CHECKPOINT 1** — Go/No-Go for Phase 2 | - |
| T+12h | 2.1 | Deploy with crawler enabled | 15 min |
| T+12.5h | 2.2 | Verify first crawler run | 30 min |
| T+13h | 2.3 | Validate cache output | 1 hour |
| T+16h | - | **CHECKPOINT 2** — Go/No-Go for Phase 3 | - |
| T+24h | 3.1 | Enable bot army (if applicable) | Varies |
| T+48h | - | **FINAL REVIEW** — Hold officially lifted | - |

---

## Post-Lift Actions

### Documentation Updates

- [ ] Mark Phase 5 as COMPLETE in `PHASE_5_COMPLETE.md`
- [ ] Update `QUICK_REFERENCE.md` with new scheduler state
- [ ] Archive this lift plan for future reference
- [ ] Update deployment checklist

### Governance Changes

- [ ] CRITICAL alerts are now authoritative
- [ ] Observability is trusted source of truth
- [ ] Hold enforcement is no longer active
- [ ] Normal deployment cadence resumes

### Next Priorities

After successful lift:
1. **Phase 6 Planning** (if applicable)
2. **Bot Army Optimization** based on real output
3. **Crawler Schedule Tuning** (adjust frequency if needed)
4. **Aggregation Performance** review

---

## Communication Plan

### Stakeholder Updates

**Before Lift:**
- Notify team that hold is being lifted
- Share this plan for review
- Set expectations for monitoring period

**During Lift:**
- Report checkpoint results (Go/No-Go decisions)
- Share key metrics at each phase
- Escalate any issues immediately

**After Lift:**
- Confirm all phases completed successfully
- Share final metrics and learnings
- Document any adjustments made

---

## Notes

**Why This Approach Works:**
- **Incremental:** One tier at a time
- **Observable:** Clear success criteria at each step
- **Reversible:** Clean rollback procedures
- **Low-Risk:** Internal jobs before external crawling
- **Fast Feedback:** Manual triggers available for testing

**What We Learned from the Hold:**
- Silence is valuable when debugging
- Holds prevent masking root causes
- Observability must be trusted before automation
- Surgical reactivation > all-at-once flip

**Final Reminder:**
The hold did its job. Now it's time to see the system work.

---

**Status:** READY TO EXECUTE  
**Next Action:** Deploy Phase 1 env changes and monitor startup

