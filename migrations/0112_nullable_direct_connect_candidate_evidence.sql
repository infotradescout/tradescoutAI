-- Unknown Direct Connect candidate evidence must remain unknown. A false value
-- means the platform measured a non-match; it must not be used as a substitute
-- for missing verification, category, territory, or contact evidence.
ALTER TABLE IF EXISTS direct_connect_dispatch_candidates
  ALTER COLUMN territory_matched DROP NOT NULL,
  ALTER COLUMN territory_matched DROP DEFAULT,
  ALTER COLUMN category_matched DROP NOT NULL,
  ALTER COLUMN category_matched DROP DEFAULT,
  ALTER COLUMN contact_eligibility DROP NOT NULL,
  ALTER COLUMN contact_eligibility DROP DEFAULT;
