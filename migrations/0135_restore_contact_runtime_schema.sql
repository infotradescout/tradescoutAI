-- Journal-built databases still had the original 0000 notifications shape and
-- omitted columns queried by provider search and account privacy initialization.
-- Restore only these existing runtime contracts; preserve stored notifications,
-- contractor recommendations and privacy choices in previously synced databases.
ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS positive_recommendations integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negative_recommendations integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_recommendations integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommendation_score numeric(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS recommendation_percentage numeric(5,2) DEFAULT 0.00;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                 WHERE n.nspname='public' AND t.typname='notification_priority') THEN
    CREATE TYPE public.notification_priority AS ENUM ('low','normal','high','urgent','critical');
  END IF;
END;
$$;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS priority public.notification_priority DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS action_url varchar,
  ADD COLUMN IF NOT EXISTS action_text varchar,
  ADD COLUMN IF NOT EXISTS icon_name varchar,
  ADD COLUMN IF NOT EXISTS icon_color varchar DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS image_url varchar,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS delivery_methods jsonb DEFAULT '["in_app"]'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamp,
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamp,
  ADD COLUMN IF NOT EXISTS expires_at timestamp,
  ADD COLUMN IF NOT EXISTS group_id varchar,
  ADD COLUMN IF NOT EXISTS batch_id varchar,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp,
  ADD COLUMN IF NOT EXISTS clicked_at timestamp,
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='notifications' AND column_name='content') THEN
    -- Keep the legacy content value for audit/history; modern writers use message.
    UPDATE notifications SET message=content WHERE message IS NULL;
    ALTER TABLE notifications ALTER COLUMN content DROP NOT NULL;
  END IF;
END;
$$;
ALTER TABLE notifications ALTER COLUMN message SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id,is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_group ON notifications(group_id);

-- NotificationService resolves delivery preferences before recording an in-app
-- invitation. Its existing schema contract was also absent from the journal.
CREATE TABLE IF NOT EXISTS notification_preferences (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enable_notifications boolean DEFAULT true,
  enable_email_notifications boolean DEFAULT true,
  enable_sms_notifications boolean DEFAULT false,
  enable_push_notifications boolean DEFAULT true,
  type_preferences jsonb DEFAULT '{}'::jsonb,
  quiet_hours_start varchar DEFAULT '22:00',
  quiet_hours_end varchar DEFAULT '08:00',
  timezone varchar DEFAULT 'America/New_York',
  batch_daily_digest boolean DEFAULT false,
  batch_weekly_digest boolean DEFAULT false,
  digest_time varchar DEFAULT '09:00',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                 WHERE n.nspname='public' AND t.typname='delivery_method') THEN
    CREATE TYPE public.delivery_method AS ENUM ('in_app','email','sms','push','webhook');
  END IF;
END;
$$;
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id varchar NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_method public.delivery_method NOT NULL,
  status varchar NOT NULL,
  contact_info varchar,
  external_id varchar,
  external_response jsonb,
  error_code varchar,
  error_message text,
  retry_count integer DEFAULT 0,
  next_retry_at timestamp,
  sent_at timestamp,
  delivered_at timestamp,
  failed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_notification ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_user ON notification_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_status ON notification_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_retry ON notification_delivery_log(next_retry_at);

CREATE TABLE IF NOT EXISTS user_privacy_settings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  profile_visibility varchar DEFAULT 'public',
  show_contact_info boolean DEFAULT true,
  allow_direct_messages boolean DEFAULT true,
  share_activity_status boolean DEFAULT true,
  allow_analytics boolean DEFAULT true,
  allow_third_party_sharing boolean DEFAULT false,
  email_notifications boolean DEFAULT true,
  sms_notifications boolean DEFAULT true,
  marketing_emails boolean DEFAULT false,
  data_retention_consent boolean DEFAULT true,
  privacy_policy_accepted timestamp,
  terms_of_service_accepted timestamp,
  cookie_consent jsonb,
  last_updated timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);
