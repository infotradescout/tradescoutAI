-- Contractor starter path support
ALTER TABLE contractor_applications
  ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS starter_path BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_contractor_applications_user ON contractor_applications(user_id);
