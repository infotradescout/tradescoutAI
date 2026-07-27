-- Canonical durable-notification delivery outbox schema.
--
-- Production has historically carried notification_delivery_log outside the
-- numbered migration ledger. This migration is intentionally idempotent so it
-- can create the table on older schemas or reconcile missing nullable/runtime
-- columns on installations where an earlier version of the table already
-- exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type type_row
    INNER JOIN pg_namespace namespace_row
      ON namespace_row.oid = type_row.typnamespace
    WHERE namespace_row.nspname = current_schema()
      AND type_row.typname = 'delivery_method'
  ) THEN
    CREATE TYPE delivery_method AS ENUM ('in_app', 'email', 'sms', 'push', 'webhook');
  END IF;
END
$$;

ALTER TYPE delivery_method ADD VALUE IF NOT EXISTS 'in_app';
ALTER TYPE delivery_method ADD VALUE IF NOT EXISTS 'email';
ALTER TYPE delivery_method ADD VALUE IF NOT EXISTS 'sms';
ALTER TYPE delivery_method ADD VALUE IF NOT EXISTS 'push';
ALTER TYPE delivery_method ADD VALUE IF NOT EXISTS 'webhook';

CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id varchar NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_method delivery_method NOT NULL,
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

-- Reconcile installations that already have a historical delivery-log table.
-- Required identity columns are left nullable only when an older populated
-- table lacked them; all new outbox writers provide them explicitly.
ALTER TABLE notification_delivery_log
  ADD COLUMN IF NOT EXISTS id varchar DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS notification_id varchar,
  ADD COLUMN IF NOT EXISTS user_id varchar,
  ADD COLUMN IF NOT EXISTS delivery_method delivery_method,
  ADD COLUMN IF NOT EXISTS status varchar,
  ADD COLUMN IF NOT EXISTS contact_info varchar,
  ADD COLUMN IF NOT EXISTS external_id varchar,
  ADD COLUMN IF NOT EXISTS external_response jsonb,
  ADD COLUMN IF NOT EXISTS error_code varchar,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamp,
  ADD COLUMN IF NOT EXISTS sent_at timestamp,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp,
  ADD COLUMN IF NOT EXISTS failed_at timestamp,
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notification_delivery_notification
  ON notification_delivery_log(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_user
  ON notification_delivery_log(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_status
  ON notification_delivery_log(status);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_retry
  ON notification_delivery_log(next_retry_at);

-- Supports both ordinary due/retry claims and bounded stale-lease recovery.
CREATE INDEX IF NOT EXISTS idx_notification_delivery_email_due_work
  ON notification_delivery_log(
    delivery_method,
    status,
    (COALESCE(next_retry_at, created_at)),
    updated_at,
    created_at,
    id
  )
  WHERE status IN ('pending', 'retry_scheduled', 'processing');
