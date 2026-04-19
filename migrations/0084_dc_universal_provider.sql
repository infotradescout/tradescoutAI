-- Direct Connect: universal provider routing.
-- Adds responder_user_id to work_request_assignments so any user (business owner,
-- helper, handyman, service_provider, etc.) can be an assignment target — not just
-- rows in the contractors table.
-- The existing contractor_id column is kept for backward compatibility and will be
-- populated for contractor-profile holders alongside responder_user_id.

ALTER TABLE work_request_assignments
  ADD COLUMN IF NOT EXISTS responder_user_id varchar REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wra_responder_user_id
  ON work_request_assignments(responder_user_id);

-- Employment post applications: workers/helpers apply to job posts.
CREATE TABLE IF NOT EXISTS employment_post_applications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  post_id varchar NOT NULL REFERENCES employment_posts(id) ON DELETE CASCADE,
  applicant_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text,
  status varchar(32) NOT NULL DEFAULT 'pending',
  -- 'pending' | 'shortlisted' | 'rejected' | 'withdrawn'
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (post_id, applicant_user_id)
);

CREATE INDEX IF NOT EXISTS idx_epa_post_id
  ON employment_post_applications(post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_epa_applicant
  ON employment_post_applications(applicant_user_id, created_at DESC);
