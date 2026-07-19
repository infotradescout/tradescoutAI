-- Keep the contractor promotion request counter aligned with the canonical
-- Drizzle schema. Preserve the legacy lead_count column for compatibility
-- while carrying its existing value into the new counter once.

ALTER TABLE contractor_promos
  ADD COLUMN IF NOT EXISTS project_request_count INTEGER DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contractor_promos'
      AND column_name = 'lead_count'
  ) THEN
    EXECUTE '
      UPDATE contractor_promos
      SET project_request_count = lead_count
      WHERE COALESCE(project_request_count, 0) = 0
        AND lead_count IS NOT NULL
        AND lead_count <> 0
    ';
  END IF;
END
$$;
