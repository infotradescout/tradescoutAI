-- Private vehicle vault: users can add one or more vehicles to their account (not public)
-- and keep a Carfax-style record of services, repairs, upgrades, notes, and documents.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_vehicle_record_type') THEN
    CREATE TYPE user_vehicle_record_type AS ENUM (
      'service',
      'repair',
      'upgrade',
      'inspection',
      'accident',
      'note'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_vehicle_document_type') THEN
    CREATE TYPE user_vehicle_document_type AS ENUM (
      'service_report',
      'invoice',
      'receipt',
      'photo',
      'title',
      'other'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_vehicles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  nickname varchar,
  year integer,
  make varchar(80),
  model varchar(120),
  trim varchar(120),
  vin varchar(32),
  mileage integer,

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_vehicles_owner_updated ON user_vehicles(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_vin ON user_vehicles(vin);

CREATE TABLE IF NOT EXISTS user_vehicle_records (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id varchar NOT NULL REFERENCES user_vehicles(id) ON DELETE CASCADE,
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,

  record_type user_vehicle_record_type NOT NULL,
  occurred_at date,
  title varchar NOT NULL,
  details text,
  cost numeric(14,2),
  mileage integer,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_vehicle_records_vehicle_occurred ON user_vehicle_records(vehicle_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_vehicle_records_vehicle_created ON user_vehicle_records(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_vehicle_records_type ON user_vehicle_records(record_type);

-- Attach uploaded files to a vehicle (optionally to a specific record).
-- For privacy, store the object key/path (not a public URL).
CREATE TABLE IF NOT EXISTS user_vehicle_documents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id varchar NOT NULL REFERENCES user_vehicles(id) ON DELETE CASCADE,
  record_id varchar REFERENCES user_vehicle_records(id) ON DELETE SET NULL,
  uploaded_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,

  document_type user_vehicle_document_type NOT NULL DEFAULT 'other',
  object_key varchar NOT NULL,
  original_name varchar,
  content_type varchar,
  bytes bigint,

  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_vehicle_documents_vehicle_created ON user_vehicle_documents(vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_vehicle_documents_record ON user_vehicle_documents(record_id);

