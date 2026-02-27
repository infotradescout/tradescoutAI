-- Home Maintenance Schedules (Home Vault)
-- Purpose: recurring maintenance tasks tied to a user's private home vault entry.
-- Notes:
-- - Does not grant contact authority; provider sync is opt-in via share flags.
-- - Address sharing is off by default.

CREATE TABLE IF NOT EXISTS home_maintenance_schedules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_home_id VARCHAR NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,

  title VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR,

  cadence_days INT NOT NULL DEFAULT 30,
  next_due_at TIMESTAMP NOT NULL,
  last_completed_at TIMESTAMP,

  status VARCHAR NOT NULL DEFAULT 'active', -- active | paused | archived

  assigned_business_id VARCHAR REFERENCES businesses(id) ON DELETE SET NULL,
  share_with_assigned_provider BOOLEAN NOT NULL DEFAULT FALSE,
  share_address BOOLEAN NOT NULL DEFAULT FALSE,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_maint_sched_owner ON home_maintenance_schedules(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_home_maint_sched_home ON home_maintenance_schedules(user_home_id);
CREATE INDEX IF NOT EXISTS idx_home_maint_sched_next_due ON home_maintenance_schedules(next_due_at);
CREATE INDEX IF NOT EXISTS idx_home_maint_sched_assigned_biz ON home_maintenance_schedules(assigned_business_id);

