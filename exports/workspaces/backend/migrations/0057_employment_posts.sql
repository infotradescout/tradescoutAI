-- Employment board: county-scoped hiring posts + resumes.
-- Contact is never stored/exposed here; all contact remains Scout/Decision Card gated.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_post_type') THEN
    CREATE TYPE employment_post_type AS ENUM (
      'job',
      'resume'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_post_status') THEN
    CREATE TYPE employment_post_status AS ENUM (
      'open',
      'closed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employment_posts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  created_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  post_type employment_post_type NOT NULL,
  status employment_post_status NOT NULL DEFAULT 'open',

  title varchar(140) NOT NULL,
  body text NOT NULL,

  -- Operational container (county-first)
  county_fips varchar(5) NOT NULL,
  state_code varchar(2),
  city varchar(80),

  -- Optional routing tag (reuses existing trade slugs)
  trade_id varchar(80),

  -- Optional pay band (no contact details)
  pay_min numeric(14,2),
  pay_max numeric(14,2),
  pay_unit varchar(16), -- 'hour' | 'year' | 'month' | 'project' (soft enum)

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employment_posts_county_type_created
  ON employment_posts(county_fips, post_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employment_posts_status_created
  ON employment_posts(status, created_at DESC);

