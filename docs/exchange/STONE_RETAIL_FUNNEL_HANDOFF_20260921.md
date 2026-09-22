# TradeScout stone retail continuation — migrations integrated, not deployed

## Objective
Generate real connected buyer calls and distinct interested buyers, measured against comparable Facebook Marketplace offers. TradeScout owns retail listings and the customer relationship; JW remains the separate supplier. Public retail prices have no fabricator-membership gate. Exclude Pensacola, Florida city only, not a county, radius, surrounding cities or all Florida. Continuation is not approval of reference prices.

## Base branch/commit
Repository: infotradescout/tradescoutAI
Branch: exchange/tradescout-stone-retail-20260921
Original main: f22ddff023d24d5ca1938714619f942819afc5ce
This slice resumed from checkpoint 0c53860d1e7fef691af140ae402dc028ff5791f4, following inquiry implementation 15381216e1e409b981c2e0b4a91f08504a476d69.

## Current branch/commit
Tested implementation and test commit: d15b0bc8cde5d50734cebd6ecb02c6ffab571476 on the same branch. This checkpoint is a documentation-only successor. PR #690 remains draft and must not be merged as a finished sales funnel.

## Verified completed work
The existing atomic inquiry/screen work remains intact. This slice promotes its two staged SQL definitions into canonical migrations 0140 and 0141, adds the corresponding journal entries, and connects read-only stone schema verification to the existing migration/startup release paths and release bundle.

All 143 historical journal entries are unchanged. No ledger history was stamped, repaired or applied to a real application database. The new migrations create outcome evidence and buyer-scoped inquiry receipts; they do not publish listings or change supplier prices. The staged SQL files remain for compatibility; tests require their DDL bodies to equal the canonical migration files.

The read-only verifier checks exact column types/nullability, timestamp defaults, validated CHECK definitions, immediate primary/unique keys, five correct foreign-key targets and native index direction. A same-named but weakened table does not pass. Missing verifier artifacts stop the supported canonical release path before migration execution. The existing base verifier runs first; its failure or the stone verifier's failure yields a nonzero result.

### Native PostgreSQL evidence
Used an existing Neon test project, not production and not newly provisioned infrastructure. Canonical DDL executed inside pg_temp with minimal temporary prerequisite tables, within a transaction rolled back to its initial SAVEPOINT. Twenty-three PostgreSQL assertions passed: duplicate request/card rejection, all five foreign keys, payload/fingerprint checks, buyer-scoped identity, legacy aliases, evidence deduplication, callback-versus-call separation, failed-write rollback and idempotent DDL replay preserving records. Native advisory and row locks executed, but lock contention was not tested.

The latest full behavior run reported PostgreSQL 17.11. Initial inspection reported 17.8; use each execution's reported version rather than assuming a fixed provider patch level. Final queries confirmed temporary DDL rolled back and both public stone tables remained absent.

Native metadata caught a verifier bug that synthetic fixtures missed: pg_get_indexdef(index, column, true) returns a column without its DESC flag. The verifier now reads indoption direction bits separately. A focused second native transaction executed the corrected query and confirmed the legacy index's final key is descending, then rolled back. The full behavior suite did not need repeating for this metadata-only change. SQL-literal normalization preserves whitespace/cast-looking text inside quoted values.

## Files changed and exact-source identity
All ten implementation/test files below match their locally tested bytes and committed Git blobs.

| Path | Bytes | Git blob |
|---|---:|---|
| build-server.mjs | 5530 | f249ba441ba74a49b6d0ae3efc0ce1f530365e88 |
| migrations/0140_exchange_stone_funnel.sql | 1228 | 7bae51409c0a21a064c4c23f57b6425becddf0f7 |
| migrations/0141_exchange_stone_inquiry_receipts.sql | 952 | 0f6d5803837a7ebfc335b6249cc89f8842928edb |
| migrations/meta/_journal.json | 22748 | daa68b5fd8b3d52db3b65fe51c6dad18b51ea897 |
| runtime/run-release.mjs | 3254 | c6dc8a0008acc2758abbbedcb5efd694317f84e7 |
| scripts/check-exchange-stone-schema.mjs | 1184 | 44a229aa09639e038afac27949046e3daca871a7 |
| scripts/db-migrate-safe.mjs | 2592 | 03c2fcae2c29befa670be885b9600c3c8287e331 |
| scripts/exchange-stone-schema.test.mjs | 8225 | f3995139e547c484ad35acfa7e80193ba4fcce84 |
| scripts/exchange-stone-postgres-proof.mjs | 9354 | 6908fe9542e685a199ebd9c53f61f241e8db608d |
| scripts/lib/exchange-stone-schema.mjs | 8601 | 829847dbdeb6d7a4aba1308189da7676920ccb24 |

A transport escaping difference in the newly committed child-script test was corrected before final acceptance. The final test hash above is the verified version, not the intermediate commit. Production application logic was not changed by that correction.

## Tests/evidence already run
Command: NODE_PATH=$(npm root -g) node --experimental-strip-types --test scripts/exchange-stone-schema.test.mjs scripts/exchange-stone-inquiry-transaction.test.mjs scripts/exchange-stone-inquiry-draft.test.mjs scripts/exchange-stone-funnel-core.test.mjs
Result: 75 passed, 0 failed, 0 skipped. This is 27 new schema/release cases plus the previous 48. Prior transaction tests still use explicit SQLite/HTTP adapters; they have not become native application-transaction proof.

All seven changed MJS files pass node --check. The native proof generator emits SQL and source digests; it does not choose credentials/targets or execute anything itself.

Actual release-launcher subprocess tests use synthetic child verifiers and an explicit security adapter. They prove command sequencing, missing-artifact refusal and failure propagation, not live TLS/database behavior. Bundle/direct-migration integration has source checks, not a full build. The metadata query ran on PostgreSQL; JavaScript shape validation/CLI was tested with local snapshots, not a live pg.Client session.

The continuation package preserves the local test log, exact SQL request sets, a clearly labeled transcribed native-result summary, migration-history comparison and source SHA manifest. The corrected full generator output and the earlier full native execution differ only in the subsequently executed metadata query.

## Changed but unverified work / invalidated evidence
No full application build/typecheck, complete Express/sign-in journey, full native application-schema transaction, multi-process PostgreSQL contention or npm run gate:minimum-release has passed. The release-path changes require fresh full candidate verification before merge. Earlier 16 browser-component scenarios were not rerun after the preceding atomic submission-path changes; do not claim current full-browser acceptance.

No persistent migration deployment, production database mutation or native CLI connection occurred. This schema proof is not a complete historical empty-database bootstrap or an accepted release. Canonical launcher and db:migrate paths include the new verifier; invoking the old base checker file directly still checks only its existing schema.

## Known blockers/risks
National catalog/discovery/media/geographic/import integration remains incomplete. The existing inquiry contact guard is not proof of Pensacola discovery exclusion. Do not reuse the old incomplete base-alias copy approach. Product-level indexing and public pricing remain unaccepted.

119 material references remain staged, 0 explicit retail price approvals, 0 newly published listings/photos. Exact source photos, current stock and seller identity must be verified; do not infer aliases from similar material names or invent prices/quantities. The configured TradeScout seller setting is general.exchange_stone_retail_seller_user_id; the stable dedicated metrics key is STONE_METRICS_SECRET. Neither was configured in production here. Calls/quotes/payments still require their actual authoritative evidence hooks and a matched observed Facebook baseline.

Full repository/dependency checkout remained unavailable through sandbox DNS in this run; connected GitHub and Neon worked. Do not repeat broad discovery or treat that as permission to claim unexecuted full release tests.

## External side effects and retry safety
Only this isolated feature branch/PR is changed. Native test transactions wrote temporary synthetic fixtures and rolled them back. No new project/branch/service, no main merge/deployment, no persistent database rows, no object-store upload, no supplier-price modification or customer contact. No new GitHub workflow. The earlier blocked bulk tree request was not retried.

## Next exact action
Resume after this schema integration, not from the older detached helpers. Continue canonical national catalog/discovery and reviewed media/import integration while preserving the actual listing screen and atomic inquiry owner. Keep price publication held until explicit approved selling prices exist, but do not let that stop independent catalog wiring. Verify TradeScout seller identity and photo mapping, then test the complete authenticated inquiry route on the actual PostgreSQL application schema with concurrent processes and lost responses. Reconcile migration numbering against current main only at integration, preserve both histories, and run full exact-candidate release gates before merge.

Actions that must NOT be repeated: re-create migrations or re-run unchanged temporary SQL proof without a relevant code change; overwrite old journal entries; replay historic migrations blindly; broaden Pensacola; gate retail viewing by fabricator membership; invent prices, stock, leads or connected calls; create GitHub Actions/proof infrastructure; publish the private supplier workbook; or present this draft as live Facebook outperformance.
