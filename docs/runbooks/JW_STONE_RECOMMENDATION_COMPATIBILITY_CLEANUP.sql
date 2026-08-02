-- MANUAL, DESTRUCTIVE ROLLBACK CLEANUP. NEVER ADD THIS FILE TO THE MIGRATION JOURNAL.
--
-- Required before execution:
--   * owner approval and a current restorable backup;
--   * a server-side deny rejects contractor bb6a45da-7730-4870-85d4-5cb0b8e0f5d6
--     on every recommendation write path before storage;
--   * every recommendation writer is stopped and all in-flight writes are drained;
--   * the write drain will remain active through the post-commit checks below.
--
-- Run from the repository root with psql. ON_ERROR_STOP ensures that any
-- timeout or raised invariant failure exits before the explicit COMMIT.
\set ON_ERROR_STOP on

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- INSERT/UPDATE/DELETE on recommendations take ROW EXCLUSIVE. This conflicting
-- lock must be held before the dependency recheck and through the adapter delete.
LOCK TABLE public.recommendations IN SHARE ROW EXCLUSIVE MODE;

DO $jw_stone_cleanup$
DECLARE
  dependency_count bigint;
  adapter_id varchar;
  deleted_count integer;
BEGIN
  SELECT count(*)
    INTO dependency_count
  FROM public.recommendations
  WHERE contractor_id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6';

  IF dependency_count <> 0 THEN
    RAISE EXCEPTION
      'JW Stone adapter cleanup refused: % recommendation dependency row(s) exist',
      dependency_count;
  END IF;

  SELECT id
    INTO adapter_id
  FROM public.contractors
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
  FOR UPDATE;

  IF adapter_id IS NULL THEN
    RAISE EXCEPTION
      'JW Stone adapter cleanup refused: the one exact inert adapter was not found';
  END IF;

  DELETE FROM public.contractors
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
    AND NOT EXISTS (
      SELECT 1
      FROM public.recommendations
      WHERE contractor_id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6'
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 1 THEN
    RAISE EXCEPTION
      'JW Stone adapter cleanup refused: expected one deletion, deleted %',
      deleted_count;
  END IF;

  RAISE NOTICE 'Deleted the one exact inert JW Stone recommendation adapter';
END
$jw_stone_cleanup$;

COMMIT;

-- Keep every writer drained until both values are confirmed as zero.
SELECT
  (
    SELECT count(*)
    FROM public.contractors
    WHERE id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6'
  ) AS adapter_rows,
  (
    SELECT count(*)
    FROM public.recommendations
    WHERE contractor_id = 'bb6a45da-7730-4870-85d4-5cb0b8e0f5d6'
  ) AS recommendation_rows;
