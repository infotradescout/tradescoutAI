-- Restore the existing modeled queue/template tables omitted by the journal.
-- No notifications are enrolled or replayed. Existing synced tables and jobs
-- are preserved; required-schema verification rejects incompatible shapes.
CREATE TABLE IF NOT EXISTS notification_templates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar NOT NULL,
  name varchar NOT NULL,
  description text,
  title_template varchar NOT NULL,
  message_template text NOT NULL,
  email_subject_template varchar,
  email_body_template text,
  sms_template text,
  template_variables jsonb,
  icon_name varchar,
  icon_color varchar DEFAULT 'blue',
  priority public.notification_priority DEFAULT 'normal',
  default_delivery_methods jsonb DEFAULT '["in_app"]'::jsonb,
  expires_after_hours integer DEFAULT 168,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active);
COMMENT ON INDEX idx_notification_templates_type IS 'tradescout-schema:0136:v1';
COMMENT ON INDEX idx_notification_templates_active IS 'tradescout-schema:0136:v1';

CREATE TABLE IF NOT EXISTS notification_jobs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type varchar NOT NULL,
  scheduled_for timestamp NOT NULL,
  target_user_ids jsonb,
  target_filters jsonb,
  notification_type varchar NOT NULL,
  template_id varchar REFERENCES notification_templates(id),
  template_data jsonb,
  status varchar DEFAULT 'pending',
  started_at timestamp,
  completed_at timestamp,
  target_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  error_log jsonb,
  max_retries integer DEFAULT 3,
  retry_count integer DEFAULT 0,
  next_retry_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_scheduled ON notification_jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_status ON notification_jobs(status);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_type ON notification_jobs(job_type);
COMMENT ON INDEX idx_notification_jobs_scheduled IS 'tradescout-schema:0136:v1';
COMMENT ON INDEX idx_notification_jobs_status IS 'tradescout-schema:0136:v1';
COMMENT ON INDEX idx_notification_jobs_type IS 'tradescout-schema:0136:v1';
