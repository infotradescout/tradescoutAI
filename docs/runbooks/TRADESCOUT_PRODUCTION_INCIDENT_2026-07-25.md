# TradeScout production incident — 2026-07-25

## Decision

**NOT READY. Phase E SEO publication remains blocked.**

This report covers TradeScout only. The repair was prepared in the isolated worktree
`D:\AAATraderCorner\TradeScout\TradeScoutPro-production-incident` on branch
`codex/production-incident-20260725`, based on
`eedf5d757c8c994ae8f55f47492411333e72e32f` (`origin/main` at diagnosis).

No push, merge, deploy, production write, production migration, scheduler change, or
production restart was performed. Production database diagnostics were read-only.
The separate Phase E worktree and PR were not modified.

TradeScout contact, county, trust/CVS, and no-pay-to-play invariants remain
**enforced** and are not changed by this incident patch.

## 1. Root cause by issue

### P0 — Production schema drift

The missing objects belong to the already-committed canonical migration:

- `migrations/0072_seo_publication_rules_and_freshness.sql`
- journal index `74`
- journal timestamp `1755001020776`
- journal tag `0072_seo_publication_rules_and_freshness`
- introduced by commit `e5c4c5d06db533506ca5f636823382e8dab5da23`
- the introducing commit is an ancestor of current `origin/main`

The migration creates:

- `ts_publication_rules`
- the canonical `ts_publication_rules.id = 'default'` row
- `ts_seo_prune_log`
- `ts_public_activity`
- `businesses.public_discovery_enabled`
- the associated enum types and indexes

Read-only production proof at diagnosis:

- `ts_publication_rules`: missing
- `ts_seo_prune_log`: missing
- `ts_public_activity`: missing
- `businesses.public_discovery_enabled`: present
- `drizzle.__drizzle_migrations`: present
- exact SHA-256 record for canonical 0072: absent
- production ledger rows: `36`
- production ledger rows at or after 0072's journal timestamp: `33`
- a later 0074 record: present

The repo journal has 112 entries, while the production ledger has only 36 rows.
Only eight production hashes matched the current migration files during the
read-only comparison. The migration history was reconciled after 0072 and the
ledger cursor advanced beyond 0072 without proving that 0072's SQL executed.

**Root cause:** the deployment migrator is cursor-based. Because production has
later ledger entries, a normal `npm run db:migrate` does not go backward to apply
0072. This is migration-ledger drift, not an absent or uncommitted migration.
Creating another table or duplicate migration would hide that drift and is
explicitly rejected.

### P0 — Neon connection starvation

The live database was not at its global connection ceiling when inspected:

- PostgreSQL `max_connections`: `901`
- connections at the read-only snapshot: `14`
- idle connections: `13`
- diagnostic connection: `1`

The application pool defaults to `max: 50`,
`connectionTimeoutMillis: 10000`, and `idleTimeoutMillis: 30000` in
`server/db.ts`. The logged `waitingCount` is an application-pool queue signal,
not proof that Neon had exhausted all 901 server slots.

Four concrete application defects created burst pressure and retained sessions:

1. `server/utils/advisoryLocks.ts` acquired a session advisory lock through
   `pool.query(...)` and released it through a later `pool.query(...)`. A pooled
   query is not guaranteed to use the same PostgreSQL session.
2. The same session error existed in transaction control: several paths issued
   `BEGIN`, writes, and `COMMIT` through independent `pool.query(...)` calls.
3. Eight nightly jobs fired at the same minute, several 15-minute jobs were
   aligned, and four jobs also ran immediately at process startup.
4. Every bot response could start unbounded, low-priority telemetry work:
   runtime DDL checks, county lookup, a recrawl lookup, three writes, per-request
   prune/backfill checks, and a separately timed daily aggregate refresh.

Read-only `pg_locks` and `pg_stat_activity` correlation found eight granted
session advisory locks attached to idle sessions:

- `job:homescout_alerts`
- `job:market_signals_snapshots`
- `job:homescout_ingestion`
- `job:partner_county_observation_snapshots`
- `job:intent_automation`
- `job:crawler`
- `job:partner_intelligence_brief_snapshots`
- `job:direct_connect_funnel_stall`

These were leaked session locks, not ordinary evidence of jobs still executing.
They explain persistent `advisory lock not acquired` skips. The snapshot does
not prove duplicate Render workers; worker-count verification remains a
recovery step.

#### Timeout-path trace

| Logged path | Source path | Why it timed out | Repair |
| --- | --- | --- | --- |
| `buildPublicTradeCountyHtml` | public Trade county HTML service | A public request was a victim of the saturated application pool and returned empty fallback HTML when its database query could not obtain a connection. | Reserve capacity by capping all scheduled database jobs and serializing crawler telemetry; do not lengthen the timeout. |
| `recordCrawlerRequestEvent` | `server/services/crawlerTelemetryService.ts` | One fire-and-forget task per bot response could run concurrently and perform multiple database operations. | Bounded queue, default one active write and 100 outstanding; observable drops; safe transient retry/backoff only before an ambiguous commit. |
| `resolveCountyFips2` in bundle | source function `resolveCountyFips` | Concurrent cache misses for the same county made duplicate lookups. | In-flight promise deduplication plus the serialized telemetry lane. |
| `refreshBotObservationDailyAggregate` | `server/services/crawlerTelemetryService.ts` | A timer per aggregate key could release a large group of writes together. | One coalescing timer, bounded pending map, one active aggregate writer, bounded retry/backoff, and drop metrics. |

The write transaction now uses one checked-out client for its recrawl read,
event insert, observation insert, rollup update, commit/rollback, and release.
Retries are allowed only when the prior attempt is known safe to repeat. An
ambiguous `COMMIT` is not retried.

### P0 — JW Stone custom-domain/PWA CORS

Live pre-patch reproduction:

- canonical `https://www.thetradescout.com/offline.html` with
  `Origin: https://jwstonelogistics.com` returned HTTP 500
- `https://jwstonelogistics.com/offline.html` redirected to the canonical host
- canonical same-origin `/offline.html` returned HTTP 200

`/offline.html` was absent from `isCustomDomainMechanicsPath`, so the custom
host redirected it to the canonical host. The browser preserved the JW Stone
origin, and the global CORS middleware—applied to static files as well as
APIs—turned an otherwise public static GET into HTTP 500.

The repair:

- treats `/offline.html` as custom-domain mechanics
- treats a narrow allowlist of public static GET/HEAD assets as CORS-neutral
- sends those public bytes without an `Access-Control-Allow-Origin` grant when
  the origin is otherwise disallowed
- keeps API, auth, mutation, preflight, and non-static paths fail-closed
- does not add a wildcard origin

Final local request proof against the production build:

| Host / Origin / Path | Result |
| --- | --- |
| `jwstonelogistics.com` / `https://jwstonelogistics.com` / `/offline.html` | 200, no redirect, offline body present |
| `www.thetradescout.com` / `https://jwstonelogistics.com` / `/offline.html` | 200, no redirect, no cross-origin grant |
| `www.thetradescout.com` / `https://www.thetradescout.com` / `/offline.html` | 200, canonical origin grant |
| `www.thetradescout.com` / `https://jwstonelogistics.com` / `/api/build-marker` | 500 from the existing strict CORS rejection |

Anonymous in-app browser proof against the same final local build:

- desktop `1440x900`: title `TradeScout — Offline`, heading `You’re offline`,
  no horizontal overflow
- mobile `390x844`: title `TradeScout — Offline`, heading `You’re offline`,
  no horizontal overflow

The temporary custom-domain fixture was created only in the test database and
was deleted after proof. Zero fixture users and profiles remain.

### P1 — HomeScout seed failure

Read-only production proof found one enabled source:

- `source_key`: `seed_22105`
- `source_type`: `json_file`
- configured path: `data/homescout/seed-22105.json`
- last success: 2026-02-14
- current result: `ENOENT /app/data/homescout/seed-22105.json`

Git history shows the fixture was added by
`fc4b0afe8a824f36cf94894ef6756f17cc3dbbb2` and deleted by
`8a4a546bc2ce765ea3ec6ea35c4a5607e05448e8`. The deleted records were
synthetic development data. `docs/homescout-ops.md` explicitly states that the
repo no longer ships seed listing data.

**Root cause:** production retained an enabled configuration row for a removed
development fixture. The intended repair is to disable that exact stale source
row, not restore synthetic listings. Code now treats any configured-source
error as a failed scheduler run and includes the source error in telemetry
instead of logging a successful zero-listing completion.

### P1 — Scheduler and advisory locks

All scheduler database work now shares a process gate:

- default active scheduled jobs: `2`
- hard configuration cap: `4`
- default queued distinct jobs: `32`
- hard queue cap: `64`
- duplicate job key in the same process: skipped
- cross-process duplicate: rejected by the PostgreSQL advisory lock
- lock and unlock: same checked-out client
- failed unlock or uncertain transaction rollback: client evicted

Default schedule/lock inventory after the patch:

| Job | Advisory lock key | Default schedule |
| --- | --- | --- |
| crawler | `job:crawler` | `*/5 * * * *` |
| intent automation | `job:intent_automation` | `*/2 * * * *` plus guarded startup tick |
| HomeScout ingestion | `job:homescout_ingestion` | `0 * * * *` |
| HomeScout alerts | `job:homescout_alerts` | `4-59/15 * * * *` |
| HomeScout aggregate | `job:homescout_aggregation` | `17 2 * * *` |
| HomeScout market metrics | `job:homescout_market_metrics` | `23 2 * * *` |
| HomeScout bucket metrics | `job:homescout_bucket_metrics` | `27 2 * * *` |
| partner county snapshots | `job:partner_county_observation_snapshots` | `6-59/15 * * * *` |
| partner brief snapshots | `job:partner_intelligence_brief_snapshots` | `8-59/15 * * * *` |
| Direct Connect funnel stall | `job:direct_connect_funnel_stall` | `2-59/15 * * * *` plus guarded startup run |
| crawler telemetry maintenance | `job:crawler_telemetry_maintenance` | `7 * * * *` |
| market signals | `job:market_signals_snapshots` | `10 * * * *` plus guarded startup run |
| SEO publication prune | `job:seo_publication_prune` | `12 * * * *` |
| SEO directory scope | `job:seo_directory_scope_snapshot` | `30 */6 * * *` |
| Scout/LISA cleanup | `job:scout_lisa_cleanup` | `17 * * * *` plus guarded startup run |
| users aggregate | `job:users_aggregation` | `1 2 * * *` |
| affiliates aggregate | `job:affiliates_aggregation` | `9 2 * * *` |
| trade deals aggregate | `job:trade_deals_aggregation` | `13 2 * * *` |
| completed-job prices | `job:completed_job_price_snapshots` | `21 2 * * *` |
| trust snapshots | `job:trust_snapshots` | `31 2 * * *` |

Explicit production environment schedule overrides take precedence over these
defaults and must be audited before re-enabling jobs.

### P1 — Intent parity

`cutover_active=false` is preserved.

Read-only production evidence:

- recent comparison samples: `event_native_count=0`,
  `snapshot_derived_count=0`
- last two hours: zero Scout interaction events
- last 24 hours: one Scout `advise` interaction
- crawler events existed, but most lacked qualifying geographic and human
  intent evidence
- snapshot items were directory/bot observations without the required
  baseline delta, contact/repeat evidence, category match, velocity, or
  confidence threshold

**Root cause:** neither side produced a qualifying comparable intent record.
Zero-versus-zero is absence of evidence, not failed parity and not readiness.
The status now reports `no_comparable_evidence`, counts comparable samples
separately, and cannot promote cutover until the minimum number of non-empty
comparison samples meets the overlap target.

## 2. Exact files and migrations involved

Existing canonical migration, unchanged:

- `migrations/0072_seo_publication_rules_and_freshness.sql`
- `migrations/meta/_journal.json`

Deployment and recovery guard:

- `render.yaml`
- `package.json`
- `scripts/apply-sql-migration.mjs`
- `scripts/check-required-production-schema.mjs`

Connection, scheduler, and telemetry repair:

- `server/utils/advisoryLocks.ts`
- `server/utils/boundedConcurrency.ts`
- `server/utils/boundedTaskQueue.ts`
- `server/utils/poolTransaction.ts`
- `server/services/crawlerScheduler.ts`
- `server/services/crawlerTelemetryService.ts`
- `server/services/liveStreamSnapshotService.ts`
- `server/services/partnerCountyObservationSnapshotService.ts`
- `server/services/partnerIntelligenceBriefSnapshotService.ts`
- `server/routes/tradepartner-campaigns.ts`
- `server/badges/badgeEngine.ts`
- `server/xp/xpEngine.ts`

Custom-domain repair:

- `server/index.ts`
- `server/http/corsPolicy.ts`

Intent parity:

- `server/routes/observability.ts`
- `server/services/intentParityStatus.ts`

HomeScout error truth:

- `server/services/crawlerScheduler.ts`
- existing source loader: `server/services/homeScoutIngestionJob.ts`
- existing operational truth: `docs/homescout-ops.md`

## 3. Prepared patch diff

The local patch:

1. Adds a deploy-time schema-and-ledger guard after normal migrations.
2. Adds an authorized recovery mode that applies canonical 0072 and records
   its canonical hash/timestamp in the same transaction.
3. Fixes advisory lock session ownership.
4. Fixes all located `pool.query("BEGIN")` transaction-control misuse.
5. Caps scheduler database concurrency and deduplicates local job keys.
6. Staggers colliding schedules and exposes the missing scheduler status.
7. Serializes crawler telemetry, coalesces aggregate refreshes, removes
   prune/backfill from each bot request, deduplicates county lookups, and adds
   bounded safe retry/backoff and drop metrics.
8. Fixes the narrow static/PWA CORS path without an origin wildcard.
9. Marks configured HomeScout source errors as job failures.
10. Distinguishes no comparable intent evidence from parity failure/readiness.

No new schema migration and no duplicate SEO table were added.

## 4. Tests added or changed

Added:

- `server/utils/advisoryLocks.test.ts`
- `server/utils/boundedConcurrency.test.ts`
- `server/utils/boundedTaskQueue.test.ts`
- `server/utils/poolTransaction.test.ts`
- `server/tests/apply-sql-migration-record.test.ts`
- `server/tests/cors-policy.test.ts`
- `server/tests/intent-parity-status.test.ts`
- `server/tests/pool-transaction.contract.test.ts`
- `server/tests/production-incident-concurrency.test.ts`
- `server/tests/production-incident-scheduler.contract.test.ts`
- `server/tests/required-production-schema.test.ts`

Changed:

- `server/tests/crawler-telemetry.contract.test.ts`
- `server/tests/custom-domain-profile-cache.contract.test.ts`

## 5. Commands run and actual results

### Focused automated tests

Command: `npm run test:run -- <19 incident and touched-path test files>`

Result:

- test files: `19 passed`
- tests: `50 passed`
- failures: `0`

### Production build

Command: `npm run build`

Result:

- client modules transformed: `3955`
- Vite production build: passed
- server bundle: passed
- warnings only: stale Browserslist data and three pre-existing ambiguous
  Tailwind duration classes

### TypeScript

Command: `npm run check`

Result: failed on two existing, unrelated client test typing errors:

- `client/src/pages/profile-sites/PremiumProductProfileSections.test.tsx:290`
- `client/src/pages/profile-sites/WholesalerProfileTheme.lux.test.tsx:118`

Both files are byte-for-byte unchanged from `origin/main`. No incident-patch
TypeScript error was reported.

### Required-schema guard

Against the test database, the direct guard correctly failed because the test
database has the 0072 objects but no Drizzle ledger. A positive-path test then:

1. created the ledger and canonical 0072 hash inside one test transaction,
2. verified every required object, default row, ledger, and canonical hash,
3. rolled back,
4. confirmed the ledger did not remain.

Result: positive verification passed; `rolledBackLedgerPresent=false`.

### Test-database concurrency probe

The actual bounded queue classes were exercised against the test Neon database:

- scheduled jobs submitted: `20`
- accepted: `20`
- peak scheduled database work: `2`
- crawler telemetry events submitted/completed: `100/100`
- peak telemetry database work: `1`
- queue drops/failures: `0/0`
- underlying test pool: `2 total`, `2 idle`, `0 waiting`, configured max `10`

This is realistic external-database concurrency proof, but it is not a
production load test.

### CORS and browser

The exact final-build request matrix and anonymous desktop/mobile browser
results are recorded in the JW Stone section above.

### Worktree hygiene

- `git diff --check`: passed
- build-generated sitemap changes were restored
- the temporary test custom-domain user/profile was deleted and verified absent
- the final local branch contains only this TradeScout incident repair
- no OneDrive worktree, Phase E worktree, or other repository was modified
- final `git status --short` is empty after the local incident commit

## 6. Clean-worktree status

Handoff target:

- worktree:
  `D:\AAATraderCorner\TradeScout\TradeScoutPro-production-incident`
- branch: `codex/production-incident-20260725`
- upstream comparison: `origin/main`
- disposition: local commit only, not pushed
- worktree: clean

## 7. Authorized production recovery order

Do not perform these steps without separate authorization and a maintenance
window.

1. Keep Phase E blocked and pause deploys.
2. Capture a Neon restore point/backup and current Render configuration.
3. Set `SCHEDULER_ENABLED=false` on every web/worker instance and restart the
   existing service. The restart is required to terminate sessions that still
   own the eight leaked advisory locks.
4. Confirm no TradeScout scheduler leader remains active and the stale session
   locks are gone.
5. From the exact reviewed release checkout, run:

   ```powershell
   npm run db:apply:sql -- migrations/0072_seo_publication_rules_and_freshness.sql --record-drizzle
   npm run db:verify:required
   ```

   The apply and ledger record are one transaction. The command refuses files
   outside `migrations/`, requires the journal entry, computes the canonical
   SHA-256, and refuses to invent a missing Drizzle ledger.
6. Independently query and record:
   - all four 0072 objects/column
   - the default publication rule
   - the exact canonical 0072 ledger hash
7. Disable only the stale synthetic HomeScout source:

   ```sql
   begin;

   update home_scout_sources
   set
     enabled = false,
     last_error =
       'Disabled during 2026-07-25 incident recovery: removed synthetic repo fixture data/homescout/seed-22105.json',
     updated_at = now()
   where source_key = 'seed_22105'
     and source_type = 'json_file'
     and config->>'path' = 'data/homescout/seed-22105.json'
     and enabled = true
   returning id, source_key, source_type, enabled, config, last_error;

   commit;
   ```

   Require exactly one returned row. If a real, licensed source is later
   configured, validate that source independently before enabling it.
8. Audit all explicit `*_SCHEDULE` environment overrides. The staggered code
   defaults do not replace an existing override.
9. Deploy the reviewed incident commit with schedulers still disabled. The new
   Render pre-deploy command must pass both `db:migrate` and
   `db:verify:required`.
10. Run anonymous canonical and JW Stone desktop/mobile checks, including
    `/offline.html`, service-worker behavior, static assets, and strict API
    cross-origin rejection.
11. Run a controlled public-request plus background-job concurrency test and
    observe:
    - pool active/idle/waiting
    - connection acquisition latency/timeouts
    - `pg_stat_activity` state
    - advisory lock owner/session
    - crawler telemetry queue, retries, failures, and drops
    - Trade county listing HTML, not fallback-only HTML
12. Designate one scheduler leader, re-enable jobs in stages, and observe at
    least one full hourly window and the staggered nightly window.
13. Leave intent cutover false until non-empty comparable evidence meets the
    configured minimum and overlap target.
14. Only after separate production verification is recorded may Phase E SEO
    publication receive a new ship/no-ship review.

### Rollback implications

- A failure inside the 0072 recovery command rolls back both its DDL/DML and
  ledger insert.
- After a successful commit, do **not** drop the 0072 tables, column, enums, or
  audit log as a routine code rollback. They are additive and compatible with
  older code; dropping them can destroy publication/prune evidence.
- A code rollback may leave the repaired schema in place.
- HomeScout source disablement is reversible only after a valid replacement
  source has been proven.
- Scheduler caps/staggering can be rolled back in code/config, but the old
  leaked locks require their owning sessions to terminate.

## 8. Remaining risks

1. Production 0072 is still unapplied and unrecorded.
2. The eight existing leaked locks remain until the owning sessions restart or
   terminate.
3. Production schedule overrides and instance count have not been verified.
4. The bounded test-Neon probe is not production concurrency proof.
5. JW Stone is fixed and browser-checked locally, but the live custom domain is
   still broken until an authorized deploy and live verification.
6. The stale HomeScout production source remains enabled until the authorized
   one-row update.
7. Intent has no comparable evidence; cutover correctly remains false.
8. Two unrelated baseline TypeScript errors prevent a claim that the entire
   repo typecheck is green.
9. Crawler telemetry still contains legacy runtime table-ensure logic. It is
   serialized and removed from prune/backfill hot paths, but a future
   migration-ledger cleanup should move those tables fully into committed
   migrations.
10. Phase E SEO behavior has not been retested against a recovered production
    database and must remain isolated.

## 9. Recommendation

**NOT READY.**

The local repair is tested and reviewable, but TradeScout production remains
degraded until the separately authorized recovery procedure is completed and
verified live. Do not approve Phase E SEO publication.
