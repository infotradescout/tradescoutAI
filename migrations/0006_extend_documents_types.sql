-- Extend allowed document types to support new accounting entries (e.g. EXPENSE)

DO $$
DECLARE
  cname text;
  type_attnum smallint;
BEGIN
  -- PostgreSQL normalizes an inline `type IN (...)` check to an ANY(array)
  -- expression, so matching the rendered constraint text is not reliable.
  -- Find the column by attnum and remove only checks that depend on it.
  SELECT attnum
  INTO type_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.documents'::regclass
    AND attname = 'type'
    AND NOT attisdropped;

  FOR cname IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.documents'::regclass
      AND contype = 'c'
      AND type_attnum = ANY (conkey)
  LOOP
    EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT %I', cname);
  END LOOP;

  -- Recreate the CHECK constraint with the extended set of allowed types.
  -- Keep existing types and add EXPENSE for standalone accounting expenses.
  ALTER TABLE public.documents
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
