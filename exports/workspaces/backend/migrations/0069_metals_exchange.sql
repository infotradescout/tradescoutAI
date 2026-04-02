-- Metals Exchange (physical-only, USD-only)
-- Adds:
--  - metals_price_snapshots: cached USD spot prices per troy oz (15m refresh cadence)
--  - metals_portfolio_transactions: user-entered portfolio tracking (private)

CREATE TABLE IF NOT EXISTS metals_price_snapshots (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of timestamp NOT NULL DEFAULT now(),
  source varchar(40) NOT NULL DEFAULT 'metals_api',
  base_currency varchar(3) NOT NULL DEFAULT 'USD',
  xau_usd_per_oz decimal(14,4),
  xag_usd_per_oz decimal(14,4),
  xpt_usd_per_oz decimal(14,4),
  xpd_usd_per_oz decimal(14,4),
  raw jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metals_price_snapshots_as_of
  ON metals_price_snapshots (as_of DESC);

CREATE TABLE IF NOT EXISTS metals_portfolio_transactions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction varchar(8) NOT NULL CHECK (direction IN ('buy','sell')),
  metal_code varchar(8) NOT NULL,
  metal_name varchar(64),
  quantity_oz decimal(18,6) NOT NULL,
  total_usd decimal(14,2) NOT NULL,
  executed_at timestamp NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metals_portfolio_transactions_user_executed_at
  ON metals_portfolio_transactions (user_id, executed_at DESC);

-- Ensure a marketplace category exists for physical precious metals listings.
INSERT INTO marketplace_categories (name, description, icon_name, sort_order, requires_verification, is_active)
VALUES (
  'Precious Metals (Physical)',
  'Physical gold, silver, and other metals exchange (USD only).',
  'Coins',
  145,
  false,
  true
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  sort_order = EXCLUDED.sort_order,
  requires_verification = EXCLUDED.requires_verification,
  is_active = true,
  updated_at = now();

