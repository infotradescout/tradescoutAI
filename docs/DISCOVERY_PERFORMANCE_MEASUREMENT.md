# Discovery Performance Measurement

This report measures public discovery without using measurement data as trust, ranking, contact, or publication authority. It keeps historical discovery measurement separate from the new acquisition-lifecycle projection funnel.

## Release boundaries

- Historical D0 discovery release commit: `6a63fd41e86811815184905c0626cf64e6a904a7`
- Historical D0 production activation: `2026-08-08T17:36:32.672607Z` UTC
- The July 9-August 8 report ending at that timestamp is the **historical pre-release baseline**.
- Before that timestamp, the D0 signed request-attribution and discovery conversion measures are **not applicable**, not zero-rate failures.
- The clean D0 post-release measurement clock begins at `2026-08-08T17:36:32.672607Z` UTC.
- The D1 discovery -> CTA -> registration -> activation funnel has **no verified production activation yet**. Its release commit and activation timestamp remain `null` in the executable report. D1 funnel zeroes are therefore not production conversion evidence and are reported as `pending_production_activation` / not applicable.

Historical baseline command:

```powershell
node --env-file=.env scripts/report-discovery-performance.mjs --from=2026-07-09T18:29:33.584Z --to=2026-08-08T17:36:32.672607Z --release-at=2026-08-08T17:36:32.672607Z --out-dir=artifacts-historical
```

Post-release command:

```powershell
node --env-file=.env scripts/report-discovery-performance.mjs --from=2026-08-08T17:36:32.672607Z --to=2026-08-09T00:00:00.000Z --release-at=2026-08-08T17:36:32.672607Z
```

The command accepts `--from`, `--to`, `--release-at`, `--acquisition-release-at`, `--days`, and `--out-dir`. A window crossing either applicable release boundary is labeled `crosses_release_boundary` and must not be used as a clean pre-release or post-release result. `--acquisition-release-at` may be set only from verified production activation evidence for the exact released build.

## Definitions

- `crawled`: a bot observation for a publicly exposable entity route on TradeScout or an unambiguous custom domain, grouped by identity route and crawler family. Generic item-page identities use the unambiguous profile mapping. Custom-domain mapping counts HTML routes only, so asset fetches are not misreported as profile crawls.
- `surfaced`: a post-release verified discovery landing with a finite `sourceHint` or `referrerClass`. Source hints use a fixed taxonomy (`google`, `bing`, `chatgpt`, `facebook`, `linkedin`, `newsletter`, `direct`, `other`); referrers use fixed search/AI/social/referral families. Raw UTM values, hosts, subdomains, paths, and queries are not retained. This is an arrival proxy, not a search-engine impression.
- `visited`: a `profile_view_events` browser/profile-data fetch after recognized user-agent bots are excluded, with discovery landing counts shown separately where applicable. Neither signal proves a human or unique visitor.
- `converted`: a post-release created work request whose `work_request_events.metadata.entryRequestId` matches a verified discovery landing identity.
- `publicly exposable`: either a discoverable published `/u` profile that passes the canonical visibility, active-business, public-discovery, verification, meaningful-content, and internal-role rules, or a completed-snapshot `/business` entity that still passes the current 24-hour snapshot, publication, trust, county, and recency checks. Direct-only profiles are excluded.
- `uncrawled`: a publicly exposable entity with no bot observation in the selected window.
- `unvisited`: a publicly exposable entity with neither a recognized-bot-excluded profile-data fetch nor a discovery landing in the selected window.

Discovery performance denominators include only entities whose public exposure is affirmatively authorized; missing, stale, or indeterminate exposure fails closed. Published profile rows that fail the canonical exposure rules are listed separately and do not count as uncrawled or unvisited. `/u/:slug` and `/business/:slug` remain distinct identities even when their slugs match, and a discoverable linked `/u` profile supersedes its snapshot-backed directory detail row.

## Acquisition authority and projection coverage

- `users.created_at` proves account existence. Provider values `local`, `google`, and `facebook` define only a consumer-provider candidate cohort; they do not prove an organic or self-serve channel.
- `users.preferences.onboardingOutcome.completedAt` with `onboarding_completed=true` proves canonical activation.
- `acquisition.registration_completed` and `acquisition.activation_completed` are server-confirmed, lifetime-idempotent event-ledger projections used for registration-flow classification and source attribution. They are not the authority for account existence or activation.
- Projection coverage and source-attribution coverage are reported separately, including missing projections and projected rows without a verified source.
- Event persistence is fail-soft so analytics cannot make a successful registration or activation fail. Durable transactional attribution/outbox delivery is not active; closing that possible projection/source-loss gap is D4 hardening debt.

## Separate surfaced-performance follow-up

### Connected Search Console import

TradeScout accepts a privacy-safe aggregate generated from an authenticated Google Search Console Performance export. Raw exports remain local and uncommitted.

```powershell
npm run import:search-console-performance -- --source-dir=C:\path\to\unzipped-export --out=artifacts\search-console\aggregate.json --property=sc-domain:thetradescout.com
$env:DISCOVERY_SEARCH_CONSOLE_AGGREGATE = "artifacts\search-console\aggregate.json"
npm run report:discovery-performance -- --from=2026-08-08T17:36:32.672607Z
```

The safe aggregate contains daily and canonical public-page metrics, but never raw query values, raw source paths, page query strings, or fragments. Query coverage is published only as row and impression counts, including impressions withheld or anonymized by Search Console.

Search Console reports calendar days. Build `6a63fd41e86811815184905c0626cf64e6a904a7` activated at `2026-08-08T17:36:32.672607Z`, so August 8 mixes pre-release and post-release hours and is excluded from clean post-release surfaced-performance claims. The first clean Search Console date is `2026-08-09`.

Google Search Console measures Google impressions, clicks, queries, and pages. It does not provide a ChatGPT impression metric. ChatGPT reporting remains limited to `OAI-SearchBot` crawl activity, verified discovery landings classified into the finite `chatgpt` source family, and signed-attribution requests.

Application telemetry cannot provide search impressions, clicks, queries, or indexed pages. The surfaced-performance follow-up must use Google Search Console for:

- impressions
- clicks
- search queries
- landing pages

TradeScout telemetry may supplement that report with:

- `OAI-SearchBot` crawl activity only for ChatGPT search-crawler reporting
- verified discovery landings classified into the finite `chatgpt` source family

`ChatGPT-User`, `GPTBot`, or a referrer alone must not be presented as ChatGPT search impressions, clicks, or conversions. No source may be assigned an impression metric it does not provide.

## Publication and privacy rules

- The historical baseline is the intentionally published aggregate artifact: `docs/DISCOVERY_PERFORMANCE_HISTORICAL_BASELINE.md`.
- Generated JSON and Markdown report outputs under `artifacts/` or `artifacts-historical/` remain uncommitted unless explicitly reviewed as aggregate-only output.
- Committed artifacts must not contain IP addresses, full user agents, email addresses, request content, signed envelopes, secrets, private production identifiers, or observed URL query strings.
- The report performs read-only SQL queries and writes only local output files. It does not change schema, migrations, production data, email, Direct Connect lifecycle, profiles, buyer paths, or ecosystem products.
