-- Preferred Source Prompt: Track completed actions and eligibility
-- Organic Google gravity earned through real value delivery

-- User completed actions log (append-only)
CREATE TABLE IF NOT EXISTS user_completed_actions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  action_type varchar(120) NOT NULL,
  source varchar(20) NOT NULL CHECK (source IN ('scout', 'ui', 'system')),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_completed_actions_user_idx ON user_completed_actions(user_id);
CREATE INDEX IF NOT EXISTS user_completed_actions_created_idx ON user_completed_actions(created_at);

-- Add preferred source prompt tracking to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_source_prompt_shown_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS preferred_source_prompt_accepted_at timestamp with time zone;
