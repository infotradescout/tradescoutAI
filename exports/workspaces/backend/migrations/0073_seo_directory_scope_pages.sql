-- SEO directory scope page snapshots (trade+county, trade+city)
-- These snapshots keep sitemaps "new & true only" without expensive per-request computation.

CREATE TABLE IF NOT EXISTS ts_seo_trade_county_pages (
  trade_slug varchar(128) NOT NULL,
  county_id varchar REFERENCES counties(id) ON DELETE CASCADE,
  state_code varchar(2) NOT NULL,
  county_slug varchar(128) NOT NULL,
  lastmod timestamptz NOT NULL,
  business_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trade_slug, county_id)
);

CREATE INDEX IF NOT EXISTS ts_seo_trade_county_pages_lastmod_idx
  ON ts_seo_trade_county_pages(lastmod DESC);

CREATE TABLE IF NOT EXISTS ts_seo_trade_city_pages (
  trade_slug varchar(128) NOT NULL,
  state_code varchar(2) NOT NULL,
  city_slug varchar(128) NOT NULL,
  lastmod timestamptz NOT NULL,
  business_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trade_slug, state_code, city_slug)
);

CREATE INDEX IF NOT EXISTS ts_seo_trade_city_pages_lastmod_idx
  ON ts_seo_trade_city_pages(lastmod DESC);

