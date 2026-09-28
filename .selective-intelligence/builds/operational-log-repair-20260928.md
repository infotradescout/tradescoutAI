# TradeScout operational log recovery — 2026-09-28

Objective: Restore the owner's ability to diagnose TradeScout/JW Stone activity from logs. No Desktop Commander, customer messages, payment changes, new services or GitHub Actions workflows.

Base branch/commit: main / bbb2a2420e5935aa07855cb227823fc6c63c6f93.
Current branch/commit: fix/restore-operational-log-detail-20260928; use the commit containing this checkpoint and verify the PR head before continuing.

## Verified completed work

- Read production entry selection in build-server.mjs: server/index.ts is the compiled production entry.
- Read server/index.ts lines 1065–1105: default API_LOG_ALL is false in production; successful requests faster than 750 ms are omitted. The emitted line includes only method, path, status and elapsed milliseconds. Logging is registered after custom-domain routing, CORS and body parsing, so enabling the flag alone does not cover early exits or restore context.
- Compared a local copy of server/services/logger.ts against GitHub blob 345b7dd3ec03d88ccacd3f539c03b272c66882a0. Exact byte identity verified. Its JSON serializer drops standard Error message/stack/cause fields, drops false/zero metadata, and replaces the entire record when any field is circular.
- Merged only API_LOG_ALL=true into the existing Render production service configuration. No other variables replaced. Render triggered deployment dep-datcnbmk1f9s73fovlsg at the unchanged bbb2a242 source.
- Render get_deploy confirmed status live; finishedAt 2026-09-28T20:19:58.307861Z.
- Render application logs from the new instance after deployment show successful GET /api/health entries at 10, 11, 13, 20, 32, 47 and 60 ms. These are health checks, not customer traffic. This proves the suppression switch took effect, not a complete logging recovery.
- Repaired the shared logger serializer in this branch. Preserve standard Error fields, nested causes, AggregateError errors, codes, supplied request/user/job identifiers, falsy outcomes and unaffected siblings around a cycle. Preserve severity console sinks and readable prefixes. Redact recognized credential fields and common credential-bearing string forms; do not add request/response body capture.

Files changed: server/services/logger.ts; scripts/tests/logger-detail.test.mjs; this checkpoint.

## Tests/evidence already run

- Node v22.16.0: node --experimental-strip-types --test scripts/tests/logger-detail.test.mjs — 16 passed, 0 failed, 0 skipped.
- Standalone strict TypeScript: tsc --noEmit --strict --target ES2022 --module ESNext --lib ES2022,DOM server/services/logger.ts — exit 0.
- Final logger SHA-256: 4a9d84823af66552c3ef9d15b629a4c073348f5e2744f1cf808d984012ecc5e7.
- Final test SHA-256: 0c3d529e9e12b3ff0853df45134178e3c02eef007daab0b0de32d660fc55c41c.
- Synthetic local module tests only. Full repository typecheck/build/minimum-release contract and live serializer acceptance are NOT executed or claimed.

Changed but unverified work: integration/deployment of the shared logger change. Production only has the API_LOG_ALL configuration change.
Tests/evidence invalidated by later changes: none after the final two file hashes recorded above; any source change requires the targeted tests again.

## Known blockers/risks

- The original commit/date that introduced suppression has not been identified; do not invent authorship or timing.
- API_LOG_ALL does not supply missing route validation codes, request IDs, actor classification, provider acknowledgements or business outcomes. It also includes health polling, which must be filtered during analysis rather than misreported as customer traffic.
- Existing global exception logging still exists in server/index.ts; do not claim all error logs were removed.
- No confirmed first-party customer/test/bot labeling from historical HTTP rows. Prior 400/429 and 201 entries cannot establish lost customers or completed sales.
- The local analysis environment could execute Node/TypeScript but direct repository/network download failed. Connected GitHub and Render remain usable. Do not substitute the owner's desktop or bypass the release contract.
- Credential redaction is scoped to this logger and recognized patterns, not an audit or guarantee covering every direct console call.

External side effects and retry safety: production logging configuration changed and redeployed once; source branch and PR only for code. No stock, orders, prices, accounts, provider calls, messages or payments created. Do not repeat the configuration deploy.

Next exact action: integrate request diagnostics ahead of early-return middleware in the actual server/index.ts and mirror in server/app.ts, preserving the existing metrics/crawler recorder. Restore server-generated request correlation, host/profile, authenticated internal actor ID, explicit unknown/test/bot evidence, validation field paths and stable reason codes, business result IDs and provider outcome linkage without logging credential bodies or inventing delivery. Run focused native HTTP/serializer tests, then the existing minimum-release contract on the exact candidate before merge/deploy. Source-level detailed logging restoration remains incomplete.

Actions that must NOT be repeated: no Desktop Commander; no repository-wide rediscovery; no payment/checkout detour; no new proof service; no GitHub Actions workflows; no raw customer request/response dumps; no inferred customer counts from this incomplete historical log stream; do not turn off the restored logging switch silently.
