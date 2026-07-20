-- Add the beta super-admin oversight notification type used by
-- server/services/directConnectBetaOversight.ts. Additive only.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'direct_connect_beta_request';
