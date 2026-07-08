-- Migration 0102: Ensure Direct Connect notification values exist on enum-backed DBs.
-- Some environments have notifications.type backed by notification_type, while older
-- notes treated it as varchar. Keep this idempotent so both realities stay safe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dc_provider_accepted';
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dc_provider_declined';
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dc_provider_interested';
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dc_request_completed';
  END IF;
END $$;
