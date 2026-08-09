# Discovery Performance Measurement

This report measures public discovery after the release without changing public discovery behavior or using measurement data as trust, ranking, or contact authority.

## Release boundary

- Release commit: `6a63fd41e86811815184905c0626cf64e6a904a7`
- Production activation: `2026-08-08T17:36:32.672607Z` UTC
- The July 9-August 8 report ending at that timestamp is the **historical pre-release baseline**.
- Before that timestamp, signed attribution and discovery conversion are **not applicable**, not zero-rate failures.
- The clean post-release measurement clock begins at `2026-08-08T17:36:32.672607Z` UTC.

Historical baseline command:

```powershell
node --env-file=.env scripts/report-discovery-performance.mjs --from=2026-07-09T18:29:33.584Z --to=2026-08-08T17:36:32.672607Z --release-at=2026-08-08T17:36:32.672607Z --out-dir=artifacts-historical
```

Post-release command:

```powershell
node --env-file=.env scripts/report-discovery-performance.mjs --from=2026-08-08T17:36:32.672607Z --to=2026-08-09T00:00:00.000Z --release-at=2026-08-08T17:36:32.672607Z
```

The command accepts `--from`, `--to`, `--release-at`, `--days`, and `--out-dir`. A window crossing the release boundary is labeled `crosses_release_boundary` and must not be used as a clean pre-release or post-release result.

## Definitions

- `crawled`: a bot observation for a publicly exposable profile route on TradeScout or its unambiguous custom domain, grouped by profile and crawler family. A recorded published-profile slug is authoritative for historical attribution; the current custom-domain owner is only a fallback when that identity is absent. Custom-domain mapping counts HTML routes only, so asset fetches are not misreported as profile crawls.
- `surfaced`: a post-release verified discovery landing with a source hint or referrer host. This is a source-attributed arrival proxy, not a search-engine impression.
- `visited`: human-only `profile_view_events` plus discovery landing events where applicable.
- `converted`: a post-release created work request whose `work_request_events.metadata.entryRequestId` matches a verified discovery landing identity.
- `publicly exposable`: a published profile that passes the same public visibility, trust-authority, and internal-profile indexing boundaries used by anonymous profile reads and profile sitemaps.
- `uncrawled`: a publicly exposable profile with no bot observation in the selected window.
- `unvisited`: a publicly exposable profile with neither a human profile view nor a discovery landing in the selected window.

Discovery performance denominators include only profiles whose public exposure is affirmatively authorized; missing or indeterminate exposure fails closed. Published rows that fail public visibility, trust authority, or internal-profile indexing rules are listed separately as exclusions and do not count as uncrawled or unvisited public profiles. An unambiguous configured custom domain is shown as the canonical profile route. The output includes aggregate profile coverage, request distribution by profile, and crawl distribution by crawler family. Profile names, slugs, and configured public domains are public catalog fields; crawler-family labels are aggregate categories.

## Separate surfaced-performance follow-up

Application telemetry cannot provide search impressions, clicks, queries, or indexed pages. The surfaced-performance follow-up must use Google Search Console for:

- impressions
- clicks
- search queries
- landing pages

TradeScout telemetry may supplement that report with:

- `OAI-SearchBot` crawl activity only for ChatGPT search-crawler reporting
- verified visits whose source field is `utm_source=chatgpt.com`

`ChatGPT-User`, `GPTBot`, or a referrer alone must not be presented as ChatGPT search impressions, clicks, or conversions. No source may be assigned an impression metric it does not provide.

## Publication and privacy rules

- The historical baseline is the intentionally published aggregate artifact: `docs/DISCOVERY_PERFORMANCE_HISTORICAL_BASELINE.md`.
- Generated JSON and Markdown report outputs under `artifacts/` or `artifacts-historical/` remain uncommitted unless explicitly reviewed as aggregate-only output.
- Committed artifacts must not contain IP addresses, full user agents, email addresses, request content, signed envelopes, secrets, private production identifiers, or observed URL query strings.
- The report performs read-only SQL queries and writes only local output files. It does not change schema, migrations, production data, email, Direct Connect lifecycle, profiles, buyer paths, or ecosystem products.
