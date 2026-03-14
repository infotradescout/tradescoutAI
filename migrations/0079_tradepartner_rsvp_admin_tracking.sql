ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS submitted_by_user_id TEXT;

ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS attendance_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS attendance_notes TEXT;

ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS checked_in_by_user_id TEXT;

ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tradepartner_rsvp_attendance_status
  ON tradepartner_rsvp_submissions(attendance_status, created_at DESC);
