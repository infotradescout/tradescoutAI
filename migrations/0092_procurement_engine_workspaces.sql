CREATE TABLE IF NOT EXISTS procurement_workspaces (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug varchar(120) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  workspace_type varchar(80) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_workspaces_slug ON procurement_workspaces (slug);
CREATE INDEX IF NOT EXISTS idx_procurement_workspaces_type ON procurement_workspaces (workspace_type);

CREATE TABLE IF NOT EXISTS procurement_workspace_members (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id varchar NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(60) NOT NULL DEFAULT 'member',
  status varchar(40) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_workspace_members_unique
  ON procurement_workspace_members (workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_procurement_workspace_members_user
  ON procurement_workspace_members (user_id, status);

CREATE TABLE IF NOT EXISTS procurement_workspace_branding (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id varchar NOT NULL UNIQUE REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  public_name varchar(160) NOT NULL,
  tagline text,
  primary_color varchar(32),
  logo_object_key text,
  support_email varchar(220),
  support_phone varchar(80),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_workspace_branding_workspace
  ON procurement_workspace_branding (workspace_id);

CREATE TABLE IF NOT EXISTS procurement_order_sources (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id varchar NOT NULL REFERENCES procurement_workspaces(id) ON DELETE CASCADE,
  source_channel varchar(80) NOT NULL,
  display_name varchar(160) NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'active',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_order_sources_unique
  ON procurement_order_sources (workspace_id, source_channel);
CREATE INDEX IF NOT EXISTS idx_procurement_order_sources_channel
  ON procurement_order_sources (source_channel);

CREATE TABLE IF NOT EXISTS procurement_orders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_number varchar(40) NOT NULL UNIQUE,
  origin_workspace_id varchar NOT NULL REFERENCES procurement_workspaces(id) ON DELETE RESTRICT,
  fulfillment_workspace_id varchar REFERENCES procurement_workspaces(id) ON DELETE SET NULL,
  source_channel varchar(80) NOT NULL,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  customer_name varchar(180),
  customer_email varchar(220),
  customer_phone varchar(80),
  county_id varchar(80),
  job_id varchar(120),
  contractor_profile_id varchar(120),
  homeowner_profile_id varchar(120),
  status varchar(40) NOT NULL DEFAULT 'submitted',
  order_type varchar(40) NOT NULL,
  urgency varchar(40) NOT NULL,
  preferred_supplier_name text,
  preferred_supplier_address text,
  pickup_address text,
  delivery_address text NOT NULL,
  delivery_lat numeric(10, 7),
  delivery_lng numeric(10, 7),
  vehicle_type varchar(40) NOT NULL DEFAULT 'unsure',
  needs_purchase boolean NOT NULL DEFAULT true,
  customer_already_paid boolean NOT NULL DEFAULT false,
  budget_limit_cents integer,
  estimated_material_total_cents integer,
  estimated_delivery_fee_cents integer,
  estimated_service_fee_cents integer,
  approved_total_cents integer,
  actual_material_total_cents integer,
  actual_delivery_fee_cents integer,
  actual_service_fee_cents integer,
  final_total_cents integer,
  partner_order_id varchar(160),
  partner_eta timestamptz,
  notes text,
  internal_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_procurement_orders_user ON procurement_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_origin
  ON procurement_orders (origin_workspace_id, source_channel);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_fulfillment
  ON procurement_orders (fulfillment_workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_status ON procurement_orders (status);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_created_at ON procurement_orders (created_at);

CREATE TABLE IF NOT EXISTS procurement_order_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id varchar NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
  item_name varchar(220) NOT NULL,
  description text,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  unit varchar(60),
  brand_preference varchar(220),
  sku varchar(160),
  url text,
  photo_url text,
  must_match_exactly boolean NOT NULL DEFAULT false,
  substitution_allowed boolean NOT NULL DEFAULT true,
  estimated_unit_price_cents integer,
  approved_unit_price_cents integer,
  actual_unit_price_cents integer,
  status varchar(40) NOT NULL DEFAULT 'requested',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_order_items_order ON procurement_order_items (order_id);

CREATE TABLE IF NOT EXISTS procurement_order_files (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id varchar NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
  uploaded_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  object_key text NOT NULL,
  file_name varchar(260) NOT NULL,
  file_type varchar(120),
  file_size integer,
  file_purpose varchar(80) NOT NULL DEFAULT 'source',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_order_files_order ON procurement_order_files (order_id);

CREATE TABLE IF NOT EXISTS procurement_quotes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id varchar NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
  status varchar(40) NOT NULL DEFAULT 'draft',
  notes text,
  total_amount_cents integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  approved_at timestamptz,
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_quotes_order ON procurement_quotes (order_id);

CREATE TABLE IF NOT EXISTS procurement_quote_lines (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  quote_id varchar NOT NULL REFERENCES procurement_quotes(id) ON DELETE CASCADE,
  line_type varchar(80) NOT NULL,
  label varchar(160) NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_quote_lines_quote ON procurement_quote_lines (quote_id);

CREATE TABLE IF NOT EXISTS procurement_fulfillment_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id varchar NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
  actor_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  actor_type varchar(60) NOT NULL DEFAULT 'system',
  status varchar(40) NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_events_order ON procurement_fulfillment_events (order_id);
CREATE INDEX IF NOT EXISTS idx_procurement_events_created_at ON procurement_fulfillment_events (created_at);

CREATE TABLE IF NOT EXISTS procurement_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id varchar NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
  sender_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  sender_type varchar(60) NOT NULL DEFAULT 'user',
  body text NOT NULL,
  visibility varchar(40) NOT NULL DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_messages_order ON procurement_messages (order_id);

CREATE TABLE IF NOT EXISTS procurement_delivery_proofs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id varchar NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
  uploaded_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  proof_type varchar(60) NOT NULL,
  object_key text NOT NULL,
  file_name varchar(260),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_delivery_proofs_order ON procurement_delivery_proofs (order_id);

CREATE TABLE IF NOT EXISTS procurement_payment_authorizations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id varchar NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
  provider varchar(80) NOT NULL DEFAULT 'manual',
  provider_reference varchar(220),
  status varchar(60) NOT NULL DEFAULT 'manual_pending',
  authorized_amount_cents integer,
  captured_amount_cents integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_payment_authorizations_order
  ON procurement_payment_authorizations (order_id);

CREATE TABLE IF NOT EXISTS partner_webhook_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_slug varchar(120) NOT NULL,
  order_id varchar REFERENCES procurement_orders(id) ON DELETE SET NULL,
  event_type varchar(120) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_webhook_events_partner ON partner_webhook_events (partner_slug);
CREATE INDEX IF NOT EXISTS idx_partner_webhook_events_order ON partner_webhook_events (order_id);

WITH upsert_workspace AS (
  INSERT INTO procurement_workspaces (slug, name, workspace_type, status)
  VALUES
    ('tradescout', 'TradeScout', 'platform', 'active'),
    ('grunt', 'Grunt', 'fulfillment_partner', 'active')
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    workspace_type = EXCLUDED.workspace_type,
    status = EXCLUDED.status,
    updated_at = now()
  RETURNING id, slug
)
INSERT INTO procurement_workspace_branding (workspace_id, public_name, tagline, primary_color, settings)
SELECT id, 'TradeScout Supply Run', 'Order materials from anywhere. Fulfilled by Grunt.', '#f97316',
  jsonb_build_object('mode', 'tradescout_utility')
FROM procurement_workspaces WHERE slug = 'tradescout'
ON CONFLICT (workspace_id) DO UPDATE SET
  public_name = EXCLUDED.public_name,
  tagline = EXCLUDED.tagline,
  primary_color = EXCLUDED.primary_color,
  settings = procurement_workspace_branding.settings || EXCLUDED.settings,
  updated_at = now();

INSERT INTO procurement_workspace_branding (workspace_id, public_name, tagline, primary_color, settings)
SELECT id, 'Grunt Ordering System', 'Get local supplies ordered, picked up, and delivered.', '#16a34a',
  jsonb_build_object('mode', 'grunt_direct_ordering')
FROM procurement_workspaces WHERE slug = 'grunt'
ON CONFLICT (workspace_id) DO UPDATE SET
  public_name = EXCLUDED.public_name,
  tagline = EXCLUDED.tagline,
  primary_color = EXCLUDED.primary_color,
  settings = procurement_workspace_branding.settings || EXCLUDED.settings,
  updated_at = now();

INSERT INTO procurement_order_sources (workspace_id, source_channel, display_name, settings)
SELECT id, 'tradescout_supply_run', 'TradeScout Supply Run', '{}'::jsonb
FROM procurement_workspaces WHERE slug = 'tradescout'
ON CONFLICT (workspace_id, source_channel) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now();

INSERT INTO procurement_order_sources (workspace_id, source_channel, display_name, settings)
SELECT id, 'grunt_direct_ordering', 'Grunt Direct Ordering', '{}'::jsonb
FROM procurement_workspaces WHERE slug = 'grunt'
ON CONFLICT (workspace_id, source_channel) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now();

INSERT INTO procurement_order_sources (workspace_id, source_channel, display_name, settings)
SELECT id, 'admin_created', 'Admin Created', '{}'::jsonb
FROM procurement_workspaces WHERE slug IN ('tradescout', 'grunt')
ON CONFLICT (workspace_id, source_channel) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now();

INSERT INTO procurement_order_sources (workspace_id, source_channel, display_name, settings)
SELECT id, 'repeat_order', 'Repeat Order', '{}'::jsonb
FROM procurement_workspaces WHERE slug IN ('tradescout', 'grunt')
ON CONFLICT (workspace_id, source_channel) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now();
