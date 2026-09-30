ALTER TABLE business_presence_plans
  ADD COLUMN customer_task_reconciled_revision integer,
  ADD COLUMN customer_task_reconciled_site_path varchar(32);
CREATE INDEX business_presence_plan_customer_task_pending_idx ON business_presence_plans (id)
  WHERE customer_task_reconciled_revision IS DISTINCT FROM revision
     OR customer_task_reconciled_site_path IS DISTINCT FROM site_path;

CREATE TABLE business_presence_customer_tasks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  profile_id varchar NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id varchar NOT NULL REFERENCES business_presence_plans(id) ON DELETE CASCADE,
  plan_hash varchar(64) NOT NULL CHECK (plan_hash ~ '^[a-f0-9]{64}$'),
  evidence_digest varchar(64) NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
  revision integer NOT NULL CHECK (revision > 0),
  kind varchar(32) NOT NULL DEFAULT 'select_site_path' CHECK (kind = 'select_site_path'),
  status varchar(32) NOT NULL DEFAULT 'waiting_customer' CHECK (
    status IN ('waiting_customer', 'retrying', 'resolved', 'stale', 'suppressed', 'terminal_attention')
  ),
  first_wait_at timestamptz NOT NULL,
  reminder_count integer NOT NULL DEFAULT 0 CHECK (reminder_count BETWEEN 0 AND 3),
  last_reminder_at timestamptz,
  next_reminder_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count BETWEEN 0 AND 5),
  retry_at timestamptz,
  last_error_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presence_customer_task_version_uq UNIQUE (owner_user_id, business_id, profile_id, plan_hash, kind)
);
CREATE INDEX presence_customer_task_due_idx ON business_presence_customer_tasks (status, next_reminder_at);
CREATE INDEX presence_customer_task_retry_idx ON business_presence_customer_tasks (status, retry_at);
CREATE INDEX presence_customer_task_plan_status_idx ON business_presence_customer_tasks (plan_id, status);
CREATE INDEX presence_customer_task_family_idx ON business_presence_customer_tasks
  (owner_user_id, business_id, profile_id, kind, created_at DESC);

CREATE TABLE business_presence_task_runtime (
  id varchar PRIMARY KEY,
  sweep_cursor varchar,
  pending_cursor varchar,
  last_attempt_at timestamptz,
  last_successful_tick_at timestamptz,
  last_failure_at timestamptz,
  last_error_code varchar(80)
);
INSERT INTO business_presence_task_runtime (id) VALUES ('site_path');
