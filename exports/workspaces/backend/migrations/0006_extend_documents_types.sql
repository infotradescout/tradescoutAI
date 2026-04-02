-- Extend allowed document types to support new accounting entries (e.g. EXPENSE)

DO $$
DECLARE
  cname text;
BEGIN
  -- Find any existing CHECK constraint on documents.type and drop it
  SELECT conname
  INTO cname
  FROM pg_constraint
  WHERE conrelid = 'documents'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE 'CHECK (type IN%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE documents DROP CONSTRAINT %I', cname);
  END IF;

  -- Recreate the CHECK constraint with the extended set of allowed types.
  -- Keep existing types and add EXPENSE for standalone accounting expenses.
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

