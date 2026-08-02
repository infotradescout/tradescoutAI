# JW Stone recommendation compatibility rollback

## Scope and invariants

Migration `0113_jw_stone_recommendation_compatibility_target` may create one
legacy `contractors` row so the existing moderated recommendation ledger can
target the published JW Stone business profile. The row is a compatibility
adapter only. It is inactive, unverified, has no `user_id`, and grants no
provider-directory, county-routing, Trust/CVS, exposure, or contact authority.

The only allowed identity tuple is:

- profile: `8802a941-f082-45c6-b0d3-da6c484d79da` / `jw-stone`
- owner: `d61a5be3-d0ba-402b-afe3-47f994787c00`
- business: `3cbfd44b-59c5-4d08-8106-1a58b7746966`
- compatibility contractor: `bb6a45da-7730-4870-85d4-5cb0b8e0f5d6`

The obsolete `0112_jw_stone_contractor_business_binding.sql` file began as an
unjournaled draft, but it was briefly listed at journal index `116` on `main`
before this repair replaced that entry. It has been removed from the executable
migration directory and remains recoverable from Git history. Before release,
inspect the intended database ledger and contractor rows to prove that the
obsolete migration was not recorded or applied. If it was, stop and assess the
existing binding instead of assuming a clean first deployment. Do not restore,
journal, or execute the obsolete file; `0113` is the sole canonical JW Stone
compatibility migration.

## Pre-deploy conflict check

Run this against the intended database before applying `0113`:

```sql
SELECT
  id,
  user_id,
  business_id,
  slug,
  is_active,
  verified_licensed,
  verified_insured,
  is_general_contractor,
  is_residential_contractor,
  accepts_subcontract_work
FROM contractors
WHERE id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6'
   OR slug = 'jw-stone'
   OR business_id = '3cbfd44b-59c5-4d08-8106-1a58b7746966';
```

The first deployment must return zero rows. A later inspection may return only
the exact inert adapter described above. Any other row or duplicate is a
release hold: investigate it instead of editing, deleting, or reassigning it.

After migration, confirm that all six authority/exposure flags are `false`,
`user_id` is `NULL`, and the IDs and slug exactly match the tuple above.

## Application rollback

Rolling application code back does not require deleting the adapter. Older
code ignores a contractor without an owning user, and the adapter remains
inactive and unverified. Leaving it in place is the lowest-risk rollback when
recommendations reference it.

Do not delete or edit the Drizzle migration ledger entry or hash. Once `0113`
has been recorded, it must remain recorded even if the data row is later
removed; the migration will not and should not rerun automatically.

## Mandatory write drain before optional cleanup

`public.recommendations.contractor_id` does not have a foreign key to
`public.contractors`.
Deleting the adapter while any writer can still insert a recommendation can
therefore create an orphan. A table lock protects only the cleanup transaction;
a writer queued behind that lock could resume after `COMMIT` and insert the
orphan. The application write drain is mandatory, not advisory.

Before cleanup, all of the following must be true:

1. Owner approval and a current, restorable database backup are recorded.
2. A verified server-side deny rejects the compatibility contractor ID before
   storage on both current write routes, `POST /api/recommendations` and
   `POST /api/contractors/:contractorId/recommendations`, plus any administrative
   or import path. A rolled-back UI that merely stops resolving the ID, or hides
   the Recommend button, is not a write barrier. Without that deny, do not delete
   the adapter; leave the inert row in place.
3. Every web process, worker, administrative tool, import, and direct database
   client capable of writing `recommendations` is stopped or placed behind a
   confirmed server-side write deny. Drain in-flight recommendation requests
   and transactions. A cosmetic maintenance-mode page alone is insufficient.
4. The write deny remains in place until the cleanup transaction commits and
   both post-cleanup counts return zero. Do not re-enable a version that can
   submit the deleted compatibility contractor ID.

From the same production database used for cleanup, list other client sessions:

```sql
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  xact_start,
  query_start
FROM pg_catalog.pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND backend_type = 'client backend'
ORDER BY xact_start NULLS LAST, query_start NULLS LAST;
```

The operator must account for every application-role session and confirm that
no application writer or in-flight writer transaction remains. If that cannot
be proved, stop. Do not terminate an unknown session merely to make this query
empty.

## Optional data cleanup

After the mandatory write drain, inspect the current dependency set:

```sql
SELECT id, moderation_status, is_public, created_at
FROM public.recommendations
WHERE contractor_id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6';
```

If this returns any row, stop. Retain the inert adapter so recommendation data
is not orphaned. Re-homing, archiving, or deleting recommendation records needs
a separate reviewed migration and retention decision.

If it returns zero rows and cleanup is explicitly approved, run the checked-in
manual cleanup script from the repository root with the write drain still in
place:

```powershell
psql "$env:DATABASE_URL" -X --set=ON_ERROR_STOP=1 --file ".\docs\runbooks\JW_STONE_RECOMMENDATION_COMPATIBILITY_CLEANUP.sql"
```

The script is deliberately outside `migrations/` and must never be journaled or
run automatically. It performs these operations in one transaction:

1. Sets bounded lock and statement timeouts.
2. Acquires `SHARE ROW EXCLUSIVE` on `public.recommendations`. PostgreSQL
   recommendation inserts take `ROW EXCLUSIVE`, which conflicts with this lock.
   A writer that finishes before lock acquisition is included in the dependency
   recheck; a writer that remains active causes the bounded lock wait to fail.
   The mandatory drain prevents new writers from queuing behind the cleanup.
3. Rechecks recommendation dependencies after the lock is held.
4. Row-locks exactly one contractor matching the complete inert adapter shape.
5. Deletes that row and raises an exception unless exactly one row was deleted.

Any exception leaves the transaction aborted; `ON_ERROR_STOP` exits `psql`
without reaching `COMMIT`. Do not retry by weakening a predicate or increasing
the timeout. Investigate the dependency, shape drift, or undrained writer.

Successful output includes one deletion notice followed by these exact
post-commit counts:

```sql
 adapter_rows | recommendation_rows
--------------+---------------------
            0 |                   0
```

Keep the write drain active while independently rerunning both count queries.
Zero adapter rows with any recommendation row is a release incident: keep
writes disabled and investigate. Only after both counts remain zero and the
server-side deny is proven to reject the deleted ID on every write path may
normal traffic resume.

## Post-change proof

For deployment or rollback, record all of the following:

1. Drizzle journal contract and the applied `0113` hash.
2. The exact adapter-row query result, or the approved cleanup receipt including
   the write-drain window, operator, backup reference, and zero/zero post-check.
3. JW Stone `GET /api/u/jw-stone/trust-actions` target state.
4. A signed-in, non-owner Recommend submission remaining pending/non-public.
5. Provider-directory and Direct Connect searches proving the inactive adapter
   is not exposed or routable.
6. Contact-gate proof showing visibility still grants no contact access.

Database, browser, and production checks are required release evidence; local
contract tests alone do not prove the live migration or user flow.
