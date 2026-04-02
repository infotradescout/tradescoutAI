-- Home Projects (Home Vault)
-- Purpose: allow a homeowner to start a project tied to a home, track planning state,
-- and optionally create a savings/funding plan when budget is not available yet.
-- Notes:
-- - Does not grant contact authority; routing/contact stays gated through Scout.
-- - Financial planning here is informational; no lead selling or pay-to-play.

CREATE TABLE IF NOT EXISTS home_projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_home_id VARCHAR NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,

  title VARCHAR NOT NULL,
  description TEXT,
  project_type VARCHAR,

  status VARCHAR NOT NULL DEFAULT 'planning', -- planning | saving | ready | in_progress | completed | paused | canceled

  estimated_cost NUMERIC(14,2),
  desired_start_at DATE,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_projects_owner ON home_projects(owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_home_projects_home ON home_projects(user_home_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_home_projects_status ON home_projects(status, updated_at);

CREATE TABLE IF NOT EXISTS home_project_plans (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  home_project_id VARCHAR NOT NULL REFERENCES home_projects(id) ON DELETE CASCADE,

  plan_type VARCHAR NOT NULL DEFAULT 'savings', -- savings | funding
  target_amount NUMERIC(14,2) NOT NULL,
  current_saved NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_by DATE,
  monthly_contribution NUMERIC(14,2),
  funding_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_project_plans_owner ON home_project_plans(owner_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_home_project_plans_project ON home_project_plans(home_project_id, updated_at);

