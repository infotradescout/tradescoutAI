# TradeScout organic acquisition recovery evidence

Date: 2026-08-23

Baseline: `764d56f0eb195d5597bd679b62d7d766fc1783fb`

Branch: `codex/organic-acquisition-recovery-20260823`

Release state: **HOLD**. This record starts at the verified production baseline. It does not claim an exact recovery candidate, merge, deploy, indexing improvement, or signup growth.

## Locked outcome

Restore one truthful acquisition loop: working canonical HTTPS, a clean and substantive crawl graph, consistent Trust/CVS-backed public discoverability, and authoritative landing-to-registration measurement. Source-backed profile expansion, distribution, and conversion optimization remain later deliveries.

## Baseline observation

- Production identifies exact build `764d56f0eb195d5597bd679b62d7d766fc1783fb` through both the build header and health response.
- Apex HTTPS fails before an HTTP response while `https://www.thetradescout.com/` works.
- The recursive sitemap graph contains malformed city URLs, server/client-incompatible county URLs, sitemap-listed noindex pages, empty sitemap classes, QA or smoke artifacts, a 404 acquisition route, and canonical mismatches.
- Exact live examples at the baseline build: `/contractors/apply` is a sitemap-listed `404`; `/business/2h-v-construction-services-llc-2` is sitemap-listed but renders `noindex,nofollow`; the Exchange sitemap contains a `smokecategory-*` test URL whose rendered canonical points to `/exchange/other/*`; and the empty legacy business-profile sitemap is still advertised.
- The live graph advertises 62 core URLs, 139 directory-business URLs, 304 county URLs, and eight `/u` or `/u` inventory URLs, but public search results are dominated by the homepage and thin or empty trade-location pages rather than the eligible public profiles. Sitemap volume therefore overstates substantive discoverability.
- A complete bot-rendered audit of all 139 advertised directory-business URLs found 139 HTTP 200 responses but only eight indexable, fact-bearing pages. The other 131 URLs (94.2%) render `noindex,nofollow`, lack the fact-bearing marker, and contain fewer than 200 text characters. Correct status codes therefore concealed a sitemap-versus-rendering failure that directly prevents organic indexing of most advertised profiles.
- A complete bot-rendered audit of the 62 advertised core URLs found only five routes outside the failure set. Fifty-seven were thin, non-canonical, missing a real H1, redirected, or dead; 40 had no canonical, 56 had no H1, `/landing` redirected, and `/contractors/apply` returned 404. The baseline crawl budget is therefore dominated by generic application shells and invalid promises rather than substantive entry pages.
- Key public pages often return an empty or generic server-rendered bot body, generic metadata, or no canonical.
- Public-profile sitemap, SSR, search, and client eligibility decisions are not derived from one discoverability contract.
- A read-only production database reconciliation for the 30 calendar days ending 2026-08-23 found six created user rows: three `express_profile`, two normal `local`, and one `admin_provisioned_profile_steward`. None currently has `onboarding_completed=true`, and none is affiliate-attributed. After excluding the explicit provisioned/system providers, only two consumer-provider account creations remain; `provider=local` alone does not prove an organic or self-serve channel.
- The wider 12-month audit confirms that limitation: legacy `provider=local` data contains a 186-row homeowner creation burst on 2026-02-28 and a 49-row single-day burst on 2026-05-26. `users.created_at` is authority that an account exists, not authority for how it was acquired. The recovery report must keep authoritative account counts separate from fail-soft registration-flow and signed-source projections.
- Existing observable demand events in that same window contain 148 `demand.landing_view` rows and six `demand.cta_click` rows, but no universal profile-to-registration attribution. These event counts are not proof that six users completed signup from those landings.
- The production crawl-snapshot source predicate (active, public-discovery enabled, county-assigned, exposure-gated, and within the widest 730-day tier window) currently yields 420 county-assignment rows across 140 businesses. All 420 assignments are also within the 90-day category window. The new 350,000-row D1 safety bound is therefore not currently approached.
- Production currently contains only seven precomputed trade-county scope rows and eight trade-city scope rows. The new directory-business snapshot table and acquisition lifecycle uniqueness index are absent at the baseline, as expected before migration 0121.
- A read-only production scheduler reconciliation found a separate release blocker. The prior deploy acquired advisory leader lock `72418031` at 2026-08-23T15:10:09Z. The replacement instance for exact live build `764d56f0eb195d5597bd679b62d7d766fc1783fb` checked once at 2026-08-23T16:33:31Z while the prior instance was still draining, failed to acquire the lock, and the prior deploy deactivated eight seconds later. At 2026-08-23T20:19Z production `pg_locks` contained zero granted rows for that leader lock, and no SEO directory snapshot run occurred after the replacement became live. One-shot outer scheduler election therefore leaves rolling-deploy replacements schedulerless; retrying only an inner job lock cannot fix it because `startCrawlerScheduler()` is never called.
- Production contains zero pre-existing `acquisition.registration_completed` or `acquisition.activation_completed` event rows. That read-only result removes a legacy-row collision concern for migration 0121, but the generic analytics endpoint must still reserve these server-only event types so an authenticated client cannot occupy the new unique projection key.
- The stricter linked-profile exposure rule does not de-list the legitimate current production set: all six published profiles linked to a verified owner and an active, public-discovery business are explicitly released in that exact profile's `publicProfileIds` preference and all six contain meaningful public content. This is read-only production evidence, not a claim that those pages are currently indexed.
- Client-side events do not establish one universal, server-confirmed registration funnel, and generic public-profile discovery attribution is incomplete.
- D1 does not claim lossless source attribution: `users.created_at` and canonical onboarding outcome state remain registration and activation authority, while signed discovery lifecycle events are fail-soft indexed projections. The performance report must expose missing lifecycle projections and missing source attribution. A durable transactional outbox is explicit D4 hardening debt because authoritative user state cannot reconstruct a lost signed source/profile/entry identity.

## Apex certificate diagnosis

- Render Custom Domains shows four rows. `www.thetradescout.com` is **Verified / Certificate Issued**. Its auto-added redirect partner `thetradescout.com` is **Verified / Certificate Error**.
- Render's DNS detail view confirms the intended apex target is `tradescoutai.onrender.com`, with A-record fallback `216.24.57.1`, and says certificate issuance failed while DNS verification succeeded.
- Live public DNS resolves apex A to `216.24.57.1`, returns no apex AAAA answer, resolves `www` CNAME to `tradescoutai.onrender.com`, and publishes CAA authorization for both `letsencrypt.org` and `pki.goog`.
- The public DNS configuration therefore matches Render's current documented certificate prerequisites. The remaining dashboard recovery control is removal of the primary `www` domain pair followed by re-adding it, which can interrupt the currently working `www` certificate and requires explicit destructive-action confirmation at execution time.
- The owner explicitly authorized that remove-and-readd reset at action time. Render removed both TradeScout rows, re-added `www.thetradescout.com` plus its apex redirect, verified the existing DNS, and moved both certificates to **Pending**.
- Immediate live proof after re-verification: `https://www.thetradescout.com/` completes TLS and returns `200` with `x-tradescout-build: 764d56f0eb195d5597bd679b62d7d766fc1783fb`; `https://thetradescout.com/` completes TLS and returns `301 Location: https://www.thetradescout.com/`.
- Final Render proof: both `thetradescout.com` and `www.thetradescout.com` reached **Verified / Certificate Issued**. The destructive reset is complete and recoverable only by another domain-configuration change; no DNS records were removed or changed.

## Reuse and ownership decision

- Reconcile supported intent from PR 426 and PR 427 on current main; do not merge either stale branch independently.
- Reuse sitemap repository and SSR owners for crawl truth, canonical profile eligibility helpers for exposure, and canonical auth or analytics owners for completed registration measurement.
- Keep SEO and measurement workers on explicit non-overlapping file sets. The root agent is the only writer of this evidence and release status.
- Preserve the unrelated JW Stone root lock as historical lane-specific work; it is not authority for this platform recovery and will not be rewritten.

## Verification ledger

- Selective Intelligence `execution_contract.py validate`: **PASS** with no structural errors.
- Focused crawl, SSR, profile, measurement, and law tests: pending.
- Typecheck and build: pending.
- Disposable database proof: **diagnostic PASS** — after resetting only the isolated PostgreSQL 16 database in `tradescout-organic-gate-db-20260823`, the full migration chain through 0121 and `npm run db:verify:required` passed, including canonical snapshot tables/status and acquisition lifecycle uniqueness. Fixture proof also passed: an uninitialized snapshot was not ready; a completed zero-row generation became distinguishably ready; two governed fixtures produced two business, trade-county, and trade-city rows; a forced status-write failure rolled the entire replacement transaction back and preserved the prior one-row generation; removing the fault allowed generation 3 to publish both rows; and the 350,001-row capacity assertion failed before replacement. Registration and activation lifecycle persistence each returned `true` then `false` on duplicate insertion, leaving exactly one row of each type; the stored payloads contained no fixture email, phone, raw user-agent, IP, or raw URL. Final exact-commit reset and gate proof remain pending.
- Read-only production source-capacity and acquisition-authority reconciliation: **PASS** — no production writes; 420 source assignments / 140 businesses versus the 350,000-row cap, and two consumer-provider account creations / zero completed onboarding outcomes in the 30-day baseline. Organic or self-serve source is not inferred from the provider field.
- Read-only production scheduler reconciliation: **FAIL / release blocker** — `SCHEDULER_ENABLED=true` and leader-only startup are evidenced in Render logs, but the current live rolling-deploy replacement lost the one-shot outer advisory-lock election and production now has zero scheduler leader locks. Delayed reacquisition and exact-once scheduler startup require implementation and proof before this recovery can be a release candidate.
- Desktop and mobile browser proof: pending.
- Apex custom-domain or certificate proof: **PASS** — dashboard issued both certificates; apex TLS redirects to the working exact-build `www` host.
- Independent Objector and Verifier review: pending.
- Exact minimum-release gate and attestation: pending.
- Pull request review, merge, Render deploy, production identity, and post-deploy smoke: pending.

## Law integrity classification

- Visibility does not equal access: **enforced**, unchanged.
- Intent to Decision Card to Contact: **enforced**, unchanged.
- Trust/CVS governs exposure across sitemap, SSR, search, and client parity: **policy_target** until the exact recovery candidate passes the parity proof.
- Counties remain operational containers: **enforced**, unchanged.
- Claims-first signup with adaptive verification: **enforced**, unchanged.
- Nationwide source-backed profile coverage: **policy_target**, explicitly deferred from this bounded recovery.
- Bounded in-process SEO snapshot source scan: **temporary_exception**, owner `TradeScout platform owner`, rationale and fail-closed preservation recorded as `EXC-2026-08-23-001`, removal date 2026-09-30.
