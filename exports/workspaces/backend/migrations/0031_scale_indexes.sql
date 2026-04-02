-- Scale hardening indexes (P0/P1)
-- Notes:
-- - Avoid CONCURRENTLY because drizzle migrations may run inside a transaction.
-- - Use IF NOT EXISTS so this is safe across environments.

-- Users: locality scoping and discovery
CREATE INDEX IF NOT EXISTS idx_users_county_fips ON users (county_fips);
CREATE INDEX IF NOT EXISTS idx_users_state_code ON users (state_code);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- Affiliate custom domains: used in request-time redirect
CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_custom_domain ON affiliate_accounts (custom_domain);

-- Address verification: proofs and admin ops
CREATE INDEX IF NOT EXISTS idx_address_verifications_user_id ON address_verifications (user_id);
CREATE INDEX IF NOT EXISTS idx_address_verifications_status_approved_at ON address_verifications (status, approved_at);

-- Contractor discovery joins
CREATE INDEX IF NOT EXISTS idx_contractor_trades_trade_contractor ON contractor_trades (trade_id, contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_trades_contractor ON contractor_trades (contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_counties_county_contractor ON contractor_counties (county_id, contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_counties_contractor ON contractor_counties (contractor_id);

-- Marketplace search: common filters and sorts (default status='active')
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status_created_at ON marketplace_listings (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status_price ON marketplace_listings (status, price);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category_status_created_at ON marketplace_listings (category_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_state_county_status_created_at ON marketplace_listings (state, county, status, created_at DESC);

