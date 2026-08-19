import { pool } from "../db";

const MANAGED_PARTNER_OPS_DDL = `
CREATE TABLE IF NOT EXISTS managed_partner_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  slug TEXT,
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  archetype TEXT NOT NULL DEFAULT 'contractor',
  control_mode TEXT NOT NULL DEFAULT 'tradescout_admin_controlled',
  contact_mode TEXT NOT NULL DEFAULT 'tradescout_managed',
  exposure_mode TEXT NOT NULL DEFAULT 'public',
  request_mode TEXT NOT NULL DEFAULT 'profile_request_flow',
  request_recipient_slug TEXT,
  expected_primary_cta TEXT,
  expected_phone TEXT,
  expected_email TEXT,
  expected_notification_email TEXT,
  relationship_label TEXT,
  notes TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'incoming',
  priority TEXT NOT NULL DEFAULT 'normal',
  latest_action TEXT,
  blocker_note TEXT,
  created_by_user_id TEXT NOT NULL,
  assigned_to_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT managed_partner_intakes_stage_check CHECK (
    stage IN (
      'incoming',
      'source_review',
      'profile_build',
      'routing_review',
      'ready_to_publish',
      'live',
      'blocked',
      'archived'
    )
  ),
  CONSTRAINT managed_partner_intakes_priority_check CHECK (
    priority IN ('urgent', 'high', 'normal', 'low')
  ),
  CONSTRAINT managed_partner_intakes_archetype_check CHECK (
    archetype IN (
      'contractor',
      'inventory_supplier',
      'product_house',
      'service_creator',
      'source_company_website'
    )
  ),
  CONSTRAINT managed_partner_intakes_control_mode_check CHECK (
    control_mode IN (
      'tradescout_admin_controlled',
      'admin_stewarded_pending_owner_transfer',
      'admin_stewarded_pending_claim',
      'owner_controlled_tradescout_managed_contact'
    )
  ),
  CONSTRAINT managed_partner_intakes_contact_mode_check CHECK (
    contact_mode IN (
      'tradescout_managed',
      'business_phone_tradescout_email',
      'pending_owner_contact'
    )
  ),
  CONSTRAINT managed_partner_intakes_exposure_mode_check CHECK (
    exposure_mode IN ('public', 'direct_only')
  ),
  CONSTRAINT managed_partner_intakes_request_mode_check CHECK (
    request_mode IN ('inline_profile_form', 'profile_request_flow', 'pending')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_managed_partner_intakes_slug_unique
  ON managed_partner_intakes (lower(slug))
  WHERE slug IS NOT NULL AND length(trim(slug)) > 0 AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_managed_partner_intakes_active_queue
  ON managed_partner_intakes (stage, priority, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_managed_partner_intakes_created_by
  ON managed_partner_intakes (created_by_user_id, created_at DESC);
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureManagedPartnerOpsTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = pool.query(MANAGED_PARTNER_OPS_DDL).then(() => undefined);
  }
  return ensurePromise;
}
