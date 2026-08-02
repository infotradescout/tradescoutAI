-- Add the beta super-admin oversight notification type used by
-- server/services/directConnectBetaOversight.ts. Additive only.
-- Journal-built databases retain notifications.type as varchar, while some
-- schema-pushed databases also have a notification_type enum. Extend the enum
-- only where it exists; the varchar contract needs no DDL change.
DO $$
BEGIN
  IF to_regtype('public.notification_type') IS NULL THEN
    RAISE NOTICE 'Skipping notification_type extension: notifications.type is varchar.';
    RETURN;
  END IF;

  EXECUTE
    'ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS ''direct_connect_beta_request''';
END $$;
