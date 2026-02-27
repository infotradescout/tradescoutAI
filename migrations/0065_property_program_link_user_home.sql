-- Link Property Lifecycle OS programs to private Home Vault homes where applicable.

ALTER TABLE property_programs
  ADD COLUMN IF NOT EXISTS user_home_id varchar REFERENCES user_homes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_property_programs_user_home_id ON property_programs(user_home_id);
