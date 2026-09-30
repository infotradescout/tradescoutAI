-- Draft-only TradeScout presence plans. No provider or profile mutation is performed.
CREATE TABLE business_presence_plans (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  profile_id varchar NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  evidence_digest varchar(64) NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
  plan_hash varchar(64) NOT NULL CHECK (plan_hash ~ '^[a-f0-9]{64}$'),
  plan jsonb NOT NULL CHECK (jsonb_typeof(plan) = 'object'),
  site_path varchar(32) CHECK (site_path IN ('hosted_new', 'preserve_migrate', 'keep_external')),
  site_path_selected_by varchar REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_presence_plan_review_consistency CHECK (
    (site_path IS NULL AND site_path_selected_by IS NULL AND reviewed_at IS NULL)
    OR
    (site_path IS NOT NULL AND site_path_selected_by = owner_user_id AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT business_presence_plan_owner_business_uq UNIQUE (owner_user_id, business_id)
);
CREATE INDEX business_presence_plan_profile_idx ON business_presence_plans (profile_id);
