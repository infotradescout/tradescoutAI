# Tier-3 Crawlers Canary Plan

**Status**: DRAFT — Ready to Execute When Phase 5 Canary Closes  
**Created**: 2026-01-05  
**Authority**: Requires explicit authorization after Phase 5 declared Production-Hardened  
**Prerequisite**: Observability Stack with CRITICAL alerts verified (Phase 5 complete + clean 48-72h canary)

---

## Why Crawlers Are Tier-3 (Not Earlier)

**Risk Profile**: Crawlers are high-amplitude, external-dependency operations that can:
- Generate unbounded DB writes (rows/run, total volume)
- Create sustained pool pressure (long-running transactions)
- Trigger rate limits or IP blocks (reputation risk)
- Produce scheduler overlap if runtime exceeds cadence
- Cause 5xx cascades if error handling fails

**Prerequisite Logic**: Before enabling crawlers, we must have:
1. ✅ **Observability Hardened** — CRITICAL alerts catching scheduler errors, pool exhaustion, 5xx server faults (Phase 5)
2. ✅ **Canary Validated** — Zero false-positive CRITICAL pages, dedup holds, auto-resolve works (48-72h clean)
3. ✅ **Kill Switch Ready** — `SCHEDULER_ENABLED=false` stops all jobs immediately

**What This Canary Proves**: That crawler budgets, hard caps, and circuit breakers prevent crawler-induced CRITICAL alerts. If any CRITICAL alert fires during canary → crawlers violated safety contract → adjust budgets or gates before retry.

---

## Crawler Inventory & Scope

### In-Scope for Canary (Tier-3 Crawlers)

| Crawler Job Name | Purpose | Target Domains | Current State |
|------------------|---------|----------------|---------------|
| `crawl_affiliates_profiles` | Scrape affiliate websites for bio, services, contact | Affiliate websites (from `affiliates` table) | DISABLED (check `scheduledJobs.ts`) |
| `crawl_institutional_sites` | Gather org structure, contact info, branding from institutional websites | County/city/state sites | DISABLED (check `scheduledJobs.ts`) |
| *Others TBD* | Additional crawlers if present in codebase | Varies | DISABLED |

**Scoping Rule**: Only enable crawlers that are:
- Currently disabled (no production traffic yet)
- Have explicit budgets defined below
- Pass dry-run verification (syntax, reachability, timeout handling)

**Out of Scope**: Any crawler already running in production (requires different migration strategy).

---

## Crawler Budgets (Initial Conservative Limits)

### Rate Limits (Per-Crawler)

| Budget Type | Value | Enforcement Point | Rationale |
|-------------|-------|-------------------|-----------|
| **Max Domains/Run** | 5 | SQL query `LIMIT 5` on target selection | Prevent runaway writes; allows ~5 affiliates or orgs per execution |
| **Max Pages/Domain** | 3 | Crawler logic (homepage + 2 key pages) | Minimize external requests; focus on high-value pages (homepage, about, contact) |
| **Request Rate (RPS)** | 0.5 (1 request per 2 seconds) | Delay between requests in crawler loop | Avoid rate limit triggers; respectful crawling |
| **Max Runtime/Run** | 5 minutes | Job timeout + monitoring | Prevent scheduler overlap (assume 15-min cadence or hourly) |
| **Max Rows Written/Run** | 15 (5 domains × 3 pages) | Validate before commit | Cap DB impact; aligns with domains × pages budget |

### Hard Caps (Circuit Breakers)

| Condition | Threshold | Action | Recovery |
|-----------|-----------|--------|----------|
| **Consecutive Errors ≥ 2** | 2 failed runs | CRITICAL alert fires → `scheduler.error.<job_name>` | Auto-stops via kill switch or manual disable; requires investigation before re-enable |
| **Pool Exhaustion > 120s** | Sustained waiting time | CRITICAL alert fires → `dbpool.pressure` | Auto-stops all jobs via kill switch; investigate queries, add indexes, or reduce concurrency |
| **5xx Server Faults > 30s** | Crawler endpoint errors | CRITICAL alert fires → `http.5xx_server_faults` | Auto-stops jobs; check crawler error handling, external site availability |
| **Scheduler Overlap ≥ 2** | Concurrent runs detected | CRITICAL alert fires → `scheduler.overlap` | Auto-stops overlapping job; increase cadence or reduce runtime budget |
| **Total Rows Written > 100/day** | Aggregate DB writes across all crawlers | Manual review threshold (not auto-stop yet) | Assess growth trajectory; decide if sustainable or needs throttling |

### Backoff & Retry Rules

| Error Type | Backoff Strategy | Max Retries | Notes |
|------------|------------------|-------------|-------|
| **Network Timeout** | Exponential (2s, 4s, 8s) | 3 | Common for slow external sites; retry with backoff |
| **HTTP 429 (Rate Limit)** | Exponential (30s, 60s, 120s) | 2 | Respect rate limits; increase delay between domains if persistent |
| **HTTP 5xx** | No retry (fail fast) | 0 | External server error; log and skip to next domain; increment error counter |
| **DNS Failure** | No retry (fail fast) | 0 | Domain unreachable; mark affiliate/org for manual review |
| **Parser Error** | Log and continue | N/A | Site structure changed; fallback to defaults, flag for human review |

---

## CRITICAL Alert Integration (Hard Stop Gates)

**Philosophy**: CRITICAL alerts are not warnings—they are **automatic circuit breakers**. If any CRITICAL alert fires during crawler canary, crawlers have violated safety contract.

### Alert → Crawler Stop Mapping

| CRITICAL Alert ID | Crawler Trigger | Auto-Stop Mechanism | Human Action Required |
|-------------------|-----------------|---------------------|----------------------|
| `scheduler.error.<crawler_job>` | 2 consecutive crawler failures | Kill switch or disable specific crawler | Investigate error logs; fix bug or adjust target selection; verify before re-enable |
| `dbpool.pressure` | Crawler queries causing >120s exhaustion | Kill switch (all jobs) | Add indexes, optimize queries, reduce concurrency, or lower domains/run budget |
| `http.5xx_server_faults` | Crawler endpoint throwing 5xx for >30s | Kill switch (all jobs) | Fix error handling in crawler logic; ensure proper try/catch and error classification |
| `scheduler.overlap` | Crawler runtime exceeds cadence (≥2 concurrent) | Kill switch or disable specific crawler | Reduce domains/run, optimize crawler speed, or increase job cadence |

### Expected Behavior During Canary

- **Green Path**: Zero CRITICAL alerts fire → Budgets are safe → Proceed to expand domains/run or add more crawlers
- **Yellow Path**: WARN alerts fire but auto-resolve → Budgets are tight but holding → Monitor closely, no changes yet
- **Red Path**: Any CRITICAL alert fires → **STOP IMMEDIATELY** → Apply kill switch → Investigate root cause → Adjust budgets or fix bug → Retry canary with new settings

---

## Canary Execution Plan

### Pre-Canary Checklist

- [ ] **Phase 5 Declared Production-Hardened** — Clean 48-72h canary with zero false-positive CRITICAL pages
- [ ] **Crawler Code Review** — Verify:
  - Error handling wraps all external requests (try/catch)
  - Timeouts configured (e.g., 10s per request)
  - Row write limits enforced in code (not just SQL LIMIT)
  - Logging includes: domain, pages fetched, rows written, errors
- [ ] **Budget Configuration** — Hard-code initial budgets in crawler logic:
  - `MAX_DOMAINS_PER_RUN = 5`
  - `MAX_PAGES_PER_DOMAIN = 3`
  - `REQUEST_DELAY_MS = 2000` (0.5 RPS)
  - `JOB_TIMEOUT_MS = 300000` (5 minutes)
- [ ] **Dry-Run Verification** — Execute crawler locally or in staging:
  - Confirm budgets are enforced
  - Verify rows written ≤ 15
  - Check runtime < 5 min
  - Validate error handling (simulate timeout, 5xx, DNS failure)
- [ ] **Monitoring Dashboard Access** — Confirm you can view:
  - Scheduler metrics (duration, errors, overlap)
  - DB pool metrics (waiting, exhaustion)
  - HTTP 5xx rates
  - CRITICAL alert status
- [ ] **Kill Switch Ready** — Document exact command to stop crawlers:
  - `SCHEDULER_ENABLED=false` in env → restart server
  - Or disable specific job in `scheduledJobs.ts` → deploy
- [ ] **Runbooks Prepared** — One-page guide for each CRITICAL ID (see RUNBOOKS.md)

### Canary Phase 1: Single Crawler, Hourly Cadence (24-48h)

**Scope**: Enable ONE crawler only (e.g., `crawl_affiliates_profiles`)  
**Cadence**: Hourly (e.g., `0 * * * *` cron)  
**Duration**: 24-48h  
**Budgets**: As defined above (5 domains, 3 pages, 0.5 RPS, 5min timeout)

**Success Criteria**:
- ✅ Zero CRITICAL alerts fire
- ✅ Scheduler metrics show runtime < 5min
- ✅ DB pool never exceeds 60s waiting (WARN threshold, acceptable)
- ✅ Rows written per run ≤ 15
- ✅ Total rows written across 24h ≤ 360 (15 rows × 24 runs)
- ✅ No scheduler overlap
- ✅ No 5xx errors (or only transient <30s)

**Monitoring Checkpoints**:
- **T+2h**: Verify first 2 runs completed, check logs for errors
- **T+12h**: Review metrics (runtime trend, rows/run, pool usage)
- **T+24h**: Formal checkpoint (log in canary report)
- **T+48h** (optional): Final confidence pass before expanding

**If CRITICAL Alert Fires**:
1. **Immediate**: Apply kill switch → stop crawler
2. **Log**: Alert ID, timestamp, trigger (e.g., "scheduler.error.crawl_affiliates_profiles at T+8h, 2 consecutive DNS failures")
3. **Investigate**: Review logs, identify root cause
4. **Adjust**: Reduce budgets (e.g., 3 domains instead of 5) OR fix bug (e.g., improve DNS error handling)
5. **Retry**: Reset canary with new settings, start T+0h again

### Canary Phase 2: Expand Budgets or Add Second Crawler (24-48h)

**Trigger**: Phase 1 completed with clean metrics (zero CRITICAL alerts)

**Option A: Expand Budget for Existing Crawler**
- Increase domains/run: 5 → 10
- Keep pages/domain: 3 (conservative)
- Expected rows/run: ~30
- Monitor for pool pressure increase

**Option B: Add Second Crawler**
- Enable second crawler (e.g., `crawl_institutional_sites`)
- Keep same budgets: 5 domains, 3 pages, 0.5 RPS, 5min timeout
- Offset cadence (e.g., one at :00, one at :30) to avoid concurrency spikes

**Success Criteria**: Same as Phase 1, adjusted for higher volume
- ✅ Zero CRITICAL alerts
- ✅ Total rows/day scales linearly (e.g., 2 crawlers × 15 rows × 24 runs = 720 rows/day)
- ✅ Pool pressure remains below WARN threshold or auto-resolves quickly

**Monitoring**: T+12h and T+24h checkpoints, same logging protocol

### Canary Phase 3: Full Rollout (Post-Canary)

**Trigger**: Phase 2 completed cleanly

**Actions**:
- Enable all in-scope crawlers
- Gradually increase budgets based on observed capacity:
  - If pool never exceeded 30s waiting → safe to increase domains/run
  - If runtime consistently < 3min → safe to add more pages/domain
  - If zero scheduler overlap → safe to increase cadence (e.g., every 30min instead of hourly)

**Ongoing Monitoring**:
- Weekly review of crawler metrics (rows written, runtime, errors)
- Monthly capacity assessment (DB growth, pool steady-state, external rate limits)
- Quarterly budget tuning (adjust based on traffic patterns)

---

## Exit Gates & Decision Points

### Canary Success → Proceed

**Criteria**:
- Phase 1 + Phase 2 completed (48-96h total)
- Zero CRITICAL alerts fired
- All budgets held (domains, pages, rows, runtime)
- No manual interventions required
- MTTR for any WARN alerts < 15min (auto-resolve working)

**Action**:
- Declare: "Tier-3 Crawlers: Canary Complete — Production-Ready"
- Freeze: Budgets locked (no changes without new canary)
- Enable: All in-scope crawlers with documented budgets
- Document: Append sign-off to this file with timestamp and metrics summary

### Canary Failure → Adjust & Retry

**Criteria**:
- Any CRITICAL alert fired
- Budgets violated (e.g., runtime > 5min, rows > 15/run)
- Scheduler overlap detected
- Manual kill switch applied

**Action**:
- Stop: Apply kill switch immediately
- Log: Failure details (alert ID, timestamp, root cause, metrics at failure)
- Analyze: Was it a code bug or a budget miscalibration?
  - **Bug**: Fix code, verify in staging, retry canary from Phase 1
  - **Budget**: Reduce domains/run or pages/domain, retry canary from Phase 1
- Document: Update this file with "Canary Iteration N" section showing what changed

---

## Operational Runbooks (Summary — See RUNBOOKS.md for Full Detail)

### CRITICAL: `scheduler.error.<crawler_job>`

**Symptom**: 2 consecutive crawler runs failed  
**Likely Causes**: DNS failure, network timeout, parser error, uncaught exception  
**Immediate Action**: Kill switch → disable crawler → investigate logs  
**Verification**: Fix bug → dry-run locally → verify 3 successful runs before re-enable  

### CRITICAL: `dbpool.pressure`

**Symptom**: DB pool waiting > 120s (sustained exhaustion)  
**Likely Causes**: Crawler INSERT queries too slow, missing indexes, too many concurrent crawlers  
**Immediate Action**: Kill switch → stop all jobs → run `EXPLAIN` on crawler queries  
**Verification**: Add indexes OR reduce domains/run → verify pool waiting < 30s during next run  

### CRITICAL: `http.5xx_server_faults`

**Symptom**: Crawler endpoint throwing 5xx for > 30s  
**Likely Causes**: Uncaught exception in crawler route, external site error propagating as 500  
**Immediate Action**: Kill switch → check server logs → fix error handling  
**Verification**: Ensure all crawler errors use `sendAutoClassifiedError` (4xx, not 5xx) → redeploy → monitor  

### CRITICAL: `scheduler.overlap`

**Symptom**: Crawler still running when next scheduled execution starts (≥2 concurrent)  
**Likely Causes**: Runtime > cadence interval, slow external sites, domains/run too high  
**Immediate Action**: Kill switch → reduce domains/run OR increase cadence interval  
**Verification**: Next run completes in < 50% of cadence interval (margin for variance)  

---

## Cost & Capacity Notes (Estimates)

### DB Write Projections

| Scenario | Crawlers | Domains/Run | Runs/Day | Rows/Day | Rows/Month | Notes |
|----------|----------|-------------|----------|----------|------------|-------|
| **Canary Phase 1** | 1 | 5 | 24 | 360 | ~10,800 | Conservative start; hourly cadence |
| **Canary Phase 2 (Expand)** | 1 | 10 | 24 | 720 | ~21,600 | 2× volume, test pool capacity |
| **Canary Phase 2 (Add)** | 2 | 5 | 48 | 720 | ~21,600 | Same volume, distributed across 2 jobs |
| **Full Rollout** | 3 | 10 | 72 | 2,160 | ~64,800 | Assumes 3 crawlers, 10 domains each, hourly |

### Pool Pressure Estimates

- **Current Baseline**: Pool waiting typically < 10s during normal ops (scheduler + API traffic)
- **Crawler Impact**: Each domain fetches 3 pages → 3 sequential INSERTs → ~300ms write time per domain
- **Peak Load**: 5 domains × 300ms = 1.5s write time per crawler run
- **Concurrency Risk**: If 2 crawlers run simultaneously + API traffic → potential 3-5s pool waiting spike
- **Mitigation**: Offset crawler cadences by 30min to avoid overlap

### External Rate Limit Risk

- **Current RPS**: 0.5 (1 request per 2 seconds)
- **Total Requests/Run**: 5 domains × 3 pages = 15 requests
- **Total Time/Run (Network Only)**: 15 requests × 2s = 30s (excludes parsing/DB writes)
- **Risk Assessment**: LOW — Most sites allow ≥1 RPS for bots; 0.5 RPS is very conservative
- **Scaling Headroom**: Can safely increase to 1 RPS (1 request per second) if needed, still respectful

---

## Backlog for Future Optimization (Post-Canary)

### After Canary Proves Budgets Safe

- [ ] **Increase Request Rate**: 0.5 RPS → 1 RPS (reduce delay to 1s between requests)
- [ ] **Add Parallel Crawlers**: Enable crawlers for other domains (e.g., contractor websites, local businesses)
- [ ] **Smart Domain Selection**: Prioritize domains by last_crawled timestamp or relevance score
- [ ] **Incremental Updates**: Only re-crawl if site content changed (e.g., check `Last-Modified` header or content hash)
- [ ] **Caching Layer**: Store fetched pages in Redis/S3 to avoid duplicate requests
- [ ] **User-Initiated Crawls**: Allow Scout to trigger on-demand crawls (e.g., "Refresh FlavorGood's profile") with same budget enforcement

### If Pool Pressure Becomes Issue

- [ ] **Add Indexes**: Review crawler INSERT queries, ensure indexes on foreign keys (e.g., `affiliate_id`, `org_id`)
- [ ] **Batch Writes**: Instead of INSERT per page, batch 15 rows into single multi-row INSERT
- [ ] **Async Queue**: Move crawler writes to background queue (e.g., BullMQ) to decouple from scheduler runtime

### If External Rate Limits Hit

- [ ] **User-Agent Rotation**: Identify as "TradeScoutBot/1.0" with contact email in User-Agent
- [ ] **IP Rotation**: Use proxy service if persistent rate limits (unlikely at 0.5 RPS)
- [ ] **Respect robots.txt**: Parse and honor crawl delays specified by target sites

---

## Approval & Sign-Off

### Pre-Canary Authorization (Required Before Execution)

**Authorized By**: Thomas (pending Phase 5 canary completion)  
**Date**: TBD  
**Conditions Met**:
- [ ] Phase 5 canary completed cleanly (48-72h, zero false-positive CRITICAL pages)
- [ ] Observability Stack declared Production-Hardened
- [ ] All pre-canary checklist items completed (code review, dry-run, budgets configured)
- [ ] Kill switch documented and tested

**Signature**: _______________ (Thomas)

### Post-Canary Completion (After Clean Canary Run)

**Canary Duration**: _____ hours (Phase 1 + Phase 2)  
**CRITICAL Alerts Fired**: _____ (expect 0)  
**Total Rows Written**: _____  
**Max Runtime Observed**: _____ minutes  
**Pool Exhaustion Max**: _____ seconds  
**Decision**: ☐ APPROVED FOR PRODUCTION  ☐ ADJUST & RETRY  
**Signed**: _______________ (Thomas)  
**Date**: _____

---

## Changelog

| Date | Change | Reason |
|------|--------|--------|
| 2026-01-05 | Initial draft created | Prepare during Phase 5 observe-only window; zero production impact |

---

**Next Step**: Review and authorize when Phase 5 canary closes cleanly. This plan is ready to execute with zero decision latency at the exit gate.
