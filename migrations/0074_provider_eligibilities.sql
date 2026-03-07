-- Canonical provider legal envelope.
-- Separates legal authority from declared service areas so routing stays explainable.

CREATE TABLE IF NOT EXISTS provider_eligibilities (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jurisdiction_type varchar NOT NULL CHECK (jurisdiction_type IN ('state', 'county')),
  eligibility_basis varchar NOT NULL CHECK (
    eligibility_basis IN ('state_license', 'county_license', 'verified_exception')
  ),
  verification_status varchar NOT NULL DEFAULT 'approved' CHECK (
    verification_status IN ('pending', 'approved', 'rejected', 'expired')
  ),
  state_code varchar(2),
  county_fips varchar(5) REFERENCES counties(fips) ON DELETE CASCADE,
  evidence_note text,
  expires_at timestamptz,
  verified_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_eligibilities_scope_check CHECK (
    (jurisdiction_type = 'state' AND state_code IS NOT NULL)
    OR (jurisdiction_type = 'county' AND county_fips IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_provider_eligibilities_provider
  ON provider_eligibilities(provider_user_id);

CREATE INDEX IF NOT EXISTS idx_provider_eligibilities_state
  ON provider_eligibilities(state_code);

CREATE INDEX IF NOT EXISTS idx_provider_eligibilities_county
  ON provider_eligibilities(county_fips);

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_eligibility_scope
  ON provider_eligibilities(provider_user_id, jurisdiction_type, state_code, county_fips, eligibility_basis);