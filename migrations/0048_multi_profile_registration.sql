-- Multi-profile registration support (safe + idempotent)

DO $$ BEGIN
  CREATE TYPE user_intent AS ENUM ('person', 'business');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE profile_business_type AS ENUM ('service_provider', 'seller');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE profile_visibility AS ENUM ('private', 'discoverable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE seller_type AS ENUM ('physical', 'online', 'hybrid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_visibility profile_visibility DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS verified_badge boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 10;

CREATE TABLE IF NOT EXISTS user_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_intent user_intent NOT NULL,
  profile_business_type profile_business_type,
  service_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  seller_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  seller_type seller_type,
  role user_role NOT NULL DEFAULT 'homeowner',
  roles text[] NOT NULL DEFAULT ARRAY[]::text[],
  profile_visibility profile_visibility DEFAULT 'private',
  verified_badge boolean DEFAULT false,
  trust_score integer DEFAULT 10,
  verification_requirements jsonb DEFAULT '{}'::jsonb,
  verification_status verification_status DEFAULT 'pending',
  email_verified boolean DEFAULT false,
  address_verified boolean DEFAULT false,
  license_verified boolean DEFAULT false,
  insurance_verified boolean DEFAULT false,
  tax_id_verified boolean DEFAULT false,
  business_registration_verified boolean DEFAULT false,
  is_primary boolean DEFAULT false,
  display_name varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_user_idx ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS user_profiles_visibility_idx ON user_profiles(profile_visibility);
CREATE INDEX IF NOT EXISTS user_profiles_primary_idx ON user_profiles(is_primary);
CREATE INDEX IF NOT EXISTS user_profiles_intent_idx ON user_profiles(user_intent);
