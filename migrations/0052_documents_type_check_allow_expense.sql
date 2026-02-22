-- Idempotent documents.type CHECK constraint update to include EXPENSE.
-- This is safe to run in production where migrations may have been partially applied.

DO $$
DECLARE
  cname text;
BEGIN
  -- Drop the common name first (safe if absent).
  ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

  -- Drop any remaining "type IN (...)" style check constraints.
  FOR cname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'documents'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%check%'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
      AND pg_get_constraintdef(oid) ILIKE '%in%'
  LOOP
    EXECUTE format('ALTER TABLE documents DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;

  -- Recreate with the extended set of allowed types.
  ALTER TABLE documents
    ADD CONSTRAINT documents_type_check
    CHECK (type IN (
      'MATERIAL_LIST',
      'ESTIMATE',
      'CONTRACT',
      'INVOICE',
      'RECEIPT',
      'EXPENSE'
    ));
END $$;

