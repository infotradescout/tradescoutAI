-- Geographic storage layer: county notes, metrics, and entities

-- County note category enum (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'county_note_category') THEN
    CREATE TYPE county_note_category AS ENUM (
      'affiliate',
      'employee',
      'partner',
      'operations',
      'risk',
      'general'
    );
  END IF;
END$$;

-- County entity enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'county_entity_type') THEN
    CREATE TYPE county_entity_type AS ENUM (
      'affiliate',
      'employee',
      'partner',
      'territory_manager',
      'vendor'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'county_entity_status') THEN
    CREATE TYPE county_entity_status AS ENUM (
      'active',
      'inactive',
      'pending'
    );
  END IF;
END$$;

-- County notes (admin-only operational memory)
CREATE TABLE IF NOT EXISTS county_notes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  county_fips varchar(5) NOT NULL,
  author_user_id varchar NOT NULL REFERENCES users(id),
  category county_note_category NOT NULL DEFAULT 'general',
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS county_notes_fips_idx ON county_notes(county_fips);
CREATE INDEX IF NOT EXISTS county_notes_author_idx ON county_notes(author_user_id);

-- County metrics: computed, replaceable aggregates per county
CREATE TABLE IF NOT EXISTS county_metrics (
  county_fips varchar(5) NOT NULL REFERENCES counties(fips),
  metric_key varchar(64) NOT NULL,
  metric_value numeric(20,4) NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT county_metrics_pk PRIMARY KEY (county_fips, metric_key)
);

CREATE INDEX IF NOT EXISTS county_metrics_fips_idx ON county_metrics(county_fips);

-- County entities: affiliates, employees, partners and other assets per county
CREATE TABLE IF NOT EXISTS county_entities (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  county_fips varchar(5) NOT NULL REFERENCES counties(fips),
  entity_type county_entity_type NOT NULL,
  entity_id varchar,
  label varchar(255),
  status county_entity_status NOT NULL DEFAULT 'active',
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS county_entities_fips_idx ON county_entities(county_fips);
CREATE INDEX IF NOT EXISTS county_entities_type_idx ON county_entities(entity_type);
