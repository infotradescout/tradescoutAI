-- Drizzle expects a UNIQUE constraint on users.business_slug (not just a unique index).
-- Reuse the existing unique index when present to avoid rebuilds.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'business_slug'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_business_slug_unique'
      AND conrelid = 'users'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'users'
        AND indexname = 'users_business_slug_unique'
    ) THEN
      ALTER TABLE users
        ADD CONSTRAINT users_business_slug_unique UNIQUE USING INDEX users_business_slug_unique;
    ELSE
      ALTER TABLE users
        ADD CONSTRAINT users_business_slug_unique UNIQUE (business_slug);
    END IF;
  END IF;
END $$;

