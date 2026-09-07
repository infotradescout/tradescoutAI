# Database migration and recovery

## Supported outcomes

`npm run db:migrate` executes the normal migration command and then independently runs the complete required-schema verifier. Both must pass. A SQL-runner exit code of zero is not sufficient evidence of compatibility.

A new or incomplete database either completes the supported migration path and passes verification, or exits nonzero with the missing prerequisites. Automatic baseline stamping and retry are removed. `npm run db:baseline` refuses without connecting because its historical implementation recorded the newest migration without executing it.

The current historical migration chain is not a replacement for an approved base-schema bootstrap. Do not call a prepared test fixture proof a successful empty-database bootstrap.

## Inspect before recovering

1. Confirm the intended database, a recoverable backup, and the approved change boundary. Production data recovery is not authorized merely because an application release was approved.
2. Run the required-schema verifier and inspect the existing ledger. Preserve evidence of missing objects, constraints, triggers, indexes, and migration identities.
3. For an empty database, establish the approved base schema first. Required migrations depend on core tables including `users`, `businesses`, `user_profiles`, and `profiles`. The list below is not a complete bootstrap recipe.
4. For an existing schema with earlier journal gaps, `npm run db:migrate:fill-gaps -- --dry-run` produces a read-only plan. It must not create schemas, tables, or ledger rows. No compatibility claim follows from a successful preview.
5. Review every planned migration against the actual current schema and recorded successors before executing recovery. A duplicate object is not proof that the remaining SQL ran.

## Canonical order and successor boundaries

Required-schema recovery may include these committed SQL files, in journal order:

- `0072_seo_publication_rules_and_freshness.sql`
- `0115_profile_accounts.sql`
- `0116_admin_live_stream_snapshots.sql`
- `0117_managed_partner_intakes.sql`
- `0118_profile_account_public_routes.sql`
- `0129_restore_profile_account_identity_contract.sql`
- `0130_business_managed_partner_contact.sql`
- `0131_preserve_jw_stone_pricing_revocation.sql`

Keep the full current definitions, not only names or comments. In particular:

- 0115 restores older path constraints; 0118 is the public-route successor.
- 0123 replaced identity logic; 0129 restores the canonical ownership checks.
- 0117 restores older managed-contact rules; 0130 is their successor.
- 0118 includes verification/entitlement backfills; 0131 protects current JW membership revocations. Blindly replaying 0118 over an existing 0131 database can erase current decisions before a later SQL file repairs the function.

Gap recovery therefore refuses, before applying SQL or modifying the ledger, when an older missing migration would overwrite one of these already recorded successors. It does not guess that all earlier SQL ran, nor automatically replay data backfills. Reconciliation across this boundary requires an explicitly reviewed transaction that preserves existing entitlement decisions, restores all affected current definitions, validates them, and commits only after those checks pass. An interrupted or repeated attempt must not downgrade the current rules.

On a fresh disposable fixture without those existing decisions, execute the applicable canonical sequence in order. After replaying 0115, applying only the old diagnostic list without 0118 is insufficient.

## Executing a reviewed gap plan

`npm run db:migrate:fill-gaps` checks hashes rather than the latest timestamp. It holds a recovery lock, applies each migration transactionally, and records its identity only after every SQL statement in that migration succeeds. A failed migration is rolled back, left unrecorded, and reported as failure. A later retry can skip earlier completed SQL by its actual identity.

The runner accepts both LF and CRLF identities. Do not rewrite historical SQL or its hashes to make a ledger match.

`--mark-already-applied` is no longer accepted. One duplicate table, column, constraint, or row cannot prove a complete migration. Do not insert a missing hash by hand. Do not prune ledger rows merely to make counts look equal; retain historical evidence until any separate ledger reconciliation has been reviewed.

After a reviewed recovery, rerun `npm run db:migrate` and `npm run db:verify:required`. Keep the verifier intact. The gap runner also requires full required-schema verification before reporting successful execution.

## Disposable test evidence

The native regression command is `node scripts/tests/database-bootstrap.native.mjs`. It requires an explicitly supplied `EMBEDDED_POSTGRES_MODULE` pointing to a separately installed native PostgreSQL test dependency. It creates its own loopback-only cluster and unique disposable databases; it does not accept a production database target. `DB598_FULL_RELEASE=1` additionally runs the unchanged minimum release contract and separate browser proof.

Evidence distinguishes the unchanged historical empty-database rejection from a prepared-schema compatibility fixture and focused canonical recovery-journal tests. The guarded `db:bootstrap:test -- --full-sync` is test-only, with `ALLOW_TEST_DB_FULL_SYNC=true`; never use full schema push on a real database.

## Production release boundary

Production remains Docker with `npm run db:migrate && npm run db:verify:required` before traffic moves and `/api/health` afterward. Do not remove those checks to recover a failed deploy. The previous healthy release must remain available until the new image passes. No GitHub Actions are required or introduced.
