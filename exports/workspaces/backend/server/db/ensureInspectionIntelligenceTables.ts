import { pool } from "../db";

const DDL = `
CREATE TABLE IF NOT EXISTS inspection_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  county_fips TEXT,
  state_code TEXT,
  surface TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  confidence_tier TEXT,
  listing_id TEXT,
  objective_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_cases_user_created
  ON inspection_cases(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inspection_cases_county_surface
  ON inspection_cases(county_fips, state_code, surface, mode);

CREATE TABLE IF NOT EXISTS inspection_case_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL DEFAULT 'photo',
  capture_order INTEGER NOT NULL DEFAULT 1,
  storage_url TEXT NOT NULL,
  quality_score NUMERIC(6,3),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_case_artifacts_case
  ON inspection_case_artifacts(case_id, capture_order);

CREATE TABLE IF NOT EXISTS inspection_recommendation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES inspection_cases(id) ON DELETE CASCADE,
  source_priority TEXT NOT NULL DEFAULT 'first_party',
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  next_steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  products_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  pros_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  requirements_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_ranges_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_recommendations_case
  ON inspection_recommendation_snapshots(case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inspection_capture_policies (
  mode TEXT PRIMARY KEY,
  min_photos INTEGER NOT NULL DEFAULT 2,
  max_billable_photos INTEGER NOT NULL DEFAULT 6,
  target_confidence_tier TEXT NOT NULL DEFAULT 'B',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureInspectionIntelligenceTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = pool.query(DDL).then(() => undefined).catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
}
