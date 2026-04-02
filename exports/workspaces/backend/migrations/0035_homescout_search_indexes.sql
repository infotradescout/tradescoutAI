-- HomeScout search/perf indexes (P0)
-- Keep DB-first filtering fast under high concurrency.

-- pg_trgm is already used elsewhere; ensure it's available before GIN trgm indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Common browse query path: status + county + listedAt sort.
CREATE INDEX IF NOT EXISTS "idx_homescout_status_county_listed_at"
  ON "home_scout_listings" ("status", "county_fips", "listed_at" DESC);

-- Filter/sort helpers.
CREATE INDEX IF NOT EXISTS "idx_homescout_status_county_price"
  ON "home_scout_listings" ("status", "county_fips", "price");

CREATE INDEX IF NOT EXISTS "idx_homescout_status_county_beds"
  ON "home_scout_listings" ("status", "county_fips", "beds");

CREATE INDEX IF NOT EXISTS "idx_homescout_status_county_property_type"
  ON "home_scout_listings" ("status", "county_fips", "property_type");

-- Substring search support for query on title/city (used by ilike patterns).
CREATE INDEX IF NOT EXISTS "idx_homescout_title_trgm"
  ON "home_scout_listings" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_homescout_city_trgm"
  ON "home_scout_listings" USING gin ("city" gin_trgm_ops);

