-- Canonical provider binding for race-safe work-request assignment creation.
-- Existing rows remain nullable; every current writer supplies provider_key.

ALTER TABLE work_request_assignments
  ADD COLUMN IF NOT EXISTS provider_key varchar(320);

CREATE UNIQUE INDEX IF NOT EXISTS work_request_assignments_request_provider_key_unique
  ON work_request_assignments(work_request_id, provider_key)
  WHERE provider_key IS NOT NULL;
