-- Durable organic-acquisition lifecycle idempotence and SEO directory snapshots.
-- Both objects are additive and preserve existing event/profile data.

CREATE TABLE IF NOT EXISTS public.ts_seo_directory_business_pages (
  business_id varchar NOT NULL,
  slug varchar(255) NOT NULL,
  display_name varchar(180) NOT NULL,
  trade_slug varchar(128),
  tier varchar(32) NOT NULL,
  claim_status varchar(32) NOT NULL,
  primary_state_code varchar(2) NOT NULL,
  city_slug varchar(128),
  lastmod timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ts_seo_directory_business_pages_pkey PRIMARY KEY (business_id),
  CONSTRAINT ts_seo_directory_business_pages_slug_unique UNIQUE (slug),
  CONSTRAINT ts_seo_directory_business_pages_business_fk
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT ts_seo_directory_business_pages_tier_check
    CHECK (tier IN ('unclaimed', 'verified')),
  CONSTRAINT ts_seo_directory_business_pages_state_check
    CHECK (primary_state_code ~ '^[A-Z]{2}$')
);

COMMENT ON CONSTRAINT ts_seo_directory_business_pages_pkey
  ON public.ts_seo_directory_business_pages IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_directory_business_pages_slug_unique
  ON public.ts_seo_directory_business_pages IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_directory_business_pages_business_fk
  ON public.ts_seo_directory_business_pages IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_directory_business_pages_tier_check
  ON public.ts_seo_directory_business_pages IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_directory_business_pages_state_check
  ON public.ts_seo_directory_business_pages IS 'tradescout-schema:0121:v1';

CREATE INDEX IF NOT EXISTS idx_ts_seo_directory_business_pages_search
  ON public.ts_seo_directory_business_pages
  (lower(display_name) text_pattern_ops, slug, business_id);
CREATE INDEX IF NOT EXISTS idx_ts_seo_directory_business_pages_scope
  ON public.ts_seo_directory_business_pages
  (trade_slug, primary_state_code, city_slug, slug, business_id);
COMMENT ON INDEX public.idx_ts_seo_directory_business_pages_search IS
  'tradescout-schema:0121:v1';
COMMENT ON INDEX public.idx_ts_seo_directory_business_pages_scope IS
  'tradescout-schema:0121:v1';

CREATE TABLE IF NOT EXISTS public.ts_seo_directory_business_counties (
  business_id varchar NOT NULL,
  county_id varchar NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ts_seo_directory_business_counties_pkey PRIMARY KEY (business_id, county_id),
  CONSTRAINT ts_seo_directory_business_counties_business_fk
    FOREIGN KEY (business_id)
    REFERENCES public.ts_seo_directory_business_pages(business_id) ON DELETE CASCADE,
  CONSTRAINT ts_seo_directory_business_counties_county_fk
    FOREIGN KEY (county_id) REFERENCES public.counties(id) ON DELETE CASCADE
);
COMMENT ON CONSTRAINT ts_seo_directory_business_counties_pkey
  ON public.ts_seo_directory_business_counties IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_directory_business_counties_business_fk
  ON public.ts_seo_directory_business_counties IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_directory_business_counties_county_fk
  ON public.ts_seo_directory_business_counties IS 'tradescout-schema:0121:v1';
CREATE INDEX IF NOT EXISTS idx_ts_seo_directory_business_counties_county
  ON public.ts_seo_directory_business_counties (county_id, business_id);
COMMENT ON INDEX public.idx_ts_seo_directory_business_counties_county IS
  'tradescout-schema:0121:v1';

CREATE TABLE IF NOT EXISTS public.ts_seo_directory_snapshot_status (
  snapshot_key varchar(64) NOT NULL,
  generation bigint NOT NULL DEFAULT 1,
  completed_at timestamptz NOT NULL,
  source_row_count integer NOT NULL,
  directory_business_count integer NOT NULL,
  trade_county_page_count integer NOT NULL,
  trade_city_page_count integer NOT NULL,
  trade_city_county_page_count integer NOT NULL,
  city_county_page_count integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ts_seo_directory_snapshot_status_pkey PRIMARY KEY (snapshot_key),
  CONSTRAINT ts_seo_directory_snapshot_status_key_check
    CHECK (snapshot_key = 'directory_scope_v1'),
  CONSTRAINT ts_seo_directory_snapshot_status_counts_check
    CHECK (
      generation > 0
      AND source_row_count >= 0
      AND directory_business_count >= 0
      AND trade_county_page_count >= 0
      AND trade_city_page_count >= 0
      AND trade_city_county_page_count >= 0
      AND city_county_page_count >= 0
    )
);

COMMENT ON CONSTRAINT ts_seo_directory_snapshot_status_pkey
  ON public.ts_seo_directory_snapshot_status IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_directory_snapshot_status_key_check
  ON public.ts_seo_directory_snapshot_status IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_directory_snapshot_status_counts_check
  ON public.ts_seo_directory_snapshot_status IS 'tradescout-schema:0121:v1';

CREATE TABLE IF NOT EXISTS public.ts_seo_trade_city_county_pages (
  trade_slug varchar(128) NOT NULL,
  state_code varchar(2) NOT NULL,
  city_slug varchar(128) NOT NULL,
  county_id varchar NOT NULL,
  lastmod timestamptz NOT NULL,
  business_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ts_seo_trade_city_county_pages_pkey
    PRIMARY KEY (trade_slug, state_code, city_slug, county_id),
  CONSTRAINT ts_seo_trade_city_county_pages_count_check
    CHECK (business_count >= 0),
  CONSTRAINT ts_seo_trade_city_county_pages_county_fk
    FOREIGN KEY (county_id) REFERENCES public.counties(id) ON DELETE CASCADE
);

COMMENT ON CONSTRAINT ts_seo_trade_city_county_pages_pkey
  ON public.ts_seo_trade_city_county_pages IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_trade_city_county_pages_count_check
  ON public.ts_seo_trade_city_county_pages IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_trade_city_county_pages_county_fk
  ON public.ts_seo_trade_city_county_pages IS 'tradescout-schema:0121:v1';
CREATE INDEX IF NOT EXISTS idx_ts_seo_trade_city_county_pages_scope
  ON public.ts_seo_trade_city_county_pages
  (state_code, city_slug, trade_slug, county_id);
COMMENT ON INDEX public.idx_ts_seo_trade_city_county_pages_scope IS
  'tradescout-schema:0121:v1';
CREATE TABLE IF NOT EXISTS public.ts_seo_city_county_pages (
  state_code varchar(2) NOT NULL,
  city_slug varchar(128) NOT NULL,
  county_id varchar NOT NULL,
  lastmod timestamptz NOT NULL,
  business_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ts_seo_city_county_pages_pkey
    PRIMARY KEY (state_code, city_slug, county_id),
  CONSTRAINT ts_seo_city_county_pages_count_check
    CHECK (business_count >= 0),
  CONSTRAINT ts_seo_city_county_pages_county_fk
    FOREIGN KEY (county_id) REFERENCES public.counties(id) ON DELETE CASCADE
);
COMMENT ON CONSTRAINT ts_seo_city_county_pages_pkey
  ON public.ts_seo_city_county_pages IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_city_county_pages_count_check
  ON public.ts_seo_city_county_pages IS 'tradescout-schema:0121:v1';
COMMENT ON CONSTRAINT ts_seo_city_county_pages_county_fk
  ON public.ts_seo_city_county_pages IS 'tradescout-schema:0121:v1';

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_acquisition_lifecycle_user_unique
  ON public.events (event_type, user_id)
  WHERE user_id IS NOT NULL
    AND event_type IN (
      'acquisition.registration_completed',
      'acquisition.activation_completed'
    );

COMMENT ON INDEX public.idx_events_acquisition_lifecycle_user_unique IS
  'tradescout-schema:0121:v1';
