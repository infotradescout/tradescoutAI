-- Profile website layer

DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('draft', 'published');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id varchar REFERENCES businesses(id) ON DELETE SET NULL,
  role_context user_role NOT NULL,
  slug varchar NOT NULL UNIQUE,
  display_name varchar NOT NULL,
  headline varchar,
  content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  status profile_status NOT NULL DEFAULT 'draft',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_owner_idx ON profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS profile_business_idx ON profiles(business_id);
CREATE INDEX IF NOT EXISTS profile_role_ctx_idx ON profiles(role_context);
CREATE INDEX IF NOT EXISTS profile_status_idx ON profiles(status);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_profile_id varchar;
