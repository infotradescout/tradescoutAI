CREATE TABLE IF NOT EXISTS inspection_requirement_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_fips TEXT NOT NULL,
  state_code TEXT,
  surface TEXT NOT NULL,
  mode TEXT NOT NULL,
  knowledge_key TEXT NOT NULL DEFAULT 'regulatory_requirements',
  requirements_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_priority TEXT NOT NULL DEFAULT 'first_party',
  source_case_id UUID REFERENCES inspection_cases(id) ON DELETE SET NULL,
  confidence_tier TEXT NOT NULL DEFAULT 'B',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inspection_requirement_cache_scope
  ON inspection_requirement_cache(county_fips, COALESCE(state_code, ''), surface, mode, knowledge_key);

CREATE INDEX IF NOT EXISTS idx_inspection_requirement_cache_lookup
  ON inspection_requirement_cache(county_fips, state_code, surface, mode, expires_at DESC);
