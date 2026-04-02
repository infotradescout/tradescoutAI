-- Identity verification for basic users (ID + address).
-- Stores only a private object key; no public URL is ever exposed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'identity_verification_status') THEN
    CREATE TYPE identity_verification_status AS ENUM (
      'pending',
      'submitted',
      'approved',
      'rejected',
      'expired'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'identity_document_type') THEN
    CREATE TYPE identity_document_type AS ENUM (
      'drivers_license',
      'passport',
      'state_id'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS identity_verifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  document_type identity_document_type NOT NULL,
  object_key varchar NOT NULL,

  status identity_verification_status NOT NULL DEFAULT 'pending',
  submitted_at timestamp,
  reviewed_by varchar,
  reviewed_at timestamp,
  rejection_reason text,
  admin_notes text,

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_verifications_user
  ON identity_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_status_created
  ON identity_verifications(status, created_at DESC);

