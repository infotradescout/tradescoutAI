-- Private home vault: users can add one or more homes to their account (not public)
-- and keep a Carfax-style record of inspections, upgrades, improvements, appliances, etc.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_home_record_type') THEN
    CREATE TYPE user_home_record_type AS ENUM (
      'inspection',
      'upgrade',
      'improvement',
      'maintenance',
      'appliance',
      'warranty',
      'note'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_home_document_type') THEN
    CREATE TYPE user_home_document_type AS ENUM (
      'inspection_report',
      'invoice',
      'receipt',
      'photo',
      'manual',
      'permit',
      'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_homes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  nickname varchar,
  property_type varchar,
  year_built integer,

  address1 varchar,
  address2 varchar,
  city varchar,
  state_code varchar(2),
  county_fips varchar(5),
  zip_code varchar,

  home_scout_listing_id varchar REFERENCES home_scout_listings(id) ON DELETE SET NULL,

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_homes_owner_updated ON user_homes(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_homes_listing ON user_homes(home_scout_listing_id);

CREATE TABLE IF NOT EXISTS user_home_records (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  home_id varchar NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,

  record_type user_home_record_type NOT NULL,
  occurred_at date,
  title varchar NOT NULL,
  details text,
  cost numeric(14,2),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_home_records_home_occurred ON user_home_records(home_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_home_records_home_created ON user_home_records(home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_home_records_type ON user_home_records(record_type);

CREATE TABLE IF NOT EXISTS user_home_appliances (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  home_id varchar NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,

  category varchar(64) NOT NULL,
  brand varchar(120),
  model varchar(160),
  serial varchar(160),
  installed_at date,
  notes text,

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_home_appliances_home ON user_home_appliances(home_id);
CREATE INDEX IF NOT EXISTS idx_user_home_appliances_category ON user_home_appliances(category);

-- Attach uploaded files to a home (optionally to a specific record).
-- For privacy, store the object key/path (not a public URL).
CREATE TABLE IF NOT EXISTS user_home_documents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  home_id varchar NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,
  record_id varchar REFERENCES user_home_records(id) ON DELETE SET NULL,
  uploaded_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,

  document_type user_home_document_type NOT NULL DEFAULT 'other',
  object_key varchar NOT NULL,
  original_name varchar,
  content_type varchar,
  bytes bigint,

  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_home_documents_home_created ON user_home_documents(home_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_home_documents_record ON user_home_documents(record_id);

