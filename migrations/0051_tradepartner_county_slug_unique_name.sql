-- Drizzle expects a specific unique constraint name for tradepartner_county_pages.county_slug.
-- Keep the existing uniqueness but align the constraint name to avoid db:push prompts.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tradepartner_county_pages_county_slug_unique'
      AND conrelid = 'tradepartner_county_pages'::regclass
  ) AND EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tradepartner_county_pages_county_slug_key'
      AND conrelid = 'tradepartner_county_pages'::regclass
  ) THEN
    ALTER TABLE tradepartner_county_pages
      RENAME CONSTRAINT tradepartner_county_pages_county_slug_key
      TO tradepartner_county_pages_county_slug_unique;
  END IF;
END $$;

