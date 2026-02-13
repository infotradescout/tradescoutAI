-- Fast substring search at scale using pg_trgm.
-- Note: pg_trgm may require privileges on some managed Postgres. If it fails,
-- apply the extension manually (or use full-text / external search).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Contractors search (companyName/slug via ILIKE)
CREATE INDEX IF NOT EXISTS "idx_contractors_company_name_trgm"
  ON "contractors" USING gin ("company_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_contractors_slug_trgm"
  ON "contractors" USING gin ("slug" gin_trgm_ops);

-- Counties lookup (name via ILIKE)
CREATE INDEX IF NOT EXISTS "idx_counties_name_trgm"
  ON "counties" USING gin ("name" gin_trgm_ops);

-- Marketplace search (active listings)
CREATE INDEX IF NOT EXISTS "idx_marketplace_listings_title_trgm_active"
  ON "marketplace_listings" USING gin ("title" gin_trgm_ops)
  WHERE "status" = 'active';

CREATE INDEX IF NOT EXISTS "idx_marketplace_listings_brand_trgm_active"
  ON "marketplace_listings" USING gin ("brand" gin_trgm_ops)
  WHERE "status" = 'active';

CREATE INDEX IF NOT EXISTS "idx_marketplace_listings_model_trgm_active"
  ON "marketplace_listings" USING gin ("model" gin_trgm_ops)
  WHERE "status" = 'active';

CREATE INDEX IF NOT EXISTS "idx_marketplace_listings_description_trgm_active"
  ON "marketplace_listings" USING gin ("description" gin_trgm_ops)
  WHERE "status" = 'active';

