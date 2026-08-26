-- Cross-instance-safe Scout verification-document assignment state.

CREATE TABLE IF NOT EXISTS scout_file_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  verification_document_id varchar NOT NULL
    REFERENCES verification_documents(id) ON DELETE CASCADE,
  county_fips varchar(5) NOT NULL
    REFERENCES counties(fips) ON DELETE RESTRICT,
  assigned_by varchar NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  notes text,
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scout_file_assignments_active_document
  ON scout_file_assignments (verification_document_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_scout_file_assignments_county_updated
  ON scout_file_assignments (county_fips, updated_at DESC);

CREATE TABLE IF NOT EXISTS scout_file_assignment_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  assignment_id varchar NOT NULL
    REFERENCES scout_file_assignments(id) ON DELETE CASCADE,
  verification_document_id varchar NOT NULL
    REFERENCES verification_documents(id) ON DELETE CASCADE,
  event_type varchar(16) NOT NULL
    CHECK (event_type IN ('assigned', 'moved', 'unassigned')),
  from_county_fips varchar(5),
  to_county_fips varchar(5),
  actor_user_id varchar NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_file_assignment_events_created
  ON scout_file_assignment_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scout_file_assignment_events_county_created
  ON scout_file_assignment_events (to_county_fips, created_at DESC);

CREATE TABLE IF NOT EXISTS scout_file_assignment_batches (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  county_fips varchar(5) NOT NULL
    REFERENCES counties(fips) ON DELETE RESTRICT,
  assigned_by varchar NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  file_ids jsonb NOT NULL,
  status varchar(16) NOT NULL
    CHECK (status IN ('processing', 'completed', 'failed')),
  results jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_scout_file_assignment_batches_created
  ON scout_file_assignment_batches (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scout_file_assignment_batches_county_created
  ON scout_file_assignment_batches (county_fips, created_at DESC);
