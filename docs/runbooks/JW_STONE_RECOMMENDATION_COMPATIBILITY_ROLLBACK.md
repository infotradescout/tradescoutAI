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

The obsolete `0112_jw_stone_contractor_business_binding.sql` file was never
listed in the Drizzle journal. It was removed from the executable migration
directory and remains recoverable from Git history. Do not restore, journal,
or execute it; `0113` is the sole canonical JW Stone compatibility migration.

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

## Optional data cleanup

Data cleanup is destructive and requires owner approval plus a current backup.
First prove that no recommendation depends on the adapter:

```sql
SELECT id, moderation_status, is_public, created_at
FROM recommendations
WHERE contractor_id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6';
```

If this returns any row, stop. Retain the inert adapter so recommendation data
is not orphaned. Re-homing, archiving, or deleting recommendation records needs
a separate reviewed migration and retention decision.

If it returns zero rows and cleanup is explicitly approved, delete only the
exact inert shape in one transaction:

```sql
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM recommendations
    WHERE contractor_id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6'
  ) THEN
    RAISE EXCEPTION 'JW Stone adapter still has recommendation dependencies';
  END IF;
END $$;

DELETE FROM contractors
WHERE id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6'
  AND user_id IS NULL
  AND business_id = '3cbfd44b-59c5-4d08-8106-1a58b7746966'
  AND slug = 'jw-stone'
  AND is_active = FALSE
  AND verified_licensed = FALSE
  AND verified_insured = FALSE
  AND is_general_contractor = FALSE
  AND is_residential_contractor = FALSE
  AND accepts_subcontract_work = FALSE
RETURNING id;

COMMIT;
```

Require exactly one returned ID. Zero rows means the stored shape drifted and
must be investigated; do not broaden the predicate. More than one row is
impossible for the primary key and indicates a deeper integrity problem.

## Post-change proof

For deployment or rollback, record all of the following:

1. Drizzle journal contract and the applied `0113` hash.
2. The exact adapter-row query result, or the approved cleanup receipt.
3. JW Stone `GET /api/u/jw-stone/trust-actions` target state.
4. A signed-in, non-owner Recommend submission remaining pending/non-public.
5. Provider-directory and Direct Connect searches proving the inactive adapter
   is not exposed or routable.
6. Contact-gate proof showing visibility still grants no contact access.

Database, browser, and production checks are required release evidence; local
contract tests alone do not prove the live migration or user flow.
