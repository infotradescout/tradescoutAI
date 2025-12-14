-- Business Profiles as first-class entities

DO $$ BEGIN
  CREATE TYPE business_type AS ENUM ('contractor', 'community', 'vendor', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE business_status AS ENUM ('draft', 'active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS businesses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  slug varchar NOT NULL UNIQUE,
  type business_type NOT NULL DEFAULT 'other',
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_context user_role NOT NULL,
  profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status business_status NOT NULL DEFAULT 'draft',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_owner_idx ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS business_role_ctx_idx ON businesses(role_context);
CREATE INDEX IF NOT EXISTS business_status_idx ON businesses(status);

CREATE TABLE IF NOT EXISTS business_counties (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  county_id varchar NOT NULL REFERENCES counties(id),
  created_at timestamp DEFAULT now(),
  CONSTRAINT business_county_unique UNIQUE (business_id, county_id)
);

CREATE INDEX IF NOT EXISTS business_counties_business_idx ON business_counties(business_id);
CREATE INDEX IF NOT EXISTS business_counties_county_idx ON business_counties(county_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_business_id varchar;

ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS business_id varchar;
